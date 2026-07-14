# ---- Stage 1: build the static bundle ----
# Why multi-stage: Node is only needed to BUILD; shipping it would mean a
# ~1GB image. The final image is just nginx + ~200KB of static files.
FROM node:20-alpine AS build

WORKDIR /app

# Deps first for layer caching (same reasoning as the API's composer layers)
COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# Vite bakes env vars into the bundle AT BUILD TIME — the API URL must be
# passed as a build arg, not a runtime env var.
ARG VITE_API_URL=http://localhost:8000
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- Stage 2: serve it ----
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80