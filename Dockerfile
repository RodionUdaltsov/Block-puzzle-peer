FROM node:20-bookworm-slim

WORKDIR /app

# Zero npm dependencies — pure Node + vendor/ws + shared/rules + optional Redis/file store
COPY package.json ./
COPY server.js ./
COPY shared ./shared
COPY lib ./lib
COPY public ./public
COPY vendor ./vendor
COPY scripts ./scripts
COPY README.md LICENSE ./

# Ensure CSS + client bundles are present and up to date
RUN node scripts/bundle-css.js && node scripts/bundle-client.js

ENV NODE_ENV=production
ENV PORT=9000
# Persistence: file (default) | memory | redis
# ENV BP_STORE=file
# ENV REDIS_URL=redis://redis:6379

# Non-root user
RUN groupadd --system --gid 1001 bp \
  && useradd --system --uid 1001 --gid bp --home /app --shell /usr/sbin/nologin bp \
  && mkdir -p /app/data \
  && chown -R bp:bp /app

USER bp

EXPOSE 9000

# Healthcheck hits the built-in /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "require('http').get('http://127.0.0.1:'+(process.env.PORT||9000)+'/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"

VOLUME ["/app/data"]

CMD ["node", "server.js"]
