# DirectAdmin deployment — canonical instructions moved

**Use [`../../docs/DIRECTADMIN.md`](../../docs/DIRECTADMIN.md) for all production upgrades.**

This file previously contained a **destructive v0.7.0 initial-reset procedure**. It is intentionally replaced to prevent accidental user/research data loss during routine upgrades. The existing VPS needs only a code/static-asset release update; do **not** run `app.bootstrap --reset-all` as part of deployment.

- `preflight.sh` — confirm runtime and permissions before deploying.
- `deploy.sh ZIP_OR_EXTRACTED_DIRECTORY` — stage, build, test, back up code, deploy under siteadmin ownership.
- `healthcheck.sh` — check the local/public API and homepage.
- `rollback.sh SNAPSHOT_DIRECTORY` — restore previous code/static assets only.
- `common.sh` — shared settings and safety checks.

All version-specific release paths are derived from `deploy/release.env` and the uploaded release's filename. See also [`../../docs/RECOVERY-AND-DATA.md`](../../docs/RECOVERY-AND-DATA.md).
