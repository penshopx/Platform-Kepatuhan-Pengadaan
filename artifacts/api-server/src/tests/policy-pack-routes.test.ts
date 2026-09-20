import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createServer, type Server } from "node:http";
import express from "express";
import pinoHttp from "pino-http";
import { db, pool } from "@workspace/db";
import { createPolicyPackHandler } from "../routes/legal-admin";

async function withServer(run: (baseUrl: string) => Promise<void>) {
  const app = express();
  app.use(pinoHttp({ enabled: false }));
  app.use(express.json());
  app.post(
    "/api/legal-admin/policy-packs",
    (_req, res, next) => {
      res.locals.adminActor = { id: "policy-pack-route-test", role: "ADMIN" };
      next();
    },
    createPolicyPackHandler(db),
  );

  const server: Server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");

  try {
    await run(`http://127.0.0.1:${address.port}/api/legal-admin`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

async function createPolicyPack(
  baseUrl: string,
  body: { packName: string; regimeType: string; version: string },
) {
  return fetch(`${baseUrl}/policy-packs`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const suffix = randomUUID();
const packName = `Policy pack route test ${suffix}`;
const version = "1.0.0";

try {
  await withServer(async (baseUrl) => {
    const firstRegime = await createPolicyPack(baseUrl, {
      packName,
      regimeType: "REGIME_A",
      version,
    });
    assert.equal(firstRegime.status, 201);

    const secondRegime = await createPolicyPack(baseUrl, {
      packName,
      regimeType: "REGIME_B",
      version,
    });
    assert.equal(secondRegime.status, 201);

    const duplicate = await createPolicyPack(baseUrl, {
      packName,
      regimeType: "REGIME_A",
      version,
    });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), {
      error: `Policy pack "${packName}" untuk regime REGIME_A versi ${version} sudah ada`,
    });
  });
} finally {
  const cleanupClient = await pool.connect();
  try {
    await cleanupClient.query("BEGIN");
    await cleanupClient.query(
      "SELECT set_audit_context($1, 'SYSTEM', 'TEST', 'Clean up policy pack route test')",
      ["policy-pack-route-test"],
    );
    await cleanupClient.query("DELETE FROM policy_packs WHERE pack_name = $1", [
      packName,
    ]);
    await cleanupClient.query("COMMIT");
  } catch (error) {
    await cleanupClient.query("ROLLBACK");
    throw error;
  } finally {
    cleanupClient.release();
  }
  await pool.end();
}

console.log("Policy pack route HTTP integration tests passed");