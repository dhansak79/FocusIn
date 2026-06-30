export class ClickElement {
  constructor(selector) {
    this.selector = selector;
  }

  static matching(selector) {
    return new ClickElement(selector);
  }

  performAs(world) {
    const el = world.document.querySelector(this.selector);
    if (!el) throw new Error(`No element found for selector: ${this.selector}`);
    el.dispatchEvent(new world.window.MouseEvent('click', { bubbles: true, cancelable: true }));
  }
}
