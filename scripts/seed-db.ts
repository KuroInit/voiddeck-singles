import { rmSync } from "node:fs";

import { DB_PATH, ensureSeeded } from "../src/lib/db";
import { getStats } from "../src/lib/marketplace";

async function main(): Promise<void> {
  // Explicit reseed: drop the database file, recreate the schema, seed everything.
  for (const suffix of ["", "-wal", "-shm"]) {
    rmSync(`${DB_PATH}${suffix}`, { force: true });
  }
  ensureSeeded();

  const stats = await getStats();
  console.log(`Seeded ${DB_PATH}`);
  console.log(`  users:            ${stats.userCount}`);
  console.log(`  posts (open):     sale=${stats.saleCount} want=${stats.wantCount}`);
  console.log(`  cards:            ${stats.cardCount}`);
  console.log(`  variations:       ${stats.variationCount}`);
  console.log(`  foil variants:    ${stats.foilCount}`);
}

main();
