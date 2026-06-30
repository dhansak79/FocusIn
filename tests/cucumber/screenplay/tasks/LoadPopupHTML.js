import { JSDOM } from 'jsdom';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POPUP_HTML = join(__dirname, '../../../../src/popup/popup.html');

export class LoadPopupHTML {
  static async performAs(world) {
    world.popupDom = await JSDOM.fromFile(POPUP_HTML, {
      url: 'chrome-extension://test/popup.html',
    });
    world.popupDocument = world.popupDom.window.document;
  }
}
