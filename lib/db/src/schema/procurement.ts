import {
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const procurementPackagesTable = pgTable("procurement_packages", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  title: text("title").notNull(),
  agency: text("agency").notNull(),
  method: text("method").notNull(),
  status: text("status").notNull().default("Persiapan"),
  budget: doublePrecision("budget").notNull(),
  pdnTarget: doublePrecision("pdn_target").notNull().default(40),
  compliance: doublePrecision("compliance").notNull().default(0),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  owner: text("owner").notNull(),
  description: text("description").notNull().default(""),
  steps: jsonb("steps").notNull().default([]),
  documents: jsonb("documents").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const regulationsTable = pgTable("regulations", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(),
  status: text("status").notNull(),
  summary: text("summary").notNull(),
  updatedAt: date("updated_at", { mode: "string" }).notNull(),
});

export const epurchasingReviewsTable = pgTable("epurchasing_reviews", {
  id: serial("id").primaryKey(),
  packageCode: text("package_code").notNull(),
  packageTitle: text("package_title").notNull(),
  status: text("status").notNull(),
  items: jsonb("items").notNull().default([]),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const activitiesTable = pgTable("procurement_activities", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  target: text("target").notNull(),
  tone: text("tone").notNull(),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type PackageStep = {
  label: string;
  status: string;
  date: string | null;
};

export type PackageDocument = {
  name: string;
  type: string;
  status: string;
};

export type ReviewItem = {
  id: number;
  label: string;
  group: string;
  completed: boolean;
};

export type ProcurementPackage = typeof procurementPackagesTable.$inferSelect;
export type Regulation = typeof regulationsTable.$inferSelect;
export type EpurchasingReview = typeof epurchasingReviewsTable.$inferSelect;
export type Activity = typeof activitiesTable.$inferSelect;