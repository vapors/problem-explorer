# Problem Explorer v0.9.8.2 — Badge Geometry and Hover Controls

## Changes from v0.9.8.1

1. Four **separately configurable badge hover colors**, one for Concepts, Reviewed Findings, Unreviewed Findings, and Problems, in both light/dark palettes. Existing `badgeHover` is retained as the Concepts hover setting; the other three fields have safe defaults for old saved palettes.
2. **Independent tooltip semantics**: only a Problem's concept toggle advertises Expand/Collapse. Aggregate concept counters on Target, Stream and Category nodes describe the saved concepts in their branch.
3. **Perimeter geometry**: visible badges are distributed in an arc centered toward currently visible child links or a stable fallback bearing. Hidden badges no longer consume slots in the arc.
4. **Ghost badge defense**: all overlay sprites start hidden, with paint methods requesting visibility rather than revealing prematurely. The overlay positions each badge only after a valid source node and valid geometry are available. Missing, collapsed or disabled badges remain non-rendered.
5. **Tooltip isolation**: badge hover suppresses the hierarchy node tooltip while the pointer is over a badge, and uses the separate badge tooltip if enabled.

The canonical research model, Neo4j relations, SQLite tables, account settings, terminology lenses and persisted view format are unchanged. No migration or reset is necessary.

## Deploy

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.8.2-Badge-Geometry-Hover.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

The DirectAdmin packaging/deployment checks inherited from v0.9.8.1 still require the bundled `data/problems.csv` reference file. Do not run reset/seed commands on upgrades.

## Browser smoke tests

1. Set different hover colors for each badge type in Graph Appearance, save, and hover each type in both themes.
2. Hover the Concept count on a Category/Stream/Target: it must say the aggregate count, **not** Expand/Collapse. The originating Problem badge must still expand/collapse its concepts.
3. Open/collapse nodes with multiple badges and verify only visible badges use available perimeter arc positions.
4. Hide all badge types, expand/collapse ancestors, and confirm no orphan counter appears at a chart corner.
5. Confirm badge hover does not show the parent node tooltip; disable badge tooltips and verify they remain absent.
6. Confirm no chart root/camera reset during appearance changes or concept branch toggling.

## Test status

Offline tests verify the configuration contract and pure geometry. The full dependency-based `tsc --noEmit`/Vite build and real amCharts pointer/force-layout integration **must pass on the deployment environment before publication**.
