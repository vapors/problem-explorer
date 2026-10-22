# Problem Explorer · v0.1.0

A runnable, local-first longevity design research platform built with **Neo4j, FastAPI, React, Cytoscape.js, OpenAI Responses API, and Structured Outputs**. Contains all **498** original Stanford × LSE problem statements, **40** subcategories and **4** streams. Includes an interactive graph, searchable library, on-demand research, saved solutions, AI-suggested problem matching, and five-factor concept evaluation.

> **Prototype / research software.** AI-generated sources and claims are always stored as `needs_review`, because structured extraction is not independent verification. Ratings are provisional design judgments. This application is not a medical device or medical advice.

## Quick start · Docker Desktop / Docker Engine

Requirements: Docker Engine/Compose v2 (or Docker Desktop) and a free port 8080. No Python/Node installation required for this path.

```bash
unzip longevity-atlas-v0.1.0.zip
cd longevity-atlas
cp .env.example .env
# Edit .env: replace NEO4J_PASSWORD with a long, strong password
# Optionally set OPENAI_API_KEY for AI features
# NEVER put secrets in your browser JavaScript.
docker compose up -d --build
docker compose logs -f api
```

**Open http://localhost:8080**. Neo4j Browser is available at **http://localhost:7474** from the same computer only. Login: `neo4j` + the password in `.env`.

The importer runs idempotently on API startup. Initial Neo4j setup can take a minute. Check:

```bash
curl http://localhost:8080/api/health
# expected: problemCount 498, neo4j true
```

Docker commands:

```bash
docker compose ps
docker compose logs -f
docker compose restart api
docker compose down             # keeps data volumes
docker compose down -v          # DANGER: destroys the Neo4j database
```

## OpenAI key and structured research

Set `OPENAI_API_KEY` in `.env`, restart the backend with `docker compose up -d --force-recreate api`.

- **Problem research**: calls the OpenAI Responses API with `web_search` to obtain research notes; then passes those notes to a **Pydantic-enforced Structured Outputs** parse. Each record includes source URL, title, publication date, population, claim, statistic, limitations, and confidence.
- **Concept matching**: local token-based candidate retrieval from the 498 statements, then OpenAI Structured Outputs classify candidate `problem_id`, relationship (`direct`, `partial`, `indirect`, etc.), 0–100 *relevance* (not efficacy), reasoning, assumptions, confidence.
- **Concept evaluation**: Structured Outputs with exactly five factors: desirability, feasibility, viability, impact, coverage. Each has a nullable 1–5 score, confidence, rationale, evidence URLs, and unanswered questions. This allows unknowns instead of fabricated values.
- Each response is validated by Pydantic **before** graph persistence. IDs are checked against existing records. Research and evaluations are timestamped and kept in Neo4j.
- Search results may include URLs that are stale, misattributed, or not substantively supportive. **v0.1 does not independently download and verify every source page**. All generated findings remain `needs_review`, and nothing is labeled externally verified.
- *Search costs API credits*. OpenAI API billing is separate from ChatGPT subscriptions. Model availability and `web_search` support depend on your API account; edit `.env` models if needed.

### Structured response schemas

Defined and versionable in `apps/api/app/schemas.py`:

- `ResearchResult` → `SourceClaim[]`, gaps, conflicts, follow-up questions
- `MatchingResult` → `ProblemMatch[]`, missing information
- `EvaluationResult` → `FactorRating[]`, assumptions, risks, next research

The OpenAI backend functions are in `apps/api/app/ai.py`. Schema changes may require prompt updates. Sources and findings are stored separately; one source can back multiple findings.

## Local development with a Python virtual environment

Docker is recommended for Neo4j even when developing the Python app inside a venv:

