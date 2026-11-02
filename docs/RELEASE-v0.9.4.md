# Problem Explorer v0.9.4 — Concept Branch Controls & Workspace Modal

**Upgrade:** additive from v0.9.3; no database migration, reset, or reseeding.

## Motivation and interaction contract

Previously, a Problem node's dotted outline indicated attached concepts but did not give users an independent way to reopen its concept branch. Its click handler deliberately opened Problem details without expanding.

This release adds a separate high-contrast numbered badge on the perimeter of each Problem having at least one **saved, explicitly originating concept**. The count is derived from the target- and owner-authorized Neo4j `INSPIRED_BY` projection. It excludes drafts, unrelated Concepts, and foreign-target associations.

- **Problem circle or label:** opens the existing Problem detail modal; does not toggle children.
- **Number badge:** expands or collapses the saved Concept children. This is an amCharts node child, not a separate graph overlay, and badge click events are isolated from the parent. Expanded Problem keys remain in the existing account-/Target-scoped SQLite graph-view state.
- **Concept circle or label:** opens a distinct, keyboard-dismissable Concept Workspace modal with the saved title, description, match/evaluation counts and actions for Problem Matching and Concept Analysis. These actions open the existing target-scoped floating windows for the same Concept.
- **Newly saved concept:** uses `addChildData()` in the already mounted ForceDirected series, increments/activates the originating Problem badge, and reveals that branch without disposing the amCharts root. Unlinked Concepts remain available in Concept Studio, without an invented origin.

The tooltip indicates the count and badge action. The badge uses the existing light/dark monotone theme and admin-configured graph palette. Other structural nodes retain normal hierarchy behavior.

## Architecture and data integrity

- API: `GET /api/targets/{tid}/amcharts-tree` includes an additive `conceptCount` on Problem nodes, computed from the same source-scoped Concept children already returned by v0.9.3. Canonical node and relation identifiers are unchanged.
- Neo4j: `INSPIRED_BY` and `ADDRESSES` relationships are unchanged. No ontology mutation or schema migration.
- SQLite: existing user graph preferences persist the expansion state; no new table.
- Lens framework: Concept Workspace title and actions use the current lens vocabulary, without affecting canonical API fields or evaluation rubrics.
- amCharts root lifecycle: the chart effect still depends on `targetId`, `refreshKey`, and `resetSequence` only. Badge and Concept dialog interactions do not fetch or rebuild graph data.

## DirectAdmin deployment

Upload `Problem-Explorer-v0.9.4-Concept-Interactions-TS-Hotfix.zip` into `/home/siteadmin/releases/`, then run as root:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.4-Concept-Interactions-TS-Hotfix.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

The deployer builds as `siteadmin`, preserves the production `.env`, Python 3.12 virtualenv, SQLite, Neo4j, and web proxy configuration, and creates a code/frontend rollback snapshot. Make independent database backups according to `docs/RECOVERY-AND-DATA.md`. **Never run `bootstrap --reset-all` during an upgrade.**

## TypeScript build hotfix (October 24, 2026)

A TypeScript `TS2339` failure in `NetworkCanvas.tsx` was found during deployment:
`IPointerEvent.originalEvent` can be a `Touch` which lacks `stopPropagation`.
The concept badge click handler now narrows the native event using the
`'stopPropagation' in nativeEvent` runtime/type guard and calls the method
only when it exists. The existing synthetic-event suppression fallback and
all concept, graph, and backend behavior are unchanged.
No data migration or fresh install is needed.

## Verification

- Backend offline: `PYTHONPATH=apps/api python -m unittest discover -s tests -v`
- Frontend: `cd apps/web && npm install && npm run test:lenses && npm run test:graph && npm run test:concepts && npm run build`
- Packaging: run Python compilation and `bash -n` on the deployment scripts.

Browser smoke tests on real data:

1. Open a Target with at least one saved Concept explicitly originating from a Problem. Locate the Problem badge showing its correct count. Test mouse and keyboard as appropriate.
2. Click Problem text: verify Problem detail opens without toggling concepts. Close it; click the count badge twice: verify expansion then collapse, without a new `GET /amcharts-tree`.
3. Expand concepts; select one. Verify the dedicated Concept Workspace shows its saved name/description; use Matching and Analysis to open the respective existing floating windows with the correct Concept selected.
4. Save a second originating Concept from Research or Concept Studio. Verify the count increments and the existing chart/camera remain mounted and usable.
5. Sign out and back in; verify view persistence. Test a shared read-only Target, unlinked Concept, theme switch and lens switch. No private cross-account Concept should leak.
6. Retest the v0.9.3 graph appearance, source attribution, matching percentages, existing research, admin functions and multi-agent evaluations.

**Validation limitation:** Offline contract checks do not establish browser rendering or amCharts hit testing. `npm run build`, live Neo4j access and real browser smoke tests are required before treating this release as verified for production.
