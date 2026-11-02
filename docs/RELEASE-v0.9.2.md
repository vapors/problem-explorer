# Problem Explorer v0.9.2 — Lens Framework Foundation

Release track: v0.9.1 → v0.9.2, no research schema/database changes. This is a **presentation-only** refactor. This note, `docs/DIRECTADMIN.md`, and `deploy/release.env` travel in every versioned source ZIP.

## 1. Runtime lenses

- `apps/web/src/types/terminology.ts`: stable canonical `EntityKey` dictionary, exhaustive Classic fallback messages, typed `MessageKey`, semantic entity labels, three opt-in packs, interpolation. Classic retains prior v0.9.1 entity vocabulary.
- `apps/web/src/contexts/TerminologyContext.tsx`: one provider after authentication, active lens resolver, `t()` UI message hook and `getLabel()` entity helper, defensive fallback to Classic for unknown/restricted lens IDs. Browser preference is scoped to the signed-in account ID via `localStorage`. There is no unapproved server-side write. Browser preferences do not follow the user to another device.
- Four lenses: **Default / Classic**, **General Challenge Mapping**, **Technical & Engineering**, **Human-Centered Design & Innovation**. Terms were curated to **avoid false claims**: a failure hypothesis is not a diagnosed failure; an engineering research track is not a live telemetry feed; a proposed fix is not a validated implementation.
- A lens can be selected at the start of onboarding or at any time from the main toolbar. Users can share one target and read it through different lenses without changing stored source text.
- Extensibility: Classic owns all required copy, while a new pack supplies typed optional label or message overrides. New message keys must first be added to Classic; each alternate pack safely falls back.

## 2. Three-stage onboarding (same API contracts)

1. **Name workspace**: optional lens selection and `Target` name. Only the copy changes (e.g. Design Objective name); the API always receives `{name: string}`.
2. **Research focus / audience**: the existing `description` input, not a new stakeholder entity. Advanced setup retains `outline` (three streams), `standard` (five), or `detailed` (seven), editable AI suggestions, manual stream entry and visibility controls.
3. **Build graph**: create Target + selected Streams using the existing `POST /api/targets/with-streams` route, then review and optionally save generated Categories and Problems using the existing `seed-preview` and `taxonomy` routes. Users may finish without filling every stream; they can expand it later through Manage hierarchy. Stream/category manual entry remains behind Advanced setup.

The background stays blurred, the initial Target retains the existing permission model, and **AI-generated hypotheses are still drafts**. New Target creation consumes AI allowance when it requests suggestions and taxonomies. The wizard never changes research data to fit display language.

## 3. Chart and evaluation isolation

- `NetworkCanvas.tsx` consumes translated **status text** and accessibility labels while the ForceDirected amCharts root lifecycle remains governed exclusively by `[targetId, refreshKey, theme]`. Lens switches do **not** change the target ID, layout data, numeric IDs, branches, zoom/camera, saved research, or social-signal overlay. The adapter continues to use unchanged names and catalog prefix clipping from `networkLabels.ts`.
- `EvaluationRadar.tsx` changes presentation-only titles/legends and accessibility text. Its five factor IDs remain `desirability`, `feasibility`, `viability`, `impact`, and `coverage`, and **their meaning, numerical scoring, sourced data, and methodology do not change with lenses**. It continues to distinguish `null` (unknown) from numeric values, and keeps social discussion separately optional and non-empirical.
- FloatingPanel and TargetExplorer dynamically show lens-specific titles and entity references without remounting their underlying working widgets or clearing form state.
- This release does not add a new Evaluation Profile or domain-specific MCP connector. Such profiles require explicit methodology and backend authorization later.

## 4. Security and data protection

No new FastAPI endpoints, Python packages, Neo4j constraints, SQLite schema fields, or background workers. No database migration, reset, reseed, server secret rewrite, Google SSO change or DirectAdmin proxy modification. Existing users receive Classic by default. Switching lenses grants no permissions and never changes the `ownerId` rules or reviewed/unreviewed statuses.

The toolbar selector is a *user preference*, not a security boundary. When server-managed lens permissions are introduced, enforce them server-side rather than relying on JavaScript filtering.

## 5. Test plan and results

Developer test commands:

```bash
python -m unittest discover -s tests -v
cd apps/web
npm install # or npm ci when a matching package-lock.json exists
npm run test:lenses
npm run build
```

`test:lenses` verifies complete Classic fallback and alternate pack interpolation, all entity forms, canonical scoring IDs, original onboarding API paths, correct three-phase state, account-scoped preference, and the graph-root lifecycle dependency contract.

Offline in the packaging environment: historical backend tests and isolated TypeScript vocabulary checks run; **full npm build cannot be claimed without installing dependencies**. DirectAdmin's existing root-safe `deploy.sh` now runs `npm run test:lenses` followed by `npm run build` **as siteadmin**, before touching the production source or frontend. Production Neo4j, AI, and browser acceptance still require a live smoke test.

## 6. DirectAdmin incremental upgrade

Upload the complete `Problem-Explorer-v0.9.2-Lens-Framework.zip` to `/home/siteadmin/releases/`, then as root:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.2-Lens-Framework.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

The scripts continue to preserve the production `.env`, Python 3.12 `.venv`, SQLite, Neo4j database, DirectAdmin proxy configuration and `.htaccess`; they normalize published source ownership to `siteadmin`. No `bootstrap --reset-all`, migrations or reseeds.

### Postdeploy browser smoke tests

1. Sign in with a **pre-existing** target. Verify Classic is selected and the Target Explorer displays exactly the same saved names/statistics.
2. Expand a branch and zoom. Switch to Engineering, then to Human-Centered Design. Check that branch expansion and camera position remain unchanged, and no fresh `GET /amcharts-tree` occurs.
3. Keep a research panel open, type unsaved content, switch lenses and confirm the text persists. Verify all research records, review statuses, concept evaluation factors and social overlays remain unchanged.
4. Start a new target using the three-stage wizard; verify the actual backend target retains canonical routes, name and research focus, default three stream suggestions, optional taxonomies and manual editing.
5. Log out and sign in as another user in the same browser: check their separate saved lens preference; shared/read-only and admin guards must still be enforced by the API.
6. Verify sparse radar ratings, multi-agent job polling, target deletion protection and source traceability regressions.

Roll back code/frontend only using the snapshot recorded by `deploy.sh` if these tests fail. Back up SQLite and Neo4j independently before any unrelated destructive operation.

## 7. Known boundaries / next steps

This is a typed *structural presentation* foundation, not a localization of every sentence in authentication, job diagnostics, legal/error messages and all deeply nested forms. The highest-use structural copy is centralized now; additional contextual copy should use the same `t()` resolver in subsequent UI iterations. Fully custom administrator-authored packs, server permissions, alternative evaluation rubrics, and external MCP mapping remain separate scoped proposals.
