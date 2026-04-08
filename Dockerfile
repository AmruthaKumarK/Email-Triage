FROM node:24-slim
WORKDIR /app

# Copy pre-built API server bundle (esbuild bundles all deps — no npm install needed)
COPY artifacts/api-server/dist ./artifacts/api-server/dist

# Copy pre-built frontend static files
COPY artifacts/openenv-dashboard/dist ./artifacts/openenv-dashboard/dist

# Copy Python environment
COPY openenv/ ./openenv/

# Install Python + pydantic for baseline/inference scripts
RUN apt-get update && apt-get install -y python3 python3-pip && rm -rf /var/lib/apt/lists/*
RUN pip3 install pydantic --break-system-packages 2>/dev/null || pip3 install pydantic

ENV NODE_ENV=production
ENV PORT=7860

EXPOSE 7860

CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
