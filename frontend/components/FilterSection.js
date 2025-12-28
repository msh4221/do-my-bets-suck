'use client'

import { useState } from 'react'

/**
 * Collapsible filter section
 */
export default function FilterSection({ title, children, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div style={styles.container}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={styles.header}
      >
        <span style={styles.arrow}>{isOpen ? '▼' : '▶'}</span>
        <span style={styles.title}>{title}</span>
      </button>
      {isOpen && (
        <div style={styles.content}>
          {children}
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    marginBottom: '10px',
    border: '1px solid #e0e0e0',
    borderRadius: '6px',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    width: '100%',
    padding: '12px 15px',
    background: '#f8f9fa',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    textAlign: 'left',
  },
  arrow: {
    fontSize: '10px',
    color: '#666',
  },
  title: {
    flex: 1,
  },
  content: {
    padding: '15px',
    backgroundColor: 'white',
  },
}
