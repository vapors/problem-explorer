# Problem Explorer — native local development (no Docker)

Run React/Vite + FastAPI locally against an isolated Neo4j instance. Do not connect the local backend to production Neo4j or reuse production credentials.

## Prerequisites

- Git; Node.js 22 LTS (or another version compatible with this project's Vite version) and npm
- Python 3.12
- Neo4j Community installed locally and running on 127.0.0.1:7687 (Neo4j Browser optional at 127.0.0.1:7474)
- An independent local Neo4j password/database; optional separate, budget-limited OpenAI API key

## Initial setup

Clone the repository and run these commands from its root:

```bash
cp .env.example .env
```

Edit `.env` and set (never commit actual values):

```dotenv
NEO4J_URI=bolt://127.0.0.1:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=YOUR_LOCAL_NEO4J_PASSWORD
NEO4J_DATABASE=neo4j
DATA_FILE=ABSOLUTE_PATH_TO_REPO/data/problems.csv
AUTO_SEED=true
CORS_ORIGINS=http://localhost:5173
OPENAI_API_KEY=
```

Use a **local** database instance, not production. The first launch seeds the 498 original problem records. Afterwards, switch `AUTO_SEED=false` for normal development, so the original records aren't rewritten on each restart. The dataset is source-controlled; the live database and its additions are not.

### Backend — Terminal A

```bash
cd apps/api
python3.12 -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
# from apps/api: adjust the path to the .env in the repository root
python -m uvicorn app.main:app --reload --host 127.0.0.1 --port 8000 --env-file ../../.env
```

Test `http://127.0.0.1:8000/api/health`.

### Frontend — Terminal B

```bash
cd apps/web
npm ci
npm run dev
```

Visit `http://localhost:5173`. Existing `vite.config.ts` forwards `/api` to `http://localhost:8000`.

## GitHub preparation

The repository root is `problem-explorer/`, **not** the outer `explorer.pixelandpiece.com/` server folder. Copy `.gitignore` into `problem-explorer/` before `git init`. Keep `apps/web/package-lock.json` checked in for repeatable installs. The existing `docker-compose.yml` and Dockerfiles can remain as optional developer documentation; they do not affect production unless explicitly invoked.

```bash
git init
git add .
git status --short
# Review staged file names carefully; ensure no .env, virtual environment, node_modules, dist, logs, dumps or server backup files
git diff --cached --name-only
git commit -m "Initial Problem Explorer source"
git branch -M main
git remote add origin git@github.com:YOUR_ACCOUNT/problem-explorer.git
git push -u origin main
```

If secrets have ever been committed, `.gitignore` does not remove them from history. Rotate leaked credentials and clean history before pushing.

## Deployment separation

- Develop and test locally.
- Commit/push changes to GitHub.
- On VPS, make a release backup; pull or copy only reviewed application source; rebuild React; copy `apps/web/dist/.` into the domain `public_html`; restart only `problem-explorer` if backend code changed.
- Never pull `.env` or overwrite the live database. Do not run local experiments against the production `bolt://` endpoint.
- Ensure publicly accessible API mutation/AI endpoints have appropriate access controls before removing production authentication.
