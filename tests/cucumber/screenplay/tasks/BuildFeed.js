export class BuildFeed {
  constructor(posts) {
    this.posts = posts;
  }

  static with(posts) {
    return new BuildFeed(posts);
  }

  performAs(world) {
    return world.buildFeedDOM(this.posts);
  }
}
