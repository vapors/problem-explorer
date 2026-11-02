# Release process — one version variable

## 1. Update the version

Edit `deploy/release.env`:

```dotenv
RELEASE_VERSION=0.9.8
DEPLOY_USER=siteadmin
DEPLOY_DOMAIN=explorer.pixelandpiece.com
API_SERVICE=problem-explorer.service
```

Only the `RELEASE_VERSION` line normally changes. Scripts derive the live application, web, release, and backup paths from the configured deploy user and domain. For clarity, update `apps/web/package.json`'s `version` and the FastAPI metadata `version` in `apps/api/app/main.py` for each public release, but these are **display metadata**, not deployment inputs. If you change `package.json`, regenerate its lockfile via npm install and commit the matched pair. The PowerShell packager now automatically includes every root-level `RELEASE-v*.md` note.

## 2. Validate the local source

From Windows PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\test-local.ps1
```

## 3. Package the ZIP

Package the **contents of the project root**, not an extra enclosing folder. Archive root must contain `deploy/release.env`, `apps/web/package.json`, and `apps/api/requirements.txt`.

With PowerShell in the source root, the following produces an archive excluding known local secrets and generated data:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\package-release.ps1
```

Archive convention: `Problem-Explorer-vX.Y.Z[.W].zip`. The deploy script accepts any filename, but reads `RELEASE_VERSION` from inside the archive.

## 4. Upload and deploy

Upload the new ZIP to `/home/siteadmin/releases/` (never to `public_html`). Execute as root on the VPS:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.8-Graph-Intelligence.zip
```

The example version is illustrative. Use the exact generated file path. **No database reset or seeding is part of this release path.** The script refuses release builds that fail tests; it snapshots code/static frontend before changing the live app; and it prints the matching rollback directory.

## 5. Confirm and document

```bash
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
sudo systemctl status problem-explorer.service --no-pager
```

Then perform an authenticated browser smoke test including two-user isolation, shared read-only targets, research history, target explorer graph, and concept workflows. Record release number, snapshot directory, test results and time in a change log. A successful health endpoint alone does not prove user flows or data isolation.

### Existing release archives

The original downloadable v0.8.1 ZIP used a descriptive suffix. It can be deployed by passing that **actual** ZIP filename to `deploy.sh`. There is no need to rename it.

### Reference CSV packaging guard

Include the source fixture `data/problems.csv` in every full application release; the offline API-contract suite verifies its 498 rows and four research streams. This is a bundled fixture, **not** a request to seed or replace any existing Neo4j research records. `scripts/package-release.ps1` and the DirectAdmin deploy script check the fixture is present before packaging/deploying.
