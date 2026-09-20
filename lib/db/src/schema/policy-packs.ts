import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import {
  businessRulesTable,
  ruleConditionsTable,
} from "./business-rules";

export type PolicyRuleSnapshot = {
  rule: unknown;
  condition: unknown;
  source: unknown;
  provision: unknown;
  hash: string;
};

export const policyPacksTable = pgTable(
  "policy_packs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    packName: varchar("pack_name", { length: 255 }).notNull(),
    regimeType: varchar("regime_type", { length: 50 }).notNull(),
    description: text("description"),
    version: varchar("version", { length: 20 }).notNull(),
    status: varchar("status", { length: 20 }).notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedBy: text("published_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("policy_pack_regime_version_unique").on(
      table.packName,
      table.regimeType,
      table.version,
    ),
    index("policy_packs_regime_status_idx").on(
      table.regimeType,
      table.status,
    ),
  ],
);

export const policyPackRulesTable = pgTable(
  "policy_pack_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    policyPackId: uuid("policy_pack_id")
      .notNull()
      .references(() => policyPacksTable.id),
    businessRuleId: uuid("business_rule_id")
      .notNull()
      .references(() => businessRulesTable.id),
    ruleConditionId: uuid("rule_condition_id").references(
      () => ruleConditionsTable.id,
    ),
    isMandatory: boolean("is_mandatory").notNull().default(true),
    snapshot: jsonb("snapshot").$type<PolicyRuleSnapshot>(),
    snapshotTakenAt: timestamp("snapshot_taken_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("policy_pack_rule_unique").on(
      table.policyPackId,
      table.businessRuleId,
      table.ruleConditionId,
    ),
    index("policy_pack_rules_pack_idx").on(table.policyPackId),
  ],
);
