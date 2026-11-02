# Problem Explorer v0.9.7 — Workspace & Research UX

## Scope

A targeted upgrade on top of v0.9.6, intended to reduce interface clutter and correctly synchronize findings status. **v0.9.8 is reserved for the graph's aggregated research/concept badges**; this release does not modify the graph's counting or appearance protocols.

### New onboarding details

- Step 1 uses the active `wizard.namePrompt` from the terminology registry as the **primary heading**, rather than the fixed `wizard.genericPrompt`. Every included lens provides its own copy; Classic remains the fallback.
- Step 4 presents `Skip` before `Save & Continue` (`Save & Open Graph` on the final stream). **Skip does not post taxonomy**, even if AI previews were generated. The stream itself already exists because Step 2 created it; it remains empty until its taxonomy is saved later through Research Structure.
- `Save & Continue` persists a reviewed stream once using the existing *additive* `/taxonomy` route. The save-once guard remains. Completed/skipped stream indicators are distinct. Review-category editors remain collapsed initially.
- Earlier wizard stages still support Back where useful; the stream-by-stream review does not add a Back button. A completed or skipped substep can be selected via its progress control.

### Desktop startup view

- Navigation opens at the upper left at nearly full viewport height.
- The active-lens Target Overview opens upper right, including saved findings.
- Target Explorer is initially **closed**. When opened, its research-stream branches start collapsed, including after asynchronous data loading. Expand, Collapse and search still work.
- Selecting a Target during initial load no longer inadvertently opens Target Explorer. Existing graph contents, lens settings and graph view persistence are unchanged.
- Restoring window layout from the toolbar uses the new defaults. Responsive browser testing is essential before releasing to users.

### Research counts and rejected findings

- The **same owner-scoped** `/research/activity` response now exposes `runCount`, `findingCount` (total), `reviewedCount`, `needsReviewCount` and `rejectedCount`. Findings default to Needs Review if the stored status is absent.
- Research & Findings and Target Overview read that same summary. Marking a finding reviewed/rejected or completing a research run reloads the summary immediately, without forcing an amCharts root rebuild.
- Rejected findings are hidden from the normal finding list and recent-evidence modal but **never deleted**.
- The clickable Rejected count opens a paginated, owner- and Target-scoped recovery window, sourced from `GET /api/targets/{tid}/research/rejected-findings?limit=50&skip=0`.
- Restore calls the existing `PATCH /api/targets/{tid}/findings/{fid}` with `status: needs_review`, then refreshes both the active Problem and target-level summary.
- Counts describe **review workflow state**, not empirical credibility. A Reviewed finding is not necessarily independently verified.
- The `accessible(tid)` authorization guard still applies, and both queries and status writes constrain by authenticated owner ID and target ID.

### Generate Concepts as a separate workflow

- Research & Findings now offers a button that opens the distinct **Generate Concepts** floating panel; AI generation, editable draft concepts and promotion-to-saved actions live there rather than inside the research review window.
- Navigation provides a Generate Concepts entry. A Problem Details → Concepts button also opens the generator with the current Problem selected. When opened directly from Navigation, users can select a Problem in the generator.
- The generator lists concepts explicitly attached to the selected Problem through the Neo4j `INSPIRED_BY` relationship, using the enhanced existing `GET /api/targets/{tid}/problems/{pid}` payload. Each saved concept opens the existing Concept Workspace modal with matching and analysis entry points.
- Manual Concept Studio and its unlinked-concept workflow remain available separately. The existing AI generation, draft promotion and solution CRUD endpoints are unchanged.

## Data changes and compatibility

No database migrations, schema resets, reseeding or changes to evaluation rubrics. One additive, read-only rejected-findings API route and response fields on two existing read endpoints were introduced. The `get_problem` response includes `solutions`, limited to saved concepts owned by the requesting account and originating from the selected Problem. The new frontend keeps the Graph/Neo4j hierarchy, social-signal rings, graph continuity and evaluation methods intact.

## Validation

Run from the repository root inside your Python 3.12 venv:

```bash
python -m unittest discover -s tests -v
```

Run from `apps/web` with npm dependencies installed:

```bash
npm run test:lenses
npm run test:graph
npm run test:concepts
npm run test:tooltips
npm run test:publication
npm run test:onboarding
npm run test:research-ux
npm run build
```

The source-contract suites are **not** a substitute for actual browser and Neo4j testing. No real AI providers, live Neo4j or full npm/Vite build were available in the build environment.

### Manual browser acceptance checklist

1. Sign into a new account and verify Navigation is left and full height, Overview top right and Target Explorer closed. Open Target Explorer and confirm all streams start collapsed.
2. In the wizard choose all four lenses and confirm each primary question changes. Generate a two-stream map, Skip the first stream and Save & Continue the second; verify that the skipped stream has **no saved taxonomy**, and Save cannot double-submit the completed one.
3. Research a Problem with at least two sourced findings. Mark one Reviewed; confirm Research & Findings and Overview counts refresh immediately and reconcile.
4. Reject another finding and confirm it disappears from active research; click Rejected, inspect source and restore. Verify the finding returns to Needs Review and totals change promptly.
5. Switch Targets/accounts and confirm rejected findings and saved research do not cross user or Target boundaries. Verify all research mutation controls remain blocked on a shared read-only Target.
6. Select a Problem and open its Concepts button; verify it opens the new Generate Concepts panel, not the manual Concept Studio. Generate drafts, edit/promote a saved concept and confirm it appears below the form and in the existing graph/concept workspace.
7. Select another Problem in the generator; only its originating concepts should be listed. Verify no graph remount on generated concept saves and that concept matching/analysis still use the existing saved Concept.
8. Resize viewport and check window positions / scrolling on desktop, tablet and narrow mobile widths.

## DirectAdmin deployment

Upload the complete source ZIP to `/home/siteadmin/releases/` and use the existing root-safe deployment script:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.7-Workspace-Research-UX.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

The deployment script runs `npm run test:research-ux` alongside the previous frontend suites before the complete TypeScript/Vite production build, and only publishes on success. Preserve `.env`, SQLite, Neo4j, Python 3.12 venv and root-safe `siteadmin` ownership. Back up SQLite and Neo4j independently before deploying. Do **not** use bootstrap/reseed or edit the DirectAdmin proxy for this upgrade.
