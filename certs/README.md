# Supabase database CA

Public CA downloaded from https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt.

Set DATABASE_SSL_CA_PATH=certs/supabase-ca.crt and use the session pooler DATABASE_URL with sslmode=verify-full. The server and Drizzle configuration load this CA with certificate and hostname verification enabled. Paths are relative to the project working directory. Keep database passwords in the ignored .env file.
