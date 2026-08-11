FROM node:22.14-bookworm-slim AS build
WORKDIR /app
ARG VITE_API_URL=https://nexuscalendar-api.up.railway.app/api/v1
ENV VITE_API_URL=$VITE_API_URL
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
