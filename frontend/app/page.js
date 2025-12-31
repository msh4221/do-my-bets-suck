'use client'

import { useState } from 'react'
import Link from 'next/link'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import PlayerSearch from '../components/PlayerSearch'

const API_URL = 'http://127.0.0.1:8000'

// Prop types for player props
const PROP_TYPES = [
  { value: 'passing_yards', label: 'Passing Yards' },
  { value: 'rushing_yards', label: 'Rushing Yards' },
  { value: 'receiving_yards', label: 'Receiving Yards' },
  { value: 'receptions', label: 'Receptions' },
  { value: 'passing_tds', label: 'Passing TDs' },
  { value: 'anytime_td', label: 'Anytime TD' },
]

// Position types for filtering
const POSITIONS = [
  { value: '', label: 'All Positions' },
  { value: 'QB', label: 'QB' },
  { value: 'RB', label: 'RB' },
  { value: 'WR', label: 'WR' },
  { value: 'TE', label: 'TE' },
]

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

// Map full team names to database abbreviations
const TEAM_ABBREV_MAP = {
  'Arizona Cardinals': 'ARI',
  'Atlanta Falcons': 'ATL',
  'Baltimore Ravens': 'BAL',
  'Buffalo Bills': 'BUF',
  'Carolina Panthers': 'CAR',
  'Chicago Bears': 'CHI',
  'Cincinnati Bengals': 'CIN',
  'Cleveland Browns': 'CLE',
  'Dallas Cowboys': 'DAL',
  'Denver Broncos': 'DEN',
  'Detroit Lions': 'DET',
  'Green Bay Packers': 'GB',
  'Houston Texans': 'HOU',
  'Indianapolis Colts': 'IND',
  'Jacksonville Jaguars': 'JAX',
  'Kansas City Chiefs': 'KC',
  'Las Vegas Raiders': 'LV',
  'Los Angeles Chargers': 'LAC',
  'Los Angeles Rams': 'LA',
  'Miami Dolphins': 'MIA',
  'Minnesota Vikings': 'MIN',
  'New England Patriots': 'NE',
  'New Orleans Saints': 'NO',
  'New York Giants': 'NYG',
  'New York Jets': 'NYJ',
  'Philadelphia Eagles': 'PHI',
  'Pittsburgh Steelers': 'PIT',
  'San Francisco 49ers': 'SF',
  'Seattle Seahawks': 'SEA',
  'Tampa Bay Buccaneers': 'TB',
  'Tennessee Titans': 'TEN',
  'Washington Commanders': 'WAS',
}

