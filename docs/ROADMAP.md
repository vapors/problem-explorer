# Problem Explorer roadmap and evidence boundaries

## v0.8.2 — completed

Protected Target deletion and admin inventory; two evaluation modes; an amCharts radar that distinguishes unknown factors from poor scores.

## v0.9.0 — completed

- Separate, source-attributed `SocialSignalObservation` nodes and audit entries in Neo4j; settings and scores are not moved into SQLite.
- Explicit Target / Stream / Problem configuration inheritance; admin-only settings, source URL editing and manual locks.
- Reviewed, admin-curated discussion observations (not a forum crawler) and transparent aggregate node-level signal scores on a **1–10** scale; unknown stays `null`.
- A muted, optional amCharts graph ring whose changes do not reset chart data or camera, and a separate optional concept radar overlay with individual source links and contextual summaries.
- New evaluations use 1–10; old 1–5 evaluations use an explicit on-screen conversion without overwriting records.
- Radar displays sparse ratings as real points/open segments. No fabricated shape or fake minimum score.

## v0.9.1 — completed

1. Independent quantitative and qualitative agents, versioned strict Pydantic output, evidence versus exploratory methodology, explicit assumptions and confidence, contradiction review.
2. Bounded background jobs that cannot stall graph navigation, independent of embedding indexing. SQLite for operational job state, Neo4j for research outputs.
3. Optional allowlisted RSS/Atom collection of unscored, admin-review candidates, disabled by default. Future provider APIs require additional authorization and privacy review.
4. Audited evaluation comparisons and reviewer controls. Use empirical citations only with source review; do not treat social signals as validated data.
5. Added guided New Target → Investigate → Open Graph flow. Full Neo4j, browser, and performance regression tests on large targets remain deployment acceptance gates.

## Release protocol

For every subsequent version update `deploy/release.env`, the backend app version, `apps/web/package.json`, `README.md` and `docs/RELEASE-vX.Y.Z.md`. Keep `docs/DIRECTADMIN.md`, `docs/LOCAL-WINDOWS.md`, `docs/RELEASE-PROCESS.md` and `docs/RECOVERY-AND-DATA.md` synchronized. The deployment scripts are version-independent and never reset databases.


## v0.9.2 — Lens Framework (completed)

- Classic/default terminology is a compatibility guarantee; general challenge, technical engineering, and human-centered design presentations are optional lenses.
- Three-step onboarding: name the target, describe research focus/audience, and investigate graph depth; canonical API requests are identical.
- User-selected wording is stored in local browser preferences keyed by account, not Neo4j. Other browsers have an independent preference.
- UI copy centralization through a typed registry with graceful Classic fallback; swapping lenses does not fetch data or dispose of amCharts roots.
- No evaluation factor renaming if semantics differ, no inferred maturity, no alternate AI prompts or MCP connector privileges from lens selection.

**Future:** explicit backend-authorized lens management; evaluation profiles; research toolkit / MCP mapping; more complete localization of non-structural copy. Do not mix these concerns into the terminology registry.

## v0.9.3 — Graph continuity (completed)

- Stable application record keys for per-user, per-target saved branch/focus/camera state in SQLite.
- Concept attachments to originating problems without changing structural Neo4j containment; no chart root rebuild on concept saves.
- Admin-configurable dark/light hierarchy colors repainted in place, preserving social signal rings.
- Future: concept-match overlays using already stored estimated relevance percentages, permission-gated view style preferences, Evaluation Profiles, Research Toolkit/MCP administration.

## v0.9.4 — Concept interactions (base release)
- Count badge on Problem nodes opens/closes attached concept branches; clicking Problem labels still opens research details.
- Clicking a Concept opens the dedicated Concept Workspace modal, leading to matching and analysis.
- Preserve graph instance, camera state, lens separation, source integrity, and the version-independent deploy tooling.

## v0.9.5 — Target publication and lens defaults (completed)

Separate public sharing, directory discovery, deletion protection, general featured choice and per-lens recommended shared Targets. Preserve the seeded Longevity reference in Neo4j even when administrators hide it or remove public access. No research migration or forced graph switching.

## v0.9.6 — Guided onboarding and map review (completed)

- Four-stage lens → focus → map generation → stream-by-stream review; no new backend endpoints.
- Lens icon selector; optional information tooltips; contextual target naming after selecting a lens.
- Step 3 Continue generates map previews for selected streams; Step 4 collapses categories initially and advances after an individual saved draft.
- Saved-stream guard prevents duplicate additive taxonomy submissions; revising persisted records remains in Research Structure.
- Wizard retains AI-free path under advanced setup for users without available requests.
- Evaluation Profiles and Research Toolkit/MCP administration remain separate future work.

## v0.9.7 — Workspace & Research UX (completed)

- Lens-aware wizard heading, Save & Continue / Skip review controls and collapsed taxonomy editors.
- Navigation and overview default positions; Target Explorer streams closed on first opening.
- Owner/Target scoped findings counts across overview/research; rejected recovery without deletion.
- Dedicated Generate Concepts workflow and originating Problem concept list.

## v0.9.8 — Research Graph Intelligence & Studio Context (completed)

- Four admin-configurable graph badges, descendant rollups, and graph updates after research actions without chart remounting.
- Context-sensitive Problem workflows versus global searchable studios. Reversible concept status and recovery, without loss of matching or evaluation history.
- Evaluation Profiles and Research Toolkit/MCP administration remain later, separate phases.
