'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import RangeSlider from '../components/RangeSlider'
import FilterSection from '../components/FilterSection'

const API_URL = 'http://127.0.0.1:8000'

// Team colors for theming (primary, secondary)
const TEAM_COLORS = {
  '': { primary: '#1a1a2e', secondary: '#16213e' }, // Default dark blue
  'Arizona Cardinals': { primary: '#97233F', secondary: '#000000' },
  'Atlanta Falcons': { primary: '#A71930', secondary: '#000000' },
  'Baltimore Colts': { primary: '#004C54', secondary: '#FFFFFF' },
  'Baltimore Ravens': { primary: '#241773', secondary: '#000000' },
  'Buffalo Bills': { primary: '#00338D', secondary: '#C60C30' },
  'Carolina Panthers': { primary: '#0085CA', secondary: '#101820' },
  'Chicago Bears': { primary: '#0B162A', secondary: '#C83803' },
  'Cincinnati Bengals': { primary: '#FB4F14', secondary: '#000000' },
  'Cleveland Browns': { primary: '#311D00', secondary: '#FF3C00' },
  'Dallas Cowboys': { primary: '#003594', secondary: '#869397' },
  'Denver Broncos': { primary: '#FB4F14', secondary: '#002244' },
  'Detroit Lions': { primary: '#0076B6', secondary: '#B0B7BC' },
  'Green Bay Packers': { primary: '#203731', secondary: '#FFB612' },
  'Houston Oilers': { primary: '#418FDE', secondary: '#C41E3A' },
  'Houston Texans': { primary: '#03202F', secondary: '#A71930' },
  'Indianapolis Colts': { primary: '#002C5F', secondary: '#A2AAAD' },
  'Jacksonville Jaguars': { primary: '#101820', secondary: '#D7A22A' },
  'Kansas City Chiefs': { primary: '#E31837', secondary: '#FFB81C' },
  'Los Angeles Chargers': { primary: '#0080C6', secondary: '#FFC20E' },
  'Los Angeles Raiders': { primary: '#000000', secondary: '#A5ACAF' },
  'Los Angeles Rams': { primary: '#003594', secondary: '#FFA300' },
  'Miami Dolphins': { primary: '#008E97', secondary: '#FC4C02' },
  'Minnesota Vikings': { primary: '#4F2683', secondary: '#FFC62F' },
  'New England Patriots': { primary: '#002244', secondary: '#C60C30' },
  'New Orleans Saints': { primary: '#D3BC8D', secondary: '#101820' },
  'New York Giants': { primary: '#0B2265', secondary: '#A71930' },
  'New York Jets': { primary: '#125740', secondary: '#000000' },
  'Oakland Raiders': { primary: '#000000', secondary: '#A5ACAF' },
  'Philadelphia Eagles': { primary: '#004C54', secondary: '#A5ACAF' },
  'Phoenix Cardinals': { primary: '#97233F', secondary: '#000000' },
  'Pittsburgh Steelers': { primary: '#FFB612', secondary: '#101820' },
  'San Diego Chargers': { primary: '#0080C6', secondary: '#FFC20E' },
  'San Francisco 49ers': { primary: '#AA0000', secondary: '#B3995D' },
  'Seattle Seahawks': { primary: '#002244', secondary: '#69BE28' },
  'St. Louis Cardinals': { primary: '#97233F', secondary: '#000000' },
  'St. Louis Rams': { primary: '#002244', secondary: '#B3995D' },
  'Tampa Bay Buccaneers': { primary: '#D50A0A', secondary: '#34302B' },
  'Tennessee Oilers': { primary: '#418FDE', secondary: '#C41E3A' },
  'Tennessee Titans': { primary: '#0C2340', secondary: '#4B92DB' },
  'Washington Redskins': { primary: '#773141', secondary: '#FFB612' },
}

// NFL Teams (includes historical names for older data)
const NFL_TEAMS = [
  '',
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Colts', 'Baltimore Ravens',
  'Buffalo Bills', 'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals',
  'Cleveland Browns', 'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions',
  'Green Bay Packers', 'Houston Oilers', 'Houston Texans', 'Indianapolis Colts',
  'Jacksonville Jaguars', 'Kansas City Chiefs', 'Los Angeles Chargers',
  'Los Angeles Raiders', 'Los Angeles Rams', 'Miami Dolphins', 'Minnesota Vikings',
  'New England Patriots', 'New Orleans Saints', 'New York Giants', 'New York Jets',
  'Oakland Raiders', 'Philadelphia Eagles', 'Phoenix Cardinals', 'Pittsburgh Steelers',
  'San Diego Chargers', 'San Francisco 49ers', 'Seattle Seahawks', 'St. Louis Cardinals',
  'St. Louis Rams', 'Tampa Bay Buccaneers', 'Tennessee Oilers', 'Tennessee Titans',
  'Washington Redskins',
]

