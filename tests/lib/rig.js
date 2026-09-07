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

window.addEventListener("load", function () {
  // Defer past the game's own window.onload handler.
  setTimeout(function () {
    for (const s of __suites) {
      try {
        s.fn();
      } catch (e) {
        __failures++;
        __out.push("  THREW " + s.name + "  -> " + e.message);
      }
    }
    __flush();
  }, 0);
});
