import { JSDOM } from 'jsdom';
import { setWorldConstructor, Before, After } from '@cucumber/cucumber';
import FakeTimers from '@sinonjs/fake-timers';
import esmock from 'esmock';
import { rmSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { resetStatsState } from '../../../src/stats.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../../..');

const DOM_GLOBALS = [
  'document', 'window', 'self', 'Node', 'Element', 'HTMLElement', 'MutationObserver',
  'requestAnimationFrame', 'cancelAnimationFrame', 'getComputedStyle',
  'CustomEvent', 'MouseEvent', 'Event',
];

class FocusInWorld {
  constructor() {
    this.dom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
      url: 'https://www.linkedin.com/feed/',
      pretendToBeVisual: true,
    });
    this.document = this.dom.window.document;
    this.window = this.dom.window;
    this.storageSets = [];
    this.storageData = { 'author-whitelist': [] };
    this.unfollowResult = Promise.resolve({});
    this.chromeMock = this._makeChromeMock({});
    this.scriptResult = null;
    this.swampData = null;
  }

  _makeChromeMock(responses = {}) {
    return {
      runtime: {
        lastError: null,
        sendMessage: (msg, cb) => {
          for (const [key, value] of Object.entries(responses)) {
            if (msg[key]) return cb(value);
          }
          cb({ score: 0 });
        },
      },
      storage: {
        local: {
          get: (_keys, cb) => cb({ ...this.storageData }),
          set: (data, cb) => {
            this.storageSets.push(data);
            Object.assign(this.storageData, data);
            if (cb) cb();
          },
        },
      },
    };
  }

  setChromeMockResponses(responses) {
    this.chromeMock = this._makeChromeMock(responses);
  }

  buildFeedDOM(postContents) {
    const postDivs = postContents.map((c) => `<div>${c}</div>`).join('');
    this.document.body.innerHTML = `
      <div data-testid="mainFeed" data-component-type="LazyColumn" componentkey="container-update-list_mainFeed-lazy-container">
        <div data-lazy-mount-id="test-mount" style="display:contents">
          ${postDivs}
        </div>
      </div>`;
    return this.document.querySelectorAll('[data-testid="mainFeed"] > div[data-lazy-mount-id] > div:not([data-focusin-injected])');
  }

  attemptsTo(task) {
    return task.performAs(this);
  }

  asksAbout(question) {
    return question.answeredBy(this);
  }
}

Before(async function () {
  // Install JSDOM globals so feed.js can use document/window/Node etc.
  for (const key of DOM_GLOBALS) {
    if (this.dom.window[key] !== undefined) {
      global[key] = this.dom.window[key];
    }
  }

  this.clock = FakeTimers.install();

  const world = this;
  const feedModule = await esmock(join(ROOT, 'src/features/feed.js'), {
    [join(ROOT, 'src/lib/transformers.min.js')]: {
      pipeline: async () => async () => [{ label: 'NEGATIVE', score: 0 }],
      env: { backends: { onnx: { wasm: {} } } },
    },
    [join(ROOT, 'src/features/unfollow.js')]: {
      unfollowAuthor: () => world.unfollowResult,
    },
  });
  this.doFeed = feedModule.default;
  if (feedModule.resetFeedState) feedModule.resetFeedState();
  resetStatsState();
});

After(function () {
  if (this.clock) this.clock.uninstall();
  delete global.chrome;
  for (const key of DOM_GLOBALS) {
    delete global[key];
  }
  if (this.tmpWipFeature) {
    try { rmSync(this.tmpWipFeature); } catch (_) { /* ignore */ }
    delete this.tmpWipFeature;
  }
});

setWorldConstructor(FocusInWorld);
