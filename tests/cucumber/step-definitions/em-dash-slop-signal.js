import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'node:assert/strict'
import { getSlopSignals, isSlop } from '../../../src/features/slop-detector.js'

Given('a post containing an em dash and no other slop signals', function () {
  this.slopText = 'This is a genuine post — written by a real person with no AI signals at all.'
})

Given('a post containing an em dash and one slop phrase', function () {
  this.slopText = 'This is a game-changer — it will transform the way we work.'
})

When('the slop score is calculated', function () {})

When('the slop signals are retrieved', function () {})

Then('the post is not detected as AI-generated', function () {
  assert.ok(!isSlop(this.slopText), `post should not be detected as slop: "${this.slopText}"`)
})

Then('the post is detected as AI-generated', function () {
  assert.ok(isSlop(this.slopText), `post should be detected as slop: "${this.slopText}"`)
})

Then('em dash is included in the returned signals', function () {
  assert.ok(getSlopSignals(this.slopText).includes('em dash'), 'signals should include "em dash"')
})
