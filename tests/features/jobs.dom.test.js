// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

const buildJobsDOM = (jobContents) => {
  const cards = jobContents.map((c) => `<div class="job-card-container">${c}</div>`).join('')
  document.body.innerHTML = `<div id="jobs-list">${cards}</div>`
  return document.querySelectorAll('.job-card-container')
}

let doJobs

beforeEach(async () => {
  vi.resetModules()
  vi.useFakeTimers()
  vi.stubGlobal('location', { pathname: '/jobs/' })
  doJobs = (await import('../../src/features/jobs.js')).default
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const neverTrigger = () => false
const baseConfig = { 'job-keywords': '', 'hide-promoted-jobs': false }

// ---------------------------------------------------------------------------
// Keyword matching
// ---------------------------------------------------------------------------

describe('job keyword matching', () => {
  it('hides a job card whose text contains a matched keyword', () => {
    const jobs = buildJobsDOM(['Senior Engineer', 'Marketing Manager', 'Junior Developer'])

    doJobs(neverTrigger, true, 'hide', { ...baseConfig, 'job-keywords': 'Senior' })
    vi.advanceTimersByTime(350)

    expect(jobs[0].classList.contains('hide')).toBe(true)
    expect(jobs[1].classList.contains('hide')).toBe(false)
    expect(jobs[2].classList.contains('hide')).toBe(false)
  })

  it('matches keywords case-insensitively', () => {
    const [job] = buildJobsDOM(['SENIOR ENGINEER'])

    doJobs(neverTrigger, true, 'hide', { ...baseConfig, 'job-keywords': 'senior' })
    vi.advanceTimersByTime(350)

    expect(job.classList.contains('hide')).toBe(true)
  })

  it('removes hide classes from cards that do not match', () => {
    const jobs = buildJobsDOM(['Marketing Manager', 'Senior Engineer'])
    jobs[0].classList.add('hide', 'showIcon')

    doJobs(neverTrigger, true, 'hide', { ...baseConfig, 'job-keywords': 'Senior' })
    vi.advanceTimersByTime(350)

    expect(jobs[0].classList.contains('hide')).toBe(false)
    expect(jobs[0].classList.contains('showIcon')).toBe(false)
  })

  it('does not start the interval when there are no keywords', () => {
    const jobs = buildJobsDOM(['Senior Engineer'])

    doJobs(neverTrigger, true, 'hide', baseConfig)
    vi.advanceTimersByTime(350)

    expect(jobs[0].classList.contains('hide')).toBe(false)
  })

  it('does not process jobs when not on /jobs/ path', () => {
    vi.stubGlobal('location', { pathname: '/feed/' })
    const jobs = buildJobsDOM(['Senior Engineer'])

    doJobs(neverTrigger, true, 'hide', { ...baseConfig, 'job-keywords': 'Senior' })
    vi.advanceTimersByTime(350)

    expect(jobs[0].classList.contains('hide')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Keyword removal resets hidden jobs
// ---------------------------------------------------------------------------

describe('keyword change handling', () => {
  it('un-hides a job when its keyword is removed from config', () => {
    const jobs = buildJobsDOM(['Senior Engineer', 'Marketing Manager'])

    // First call: hide Senior jobs
    doJobs(neverTrigger, true, 'hide', { ...baseConfig, 'job-keywords': 'Senior,Marketing' })
    vi.advanceTimersByTime(350)
    expect(jobs[0].classList.contains('hide')).toBe(true)

    // Second call: remove Senior keyword — resets and re-evaluates
    doJobs(neverTrigger, true, 'hide', { ...baseConfig, 'job-keywords': 'Marketing' })
    vi.advanceTimersByTime(350)

    expect(jobs[0].classList.contains('hide')).toBe(false)
    expect(jobs[1].classList.contains('hide')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// main-toggle guard
// ---------------------------------------------------------------------------

describe('main-toggle guard', () => {
  it('does not process jobs when main-toggle triggers off', () => {
    const jobs = buildJobsDOM(['Senior Engineer'])
    const triggerToggleOff = (field, bool) => field === 'main-toggle' && bool === false

    doJobs(triggerToggleOff, true, 'hide', { ...baseConfig, 'job-keywords': 'Senior' })
    vi.advanceTimersByTime(350)

    expect(jobs[0].classList.contains('hide')).toBe(false)
  })
})
