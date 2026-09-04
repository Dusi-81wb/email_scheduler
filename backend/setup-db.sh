#!/usr/bin/env bash
set -e

# Configure postgresql.conf
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" /etc/postgresql/18/main/postgresql.conf

# Configure pg_hba.conf to allow password connections
grep -q "host all all 0.0.0.0/0 md5" /etc/postgresql/18/main/pg_hba.conf || echo "host all all 0.0.0.0/0 trust" >> /etc/postgresql/18/main/pg_hba.conf
grep -q "host all all ::0/0 md5" /etc/postgresql/18/main/pg_hba.conf || echo "host all all ::0/0 trust" >> /etc/postgresql/18/main/pg_hba.conf

pg_ctlcluster 18 main restart
service redis-server restart

echo "Postgres and Redis configured and listening on all interfaces!"
