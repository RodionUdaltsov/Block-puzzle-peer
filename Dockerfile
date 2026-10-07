FROM node:24-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json ./
# Reproducible install from the lockfile; a failed install must fail the build
# (the server cannot start without the pg driver).
RUN npm ci --omit=dev --no-audit --no-fund

COPY server.js ./
COPY shared ./shared
COPY lib ./lib
COPY public ./public
COPY vendor ./vendor
COPY scripts ./scripts
COPY docs ./docs
COPY README.md LICENSE ./

# Build generated assets (index.html, styles.css, client bundle) from their modular sources
RUN npm run build

ENV NODE_ENV=production
ENV PORT=9000
# Player progress source of truth: PostgreSQL
# ENV BP_STORE=postgres
# ENV DATABASE_URL=postgres://bp:<password>@postgres:5432/blockpuzzle
# Production: also set BP_ADMIN_KEY, BP_TRUST_PROXY and BP_WS_ORIGINS (see README)

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
