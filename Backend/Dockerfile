# HRMS backend, for the test sandbox (docker-compose.sandbox.yml).
# Debian-based: the local embedding model (onnxruntime) needs glibc.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
# Bake the local embedding model into the image, so containers never download it at runtime.
RUN node -e "require('./services/rag/embedder').embed(['warm up']).then(() => console.log('embedding model cached'))"
RUN mkdir -p uploads && chown -R node:node /app
USER node
EXPOSE 8081
CMD ["node", "server.js"]
