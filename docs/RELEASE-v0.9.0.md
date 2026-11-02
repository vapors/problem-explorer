# Problem Explorer v0.9.0 — Social discussion signals and sparse radar

**Release scope:** source-attributed, administrator-curated social discussion signals; Target → Stream → Problem source inheritance; audited manual overrides; a separate on-demand network signal ring and concept-radar overlay; native 1–10 evaluation scores. The research graph and SQLite authentication/job database remain unchanged.

## Rating semantics and research integrity

- **Score 1 means a measured/estimated very low rating, NOT “no data.”** Unknown remains `null` and is shown as Unrated. A 1–10 radar axis does not create missing scores.
- Sparse concept evaluations with one or two rated factors show *points and possibly contiguous open segments*, with the remaining axes explicitly unscored. A filled polygon requires all five factors.
- v0.8.2 1–5 evaluations remain stored as originally returned; display uses `1 + (old - 1) * 9 / 4`. New results carry `scoreMax:10` and `ai_rubric_v3_10point_*` method. No historical database rewrite is performed.
- **Reviewed research** (`Finding`) and `SocialSignalObservation` remain independent Neo4j labels. Sentiment does not backfill verified findings, proof of concept effectiveness, or scored quantitative outcomes.
- A social discussion score reflects a curator's description of the referenced conversation. It is not a representative survey, empirical prevalence, or proof of a concept working.
- Polarity and unmet-need intensity are separate metrics. Only reviewed *unmet-need intensity* node-level (`factor=overall`) observations are averaged for the node-level `automatedSentiment` field. This is an explicit unweighted average, **not** a population estimate.
- The optional **concept radar** social layer includes only reviewed, **factor-specific** observations linked directly to matched Problems, enabled by effective configuration. It does not inherit a parent's opinion rating or treat a conversation about a problem as a concept effectiveness assessment.
- A score with no direct observations remains absent; only a specifically marked admin manual override can supply one.

## Admin signal configuration

Open a Target, then **Signals** (admin only) to configure each Target, Stream or Problem independently:

1. Enable/disable, or inherit enablement from the parent (Streams and Problems). New Targets default to **off**.
2. Manage the custom HTTPS source URL list, or inherit parent sources; no source is fetched by this release.
3. Set/revoke an administrator override (1–10, audited with actor, timestamp and reason). Auto-aggregation uses a guarded `WHERE coalesce(n.isOverrideActive,false)=false` write. Disabling an override recalculates from reviewed direct observations.
4. Add a curated observation: specific source URL, title, discussion summary, sampling caveats, metric (unmet need/polarity), factor, score, optional sample size. Draft observations do not contribute to summaries; mark reviewed or revoke review to recalculate. Duplicate URL+metric+factor for the same node is refused.
5. Click **Social signals on** in the toolbar to show the muted network ring. The graph uses a separate authenticated data request and updates outer-circle styles **without reinitializing amCharts** or replacing the hierarchy.

## New endpoints (all target-scoped)

- `GET /api/targets/{tid}/signals/graph` — lightweight visual scores for users authorized to view this Target.
- `GET /api/targets/{tid}/signals/nodes` — admin-only configuration inventory.
- `PATCH /api/targets/{tid}/signals/nodes/{kind}/{node_id}/config` — admin-only inherited settings; `{kind}` is `target`, `stream`, or `problem`.
- `PATCH /api/targets/{tid}/signals/nodes/{kind}/{node_id}/override` — admin-only override with audit record.
- `POST /api/targets/{tid}/signals/nodes/{kind}/{node_id}/observations` — admin-curated observation.
- `GET/PATCH /api/targets/{tid}/signals/nodes/{kind}/{node_id}/observations[/{observation_id}]` — review list and status transitions.
- `GET /api/targets/{tid}/signals/solutions/{sid}` — separate reviewed social factor summaries for this user's saved concept.

The new properties and labels are created lazily by Neo4j writes. They are not stored in SQLite. The deployment does not run migrations or reset the reference library.

## Explicit limitation: no automated forum collection yet

This release provides configured source lists, manual curation, review and visualization. **It does not scrape Reddit, forums, websites or call AI to fabricate sentiment.** Authorized adapters, scheduled collection, source-to-observation verification and a quantitative/qualitative pipeline are deferred to v0.9.1 with separate compliance and workload controls. Configure a source URL today, but expect a score only after direct reviewed observations or an explicitly labeled override.

## Production acceptance checklist

1. Run the established DirectAdmin `deploy.sh` on the packaged ZIP, preserving `.env`, SQLite, Neo4j and `/api/` proxy.
2. Verify ordinary graph navigation with Signals **off**; compare latency, position and expansion behavior to v0.8.2.
3. Admin configures a non-reference test Target; set parent on, add inherited Stream and Problem, verify effective sources and disabled child behavior.
4. Add a **draft** observation; confirm no node score. Mark reviewed; confirm graph ring changes without graph reset. Revoke review; confirm score disappears.
5. Set an admin override, add observations and verify locked score remains unchanged; unlock and confirm recomputation. Test source URL validation and cross-target ID denial.
6. Review a concept with two rated factors: chart must render the two points and missing axes without fictitious minimums or a closed polygon. Check a legacy 1–5 saved evaluation is labeled as normalized.
7. Link a concept to an appropriately configured Problem with a reviewed factor-specific observation. Check separate radar overlay, source links and summary; toggle it off to remove only that layer.
8. Verify normal non-admin accounts cannot modify signal settings and target isolation remains enforced.
9. Do not confuse a rollback of code/static assets with Neo4j data restoration. Arrange a Neo4j backup before relying on any permanent source settings.

**Validation limit:** Offline contract tests and TSX syntax checks can run here. Full `npm run build`, a live Neo4j integration check, and browser interaction must be performed in the deployment environment; do not claim they passed without running them.
