// A Scottish rewrite never touches the post's own DOM — it soft-hides the
// (untouched) post and inserts a sibling card. While soft-hidden, the
// visible content is the card's rewritten text; once revealed, it's the
// real, original post.
const isShowingRewriteCard = (post, card) =>
  post.dataset.scottishRewritten === '1' &&
  post.classList.contains('focusedin-slop-soft-hide') &&
  card?.classList.contains('focusedin-scottish-rewrite');

export class PostContent {
  constructor(index) {
    this.index = index;
  }

  static of(index) {
    return new PostContent(index);
  }

  answeredBy(world) {
    const posts = world.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])');
    const post = posts[this.index];
    if (!post) throw new Error(`No post at index ${this.index}`);

    const isRewritten = post.dataset.scottishRewritten === '1';
    const card = post.previousElementSibling;
    if (isShowingRewriteCard(post, card)) {
      const body = card.querySelector('.focusedin-scottish-body');
      return { text: body?.textContent ?? '', isRewritten: true };
    }

    const textEl = post.querySelector('[data-testid="expandable-text-box"]') ??
      post.querySelector('.update-components-text') ??
      post;
    return { text: textEl.textContent, isRewritten };
  }
}
