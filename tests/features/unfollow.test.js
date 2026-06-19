// @vitest-environment jsdom
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { unfollowAuthor } from '../../src/features/unfollow.js'

describe('unfollowAuthor', () => {
  beforeEach(() => {
    vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue('JSESSIONID=ajax:12345')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('rejects when no CSRF token is found in cookies', async () => {
    vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue('')
    await expect(unfollowAuthor('test-user')).rejects.toThrow('CSRF token not found')
  })

  it('calls fetch with the correct URL', async () => {
    await unfollowAuthor('test-user')
    expect(fetch).toHaveBeenCalledWith(
      '/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.requests.feed.updateFollowState',
      expect.any(Object)
    )
  })

  it('uses POST method with credentials: include', async () => {
    await unfollowAuthor('test-user')
    const options = fetch.mock.calls[0][1]
    expect(options.method).toBe('POST')
    expect(options.credentials).toBe('include')
  })

  it('sends correct headers including CSRF token', async () => {
    await unfollowAuthor('test-user')
    const { headers } = fetch.mock.calls[0][1]
    expect(headers['Content-Type']).toBe('application/json')
    expect(headers['csrf-token']).toBe('ajax:12345')
    expect(headers['x-li-rsc-stream']).toBe('true')
    expect(headers['x-li-anchor-page-key']).toBe('d_flagship3_feed')
  })

  it('extracts CSRF token from a quoted JSESSIONID cookie value', async () => {
    vi.spyOn(Document.prototype, 'cookie', 'get').mockReturnValue('JSESSIONID="ajax:99999"')
    await unfollowAuthor('test-user')
    expect(fetch.mock.calls[0][1].headers['csrf-token']).toBe('ajax:99999')
  })

  it('sends the correct payload shape with the vanity name', async () => {
    await unfollowAuthor('jane-smith')
    const body = JSON.parse(fetch.mock.calls[0][1].body)
    expect(body.requestId).toBe('com.linkedin.sdui.requests.feed.updateFollowState')
    const payload = body.serverRequest.requestedArguments.payload
    expect(payload.followStateType).toBe('FollowStateType_UNFOLLOW')
    expect(payload.memberUrnTypeName).toBe('proto_com_linkedin_common_MemberUrn')
    expect(payload.memberVanityName).toBe('jane-smith')
    expect(payload.isSponsored).toBe(false)
  })

  it('resolves on a 2xx response', async () => {
    await expect(unfollowAuthor('test-user')).resolves.toBeDefined()
  })

  it('rejects on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403 }))
    await expect(unfollowAuthor('test-user')).rejects.toThrow('Unfollow failed: 403')
  })

  it('rejects on a network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
    await expect(unfollowAuthor('test-user')).rejects.toThrow('Network error')
  })
})
