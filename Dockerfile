# PDF rendering service (Render). The web app itself deploys to Vercel.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium fonts-liberation ca-certificates dumb-init \
  && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    CHROME_NO_SANDBOX=true \
    NODE_OPTIONS=--max-old-space-size=384

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

COPY tsconfig.json ./
COPY services ./services
COPY src ./src

ENV NODE_ENV=production
USER node
EXPOSE 10000
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "node_modules/tsx/dist/cli.mjs", "--tsconfig", "services/tsconfig.json", "services/pdf-server.ts"]
