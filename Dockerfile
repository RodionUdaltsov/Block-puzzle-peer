FROM node:20-bookworm-slim
WORKDIR /app

# No npm dependencies — pure Node + vendor/ws + shared/rules + optional Redis/file store
COPY package.json ./
COPY server.js ./
COPY shared ./shared
COPY lib ./lib
COPY public ./public
COPY vendor ./vendor

ENV NODE_ENV=production
ENV PORT=9000
# Persistence: memory (default) | file | redis
# ENV BP_STORE=file
# ENV REDIS_URL=redis://redis:6379
EXPOSE 9000
CMD ["node", "server.js"]
