import {
  LIKED_KEYWORDS,
  SUGGESTED_KEYWORD,
} from '../constants.js'

const AGE_UNITS = [
  { name: 'hour',  suffix: 'h •',  from: 2, to: 24 },
  { name: 'day',   suffix: 'd •',  from: 2, to: 30 },
  { name: 'week',  suffix: 'w •',  from: 2, to: 4  },
  { name: 'month', suffix: 'mo •', from: 2, to: 12 },
  { name: 'year',  suffix: 'y •',  from: 2, to: 5  },
]

const KEYWORD_FLAGS = [
  ['hide-liked',     LIKED_KEYWORDS],
  ['hide-suggested', [SUGGESTED_KEYWORD]],
]

const handleAgeFiltering = (keywords, age) => {
  const startIndex = AGE_UNITS.findIndex((u) => u.name === age)
  if (startIndex === -1) return

  const { suffix, from, to } = AGE_UNITS[startIndex]
  for (let x = from; x <= to; x++) {
    keywords.push(`${x}${suffix}`)
  }

  for (let i = startIndex + 1; i < AGE_UNITS.length; i++) {
    keywords.push(AGE_UNITS[i].suffix)
  }
}

export const getFeedKeywords = (config) => {
  const keywords =
    config['feed-keywords'] === '' ? [] : config['feed-keywords'].split(',')

  handleAgeFiltering(keywords, config['hide-by-age'])

  for (const [flag, values] of KEYWORD_FLAGS) {
    if (config[flag]) keywords.push(...values)
  }

  console.log('LinkOff: Current feed keywords are', keywords)

  return keywords
}
