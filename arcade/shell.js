/**
 * Arcade.Shell — the cabinet furniture every game shares.
 *
 * Injects the back-to-arcade link, owns P / M / Esc, and draws the pause
 * overlay. Games opt in with `Arcade.Shell.init({ game: "tempest" })`.
 *
 * Pause can't be owned outright because the seven games run three different
 * loop shapes, so the contract is deliberately small:
 *   - canvas games check `Arcade.Shell.paused` in the gate they already have
 *   - Phaser games pass `onPause` / `onResume` and suspend their own scene
 *
 * Games that measure with the wall clock (Tempest's fire rate) should read
 * `Arcade.Shell.now()` instead of `Date.now()`, so a pause doesn't show up as a
 * gigantic elapsed time on resume.
 */
window.Arcade = window.Arcade || {};

Arcade.Shell = (function () {
  let paused = false;
  let pausedMs = 0; // total time spent paused
  let pausedAt = 0;
  let opts = {};
  let overlay = null;
  let muteTag = null;
  let started = false;

  function buildChrome() {
    if (opts.back !== false) {
      const link = document.createElement("a");
      link.className = "arcade-back";
      link.href = opts.back || "../index.html";
      link.textContent = "◀ ARCADE";
      document.body.appendChild(link);
    }

    overlay = document.createElement("div");
    overlay.className = "arcade-pause";
    overlay.hidden = true;
    overlay.innerHTML =
      '<div class="arcade-pause-box">' +
      "<h2>PAUSED</h2>" +
      '<p><b>P</b> resume &middot; <b>M</b> mute &middot; <b>ESC</b> arcade</p>' +
      "</div>";
    document.body.appendChild(overlay);

    muteTag = document.createElement("div");
    muteTag.className = "arcade-muted";
    muteTag.textContent = "MUTED";
    muteTag.hidden = true;
    document.body.appendChild(muteTag);
  }

  function setPaused(value) {
    const next = !!value;
    if (next === paused) return paused;
    paused = next;

    if (paused) {
      pausedAt = Date.now();
      if (overlay) overlay.hidden = false;
      if (opts.onPause) opts.onPause();
    } else {
      pausedMs += Date.now() - pausedAt;
      if (overlay) overlay.hidden = true;
      if (opts.onResume) opts.onResume();
    }
    return paused;
  }

  function setMuted(value) {
    const muted = Arcade.Audio ? Arcade.Audio.mute(value) : !!value;
    if (muteTag) muteTag.hidden = !muted;
    return muted;
  }

  function onKey(e) {
    if (e.key === "p" || e.key === "P") {
      setPaused(!paused);
      e.preventDefault();
    } else if (e.key === "m" || e.key === "M") {
      setMuted(!(Arcade.Audio && Arcade.Audio.isMuted()));
      e.preventDefault();
    } else if (e.key === "Escape" && opts.back !== false) {
      window.location.href = opts.back || "../index.html";
    }
  }

  return {
    /**
     *   game      key for Arcade.Scores
     *   back      href for the back link, or false to omit it
     *   onPause   called when the game is paused (Phaser: scene.pause())
     *   onResume  called when it resumes
     */
    init(options) {
      opts = options || {};
      if (started) return this;
      started = true;
      buildChrome();
      window.addEventListener("keydown", onKey);
      return this;
    },

    get paused() {
      return paused;
    },

    get game() {
      return opts.game;
    },

    pause() {
      return setPaused(true);
    },

    resume() {
      return setPaused(false);
    },

    togglePause() {
      return setPaused(!paused);
    },

    /** Milliseconds spent paused so far. */
    pausedTotal() {
      return pausedMs + (paused ? Date.now() - pausedAt : 0);
    },

    /** A wall clock that stands still while paused. Use instead of Date.now(). */
    now() {
      return Date.now() - this.pausedTotal();
    },

    /**
     * Scales a game to fit the window.
     *
     * Tempest is 800x800 and Pole Position 1024x768 before their HUD, so
     * neither fits a laptop screen. CSS on the canvas alone will not do it:
     * every HUD, overlay and results panel is absolutely positioned in pixels
     * against the container, so scaling the canvas would leave them behind.
     * Scaling the whole container about its centre keeps them together.
     *
     * The two Phaser games use Phaser's own Scale.FIT and do not call this.
     */
    fit(selector, options) {
      const el = document.querySelector(selector);
      if (!el) return null;

      // The back link and pause overlay are position:fixed children of body. A
      // transformed ancestor would make them relative to it instead of the
      // viewport, so body itself must never be the thing that scales.
      if (el === document.body || el === document.documentElement) {
        console.warn("Arcade.Shell.fit: scale an inner container, not " + selector);
        return null;
      }

      // Named cfg, not opts: the module-level `opts` belongs to init().
      const cfg = options || {};
      const margin = cfg.margin === undefined ? 24 : cfg.margin;

      function apply() {
        // Measure unscaled, or each pass would compound the last one.
        el.style.transform = "none";
        const width = el.offsetWidth;
        const height = el.offsetHeight;
        if (!width || !height) return;

        const scale = Math.min(
          1,
          (window.innerWidth - margin) / width,
          (window.innerHeight - margin) / height
        );

        el.style.transformOrigin = "center center";
        el.style.transform = "scale(" + scale + ")";
      }

      apply();
      window.addEventListener("resize", apply);
      return apply;
    },

    /** Test seam. */
    _reset() {
      paused = false;
      pausedMs = 0;
      pausedAt = 0;
      if (overlay) overlay.hidden = true;
    },
  };
})();
