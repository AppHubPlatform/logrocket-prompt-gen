# ---- Build stage: install all deps and build the Vite SPA ----
FROM node:22-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage: production deps + built assets + express server ----
FROM node:22-slim AS runtime

ENV NODE_ENV=production
ENV PORT=8080

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY server.js ./server.js
COPY api ./api
COPY --from=build /app/dist ./dist

# Run as the built-in non-root user provided by the node image.
USER node

EXPOSE 8080

CMD ["node", "server.js"]
