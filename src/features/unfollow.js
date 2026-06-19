const getCsrfToken = () => {
  const match = document.cookie.match(/JSESSIONID="?([^";]+)/)
  return match?.[1] ?? null
}

export const unfollowAuthor = (vanityName) => {
  const csrfToken = getCsrfToken()
  if (!csrfToken) return Promise.reject(new Error('CSRF token not found'))
  return fetch(
    '/flagship-web/rsc-action/actions/server-request?sduiid=com.linkedin.sdui.requests.feed.updateFollowState',
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'csrf-token': csrfToken,
        'x-li-rsc-stream': 'true',
        'x-li-anchor-page-key': 'd_flagship3_feed',
      },
      body: JSON.stringify({
        requestId: 'com.linkedin.sdui.requests.feed.updateFollowState',
        serverRequest: {
          requestId: 'com.linkedin.sdui.requests.feed.updateFollowState',
          requestedArguments: {
            $type: 'proto.sdui.actions.requests.RequestedArguments',
            payload: {
              followStateType: 'FollowStateType_UNFOLLOW',
              memberUrnTypeName: 'proto_com_linkedin_common_MemberUrn',
              memberVanityName: vanityName,
              isSponsored: false,
            },
          },
        },
      }),
    }
  ).then((res) => {
    if (!res.ok) throw new Error(`Unfollow failed: ${res.status}`)
    return res
  })
}
