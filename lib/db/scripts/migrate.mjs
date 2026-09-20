import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const migrationsDirectory = fileURLToPath(
  new URL("../migrations/", import.meta.url),
);
const migrationFilePattern = /^\d+_[a-z0-9][a-z0-9_-]*\.sql$/;
const lockName = "@workspace/db:migrations";

function migrationBody(sql, fileName) {
  const withoutTransaction = sql
    .replace(/^\s*BEGIN\s*;\s*/i, "")
    .replace(/\s*COMMIT\s*;\s*$/i, "")
    .trim();

  if (/\b(?:BEGIN|COMMIT|ROLLBACK)\s*;/i.test(withoutTransaction)) {
    throw new Error(
      `Migration ${fileName} contains transaction control. ` +
        "Transactions are managed by the migration runner.",
    );
  }

  return withoutTransaction;
}

async function loadMigrations() {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const fileNames = entries
    .filter(
      (entry) => entry.isFile() && migrationFilePattern.test(entry.name),
    )
    .map((entry) => entry.name)
    .sort();

  return Promise.all(
    fileNames.map(async (fileName) => {
      const sql = await readFile(
        path.join(migrationsDirectory, fileName),
        "utf8",
      );

      return {
        fileName,
        checksum: createHash("sha256").update(sql).digest("hex"),
        sql: migrationBody(sql, fileName),
      };
    }),
  );
}

async function run() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL must be set before database migrations can run.",
    );
  }

  const migrations = await loadMigrations();
  const client = new Client({ connectionString });
  await client.connect();

  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockName]);
    await client.query(`
      CREATE TABLE IF NOT EXISTS workspace_schema_migrations (
        file_name text PRIMARY KEY,
        checksum text NOT NULL,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const result = await client.query(
      "SELECT file_name, checksum FROM workspace_schema_migrations",
    );
    const applied = new Map(
      result.rows.map((row) => [row.file_name, row.checksum]),
    );

    let appliedCount = 0;
    for (const migration of migrations) {
      const previousChecksum = applied.get(migration.fileName);
      if (previousChecksum) {
        if (previousChecksum !== migration.checksum) {
          throw new Error(
            `Migration ${migration.fileName} was changed after it was applied.`,
          );
        }
        continue;
      }

      await client.query("BEGIN");
      try {
        if (migration.sql) {
          await client.query(migration.sql);
        }
        await client.query(
          `INSERT INTO workspace_schema_migrations (file_name, checksum)
           VALUES ($1, $2)`,
          [migration.fileName, migration.checksum],
        );
        await client.query("COMMIT");
        appliedCount += 1;
        process.stdout.write(`Applied ${migration.fileName}\n`);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    }

    process.stdout.write(
      `Database migrations complete: ${appliedCount} applied, ` +
        `${migrations.length - appliedCount} already current.\n`,
    );
  } finally {
    try {
      await client.query("SELECT pg_advisory_unlock(hashtext($1))", [lockName]);
    } finally {
      await client.end();
    }
  }
}

run().catch((error) => {
  process.stderr.write(
    `Database migration failed: ${
      error instanceof Error ? error.message : String(error)
    }\n`,
  );
  process.exitCode = 1;
});