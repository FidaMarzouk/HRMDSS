# ENOVA Assistant agent service (also used for the gateway and the eval runner).
FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY gateway ./gateway
COPY eval ./eval
USER node
EXPOSE 8090
HEALTHCHECK --interval=15s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1:8090/health >/dev/null || exit 1
CMD ["node", "src/server.js"]
