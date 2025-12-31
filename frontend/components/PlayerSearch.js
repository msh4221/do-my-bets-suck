'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * Searchable player dropdown with debounced autocomplete.
 */
export default function PlayerSearch({
  value,
  onChange,
  position = null,
  placeholder = 'Search player...',
  disabled = false,
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const wrapperRef = useRef(null)
  const debounceRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Debounced search
  const searchPlayers = useCallback(async (searchQuery) => {
    if (searchQuery.length < 2) {
      setResults([])
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({ query: searchQuery })
      if (position) {
        params.append('position', position)
      }
      const res = await fetch(`http://localhost:8000/players/search?${params}`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.players || [])
      }
    } catch (err) {
      console.error('Player search error:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [position])

  // Handle input change with debounce
  const handleInputChange = (e) => {
    const newQuery = e.target.value
    setQuery(newQuery)
    setIsOpen(true)

    // Clear previous timeout
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Debounce search by 300ms
    debounceRef.current = setTimeout(() => {
      searchPlayers(newQuery)
    }, 300)
  }

  // Handle player selection
  const handleSelect = (player) => {
    setSelectedPlayer(player)
    setQuery(player.name)
    setIsOpen(false)
    onChange({
      player_id: player.player_id,
      player_name: player.name,
      position: player.position,
      team: player.team,
    })
  }

  // Clear selection
  const handleClear = () => {
    setSelectedPlayer(null)
    setQuery('')
    setResults([])
    onChange(null)
  }

  return (
    <div ref={wrapperRef} style={styles.container}>
      <div style={styles.inputWrapper}>
        <input
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => query.length >= 2 && setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          style={styles.input}
        />
        {(selectedPlayer || query) && (
          <button
            type="button"
            onClick={handleClear}
            style={styles.clearButton}
            title="Clear"
          >
            x
          </button>
        )}
        {loading && <span style={styles.loader}>...</span>}
      </div>

      {isOpen && results.length > 0 && (
        <ul style={styles.dropdown}>
          {results.map((player) => (
            <li
              key={player.player_id}
              onClick={() => handleSelect(player)}
              style={styles.dropdownItem}
            >
              <span style={styles.playerName}>{player.name}</span>
              <span style={styles.playerMeta}>
                {player.position} - {player.team} ({player.last_season})
              </span>
            </li>
          ))}
        </ul>
      )}

      {isOpen && query.length >= 2 && !loading && results.length === 0 && (
        <div style={styles.noResults}>No players found</div>
      )}
    </div>
  )
}

const styles = {
  container: {
    position: 'relative',
    width: '100%',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  input: {
    width: '100%',
    padding: '6px 28px 6px 8px',
    fontSize: '12px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    outline: 'none',
  },
  clearButton: {
    position: 'absolute',
    right: '6px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#999',
    fontSize: '12px',
    padding: '2px 4px',
  },
  loader: {
    position: 'absolute',
    right: '24px',
    color: '#999',
    fontSize: '10px',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    maxHeight: '200px',
    overflowY: 'auto',
    background: 'white',
    border: '1px solid #ddd',
    borderTop: 'none',
    borderRadius: '0 0 4px 4px',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    zIndex: 100,
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  dropdownItem: {
    padding: '8px 10px',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    borderBottom: '1px solid #f0f0f0',
  },
  playerName: {
    fontWeight: '500',
    fontSize: '13px',
  },
  playerMeta: {
    fontSize: '11px',
    color: '#666',
  },
  noResults: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    padding: '8px 10px',
    background: 'white',
    border: '1px solid #ddd',
    borderTop: 'none',
    borderRadius: '0 0 4px 4px',
    fontSize: '12px',
    color: '#666',
    zIndex: 100,
  },
}
