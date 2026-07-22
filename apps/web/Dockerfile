# Build from the repo root: docker build -f apps/web/Dockerfile .
FROM node:22-alpine AS base

FROM base AS deps
WORKDIR /repo
COPY package.json package-lock.json* ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/
# --include=dev: the build needs devDependencies (tailwind, typescript,
# @tailwindcss/postcss). Coolify injects NODE_ENV=production at build time, which
# would otherwise make npm ci skip them and fail `next build`.
RUN npm ci --include=dev

FROM base AS build
WORKDIR /repo
COPY --from=deps /repo/node_modules ./node_modules
COPY . .
RUN npm run build -w apps/web

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup -S nodejs && adduser -S nextjs -G nodejs
COPY --from=build /repo/apps/web/.next/standalone ./
COPY --from=build /repo/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /repo/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "apps/web/server.js"]
