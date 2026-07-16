FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
COPY apps/backend/package.json apps/backend/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci
COPY apps/backend apps/backend
RUN npm run build --workspace=@display/backend

FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/backend/package.json ./package.json
COPY --from=build /app/apps/backend/dist ./dist
USER node
EXPOSE 3001
CMD ["node", "dist/index.js"]
