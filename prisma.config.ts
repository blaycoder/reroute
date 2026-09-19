import "dotenv/config";
import { defineConfig } from "@prisma/cli-engine";
import { defineConfig as ormConfig } from "@prisma/orm-sqlite/config";

export default defineConfig({
  orm: ormConfig({
    contract: "./src/prisma/contract.prisma",
    db: {
      connection: process.env["SQLITE_PATH"] ?? "./db/reroute.db",
    },
  }),
});
