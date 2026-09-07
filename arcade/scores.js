/**
 * Arcade.Scores — a top-five table with initials, per game.
 *
 * Generalised from Spy Hunter, which was the only cabinet that got this right.
 * Storage-only by default: the games render wildly differently (canvas, Phaser,
 * DOM), so `top()` hands back plain data. `promptInitials` is an optional shared
 * overlay for the games that want one.
 */
window.Arcade = window.Arcade || {};

Arcade.Scores = (function () {
  const SIZE = 5;
  const PREFIX = "arcade:scores:";

  let warned = false;

  function storage() {
    try {
      const s = window.localStorage;
      s.getItem(PREFIX + "probe");
      return s;
    } catch (e) {
      // Private browsing and some file:// setups block this outright. Scores
      // stop persisting; everything else keeps working. Say so once.
      if (!warned) {
        warned = true;
        console.warn("Arcade.Scores: localStorage unavailable, scores will not persist —", e.message);
      }
      return null;
    }
  }

  function normalise(list) {
    if (!Array.isArray(list)) return [];
    return list
      .filter((row) => row && typeof row.score === "number" && isFinite(row.score))
      .map((row) => ({ name: String(row.name || "---").slice(0, 3), score: row.score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, SIZE);
  }

  function top(game) {
    const s = storage();
    if (!s) return [];
    const raw = s.getItem(PREFIX + game);
    if (!raw) return [];
    try {
      return normalise(JSON.parse(raw));
    } catch (e) {
      console.warn("Arcade.Scores: discarding unreadable table for " + game + " —", e.message);
      return [];
    }
  }

  function best(game) {
    const table = top(game);
    return table.length ? table[0].score : 0;
  }

  /** A score qualifies while the table has room, or once it beats the last row. */
  function qualifies(game, score) {
    if (typeof score !== "number" || !isFinite(score) || score <= 0) return false;
    const table = top(game);
    if (table.length < SIZE) return true;
    return score > table[table.length - 1].score;
  }

  function submit(game, name, score) {
    const table = top(game);
    table.push({ name: String(name || "---").toUpperCase().slice(0, 3), score: score });
    const next = normalise(table);

    const s = storage();
    if (s) s.setItem(PREFIX + game, JSON.stringify(next));
    return next;
  }

  function clear(game) {
    const s = storage();
    if (s) s.removeItem(PREFIX + game);
  }

  /** "1. SCK  12500" per line, padded so the columns line up. */
  function format(game) {
    const table = top(game);
    if (!table.length) return "NO SCORES YET";
    return table
      .map((row, i) => i + 1 + ". " + row.name.padEnd(3, " ") + "  " + row.score)
      .join("\n");
  }

  /**
   * Three-letter initials entry. Calls back with the initials once Enter is
   * pressed. Takes the keyboard away from the game while it is open.
   */
  function promptInitials(score, onDone) {
    Arcade.Input && Arcade.Input.setEnabled(false);

    const overlay = document.createElement("div");
    overlay.className = "arcade-initials";
    overlay.innerHTML =
      '<div class="arcade-initials-box">' +
      "<h2>NEW HIGH SCORE</h2>" +
      '<div class="arcade-initials-score">' + score + "</div>" +
      '<div class="arcade-initials-entry" id="arcade-initials-entry">___</div>' +
      '<div class="arcade-initials-hint">TYPE INITIALS &middot; ENTER TO CONFIRM</div>' +
      "</div>";
    document.body.appendChild(overlay);

    const entry = overlay.querySelector("#arcade-initials-entry");
    let initials = "";

    function render() {
      entry.textContent = initials.padEnd(3, "_");
    }

    function onKey(e) {
      if (e.key === "Backspace") {
        initials = initials.slice(0, -1);
      } else if (e.key === "Enter") {
        if (!initials.length) return;
        window.removeEventListener("keydown", onKey, true);
        overlay.remove();
        Arcade.Input && Arcade.Input.setEnabled(true);
        if (onDone) onDone(initials);
        return;
      } else if (/^[a-zA-Z0-9]$/.test(e.key) && initials.length < 3) {
        initials += e.key.toUpperCase();
      }
      e.preventDefault();
      e.stopPropagation();
      render();
    }

    // Capture phase, so the game's own listeners never see these keys.
    window.addEventListener("keydown", onKey, true);
    render();
  }

  return {
    SIZE: SIZE,
    top: top,
    best: best,
    qualifies: qualifies,
    submit: submit,
    clear: clear,
    format: format,
    promptInitials: promptInitials,
  };
})();
