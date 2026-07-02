#!/bin/sh
set -e

# First start on a fresh volume: create the JWT keypair from JWT_PASSPHRASE.
if [ ! -f config/jwt/private.pem ]; then
    if [ -z "$JWT_PASSPHRASE" ]; then
        echo "ERROR: JWT_PASSPHRASE is not set and no keypair exists" >&2
        exit 1
    fi
    echo "Generating JWT keypair ..."
    mkdir -p config/jwt
    openssl genpkey -out config/jwt/private.pem -aes256 -algorithm rsa \
        -pkeyopt rsa_keygen_bits:4096 -pass pass:"$JWT_PASSPHRASE"
    openssl pkey -in config/jwt/private.pem -passin pass:"$JWT_PASSPHRASE" \
        -out config/jwt/public.pem -pubout
fi

echo "Waiting for database ..."
until php bin/console dbal:run-sql "SELECT 1" >/dev/null 2>&1; do
    sleep 2
done

php bin/console doctrine:migrations:migrate --no-interaction --allow-no-migration
php bin/console cache:clear

# php-fpm workers run as www-data and must be able to write cache/logs.
chown -R www-data:www-data var config/jwt

exec "$@"
