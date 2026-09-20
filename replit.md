# Procurement Compliance Platform

Platform pendamping kepatuhan pengadaan untuk Pemerintah dan kebijakan internal BUMN/BUMD, berbasis Perpres 46 Tahun 2025.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/procurement-compliance run dev` — run the web app through its managed workflow
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- API contract: `lib/api-spec/openapi.yaml`
- Procurement database schema: `lib/db/src/schema/procurement.ts`
- API routes: `artifacts/api-server/src/routes/procurement.ts`
- Web app: `artifacts/procurement-compliance/src`
- Theme tokens: `artifacts/procurement-compliance/src/index.css`

## Architecture decisions

- Government procurement uses Perpres 46/2025 as its baseline.
- BUMN/BUMD support is modeled as configurable internal policy packs, not as an automatic claim that every process is directly governed by the same Perpres.
- The product is a preparation, compliance, and audit companion; it does not replace SPSE.
- API contracts are defined OpenAPI-first and consumed through generated hooks and Zod schemas.

## Product

- Dashboard for package volume, budget, compliance, and method distribution
- Procurement package registry, creation, detail, stage, document, and status management
- Interactive e-purchasing review workpapers based on MCP-style controls
- Regulatory reference library and audit activity timeline

## User preferences

- Use Indonesian for product copy and collaboration.
- Prefer high-contrast dark/black and light-blue interfaces with bright, legible text.

## Gotchas

- Run API codegen after every OpenAPI change.
- Rebuild shared TypeScript libraries after changing the database schema before checking API server types.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
