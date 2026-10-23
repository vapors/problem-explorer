# v0.6.2 Compatibility Restore (Local Testing Only)

Restores access to the prior research, AI discovery, semantic problem search, concepts, solution matching, and concept evaluation interface through a new **Research, concepts & matching** button in the signed-in account strip.

**IMPORTANT:** The old tool endpoints remain connected to the legacy/shared research graph and **are not scoped to a selected target**. This patch fixes navigation loss only; it does not satisfy the target-scoped research architecture. Avoid entering confidential or target-specific information in these tools until the corresponding API services enforce `target_id` ownership and filtering. Target graph and wizard are preserved.

## Upgrade

Back up your current source and `.env`; extract to your local development folder without overwriting `.env`, auth SQLite, or Neo4j files. Run `npm ci && npm run build` from `apps/web` and test the flows. Do not deploy this candidate to production.

## Next development milestone

Refactor problem, research, concept, matching, evaluation, and discovery API schemas to include `target_id`, verify permissions and ownership in every handler, migrate existing private records carefully, and then replace the compatibility switch with integrated sidebar navigation.

Backend Python syntax checked. Frontend build not verified in this environment.
