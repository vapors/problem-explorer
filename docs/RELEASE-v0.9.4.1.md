# Problem Explorer v0.9.4.1 — Concept Badge & Tooltip Polish

**Additive patch to the working v0.9.4 Concept Interactions release.** No data reset, new services, schema migration or Neo4j changes.

## User-visible changes

- **Stateful concept badge:** the concept-count circle now includes a small `+` (collapsed) or `−` (expanded) marker, plus a hover response. The badge count remains visible in both states. Its tooltip says **Expand N saved concepts** or **Collapse N saved concepts** to disambiguate the action.
- **Independent hover areas:** the badge uses a separate amCharts tooltip. When the pointer enters the badge, its parent Problem tooltip is hidden. Moving back to the Problem restores normal Problem hover behavior. The existing event-propagation guard remains in place for mouse and touch.
- **Configurable appearance:** Administration → Graph Appearance now has **Closed concepts**, **Expanded concepts**, and **Badge hover** colors for each light/dark theme. Count glyph contrast adapts to the selected background color. Existing node palette keys and research semantics are unchanged.
- **Readable tooltips:** long Problem, Category, Stream and Concept names are broken into lines near **50 characters**, at word boundaries, with amCharts max-width wrapping as a fallback. Stored text, identifiers, graph labels and API fields are not edited or truncated.
- **No chart restart:** badge hover, expansion, palette repaint and tooltip formatting operate on already-mounted sprites and keep zoom, positions, user view state and existing research intact.

## Compatibility

`GET /api/graph/appearance` now also returns `badgeClosed`, `badgeOpen`, and `badgeHover` for both themes. Old admin palette JSON without these keys is merged with appropriate theme defaults on read. The `PUT /api/graph/appearance` endpoint remains administrator-only; older clients supplying only the original five node colors still validate. SQLite schema and Neo4j schema are untouched.

## Root-safe DirectAdmin deployment

Upload `Problem-Explorer-v0.9.4.1-Badge-Tooltip-Polish.zip` into `/home/siteadmin/releases/` and run:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.4.1-Badge-Tooltip-Polish.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

The deployer installs npm dependencies, runs tests, and builds the frontend as `siteadmin` before publishing. It preserves the live `.env`, SQLite data, the Python virtualenv, Neo4j data and DirectAdmin proxy configuration. **Never run `bootstrap --reset-all` during a code upgrade.** Retain the existing independent SQLite/Neo4j backup process.

## Verification

Backend/offline: `PYTHONPATH=apps/api python -m unittest discover -s tests -q`

Frontend: in `apps/web`, run `npm install`, `npm run test:lenses`, `npm run test:graph`, `npm run test:concepts`, `npm run test:tooltips`, and `npm run build`.

Browser acceptance checks:

1. Hover a Problem with a concept badge. The Problem tooltip shows the full readable statement, broken across lines. The badge tooltip should replace it when the pointer enters the count circle.
2. Click badge. Concept children open; the badge changes to its open color and `−` indicator. Click again to collapse and restore its closed color and `+` marker. The Problem modal must not open from either badge click.
3. Click the Problem text: its Problem detail opens normally. Click a Concept: its Concept Workspace opens normally.
4. As an administrator, update closed, open, and hover colors in Graph Appearance for both light/dark themes. Observe immediate recoloring **without** remounting the graph or changing expansion/camera state.
5. Return to the graph in the same and a different account. Previously saved views stay independent, and settings apply according to permission rules.
6. Save a new concept; count and child nodes update incrementally, preserving view and the new badge states.

**Validation limitation:** Offline suites do not prove amCharts pointer hit-testing or production browser behavior. The full Vite build and browser acceptance checks must pass in the installed deployment environment.

## Deployment version validator hotfix

The initial v0.9.4.1 package introduced a four-component maintenance version but the
DirectAdmin `pe_load_config()` validation and Windows PowerShell release packager
accepted only three components. This corrected archive accepts `X.Y.Z` and
`X.Y.Z.W` while preserving the version stored in `deploy/release.env`.

Because an earlier deployment launcher sources its *currently installed* `common.sh`
**before** reading the new ZIP, use the `deploy.sh` contained in this corrected archive
for this one update, or first replace the live `common.sh` with the corrected file.
Once installed, future updates can use the usual live deployment launcher.

This fix is deployment-only; no research files, SQLite or Neo4j data require changes.