// Filter presets
const PRESETS = [
  { name: 'Home Underdogs', filters: { bet_side: 'underdog', home_only: true } },
  { name: 'Road Favorites', filters: { bet_side: 'favorite', home_only: false, away_only: true } },
  { name: 'Cold Weather', filters: { temp_max: 32 } },
  { name: 'High Wind', filters: { wind_min: 15 } },
  { name: 'Playoff Games', filters: { playoffs_only: true } },
  { name: 'Big Underdogs (+7)', filters: { bet_side: 'underdog', spread_min: 7 } },
  { name: 'Small Favorites (-3)', filters: { bet_side: 'favorite', spread_min: -3, spread_max: 0 } },
]

// Default filter state
const DEFAULT_FILTERS = {
  name: '',
  market: 'spread',
  bet_side: 'underdog',
  team: '',
  opponent: '',
  // Line filters
  spread_min: -14,
  spread_max: 14,
  total_min: 30,
  total_max: 65,
  // Weather filters
  temp_min: 0,
  temp_max: 100,
  wind_min: 0,
  wind_max: 40,
  // Game situation
  home_only: false,
  away_only: false,
  playoffs_only: false,
  regular_only: false,
  week_min: 1,
  week_max: 22,
  // Team performance
  win_pct_min: 0,
  win_pct_max: 100,
  // Season range
  season_start: 2000,
  season_end: 2017,
}

