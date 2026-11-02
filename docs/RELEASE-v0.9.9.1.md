# Problem Explorer v0.9.9.1 — Overview, Navigation & Badge Optical Alignment

Maintenance release built from v0.9.9. Full application, tests, deployment scripts and 498-row reference CSV are included. No backend schema or stored research migration.

## UI changes

1. **Target Overview starts taller:** On a typical desktop it uses nearly all available viewport height (`window.innerHeight - 100`), capped by the window boundary. It remains resizable and scrollable when content cannot physically fit. Default width is 420px.
2. **Consistent interactive Overview metrics:** Every metric card has the same surface, typography, padding, keyboard focus and hover states. Hierarchy totals route to Research Structure (streams/categories), Problem Library (Problems), Concept Studio (saved concepts), and Rejected Concepts. Findings link to Research & Findings or recovery.
3. **Navigation order:** Under Workspace, Create new {target}, Shared {target} directory, {Target} overview, and {Target} explorer appear in that order. Remaining workspaces follow. Explore Graph and the standalone Generate Concepts link were removed from *navigation only*. Contextual generation from a Problem and the collapsed Concept Studio AI generator remain available. Lens-specific labels use the central terminology dictionary (`app.createNewTarget` added as a presentation token only).
4. **Badge alignment:** A minor 4-screen-pixel right / 4-screen-pixel up correction (adjusted for chart zoom) occurs after transforming the rendered amCharts node circle into badge overlay coordinates, without changing hierarchy positions or saved zoom. This is an optical adjustment based on the screenshots, not a replacement of underlying center/radius physics. Verify at a range of scales and active simulations.
5. **Version:** Maintains release format four-part `0.9.9.1`, which the established deploy and packaging scripts support.

## Live acceptance checklist

- Open at desktop 1440×900 and 1366×768: Target Overview should fill most available vertical space, preserve resizing, and scroll only as necessary.
- Verify each Overview count is a consistent interactive card. Click Streams and Categories → Research Structure; Problems → Problem Library; Saved Concepts → Concept Studio; Rejected Concepts → recovery; Findings → Research Studio/recovery.
- Switch among Classic, General Challenge, Engineering and Human-Centered Design lenses: navigation labels should resolve in each without changes to Neo4j.
- Confirm navigation order; Explore Graph and Generate Concepts absent **only from menu**. From a Problem, use Generate Concepts; in Concept Studio expand the AI disclosure.
- Zoom in/out and drag/expand during graph simulation with concept and hierarchy badges visible. Look for remaining offsets. Check concept badge click and tooltip isolation; save/open graph views and verify no root restart.
- Verify frontend typecheck/build succeeds *before* production switch and that server /api/health passes afterward.

## Checks and limitations

Backend offline tests (93) and frontend source contract scripts, including `npm run test:ux-v0991`, are required. Full npm/Vite bundle and live amCharts interactions must pass in the deployment environment. Deployment must preserve existing `.env`, Neo4j and SQLite stores; do not run bootstrap/seed/reset on an upgrade. New code never changes graph database schema or social/evaluation semantics.

## Deploy

Upload `Problem-Explorer-v0.9.9.1-Overview-Navigation-Badges.zip` to `/home/siteadmin/releases/`.

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
 /home/siteadmin/releases/Problem-Explorer-v0.9.9.1-Overview-Navigation-Badges.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

To roll back in case of health failure, follow `docs/RECOVERY-AND-DATA.md`. Application code rollback and independent data backup are separate operations.
