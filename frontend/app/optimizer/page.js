'use client'

import { useState } from 'react'
import Link from 'next/link'

const API_URL = 'http://127.0.0.1:8000'

export default function OptimizerPage() {
  const [market, setMarket] = useState('spread')
  const [seasonStart, setSeasonStart] = useState(2000)
  const [seasonEnd, setSeasonEnd] = useState(2017)
  const [minBets, setMinBets] = useState(50)
  const [monteCarloBets, setMonteCarloBets] = useState(100)

  // User-controlled search
  const [includeSpread, setIncludeSpread] = useState(true)
  const [includeTemp, setIncludeTemp] = useState(true)
  const [includeWind, setIncludeWind] = useState(true)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [progress, setProgress] = useState('')
  const [selectedStrategies, setSelectedStrategies] = useState(new Set())

  const runOptimizer = async () => {
    setLoading(true)
    setError(null)
    setResults(null)
    setProgress('Searching for optimal strategies and running Monte Carlo simulations...')

    try {
      const filterConfig = {
        include_spread: includeSpread,
        include_temperature: includeTemp,
        include_wind: includeWind,
      }

      const response = await fetch(`${API_URL}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market,
          season_start: seasonStart,
          season_end: seasonEnd,
          n_folds: 5,
          min_bets: minBets,
          max_combinations: 5000,
          top_n: 10,
          filter_config: filterConfig,
          run_monte_carlo: true,
          monte_carlo_simulations: 10000,
          monte_carlo_bets: monteCarloBets,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setResults(data)
      setProgress('')
    } catch (err) {
      setError(`Failed to run optimizer: ${err.message}`)
      setProgress('')
    } finally {
      setLoading(false)
    }
  }

  const toggleStrategySelection = (index) => {
    const newSelected = new Set(selectedStrategies)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedStrategies(newSelected)
  }

  const compareSelected = async () => {
    if (selectedStrategies.size < 2) {
      alert('Please select at least 2 strategies to compare')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const strategiesToCompare = Array.from(selectedStrategies).map(idx => {
        const strat = results.strategies[idx]
        return {
          market: strat.market,
          bet_side: strat.bet_side,
          filters: strat.filters,
          season_start: seasonStart,
          season_end: seasonEnd,
          n_simulations: 10000,
          bets_per_simulation: monteCarloBets,
        }
      })

      const response = await fetch(`${API_URL}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          strategies: strategiesToCompare,
          n_simulations: 10000,
          bets_per_simulation: monteCarloBets,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      const comparisonData = await response.json()

      // Show comparison in alert for now (could be a modal)
      alert(`Comparison Results:\n\n${comparisonData.recommendation}\n\n` +
        comparisonData.comparisons.map((c, i) =>
          `Strategy ${i + 1}: ${c.filters_description}\n` +
          `Historical ROI: ${c.historical_roi}%\n` +
          `Projected ROI: ${c.projection.roi_median}% (${c.projection.roi_5th_percentile}% to ${c.projection.roi_95th_percentile}%)\n` +
          `Probability of Profit: ${c.projection.probability_of_profit}%\n`
        ).join('\n')
      )
    } catch (err) {
      setError(`Comparison failed: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.pageContainer}>
      {/* Navigation */}
      <div style={styles.nav}>
        <Link href="/" style={styles.navLink}>
          ← Back to Strategy Tester
        </Link>
      </div>

      <div style={styles.container}>
        <h1 style={styles.title}>Strategy Optimizer</h1>
        <p style={styles.subtitle}>
          Find optimal betting parameters using K-fold cross-validation with Monte Carlo projections.
          Strategies are ranked by Sharpe ratio (risk-adjusted returns).
        </p>

        {/* Configuration Form */}
        <div style={styles.form}>
          <h2 style={styles.sectionTitle}>Configuration</h2>

          <div style={styles.row}>
            <div style={styles.field}>
              <label>Market Type</label>
              <select
                value={market}
                onChange={(e) => setMarket(e.target.value)}
                style={styles.select}
                disabled={loading}
              >
                <option value="spread">Spread (ATS)</option>
                <option value="total">Totals (O/U)</option>
                <option value="moneyline">Moneyline</option>
              </select>
            </div>
            <div style={styles.field}>
              <label>Minimum Bets</label>
              <input
                type="number"
                value={minBets}
                onChange={(e) => setMinBets(parseInt(e.target.value))}
                min={20}
                max={200}
                style={styles.input}
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label>Season Start</label>
              <input
                type="number"
                value={seasonStart}
                onChange={(e) => setSeasonStart(parseInt(e.target.value))}
                min={1967}
                max={2017}
                style={styles.input}
                disabled={loading}
              />
            </div>
            <div style={styles.field}>
              <label>Season End</label>
              <input
                type="number"
                value={seasonEnd}
                onChange={(e) => setSeasonEnd(parseInt(e.target.value))}
                min={1967}
                max={2017}
                style={styles.input}
                disabled={loading}
              />
            </div>
          </div>

          <div style={styles.field}>
            <label>Bets to Simulate (per Monte Carlo run)</label>
            <input
              type="number"
              value={monteCarloBets}
              onChange={(e) => setMonteCarloBets(parseInt(e.target.value))}
              min={50}
              max={500}
              step={50}
              style={styles.input}
              disabled={loading}
            />
            <div style={styles.hint}>Typical NFL season has ~100-150 games</div>
          </div>

          {/* User-Controlled Search */}
          <div style={styles.filterConfig}>
            <h3 style={styles.subsectionTitle}>Filter Search Configuration</h3>
            <div style={styles.checkboxGroup}>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={includeSpread}
                  onChange={(e) => setIncludeSpread(e.target.checked)}
                  disabled={loading}
                />
                Search across line ranges (spread/total)
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={includeTemp}
                  onChange={(e) => setIncludeTemp(e.target.checked)}
                  disabled={loading}
                />
                Search across temperature ranges
              </label>
              <label style={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={includeWind}
                  onChange={(e) => setIncludeWind(e.target.checked)}
                  disabled={loading}
                />
                Search across wind conditions
              </label>
            </div>
          </div>

          <div style={styles.infoBox}>
            <strong>How it works:</strong>
            <ul style={styles.infoList}>
              <li>Tests parameter combinations based on your search configuration</li>
              <li>Uses 5-fold cross-validation to prevent overfitting</li>
              <li>Runs Monte Carlo simulation ({monteCarloBets} bets × 10,000 iterations) on each top strategy</li>
              <li>Shows probability of profit, ROI confidence intervals, and Kelly Criterion bet sizing</li>
            </ul>
          </div>

          <button
            onClick={runOptimizer}
            disabled={loading}
            style={styles.button}
          >
            {loading ? 'Optimizing...' : 'Find Optimal Strategies'}
          </button>

          {progress && (
            <div style={styles.progress}>
              <div style={styles.spinner} />
              {progress}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div style={styles.error}>{error}</div>
        )}

        {/* Results */}
        {results && (
          <div style={styles.results}>
            <div style={styles.resultsHeader}>
              <h2 style={styles.sectionTitle}>
                Top Strategies for {results.market.toUpperCase()}
              </h2>
              {selectedStrategies.size > 0 && (
                <button onClick={compareSelected} style={styles.compareButton}>
                  Compare Selected ({selectedStrategies.size})
                </button>
              )}
            </div>
            <p style={styles.resultsMeta}>
              {results.message}
            </p>

            {results.strategies.length === 0 ? (
              <div style={styles.noResults}>
                No strategies found meeting your criteria. Try lowering the minimum bets threshold.
              </div>
            ) : (
              <div style={styles.strategiesGrid}>
                {results.strategies.map((strategy, index) => (
                  <StrategyCard
                    key={index}
                    strategy={strategy}
                    rank={index + 1}
                    selected={selectedStrategies.has(index)}
                    onToggleSelect={() => toggleStrategySelection(index)}
                    monteCarloBets={monteCarloBets}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function StrategyCard({ strategy, rank, selected, onToggleSelect, monteCarloBets }) {
  const [showDetails, setShowDetails] = useState(false)
  const isValidationProfit = strategy.validation_roi_pct > 0
  const projection = strategy.projection

  return (
    <div style={{
      ...styles.card,
      borderColor: selected ? '#0070f3' : '#e0e0e0',
      borderWidth: selected ? '2px' : '1px',
    }}>
      <div style={styles.cardHeader}>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          style={styles.checkbox}
        />
        <span style={styles.rank}>#{rank}</span>
        <span style={styles.cardTitle}>{strategy.filters_description}</span>
        <button
          onClick={() => setShowDetails(!showDetails)}
          style={styles.detailsToggle}
        >
          {showDetails ? '▼ Hide Details' : '▶ Show Details'}
        </button>
      </div>

      <div style={styles.cardBody}>
        {/* Historical Performance */}
        <div style={styles.section}>
          <h4 style={styles.sectionLabel}>Historical Performance</h4>
          <div style={styles.metricsRow}>
            <div style={styles.metricBox}>
              <span style={styles.metricLabel}>Sharpe Ratio</span>
              <span style={{
                ...styles.metricValue,
                color: strategy.validation_sharpe > 1 ? '#00aa00' :
                       strategy.validation_sharpe > 0 ? '#666' : '#aa0000'
              }}>
                {strategy.validation_sharpe.toFixed(2)}
              </span>
            </div>
            <div style={styles.metricBox}>
              <span style={styles.metricLabel}>Val. ROI</span>
              <span style={{
                ...styles.metricValue,
                color: isValidationProfit ? '#00aa00' : '#aa0000'
              }}>
                {strategy.validation_roi_pct > 0 ? '+' : ''}{strategy.validation_roi_pct}%
              </span>
            </div>
            <div style={styles.metricBox}>
              <span style={styles.metricLabel}>Total Bets</span>
              <span style={styles.metricValue}>{strategy.total_bets}</span>
            </div>
            <div style={styles.metricBox}>
              <span style={styles.metricLabel}>Win Rate</span>
              <span style={styles.metricValue}>{strategy.win_rate_pct}%</span>
            </div>
          </div>
        </div>

        {/* Monte Carlo Projection */}
        {projection && (
          <div style={styles.section}>
            <h4 style={styles.sectionLabel}>
              Future Projection ({monteCarloBets} simulated bets)
            </h4>

            {/* Probability of Profit - Hero Metric */}
            <div style={styles.heroProjection}>
              <div style={styles.probLabel}>Probability of Profit</div>
              <div style={{
                ...styles.probValue,
                color: projection.probability_of_profit >= 60 ? '#00cc00' :
                       projection.probability_of_profit >= 50 ? '#666' : '#cc0000'
              }}>
                {projection.probability_of_profit}%
              </div>
            </div>

            {/* ROI Confidence Interval */}
            <div style={styles.confidenceInterval}>
              <div style={styles.ciLabel}>ROI Confidence Interval (90%)</div>
              <div style={styles.ciBar}>
                <div style={styles.ciRange}>
                  <span style={styles.ciValue}>{projection.roi_5th_percentile}%</span>
                  <span style={styles.ciMedian}>
                    Median: {projection.roi_median}%
                  </span>
                  <span style={styles.ciValue}>{projection.roi_95th_percentile}%</span>
                </div>
                <div style={styles.ciBarVisual}>
                  <div style={{
                    ...styles.ciBarFill,
                    width: '80%',
                    marginLeft: '10%',
                    backgroundColor: projection.roi_median > 0 ? '#00aa00' : '#aa0000'
                  }} />
                </div>
              </div>
            </div>

            {/* Kelly Criterion */}
            <div style={styles.kellyBox}>
              <strong>📊 Bet Sizing (Kelly Criterion):</strong>
              <div style={styles.kellyValues}>
                <span>Full Kelly: <strong>{(projection.kelly_fraction * 100).toFixed(2)}%</strong> of bankroll</span>
                <span style={{marginLeft: '20px'}}>
                  Half Kelly (recommended): <strong>{(projection.kelly_half * 100).toFixed(2)}%</strong>
                </span>
              </div>
            </div>

            {showDetails && (
              <>
                {/* Additional Projection Metrics */}
                <div style={styles.detailsGrid}>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Expected Value/Bet:</span>
                    <span style={styles.detailValue}>
                      {projection.expected_value_per_bet > 0 ? '+' : ''}
                      {projection.expected_value_per_bet} units
                    </span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Max Drawdown (median):</span>
                    <span style={styles.detailValue}>{projection.max_drawdown_median} units</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Max Drawdown (95th %):</span>
                    <span style={styles.detailValue}>{projection.max_drawdown_95th_percentile} units</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Avg Max Losing Streak:</span>
                    <span style={styles.detailValue}>{projection.avg_max_losing_streak}</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Risk of Ruin (-25%):</span>
                    <span style={styles.detailValue}>{projection.risk_of_ruin_25}%</span>
                  </div>
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Risk of Ruin (-50%):</span>
                    <span style={styles.detailValue}>{projection.risk_of_ruin_50}%</span>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* Historical Train vs Validation */}
        {showDetails && (
          <div style={styles.section}>
            <h4 style={styles.sectionLabel}>Cross-Validation Details</h4>
            <div style={styles.comparison}>
              <div style={styles.comparisonItem}>
                <span style={styles.comparisonLabel}>Train</span>
                <span style={styles.comparisonValue}>
                  {strategy.train_roi_pct > 0 ? '+' : ''}{strategy.train_roi_pct}% ROI
                  <span style={styles.comparisonSharpe}>
                    (Sharpe: {strategy.train_sharpe.toFixed(2)})
                  </span>
                </span>
              </div>
              <div style={styles.comparisonItem}>
                <span style={styles.comparisonLabel}>Validation</span>
                <span style={{
                  ...styles.comparisonValue,
                  fontWeight: 'bold',
                  color: isValidationProfit ? '#00aa00' : '#aa0000'
                }}>
                  {strategy.validation_roi_pct > 0 ? '+' : ''}{strategy.validation_roi_pct}% ROI
                  <span style={styles.comparisonSharpe}>
                    (Sharpe: {strategy.validation_sharpe.toFixed(2)})
                  </span>
                </span>
              </div>
            </div>
            <div style={styles.record}>
              Record: {strategy.wins}-{strategy.losses}-{strategy.pushes}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  pageContainer: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
    padding: '20px',
  },
  nav: {
    marginBottom: '20px',
  },
  navLink: {
    color: 'white',
    textDecoration: 'none',
    fontSize: '14px',
    padding: '10px 15px',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: '6px',
    transition: 'background 0.2s',
  },
  container: {
    maxWidth: '1200px',
    margin: '0 auto',
  },
  title: {
    fontSize: '2.5rem',
    color: 'white',
    marginBottom: '10px',
    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.7)',
    marginBottom: '30px',
    fontSize: '1.1rem',
  },
  form: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
    marginBottom: '30px',
  },
  sectionTitle: {
    fontSize: '1.3rem',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#333',
  },
  subsectionTitle: {
    fontSize: '1.1rem',
    fontWeight: '600',
    marginBottom: '15px',
    color: '#555',
  },
  row: {
    display: 'flex',
    gap: '20px',
    marginBottom: '20px',
  },
  field: {
    flex: 1,
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    marginTop: '5px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '6px',
    marginTop: '5px',
    boxSizing: 'border-box',
  },
  hint: {
    fontSize: '12px',
    color: '#888',
    marginTop: '5px',
  },
  filterConfig: {
    backgroundColor: '#f8f9fa',
    padding: '20px',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  checkboxGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    cursor: 'pointer',
  },
  infoBox: {
    backgroundColor: '#f0f7ff',
    padding: '15px 20px',
    borderRadius: '8px',
    marginBottom: '20px',
    border: '1px solid #cce0ff',
  },
  infoList: {
    marginTop: '10px',
    marginBottom: 0,
    paddingLeft: '20px',
    lineHeight: '1.6',
  },
  button: {
    width: '100%',
    padding: '14px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
  progress: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  spinner: {
    width: '20px',
    height: '20px',
    border: '3px solid #e0e0e0',
    borderTopColor: '#0070f3',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite',
  },
  error: {
    backgroundColor: '#ffe6e6',
    color: '#aa0000',
    padding: '15px 20px',
    borderRadius: '8px',
    marginBottom: '20px',
  },
  results: {
    backgroundColor: 'white',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
  },
  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  compareButton: {
    padding: '10px 20px',
    backgroundColor: '#28a745',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  resultsMeta: {
    color: '#666',
    marginBottom: '25px',
  },
  noResults: {
    textAlign: 'center',
    padding: '40px',
    color: '#666',
    fontSize: '1.1rem',
  },
  strategiesGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  card: {
    border: '1px solid #e0e0e0',
    borderRadius: '10px',
    overflow: 'hidden',
  },
  cardHeader: {
    backgroundColor: '#f8f9fa',
    padding: '15px 20px',
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    borderBottom: '1px solid #e0e0e0',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  rank: {
    backgroundColor: '#0070f3',
    color: 'white',
    padding: '5px 12px',
    borderRadius: '20px',
    fontWeight: 'bold',
    fontSize: '14px',
  },
  cardTitle: {
    fontWeight: '600',
    fontSize: '1.1rem',
    flex: 1,
  },
  detailsToggle: {
    padding: '5px 10px',
    fontSize: '12px',
    backgroundColor: 'transparent',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  cardBody: {
    padding: '20px',
  },
  section: {
    marginBottom: '25px',
    paddingBottom: '20px',
    borderBottom: '1px solid #eee',
  },
  sectionLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#555',
    marginBottom: '15px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  metricsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '15px',
  },
  metricBox: {
    textAlign: 'center',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
  },
  metricLabel: {
    display: 'block',
    fontSize: '11px',
    color: '#666',
    marginBottom: '5px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  metricValue: {
    display: 'block',
    fontSize: '1.3rem',
    fontWeight: 'bold',
  },
  heroProjection: {
    textAlign: 'center',
    padding: '25px',
    backgroundColor: '#f0f7ff',
    borderRadius: '12px',
    marginBottom: '20px',
  },
  probLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#555',
    marginBottom: '10px',
    textTransform: 'uppercase',
  },
  probValue: {
    fontSize: '3rem',
    fontWeight: 'bold',
  },
  confidenceInterval: {
    marginBottom: '20px',
  },
  ciLabel: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '10px',
  },
  ciBar: {
    backgroundColor: '#f5f5f5',
    padding: '15px',
    borderRadius: '8px',
  },
  ciRange: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
    fontSize: '13px',
  },
  ciValue: {
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  ciMedian: {
    fontWeight: 'bold',
    fontSize: '14px',
  },
  ciBarVisual: {
    height: '8px',
    backgroundColor: '#e0e0e0',
    borderRadius: '4px',
    position: 'relative',
  },
  ciBarFill: {
    height: '100%',
    borderRadius: '4px',
  },
  kellyBox: {
    backgroundColor: '#fff9e6',
    padding: '15px',
    borderRadius: '8px',
    border: '1px solid #ffe0a0',
  },
  kellyValues: {
    display: 'flex',
    marginTop: '10px',
    fontSize: '14px',
  },
  detailsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '12px',
    marginTop: '15px',
  },
  detailItem: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '13px',
    padding: '8px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
  },
  detailLabel: {
    color: '#666',
  },
  detailValue: {
    fontWeight: '600',
    fontFamily: 'monospace',
  },
  comparison: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '15px',
    marginBottom: '15px',
    padding: '15px',
    backgroundColor: '#fafafa',
    borderRadius: '8px',
  },
  comparisonItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  comparisonLabel: {
    fontSize: '12px',
    color: '#999',
    textTransform: 'uppercase',
  },
  comparisonValue: {
    fontSize: '14px',
  },
  comparisonSharpe: {
    color: '#888',
    marginLeft: '8px',
    fontSize: '12px',
  },
  record: {
    fontSize: '14px',
    color: '#666',
    paddingTop: '10px',
    borderTop: '1px solid #eee',
  },
}
