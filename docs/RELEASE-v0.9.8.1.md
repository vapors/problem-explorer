# Problem Explorer v0.9.8.1 — Perimeter Badge Refinements

## Scope

This is a presentation-only maintenance release from v0.9.8. The canonical `Target → Stream → Category → Problem` Neo4j model, source findings, active/rejected concept lifecycle, lens terminology, user graph views, auth/quotas and Evaluation data are unchanged.

## Improvements

1. **Perimeter-following badge placement**: count badges are no longer fixed above each node. Each visible node's badges are placed just outside its circle. Their preferred direction is toward the centroid of its **visible child branches**, approximating the origin of connecting links. When children are collapsed, placement uses the last known bearing; if none is available, it uses the outward direction opposite the incoming parent link. Multiple badges fan around a short arc rather than stacking on the same point.
2. **Independent interaction layer**: badges are attached to a separate amCharts sibling overlay, not to the hierarchy node itself. This avoids overlapping node/badge hit areas and suppresses the parent's tooltip while a badge is hovered. The Problem bubble still opens Problem Details, and the Problem concept count badge independently expands/collapses saved originating Concepts.
3. **Graph Appearance / Open and Closed state controls**: administrators may configure a visible checkbox and separate closed/open fill color for each of the four badge types (Concepts, Reviewed Findings, Unreviewed Findings, Problems), per light/dark theme. A global Show Badge Tooltips checkbox controls badge hover text. The existing hover color is retained.
4. **Default clarity**: expanded parent summary badges (non-interactive) are hidden by default; collapsed summary badges are visible. The Problem's interactive concept badge fades when expanded. Even if its expanded-state visibility is disabled, a subtle concept toggle remains available so the branch can always be collapsed. Existing installations automatically receive defaults for new appearance keys when loading older palette JSON.

The existing administrator badge-type switches remain effective. The count meanings, view permissions and hierarchy rollups from v0.9.8 remain unchanged. The graph's root is still created only when `targetId`, `refreshKey` or the explicit Reset View sequence changes; badge movement and palette changes update the existing amCharts sprites.

## Deployment

First back up SQLite and Neo4j independently using `RECOVERY-AND-DATA.md` (code rollback does not revert data, although no new migration is required). Upload `Problem-Explorer-v0.9.8.1-Perimeter-Badges.zip` to `/home/siteadmin/releases/`, then run:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.8.1-Perimeter-Badges.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

The existing root-safe deployment script performs non-destructive offline Python tests, frontend contract tests including **`npm run test:badge-layout`**, then the full `tsc --noEmit && vite build` as `siteadmin` **before publishing**. No reset/reseed, Neo4j schema migration, SQLite table migration, `.env` update or DirectAdmin proxy change is needed.

## Validation performed in the source environment

- 86 existing Python offline tests pass, including concept-status permission and hierarchy count contracts.
- All nine frontend contract scripts pass, including the new perimeter geometry test with pure mathematical checks and a separate-overlay interaction contract.
- New geometry module passes standalone strict TypeScript checking; application-wide TS syntax parsing and Python compilation/Bash syntax checks pass.
- **Actual npm dependency-based build and interactive amCharts rendering are not verified here** because npm dependencies are not accessible in the release builder. Production publishing remains gated on the DirectAdmin build, and browser smoke tests are essential.

## Browser acceptance

1. Open a target containing multiple expanded Streams and Categories and several badges per node. Confirm badges sit on the bubble edge, near child connecting lines, and adjust smoothly while the force layout settles.
2. Collapse a Category: the Category's aggregate badges should appear (default). Expand it: those summary badges should hide (default). Verify the behavior on Stream and Target nodes.
3. Expand a Problem's saved concepts: its toggle remains faintly visible and can collapse the branch; the Problem body still opens its own details.
4. Hover each badge: its own tooltip appears but not the parent node tooltip. Disable Show Badge Tooltips and confirm badges retain functionality with no hover text. Check mouse, trackpad and touch; keyboard focus of the concept toggle should remain usable.
5. Open Graph Appearance and set Open/Closed colors and visibility for each badge type in both themes. Save and verify sprite recolors and visibility changes without camera movement or Root recreation.
6. Switch a terminology lens and return to the target: counts and matching semantics remain unchanged and per-user expanded views are preserved.

## Known limits

- Badges are positioned by the *direction* of child links, not guaranteed to overlap an exact individual link when a node has many descendants. They use a perimeter arc for readability.
- Browser verification with installed amCharts remains necessary; automated offline tests cannot fully verify hover hit areas, animation timing, drag, zoom and touch behavior.

## Packaging correction (v0.9.8.1 CSV hotfix)

The initial v0.9.8.1 ZIP accidentally omitted `data/problems.csv`, causing the offline `test_reference_csv_intact` deployment gate to fail before publishing. The corrected full release includes the 498-record reference CSV required by the regression test. No application code, Neo4j content, account data, or existing target is reset or reseeded. The Windows release packager now requires this file, and the deploy script fails early with a clear error if it is absent. The release version remains `0.9.8.1`.

## TypeScript badge-state build hotfix (v0.9.8.1)

Fixed a production `tsc --noEmit` error in `apps/web/src/NetworkCanvas.tsx` caused by an indexed object literal widening badge visibility property names to `string`. The `BadgeKind` → open/closed palette-key map is now explicitly typed as a `Record` before indexing, preserving strict TypeScript checking and all existing appearance behavior. The frontend badge-layout test checks the typed mapping; the standalone strict TypeScript test verifies the mapped access pattern. This is a source-only correction, with no schema, data, appearance setting, or deployment script changes.
