# Build from the repo root: docker build -f apps/worker/Dockerfile .
FROM node:22-alpine
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/worker/package.json apps/worker/
COPY packages/db/package.json packages/db/
RUN npm ci --omit=dev -w apps/worker -w packages/db && npm i -g tsx
COPY packages/db packages/db
COPY apps/worker apps/worker
CMD ["tsx", "apps/worker/src/index.ts"]
