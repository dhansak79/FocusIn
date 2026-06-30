export const SLOP_POST = [
  "In today's fast-paced world, thought leadership matters.",
  'Let that sink in.',
  'Game-changer.',
  'Leverage your potential.',
  'Key takeaways below.',
  '🚀 💡 🔥 💪 ⚡ 🎯',
].join('<br>')

export const CLEAN_POST = 'We shipped a new feature today. The team is proud of the work done.'

export const SLOP_WITH_ACTOR = `<a href="/in/john-doe/"><div aria-label="John Doe Profile 2nd">John Doe</div></a><br>${SLOP_POST}`

export const CLEAN_WITH_ACTOR = `<a href="/in/jane-smith/"><div aria-label="Jane Smith Profile 1st">Jane Smith</div></a>${CLEAN_POST}`

export const POST_WITH_AUTHOR = `<a href="/in/grace-hopper/"><strong>Grace Hopper</strong></a>${CLEAN_POST}`

export const SLOP_WITH_NAMED_ACTOR = `<a href="/in/john-doe/"><div aria-label="John Doe Profile 2nd">John Doe</div></a><br>${SLOP_POST}`

export const PROMOTED_POST = `
  <p><span>Promoted</span></p>
  <p data-testid="expandable-text-box">Buy our amazing product now!</p>
`

export const PROMOTED_POST_NO_TEXTBOX = `
  <p><span>Promoted</span></p>
  <img src="ad.jpg" alt="Advertisement">
`

export const PROMOTED_POST_WITH_AUTHOR = `
  <a href="/in/grace-hopper/"><div aria-label="Grace Hopper Profile 1st">Grace Hopper</div></a>
  <p><span>Promoted</span></p>
  <p data-testid="expandable-text-box">Buy our amazing product now!</p>
`

export const POST_WITH_PROMOTED_IN_BODY = `
  <p data-testid="expandable-text-box">Our campaign was Promoted across all channels this quarter.</p>
`

export const REACTIONS_BAR = `
  <div class="action-bar">
    <div class="reaction-group">
      <button type="button" aria-label="Reaction button state: no reaction">👍</button>
      <button type="button" aria-label="Open reactions menu" aria-expanded="false">^</button>
    </div>
    <button type="button" aria-label="Comment">Comment</button>
  </div>
`

export const POST_WITH_REACTIONS = `
  <a href="/in/john-doe/"><div aria-label="John Doe Profile 1st">John Doe</div></a>
  ${CLEAN_POST}
  ${REACTIONS_BAR}
`

export const baseConfig = {
  'main-toggle': true,
  'feed-keywords': '',
  'detect-slop': false,
  'slop-archetype': false,
  'semantic-filter': '',
  'tone-filter': false,
  'tone-threshold': 70,
  'author-whitelist': [],
  'hide-promoted': false,
}
