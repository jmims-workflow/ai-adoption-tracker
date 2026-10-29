# Build stage: install all workspace dependencies and build the React client.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage: server dependencies, server code and the built client only.
FROM node:22-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev -w server && npm cache clean --force
COPY server/ server/
COPY sample-data/ sample-data/
COPY --from=build /app/client/dist client/dist

# The SQLite file is created and seeded here on start, so the app user must own it.
RUN mkdir -p server/data && chown node:node server/data

# Cloud Run sets PORT (usually 8080). The server reads it.
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "server/index.js"]
