# Problem Explorer v0.9.1 — Multi-agent evaluation and guided investigation

This is an **incremental, non-destructive upgrade** to the working v0.9.0 network workspace.

## What changed

### Guided New Target → Investigate → Open Graph

- The initial New Target screen asks for a target name and optional research focus. The **Advanced setup** link reveals the former research-detail selector (default **Outline / three streams**), shared status, editable AI-suggested streams, and manual stream names.
- Clicking **Create target and graph** suggests three streams when none are specified (counts toward AI allowance), then creates the target and streams using the existing **atomic** `/api/targets/with-streams` endpoint.
- The second **Investigate** overlay remains over the blurred network. It shows streams, multi-select taxonomy generation, configurable `outline` / `standard` / `detailed` draft depth, editable categories and problem hypotheses, and a per-stream saved indication. **Saving a taxonomy** calls the existing scoped `/seed-preview` + `/taxonomy` endpoints; generated problems remain `ai_taxonomy_draft` and `needs_review`.
- Manual stream and category creation remains behind Advanced setup. **Finish / Open graph** closes the wizard even when not every stream has been seeded. Existing Research Structure management continues to work.
- Because a target is saved before taxonomy drafting, exiting after stage one retains a valid target. To continue later, use the Research Structure window.

### Multi-agent evaluation

- `evaluation_orchestrator.py`: independent strictly validated Pydantic **quantitative** and **qualitative** outputs, with optional independent models (`OPENAI_QUANT_MODEL`, `OPENAI_NARRATIVE_MODEL`, both falling back to `OPENAI_STRUCTURED_MODEL`), with factor-specific rubrics for desirability, feasibility, viability, impact, and coverage. Reviewable conflicts, assumptions, evidence gaps, and follow-up questions are deterministically merged into the existing evaluation factor contract.
- `evaluation_jobs.py`: a distinct SQLite-backed queue (`evaluation_jobs` table in the **existing** `auth.sqlite3`) with checkpointed agent outputs, retries, identity+target-scoped status routes, API-call quota reservations **at each agent invocation**, and restart recovery. One API worker is required as before. Two agent calls normally consume two AI-request allowances; failures/retries can consume additional allowances. The queue action itself is free.
- Successful evaluations are saved in **Neo4j** as `Evaluation` nodes, keyed by job ID to avoid duplicate persistence after retries. No research findings, concepts, or Neo4j schema entities move to SQLite.
- Existing `/solutions/{sid}/evaluate` remains for backwards compatibility, while the new frontend uses the non-blocking `/solutions/{sid}/evaluations/queue` and a narrowly scoped job-status API.
- A read-only evaluation comparison endpoint normalizes historical **1–5 scores to 1–10 for display only**. Unknown scores remain `null` rather than `1` or zero. Saved original scores are not rewritten. The Concept Evaluation panel shows historical comparisons, job state, and reconciliation warnings.
- **Evidence mode only credits personally reviewed, scoped, source-linked findings.** An exploratory prediction with an unreviewed source is labeled inference. Models cannot promote unreviewed community sentiment to verified evidence. The separate optional social-discussion radar overlay from v0.9.0 remains opt-in and excluded from the evaluation agents' inputs.

### Optional, explicitly authorized feed discovery

- The additional `social_collection.py` adapter accepts **only** selected RSS/Atom HTTPS feeds that an administrator has already configured for the target/stream/problem **and** whose hostname is listed in the production environment variable `SOCIAL_FEED_ALLOWED_HOSTS`.
- **Default: disabled** (empty allowlist). Requires admin permission and an explicit authorization attestation each time. Redirects, proxies, HTTP, arbitrary HTML scraping, private-IP host resolution, and oversized feeds are rejected. The server contacts feeds **only on administrator action**, not during graph interaction.
- Candidate titles/excerpts are stored as separate `SocialSignalCandidate` nodes with source URL, feed, collection timestamp, and actor. They are **not scored, reviewed, counted in sentiment aggregates, or treated as research findings**. In the Signal Configuration window, an admin may select a candidate to prefill the existing manual observation form, inspect its original source, choose a sample/context/rating, and then explicitly submit/review it. RSS excerpts may contain personal information and must be handled according to the feed's terms and your retention/privacy policies.
- An allowlist is *not* permission to scrape or reuse content. Confirm authorization, privacy/retention, terms and API/feed permissions separately. Do not use this collector for Reddit unless approved access specifically permits that feed.

