export class PostVisibility {
  constructor(index) {
    this.index = index;
  }

  static of(index) {
    return new PostVisibility(index);
  }

  answeredBy(world) {
    const posts = world.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])');
    const post = posts[this.index];
    if (!post) throw new Error(`No post at index ${this.index}`);
    const hidden = post.style.display === 'none' || post.hidden ||
      post.classList.contains('focusedin-slop-soft-hide') ||
      post.classList.contains('hide');
    const banner = post.previousElementSibling;
    const hasBanner = !!(banner && banner.dataset.focusinBanner);
    return { hidden, hasBanner };
  }
}
