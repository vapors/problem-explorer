<<<<<<< HEAD
> Latest release: **v0.9.9 — Research, Concept Studio & Evaluation UX**. See [release notes](docs/RELEASE-v0.9.9.md).

**Current version: v0.9.8.2 — Badge Geometry & Hover Controls.** See [`docs/RELEASE-v0.9.8.2.md`](docs/RELEASE-v0.9.8.2.md) for changes and deployment.

# Problem Explorer v0.9.8.2 — Badge Geometry & Hover Controls

A target-scoped evidence-led research and concept-development workspace. React/TypeScript + amCharts 5 full-screen network and react-rnd floating windows; FastAPI API; Neo4j ontology/research and separately attributed social observations; SQLite authentication/Google SSO, quotas and indexing job state.

## Start / deploy

- Windows development: [docs/LOCAL-WINDOWS.md](docs/LOCAL-WINDOWS.md) (Python 3.12 at `apps/api/.venv`, start with `start-dev.cmd`). Install JavaScript dependencies in `apps/web` with npm, no CDN.
- Native DirectAdmin production: [docs/DIRECTADMIN.md](docs/DIRECTADMIN.md). Root runs the reusable deploy command with the **v0.9.8.2 ZIP**, while npm/Python checks run as `siteadmin` and copied files get `siteadmin` ownership.
- Release guidelines: [docs/RELEASE-PROCESS.md](docs/RELEASE-PROCESS.md). Recovery and persistence: [docs/RECOVERY-AND-DATA.md](docs/RECOVERY-AND-DATA.md).
- This release's guided onboarding, stream review and testing: [docs/RELEASE-v0.9.6.md](docs/RELEASE-v0.9.6.md).
- Multi-agent evaluation queues, historical comparisons and the four-step New Target wizard are documented in the release notes.

