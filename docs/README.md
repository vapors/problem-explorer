<<<<<<< HEAD
- [v0.9.9 — Research, Concept Studio & Evaluation UX](RELEASE-v0.9.9.md)
**Latest maintenance release: [v0.9.8.1 Perimeter Badge Refinements](RELEASE-v0.9.8.1.md).**

- [v0.9.8 Research Graph Intelligence & Studio Context](RELEASE-v0.9.8.md) — four aggregated graph badges, reversible concept rejection, focused/global studios, admin visibility.
- [v0.9.7 Workspace & Research UX](RELEASE-v0.9.7.md) — startup windows, live findings/rejection recovery, separated concept generator, onboarding polish.
- [v0.9.6 Guided Onboarding & Map Review](RELEASE-v0.9.6.md) — icon lens selection, four-step flow, collapsed stream taxonomy review, save-once progression.
- [v0.9.5 Target Publication & Lens Defaults](RELEASE-v0.9.5.md) — independent public access, directory listing, protection and per-lens featured defaults.
- [v0.9.4.1 badge/tooltip refinement](RELEASE-v0.9.4.1.md) — current patch release; backward-compatible palette additions.
=======
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8
# Problem Explorer — installation & operations

**Canonical procedures for all v0.8.1+ releases.** Do not use a past version's reset/reseed instructions for a normal upgrade. Early Docker procedures do not apply; this product uses **SQLite for accounts, quota, and job state** and **Neo4j Community for the research graph**.

| What you are doing | Canonical guide |
|---|---|
| Fresh local Windows development environment | [LOCAL-WINDOWS.md](LOCAL-WINDOWS.md) |
| Upgrade existing native DirectAdmin production deployment | [DIRECTADMIN.md](DIRECTADMIN.md) |
| Manage version numbers and produce the next ZIP | [RELEASE-PROCESS.md](RELEASE-PROCESS.md) |
| Recover from a failed code deployment, preserve data | [RECOVERY-AND-DATA.md](RECOVERY-AND-DATA.md) |
<<<<<<< HEAD
| Architecture roadmap (v0.9.x and beyond) | [ROADMAP.md](ROADMAP.md) |

## One release version, one place

Edit **`deploy/release.env`** to set `RELEASE_VERSION=X.Y.Z (or X.Y.Z.W for maintenance releases)` in the source tree before packaging. No version-specific paths are embedded in deployment scripts; they read the release config. `apps/web/package.json` and `apps/api/app/main.py` contain informational application version strings that you may update for visible version reporting, but they do **not** control the deployment path or require editing for scripts to work.
=======

## One release version, one place

Edit **`deploy/release.env`** to set `RELEASE_VERSION=X.Y.Z` in the source tree before packaging. No version-specific paths are embedded in deployment scripts; they read the release config. `apps/web/package.json` and `apps/api/app/main.py` contain informational application version strings that you may update for visible version reporting, but they do **not** control the deployment path or require editing for scripts to work.
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8

Production update command after the first installation of this tooling:

```bash
sudo bash /home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer/deploy/directadmin/deploy.sh \
<<<<<<< HEAD
  /home/siteadmin/releases/Problem-Explorer-vX.Y.Z[.W].zip
=======
  /home/siteadmin/releases/Problem-Explorer-vX.Y.Z.zip
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8
```

The ZIP may have a descriptive suffix; supply its full actual filename. Deployment uses the **version inside the ZIP**, not its filename.

## Scope

- These tools upgrade an **already installed** FastAPI/Uvicorn/Neo4j/DirectAdmin site with a working reverse proxy.
- They do not install DirectAdmin, Neo4j, Python, Node, systemd units or certificate renewals.
- They do not use Docker, reset users, seed research, run schema migrations or edit the webserver proxy.
- `deploy/directadmin/deploy.sh` and `rollback.sh` require root for copying and service control, but **npm, Python tests and application pip run as `siteadmin`**.
- The service must already be configured as user `siteadmin` with working directory `.../problem-explorer/apps/api` and the preexisting Python **3.12** virtual environment.
- Deployment snapshots cover **application source and published frontend** only; back up SQLite and Neo4j independently as described in recovery documentation.
<<<<<<< HEAD

- [v0.9.0 social signals and sparse radar](RELEASE-v0.9.0.md) — source URLs, inheritance, override auditing, deployment checks.

- [v0.9.1 multi-agent evaluation, guided investigation, optional approved feed collection](RELEASE-v0.9.1.md) — deployment checklist, integrity contracts and new job endpoints.

- [v0.9.2 runtime research lenses](RELEASE-v0.9.2.md) — canonical data isolation, onboarding, lens compatibility and graph stability tests.

- [v0.9.3 graph continuity and appearance](RELEASE-v0.9.3.md) — persistent views, concept-node attachments, admin colors and tests.

- [v0.9.4 concept badge controls and workspace modal](RELEASE-v0.9.4.md) — independent per-Problem concept counts, expansion, navigation and deployment checks.

- [v0.9.8.2 Badge Geometry & Hover Controls](RELEASE-v0.9.8.2.md)

- **v0.9.9.1 (maintenance):** `RELEASE-v0.9.9.1.md` — taller Overview, consistent clickable metrics, streamlined navigation and optical badge adjustment.
=======
>>>>>>> 6c0aac51258ec106193708714498633b89a454c8
