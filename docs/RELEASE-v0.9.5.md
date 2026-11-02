# Problem Explorer v0.9.5 — Target Publication & Lens Defaults

This release updates **Target administration**, not research schema or evaluation methodology. It retains the v0.9.4.1 graph UI, concept badge interactions, account-scoped graph views, evaluation jobs and terminology lenses.

## What changed

`Administration → Targets` now exposes four separate properties of a Target:

| Setting | Neo4j property | Behavior |
|---|---|---|
| Public access | `shared` | Other authenticated accounts may read and copy the Target. Disabling immediately removes nonowner API access. For the system-owned Longevity reference, no ordinary account is the owner; administrators can restore sharing through Administration even while the reference is private. |
| Directory listing | `directoryVisible` | Whether a public Target appears in other users' shared library lists. Hidden but shared Targets remain accessible through an existing direct URL. |
| General featured | `featured` | One general featured shared and listed Target, used as a fallback when no lens-specific recommendation is configured. |
| Featured by lens | `featuredLenses` | A list of lens identifiers. Each lens can have at most one recommended shared and listed Target (managed transactionally). |

`reference` remains the independent immutable-protection flag for Target deletion. The system-seeded `reference-longevity` Target **can now be hidden or made private by an administrator without removing it or changing its protection**. Existing independently copied Targets are unaffected. No migration is necessary; missing legacy properties retain compatibility defaults (`directoryVisible=true`, `featured=false`, `featuredLenses=[]`).

### Known lenses

`classic`, `general_challenge`, `technical_engineering`, `industrial_design`. The API validates these keys; unknown lens queries fall back to Classic. Changing a terminology lens does not change a Target's stored hierarchy, research or evaluation semantics.

## Endpoints

- `GET /api/targets?lens=<lens-id>` — returns owned Targets, **listed and publicly shared** Targets, the resolved `defaultTargetId`, and the normalized lens ID. **Owned Targets remain listed regardless of their public-listing status.** Lens-specific featured assignments take precedence over general featured; no setting means `defaultTargetId: null`.
- `GET /api/admin/targets` — admin-only inventory including publication fields and existing ownership/protection/structure data.
- `PATCH /api/admin/targets/{id}/publication` — admin-only partial update. Accepts `shared`, `listed`, `featured`, and `featuredLenses`. A non-system private Target cannot be newly published by an unrelated admin: its owner must authorize initial public sharing. Hiding/unsharing also removes its featured flags. A newly assigned lens is cleared from any other Target within the same Neo4j transaction.
- Existing authenticated Target endpoints still verify owner or public sharing. Hiding **is not** authorization revocation; making private **is**.

No research nodes are moved into SQLite, no new Neo4j label is required, and there is no automatic deletion, reseed, or graph reset.

## Interface behavior

1. Administrators can toggle Public, Listed, General Featured and per-lens Featured independently (subject to visibility prerequisites).
2. When an account opens Problem Explorer, an owned Target is preferred. If the account has no owned Target, the featured shared Target for its saved lens is offered as a read-only workspace. If none is configured, the New Target wizard appears.
3. The wizard can also show a **Featured for this research lens** shortcut. Switching the lens updates this recommendation without discarding input or starting a new graph simulation. Changing lenses in an active workspace **does not** switch Targets automatically.
4. General or lens-specific recommendations must remain discoverable and publicly shared. Removing the shared flag makes the Target inaccessible to nonowners, but does not delete their previously made independent copies.

## Deploy with existing DirectAdmin toolkit

Upload `Problem-Explorer-v0.9.5-Target-Publication-Lenses.zip` to `/home/siteadmin/releases/`, then run:

```bash
APP=/home/siteadmin/domains/explorer.pixelandpiece.com/problem-explorer
sudo bash "$APP/deploy/directadmin/preflight.sh"
sudo bash "$APP/deploy/directadmin/deploy.sh" \
  /home/siteadmin/releases/Problem-Explorer-v0.9.5-Target-Publication-Lenses.zip
sudo bash "$APP/deploy/directadmin/healthcheck.sh"
```

The root-safe deployer runs the backend tests and frontend source contracts plus the Vite production build as `siteadmin` **before** publishing. It preserves `.env`, `auth.sqlite3`, the Python 3.12 virtualenv, Neo4j data and DirectAdmin configuration. **Do not run `bootstrap --reset-all` or reseed.** Back up SQLite and Neo4j independently before release. Code rollback cannot revert deliberate publication changes made after deploy; reapply those settings through the admin interface if necessary.

## Acceptance checklist

- [ ] Admin hides Longevity library: it disappears from a separate test user's directory; the node remains protected in admin inventory and Neo4j.
- [ ] Admin makes Longevity library private: a nonowner's direct API request no longer reads it. Existing independent copies remain usable.
- [ ] An eligible shared Target can be configured as the general default and a separate shared Target as the engineering lens default.
- [ ] A new test user with no owned Targets is directed to the appropriate shared read-only Target. Creating a new workspace remains possible.
- [ ] Changing the lens while researching refreshes recommendations but does not change the selected Target or rebuild amCharts.
- [ ] A private Target owned by another user cannot be published by an administrator without its owner's sharing decision.
- [ ] Unassigning a featured Target does not affect any research, findings, concepts, evaluation or saved graph views.

## Validation limits

Offline tests exercise API authorization, feature assignment, legacy property fallback and UI source contracts. Production Neo4j concurrency, the full npm build, and cross-account browser behavior must be checked in the deployed environment. No production database was accessed or changed in preparing this release.
