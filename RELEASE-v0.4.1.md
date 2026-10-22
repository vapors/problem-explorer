# Problem Explorer v0.4.1 — problem details and user indexing

## Corrections
- Fix invalid Cypher WHERE clause in GET /api/problems/{pid} (previously returned Internal Server Error).
- Allow every authenticated user to request semantic indexing; index batches count toward the existing daily AI request quota.
- Restrict indexing and index status to shared problems plus problems owned by the signed-in user.
- Reduce manual index batches to 20 records, limiting cost per action.
- Allow manually created and approved discovered problems even when existing records have no embeddings. Duplicate screening still compares text and available semantic matches.
- Remove unmetered automatic backfill from discovery approval. Users can trigger indexing from the interface.

## Windows local update
1. Stop the development servers. Back up your application source and SQLite authentication database and Neo4j database.
2. Extract the archive over the application source, but **do not overwrite your .env**, database files, or other local configuration.
3. In apps/web, run `npm ci` if dependencies are not installed, followed by `npm run build`.
4. Restart using `start-dev.cmd`. Sign in and test problem detail, manual problem creation, and semantic indexing.
5. Test that records created by one user cannot be read by another user's session.

## Production
Do not publish until verified locally. Preserve production .env, SQLite accounts, Neo4j storage, nginx/DirectAdmin configuration, and authentication. Roll back by restoring the previous source and frontend build (not the data stores).

## Verification
Python source compilation passed. No integration test against the local Neo4j and external embedding API was performed here. Frontend build requires installed npm dependencies.
