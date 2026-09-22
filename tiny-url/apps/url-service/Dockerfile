FROM node:20-alpine AS builder
WORKDIR /app

COPY package.json package-lock.json* ./
COPY tsconfig.json ./
COPY packages/shared ./packages/shared
COPY apps/url-service ./apps/url-service

RUN npm install
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/url-service

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared ./packages/shared
COPY --from=builder /app/apps/url-service ./apps/url-service

EXPOSE 3000
CMD ["node", "apps/url-service/dist/index.js"]
