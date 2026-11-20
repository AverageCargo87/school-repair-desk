import "dotenv/config";
import { db, dbDriver } from "./index";

async function main() {
  if (dbDriver === "pg") {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(db as unknown as Parameters<typeof migrate>[0], {
      migrationsFolder: "drizzle",
    });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(db as unknown as Parameters<typeof migrate>[0], {
      migrationsFolder: "drizzle",
    });
  }
  console.log(`Migrations applied (driver: ${dbDriver}).`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