```bash
docker compose up -d neo4j
cd apps/api
python3 -m venv .venv
source .venv/bin/activate     # Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cd ../..
export NEO4J_URI=bolt://localhost:7687
export NEO4J_USER=neo4j
export NEO4J_PASSWORD='YOUR_PASSWORD_FROM_DOTENV'
export DATA_FILE="$PWD/data/problems.csv"
export OPENAI_API_KEY='YOUR_KEY_IF_USING_AI'
export CORS_ORIGINS='http://localhost:5173'
cd apps/api
uvicorn app.main:app --reload --port 8000
```

In another terminal:

```bash
cd apps/web
npm install
npm run dev
```

For local Vite development, `/api/` is proxied to `http://localhost:8000` (see `vite.config.ts`). Open http://localhost:5173.

## REST API quick reference

| Route | Purpose |
|---|---|
| `GET /api/health` | Backend readiness and AI key status |
| `GET /api/stats` | Stream counts |
| `GET /api/hierarchy` | Stream → category hierarchy |
| `GET /api/graph/root` | Root graph |
| `GET /api/graph/expand/{id}` | Progressive node expansion (`S1`, `S1:1A`, `P37`) |
| `GET /api/problems?q=...&stream=S1` | Search/filter original problems |
| `GET /api/problems/{id}` | Problem and saved findings |
| `POST /api/problems/{id}/research` | Web search + structured finding extraction |
| `POST /api/solutions` | Save concept |
| `GET /api/solutions` | List concepts |
| `GET /api/solutions/{id}` | Linked problems and past evaluations |
| `POST /api/solutions/{id}/match` | Find suggested relationships |
| `POST /api/solutions/{id}/evaluate` | Five-factor evaluation |

Interactive API specification: http://localhost:8000/docs when running backend directly (API is not directly exposed by Docker; `/api/` is reverse proxied through web).

## Files and modules

```text
longevity-atlas/
  apps/api/app/
    ai.py           research, matches and evaluation prompts
    schemas.py      validated OpenAI structured schemas
    db.py           Neo4j driver and queries
    seed.py         idempotent CSV importer and constraints
    main.py         FastAPI routes and persistence
  apps/web/src/
    main.tsx        Graph explorer, research and evaluation UI
    style.css       Responsive dark interface
  data/problems.csv  498 problem records, stable IDs
  deploy/directadmin/README.md
  docker-compose.yml
  .env.example
```

## DirectAdmin VPS deployment

See **`deploy/directadmin/README.md`**. Docker Compose runs on the VPS, and your DirectAdmin-supported Nginx/Apache customization can reverse proxy the app from `127.0.0.1:8080` through HTTPS. This is a **single-user prototype without login/authentication**; **do not expose it to the public Internet without an access gateway (HTTP auth, VPN, or SSO)**. The app and database should not run as publicly accessible open endpoints.

### Known boundaries for v0.1

- The initial graph is a browsable hierarchy. AI-suggested cross-stream semantic edge visualization, evidence review approvals, automatic paper-text verification, shared accounts, real vector search, deduplicated research jobs, configurable weighted scoring, and detailed factor evidence drilldowns are planned future iterations.
- Local candidate matching uses keyword token recall before the structured AI classification step. It can miss conceptual synonyms; vector embeddings and hybrid retrieval are recommended for v0.2.
- The radar chart plots unrated factors at the origin for visualization only; the underlying score remains `null`.
- Research search calls can take a while; the v0.1 synchronous request implementation should be replaced with a background job queue before high-volume deployment.
- No built-in concurrency limits, request authentication, billing caps, or automated backups. Use a private deployment.

## License / content

Problem descriptions originate from the user-created Master Longevity Problem Library. This package is a project prototype for local experimentation. Before commercial or public use, add an explicit license and confirm rights for any later-attached research documents.

## v0.2.0 discovery upgrade

See [UPGRADE-v0.2.md](UPGRADE-v0.2.md) for safe upgrade steps, hybrid search, embeddings, AI problem discovery, review/approval, duplication checks, and persistence of accepted problems in Neo4j.


## v0.3 Concept Generation
See `UPGRADE-v0.3.md` for installation and endpoints. Generate drafts from Problem research; review before saving to Solutions and evaluating.
