const escapeHtml = (str) =>
  String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')

export const renderAuthorTally = (authorStats, containerEl) => {
  if (!containerEl) return
  const entries = Object.entries(authorStats || {})
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 20)

  if (!entries.length) {
    containerEl.innerHTML = '<div class="author-tally-empty">No posts blocked today</div>'
    return
  }

  containerEl.innerHTML = entries
    .map(([, { name, count }]) =>
      `<div class="author-tally-item"><span class="author-tally-name">${escapeHtml(name)}</span><span class="author-tally-count">${count}</span></div>`
    )
    .join('')
}

export const renderHallOfShame = (shameStats, containerEl) => {
  if (!containerEl) return
  const entries = Object.entries(shameStats || {})
    .sort(([, a], [, b]) => b.count - a.count)

  if (!entries.length) {
    containerEl.innerHTML = '<div class="author-tally-empty">No authors in the Hall of Shame yet — use the 🤖 button in the reaction picker to flag them.</div>'
    return
  }

  containerEl.innerHTML = entries
    .map(([, { name, count }]) =>
      `<div class="author-tally-item"><span class="author-tally-name">${escapeHtml(name)}</span><span class="author-tally-count">${count}</span></div>`
    )
    .join('')
}

export const renderDamageReport = (stats, { slopEl, filteredEl, signalsEl }) => {
  slopEl.textContent = stats.slopCollapsed || 0
  filteredEl.textContent = stats.postsFiltered || 0

  const topSignals = Object.entries(stats.signals || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)

  if (topSignals.length && signalsEl) {
    signalsEl.innerHTML = topSignals
      .map(
        ([signal, count]) =>
          `<div class="signal-item"><span class="signal-name">${escapeHtml(signal)}</span><span class="signal-count">${count}&times;</span></div>`
      )
      .join('')
  }
}
