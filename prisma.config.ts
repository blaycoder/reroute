import "dotenv/config";
import { defineConfig } from "@prisma/cli-engine";
import { defineConfig as ormConfig } from "@prisma/orm-postgres/config";

// The CLI (emit, db init, migrations) needs the DIRECT connection string. The
// running app should use the pooled one (set separately in the host's env).
const databaseUrl = process.env["DATABASE_URL"];
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env and fill it in.");
}

export default defineConfig({
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    db: { connection: databaseUrl },
  }),
});
