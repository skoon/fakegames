/**
 * Arcade.Audio — one Web Audio context for the whole cabinet.
 *
 * Every game used to build its own. Tempest built a fresh AudioContext per
 * sound effect and went permanently silent once the browser's limit was hit.
 * There is exactly one context here, created on demand, behind a master gain
 * so muting is a single knob.
 */
window.Arcade = window.Arcade || {};

Arcade.Audio = (function () {
  let ctx = null;
  let master = null;
  let muted = false;

  /** The shared context, created on first use and resumed if suspended. */
  function context() {
    if (!ctx) {
      const Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
    }
    // Browsers start the context suspended until a real user gesture.
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  /**
   * A single note.
   *   freq     Hz
   *   duration seconds (default 0.12)
   *   type     oscillator type (default "square")
   *   volume   0..1 (default 0.2)
   *   slideTo  Hz to glide to across the note — laser zaps, falling bombs
   *   delay    seconds to wait before it sounds
   */
  function tone(freq, opts) {
    const o = opts || {};
    const c = context();
    if (!c) return;

    const duration = o.duration === undefined ? 0.12 : o.duration;
    const volume = o.volume === undefined ? 0.2 : o.volume;
    const at = c.currentTime + (o.delay || 0);

    const osc = c.createOscillator();
    const gain = c.createGain();

    osc.type = o.type || "square";
    osc.frequency.setValueAtTime(freq, at);
    if (o.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(1, o.slideTo),
        at + duration
      );
    }

    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);

    osc.connect(gain);
    gain.connect(master);
    osc.start(at);
    osc.stop(at + duration + 0.02);
  }

  /**
   * A filtered noise burst — explosions, crashes, rocks breaking.
   *   duration   seconds (default 0.3)
   *   volume     0..1 (default 0.3)
   *   filterFrom lowpass cutoff at the start (default 1000)
   *   filterTo   lowpass cutoff at the end (default 100)
   */
  function noise(opts) {
    const o = opts || {};
    const c = context();
    if (!c) return;

    const duration = o.duration === undefined ? 0.3 : o.duration;
    const volume = o.volume === undefined ? 0.3 : o.volume;
    const now = c.currentTime;

    const buffer = c.createBuffer(
      1,
      Math.max(1, Math.floor(c.sampleRate * duration)),
      c.sampleRate
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const source = c.createBufferSource();
    source.buffer = buffer;

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(o.filterFrom || 1000, now);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(1, o.filterTo || 100),
      now + duration
    );

    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
  }

  /**
   * A repeating note sequence.
   *
   * `setTempo` is here because Space Invaders and Asteroids both accelerate
   * their bassline as the field thins — the one music behaviour worth sharing.
   * `notes` entries are frequencies in Hz; null is a rest.
   */
  function loop(opts) {
    const o = opts || {};
    const notes = o.notes || [110];
    const type = o.type || "square";
    const volume = o.volume === undefined ? 0.1 : o.volume;
    const noteDuration = o.noteDuration === undefined ? 0.08 : o.noteDuration;

    let tempo = o.tempo === undefined ? 400 : o.tempo;
    let timer = null;
    let index = 0;
    let running = false;

    function beat() {
      if (!running) return;
      const freq = notes[index];
      if (freq) tone(freq, { duration: noteDuration, type: type, volume: volume });
      index = (index + 1) % notes.length;
      timer = setTimeout(beat, tempo);
    }

    return {
      start() {
        if (running) return;
        running = true;
        index = 0;
        beat();
      },
      stop() {
        running = false;
        if (timer) clearTimeout(timer);
        timer = null;
      },
      setTempo(ms) {
        tempo = Math.max(20, ms);
      },
      isPlaying() {
        return running;
      },
    };
  }

  function setMuted(value) {
    muted = !!value;
    if (master && ctx) {
      master.gain.setValueAtTime(muted ? 0 : 1, ctx.currentTime);
    }
    return muted;
  }

  /**
   * The node every sound is routed through, so it obeys mute.
   *
   * Games building their own graph — Asteroids' UFO siren, Pole Position's
   * engine drone — connect to this rather than to ctx.destination.
   */
  function output() {
    context();
    return master;
  }

  return {
    context: context,
    output: output,
    tone: tone,
    noise: noise,
    loop: loop,
    mute: setMuted,
    toggleMute: function () {
      return setMuted(!muted);
    },
    isMuted: function () {
      return muted;
    },
  };
})();
