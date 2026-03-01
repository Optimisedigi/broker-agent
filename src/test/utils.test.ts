import { describe, it, expect } from 'vitest'
import {
  formatDuration,
  getFileExtension,
  formatCurrency,
  formatTime,
} from '../utils/formatters'

// ---------------------------------------------------------------------------
// formatDuration
// ---------------------------------------------------------------------------

describe('formatDuration', () => {
  it('returns "-" for undefined', () => {
    expect(formatDuration(undefined)).toBe('-')
  })

  it('returns "-" for 0 (falsy)', () => {
    expect(formatDuration(0)).toBe('-')
  })

  it('formats seconds under a minute', () => {
    expect(formatDuration(45)).toBe('0m 45s')
  })

  it('formats exact minutes with 0 seconds', () => {
    expect(formatDuration(120)).toBe('2m 0s')
  })

  it('formats a mix of minutes and seconds', () => {
    expect(formatDuration(90)).toBe('1m 30s')
  })

  it('formats large durations', () => {
    expect(formatDuration(3661)).toBe('61m 1s')
  })

  it('handles 1 second', () => {
    expect(formatDuration(1)).toBe('0m 1s')
  })
})

// ---------------------------------------------------------------------------
// getFileExtension
// ---------------------------------------------------------------------------

describe('getFileExtension', () => {
  it('extracts simple extension', () => {
    expect(getFileExtension('document.pdf')).toBe('pdf')
  })

  it('returns lowercase extension', () => {
    expect(getFileExtension('image.PNG')).toBe('png')
  })

  it('handles multiple dots (returns last segment)', () => {
    expect(getFileExtension('archive.tar.gz')).toBe('gz')
  })

  it('returns the full filename lowercased when no dot exists', () => {
    // 'Makefile'.split('.') => ['Makefile'], pop() => 'Makefile', toLowerCase => 'makefile'
    expect(getFileExtension('Makefile')).toBe('makefile')
  })

  it('handles dotfiles', () => {
    expect(getFileExtension('.gitignore')).toBe('gitignore')
  })

  it('handles empty string', () => {
    expect(getFileExtension('')).toBe('')
  })

  it('handles filename with trailing dot', () => {
    // 'file.' => split('.') => ['file', ''] => pop => '' => lowercase => ''
    expect(getFileExtension('file.')).toBe('')
  })
})

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe('formatCurrency', () => {
  it('formats millions with one decimal', () => {
    expect(formatCurrency(1_500_000)).toBe('$1.5M')
  })

  it('formats exactly 1 million', () => {
    expect(formatCurrency(1_000_000)).toBe('$1.0M')
  })

  it('formats thousands without decimals', () => {
    expect(formatCurrency(50_000)).toBe('$50K')
  })

  it('formats exactly 1000', () => {
    expect(formatCurrency(1_000)).toBe('$1K')
  })

  it('formats values under 1000 as plain dollar amount', () => {
    expect(formatCurrency(500)).toBe('$500')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0')
  })

  it('formats large millions', () => {
    expect(formatCurrency(25_000_000)).toBe('$25.0M')
  })

  it('rounds thousands', () => {
    // 1500 => $2K (Math.round via toFixed(0))
    expect(formatCurrency(1_500)).toBe('$2K')
  })

  it('rounds millions to one decimal', () => {
    // 2,700,000 / 1,000,000 = 2.7 => "$2.7M"
    expect(formatCurrency(2_700_000)).toBe('$2.7M')
  })
})

// ---------------------------------------------------------------------------
// formatTime
// ---------------------------------------------------------------------------

describe('formatTime', () => {
  it('formats zero seconds', () => {
    expect(formatTime(0)).toBe('00:00:00')
  })

  it('formats seconds only', () => {
    expect(formatTime(5)).toBe('00:00:05')
  })

  it('formats minutes and seconds', () => {
    expect(formatTime(125)).toBe('00:02:05')
  })

  it('formats hours, minutes, and seconds', () => {
    expect(formatTime(3661)).toBe('01:01:01')
  })

  it('formats large values', () => {
    expect(formatTime(86399)).toBe('23:59:59')
  })

  it('pads single digit values with leading zeros', () => {
    expect(formatTime(61)).toBe('00:01:01')
  })

  it('does not pad double digit values', () => {
    expect(formatTime(7384)).toBe('02:03:04')
  })
})