// NFL Teams (includes historical names for older data)
const NFL_TEAMS = [
  '',
  'Arizona Cardinals', 'Atlanta Falcons', 'Baltimore Ravens',
  'Buffalo Bills', 'Carolina Panthers', 'Chicago Bears', 'Cincinnati Bengals',
  'Cleveland Browns', 'Dallas Cowboys', 'Denver Broncos', 'Detroit Lions',
  'Green Bay Packers', 'Houston Texans', 'Indianapolis Colts',
  'Jacksonville Jaguars', 'Kansas City Chiefs', 'Las Vegas Raiders', 'Los Angeles Chargers',
  'Los Angeles Rams', 'Miami Dolphins', 'Minnesota Vikings',
  'New England Patriots', 'New Orleans Saints', 'New York Giants', 'New York Jets',
  'Philadelphia Eagles', 'Pittsburgh Steelers',
  'San Francisco 49ers', 'Seattle Seahawks',
  'Tampa Bay Buccaneers', 'Tennessee Titans',
  'Washington Commanders',
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
  season_end: 2023,
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
      {/* 3-Column Grid Layout */}
      <div style={styles.gridContainer}>

        {/* LEFT COLUMN: Core Settings */}
        <div style={styles.gridColumn}>
          <div style={styles.columnHeader}>Core Settings</div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Name</label>
            <input
              type="text"
              value={filters.name}
              onChange={(e) => updateFilter('name', e.target.value)}
              placeholder="Strategy name..."
              style={styles.inlineInput}
            />
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Market</label>
            <select
              value={filters.market}
              onChange={(e) => updateFilter('market', e.target.value)}
              style={styles.inlineSelect}
            >
              <option value="spread">Spread (ATS)</option>
              <option value="total">Totals (O/U)</option>
              <option value="moneyline">Moneyline</option>
            </select>
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Bet Side</label>
            <select
              value={filters.bet_side}
              onChange={(e) => updateFilter('bet_side', e.target.value)}
              style={styles.inlineSelect}
            >
              {getBetSideOptions().map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Team</label>
            <select
              value={filters.team}
              onChange={(e) => updateFilter('team', e.target.value)}
              style={styles.inlineSelect}
            >
              {NFL_TEAMS.map((team) => (
                <option key={team || 'any'} value={team}>
                  {team || 'Any Team'}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Opponent</label>
            <select
              value={filters.opponent}
              onChange={(e) => updateFilter('opponent', e.target.value)}
              style={styles.inlineSelect}
            >
              {NFL_TEAMS.map((team) => (
                <option key={team || 'any-opp'} value={team}>
                  {team || 'Any Opponent'}
                </option>
              ))}
            </select>
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Seasons</label>
            <div style={styles.miniRangeRow}>
              <input
                type="number"
                value={filters.season_start}
                onChange={(e) => updateFilter('season_start', parseInt(e.target.value))}
                min={1999}
                max={2023}
                style={styles.miniInput}
              />
              <span style={styles.miniSeparator}>-</span>
              <input
                type="number"
                value={filters.season_end}
                onChange={(e) => updateFilter('season_end', parseInt(e.target.value))}
                min={1999}
                max={2023}
                style={styles.miniInput}
              />
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: Filters */}
        <div style={styles.gridColumn}>
          <div style={styles.columnHeader}>Filters</div>
          {filters.market !== 'total' && (
            <div style={styles.inlineField}>
              <label style={styles.inlineLabel}>Spread</label>
              <div style={styles.miniRangeRow}>
                <input type="number" value={filters.spread_min} onChange={(e) => updateFilter('spread_min', parseFloat(e.target.value))} step={0.5} style={styles.miniInput} />
                <span style={styles.miniSeparator}>to</span>
                <input type="number" value={filters.spread_max} onChange={(e) => updateFilter('spread_max', parseFloat(e.target.value))} step={0.5} style={styles.miniInput} />
              </div>
            </div>
          )}
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Total</label>
            <div style={styles.miniRangeRow}>
              <input type="number" value={filters.total_min} onChange={(e) => updateFilter('total_min', parseFloat(e.target.value))} step={0.5} style={styles.miniInput} />
              <span style={styles.miniSeparator}>to</span>
              <input type="number" value={filters.total_max} onChange={(e) => updateFilter('total_max', parseFloat(e.target.value))} step={0.5} style={styles.miniInput} />
            </div>
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Weeks</label>
            <div style={styles.miniRangeRow}>
              <input type="number" value={filters.week_min} onChange={(e) => updateFilter('week_min', parseInt(e.target.value))} min={1} max={22} style={styles.miniInput} />
              <span style={styles.miniSeparator}>to</span>
              <input type="number" value={filters.week_max} onChange={(e) => updateFilter('week_max', parseInt(e.target.value))} min={1} max={22} style={styles.miniInput} />
            </div>
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Win %</label>
            <div style={styles.miniRangeRow}>
              <input type="number" value={filters.win_pct_min} onChange={(e) => updateFilter('win_pct_min', parseFloat(e.target.value))} step={5} style={styles.miniInput} />
              <span style={styles.miniSeparator}>to</span>
              <input type="number" value={filters.win_pct_max} onChange={(e) => updateFilter('win_pct_max', parseFloat(e.target.value))} step={5} style={styles.miniInput} />
            </div>
          </div>
          <div style={styles.checkboxGrid}>
            <label style={styles.miniCheckbox}>
              <input type="checkbox" checked={filters.home_only} onChange={(e) => { updateFilter('home_only', e.target.checked); if (e.target.checked) updateFilter('away_only', false) }} />
              Home
            </label>
            <label style={styles.miniCheckbox}>
              <input type="checkbox" checked={filters.away_only} onChange={(e) => { updateFilter('away_only', e.target.checked); if (e.target.checked) updateFilter('home_only', false) }} />
              Away
            </label>
            <label style={styles.miniCheckbox}>
              <input type="checkbox" checked={filters.playoffs_only} onChange={(e) => { updateFilter('playoffs_only', e.target.checked); if (e.target.checked) updateFilter('regular_only', false) }} />
              Playoffs
            </label>
            <label style={styles.miniCheckbox}>
              <input type="checkbox" checked={filters.regular_only} onChange={(e) => { updateFilter('regular_only', e.target.checked); if (e.target.checked) updateFilter('playoffs_only', false) }} />
              Regular
            </label>
          </div>
        </div>

        {/* RIGHT COLUMN: Weather + Action */}
        <div style={styles.gridColumn}>
          <div style={styles.columnHeader}>Weather (Optional)</div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Temp °F</label>
            <div style={styles.miniRangeRow}>
              <input type="number" value={filters.temp_min} onChange={(e) => updateFilter('temp_min', parseFloat(e.target.value))} step={5} style={styles.miniInput} />
              <span style={styles.miniSeparator}>to</span>
              <input type="number" value={filters.temp_max} onChange={(e) => updateFilter('temp_max', parseFloat(e.target.value))} step={5} style={styles.miniInput} />
            </div>
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Wind mph</label>
            <div style={styles.miniRangeRow}>
              <input type="number" value={filters.wind_min} onChange={(e) => updateFilter('wind_min', parseFloat(e.target.value))} step={5} style={styles.miniInput} />
              <span style={styles.miniSeparator}>to</span>
              <input type="number" value={filters.wind_max} onChange={(e) => updateFilter('wind_max', parseFloat(e.target.value))} step={5} style={styles.miniInput} />
            </div>
          </div>

          <div style={styles.presetsCompact}>
            <div style={styles.presetButtonsCompact}>
              {PRESETS.map((preset) => (
                <button key={preset.name} type="button" onClick={() => applyPreset(preset)} style={styles.presetButtonSmall}>
                  {preset.name}
                </button>
              ))}
              <button type="button" onClick={resetFilters} style={styles.resetButtonSmall}>
                Reset
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} style={styles.submitButton}>
            {loading ? 'Testing...' : '▶ Test Strategy'}
          </button>
        </div>
      </div>
    </form>
  )
}

// Compact Results Display (inline on main page)
function CompactResults({ data }) {
  if (!data) return null
  const { results, summary } = data
  const isProfit = results.roi_pct > 0

  return (
    <div style={styles.compactResultsContainer}>
      <div style={styles.compactResultsGrid}>
        <div style={{
          ...styles.compactVerdict,
          backgroundColor: isProfit ? '#e6ffe6' : '#ffe6e6',
          borderColor: isProfit ? '#00aa00' : '#aa0000',
        }}>
          <div style={styles.verdictText}>{isProfit ? '✓ PROFITABLE' : '✗ UNPROFITABLE'}</div>
          <div style={styles.roiHero}>
            <span style={{ color: isProfit ? '#00aa00' : '#aa0000' }}>
              {results.roi_pct > 0 ? '+' : ''}{results.roi_pct}%
            </span>
            <span style={styles.roiLabel}>ROI</span>
          </div>
        </div>
        <div style={styles.compactMetricsRow}>
          <div style={styles.compactMetric}>
            <span style={styles.compactMetricValue}>{results.total_bets}</span>
            <span style={styles.compactMetricLabel}>Bets</span>
          </div>
          <div style={styles.compactMetric}>
            <span style={styles.compactMetricValue}>{results.wins}-{results.losses}-{results.pushes}</span>
            <span style={styles.compactMetricLabel}>W-L-P</span>
          </div>
          <div style={styles.compactMetric}>
            <span style={styles.compactMetricValue}>{results.win_rate_pct}%</span>
            <span style={styles.compactMetricLabel}>Win Rate</span>
          </div>
          <div style={styles.compactMetric}>
            <span style={styles.compactMetricValue}>{results.total_profit_units > 0 ? '+' : ''}{results.total_profit_units}u</span>
            <span style={styles.compactMetricLabel}>Profit</span>
          </div>
          <div style={styles.compactMetric}>
            <span style={styles.compactMetricValue}>{results.max_drawdown_units}u</span>
            <span style={styles.compactMetricLabel}>Max DD</span>
          </div>
        </div>
      </div>
      {results.warnings && results.warnings.length > 0 && (
        <div style={styles.compactWarnings}>
          {results.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
        </div>
      )}
      {summary && <div style={styles.compactSummary}>{summary}</div>}
    </div>
  )
}

// Compact Optimizer Form
function OptimizerForm({ onSubmit, loading }) {
  const [market, setMarket] = useState('spread')
  const [seasonStart, setSeasonStart] = useState(2000)
  const [seasonEnd, setSeasonEnd] = useState(2023)
  const [minBets, setMinBets] = useState(50)
  const [monteCarloBets, setMonteCarloBets] = useState(100)
  const [includeSpread, setIncludeSpread] = useState(true)
  const [includeTemp, setIncludeTemp] = useState(false)
  const [includeWind, setIncludeWind] = useState(false)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({ market, seasonStart, seasonEnd, minBets, monteCarloBets, includeSpread, includeTemp, includeWind })
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.gridContainer}>
        <div style={styles.gridColumn}>
          <div style={styles.columnHeader}>Settings</div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Market</label>
            <select value={market} onChange={(e) => setMarket(e.target.value)} style={styles.inlineSelect} disabled={loading}>
              <option value="spread">Spread (ATS)</option>
              <option value="total">Totals (O/U)</option>
              <option value="moneyline">Moneyline</option>
            </select>
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Min Bets</label>
            <input type="number" value={minBets} onChange={(e) => setMinBets(parseInt(e.target.value))} min={20} max={200} style={styles.inlineInput} disabled={loading} />
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Seasons</label>
            <div style={styles.miniRangeRow}>
              <input type="number" value={seasonStart} onChange={(e) => setSeasonStart(parseInt(e.target.value))} min={1999} max={2023} style={styles.miniInput} disabled={loading} />
              <span style={styles.miniSeparator}>-</span>
              <input type="number" value={seasonEnd} onChange={(e) => setSeasonEnd(parseInt(e.target.value))} min={1999} max={2023} style={styles.miniInput} disabled={loading} />
            </div>
          </div>
        </div>

        <div style={styles.gridColumn}>
          <div style={styles.columnHeader}>Search Space</div>
          <label style={styles.miniCheckbox}>
            <input type="checkbox" checked={includeSpread} onChange={(e) => setIncludeSpread(e.target.checked)} disabled={loading} />
            Line ranges (spread/total)
          </label>
          <label style={styles.miniCheckbox}>
            <input type="checkbox" checked={includeTemp} onChange={(e) => setIncludeTemp(e.target.checked)} disabled={loading} />
            Temperature ranges
          </label>
          <label style={styles.miniCheckbox}>
            <input type="checkbox" checked={includeWind} onChange={(e) => setIncludeWind(e.target.checked)} disabled={loading} />
            Wind conditions
          </label>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>MC Bets</label>
            <input type="number" value={monteCarloBets} onChange={(e) => setMonteCarloBets(parseInt(e.target.value))} min={50} max={500} step={50} style={styles.inlineInput} disabled={loading} />
          </div>
        </div>

        <div style={styles.gridColumn}>
          <div style={styles.columnHeader}>Action</div>
          <div style={styles.optInfoBox}>
            Uses 5-fold cross-validation + Monte Carlo simulation to find statistically robust strategies.
          </div>
          <button type="submit" disabled={loading} style={styles.submitButton}>
            {loading ? 'Optimizing...' : '▶ Find Best Strategies'}
          </button>
        </div>
      </div>
    </form>
  )
}

