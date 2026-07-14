# Why php:8.4-apache: one container, no separate fpm+nginx wiring — right-sized
# for a single-endpoint API. Apache's docroot is pointed at Laravel's /public.
FROM php:8.4-apache

# System deps + PHP extensions Laravel needs (mbstring ships built-in on 8.x images;
# zip/curl cover Composer and the mailer transport).
# apt upgrading apache2 can auto-enable mpm_event alongside the image's
# mpm_prefork ("More than one MPM loaded", AH00534). mod_php requires
# prefork — remove all other MPM symlinks and declare prefork explicitly.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libzip-dev unzip \
    && docker-php-ext-install zip \
    && rm -f /etc/apache2/mods-enabled/mpm_event.load \
             /etc/apache2/mods-enabled/mpm_event.conf \
             /etc/apache2/mods-enabled/mpm_worker.load \
             /etc/apache2/mods-enabled/mpm_worker.conf \
    && a2enmod mpm_prefork rewrite \
    && rm -rf /var/lib/apt/lists/*

# Point Apache at Laravel's public/ directory
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' \
        /etc/apache2/sites-available/*.conf /etc/apache2/apache2.conf

# Composer from the official image (multi-stage copy — no curl-pipe-sh)
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

# Why deps first, code second: Docker layer caching — composer install only
# re-runs when composer.json/lock change, not on every code edit.
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist

COPY . .
RUN composer dump-autoload --optimize \
    && chown -R www-data:www-data storage bootstrap/cache

EXPOSE 80