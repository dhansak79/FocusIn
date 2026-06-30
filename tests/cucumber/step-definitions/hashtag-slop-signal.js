import { When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { getSlopScore, getSlopSignals, isSlop } from '../../../src/features/slop-detector.js'

const makePostWithHashtags = (count) => {
  const tags = Array.from({ length: count }, (_, i) => `#tag${i + 1}`).join(' ')
  return `We shipped a great feature today. The team did excellent work.\n${tags}`
}

When(/the slop detector evaluates a post whose text contains exactly 5 hashtag tokens/, function () {
  this.slopText = makePostWithHashtags(5)
})

When(/the slop detector evaluates a post whose text contains more than 5 hashtag tokens/, function () {
  this.slopText = makePostWithHashtags(8)
})

Then(/`getSlopScore` includes 1 point for the hashtag signal/, function () {
  assert.ok(getSlopScore(this.slopText) >= 1, 'score should include hashtag signal point')
})

Then(/`getSlopSignals` includes `"hashtag spam"` in the returned array/, function () {
  assert.ok(getSlopSignals(this.slopText).includes('hashtag spam'), 'signals should include "hashtag spam"')
})

When(/the slop detector evaluates a post whose text contains 4 or fewer hashtag tokens/, function () {
  this.slopText = makePostWithHashtags(4)
})

Then(/`getSlopScore` does not include a point for the hashtag signal/, function () {
  assert.ok(!getSlopSignals(this.slopText).includes('hashtag spam'), '"hashtag spam" should not be in signals')
})

Then(/`getSlopSignals` does not include `"hashtag spam"`/, function () {
  assert.ok(!getSlopSignals(this.slopText).includes('hashtag spam'), '"hashtag spam" should not appear with < 5 tags')
})

When(/the slop detector evaluates a post with no hashtag tokens/, function () {
  this.slopText = 'We shipped a great feature today. The team did excellent work.'
})

When(/a post contains 5 or more hashtags/, function () {
  this.slopText = makePostWithHashtags(6)
})

When(/the post also triggers at least one other 1-point signal \(e\.g\. emoji overload, emoji bullets\)/, function () {
  this.slopText = `${this.slopText}\n🚀 💡 🔥 💪 ⚡`
})

Then(/the combined score reaches or exceeds the slop threshold and `isSlop` returns true/, function () {
  assert.ok(isSlop(this.slopText), `combined signals should reach slop threshold for: "${this.slopText}"`)
})
