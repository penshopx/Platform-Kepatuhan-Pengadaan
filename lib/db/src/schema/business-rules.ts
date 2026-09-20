import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import type { AstNode } from "../rules/ast/types";
import { legalSourcesTable, provisionsTable } from "./legal-sources";

export const businessRulesTable = pgTable(
  "business_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    provisionId: uuid("provision_id")
      .notNull()
      .references(() => provisionsTable.id),
    ruleKey: varchar("rule_key", { length: 100 }).notNull(),
    ruleCategory: varchar("rule_category", { length: 50 }).notNull(),
    defaultValue: jsonb("default_value").$type<unknown>(),
    valueType: varchar("value_type", { length: 20 }).notNull(),
    formulaAst: jsonb("formula_ast").$type<AstNode>(),
    allowedReferences: jsonb("allowed_references")
      .$type<string[]>()
      .notNull()
      .default([]),
    description: text("description"),
    version: integer("version").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    supersededBy: uuid("superseded_by"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("business_rules_key_version_unique").on(
      table.ruleKey,
      table.version,
    ),
    index("business_rules_active_idx").on(table.ruleKey, table.isActive),
  ],
);

export const ruleConditionsTable = pgTable(
  "rule_conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessRuleId: uuid("business_rule_id")
      .notNull()
      .references(() => businessRulesTable.id),
    entityType: varchar("entity_type", { length: 50 }),
    fundingSource: varchar("funding_source", { length: 50 }),
    procurementMethod: varchar("procurement_method", { length: 50 }),
    packageValueMin: numeric("package_value_min", {
      precision: 20,
      scale: 2,
      mode: "number",
    }),
    packageValueMax: numeric("package_value_max", {
      precision: 20,
      scale: 2,
      mode: "number",
    }),
    scopeType: varchar("scope_type", { length: 30 }),
    scopeId: text("scope_id"),
    effectiveDate: date("effective_date", { mode: "string" }).notNull(),
    expiryDate: date("expiry_date", { mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("rule_conditions_lookup_idx").on(
      table.businessRuleId,
      table.scopeType,
      table.scopeId,
    ),
  ],
);

export const ruleOverridesTable = pgTable(
  "rule_overrides",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    businessRuleId: uuid("business_rule_id")
      .notNull()
      .references(() => businessRulesTable.id),
    scopeType: varchar("scope_type", { length: 30 }).notNull(),
    scopeId: text("scope_id").notNull(),
    overrideValue: jsonb("override_value").$type<unknown>(),
    overrideFormulaAst: jsonb("override_formula_ast").$type<AstNode>(),
    effectiveDate: date("effective_date", { mode: "string" }).notNull(),
    expiryDate: date("expiry_date", { mode: "string" }),
    justificationProvisionId: uuid("justification_provision_id").references(
      () => provisionsTable.id,
    ),
    justificationSourceId: uuid("justification_source_id").references(
      () => legalSourcesTable.id,
    ),
    priority: integer("priority").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("rule_overrides_lookup_idx").on(
      table.businessRuleId,
      table.scopeType,
      table.scopeId,
      table.priority,
    ),
  ],
);
