/**
 * Static file server for /public: MIME types, ETag + 304, cached bytes, lazy gzip/brotli variants.
 * Extracted from server.js — behaviour unchanged.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

/**
 * @param {{ applySecurityHeaders: (res: any) => void }} deps
 */
function createStaticServer(deps) {
  const applySecurityHeaders = deps.applySecurityHeaders;

  const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.webmanifest': 'application/manifest+json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.map': 'application/json',
    '.txt': 'text/plain; charset=utf-8'
  };

  /** Extensions eligible for on-the-fly gzip (text-like assets). */
  const COMPRESSIBLE = new Set([
    '.html', '.js', '.mjs', '.css', '.json', '.svg', '.webmanifest', '.txt', '.map'
  ]);


  /**
   * Static file cache: raw bytes + ETag + lazily built gzip / brotli variants.
   * Before this, every page load re-read the file from disk and re-gzipped ~1.6 MB of JS/CSS
   * (CPU spike per visitor) and `no-store` made phones re-download all of it on every launch.
   * Entries are validated against mtime+size with one cheap stat() per request.
   */
  const staticCache = new Map();
  const STATIC_CACHE_MAX_BYTES = 8 * 1024 * 1024;

  function loadStatic(filePath, cb) {
    fs.stat(filePath, (serr, st) => {
      if (serr || !st.isFile()) return cb(serr || new Error('not a file'));
      const hit = staticCache.get(filePath);
      if (hit && hit.mtimeMs === st.mtimeMs && hit.size === st.size) return cb(null, hit);
      fs.readFile(filePath, (err, data) => {
        if (err) return cb(err);
        const entry = {
          mtimeMs: st.mtimeMs,
          size: st.size,
          data,
          etag: '"' + crypto.createHash('sha1').update(data).digest('base64').slice(0, 22) + '"',
          gz: null,
          br: null
        };
        if (data.length <= STATIC_CACHE_MAX_BYTES) staticCache.set(filePath, entry);
        cb(null, entry);
      });
    });
  }

  function variantFor(entry, kind, cb) {
    if (entry[kind]) return cb(entry[kind]);
    const done = (err, out) => {
      // Fall back to identity if compression failed or didn't help
      entry[kind] = (!err && out && out.length < entry.data.length) ? out : false;
      cb(entry[kind]);
    };
    if (kind === 'br') {
      zlib.brotliCompress(entry.data, {
        params: {
          [zlib.constants.BROTLI_PARAM_QUALITY]: 9,
          [zlib.constants.BROTLI_PARAM_SIZE_HINT]: entry.data.length
        }
      }, done);
    } else {
      zlib.gzip(entry.data, { level: 9 }, done);
    }
  }

  /**
   * Serve a static file with ETag revalidation and gzip / brotli when the client accepts it.
   * @param {import('http').IncomingMessage} req
   * @param {import('http').ServerResponse} res
   * @param {string} filePath
   */
  function sendFile(req, res, filePath) {
    loadStatic(filePath, (err, entry) => {
      if (err) {
        applySecurityHeaders(res);
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      let data = entry.data;
      const ext = path.extname(filePath).toLowerCase();
      // HTML documents get a fresh CSP nonce on every response; inline <script> tags carry it.
      // Never cached/revalidated (a 304 would pair an old body+nonce with a new header).
      let nonce = null;
      if (ext === '.html') {
        nonce = crypto.randomBytes(16).toString('base64');
        data = Buffer.from(
          data.toString('utf8').replace(/<script(?![^>]*\bnonce=)(?=[\s>])/gi, '<script nonce="' + nonce + '"'),
          'utf8'
        );
      }
      const base = path.basename(filePath).toLowerCase();
      const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream' };
      if (!nonce) headers['ETag'] = entry.etag;
      // Service worker must not be long-cached or browsers keep a stale install path
      if (base === 'sw.js') {
        headers['Cache-Control'] = 'no-store, no-cache, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Service-Worker-Allowed'] = '/';
      } else if (ext === '.html' || ext === '.js' || ext === '.mjs' || ext === '.css' || ext === '.webmanifest') {
        // `no-cache` = always revalidate with the ETag: never stale, but a 304 (no body) when
        // unchanged — phones stop re-downloading ~400 KB (compressed) of JS/CSS on every launch.
        headers['Cache-Control'] = nonce ? 'no-store' : 'no-cache';
      } else if (ext === '.svg' || ext === '.woff2' ||
                 ext === '.png' || ext === '.jpg' || ext === '.ico') {
        headers['Cache-Control'] = 'public, max-age=86400';
      }

      // Copy security headers into the response map before writeHead
      applySecurityHeaders({
        setHeader(k, v) { headers[k] = v; }
      }, { nonce });

      // Conditional request → 304
      const inm = String((req && req.headers && req.headers['if-none-match']) || '');
      if (!nonce && inm && inm.split(/\s*,\s*/).some((t) => t === entry.etag || t === 'W/' + entry.etag)) {
        headers['Vary'] = 'Accept-Encoding';
        res.writeHead(304, headers);
        res.end();
        return;
      }

      const accept = String((req && req.headers && req.headers['accept-encoding']) || '');
      const compressible = COMPRESSIBLE.has(ext) && data.length > 512;
      const kind = !compressible ? null : (/\bbr\b/.test(accept) ? 'br' : (/\bgzip\b/.test(accept) ? 'gzip' : null));
      const send = (body, enc) => {
        if (enc) { headers['Content-Encoding'] = enc; }
        if (compressible) headers['Vary'] = 'Accept-Encoding';
        headers['Content-Length'] = body.length;
        res.writeHead(200, headers);
        if (req && req.method === 'HEAD') res.end(); else res.end(body);
      };
      if (!kind) return send(data, null);
      if (nonce) {
        // per-request body: compress on the fly (small), no shared variant cache
        const gz = kind === 'gzip' ? zlib.gzipSync(data, { level: 6 }) : zlib.brotliCompressSync(data, { params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 } });
        return send(gz, kind === 'br' ? 'br' : 'gzip');
      }
      const slot = kind === 'br' ? 'br' : 'gz';
      variantFor(entry, slot, (variant) => {
        if (variant) send(variant, kind === 'br' ? 'br' : 'gzip');
        else send(data, null);
      });
    });
  }

  return { sendFile, MIME, COMPRESSIBLE };
}

module.exports = { createStaticServer };
