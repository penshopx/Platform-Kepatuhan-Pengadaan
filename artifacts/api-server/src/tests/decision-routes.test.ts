import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import express from "express";
import type { db as productionDb } from "@workspace/db";
import { createPolicyEngineRouter } from "../routes/policy-engine";

type StoredDecisionRow = {
  id: string;
  snapshot: Record<string, unknown>;
  evaluatorVersion: string;
  evaluatedAt: Date;
};

const decisionIds = {
  older: "11111111-1111-4111-8111-111111111111",
  latest: "22222222-2222-4222-8222-222222222222",
  missing: "33333333-3333-4333-8333-333333333333",
};
const policyPackId = "44444444-4444-4444-8444-444444444444";
const ruleId = "55555555-5555-4555-8555-555555555555";
const provisionId = "66666666-6666-4666-8666-666666666666";
const sourceId = "77777777-7777-4777-8777-777777777777";

const snapshot = {
  policyPack: {
    id: policyPackId,
    name: "Paket kebijakan pengadaan",
    version: "2.1.0",
    status: "PUBLISHED",
  },
  evaluation: {
    input: {
      entityType: "PROCUREMENT_PACKAGE",
      entityId: "package-42",
      policyPackId,
      context: { packageValue: 150, evaluationDate: "2026-09-20" },
    },
    output: {
      status: "COMPLIANT",
      passed: 1,
      failed: 0,
      mandatoryFailed: 0,
      notApplicable: 0,
    },
    rules: [
      {
        rule: {
          id: ruleId,
          key: "minimum_value",
          category: "COMPLIANCE",
          description: "Nilai minimum terpenuhi",
          valueType: "BOOLEAN",
          mandatory: true,
        },
        provision: {
          id: provisionId,
          articleNumber: "1",
          provisionType: "COMPLIANCE",
          rawText: "Nilai paket harus memenuhi ambang.",
        },
        source: {
          id: sourceId,
          regulationCode: "TEST-2026",
          title: "Peraturan pengujian",
          issuingAuthority: "Otoritas Uji",
          authorityLevel: 1,
          isBinding: true,
        },
        verificationStatus: "VERIFIED",
        input: { packageValue: 150 },
        output: {
          status: "PASS",
          value: true,
          referencedPaths: ["packageValue"],
        },
      },
    ],
  },
};

function storedDecision(
  id: string,
  evaluatedAt: string,
): StoredDecisionRow {
  return {
    id,
    snapshot,
    evaluatorVersion: "1.0.0",
    evaluatedAt: new Date(evaluatedAt),
  };
}

function fakeDatabase(results: StoredDecisionRow[][]) {
  let selectCount = 0;
  let insertCount = 0;

  const database = {
    select() {
      const result = results[selectCount++] ?? [];
      const query: Record<string, unknown> & PromiseLike<StoredDecisionRow[]> = {
        from() {
          return query;
        },
        where() {
          return query;
        },
        orderBy() {
          return Promise.resolve(result);
        },
        then(resolve, reject) {
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return query;
    },
    insert() {
      insertCount += 1;
      throw new Error("GET keputusan tidak boleh menulis decision reference");
    },
  };

  return {
    database: database as unknown as typeof productionDb,
    getInsertCount: () => insertCount,
  };
}

async function withServer(
  database: typeof productionDb,
  run: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  app.use(express.json());
  app.use("/api", createPolicyEngineRouter(database));
  const server: Server = createServer(app);

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert(address && typeof address !== "string");

  try {
    await run(`http://127.0.0.1:${address.port}/api`);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

const latest = storedDecision(decisionIds.latest, "2026-09-20T10:00:00.000Z");
const older = storedDecision(decisionIds.older, "2026-09-19T10:00:00.000Z");
const { database, getInsertCount } = fakeDatabase([
  [latest],
  [],
  [latest, older],
]);

await withServer(database, async (baseUrl) => {
  const detailResponse = await fetch(
    `${baseUrl}/decisions/${decisionIds.latest}`,
  );
  assert.equal(detailResponse.status, 200);
  assert.deepEqual(await detailResponse.json(), {
    decisionReference: decisionIds.latest,
    policyPack: snapshot.policyPack,
    input: snapshot.evaluation.input,
    output: snapshot.evaluation.output,
    rules: snapshot.evaluation.rules,
    evaluatorVersion: "1.0.0",
    evaluatedAt: "2026-09-20T10:00:00.000Z",
  });
  assert.equal(getInsertCount(), 0);

  const invalidResponse = await fetch(`${baseUrl}/decisions/bukan-uuid`);
  assert.equal(invalidResponse.status, 400);
  assert.deepEqual(await invalidResponse.json(), {
    error: "Decision reference tidak valid",
  });

  const missingResponse = await fetch(
    `${baseUrl}/decisions/${decisionIds.missing}`,
  );
  assert.equal(missingResponse.status, 404);
  assert.deepEqual(await missingResponse.json(), {
    error: "Decision reference tidak ditemukan",
  });

  const historyResponse = await fetch(
    `${baseUrl}/decisions?entityType=PROCUREMENT_PACKAGE&entityId=package-42`,
  );
  assert.equal(historyResponse.status, 200);
  const history = (await historyResponse.json()) as Array<{
    decisionReference: string;
  }>;
  assert.deepEqual(
    history.map((decision) => decision.decisionReference),
    [decisionIds.latest, decisionIds.older],
  );
  assert.equal(getInsertCount(), 0);
});

console.log("Decision route HTTP integration tests passed");