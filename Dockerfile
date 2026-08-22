# Multi-stage build — the final image only contains production deps + compiled dist,
# not the TypeScript source, dev dependencies, or build toolchain.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile --production && yarn cache clean
COPY --from=builder /app/dist ./dist

EXPOSE 3333
CMD ["node", "dist/main.js"]
