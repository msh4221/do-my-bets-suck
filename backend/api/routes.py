"""
FastAPI routes for the betting hypothesis tester.
"""

import os
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.schemas import (
    StrategyInput,
    BacktestResults,
    NarratedResults,
    OptimizerRequest,
    OptimizerResponse,
    OptimizedStrategyResult,
    MonteCarloProjection,
    MonteCarloRequest,
    ComparisonRequest,
    ComparisonResult,
    ComparisonResponse,
    Market,
    BetSide,
    Filter,
    Operator,
)
from backend.data_sources import NFLKaggleSource
from backend.engine import run_backtest, run_optimizer, run_monte_carlo
from backend.llm import (
    sanitize_input,
    verify_strategy_json,
    generate_simple_summary,
    GuardrailError,
)


# Initialize app
app = FastAPI(
    title="Do My Bets Suck",
    description="Test your NFL betting hypotheses against historical data",
    version="0.1.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Data source (loaded once)
PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_PATH = PROJECT_ROOT / "data" / "nfl.db"
data_source: Optional[NFLKaggleSource] = None


def get_data_source() -> NFLKaggleSource:
    global data_source
    if data_source is None:
        if not DB_PATH.exists():
            raise HTTPException(500, "Database not found. Run scripts/ingest_data.py first.")
        data_source = NFLKaggleSource(db_path=DB_PATH)
    return data_source


# Request/Response models

class HypothesisRequest(BaseModel):
    hypothesis: str


class ParseResponse(BaseModel):
    strategy: Optional[StrategyInput] = None
    questions: Optional[list[dict]] = None
    error: Optional[str] = None


class BacktestRequest(BaseModel):
    strategy: StrategyInput
    include_bets: bool = False


class BacktestResponse(BaseModel):
    results: BacktestResults
    summary: str


class HealthResponse(BaseModel):
    status: str
    seasons_available: tuple[int, int]
    total_games: int


# Routes

@app.get("/health", response_model=HealthResponse)
def health_check():
    """Check if the service is running and data is loaded."""
    source = get_data_source()
    seasons = source.get_season_range()
    games = source.get_games()
    return HealthResponse(
        status="ok",
        seasons_available=seasons,
        total_games=len(games),
    )


@app.get("/fields")
def get_available_fields():
    """Get list of fields available for filtering."""
    source = get_data_source()
    return {"fields": source.get_available_fields()}


@app.post("/parse", response_model=ParseResponse)
async def parse_hypothesis(request: HypothesisRequest):
    """
    Parse a natural language hypothesis into a Strategy JSON.

    For MVP, this does basic parsing without LLM.
    Full LLM parsing requires Anthropic API key.
    """
    try:
        cleaned = sanitize_input(request.hypothesis)
    except GuardrailError as e:
        return ParseResponse(error=str(e))

    # MVP: Return a template strategy for the user to customize
    # Full version would use LLM to parse
    return ParseResponse(
        strategy=None,
        questions=[
            {"question": "What market do you want to bet?", "field": "market", "options": ["spread", "total", "moneyline"]},
            {"question": "Which side do you want to bet?", "field": "bet_side", "options": ["home", "away", "favorite", "underdog", "over", "under"]},
        ],
        error=None,
    )


@app.post("/backtest", response_model=BacktestResponse)
def run_strategy_backtest(request: BacktestRequest):
    """
    Execute a backtest for the given strategy.
    """
    source = get_data_source()

    results = run_backtest(
        strategy=request.strategy,
        data_source=source,
        include_bet_details=request.include_bets,
    )

    summary = generate_simple_summary(results)

    return BacktestResponse(results=results, summary=summary)


@app.post("/test-quick")
def quick_test(
    market: str = "spread",
    bet_side: str = "underdog",
    home_only: bool = False,
):
    """
    Quick test endpoint for common strategies.
    """
    from backend.schemas import Filter, Operator, Market, BetSide

    filters = []
    if home_only:
        if bet_side == "underdog":
            filters.append(Filter(field="home_favorite", operator=Operator.EQ, value=False))
        elif bet_side == "favorite":
            filters.append(Filter(field="home_favorite", operator=Operator.EQ, value=True))

    strategy = StrategyInput(
        name=f"Quick Test: {bet_side} {market}",
        description=f"Betting {bet_side} on {market}",
        market=Market(market),
        bet_side=BetSide(bet_side),
        filters=filters,
        season_start=2000,
        season_end=2017,
    )

    source = get_data_source()
    results = run_backtest(strategy, source, include_bet_details=False)
    summary = generate_simple_summary(results)

    return {"results": results, "summary": summary}


@app.post("/optimize", response_model=OptimizerResponse)
def optimize_strategy(request: OptimizerRequest):
    """
    Find optimal betting strategy parameters using K-fold cross-validation.

    Searches across parameter combinations and ranks by Sharpe ratio.
    Optionally runs Monte Carlo projections on top strategies.
    """
    source = get_data_source()

    try:
        market = Market(request.market)
    except ValueError:
        raise HTTPException(400, f"Invalid market: {request.market}. Must be spread, total, or moneyline.")

    results, tested, total = run_optimizer(
        market=market,
        data_source=source,
        season_start=request.season_start,
        season_end=request.season_end,
        n_folds=request.n_folds,
        min_bets=request.min_bets,
        max_combinations=request.max_combinations,
        top_n=request.top_n,
        filter_config=request.filter_config,
    )

    # Convert to response schema with optional Monte Carlo
    strategies = []
    for r in results:
        projection = None
        if request.run_monte_carlo and r.bet_profits and len(r.bet_profits) >= 10:
            mc_result = run_monte_carlo(
                historical_profits=r.bet_profits,
                historical_results=r.bet_results,
                n_simulations=request.monte_carlo_simulations,
                bets_per_simulation=request.monte_carlo_bets,
            )
            projection = MonteCarloProjection(
                n_simulations=mc_result.n_simulations,
                bets_per_simulation=mc_result.bets_per_simulation,
                probability_of_profit=mc_result.probability_of_profit,
                roi_median=mc_result.roi_median,
                roi_5th_percentile=mc_result.roi_5th_percentile,
                roi_25th_percentile=mc_result.roi_25th_percentile,
                roi_75th_percentile=mc_result.roi_75th_percentile,
                roi_95th_percentile=mc_result.roi_95th_percentile,
                profit_median=mc_result.profit_median,
                profit_5th_percentile=mc_result.profit_5th_percentile,
                profit_95th_percentile=mc_result.profit_95th_percentile,
                max_drawdown_median=mc_result.max_drawdown_median,
                max_drawdown_95th_percentile=mc_result.max_drawdown_95th_percentile,
                win_rate_median=mc_result.win_rate_median,
                win_rate_5th_percentile=mc_result.win_rate_5th_percentile,
                win_rate_95th_percentile=mc_result.win_rate_95th_percentile,
                kelly_fraction=mc_result.kelly_fraction,
                kelly_half=mc_result.kelly_half,
                risk_of_ruin_25=mc_result.risk_of_ruin_25,
                risk_of_ruin_50=mc_result.risk_of_ruin_50,
                expected_value_per_bet=mc_result.expected_value_per_bet,
                avg_max_losing_streak=mc_result.avg_max_losing_streak,
                worst_losing_streak_95th=mc_result.worst_losing_streak_95th,
            )

        strategies.append(OptimizedStrategyResult(
            name=r.name,
            market=r.market,
            bet_side=r.bet_side,
            filters_description=r.filters_description,
            total_bets=r.total_bets,
            wins=r.wins,
            losses=r.losses,
            pushes=r.pushes,
            win_rate_pct=r.win_rate_pct,
            roi_pct=r.roi_pct,
            sharpe_ratio=r.sharpe_ratio,
            train_roi_pct=r.train_roi_pct,
            validation_roi_pct=r.validation_roi_pct,
            train_sharpe=r.train_sharpe,
            validation_sharpe=r.validation_sharpe,
            filters=r.filters,
            projection=projection,
        ))

    return OptimizerResponse(
        strategies=strategies,
        combinations_tested=tested,
        total_combinations=total,
        market=request.market,
        message=f"Found {len(strategies)} strategies meeting criteria from {tested} tested combinations."
    )


@app.post("/monte-carlo", response_model=MonteCarloProjection)
def run_strategy_monte_carlo(request: MonteCarloRequest):
    """
    Run Monte Carlo simulation on a specific strategy.

    Returns probability of profit, ROI confidence intervals, and risk metrics.
    """
    source = get_data_source()

    try:
        market = Market(request.market)
        bet_side = BetSide(request.bet_side)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Convert filters from dicts to Filter objects
    filters = []
    for f in request.filters:
        filters.append(Filter(
            field=f['field'],
            operator=Operator(f['operator']),
            value=f['value']
        ))

    # Run backtest to get bet data
    strategy = StrategyInput(
        name="Monte Carlo Strategy",
        description="",
        market=market,
        bet_side=bet_side,
        filters=filters,
        season_start=request.season_start,
        season_end=request.season_end,
    )
    results = run_backtest(strategy, source, include_bet_details=True)

    if results.total_bets < 10:
        raise HTTPException(400, "Not enough historical bets to run simulation (need at least 10)")

    profits = [b.profit for b in results.bets]
    bet_results = [b.result for b in results.bets]

    mc_result = run_monte_carlo(
        historical_profits=profits,
        historical_results=bet_results,
        n_simulations=request.n_simulations,
        bets_per_simulation=request.bets_per_simulation,
    )

    return MonteCarloProjection(
        n_simulations=mc_result.n_simulations,
        bets_per_simulation=mc_result.bets_per_simulation,
        probability_of_profit=mc_result.probability_of_profit,
        roi_median=mc_result.roi_median,
        roi_5th_percentile=mc_result.roi_5th_percentile,
        roi_25th_percentile=mc_result.roi_25th_percentile,
        roi_75th_percentile=mc_result.roi_75th_percentile,
        roi_95th_percentile=mc_result.roi_95th_percentile,
        profit_median=mc_result.profit_median,
        profit_5th_percentile=mc_result.profit_5th_percentile,
        profit_95th_percentile=mc_result.profit_95th_percentile,
        max_drawdown_median=mc_result.max_drawdown_median,
        max_drawdown_95th_percentile=mc_result.max_drawdown_95th_percentile,
        win_rate_median=mc_result.win_rate_median,
        win_rate_5th_percentile=mc_result.win_rate_5th_percentile,
        win_rate_95th_percentile=mc_result.win_rate_95th_percentile,
        kelly_fraction=mc_result.kelly_fraction,
        kelly_half=mc_result.kelly_half,
        risk_of_ruin_25=mc_result.risk_of_ruin_25,
        risk_of_ruin_50=mc_result.risk_of_ruin_50,
        expected_value_per_bet=mc_result.expected_value_per_bet,
        avg_max_losing_streak=mc_result.avg_max_losing_streak,
        worst_losing_streak_95th=mc_result.worst_losing_streak_95th,
    )


@app.post("/compare", response_model=ComparisonResponse)
def compare_strategies(request: ComparisonRequest):
    """
    Compare multiple strategies side-by-side using Monte Carlo projections.

    Returns projections for each strategy and a recommendation.
    """
    source = get_data_source()

    comparisons = []
    best_strategy = None
    best_prob_profit = -1

    for strat_req in request.strategies:
        try:
            market = Market(strat_req.market)
            bet_side = BetSide(strat_req.bet_side)
        except ValueError as e:
            continue

        # Convert filters
        filters = []
        for f in strat_req.filters:
            filters.append(Filter(
                field=f['field'],
                operator=Operator(f['operator']),
                value=f['value']
            ))

        # Run backtest
        strategy = StrategyInput(
            name="Comparison Strategy",
            description="",
            market=market,
            bet_side=bet_side,
            filters=filters,
            season_start=strat_req.season_start,
            season_end=strat_req.season_end,
        )
        results = run_backtest(strategy, source, include_bet_details=True)

        if results.total_bets < 10:
            continue

        profits = [b.profit for b in results.bets]
        bet_results = [b.result for b in results.bets]

        mc_result = run_monte_carlo(
            historical_profits=profits,
            historical_results=bet_results,
            n_simulations=request.n_simulations,
            bets_per_simulation=request.bets_per_simulation,
        )

        projection = MonteCarloProjection(
            n_simulations=mc_result.n_simulations,
            bets_per_simulation=mc_result.bets_per_simulation,
            probability_of_profit=mc_result.probability_of_profit,
            roi_median=mc_result.roi_median,
            roi_5th_percentile=mc_result.roi_5th_percentile,
            roi_25th_percentile=mc_result.roi_25th_percentile,
            roi_75th_percentile=mc_result.roi_75th_percentile,
            roi_95th_percentile=mc_result.roi_95th_percentile,
            profit_median=mc_result.profit_median,
            profit_5th_percentile=mc_result.profit_5th_percentile,
            profit_95th_percentile=mc_result.profit_95th_percentile,
            max_drawdown_median=mc_result.max_drawdown_median,
            max_drawdown_95th_percentile=mc_result.max_drawdown_95th_percentile,
            win_rate_median=mc_result.win_rate_median,
            win_rate_5th_percentile=mc_result.win_rate_5th_percentile,
            win_rate_95th_percentile=mc_result.win_rate_95th_percentile,
            kelly_fraction=mc_result.kelly_fraction,
            kelly_half=mc_result.kelly_half,
            risk_of_ruin_25=mc_result.risk_of_ruin_25,
            risk_of_ruin_50=mc_result.risk_of_ruin_50,
            expected_value_per_bet=mc_result.expected_value_per_bet,
            avg_max_losing_streak=mc_result.avg_max_losing_streak,
            worst_losing_streak_95th=mc_result.worst_losing_streak_95th,
        )

        # Build description
        desc = f"{strat_req.bet_side.title()} {strat_req.market}"
        if strat_req.filters:
            desc += f" ({len(strat_req.filters)} filters)"

        comparison = ComparisonResult(
            name=desc,
            filters_description=desc,
            historical_roi=results.roi_pct,
            historical_win_rate=results.win_rate_pct,
            projection=projection,
        )
        comparisons.append(comparison)

        if mc_result.probability_of_profit > best_prob_profit:
            best_prob_profit = mc_result.probability_of_profit
            best_strategy = desc

    if not comparisons:
        raise HTTPException(400, "No valid strategies to compare")

    recommendation = f"Based on {request.bets_per_simulation} simulated bets, "
    if best_strategy:
        recommendation += f"'{best_strategy}' has the highest probability of profit ({best_prob_profit}%)."
    else:
        recommendation += "no clear winner emerged."

    return ComparisonResponse(
        comparisons=comparisons,
        bets_per_simulation=request.bets_per_simulation,
        recommendation=recommendation,
    )
