import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const legalSourcesTable = pgTable(
  "legal_sources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    regulationCode: varchar("regulation_code", { length: 100 }).notNull(),
    regulationType: varchar("regulation_type", { length: 50 }).notNull(),
    number: varchar("number", { length: 100 }).notNull(),
    year: integer("year").notNull(),
    title: text("title").notNull(),
    issuingAuthority: varchar("issuing_authority", { length: 255 }).notNull(),
    authorityLevel: integer("authority_level").notNull(),
    effectiveDate: date("effective_date", { mode: "string" }),
    expiryDate: date("expiry_date", { mode: "string" }),
    isBinding: boolean("is_binding").notNull().default(true),
    parentSourceId: uuid("parent_source_id"),
    status: varchar("status", { length: 20 }).notNull().default("ACTIVE"),
    verificationStatus: varchar("verification_status", { length: 20 })
      .notNull()
      .default("UNVERIFIED"),
    verifiedBy: text("verified_by"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    unique("legal_sources_regulation_code_unique").on(table.regulationCode),
    index("legal_sources_status_idx").on(
      table.status,
      table.verificationStatus,
    ),
  ],
);

export const provisionsTable = pgTable(
  "provisions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    legalSourceId: uuid("legal_source_id")
      .notNull()
      .references(() => legalSourcesTable.id),
    articleNumber: varchar("article_number", { length: 50 }).notNull(),
    clauseType: varchar("clause_type", { length: 50 }),
    provisionType: varchar("provision_type", { length: 50 }).notNull(),
    rawText: text("raw_text").notNull(),
    interpretationNote: text("interpretation_note"),
    sourceCategory: varchar("source_category", { length: 50 })
      .notNull()
      .default("REGULATION"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    index("provisions_source_idx").on(table.legalSourceId),
    unique("provisions_source_article_clause_unique").on(
      table.legalSourceId,
      table.articleNumber,
      table.clauseType,
    ),
  ],
);