## Deploy command (existing native VPS)

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.8.2-Badge-Geometry-Hover.zip
```

Upload the new ZIP into `/home/siteadmin/releases/` first; the name above is the expected packaged artifact. Never run `bootstrap --reset-all` for upgrades or copy local `.env` or SQLite into production. The deployer builds the frontend as `siteadmin`, preserves `.env`, SQLite, `.venv`, Neo4j and DirectAdmin settings, and creates a rollback of **code and frontend only**.

## Integrity and readiness

A social discussion observation is **not** an empirical finding and does not influence evidence-mode concept evaluation. Social sentiment is off by default, only administrator-reviewed sourced observations count, and overrides are clearly labeled. On the 1–10 scale, `1` means genuinely low; missing data remains `null`.

Run `PYTHONPATH=apps/api python -m unittest discover -s tests -v` for offline contract checks. The npm registry is unreachable in the build environment used to prepare this archive, so a full Vite/TS build and live Neo4j/browser tests remain deployment gates.


## Presentation lens framework (v0.9.2)

Select a lens when creating a workspace or from the toolbar at any point during research. Classic is the safe default. General Challenge, Technical & Engineering, and Human-Centered Design lenses adjust user-facing vocabulary only. They do not alter Neo4j labels, FastAPI route/query/payload keys, recorded findings, ratings or verification status. User lens choice is stored in local browser preferences keyed by account. To extend presentation vocabulary, see [docs/RELEASE-v0.9.2.md](docs/RELEASE-v0.9.2.md).

Run `npm run test:lenses` inside `apps/web` after dependency installation; the release deployer also runs this gate before building.

## Graph continuity and appearance (v0.9.3)

- Per-account, per-Target saved branch expansion and camera state in the existing auth SQLite; independent of Neo4j graph ontology. A Reset View control is available. Shared target viewers retain separate personal views.
- Concepts that originate from a Problem are shown as **presentation-only children** of that Problem; the canonical Neo4j relationship is still `INSPIRED_BY`. Unlinked manual Concepts continue to live in the Concept Studio.
- Saving a concept updates the current amCharts ForceDirected series via `addChildData`, without bumping the structural refresh key. Deeper research edits still refresh when needed.
- Admin-controlled per-theme node-level color palettes are stored in SQLite; graph circles are repainted without disposing the root. Social signals remain separate.
- For new graph routes and live acceptance cases, see [docs/RELEASE-v0.9.3.md](docs/RELEASE-v0.9.3.md). No destructive database changes or reseeding are required.

The evaluation-match highlight overlay is **not part of this release**; existing matching percentage semantics remain intact for a later UI layer.

## v0.9.5 — Target Publication & Lens Defaults

Administrators can hide/unshare the protected reference library, set a general featured shared Target, and configure one recommended shared Target per terminology lens without editing research records. See [`docs/RELEASE-v0.9.5.md`](docs/RELEASE-v0.9.5.md).

## v0.9.8.1 — Perimeter Badges & States

- Badges render on a separate transparent interaction layer, independent of parent ForceDirected nodes, to avoid parent tooltip and click interception.
- Positions dynamically follow child connecting directions on each physics frame; collapsed nodes use the last known child bearing or direction away from their parent. Badges remain on the bubble perimeter and rearrange around a short arc.
- Graph Appearance adds per-badge type **Open/Closed** colors and visibility, shared badge hover color and **Show badge tooltips**. Open summary badges default to hidden, closed summary badges default to visible. The Problem concept toggle remains faintly clickable even when its expanded count is configured as hidden.
- No new research metadata, database migration, or chart-root lifecycle changes. See [docs/RELEASE-v0.9.8.1.md](docs/RELEASE-v0.9.8.1.md).

## v0.9.8 — Research Graph Intelligence & Studio Context

- Context-sensitive Problem workflows versus searchable target-wide studios from Navigation, with terminology-lens fallback for new labels.
- Reversible active/rejected concept lifecycle. Rejected concepts remain in Neo4j but are omitted from active views, with a recovery window.
- Four administrator-configurable hierarchy badge types and authorized count aggregation; existing chart root and saved view persist through ordinary research edits.
- Full procedures and browser smoke tests: [docs/RELEASE-v0.9.8.md](docs/RELEASE-v0.9.8.md).

## v0.9.7 — Workspace & Research UX

- Lens-specific primary onboarding prompts; Skip vs Save & Continue during collapsed taxonomy review.
- First-launch Navigation left/full-height, Target Overview right with live finding metrics, Target Explorer closed and branches collapsed.
- Rejected findings retained with a paginated restoration window; owner/Target-scoped summary counts update after review.
- Generate Concepts has a separate floating workflow; Problem Details now link there and enumerate explicitly originating saved concepts.
- Historical v0.9.7 functionality: see [docs/RELEASE-v0.9.7.md](docs/RELEASE-v0.9.7.md).

## v0.9.6 — Guided Onboarding & Map Review

- Step 1: icon-card terminology lens selection with independent accessible information hints; target name is shown after selection.
- Step 2: research focus and audience, with advanced controls for sharing, stream counts and manual suggestions.
- Step 3: select streams and map depth; **Continue** generates editable draft taxonomy previews without auto-saving them. Manual stream/category additions and AI-free opening remain available under Advanced setup.
- Step 4: review **one stream at a time**, with all category editors collapsed by default; **Next** saves the reviewed stream once, and **Finish · Open graph** completes the last one. Completed streams are locked in the wizard because the existing Neo4j taxonomy endpoint is additive; later edits use Research Structure.
- No backend ontology, quotas, research integrity or graph lifecycle changes. See [docs/RELEASE-v0.9.6.md](docs/RELEASE-v0.9.6.md).

## v0.9.8.2 — Badge hover, geometry and tooltip corrections

Each badge type now has its own hover color per light/dark theme. Ancestor concept badges show informative summaries, not Expand/Collapse commands. Disabled badges do not appear at the overlay origin, and perimeter arcs use only visible badges. See [release notes](docs/RELEASE-v0.9.8.2.md).

### v0.9.9.1 maintenance release
See `docs/RELEASE-v0.9.9.1.md` for navigation/overview changes, graph badge optical alignment, validations and deployment steps. The research schema and terminology meanings are unchanged.
=======
# Problem Explorer v0.8.1 — Immersive Network Workspace

Problem Explorer is a target-scoped, evidence-led research and solution-design environment built with React/TypeScript, amCharts 5, FastAPI, Neo4j Community and SQLite.

The app uses a full-viewport network with independently draggable/resizable/collapsible panels, including the Target Explorer. Graph labels can display up to three lines; visual display labels remove seed catalog prefixes without altering Neo4j content. Research, concepts, matching, discovery and evaluation remain scoped to the active target and current signed-in account.

## Installation and release operations — start here

**[`docs/README.md`](docs/README.md)** is the maintained documentation index.

- Local Windows development: [`docs/LOCAL-WINDOWS.md`](docs/LOCAL-WINDOWS.md)
- Native Ubuntu 24.04 / DirectAdmin production upgrades: [`docs/DIRECTADMIN.md`](docs/DIRECTADMIN.md)
- Versioned packaging and updates: [`docs/RELEASE-PROCESS.md`](docs/RELEASE-PROCESS.md)
- Recovery and data backup: [`docs/RECOVERY-AND-DATA.md`](docs/RECOVERY-AND-DATA.md)

Change `RELEASE_VERSION` in **`deploy/release.env`** when preparing the next release. Deployment scripts do not need editing for new versions.

### One-time local setup (Windows)

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
```

Then configure the **local** `.env` and run `start-dev.cmd`. Use Python 3.12, local npm packages (`@amcharts/amcharts5`, `react-rnd`) and a local Neo4j instance.

### Existing DirectAdmin VPS upgrade (root may invoke; app runs as siteadmin)

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.8.2.zip
```

Only use the command once this release's deployment helper has been installed; first-time helper setup is in `docs/DIRECTADMIN.md`. Substitute the uploaded ZIP's actual filename. The deployer performs a build, offline tests, source/asset backup, permissions normalization, rollout and health checks. It **never** resets SQLite or Neo4j, replaces `.env`, changes DirectAdmin proxy templates, or runs system-wide pip.

### Database boundaries

- **SQLite** stores users, Google SSO identities, quota usage and indexing jobs in the current configured `AUTH_DB_PATH` (normally `apps/api/data/auth.sqlite3`).
- **Neo4j Community** stores targets, streams, categories, problems, findings, sources, concept drafts and associations. Sharing and private target permissions are enforced in API routes.

**No migration, reseeding, or destructive bootstrap is part of a normal upgrade.** Do not use the historical `--reset-all` procedure to fix deployment errors.

### Verification

The release has offline contract tests under `tests/`. Frontend build (`npm run build`), live Neo4j behavior, Google SSO and two-user isolation require checks in the actual target environment. See the v0.8.1 release notes for UI implementation details.
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8
