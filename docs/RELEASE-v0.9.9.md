# Problem Explorer v0.9.9 — Research, Concept Studio & Evaluation UX

Baseline: **v0.9.8.2 Badge Geometry & Hover**. Scope: frontend workflow, layout and chart geometry refinement only, aligned with the approved Figma `07 · Proposed UX Refinements` layouts. Existing terminology registry and source CSS are canonical; Figma has not introduced or replaced application styles. Existing API schemas, Neo4j research nodes, SQLite accounts, access policy, concept status, evidence rules, evaluations and saved views are unchanged.

## Feature changes

1. **Two research windows:** Navigation opens `Research & Findings` as a target-wide studio with the user's saved-session summary, recent sessions, search and a Problem drilldown. Opening Research from Problem Details or a research item opens a separate `Problem Research` floating window. The existing source-linked research, finding review, rejection and restore operations are unchanged. Note: the recent-session list comes from the existing target-scoped activity summary; it is not an unbounded database history endpoint.
2. **Integrated Concept Studio:** Saving or selecting a concept from the Concept Studio populates its existing right-hand panel with the same `ConceptWorkspaceDetails` component used inside the graph's context modal. Manual creation appears beneath saved concepts in a collapsed disclosure. AI concept generation is nested beneath that disclosure and uses the existing generation/draft-save endpoints inline, without changing to another window. Creating without a Problem remains a valid unlinked concept. **Save & Match** is an explicit additional matching request; **Save Concept** creates the concept without running the matching model. An origin relationship is not a computed match. Rejected concepts remain restorable.
3. **Contextual evaluation:** Concept-specific entry hides the redundant concept selector and places the selected concept title first; the Navigation studio retains a selector. A new evaluation defaults to exploratory estimates; the method can still be changed and persisted historical methodology remains intact. Historical comparisons now live within the collapsed Evaluation Job History disclosure.
4. **Radar presentation:** The radar is allocated a responsive chart-only area rather than a 295px wrapper around a 330px chart, with room below it for factor cards. The visible `5 of 5` note and legend/footer are removed. Missing scores remain null; accessibility description and individual factor rationales remain. The independent social layer remains opt-in.
5. **Badge geometry:** Graph overlay badges now locate the **actual rendered amCharts circle** instead of assuming the hierarchy container origin. Both its center and radius are transformed into badge-layer coordinates each frame, and the radius has no artificial minimum offset. This is a corrective implementation to be verified interactively at multiple pan, zoom and expansion states. The chart root and saved view contract are not changed.

## Manual acceptance checklist

- Navigation → Research & Findings: target-wide counts and recent research, searchable Problems, no forced last-selected Problem details. Click a saved session and verify separate Problem Research panel opens.
- Problem node → Problem Details → Research & Evidence: opens Problem Research with its selected Problem and existing source review controls. Review, reject, restore a finding; verify activity counts without rerunning research.
- Concept Studio → select saved concept: inline right-hand details, no blurred backdrop. Graph Concept node may still open the context modal. Both display identical saved metrics and matching/analysis actions.
- Expand Create Concept, optionally choose origin. Save: concept appears on the right and graph, **no automatic matching**. Save & Match: inspect result and AI usage. Reject and restore concept.
- Contextual concept → Evaluation: concept title at top; exploratory initially selected; historical comparisons only visible within expanded job history. Navigation → Evaluation must retain the concept selector.
- Radar: test 0, 1, 2, 3, 4, 5 available factors, social layer off/on, legacy scoreMax=5, both themes; verify no overlap into factor cards or fabricated scores.
- Badge behavior: zoom to 25%, 100%, 200%, pan, collapse/expand and move force nodes. Badge stays anchored on the circle circumference; no ghost badges at chart origin; tooltips stay distinct.
- Confirm terminology switching doesn't remount the graph or modify stored research and scores.

## Validation and limitations

- Backend Python unittest discovery: **93 tests passed** in the offline runner.
- Frontend source-contract suites: the existing nine plus new `npm run test:ux-v099` passed.
- TypeScript/JSX **syntax transpilation** passed. This is not a substitute for `tsc --noEmit` with installed dependencies.
- Full Vite/TypeScript build, live Neo4j/API authorization integration, and interactive browser/amCharts testing were **not** performed in the offline environment; npm registry resolution failed (`EAI_AGAIN`). The DirectAdmin deploy script runs the full frontend build before publishing.
- No database reset, reseeding, API schema migration or Nginx change required. Back up Neo4j and SQLite separately before production deployments.

## Deployment

Upload `Problem-Explorer-v0.9.9-Research-Concept-Evaluation-UX.zip` to `/home/siteadmin/releases/` on the established host:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.9-Research-Concept-Evaluation-UX.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

The full release preserves the v0.9.8.2 deployment isolation, source-only backup, code rollback and production state exclusions. If the production build fails, the deploy script stops before publication. Use the retained v0.9.8.2 release/backup for rollback if needed.
