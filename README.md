# Do My Bets Suck?

Test your NFL betting hypotheses against historical data with Monte Carlo simulation and Kelly Criterion analysis.

## Features

- **Strategy Backtesting**: Test betting strategies against 25 years of NFL data (1999-2023)
- **Strategy Optimizer**: Find optimal parameters using K-fold cross-validation
- **Monte Carlo Projections**: Simulate future performance with confidence intervals
- **Kelly Criterion**: Calculate optimal bet sizing based on historical edge
- **Risk Analysis**: Risk of ruin, max drawdown, and losing streak projections
- **Strategy Comparison**: Compare multiple strategies side-by-side

## Quick Start

### 1. Install Python dependencies
```bash
pip install -r requirements.txt
pip install nflreadpy  # For NFL data
```

### 2. Ingest the data
```bash
python scripts/ingest_nflverse_data.py
```
This downloads 6,706 NFL games (1999-2023) with complete betting lines from nflverse.

### 3. Start the backend
```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

### 4. Start the frontend (in a new terminal)
```bash
cd frontend
npm install
npm run dev
```

### 5. Open http://localhost:3000

## Project Structure

```
do-my-bets-suck/
├── backend/
│   ├── api/          # FastAPI routes
│   ├── schemas/      # Pydantic models (Strategy, Results, Optimizer)
│   ├── engine/       # Backtest, optimizer, Monte Carlo logic
│   ├── data_sources/ # Data adapters (nflverse)
│   └── llm/          # LLM parsing & guardrails
├── frontend/         # Next.js app
│   └── app/
│       ├── page.js         # Home - quick strategy tester
│       └── optimizer/      # Strategy optimizer with Monte Carlo
├── data/
│   └── nfl.db        # SQLite database (generated)
├── scripts/
│   └── ingest_nflverse_data.py  # Data ingestion script
└── tests/            # Test fixtures
```

## Data

- **Source**: [nflverse](https://github.com/nflverse/nflverse-data) via nflreadpy
- **Range**: 1999-2023 (6,706 games)
- **Includes**:
  - Spreads, totals, moneylines with odds
  - Game results and scores
  - Temperature and wind conditions
  - Stadium information

## API Endpoints

### Health & Info
- `GET /health` - Check service status and data availability
- `GET /fields` - List filterable fields

### Backtesting
- `POST /backtest` - Run a full strategy backtest
- `POST /test-quick` - Quick test common strategies

### Optimizer
- `POST /optimize` - Find optimal strategy parameters with cross-validation
- `POST /monte-carlo` - Run Monte Carlo simulation on a strategy
- `POST /compare` - Compare multiple strategies side-by-side

## Example: Using the Optimizer

```bash
curl -X POST "http://localhost:8000/optimize" \
  -H "Content-Type: application/json" \
  -d '{
    "market": "spread",
    "season_start": 2000,
    "season_end": 2023,
    "n_folds": 5,
    "min_bets": 50,
    "top_n": 5,
    "run_monte_carlo": true,
    "monte_carlo_simulations": 10000,
    "monte_carlo_bets": 100
  }'
```

Returns top strategies with:
- Historical ROI and win rate
- K-fold validation metrics (train vs validation performance)
- Monte Carlo projections (probability of profit, confidence intervals)
- Kelly Criterion bet sizing recommendations
- Risk of ruin analysis

## Example Strategy JSON

```json
{
  "name": "Big Underdogs ATS",
  "market": "spread",
  "bet_side": "underdog",
  "filters": [
    {"field": "spread_line", "operator": ">=", "value": 7.0},
    {"field": "spread_line", "operator": "<=", "value": 14.0}
  ],
  "season_start": 2000,
  "season_end": 2023
}
```

## Tech Stack

- **Backend**: Python, FastAPI, SQLite, Pandas
- **Frontend**: Next.js, React, Recharts
- **Data**: nflverse (nflreadpy)
- **Analysis**: Bootstrap Monte Carlo, Kelly Criterion, K-fold CV

## License

Personal project for NFL betting analysis.
