FROM node:24-slim AS base
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm@10

# Copy workspace config files
COPY package.json pnpm-workspace.yaml tsconfig.json tsconfig.base.json ./
COPY lib/ ./lib/
COPY artifacts/api-server/ ./artifacts/api-server/
COPY artifacts/openenv-dashboard/ ./artifacts/openenv-dashboard/
COPY openenv/ ./openenv/

# Install all deps
RUN pnpm install --no-frozen-lockfile

# Build the API server
RUN pnpm --filter @workspace/api-server run build

# Build the frontend dashboard
RUN pnpm --filter @workspace/openenv-dashboard run build

# ---- Production image ----
FROM node:24-slim AS production
WORKDIR /app

RUN npm install -g pnpm@10

# Copy built artifacts
COPY --from=base /app/artifacts/api-server/dist ./artifacts/api-server/dist
COPY --from=base /app/artifacts/openenv-dashboard/dist ./artifacts/openenv-dashboard/dist
COPY --from=base /app/artifacts/api-server/package.json ./artifacts/api-server/package.json
COPY --from=base /app/openenv/ ./openenv/
COPY --from=base /app/package.json /app/pnpm-workspace.yaml ./

# Install production deps only for API server
WORKDIR /app/artifacts/api-server
RUN pnpm install --prod

WORKDIR /app

# Install Python for baseline script
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install pydantic --break-system-packages 2>/dev/null || pip3 install pydantic

# Serve static frontend files via the API server
ENV NODE_ENV=production
ENV PORT=7860

EXPOSE 7860

# Start server
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
