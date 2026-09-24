import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { policyPacksTable } from "./policy-packs";

export const decisionReferencesTable = pgTable(
  "decision_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: text("entity_id").notNull(),
    policyPackId: uuid("policy_pack_id")
      .notNull()
      .references(() => policyPacksTable.id),
    policyPackVersion: varchar("policy_pack_version", {
      length: 20,
    }).notNull(),
    evaluationInput: jsonb("evaluation_input")
      .$type<Record<string, unknown>>()
      .notNull(),
    evaluationResult: jsonb("evaluation_result")
      .$type<Record<string, unknown>>()
      .notNull(),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    evaluatorVersion: varchar("evaluator_version", { length: 30 }).notNull(),
    evaluatedAt: timestamp("evaluated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    evaluatedBy: text("evaluated_by"),
    evaluatorName: text("evaluator_name"),
    actorType: varchar("actor_type", { length: 20 })
      .notNull()
      .default("SYSTEM"),
  },
  (table) => [
    index("decision_references_entity_idx").on(
      table.entityType,
      table.entityId,
    ),
    index("decision_references_pack_idx").on(
      table.policyPackId,
      table.evaluatedAt,
    ),
  ],
);
