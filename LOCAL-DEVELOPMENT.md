# Problem Explorer — local setup

The maintained **Windows/Python 3.12/Neo4j** development guide is [`docs/LOCAL-WINDOWS.md`](docs/LOCAL-WINDOWS.md).

From PowerShell at the project root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\setup-local.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\test-local.ps1
```

To launch the local Vite + FastAPI + Neo4j development environment, run `start-dev.cmd`. The scripts never reset/reseed local databases, overwrite `.env`, or use Python 3.14.
