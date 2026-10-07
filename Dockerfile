FROM node:22-alpine AS dev
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM dev AS build
COPY tsconfig*.json ./
COPY src ./src
COPY drizzle ./drizzle
RUN pnpm run build && pnpm prune --prod

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
USER node
EXPOSE 3000
# Apply pending migrations, then start the server
CMD ["sh", "-c", "node dist/db/migrate.js && exec node dist/server.js"]
