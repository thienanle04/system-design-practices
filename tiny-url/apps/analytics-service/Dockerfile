FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/analytics-service ./apps/analytics-service

RUN npm install
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/analytics-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/analytics-service ./apps/analytics-service

CMD ["node", "apps/analytics-service/dist/index.js"]
