export class BannerContent {
  constructor(index) {
    this.index = index;
  }

  static before(index) {
    return new BannerContent(index);
  }

  answeredBy(world) {
    const posts = world.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])');
    const post = posts[this.index];
    if (!post) throw new Error(`No post at index ${this.index}`);
    const banner = post.previousElementSibling;
    return banner ? banner.textContent.trim() : null;
  }
}
