# Problem Explorer v0.6.0 — Target-first prototype

**Status: Local development candidate. Do not deploy to production yet.**

## Implemented
- After login, land on a target directory; original 498-problem Neo4j library is an optional read-only reference target.
- Personal targets: create, list, edit name/scope, toggle read-only sharing, delete with nested graph nodes.
- Target-specific interactive graph of streams, categories and problems.
- Stream: create, rename, delete; category: create/edit/delete; problem: create/edit/delete and inspect in target explorer.
- Existing target access is checked on backend; shared targets are read-only to visitors.
- Admin console already supports active/disabled users; now adds per-user daily AI request limits, stored in SQLite through additive schema migration. Disabling a user revokes sessions.
- Neo4j records from existing research are not seeded or rewritten.

## Known gaps / release blockers
- Frontend TypeScript + Vite build **not validated**: npm dependency installation timed out / missing type declarations in this environment.
- Live Neo4j and multiuser integration tests **not run**.
- Old v0.5 legacy research/discovery/search/solution endpoints are not universally target-scoped; the v0.6 target home deliberately does **not** expose those workflows. They need target-aware authorization and query scoping before release.
- AI stream seeding flow exists in legacy `/api/streams` and is not yet integrated in the new target create workflow.
- A target share toggle makes the graph publicly *discoverable to authenticated accounts*, not anonymous visitors.
- Deletion of a target/stream is irreversible without a Neo4j backup. Existing data outside the target remains unchanged.
- Test the count-ID allocator with your Neo4j data; legacy records may use different IDs.

## Local smoke test (after installing dependencies)
1. Back up Neo4j + SQLite, keep `AUTO_SEED=false`.
2. Extract over a **copy** of your v0.5 source, preserving `.env` and `apps/api/data/auth.sqlite3`.
3. In `apps/api`, install dependencies with `.venv` and restart API; in `apps/web`, run `npm ci && npm run build && npm run dev`.
4. Confirm first login shows target directory rather than default longevity graph.
5. Create Target A and Target B, create separate streams, categories and problems; verify their graphs are independent.
6. Log into a second account and check that Target A is hidden unless explicitly shared; shared targets cannot be modified.
7. Disable the second account in Admin and ensure sessions are rejected; set AI limit 0 then verify metered requests return HTTP 429.
8. Check original reference graph remains available and unchanged.

No production deployment or database migration is performed by this package.
