/**
 * Block Puzzle — lib/auth-cookie.js
 * Session token as an HttpOnly cookie (`bp_token`), so page JavaScript (and therefore XSS) never
 * has to hold the long-lived credential.
 *
 * Opt-in per request with the header `X-Auth-Cookie: 1` (sent by the web client); API clients that
 * do not send it keep getting the token in the JSON body and use `Authorization: Bearer`.
 * The client keeps only the non-secret marker SESSION_MARKER where it used to keep the token.
 */
'use strict';

const { clock } = require('./clock');
const COOKIE_NAME = 'bp_token';
const SESSION_MARKER = 'cookie';
const MAX_AGE_SEC = 30 * 24 * 3600; // same as SESSION_TTL_SEC in accounts.js

/**
 * Secure is ON by default in production (NODE_ENV=production). BP_COOKIE_SECURE=1 forces it on,
 * BP_COOKIE_SECURE=0 is an explicit dev/plain-HTTP override. Outside production it stays opt-in.
 */
function cookieSecure() {
  const v = String(process.env.BP_COOKIE_SECURE === undefined ? '' : process.env.BP_COOKIE_SECURE).trim();
  if (v === '1') return true;
  if (v === '0') return false;
  return process.env.NODE_ENV === 'production';
}
function secureAttr() {
  return cookieSecure() ? '; Secure' : '';
}

function setCookieHeader(token) {
  return COOKIE_NAME + '=' + encodeURIComponent(String(token)) +
    '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + MAX_AGE_SEC + secureAttr();
}

function clearCookieHeader() {
  return COOKIE_NAME + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' + secureAttr();
}

/** Token from a Cookie header ('' when absent). */
function readCookieToken(cookieHeader) {
  const m = new RegExp('(?:^|;\\s*)' + COOKIE_NAME + '=([^;]+)').exec(String(cookieHeader || ''));
  if (!m) return '';
  try { return decodeURIComponent(m[1]).slice(0, 512); } catch (_) { return ''; }
}

/** The client says "use the cookie" instead of presenting a token. */
function isMarker(v) {
  return String(v || '').trim() === SESSION_MARKER;
}

// One-time WebSocket tickets: after an in-page login the already-open socket never saw the new
// cookie (cookies are read at upgrade). The login response carries a 60 s single-use ticket the
// client hands to presence_register; the page never holds the real token.
const TICKET_TTL_MS = 60000;
const TICKET_MAX = 5000;
const tickets = new Map();
function issueTicket(token) {
  const now = clock.now();
  if (tickets.size >= TICKET_MAX) {
    for (const [k, v] of tickets) { if (v.exp < now) tickets.delete(k); }
    if (tickets.size >= TICKET_MAX) tickets.delete(tickets.keys().next().value);
  }
  const id = require('crypto').randomBytes(24).toString('hex');
  tickets.set(id, { token: String(token), exp: now + TICKET_TTL_MS });
  return id;
}
/** Single use. Returns the session token or ''. */
function consumeTicket(id) {
  const e = tickets.get(String(id || ''));
  if (!e) return '';
  tickets.delete(String(id));
  return e.exp >= clock.now() ? e.token : '';
}

module.exports = { cookieSecure, issueTicket, consumeTicket, COOKIE_NAME, SESSION_MARKER, setCookieHeader, clearCookieHeader, readCookieToken, isMarker };