## New endpoints (all target-scoped)

- `POST /api/targets/{tid}/solutions/{sid}/evaluations/queue` -> `202 {jobId,state}`
- `GET /api/targets/{tid}/evaluations/jobs/{jid}` -> owner-scoped progress/result metadata
- `GET /api/targets/{tid}/solutions/{sid}/evaluations/jobs` -> previous jobs
- `GET /api/targets/{tid}/solutions/{sid}/evaluations/compare` -> saved evaluation snapshots
- `POST /api/targets/{tid}/signals/nodes/{kind}/{node_id}/collect` -> admin and source-authorized feed candidates
- `GET /api/targets/{tid}/signals/nodes/{kind}/{node_id}/candidates` -> admin-only candidates

## Deployment, data and safety

Use the unchanged root-safe `deploy/directadmin/deploy.sh` from the **live application**, pointing at `Problem-Explorer-v0.9.1-Multi-Agent-Investigate.zip` in `/home/siteadmin/releases/`. The script installs no system Python packages and preserves the live `.env`, `.venv`, SQLite data, native Neo4j database, DirectAdmin proxy and `public_html/.htaccess`.

The new SQLite `evaluation_jobs` table is created **additively** on API startup; no reset, reseed or destructive migration is needed. Back up SQLite using its online backup interface and Neo4j independently **before upgrading**. Code-only rollback does not remove the new table, nor reverse saved evaluation changes. It is safe for the old application to ignore the unused new SQLite table.

Optional production `.env` setting (only if you have reviewed source terms and authorized access):

```dotenv
# Leave unset/empty to disable external feed collection entirely
SOCIAL_FEED_ALLOWED_HOSTS=feeds.example.org
```

Only explicitly matched hostnames are accepted; use a comma-separated list for additional approved feeds. Do **not** copy the example into production as a permission grant. The default remains off.

### Smoke test

1. Run deployment script; confirm the frontend build and offline tests pass **as siteadmin** and the FastAPI health endpoint responds.
2. Sign in as a test account; create a target. Check that Outline defaults to three streams (you may need AI allowance). Review, save draft taxonomies for some streams, open graph, confirm their hierarchy. Test manual creation without an AI call.
3. Create/match a concept; submit a multi-agent evaluation. Check it returns `202` immediately and the graph stays responsive. Watch progress and final saved result. Two AI requests are expected; with insufficient quota, job defers until the next UTC day.
4. Check evidence-only mode keeps unrated factors `null` when reviewed citations are absent, exploratory mode labels estimates, and no social-score values are inserted into empirical factors.
5. Compare multiple historical evaluations; inspect old 1–5 snapshots and sparse radar ratings.
6. Verify user B cannot read user A's jobs, comparisons or private Target; shared Target is read-only.
7. Optionally configure **approved** RSS feed on a test Target and add its host to `.env`; explicitly collect, inspect unscored candidates, and manually review before any social display. Do not run unauthorized scrapers.
8. Confirm reference library, existing findings, admin controls, existing graph camera, and Google authentication still work. Never run `bootstrap --reset-all` for an upgrade.

## Verification performed at packaging

- 41 offline Python contract tests passed, including new queue persistence/tenant checks, provenance reconciliation, feed allowlist/security boundaries and legacy tests.
- Python module compilation and Bash syntax checks passed.
- TypeScript/TSX **syntax transpilation** passed with TypeScript; full `npm run build`, live Neo4j operations, browser tests and external AI-provider execution were **not available in the packaging environment**. The DirectAdmin deployment script runs the full build and tests before publishing; verify with an actual test account before considering the release fully proven.

## Operational constraints and future work

- Job execution is durable but runs in an in-process background thread for the existing **one-worker** FastAPI deployment. Distributed processing requires a separate task worker/queue lease architecture. A killed process may repeat an in-flight agent API request before its checkpoint commits. Quotas are charged at stage invocation, not queue submission.
- RSS/Atom collection is opt-in discovery, not automated social sentiment scoring, general website scraping, or robust licensed API integration. Add provider-specific adapters only when terms and permissions are explicit.
- Source reconciliation checks existing curated claims/URLs/permissions. It is not a substitute for human scientific review or testing. The research-first, hypothesis-labeled lifecycle remains unchanged.
