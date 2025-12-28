'use client'

import { useState, useCallback } from 'react'

/**
 * Dual-handle range slider component
 */
export default function RangeSlider({
  label,
  min,
  max,
  step = 1,
  value,  // [minVal, maxVal]
  onChange,
  formatValue = (v) => v,
  disabled = false,
}) {
  const [minVal, maxVal] = value

  const handleMinChange = (e) => {
    const newMin = Math.min(Number(e.target.value), maxVal - step)
    onChange([newMin, maxVal])
  }

  const handleMaxChange = (e) => {
    const newMax = Math.max(Number(e.target.value), minVal + step)
    onChange([minVal, newMax])
  }

  // Calculate positions for the filled track
  const minPercent = ((minVal - min) / (max - min)) * 100
  const maxPercent = ((maxVal - min) / (max - min)) * 100

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span style={styles.label}>{label}</span>
        <span style={styles.values}>
          {formatValue(minVal)} — {formatValue(maxVal)}
        </span>
      </div>
      <div style={styles.sliderContainer}>
        <div style={styles.track} />
        <div
          style={{
            ...styles.filledTrack,
            left: `${minPercent}%`,
            width: `${maxPercent - minPercent}%`,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={minVal}
          onChange={handleMinChange}
          disabled={disabled}
          style={styles.slider}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={maxVal}
          onChange={handleMaxChange}
          disabled={disabled}
          style={styles.slider}
        />
      </div>
    </div>
  )
}

const styles = {
  container: {
    marginBottom: '15px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  label: {
    fontWeight: '500',
    fontSize: '14px',
  },
  values: {
    fontSize: '14px',
    color: '#666',
    fontFamily: 'monospace',
  },
  sliderContainer: {
    position: 'relative',
    height: '20px',
  },
  track: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '100%',
    height: '4px',
    backgroundColor: '#ddd',
    borderRadius: '2px',
  },
  filledTrack: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    height: '4px',
    backgroundColor: '#0070f3',
    borderRadius: '2px',
  },
  slider: {
    position: 'absolute',
    width: '100%',
    height: '20px',
    appearance: 'none',
    WebkitAppearance: 'none',
    background: 'transparent',
    pointerEvents: 'none',
    top: 0,
    // Thumb styling via CSS
  },
}
