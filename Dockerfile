FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server.js ./
COPY public ./public
ENV NODE_ENV=production
ENV PEER_PATH=/peerjs
ENV PEER_KEY=peerjs
EXPOSE 10000
CMD ["node", "server.js"]
