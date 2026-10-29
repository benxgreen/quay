#!/bin/sh
# Runs db/setup/00_roles_and_database.sql against the local Docker Postgres,
# as the postgres superuser (standing in for the Azure admin), with the role
# passwords from .env. Run it once, after `npm run db:up`.
set -eu

cd "$(dirname "$0")/../.."

if [ ! -f .env ]; then
	echo "No .env file. Copy .env.example to .env and fill in the passwords." >&2
	exit 1
fi

# shellcheck disable=SC1091
. ./.env

docker compose exec -T postgres psql \
	--username=postgres --dbname=postgres \
	--set=ON_ERROR_STOP=1 \
	--set=migrator_pw="'${PORTAL_MIGRATOR_PASSWORD}'" \
	--set=app_pw="'${PORTAL_APP_PASSWORD}'" \
	< db/setup/00_roles_and_database.sql
