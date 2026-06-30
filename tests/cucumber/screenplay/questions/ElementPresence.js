export class ElementPresence {
  constructor(selector) {
    this.selector = selector;
  }

  static matching(selector) {
    return new ElementPresence(selector);
  }

  answeredBy(world) {
    return !!world.document.querySelector(this.selector);
  }
}
