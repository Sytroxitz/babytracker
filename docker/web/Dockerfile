# Production web image: builds the PWA and serves it with nginx,
# proxying /api to the php-fpm container.
# Build context is the repository root:
#   docker build -f docker/web/Dockerfile .
FROM node:22-alpine AS build
WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

COPY frontend/ .

# Version info normally comes from git; in CI it is passed in explicitly.
ARG BUILD_NUMBER=0
ARG GIT_SHA=unknown
ARG GIT_DATE=
ENV BUILD_NUMBER=$BUILD_NUMBER GIT_SHA=$GIT_SHA GIT_DATE=$GIT_DATE

RUN npm run build

FROM nginx:alpine
COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
