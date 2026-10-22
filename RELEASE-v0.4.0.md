# Problem Explorer v0.4.0 — Account and Workspace Foundation

**Status:** Development/test release. Do **not** publish until the production checklist and a two-account isolation test pass. No production systems or databases were modified.

## Architecture
- React sign-in/registration screen; Google Identity Services button appears when `GOOGLE_CLIENT_ID` is configured.
- Local accounts with Argon2 password hashes, 14-day opaque HttpOnly session cookies; sign-out revokes the session.
- Google identity token verified server-side for configured audience; a Google login matching an existing password account does **not** automatically link it (users must not accidentally take over another account).
- SQLite authentication DB is separate from Neo4j; persists on disk. Suitable for initial single-server operations; PostgreSQL is appropriate when horizontally scaling or enabling billing. **Do not** use SQLite database files on a shared multi-server filesystem.
- New Neo4j Problem, Discovery, ResearchRun, Finding, ConceptBatch, ConceptDraft, Solution, Evaluation records have `ownerId`. Read paths restrict most user-owned records; original reference problems are shared. Search and vector search filter by ownership.
- FastAPI denies unauthenticated API calls except `/api/auth/*` and `/api/health`. Login is enforced on the server, not only React.
- Initial AI-backed request cap: 15 requests per user per UTC day, adjustable by `DAILY_AI_REQUEST_LIMIT`. This limits requests, **not tokens/dollars**. Calls can still be expensive.

## IMPORTANT: historical data
Legacy Neo4j records written before v0.4 lack `ownerId`. Existing manual/AI-added problems without ownerId will still be treated as public reference problems. Pre-existing discoveries, research, concepts and solutions without `ownerId` are intentionally excluded from personalized lists. **Do not delete, reset, or reseed** data. Before enabling external accounts, review and assign ownership to historical manually created problems, or explicitly mark them as public curated data. A safe migration must be based on audited IDs and consent; this release intentionally performs no irreversible migration.

## Local upgrade (Windows)
1. Back up `C:\Projects\problem-explorer` and the existing Neo4j database.
2. Extract the release into a staging directory and compare with the existing application before copying. Keep your existing `.env` and databases; never overwrite them with example files.
3. Update the Python venv: `cd C:\Projects\problem-explorer\apps\api` then `.venv\Scripts\python.exe -m pip install -r requirements.txt` (or use your actual venv Python path).
4. Update root `.env` with:
   ```
   AUTO_SEED=false
   AUTH_DB_PATH=C:/Projects/problem-explorer/data/auth.sqlite3
   AUTH_SECURE_COOKIE=false
   PUBLIC_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
   DAILY_AI_REQUEST_LIMIT=15
   GOOGLE_CLIENT_ID=
   ```
5. `cd C:\Projects\problem-explorer\apps\web` and `npm ci` then `npm run build`.
6. Launch through the existing `start-dev.cmd`. Open `http://localhost:5173`. Register two test accounts, confirm that user A's solution/research/discoveries are invisible to user B, and that an anonymous request to `/api/solutions` returns 401.
7. When testing Google sign-in, create a Google Cloud OAuth Client ID of type **Web application**, adding JavaScript origin `http://localhost:5173` for development, and `https://explorer.pixelandpiece.com` for production. Use the Client ID in `GOOGLE_CLIENT_ID` for the API. Never put a Google client secret in the frontend. Google login is disabled until configured.

## Production staging and security checklist
- Back up production Neo4j and `.env`, and ensure PostgreSQL/SQLite auth data uses durable backups. Example: `AUTH_DB_PATH=/home/siteadmin/private/problem-explorer/auth.sqlite3` (create an application-writable directory **outside public_html**).
- Use `AUTH_SECURE_COOKIE=true` under HTTPS. Set `PUBLIC_ORIGINS=https://explorer.pixelandpiece.com`; keep existing Nginx/Apache/DirectAdmin configuration intact.
- Run the updated API in a staging environment first; do not disable Nginx Basic Authentication until account protection and reverse proxy headers are tested. Basic Auth can remain an additional layer during testing.
- Configure request-rate limits at the Nginx edge for login, registration, and Google endpoints. Add account verification/email confirmation, password reset, anti-bot controls, abuse monitoring, audit logs, and per-feature/token-based OpenAI spending limits before opening broad public registration.
- Review source code, inherited data visibility, backup/restore, operational permissions, privacy policy and user deletion process before allowing external signups.
- Existing API `/api/health` remains public and should not expose secrets.

## Known limitations
- Email confirmation, password reset, account linking, team sharing, billing, and cost-based usage metering are not included.
- Legacy records require an explicit curation/ownership migration.
- Shared graph is not a collaboration layer. Personal findings and ideas do not automatically become shared.
- Python syntax and frontend TypeScript/Vite production build were checked. Full FastAPI integration against running Neo4j, real Google login, and multiuser tests were **not** run in this environment. Treat the package as a development candidate until these pass.

## Rollback
- Stop API, restore old source folder / v0.3.6 code and restart. Keep `.env`, Neo4j, and auth SQLite in place. No destructive schema migration runs at startup. For reverting the frontend, rebuild or restore the previous `dist` directory. Persisted user-owned records are not removed.
