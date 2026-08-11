FROM node:22.14-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY . .
RUN npm run build

FROM node:22.14-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.output ./.output
COPY --from=build /app/public ./public
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