// Compact Optimizer Results
function CompactOptimizerResults({ results, selectedStrategies, onToggleSelect }) {
  if (!results || !results.strategies) return null

  return (
    <div style={styles.optResultsContainer}>
      <div style={styles.optResultsMeta}>{results.message}</div>
      {results.strategies.length === 0 ? (
        <div style={styles.noResults}>No strategies found. Try lowering minimum bets.</div>
      ) : (
        <div style={styles.optStrategiesList}>
          {results.strategies.slice(0, 5).map((strategy, index) => (
            <CompactStrategyCard
              key={index}
              strategy={strategy}
              rank={index + 1}
              selected={selectedStrategies.has(index)}
              onToggleSelect={() => onToggleSelect(index)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// Player Props Form
function PlayerPropsForm({ onSubmit, loading }) {
  const [propType, setPropType] = useState('passing_yards')
  const [betSide, setBetSide] = useState('over')
  const [line, setLine] = useState(250)
  const [position, setPosition] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [seasonStart, setSeasonStart] = useState(2015)
  const [seasonEnd, setSeasonEnd] = useState(2023)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({
      prop_type: propType,
      bet_side: betSide,
      line: parseFloat(line),
      position: position || null,
      player_id: selectedPlayer?.player_id || null,
      player_name: selectedPlayer?.player_name || null,
      season_start: seasonStart,
      season_end: seasonEnd,
    })
  }

  // Get appropriate bet sides based on prop type
  const getBetSideOptions = () => {
    if (propType === 'anytime_td') {
      return [{ value: 'yes', label: 'Yes (Scores TD)' }]
    }
    return [
      { value: 'over', label: 'Over' },
      { value: 'under', label: 'Under' },
    ]
  }

  // Get default line based on prop type
  const getDefaultLine = (type) => {
    switch (type) {
      case 'passing_yards': return 250
      case 'rushing_yards': return 60
      case 'receiving_yards': return 50
      case 'receptions': return 4
      case 'passing_tds': return 1.5
      case 'anytime_td': return 0.5
      default: return 100
    }
  }

  const handlePropTypeChange = (newType) => {
    setPropType(newType)
    setLine(getDefaultLine(newType))
    if (newType === 'anytime_td') {
      setBetSide('yes')
    } else if (betSide === 'yes') {
      setBetSide('over')
    }
  }

  return (
    <form onSubmit={handleSubmit} style={styles.form}>
      <div style={styles.gridContainer}>
        {/* LEFT COLUMN: Prop Settings */}
        <div style={styles.gridColumn}>
          <div style={styles.columnHeader}>Prop Settings</div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Prop</label>
            <select
              value={propType}
              onChange={(e) => handlePropTypeChange(e.target.value)}
              style={styles.inlineSelect}
              disabled={loading}
            >
              {PROP_TYPES.map((pt) => (
                <option key={pt.value} value={pt.value}>{pt.label}</option>
              ))}
            </select>
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Side</label>
            <select
              value={betSide}
              onChange={(e) => setBetSide(e.target.value)}
              style={styles.inlineSelect}
              disabled={loading}
            >
              {getBetSideOptions().map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Line</label>
            <input
              type="number"
              value={line}
              onChange={(e) => setLine(e.target.value)}
              step={propType === 'receptions' || propType.includes('td') ? 0.5 : 5}
              style={styles.inlineInput}
              disabled={loading || propType === 'anytime_td'}
            />
          </div>
        </div>

        {/* MIDDLE COLUMN: Player Filter */}
        <div style={styles.gridColumn}>
          <div style={styles.columnHeader}>Player Filter</div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Position</label>
            <select
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              style={styles.inlineSelect}
              disabled={loading}
            >
              {POSITIONS.map((pos) => (
                <option key={pos.value} value={pos.value}>{pos.label}</option>
              ))}
            </select>
          </div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Player</label>
            <PlayerSearch
              value={selectedPlayer}
              onChange={setSelectedPlayer}
              position={position || null}
              placeholder="Any player..."
              disabled={loading}
            />
          </div>
          <div style={styles.propHint}>
            Leave player blank to test all players at the position
          </div>
        </div>

        {/* RIGHT COLUMN: Seasons + Action */}
        <div style={styles.gridColumn}>
          <div style={styles.columnHeader}>Backtest Range</div>
          <div style={styles.inlineField}>
            <label style={styles.inlineLabel}>Seasons</label>
            <div style={styles.miniRangeRow}>
              <input
                type="number"
                value={seasonStart}
                onChange={(e) => setSeasonStart(parseInt(e.target.value))}
                min={1999}
                max={2023}
                style={styles.miniInput}
                disabled={loading}
              />
              <span style={styles.miniSeparator}>-</span>
              <input
                type="number"
                value={seasonEnd}
                onChange={(e) => setSeasonEnd(parseInt(e.target.value))}
                min={1999}
                max={2023}
                style={styles.miniInput}
                disabled={loading}
              />
            </div>
          </div>
          <div style={styles.propInfoBox}>
            Tests historical player performance against your line. Uses standard -110 odds.
          </div>
          <button type="submit" disabled={loading} style={styles.submitButton}>
            {loading ? 'Testing...' : '▶ Test Prop Strategy'}
          </button>
        </div>
      </div>
    </form>
  )
}

// Compact Prop Results
function CompactPropResults({ data }) {
  if (!data) return null
  const { result, summary } = data
  const isProfit = result.roi_pct > 0

  return (
    <div style={styles.compactResultsContainer}>
      <div style={styles.compactResultsGrid}>
        <div style={{
          ...styles.compactVerdict,
          backgroundColor: isProfit ? '#e6ffe6' : '#ffe6e6',
          borderColor: isProfit ? '#00aa00' : '#aa0000',
        }}>
          <div style={styles.verdictText}>{isProfit ? '✓ PROFITABLE' : '✗ UNPROFITABLE'}</div>
          <div style={styles.roiHero}>
            <span style={{ color: isProfit ? '#00aa00' : '#aa0000' }}>
              {result.roi_pct > 0 ? '+' : ''}{result.roi_pct}%
            </span>
            <span style={styles.roiLabel}>ROI</span>
          </div>
        </div>
        <div style={styles.compactMetricsRow}>
          <div style={styles.compactMetric}>
            <span style={styles.compactMetricValue}>{result.total_bets}</span>
            <span style={styles.compactMetricLabel}>Bets</span>
          </div>
          <div style={styles.compactMetric}>
            <span style={styles.compactMetricValue}>{result.wins}-{result.losses}-{result.pushes}</span>
            <span style={styles.compactMetricLabel}>W-L-P</span>
          </div>
          <div style={styles.compactMetric}>
            <span style={styles.compactMetricValue}>{result.win_rate}%</span>
            <span style={styles.compactMetricLabel}>Win Rate</span>
          </div>
          <div style={styles.compactMetric}>
            <span style={styles.compactMetricValue}>{result.profit_units > 0 ? '+' : ''}{result.profit_units}u</span>
            <span style={styles.compactMetricLabel}>Profit</span>
          </div>
          <div style={styles.compactMetric}>
            <span style={styles.compactMetricValue}>{result.max_drawdown}u</span>
            <span style={styles.compactMetricLabel}>Max DD</span>
          </div>
        </div>
      </div>
      {summary && <div style={styles.compactSummary}>{summary}</div>}
    </div>
  )
}

// Compact Strategy Card
function CompactStrategyCard({ strategy, rank, selected, onToggleSelect }) {
  const projection = strategy.projection
  const isProfit = strategy.validation_roi_pct > 0

  return (
    <div style={{
      ...styles.optCard,
      borderColor: selected ? '#0070f3' : '#e0e0e0',
      borderWidth: selected ? '2px' : '1px',
    }}>
      <div style={styles.optCardHeader}>
        <input type="checkbox" checked={selected} onChange={onToggleSelect} style={styles.optCheckbox} />
        <span style={styles.optRank}>#{rank}</span>
        <span style={styles.optCardTitle}>{strategy.filters_description}</span>
      </div>
      <div style={styles.optCardMetrics}>
        <div style={styles.optMetric}>
          <span style={styles.optMetricLabel}>Sharpe</span>
          <span style={{
            ...styles.optMetricValue,
            color: strategy.validation_sharpe > 1 ? '#00aa00' : strategy.validation_sharpe > 0 ? '#666' : '#aa0000'
          }}>{strategy.validation_sharpe.toFixed(2)}</span>
        </div>
        <div style={styles.optMetric}>
          <span style={styles.optMetricLabel}>Val ROI</span>
          <span style={{
            ...styles.optMetricValue,
            color: isProfit ? '#00aa00' : '#aa0000'
          }}>{strategy.validation_roi_pct > 0 ? '+' : ''}{strategy.validation_roi_pct}%</span>
        </div>
        <div style={styles.optMetric}>
          <span style={styles.optMetricLabel}>Bets</span>
          <span style={styles.optMetricValue}>{strategy.total_bets}</span>
        </div>
        <div style={styles.optMetric}>
          <span style={styles.optMetricLabel}>Win%</span>
          <span style={styles.optMetricValue}>{strategy.win_rate_pct}%</span>
        </div>
        {projection && (
          <>
            <div style={styles.optMetric}>
              <span style={styles.optMetricLabel}>Prob Profit</span>
              <span style={{
                ...styles.optMetricValue,
                color: projection.probability_of_profit >= 60 ? '#00cc00' : projection.probability_of_profit >= 50 ? '#666' : '#cc0000'
              }}>{projection.probability_of_profit}%</span>
            </div>
            <div style={styles.optMetric}>
              <span style={styles.optMetricLabel}>½ Kelly</span>
              <span style={styles.optMetricValue}>{(projection.kelly_half * 100).toFixed(1)}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// Results display (legacy - kept for CinematicResults)
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

  // Optimizer state
  const [optLoading, setOptLoading] = useState(false)
  const [optResults, setOptResults] = useState(null)
  const [optError, setOptError] = useState(null)
  const [selectedStrategies, setSelectedStrategies] = useState(new Set())

  // Player Props state
  const [propLoading, setPropLoading] = useState(false)
  const [propResults, setPropResults] = useState(null)
  const [propError, setPropError] = useState(null)

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

      // Convert team names to abbreviations
      const teamAbbrev = filters.team ? (TEAM_ABBREV_MAP[filters.team] || filters.team) : null
      const opponentAbbrev = filters.opponent ? (TEAM_ABBREV_MAP[filters.opponent] || filters.opponent) : null

      const strategyInput = {
        name: strategyName,
        description: `Betting ${filters.bet_side} on ${filters.market}`,
        league: 'NFL',
        market: filters.market,
        bet_side: filters.bet_side,
        filters: backendFilters,
        team: teamAbbrev,
        opponent: opponentAbbrev,
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
    } catch (err) {
      setError(`Failed to run backtest: ${err.message}. Make sure the backend is running.`)
    } finally {
      setLoading(false)
    }
  }

  // Optimizer function
  const runOptimizer = async (config) => {
    setOptLoading(true)
    setOptError(null)
    setOptResults(null)

    try {
      const response = await fetch(`${API_URL}/optimize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          market: config.market,
          season_start: config.seasonStart,
          season_end: config.seasonEnd,
          n_folds: 5,
          min_bets: config.minBets,
          max_combinations: 5000,
          top_n: 10,
          filter_config: {
            include_spread: config.includeSpread,
            include_temperature: config.includeTemp,
            include_wind: config.includeWind,
          },
          run_monte_carlo: true,
          monte_carlo_simulations: 10000,
          monte_carlo_bets: config.monteCarloBets,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setOptResults(data)
    } catch (err) {
      setOptError(`Optimizer failed: ${err.message}`)
    } finally {
      setOptLoading(false)
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

  // Player Props backtest function
  const runPropBacktest = async (config) => {
    setPropLoading(true)
    setPropError(null)
    setPropResults(null)

    try {
      const strategyInput = {
        name: config.player_name
          ? `${config.player_name} ${config.bet_side} ${config.line}`
          : `All ${config.position || 'players'} ${config.bet_side} ${config.line}`,
        description: `Prop bet on ${config.prop_type}`,
        prop_type: config.prop_type,
        bet_side: config.bet_side,
        line: config.line,
        player_id: config.player_id,
        player_name: config.player_name,
        position: config.position,
        season_start: config.season_start,
        season_end: config.season_end,
        stake_unit: 1.0,
        odds: -110,
      }

      const response = await fetch(`${API_URL}/props/backtest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ strategy: strategyInput }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.detail || `HTTP ${response.status}`)
      }

      const data = await response.json()
      setPropResults(data)
    } catch (err) {
      setPropError(`Failed to run prop backtest: ${err.message}. Make sure player stats are ingested.`)
    } finally {
      setPropLoading(false)
    }
  }

  return (
    <div style={gradientStyle}>
      {/* Team Selector */}
      <div style={styles.topBar}>
        <h1 style={styles.titleInline}>Do My Bets Suck?</h1>
        <div style={styles.teamSelector}>
          <label style={styles.teamSelectorLabel}>Theme:</label>
          <select
            value={favoriteTeam}
            onChange={(e) => setFavoriteTeam(e.target.value)}
            style={styles.teamSelectorDropdown}
          >
            <option value="">Default</option>
            {NFL_TEAMS.filter(t => t).map((team) => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={styles.container}>
        {/* Strategy Builder */}
        <div style={styles.sectionBox}>
          <div style={styles.sectionHeader}>Strategy Tester</div>
          <StrategyForm onSubmit={runBacktest} loading={loading} />
        </div>

        {error && <div style={styles.error}>{error}</div>}

        {/* Inline Results */}
        {results && (
          <div style={styles.sectionBox}>
            <div style={styles.sectionHeader}>Backtest Results</div>
            <CompactResults data={results} />
          </div>
        )}

        {/* Optimizer */}
        <div style={styles.sectionBox}>
          <div style={styles.sectionHeader}>Strategy Optimizer</div>
          <OptimizerForm onSubmit={runOptimizer} loading={optLoading} />
        </div>

        {optError && <div style={styles.error}>{optError}</div>}

        {/* Optimizer Results */}
        {optResults && (
          <div style={styles.sectionBox}>
            <div style={styles.sectionHeader}>
              Top Strategies ({optResults.market.toUpperCase()})
            </div>
            <CompactOptimizerResults
              results={optResults}
              selectedStrategies={selectedStrategies}
              onToggleSelect={toggleStrategySelection}
            />
          </div>
        )}

        {/* Player Props Section */}
        <div style={styles.sectionBox}>
          <div style={styles.sectionHeader}>Player Props Backtester</div>
          <PlayerPropsForm onSubmit={runPropBacktest} loading={propLoading} />
        </div>

        {propError && <div style={styles.error}>{propError}</div>}

        {/* Player Props Results */}
        {propResults && (
          <div style={styles.sectionBox}>
            <div style={styles.sectionHeader}>Player Props Results</div>
            <CompactPropResults data={propResults} />
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  container: {
    maxWidth: '100%',
    margin: '0 auto',
    padding: '0 20px',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
    padding: '0 20px',
  },
  titleInline: {
    fontSize: '1.5rem',
    color: 'white',
    margin: 0,
    textShadow: '0 2px 4px rgba(0,0,0,0.3)',
  },
  sectionBox: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '10px',
    overflow: 'hidden',
  },
  sectionHeader: {
    backgroundColor: '#f8f9fa',
    padding: '8px 15px',
    fontSize: '13px',
    fontWeight: '700',
    color: '#333',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    borderBottom: '2px solid #0070f3',
  },
  // Compact Results Styles
  compactResultsContainer: {
    padding: '10px 15px',
  },
  compactResultsGrid: {
    display: 'flex',
    gap: '15px',
    alignItems: 'center',
  },
  compactVerdict: {
    padding: '10px 15px',
    borderRadius: '6px',
    border: '2px solid',
    textAlign: 'center',
    minWidth: '120px',
  },
  verdictText: {
    fontWeight: '700',
    fontSize: '11px',
    marginBottom: '4px',
  },
  roiHero: {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: '4px',
  },
  roiLabel: {
    fontSize: '11px',
    color: '#666',
  },
  compactMetricsRow: {
    display: 'flex',
    gap: '15px',
    flex: 1,
  },
  compactMetric: {
    textAlign: 'center',
  },
  compactMetricValue: {
    display: 'block',
    fontSize: '1.1rem',
    fontWeight: 'bold',
  },
  compactMetricLabel: {
    display: 'block',
    fontSize: '10px',
    color: '#666',
    textTransform: 'uppercase',
  },
  compactWarnings: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#fff3cd',
    borderRadius: '4px',
    fontSize: '11px',
  },
  compactSummary: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#555',
    lineHeight: '1.4',
  },
  // Optimizer Styles
  optInfoBox: {
    fontSize: '10px',
    color: '#666',
    padding: '8px',
    backgroundColor: '#f0f7ff',
    borderRadius: '4px',
    marginBottom: '8px',
    lineHeight: '1.4',
  },
  // Player Props Styles
  propHint: {
    fontSize: '10px',
    color: '#888',
    fontStyle: 'italic',
    marginTop: '4px',
  },
  propInfoBox: {
    fontSize: '10px',
    color: '#666',
    padding: '8px',
    backgroundColor: '#f0f7ff',
    borderRadius: '4px',
    marginBottom: '8px',
    lineHeight: '1.4',
  },
  optResultsContainer: {
    padding: '10px 15px',
  },
  optResultsMeta: {
    fontSize: '11px',
    color: '#666',
    marginBottom: '10px',
  },
  optStrategiesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  optCard: {
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    padding: '10px',
  },
  optCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
  },
  optCheckbox: {
    width: '14px',
    height: '14px',
  },
  optRank: {
    backgroundColor: '#0070f3',
    color: 'white',
    padding: '2px 8px',
    borderRadius: '10px',
    fontWeight: 'bold',
    fontSize: '11px',
  },
  optCardTitle: {
    fontWeight: '600',
    fontSize: '12px',
    flex: 1,
  },
  optCardMetrics: {
    display: 'flex',
    gap: '12px',
    flexWrap: 'wrap',
  },
  optMetric: {
    textAlign: 'center',
  },
  optMetricLabel: {
    display: 'block',
    fontSize: '9px',
    color: '#888',
    textTransform: 'uppercase',
  },
  optMetricValue: {
    display: 'block',
    fontSize: '13px',
    fontWeight: 'bold',
  },
  noResults: {
    textAlign: 'center',
    padding: '20px',
    color: '#666',
    fontSize: '12px',
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
    padding: '15px',
    borderRadius: '8px',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    marginBottom: '20px',
  },
  // New compact grid layout
  gridContainer: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '15px',
  },
  gridColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  columnHeader: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#333',
    borderBottom: '2px solid #0070f3',
    paddingBottom: '4px',
    marginBottom: '4px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  inlineField: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  inlineLabel: {
    fontSize: '12px',
    fontWeight: '500',
    color: '#555',
    minWidth: '55px',
    flexShrink: 0,
  },
  inlineInput: {
    flex: 1,
    padding: '4px 8px',
    fontSize: '13px',
    border: '1px solid #ccc',
    borderRadius: '3px',
  },
  inlineSelect: {
    flex: 1,
    padding: '4px 6px',
    fontSize: '13px',
    border: '1px solid #ccc',
    borderRadius: '3px',
  },
  miniRangeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    flex: 1,
  },
  miniInput: {
    width: '55px',
    padding: '4px 6px',
    fontSize: '12px',
    border: '1px solid #ccc',
    borderRadius: '3px',
    textAlign: 'center',
  },
  miniSeparator: {
    fontSize: '11px',
    color: '#888',
  },
  checkboxGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '4px',
    marginTop: '4px',
    padding: '6px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
  },
  miniCheckbox: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '11px',
    cursor: 'pointer',
  },
  presetsCompact: {
    marginTop: '8px',
    padding: '8px',
    backgroundColor: '#f8f9fa',
    borderRadius: '4px',
  },
  presetButtonsCompact: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
  },
  presetButtonSmall: {
    padding: '3px 8px',
    fontSize: '10px',
    backgroundColor: '#e9ecef',
    border: '1px solid #ced4da',
    borderRadius: '3px',
    cursor: 'pointer',
  },
  resetButtonSmall: {
    padding: '3px 8px',
    fontSize: '10px',
    backgroundColor: '#fff',
    border: '1px solid #dc3545',
    color: '#dc3545',
    borderRadius: '3px',
    cursor: 'pointer',
  },
  submitButton: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    fontWeight: 'bold',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '8px',
  },
  // Legacy styles (keeping for other components)
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
  compactRow: {
    display: 'flex',
    gap: '10px',
    flexWrap: 'wrap',
  },
  compactField: {
    flex: '1 1 200px',
    minWidth: '150px',
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
  // Range input styles
  rangeInputGroup: {
    marginBottom: '15px',
  },
  rangeLabel: {
    fontWeight: '500',
    fontSize: '14px',
    display: 'block',
    marginBottom: '8px',
    color: '#333',
  },
  rangeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  rangeInput: {
    flex: 1,
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxSizing: 'border-box',
  },
  rangeSeparator: {
    color: '#666',
    fontSize: '14px',
    fontWeight: '500',
  },
}
