export class RunFeed {
  constructor(config) {
    this.config = config;
  }

  static withConfig(config) {
    return new RunFeed(config);
  }

  async performAs(world) {
    await world.initFeed();
    global.chrome = world.chromeMock;
    await world.doFeed(this.config);
    world.clock.tick(850);
  }
}
