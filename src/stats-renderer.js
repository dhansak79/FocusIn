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
          `<div class="signal-item"><span class="signal-name">${signal}</span><span class="signal-count">${count}&times;</span></div>`
      )
      .join('')
  }
}
