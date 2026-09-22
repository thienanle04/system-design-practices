FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/kgs-service ./apps/kgs-service

RUN npm install
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/kgs-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/kgs-service ./apps/kgs-service

CMD ["node", "apps/kgs-service/dist/index.js"]
