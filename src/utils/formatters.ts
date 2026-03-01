/**
 * Format a duration in seconds to "Xm Ys" format.
 * Returns '-' if seconds is falsy (undefined, null, 0).
 */
export function formatDuration(seconds?: number): string {
  if (!seconds) return '-'
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}m ${secs}s`
}

/**
 * Extract the lowercase file extension from a filename.
 * Returns empty string if no extension found.
 */
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || ''
}

/**
 * Format a currency value with shorthand suffixes.
 * >= 1M -> "$X.XM", >= 1K -> "$XK", otherwise "$X"
 */
export function formatCurrency(value: number): string {
  if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`
  return `$${value}`
}

/**
 * Format seconds into "HH:MM:SS" with zero-padding.
 */
export function formatTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0')
  const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0')
  const secs = (seconds % 60).toString().padStart(2, '0')
  return `${hrs}:${mins}:${secs}`
}
