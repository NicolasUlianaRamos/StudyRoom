FROM node:24-bookworm
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libdbus-1-3 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
    libasound2 libgtk-3-0 xvfb xauth fonts-liberation rpm libarchive-tools \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /work
RUN chown node:node /work
USER node
COPY --chown=node:node package.json package-lock.json ./
RUN npm ci
COPY --chown=node:node . .
# As migrações fazem fsync real; o disco virtual do Docker pode exceder 5 s.
RUN npm test -- --testTimeout=30000 && npm run dist:linux
CMD ["xvfb-run", "--auto-servernum", "npm", "run", "test:integration"]
