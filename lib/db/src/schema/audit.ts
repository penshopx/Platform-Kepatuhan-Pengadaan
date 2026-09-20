import {
  bigserial,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { decisionReferencesTable } from "./decisions";

export const auditLogsTable = pgTable(
  "audit_logs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    timestamp: timestamp("timestamp", { withTimezone: true })
      .notNull()
      .defaultNow(),
    actorId: text("actor_id"),
    actorType: varchar("actor_type", { length: 20 })
      .notNull()
      .default("SYSTEM"),
    actorRole: varchar("actor_role", { length: 50 })
      .notNull()
      .default("SYSTEM"),
    actionType: varchar("action_type", { length: 20 }).notNull(),
    entityType: varchar("entity_type", { length: 100 }).notNull(),
    entityId: text("entity_id").notNull(),
    previousState: jsonb("previous_state").$type<unknown>(),
    newState: jsonb("new_state").$type<unknown>(),
    ipAddress: varchar("ip_address", { length: 45 }),
    reason: text("reason"),
    decisionReferenceId: uuid("decision_reference_id").references(
      () => decisionReferencesTable.id,
    ),
  },
  (table) => [
    index("audit_logs_entity_idx").on(table.entityType, table.entityId),
    index("audit_logs_timestamp_idx").on(table.timestamp),
  ],
);
