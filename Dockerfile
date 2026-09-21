FROM node:20-bookworm-slim
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY public ./public

ENV NODE_ENV=production
ENV PORT=9000

EXPOSE 9000
CMD ["node", "server.js"]
