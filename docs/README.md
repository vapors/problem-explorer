# Problem Explorer — installation & operations

**Canonical procedures for all v0.8.1+ releases.** Do not use a past version's reset/reseed instructions for a normal upgrade. Early Docker procedures do not apply; this product uses **SQLite for accounts, quota, and job state** and **Neo4j Community for the research graph**.

| What you are doing | Canonical guide |
|---|---|
| Fresh local Windows development environment | [LOCAL-WINDOWS.md](LOCAL-WINDOWS.md) |
| Upgrade existing native DirectAdmin production deployment | [DIRECTADMIN.md](DIRECTADMIN.md) |
| Manage version numbers and produce the next ZIP | [RELEASE-PROCESS.md](RELEASE-PROCESS.md) |
| Recover from a failed code deployment, preserve data | [RECOVERY-AND-DATA.md](RECOVERY-AND-DATA.md) |

## One release version, one place

Edit **`deploy/release.env`** to set `RELEASE_VERSION=X.Y.Z` in the source tree before packaging. No version-specific paths are embedded in deployment scripts; they read the release config. `apps/web/package.json` and `apps/api/app/main.py` contain informational application version strings that you may update for visible version reporting, but they do **not** control the deployment path or require editing for scripts to work.

Production update command after the first installation of this tooling:

```bash
sudo bash /home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer/deploy/directadmin/deploy.sh \
  /home/siteadmin/releases/Problem-Explorer-vX.Y.Z.zip
```

The ZIP may have a descriptive suffix; supply its full actual filename. Deployment uses the **version inside the ZIP**, not its filename.

## Scope

- These tools upgrade an **already installed** FastAPI/Uvicorn/Neo4j/DirectAdmin site with a working reverse proxy.
- They do not install DirectAdmin, Neo4j, Python, Node, systemd units or certificate renewals.
- They do not use Docker, reset users, seed research, run schema migrations or edit the webserver proxy.
- `deploy/directadmin/deploy.sh` and `rollback.sh` require root for copying and service control, but **npm, Python tests and application pip run as `siteadmin`**.
- The service must already be configured as user `siteadmin` with working directory `.../problem-explorer/apps/api` and the preexisting Python **3.12** virtual environment.
- Deployment snapshots cover **application source and published frontend** only; back up SQLite and Neo4j independently as described in recovery documentation.
