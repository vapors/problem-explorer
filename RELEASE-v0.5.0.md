# Problem Explorer v0.5.0 – development candidate (NOT production validated)

## Scope
- Dedicated administrator UI (shown only to `role=admin`) for account roles/status, AI request counts, and embedding jobs.
- User-owned research streams, category structure, and draft-problem taxonomies.
- AI taxonomy generator with three settings: outline (3/0), standard (5/3), detailed (7/6). Users review/edit before saving.
- Embedding work submitted to SQLite-persisted background queue and processed within FastAPI's lifespan. New manual problems queue individually; saved research taxonomy queues a workspace catch-up batch.
- Shared initial corpus is NOT silently bulk-indexed: an administrator can queue it from the console, or `AUTO_INDEX_SHARED=true` on start. API fees apply.
- AI usage accounting remains by request/batch; no billing, token tracking, or per-user pricing implemented.

## Important operational limitations
1. This uses an **in-process single worker** and assumes exactly ONE Uvicorn application worker per environment. For multiple instances/multi-server use, replace with a leased distributed queue (Redis/RQ, Celery, etc.). Job table survives process restarts; a running job is reclaimed after ten minutes.
2. User-quota-exceeded jobs defer until the next UTC day. Other failed jobs remain failed; administrative monitoring is required.
3. Embedding batch writes are non-transactional with the OpenAI API call; a restart between embedding and database write can repeat a charge.
4. The AI-generated taxonomy is an **unverified draft**. The interface does not establish clinical/social research evidence. Designated `ai_taxonomy_draft` and `needs_review` on Neo4j records.
5. Existing data migrations, account signup/Google SSO, backend jobs and React UI have NOT been end-to-end integration tested against your Neo4j database.
6. The existing discovery generator still expects the four original S1–S4 streams. Dynamic-stream AI discovery is a separate follow-up; manual problem entry and stream taxonomy generation support user streams in this release.
7. The shared reference corpus is still shown alongside the user's private streams (no full workspace selector or collaborative access control yet).

## Windows installation (local testing only)
- Back up `C:\Projects\problem-explorer` and Neo4j (a consistent database backup); make a copy of the existing SQLite authentication DB as well.
- Stop `start-dev.cmd` services before extraction.
- Extract the archive to the project root, preserving `.env`, existing Neo4j database storage and `data/auth.sqlite3`; do **not** run AUTO_SEED again.
- Set `AUTO_SEED=false`, `AUTH_DB_PATH` to your persistent auth SQLite location, and optionally `DAILY_AI_REQUEST_LIMIT=15`. Keep `AUTO_INDEX_SHARED=false` initially; queue shared backfill explicitly from admin after assessing cost.
- Install backend dependencies if needed and run `start-dev.cmd`.
- Log in as a user whose SQLite `users.role` is already `admin`. Use Administration button in upper account bar.
- Create a new stream, generate an outline preview, edit and save. Verify a second account cannot see that stream or its problems.
- Verify queue progress and `ai_usage` in admin console. Confirm manually created problems get embeddings after API stays running.
- Build frontend with `cd apps\\web && npm ci && npm run build` on your Windows Node setup; this step did not complete in the supplied build environment.

## Rollback
- Stop services, restore previous v0.4.1 app source, retain the Neo4j database and auth SQLite state. Newly added `Stream`, `Category`, `Problem`, and job records should be retained rather than deleted; old UI will not show all of them, so do not use rollback as a data migration.

## Known dev follow-ups before production
- Verify source compilation and APIs with a real Neo4j instance and two user sessions.
- Add CSRF protection / stricter Origin policy for HTTPS deployment and test SSO end-to-end.
- Add explicit worker cost budgets, request throttling, retries and server-side instrumentation.
- Make dynamic-stream discovery and problem search fully scoping-aware, and add cross-stream duplication options.
- Introduce paid plans/quotas only after a usage ledger and price estimates exist.
