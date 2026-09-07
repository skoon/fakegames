/**
 * Arcade.Input — keyboard actions, shared across cabinets.
 *
 * Games ask for named actions rather than key codes, so rebinding is one place
 * and every cabinet answers to the same keys. It also resumes the audio context
 * on the first keypress, which is the gesture browsers require — each game used
 * to get that slightly wrong on its own.
 *
 * Gamepad support is deliberately absent for now; `matches()` is the only place
 * that would need to grow to add it.
 */
window.Arcade = window.Arcade || {};

Arcade.Input = (function () {
  const DEFAULT_MAP = {
    left: ["ArrowLeft", "KeyA"],
    right: ["ArrowRight", "KeyD"],
    up: ["ArrowUp", "KeyW"],
    down: ["ArrowDown", "KeyS"],
    fire: ["Space"],
    fire2: ["ShiftLeft", "ShiftRight"],
    start: ["Enter"],
  };

  let map = Object.assign({}, DEFAULT_MAP);
  const down = new Set(); // physically held right now
  const edges = new Set(); // pressed since the last justPressed() for that action
  let enabled = true;

  function codesFor(action) {
    return map[action] || [];
  }

  function matches(action, code) {
    return codesFor(action).indexOf(code) !== -1;
  }

  function actionsFor(code) {
    return Object.keys(map).filter((a) => matches(a, code));
  }

  window.addEventListener("keydown", function (e) {
    // The first key is our chance to satisfy the browser's autoplay gesture rule.
    Arcade.Audio && Arcade.Audio.context();

    if (!enabled) return;
    if (down.has(e.code)) return; // ignore auto-repeat

    down.add(e.code);
    for (const action of actionsFor(e.code)) edges.add(action);

    // Space and the arrows scroll the page otherwise.
    if (actionsFor(e.code).length) e.preventDefault();
  });

  window.addEventListener("keyup", function (e) {
    down.delete(e.code);
  });

  // A tab switch drops the keyup, leaving a key stuck down forever.
  window.addEventListener("blur", function () {
    down.clear();
    edges.clear();
  });

  return {
    /** True while any key bound to the action is held. */
    held(action) {
      if (!enabled) return false;
      return codesFor(action).some((code) => down.has(code));
    },

    /**
     * True once per physical press. Consuming: the edge is cleared by this
     * call, so read it from exactly one place per action per frame.
     */
    justPressed(action) {
      if (!enabled) return false;
      if (!edges.has(action)) return false;
      edges.delete(action);
      return true;
    },

    /** Merge overrides into the default map, e.g. {fire: ["Space", "KeyZ"]}. */
    bind(overrides) {
      map = Object.assign({}, map, overrides || {});
    },

    reset() {
      map = Object.assign({}, DEFAULT_MAP);
      down.clear();
      edges.clear();
      enabled = true;
    },

    /** Held low while a modal overlay (initials entry) owns the keyboard. */
    setEnabled(value) {
      enabled = !!value;
      if (!enabled) {
        down.clear();
        edges.clear();
      }
    },

    isEnabled() {
      return enabled;
    },

    /** Test seam: drive the input layer without synthesising DOM events. */
    _press(code) {
      if (!enabled || down.has(code)) return;
      down.add(code);
      for (const action of actionsFor(code)) edges.add(action);
    },

    _release(code) {
      down.delete(code);
    },
  };
})();
