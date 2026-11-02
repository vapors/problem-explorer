# Problem Explorer v0.9.6 — Guided Onboarding & Map Review

## Intent

Refine the initial experience without altering canonical Neo4j entities, authenticated target routes, social evidence treatment, evaluation rubrics, or the amCharts root lifecycle. This is a **frontend-only workflow upgrade**; version metadata and deployment/testing documentation are updated as part of the release.

## New onboarding sequence

1. **Select a research lens and name the workspace.** Four accessible icon cards replace the select dropdown. Descriptions live in a hover/focus information hint beside each card. Only after clicking a lens does the target-name prompt and lens-specific wording appear. Classic remains the safe fallback; the lens affects presentation only. A featured shared workspace remains discoverable.
2. **Research focus / audience.** Keep the existing description input, avoiding redundant explanatory text. Advanced setup retains sharing, stream detail (3 by default), editable AI-suggested streams and a manually entered stream. The existing `POST /api/targets/with-streams` path creates the Target and its initial streams.
3. **Generate map.** Select existing streams and taxonomy depth. **Continue →** uses the existing `POST /api/targets/{tid}/streams/{sid}/seed-preview` endpoint sequentially for selected streams, storing preview drafts only in wizard state. Previously successful previews are retained if a later request fails, so retry does not spend allowances twice. The upper-right Open Graph button is removed. Advanced setup retains manually added streams/categories and an opt-out of AI generation.
4. **Review and edit.** One stream per sub-step, with a visible square for pending/current/completed stream status. All draft category editors start collapsed. Expand to edit names and problem hypotheses. **Next →** persists that stream through the existing additive `POST /api/targets/{tid}/streams/{sid}/taxonomy`, then advances. The final **Finish · Open graph →** saves the last stream and opens the chart. The application never silently treats these drafts as verified evidence.

## Saved streams and editability

The current target-scoped taxonomy endpoint appends new Category/Problem records. The wizard therefore prevents repeated saves once a stream reports success. Previously saved sub-steps can be revisited for status, but editing saved entities continues in **Research Structure**, which already has direct mutation endpoints. A new Target is not deleted if the user opts out of generating taxonomy or closes the wizard. After closing, the Target remains available in their library.

## Data and permissions

- SQLite users, quotas and job states unchanged.
- Neo4j Target/Stream/Category/Problem/Concept/Research schemas unchanged.
- All UI taxonomy labels are resolved through the runtime lens dictionary; factor IDs and graph nodes remain canonical.
- Every existing research, AI evaluation, social-signal, graph view, concept and admin workflow remains mounted.
- The wizard only uses the authenticated existing target-scoped routes and the established client session.

## Local and DirectAdmin validation

From `apps/web` after `npm install`:

```bash
npm run test:lenses
npm run test:publication
npm run test:onboarding
npm run build
```

For the backend, run `python -m unittest discover -s tests -q` inside the existing Python 3.12 environment. These source-contract tests cannot replace real-browser testing.

### Manual acceptance cases

- Select every icon lens; verify contextual prompt and label without changing the graph's data contract.
- Open lens information with hover **and keyboard focus**; confirm it does not change the selected lens.
- Use Back/Continue between Step 1 and Step 2 without losing entered values.
- Create with the default three streams; confirm Step 3 has selectable streams and configurable map depth.
- Select two streams, generate previews, inspect the Step 4 indicators, and confirm all categories start collapsed.
- Expand a category, edit a draft problem statement, press Next and confirm it persists as an **unverified draft**.
- Move back to a saved stream and return; it must not submit duplicate categories/problems.
- Finish the final stream; chart should open with the saved hierarchy.
- Exhaust AI allowance or simulate partial failure; the wizard must report the failure and retain successful previews. Advanced manual/open-graph path must remain accessible.
- Test shared/public Target permissions with separate ordinary accounts and ensure a shared read-only target is not used for wizard mutations.
- Confirm saving a concept, lens changes, saved graph view, research job history, and social overlays continue to function.

### Deploy safely

Upload `Problem-Explorer-v0.9.6-Guided-Onboarding.zip` to `/home/siteadmin/releases/`, then:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.6-Guided-Onboarding.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

No database reset, migration, reseeding, native-pip changes or DirectAdmin proxy edits are needed. The deployer runs as root for service/copy operations, but installs and builds JavaScript as `siteadmin`, preserving appropriate permissions and persistent production state. Back up SQLite and Neo4j independently; the code snapshot rollback is not a research-data backup.

## Validation limits

The frontend source-contract suites, Python regression tests, and syntax verification can run offline. A full npm production build requires installed frontend packages and must pass in the deployment environment. Real Neo4j, AI-provider responses, responsive-layout and browser interactions also require environment testing.
