/**
 * Stand-ins for the browser and engine APIs the games reach for, so their real
 * source can be loaded and driven headlessly.
 *
 * Everything here is deliberately dumb: it records what was asked for and
 * returns something chainable. The point is to exercise the games' own logic,
 * never to emulate Phaser or Web Audio.
 */

/* ------------------------------------------------------------- chainable mock */

/** Returns an object where any unknown method call returns the object itself. */
function chainable(extra) {
  const obj = Object.assign({}, extra);
  const p = new Proxy(obj, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (typeof prop === "symbol") return undefined;
      return () => p;
    },
  });
  return p;
}

/* -------------------------------------------------------------------- sprites */

const spriteBook = { live: 0 };

function makeSprite() {
  spriteBook.live++;
  let destroyed = false;
  return chainable({
    destroyed: false,
    destroy() {
      if (!destroyed) {
        destroyed = true;
        spriteBook.live--;
      }
      this.destroyed = true;
    },
  });
}

/* --------------------------------------------------------------------- Phaser */

const delayedCalls = [];

window.Phaser = {
  AUTO: 0,
  Scale: { FIT: 1, CENTER_BOTH: 2 },
  Input: { Keyboard: { KeyCodes: { SPACE: 32 } } },
  Game: function () {},
  Scene: class {
    constructor() {
      this.add = {
        graphics: () => chainable(),
        sprite: () => makeSprite(),
        text: () => chainable(),
        rectangle: () => chainable(),
        image: () => chainable(),
      };
      this.make = { graphics: () => chainable() };
      this.input = {
        keyboard: {
          createCursorKeys: () => ({
            left: { isDown: false },
            right: { isDown: false },
            up: { isDown: false },
            down: { isDown: false },
          }),
          addKey: () => ({ isDown: false }),
          once: () => {},
          on: () => {},
          off: () => {},
        },
      };
      this.time = {
        now: 0,
        delayedCall: (ms, fn) => {
          delayedCalls.push({ ms: ms, fn: fn });
        },
        addEvent: (cfg) => {
          delayedCalls.push(cfg);
          return chainable();
        },
      };
      this.tweens = { add: (cfg) => { if (cfg && cfg.onComplete) cfg.onComplete(); } };
      this.scene = { restart: () => {} };
      this.textures = { addCanvas: () => {} };
    }
  },
};

/* ---------------------------------------------------------------- Web Audio */

const audioBook = { contextsCreated: 0 };

class StubAudioContext {
  constructor() {
    audioBook.contextsCreated++;
    this.state = "running";
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = {};
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  createOscillator() {
    return {
      frequency: {
        value: 0,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        setTargetAtTime() {},
      },
      type: "sine",
      connect() {},
      disconnect() {},
      start() {},
      stop() {},
    };
  }
  createGain() {
    return {
      gain: {
        value: 0,
        setValueAtTime() {},
        linearRampToValueAtTime() {},
        exponentialRampToValueAtTime() {},
        setTargetAtTime() {},
      },
      connect() {},
      disconnect() {},
    };
  }
  createBiquadFilter() {
    return {
      type: "lowpass",
      frequency: {
        value: 0,
        setValueAtTime() {},
        exponentialRampToValueAtTime() {},
      },
      connect() {},
      disconnect() {},
    };
  }
  createBuffer(channels, length) {
    const data = new Float32Array(length);
    return { getChannelData: () => data };
  }
  createBufferSource() {
    return { buffer: null, connect() {}, disconnect() {}, start() {}, stop() {} };
  }
}

window.AudioContext = StubAudioContext;
window.webkitAudioContext = StubAudioContext;

/* ------------------------------------------------------------- localStorage */

// file:// origins are opaque, so real localStorage may be unavailable or shared
// between runs. A fresh in-memory store keeps suites deterministic.
(function stubLocalStorage() {
  const store = new Map();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => (store.has(String(k)) ? store.get(String(k)) : null),
      setItem: (k, v) => store.set(String(k), String(v)),
      removeItem: (k) => store.delete(String(k)),
      clear: () => store.clear(),
    },
  });
})();

/* ----------------------------------------------------- animation frame pump */

// Games call requestAnimationFrame to self-schedule. Swallow the callbacks so a
// headless run doesn't spin, but let a suite step frames deliberately.
const frameQueue = [];
window.requestAnimationFrame = function (fn) {
  frameQueue.push(fn);
  return frameQueue.length;
};

/** Runs exactly one queued frame with the given timestamp. */
function stepFrame(timestamp) {
  const pending = frameQueue.splice(0, frameQueue.length);
  for (const fn of pending) fn(timestamp);
}