function StrategyForm({ onSubmit, loading }) {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)

  const updateFilter = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }))
  }

  const applyPreset = (preset) => {
    setFilters(prev => ({ ...DEFAULT_FILTERS, ...preset.filters }))
  }

  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(filters)
  }

  // Determine bet side options based on market and team selection
  const getBetSideOptions = () => {
    if (filters.market === 'total') {
      return [
        { value: 'over', label: 'Over' },
        { value: 'under', label: 'Under' },
      ]
    }
    const options = [
      { value: 'favorite', label: 'Favorite' },
      { value: 'underdog', label: 'Underdog' },
      { value: 'home', label: 'Home Team' },
      { value: 'away', label: 'Away Team' },
    ]
    // Add "Selected Team" option when a team is chosen
    if (filters.team) {
      options.push({ value: 'team', label: `${filters.team} (always)` })
    }
    return options
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <h2>Build Your Strategy</h2>

      {/* Quick Presets */}
      <div style={styles.presets}>
        <span style={styles.presetsLabel}>Quick Presets:</span>
        <div style={styles.presetButtons}>
          {PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              onClick={() => applyPreset(preset)}
              style={styles.presetButton}
            >
              {preset.name}
            </button>
          ))}
          <button type="button" onClick={resetFilters} style={styles.resetButton}>
            Reset All
          </button>
        </div>
      </div>

      {/* Core Settings */}
      <div style={styles.coreSettings}>
        <div style={styles.field}>
          <label>Strategy Name</label>
          <input
            type="text"
            value={filters.name}
            onChange={(e) => updateFilter('name', e.target.value)}
            placeholder="e.g., Home Underdogs ATS"
            style={styles.input}
          />
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label>Market</label>
            <select
              value={filters.market}
              onChange={(e) => updateFilter('market', e.target.value)}
              style={styles.select}
            >
              <option value="spread">Spread (ATS)</option>
              <option value="total">Totals (O/U)</option>
              <option value="moneyline">Moneyline</option>
            </select>
          </div>
          <div style={styles.field}>
            <label>Bet Side</label>
            <select
              value={filters.bet_side}
              onChange={(e) => updateFilter('bet_side', e.target.value)}
              style={styles.select}
            >
              {getBetSideOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={styles.row}>
          <div style={styles.field}>
            <label>Team</label>
            <select
              value={filters.team}
              onChange={(e) => updateFilter('team', e.target.value)}
              style={styles.select}
            >
              {NFL_TEAMS.map((team) => (
                <option key={team || 'any'} value={team}>
                  {team || 'Any Team'}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.field}>
            <label>Opponent</label>
            <select
              value={filters.opponent}
              onChange={(e) => updateFilter('opponent', e.target.value)}
              style={styles.select}
            >
              {NFL_TEAMS.map((team) => (
                <option key={team || 'any-opp'} value={team}>
                  {team || 'Any Opponent'}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Advanced Filters */}
      <div style={styles.advancedFilters}>
        <h3 style={styles.sectionTitle}>Advanced Filters</h3>

        {/* Line Filters */}
        <FilterSection title="Line Filters" defaultOpen={false}>
          {filters.market !== 'total' && (
            <RangeSlider
              label="Spread Range"
              min={-14}
              max={14}
              step={0.5}
              value={[filters.spread_min, filters.spread_max]}
              onChange={([min, max]) => {
                updateFilter('spread_min', min)
                updateFilter('spread_max', max)
              }}
              formatValue={(v) => (v > 0 ? `+${v}` : v)}
            />
          )}
          <RangeSlider
            label="Total Range"
            min={30}
            max={65}
            step={0.5}
            value={[filters.total_min, filters.total_max]}
            onChange={([min, max]) => {
              updateFilter('total_min', min)
              updateFilter('total_max', max)
            }}
          />
        </FilterSection>

        {/* Weather Filters */}
        <FilterSection title="Weather" defaultOpen={false}>
          <RangeSlider
            label="Temperature"
            min={0}
            max={100}
            step={5}
            value={[filters.temp_min, filters.temp_max]}
            onChange={([min, max]) => {
              updateFilter('temp_min', min)
              updateFilter('temp_max', max)
            }}
            formatValue={(v) => `${v}°F`}
          />
          <RangeSlider
            label="Wind Speed"
            min={0}
            max={40}
            step={5}
            value={[filters.wind_min, filters.wind_max]}
            onChange={([min, max]) => {
              updateFilter('wind_min', min)
              updateFilter('wind_max', max)
            }}
            formatValue={(v) => `${v} mph`}
          />
        </FilterSection>

        {/* Game Situation */}
        <FilterSection title="Game Situation" defaultOpen={false}>
          <div style={styles.checkboxGroup}>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={filters.home_only}
                onChange={(e) => {
                  updateFilter('home_only', e.target.checked)
                  if (e.target.checked) updateFilter('away_only', false)
                }}
              />
              Home games only
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={filters.away_only}
                onChange={(e) => {
                  updateFilter('away_only', e.target.checked)
                  if (e.target.checked) updateFilter('home_only', false)
                }}
              />
              Away games only
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={filters.playoffs_only}
                onChange={(e) => {
                  updateFilter('playoffs_only', e.target.checked)
                  if (e.target.checked) updateFilter('regular_only', false)
                }}
              />
              Playoffs only
            </label>
            <label style={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={filters.regular_only}
                onChange={(e) => {
                  updateFilter('regular_only', e.target.checked)
                  if (e.target.checked) updateFilter('playoffs_only', false)
                }}
              />
              Regular season only
            </label>
          </div>
          <RangeSlider
            label="Week Range"
            min={1}
            max={22}
            step={1}
            value={[filters.week_min, filters.week_max]}
            onChange={([min, max]) => {
              updateFilter('week_min', min)
              updateFilter('week_max', max)
            }}
            formatValue={(v) => v <= 17 ? `Week ${v}` : 'Playoffs'}
          />
        </FilterSection>

        {/* Team Performance */}
        <FilterSection title="Team Performance" defaultOpen={false}>
          <RangeSlider
            label="Team Win % (Season)"
            min={0}
            max={100}
            step={5}
            value={[filters.win_pct_min, filters.win_pct_max]}
            onChange={([min, max]) => {
              updateFilter('win_pct_min', min)
              updateFilter('win_pct_max', max)
            }}
            formatValue={(v) => `${v}%`}
          />
        </FilterSection>

        {/* Season Range */}
        <FilterSection title="Season Range" defaultOpen={true}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label>Start Season</label>
              <input
                type="number"
                value={filters.season_start}
                onChange={(e) => updateFilter('season_start', parseInt(e.target.value))}
                min={1967}
                max={2017}
                style={styles.input}
              />
            </div>
            <div style={styles.field}>
              <label>End Season</label>
              <input
                type="number"
                value={filters.season_end}
                onChange={(e) => updateFilter('season_end', parseInt(e.target.value))}
                min={1967}
                max={2017}
                style={styles.input}
              />
            </div>
          </div>
        </FilterSection>
      </div>

      <button type="submit" disabled={loading} style={styles.button}>
        {loading ? 'Running Backtest...' : 'Test Strategy'}
      </button>
    </form>
  )
}

// Results display
function Results({ data }) {
  if (!data) return null

  const { results, summary } = data
  const isProfit = results.roi_pct > 0

  return (
    <div style={styles.results}>
      <h2>Results: {results.strategy_name || 'Your Strategy'}</h2>

      <div style={{
        ...styles.verdict,
        backgroundColor: isProfit ? '#e6ffe6' : '#ffe6e6',
        borderColor: isProfit ? '#00aa00' : '#aa0000',
      }}>
        <strong>{isProfit ? 'PROFITABLE' : 'UNPROFITABLE'}</strong>
        <p style={{ margin: '10px 0 0' }}>{summary}</p>
      </div>

      <div style={styles.metricsGrid}>
        <div style={styles.metric}>
          <span style={styles.metricValue}>{results.total_bets}</span>
          <span style={styles.metricLabel}>Total Bets</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricValue}>{results.wins}-{results.losses}-{results.pushes}</span>
          <span style={styles.metricLabel}>W-L-P</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricValue}>{results.win_rate_pct}%</span>
          <span style={styles.metricLabel}>Win Rate</span>
        </div>
        <div style={styles.metric}>
          <span style={{
            ...styles.metricValue,
            color: results.roi_pct > 0 ? '#00aa00' : '#aa0000'
          }}>
            {results.roi_pct > 0 ? '+' : ''}{results.roi_pct}%
          </span>
          <span style={styles.metricLabel}>ROI</span>
        </div>
        <div style={styles.metric}>
          <span style={{
            ...styles.metricValue,
            color: results.total_profit_units > 0 ? '#00aa00' : '#aa0000'
          }}>
            {results.total_profit_units > 0 ? '+' : ''}{results.total_profit_units}
          </span>
          <span style={styles.metricLabel}>Profit (units)</span>
        </div>
        <div style={styles.metric}>
          <span style={styles.metricValue}>-{results.max_drawdown_units}</span>
          <span style={styles.metricLabel}>Max Drawdown</span>
        </div>
      </div>

      {/* Performance Chart */}
      {results.bets && results.bets.length > 0 && (
        <PerformanceChart bets={results.bets} />
      )}

      {results.warnings && results.warnings.length > 0 && (
        <div style={styles.warnings}>
          <strong>Warnings:</strong>
          <ul>
            {results.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {results.seasons && results.seasons.length > 0 && (
        <div style={styles.seasonTable}>
          <h3>By Season</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={styles.th}>Season</th>
                <th style={styles.th}>Bets</th>
                <th style={styles.th}>Record</th>
                <th style={styles.th}>ROI</th>
                <th style={styles.th}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {results.seasons.map((s) => (
                <tr key={s.season}>
                  <td style={styles.td}>{s.season}</td>
                  <td style={styles.td}>{s.bets}</td>
                  <td style={styles.td}>{s.wins}-{s.losses}-{s.pushes}</td>
                  <td style={{
                    ...styles.td,
                    color: s.roi_pct > 0 ? '#00aa00' : '#aa0000'
                  }}>
                    {s.roi_pct > 0 ? '+' : ''}{s.roi_pct}%
                  </td>
                  <td style={{
                    ...styles.td,
                    color: s.profit_units > 0 ? '#00aa00' : '#aa0000'
                  }}>
                    {s.profit_units > 0 ? '+' : ''}{s.profit_units}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Performance chart showing cumulative profit over time
function PerformanceChart({ bets }) {
  if (!bets || bets.length === 0) return null

  // Calculate cumulative profit
  let cumulative = 0
  const chartData = bets.map((bet, index) => {
    cumulative += bet.profit
    return {
      bet: index + 1,
      profit: Number(cumulative.toFixed(2)),
      game: `${bet.away_team} @ ${bet.home_team}`,
      result: bet.result,
    }
  })

  const maxProfit = Math.max(...chartData.map(d => d.profit))
  const minProfit = Math.min(...chartData.map(d => d.profit))
  const yDomain = [Math.floor(minProfit - 2), Math.ceil(maxProfit + 2)]

  return (
    <div style={styles.chartContainer}>
      <h3 style={styles.chartTitle}>Performance Over Time</h3>
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="bet"
            tick={{ fontSize: 12 }}
            label={{ value: 'Bet #', position: 'insideBottom', offset: -5 }}
          />
          <YAxis
            domain={yDomain}
            tick={{ fontSize: 12 }}
            label={{ value: 'Units', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload
                return (
                  <div style={styles.tooltip}>
                    <div><strong>Bet #{data.bet}</strong></div>
                    <div>{data.game}</div>
                    <div>Result: {data.result}</div>
                    <div style={{ color: data.profit >= 0 ? '#00aa00' : '#aa0000' }}>
                      Total: {data.profit > 0 ? '+' : ''}{data.profit} units
                    </div>
                  </div>
                )
              }
              return null
            }}
          />
          <ReferenceLine y={0} stroke="#666" strokeDasharray="3 3" />
          <Line
            type="monotone"
            dataKey="profit"
            stroke="#0070f3"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 6, fill: '#0070f3' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// Cinematic results reveal screen
function CinematicResults({ data, onBack }) {
  if (!data) return null

  const { results, summary } = data
  const isProfit = results.roi_pct > 0

  return (
    <div style={styles.cinematicContainer}>
      {/* Back button */}
      <button onClick={onBack} style={styles.backButton}>
        ← Back to Strategy Builder
      </button>

      {/* Strategy name header */}
      <h1 style={styles.cinematicTitle}>
        {results.strategy_name || 'Your Strategy'}
      </h1>

      {/* Chart - animates first */}
      {results.bets && results.bets.length > 0 && (
        <div style={styles.cinematicChart}>
          <PerformanceChart bets={results.bets} />
        </div>
      )}

      {/* Hero ROI metric - appears after chart */}
      <div style={{
        ...styles.heroMetric,
        animationDelay: '1.2s',
      }}>
        <div style={styles.heroLabel}>Return on Investment</div>
        <div style={{
          ...styles.heroValue,
          color: isProfit ? '#00cc00' : '#cc0000',
        }}>
          {results.roi_pct > 0 ? '+' : ''}{results.roi_pct}%
        </div>
        <div style={{
          ...styles.heroVerdict,
          color: isProfit ? '#00cc00' : '#cc0000',
        }}>
          {isProfit ? '✓ PROFITABLE' : '✗ UNPROFITABLE'}
        </div>
      </div>

      {/* Supporting metrics grid - staggered appearance */}
      <div style={styles.cinematicMetrics}>
        <div style={{ ...styles.cinematicMetric, animationDelay: '1.4s' }}>
          <span style={styles.cinematicMetricValue}>{results.total_bets}</span>
          <span style={styles.cinematicMetricLabel}>Total Bets</span>
        </div>
        <div style={{ ...styles.cinematicMetric, animationDelay: '1.5s' }}>
          <span style={styles.cinematicMetricValue}>
            {results.wins}-{results.losses}-{results.pushes}
          </span>
          <span style={styles.cinematicMetricLabel}>W-L-P</span>
        </div>
        <div style={{ ...styles.cinematicMetric, animationDelay: '1.6s' }}>
          <span style={styles.cinematicMetricValue}>{results.win_rate_pct}%</span>
          <span style={styles.cinematicMetricLabel}>Win Rate</span>
        </div>
        <div style={{ ...styles.cinematicMetric, animationDelay: '1.7s' }}>
          <span style={{
            ...styles.cinematicMetricValue,
            color: results.total_profit_units > 0 ? '#00cc00' : '#cc0000'
          }}>
            {results.total_profit_units > 0 ? '+' : ''}{results.total_profit_units}
          </span>
          <span style={styles.cinematicMetricLabel}>Profit (units)</span>
        </div>
        <div style={{ ...styles.cinematicMetric, animationDelay: '1.8s' }}>
          <span style={styles.cinematicMetricValue}>-{results.max_drawdown_units}</span>
          <span style={styles.cinematicMetricLabel}>Max Drawdown</span>
        </div>
        <div style={{ ...styles.cinematicMetric, animationDelay: '1.9s' }}>
          <span style={styles.cinematicMetricValue}>{results.longest_winning_streak}</span>
          <span style={styles.cinematicMetricLabel}>Win Streak</span>
        </div>
      </div>

      {/* Summary text */}
      {summary && (
        <div style={{ ...styles.cinematicSummary, animationDelay: '2.0s' }}>
          {summary}
        </div>
      )}

      {/* Warnings */}
      {results.warnings && results.warnings.length > 0 && (
        <div style={{ ...styles.cinematicWarnings, animationDelay: '2.1s' }}>
          <strong>⚠ Warnings:</strong>
          <ul>
            {results.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Season breakdown table */}
      {results.seasons && results.seasons.length > 0 && (
        <div style={{ ...styles.cinematicSeasonTable, animationDelay: '2.2s' }}>
          <h3>Performance by Season</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={styles.th}>Season</th>
                <th style={styles.th}>Bets</th>
                <th style={styles.th}>Record</th>
                <th style={styles.th}>ROI</th>
                <th style={styles.th}>Profit</th>
              </tr>
            </thead>
            <tbody>
              {results.seasons.map((s) => (
                <tr key={s.season}>
                  <td style={styles.td}>{s.season}</td>
                  <td style={styles.td}>{s.bets}</td>
                  <td style={styles.td}>{s.wins}-{s.losses}-{s.pushes}</td>
                  <td style={{
                    ...styles.td,
                    color: s.roi_pct > 0 ? '#00aa00' : '#aa0000'
                  }}>
                    {s.roi_pct > 0 ? '+' : ''}{s.roi_pct}%
                  </td>
                  <td style={{
                    ...styles.td,
                    color: s.profit_units > 0 ? '#00aa00' : '#aa0000'
                  }}>
                    {s.profit_units > 0 ? '+' : ''}{s.profit_units}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// Main page
export default function Home() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState(null)
  const [favoriteTeam, setFavoriteTeam] = useState('')
  const [showResults, setShowResults] = useState(false)

  // Get gradient colors based on favorite team
  const teamColors = TEAM_COLORS[favoriteTeam] || TEAM_COLORS['']
  const gradientStyle = {
    background: `linear-gradient(135deg, ${teamColors.primary} 0%, ${teamColors.secondary} 100%)`,
    minHeight: '100vh',
    padding: '20px',
  }

  const runBacktest = async (filters) => {
    setLoading(true)
    setError(null)
    setShowResults(false)

    try {
      // Build filters array for backend
      const backendFilters = []

      // Line filters (only apply if changed from defaults)
      if (filters.spread_min > -14 || filters.spread_max < 14) {
        if (filters.spread_min > -14) {
          backendFilters.push({ field: 'spread_line', operator: '>=', value: filters.spread_min })
        }
        if (filters.spread_max < 14) {
          backendFilters.push({ field: 'spread_line', operator: '<=', value: filters.spread_max })
        }
      }

      if (filters.total_min > 30 || filters.total_max < 65) {
        if (filters.total_min > 30) {
          backendFilters.push({ field: 'total_line', operator: '>=', value: filters.total_min })
        }
        if (filters.total_max < 65) {
          backendFilters.push({ field: 'total_line', operator: '<=', value: filters.total_max })
        }
      }

      // Weather filters
      if (filters.temp_min > 0 || filters.temp_max < 100) {
        if (filters.temp_min > 0) {
          backendFilters.push({ field: 'temperature', operator: '>=', value: filters.temp_min })
        }
        if (filters.temp_max < 100) {
          backendFilters.push({ field: 'temperature', operator: '<=', value: filters.temp_max })
        }
      }

      if (filters.wind_min > 0 || filters.wind_max < 40) {
        if (filters.wind_min > 0) {
          backendFilters.push({ field: 'wind_mph', operator: '>=', value: filters.wind_min })
        }
        if (filters.wind_max < 40) {
          backendFilters.push({ field: 'wind_mph', operator: '<=', value: filters.wind_max })
        }
      }

      // Game situation
      if (filters.home_only && filters.team) {
        backendFilters.push({ field: 'home_team', operator: '==', value: filters.team })
      }
      if (filters.away_only && filters.team) {
        backendFilters.push({ field: 'away_team', operator: '==', value: filters.team })
      }

      // Week filters for playoffs
      if (filters.playoffs_only) {
        backendFilters.push({ field: 'week', operator: '>=', value: '18' })
      }
      if (filters.regular_only) {
        backendFilters.push({ field: 'week', operator: '<=', value: '17' })
      }

      // Win percentage filters
      if (filters.win_pct_min > 0 || filters.win_pct_max < 100) {
        // Apply to the team we're betting on based on bet_side
        if (filters.win_pct_min > 0) {
          backendFilters.push({ field: 'home_win_pct', operator: '>=', value: filters.win_pct_min / 100 })
        }
        if (filters.win_pct_max < 100) {
          backendFilters.push({ field: 'home_win_pct', operator: '<=', value: filters.win_pct_max / 100 })
        }
      }

      // Build strategy name
      let strategyName = filters.name
      if (!strategyName) {
        strategyName = `${filters.bet_side} ${filters.market}`
        if (filters.team) strategyName = `${filters.team} ${strategyName}`
        if (filters.opponent) strategyName += ` vs ${filters.opponent}`
      }

      const strategyInput = {
        name: strategyName,
        description: `Betting ${filters.bet_side} on ${filters.market}`,
        league: 'NFL',
        market: filters.market,
        bet_side: filters.bet_side,
        filters: backendFilters,
        team: filters.team || null,
        opponent: filters.opponent || null,
        season_start: filters.season_start,
        season_end: filters.season_end,
        stake_unit: 1.0,
      }

      const response = await fetch(`${API_URL}/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: strategyInput, include_bets: true }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setResults(data)
      setShowResults(true)
    } catch (err) {
      setError(`Failed to run backtest: ${err.message}. Make sure the backend is running.`)
    } finally {
      setLoading(false)
    }
  }

  const backToBuilder = () => {
    setShowResults(false)
    setResults(null)
    setError(null)
  }

  return (
    <div style={gradientStyle}>
      {/* Show results screen or builder */}
      {showResults && results ? (
        <CinematicResults data={results} onBack={backToBuilder} />
      ) : (
        <>
          {/* Navigation and Team Selector */}
          <div style={styles.topBar}>
            <Link href="/optimizer" style={styles.optimizerLink}>
              Strategy Optimizer →
            </Link>
            <div style={styles.teamSelector}>
              <label style={styles.teamSelectorLabel}>Pick Your Team:</label>
              <select
                value={favoriteTeam}
                onChange={(e) => setFavoriteTeam(e.target.value)}
                style={styles.teamSelectorDropdown}
              >
                <option value="">Default Theme</option>
                {NFL_TEAMS.filter(t => t).map((team) => (
                  <option key={team} value={team}>{team}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.container}>
            <h1 style={styles.title}>Do My Bets Suck?</h1>
            <p style={styles.subtitle}>
              Test your NFL betting strategies against historical data (1967-2017)
            </p>

            <StrategyForm onSubmit={runBacktest} loading={loading} />

            {error && (
              <div style={styles.error}>{error}</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '900px',
    margin: '0 auto',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
  },
  optimizerLink: {
    color: 'white',
    textDecoration: 'none',
    padding: '10px 20px',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: '6px',
    fontWeight: '600',
    fontSize: '14px',
    transition: 'background 0.2s',
  },
  teamSelector: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: '10px',
    marginBottom: '20px',
  },
  teamSelectorLabel: {
    color: 'white',
    fontWeight: '600',
    fontSize: '14px',
    textShadow: '0 1px 2px rgba(0,0,0,0.3)',
  },
  teamSelectorDropdown: {
    padding: '8px 12px',
    fontSize: '14px',
    borderRadius: '4px',
    border: 'none',
    cursor: 'pointer',
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  title: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
    color: 'white',
    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  subtitle: {
    color: 'rgba(255,255,255,0.8)',
    marginBottom: '2rem',
    textShadow: '0 1px 2px rgba(0,0,0,0.2)',
  },
  form: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
  },
  presets: {
    marginBottom: '20px',
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '6px',
  },
  presetsLabel: {
    fontWeight: '600',
    fontSize: '14px',
    display: 'block',
    marginBottom: '10px',
  },
  presetButtons: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  presetButton: {
    padding: '6px 12px',
    fontSize: '13px',
    backgroundColor: '#e9ecef',
    border: '1px solid #ced4da',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  resetButton: {
    padding: '6px 12px',
    fontSize: '13px',
    backgroundColor: '#fff',
    border: '1px solid #dc3545',
    color: '#dc3545',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  coreSettings: {
    marginBottom: '20px',
  },
  advancedFilters: {
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '15px',
    color: '#333',
  },
  field: {
    marginBottom: '15px',
    flex: 1,
  },
  row: {
    display: 'flex',
    gap: '20px',
  },
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    marginTop: '5px',
    boxSizing: 'border-box',
  },
  select: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '16px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    marginTop: '5px',
  },
  checkboxGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '10px',
    marginBottom: '15px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
  },
  button: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    fontWeight: 'bold',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '10px',
  },
  results: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  verdict: {
    padding: '15px',
    borderRadius: '4px',
    border: '2px solid',
    marginBottom: '20px',
  },
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '15px',
    marginBottom: '20px',
  },
  metric: {
    textAlign: 'center',
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
  },
  metricValue: {
    display: 'block',
    fontSize: '1.5rem',
    fontWeight: 'bold',
  },
  metricLabel: {
    display: 'block',
    fontSize: '0.8rem',
    color: '#666',
    marginTop: '5px',
  },
  warnings: {
    backgroundColor: '#fff3cd',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  seasonTable: {
    marginTop: '20px',
  },
  th: {
    textAlign: 'left',
    padding: '8px',
    borderBottom: '2px solid #ddd',
  },
  td: {
    padding: '8px',
    borderBottom: '1px solid #eee',
  },
  error: {
    backgroundColor: '#ffe6e6',
    color: '#aa0000',
    padding: '15px',
    borderRadius: '4px',
    marginBottom: '20px',
  },
  chartContainer: {
    marginTop: '25px',
    marginBottom: '25px',
    padding: '15px',
    backgroundColor: '#f9f9f9',
    borderRadius: '8px',
  },
  chartTitle: {
    fontSize: '16px',
    fontWeight: '600',
    marginBottom: '15px',
    color: '#333',
  },
  tooltip: {
    backgroundColor: 'white',
    padding: '10px 15px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    fontSize: '13px',
  },
  // Cinematic results screen styles
  cinematicContainer: {
    maxWidth: '1000px',
    margin: '0 auto',
    padding: '40px 20px',
  },
  backButton: {
    padding: '10px 20px',
    fontSize: '14px',
    backgroundColor: 'rgba(255,255,255,0.9)',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: '600',
    marginBottom: '30px',
    transition: 'background 0.2s',
  },
  cinematicTitle: {
    fontSize: '2.5rem',
    color: 'white',
    textAlign: 'center',
    marginBottom: '40px',
    textShadow: '0 2px 8px rgba(0,0,0,0.4)',
    animation: 'fadeInDown 0.6s ease-out',
  },
  cinematicChart: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '30px',
    boxShadow: '0 8px 16px rgba(0,0,0,0.2)',
    marginBottom: '40px',
    animation: 'fadeInUp 0.8s ease-out',
  },
  heroMetric: {
    textAlign: 'center',
    padding: '40px',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: '16px',
    boxShadow: '0 12px 24px rgba(0,0,0,0.25)',
    marginBottom: '40px',
    animation: 'fadeInUp 0.8s ease-out',
    animationFillMode: 'both',
  },
  heroLabel: {
    fontSize: '1.2rem',
    color: '#666',
    marginBottom: '15px',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    fontWeight: '600',
  },
  heroValue: {
    fontSize: '5rem',
    fontWeight: 'bold',
    lineHeight: '1',
    marginBottom: '20px',
  },
  heroVerdict: {
    fontSize: '1.8rem',
    fontWeight: 'bold',
    letterSpacing: '3px',
  },
  cinematicMetrics: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginBottom: '40px',
  },
  cinematicMetric: {
    textAlign: 'center',
    padding: '25px',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: '12px',
    boxShadow: '0 4px 8px rgba(0,0,0,0.15)',
    animation: 'fadeInUp 0.6s ease-out',
    animationFillMode: 'both',
  },
  cinematicMetricValue: {
    display: 'block',
    fontSize: '2rem',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  cinematicMetricLabel: {
    display: 'block',
    fontSize: '0.9rem',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '1px',
  },
  cinematicSummary: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    padding: '25px',
    borderRadius: '12px',
    marginBottom: '30px',
    fontSize: '1.1rem',
    lineHeight: '1.6',
    textAlign: 'center',
    animation: 'fadeInUp 0.6s ease-out',
    animationFillMode: 'both',
  },
  cinematicWarnings: {
    backgroundColor: 'rgba(255, 243, 205, 0.95)',
    padding: '20px 25px',
    borderRadius: '12px',
    marginBottom: '30px',
    animation: 'fadeInUp 0.6s ease-out',
    animationFillMode: 'both',
  },
  cinematicSeasonTable: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: '30px',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    animation: 'fadeInUp 0.6s ease-out',
    animationFillMode: 'both',
  },
}
