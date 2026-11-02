# Problem Explorer v0.9.8 — Research Graph Intelligence & Studio Context

## Purpose and scope

This release builds on the deployed v0.9.7 UI and retains its canonical `Target → Stream → Category → Problem` ontology, Neo4j research store, SQLite accounts/graph-view preferences, v0.9.2 terminology registry, and established DirectAdmin deployment/rollback tooling.

### Studio entry behavior

- Opening **Research & Findings** or **Generate Concepts** from **Navigation** uses a global studio mode, with a searchable list of Problems within the active Target. It does not lock the page to the previously selected Problem. Research history and the overall target-scoped research counts stay in global mode.
- Opening the same workflows from **Problem Details** uses focused Problem mode. The duplicate studio title, general originating-Problem selector and general summary/history are suppressed in the focused page. The selected Problem remains visible, with the relevant evidence or concept operations beneath it.
- The Generate Concepts context presents the selected Problem, a note that generated concepts are drafts until saved, design direction, generation count and button, draft list, then active saved concepts originating from that Problem.
- Each new piece of terminology is added to Classic's central language registry for fallback resolution in other lenses. The canonical entity names in routes and storage remain unchanged.

### Reversible rejection of saved concepts

- New `PATCH /api/targets/{tid}/solutions/{sid}/status` supports `{ "status": "rejected" }` and `{ "status": "active" }`. Requires write permission to the Target and owning account. It never deletes the Solution, matching relationships, original Problem, evaluations, or generated ConceptDraft.
- New `GET /api/targets/{tid}/solutions/rejected?limit=50&skip=0` shows the authenticated owner's rejected concepts within that accessible Target, with optional originating-Problem context and paginated restoration.
- New Solution records get `reviewStatus='active'`. Legacy Solution records without a review status are treated as active. Active concept routes and visible lists exclude rejected concepts. Concept drafts promoted into rejected Solutions show a rejected indicator rather than offering Save again; restore via recovery.
- The existing `/stats` response adds `rejectedSolutions` and reports active `solutions` separately. Overview and Concept Studio provide access to the rejected concept queue. This is a *workflow status*, not an evaluation of the concept's objective merit.

### Graph intelligence and appearance

- The existing amCharts hierarchy endpoint now reports owner-scoped `conceptCount`, `reviewedCount`, `unreviewedCount` and `problemCount` on structural nodes. Counts aggregate from Problems through Category, Stream and Target. An originating concept is counted once per Problem branch; unlinked concepts are not invented as children. Rejected concepts/findings remain stored but are excluded from active concept and reviewed/unreviewed badges.
- **Graph Appearance** adds colors for reviewed findings, unreviewed findings and descendant problems, plus four visibility switches for concepts, reviewed findings, unreviewed findings, and problems. Existing closed/open/hover colors continue to control the *interactive* Problem concept badge. Palette settings remain in the administrator-controlled `graph_appearance` SQLite row, with backward-compatible defaults and no Neo4j schema changes.
- Concept badge count remains clickable to open/collapse its own Problem's attached concepts, but its redundant `+ / −` decoration is removed. Structural parents show nonzero informational badges; clicking the main node continues its existing behavior.
- After finding-status or concept-status changes, `activityVersion` requests an updated authorized hierarchy and repaints existing badge sprites, reconciling restored/rejected concepts without disposing the chart root. The initialization effect continues to depend **only on target ID, structural refreshKey and explicit Reset View**.
- The expected badge number is the current viewer's evidence, not a shared-global claim about research quality. No automatic evidence verification or evaluation semantics are introduced.

## Additive endpoints and storage

- New endpoints: `PATCH /api/targets/{tid}/solutions/{sid}/status`; `GET /api/targets/{tid}/solutions/rejected`.
- Additive Solution properties: `reviewStatus`, `statusUpdatedAt` when state changes. Existing Solutions are active unless explicitly rejected.
- Additive appearance JSON keys: `badgeReviewed`, `badgeUnreviewed`, `badgeProblems`, `showConceptBadges`, `showReviewedBadges`, `showUnreviewedBadges`, `showProblemBadges`.
- No Neo4j structural schema migration, SQLite schema migration, reset, reseeding, environment secret changes, or proxy changes.

## Deployment and validation

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.8-Graph-Intelligence.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

Before the code upgrade, independently back up live SQLite and Neo4j as described in `RECOVERY-AND-DATA.md`; code rollback doesn't undo user-created review status fields.

Offline checks: Python 3.12 test suite under `tests/`, frontend source-contract suites `npm run test:lenses`, `test:graph`, `test:concepts`, `test:tooltips`, `test:publication`, `test:onboarding`, `test:research-ux`, and **`test:graph-intelligence`**. Deployment additionally runs `tsc --noEmit && vite build` with actual npm dependencies **before** publishing. This full build was unavailable in the development container, so the production upgrade is gated on it succeeding on DirectAdmin.

### Interactive acceptance checklist

1. Launch global Research & Findings and Generate Concepts via Navigation after having selected a Problem earlier. They must start at the searchable Target-wide Problem selector, not the old Problem.
2. Click a Problem node → Research & Evidence or Concepts. Check that the page is focused and no redundant global selector/summary precedes the Problem details.
3. Save a new concept from a chosen Problem. It must appear in the graph under that Problem, increment all ancestor concept badges, and leave the camera/Root intact.
4. Open Concept Workspace, reject the concept, verify active counts decrease, open Rejected Concepts and restore. Previously saved matching/evaluation data must still be present.
5. Review, reject and restore source findings. Counts must reconcile between Research & Findings, Overview, and graph badges without reinitializing amCharts.
6. Verify rollups: two Problems with one originating concept each produce two for their shared Category, Stream and Target. Unlinked concepts must not inflate a branch.
7. In Graph Appearance, toggle each badge type off/on and adjust its color in dark/light themes. Hide/reopen, switch lenses and select nodes; graph position, research statuses and meaning must remain unchanged.
8. With a second account and a shared read-only target, verify private concepts/findings and rejected queues never leak across users, and reject/restore is denied to viewers.

## Limitations and future work

- Full browser pointer, hover, force-layout and large-target performance behavior still require live testing. Node badges carry counts and informative hover text, but only Problem concept badges expand/collapse a concept branch.
- Findings marked `reviewed` are merely reviewed by the current user—not experimentally verified. Concept rejection is organizational triage, separate from later Evaluation Profiles.
- Evaluation Profile methodology, external MCP mapping, and Research Toolkit administration remain intentionally out of scope.
