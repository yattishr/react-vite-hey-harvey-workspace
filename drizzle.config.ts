import "dotenv/config";
import { readFileSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/postgres",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
    ...(process.env.DATABASE_SSL_CA_PATH
      ? { ssl: { ca: readFileSync(process.env.DATABASE_SSL_CA_PATH, "utf8"), rejectUnauthorized: true } }
      : {}),
  },
});
