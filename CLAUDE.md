# Do My Bets Suck

Personal NFL betting hypothesis tester.

## Core Architecture
- **LLM translates** user hypothesis → Strategy JSON
- **Engine executes** deterministic backtest
- **LLM narrates** results (cannot modify numbers)

## Tech Stack
- Backend: Python + FastAPI + SQLite
- Frontend: Next.js
- LLM: Claude API

## Key Principles
- LLM never touches math, only text/structure/explanation
- All backtests are deterministic and reproducible
- Strategy JSON is validated against schema before execution

## Project-Specific Rules
- Do not commit changes - review in GitHub Desktop first
- When adding new data sources, implement the base.py interface
- All betting logic must have unit tests
