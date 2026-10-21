FROM php:8.5.12-fpm-alpine

# OPcache is built into PHP 8.5; installing it via docker-php-ext-install fails.
RUN apk add --no-cache git unzip icu-dev \
    && docker-php-ext-install pdo_mysql intl

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /app
