/**
 * Tiny assertion rig.
 *
 * Suites register themselves and are run after `load` so that games which
 * bootstrap from `window.onload` (Pole Position) have finished initialising.
 * Results are printed into #results between markers the runner greps for.
 */

const __suites = [];
const __out = [];
let __failures = 0;

function check(name, cond, detail) {
  if (cond) {
    __out.push("  PASS  " + name);
  } else {
    __failures++;
    __out.push("  FAIL  " + name + (detail ? "  -> " + detail : ""));
  }
}

function near(name, actual, expected, tolerance) {
  check(
    name,
    Math.abs(actual - expected) <= tolerance,
    "got " + actual + ", wanted " + expected + " +/- " + tolerance
  );
}

/** A suite that throws is a failure, not a reason to lose the whole report. */
function suite(name, fn) {
  __suites.push({ name: name, fn: fn });
}

function __flush() {
  const banner =
    "@@START@@\n" +
    __out.join("\n") +
    "\n  RESULT " +
    (__failures === 0 ? "ALL PASS" : __failures + " FAILURE(S)") +
    "\n@@END@@";
  let el = document.getElementById("test-report");
  if (!el) {
    el = document.createElement("pre");
    el.id = "test-report";
    document.body.appendChild(el);
  }
  el.textContent = banner;
}

let __ready = null;

/**
 * Holds the run back until fn() is true - Phaser boots its scene a few frames
 * after load, so an integration page has nothing to assert against yet.
 */
function readyWhen(fn, timeoutMs) {
  __ready = { fn: fn, deadline: Date.now() + (timeoutMs || 8000) };
}

function __runAll() {
  for (const s of __suites) {
    try {
      s.fn();
    } catch (e) {
      __failures++;
      __out.push("  THREW " + s.name + "  -> " + e.message);
    }
  }
  __flush();
}

/** Polls the readiness gate, then runs. Without a gate, runs on the next tick. */
function __startWhenReady() {
  if (!__ready) {
    __runAll();
    return;
  }
  if (__ready.fn()) {
    __runAll();
    return;
  }
  if (Date.now() > __ready.deadline) {
    __failures++;
    __out.push("  FAIL  page never became ready to test");
    __flush();
    return;
  }
  setTimeout(__startWhenReady, 30);
}

window.addEventListener("load", function () {
  // Defer past the game's own window.onload handler.
  setTimeout(__startWhenReady, 0);
});
