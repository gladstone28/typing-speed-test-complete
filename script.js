/* Typing Speed Test — Pure JS (no libraries) */
(() => {
  const el = {
    text: document.getElementById("text"),
    hiddenInput: document.getElementById("hiddenInput"),
    wpm: document.getElementById("wpm"),
    accuracy: document.getElementById("accuracy"),
    time: document.getElementById("time"),
    bestWpm: document.getElementById("bestWpm"),
    pbBadge: document.getElementById("pbBadge"),
    restartBtn: document.getElementById("restartBtn"),
    hintText: document.getElementById("hintText"),
    hintIcon: document.getElementById("hintIcon"),
    modeSub: document.getElementById("modeSub"),
    pills: Array.from(document.querySelectorAll(".pill")),
  };

  // Passages (replace/extend as needed)
  const PASSAGES = {
    easy: [
      "The sun rose over the quiet hills and the town woke up slowly. A gentle breeze moved through the trees and carried the smell of rain.",
      "Practice makes progress. Keep your hands relaxed, look at the screen, and let your fingers learn the rhythm of the keys.",
      "A small group of friends walked to the market and shared stories as they went. They laughed, helped each other, and enjoyed the day."
    ],
    medium: [
      "When you build software, tiny details add up: spacing, contrast, motion, and clear feedback. A thoughtful interface helps people feel confident and move quickly.",
      "A good plan balances speed and accuracy. Start steady, correct mistakes early, and build momentum without tensing your shoulders or wrists.",
      "The engineer reviewed logs, measured latency, and fixed a subtle bug that appeared only under heavy load. After the patch, the system stabilized."
    ],
    hard: [
      "After months of fieldwork, the team cataloged stratified layers, cross-referenced isotope data, and revised their chronology. The conclusion was cautious: correlation is not causation, but the evidence was difficult to ignore.",
      "If you want to improve, measure what matters: consistency, error rate, and focus. Then adjust your approach—short sessions, clean technique, and deliberate practice.",
      "Under pressure, complex systems fail in surprising ways. Resilience comes from redundancy, observability, and the discipline to test assumptions before they harden."
    ],
  };

  const state = {
    difficulty: "hard",
    mode: "timed",         // "timed" | "passage"
    durationSec: 60,
    passage: "",
    typed: [],
    running: false,
    finished: false,
    startTs: null,
    endTs: null,
    timerId: null,
    bestAtStart: 0,
    pbShown: false,
  };

  // ---------- Helpers ----------
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const fmtTime = (sec) => {
    const s = Math.max(0, Math.floor(sec));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return `${m}:${String(r).padStart(2, "0")}`;
  };

  function loadBest() {
    const best = Number(localStorage.getItem("typingBestWpm") || "0");
    el.bestWpm.textContent = `${best} WPM`;
    return best;
  }

  function showNewPbBadge() {
    if (state.pbShown) return;
    state.pbShown = true;
    el.pbBadge.hidden = false;
    // hide after a moment
    window.setTimeout(() => { el.pbBadge.hidden = true; }, 2600);
  }

  function saveBestIfNeeded(currentWpm) {
    const best = loadBest();
    if (currentWpm > best) {
      localStorage.setItem("typingBestWpm", String(currentWpm));
      el.bestWpm.textContent = `${currentWpm} WPM`;
    }
    // Celebrate if user has surpassed their starting PB during this run
    if (!state.pbShown && currentWpm > state.bestAtStart && currentWpm >= 10) {
      showNewPbBadge();
    }
  }

  function choosePassage() {
    const list = PASSAGES[state.difficulty] || PASSAGES.medium;
    return list[Math.floor(Math.random() * list.length)];
  }

  function setActivePills() {
    el.pills.forEach((b) => {
      const isDiff = b.dataset.difficulty && b.dataset.difficulty === state.difficulty;
      const isMode = b.dataset.mode && b.dataset.mode === state.mode;
      b.classList.toggle("active", Boolean(isDiff || isMode));
    });
    el.modeSub.textContent = state.mode === "timed" ? "60 seconds" : "one passage";
  }

  function resetStatsUI() {
    el.wpm.textContent = "0";
    el.accuracy.textContent = "100%";
    el.accuracy.classList.add("statAccentRed");
    el.time.textContent = state.mode === "timed" ? fmtTime(state.durationSec) : "—";
  }

  function renderText() {
    const passage = state.passage;
    const typed = state.typed;

    const frag = document.createDocumentFragment();
    const currentIndex = clamp(typed.length, 0, passage.length);

    for (let i = 0; i < passage.length; i++) {
      const span = document.createElement("span");
      span.className = "char";
      const ch = passage[i];

      if (ch === " ") span.classList.add("space");

      if (i < typed.length) {
        if (typed[i] === ch) span.classList.add("correct");
        else span.classList.add("incorrect");
      }

      if (!state.finished && i === currentIndex) span.classList.add("current");

      span.textContent = ch;
      frag.appendChild(span);
    }

    el.text.innerHTML = "";
    el.text.appendChild(frag);
  }

  function computeMetrics() {
    const passage = state.passage;
    const typed = state.typed;
    const typedCount = typed.length;

    if (typedCount === 0) return { wpm: 0, acc: 100, correct: 0 };

    let correct = 0;
    for (let i = 0; i < typedCount && i < passage.length; i++) {
      if (typed[i] === passage[i]) correct++;
    }

    const now = state.finished ? state.endTs : performance.now();
    const elapsedMs = state.startTs ? Math.max(1, now - state.startTs) : 1;
    const minutes = elapsedMs / 60000;

    const wpm = Math.max(0, Math.round((correct / 5) / minutes));
    const acc = Math.round((correct / typedCount) * 100);

    return { wpm, acc };
  }

  function updateUI() {
    const { wpm, acc } = computeMetrics();
    el.wpm.textContent = String(wpm);
    el.accuracy.textContent = `${acc}%`;
    el.accuracy.classList.toggle("statAccentRed", acc < 98);
    saveBestIfNeeded(wpm);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function finish(reason = "done") {
    if (state.finished) return;

    state.finished = true;
    state.running = false;
    state.endTs = performance.now();
    stopTimer();

    renderText();
    updateUI();

    el.hintIcon.hidden = false;
    el.hintText.textContent =
      reason === "time" ? "Time's up! Press Restart to try again." : "Completed! Press Restart to try again.";
  }

  function startIfNeeded() {
    if (state.running || state.finished) return;

    state.startTs = performance.now();
    state.running = true;

    el.hintIcon.hidden = true;
    el.hintText.textContent = state.mode === "timed" ? "Typing… keep going!" : "Typing… finish the passage!";

    if (state.mode === "timed") {
      const endAt = state.startTs + state.durationSec * 1000;

      state.timerId = setInterval(() => {
        const left = Math.max(0, Math.ceil((endAt - performance.now()) / 1000));
        el.time.textContent = fmtTime(left);

        updateUI();

        if (left <= 0) {
          el.time.textContent = "0:00";
          finish("time");
        }
      }, 200);
    } else {
      el.time.textContent = "—";
    }
  }

  function restart() {
    stopTimer();

    state.passage = choosePassage();
    state.typed = [];
    state.running = false;
    state.finished = false;
    state.startTs = null;
    state.endTs = null;

    state.bestAtStart = loadBest();
    state.pbShown = false;
    el.pbBadge.hidden = true;

    resetStatsUI();
    setActivePills();
    renderText();

    el.hintIcon.hidden = true;
    el.hintText.textContent = "Click the passage and start typing.";

    el.hiddenInput.value = "";
    el.hiddenInput.focus();
  }

  function handleKeydown(e) {
    // allow shortcuts
    if (e.ctrlKey || e.metaKey || e.altKey) return;

    const key = e.key;

    // Escape = restart (accessible shortcut)
    if (key === "Escape") {
      e.preventDefault();
      restart();
      return;
    }

    const isPrintable = key.length === 1;
    const isBackspace = key === "Backspace";
    const isEnter = key === "Enter";

    if (!isPrintable && !isBackspace && !isEnter) return;

    e.preventDefault();

    if (state.finished) return;

    startIfNeeded();

    if (isBackspace) {
      if (state.typed.length > 0) state.typed.pop();
    } else if (isEnter) {
      // Treat Enter as a space so mobile "go" key still progresses.
      if (state.typed.length < state.passage.length) state.typed.push(" ");
    } else if (isPrintable) {
      if (state.typed.length < state.passage.length) state.typed.push(key);
    }

    renderText();
    updateUI();

    if (state.mode === "passage" && state.typed.length >= state.passage.length) {
      finish("done");
    }
  }

  function setupInteractions() {
    // clicking passage focuses typing
    el.text.addEventListener("click", () => el.hiddenInput.focus());
    el.text.addEventListener("keydown", handleKeydown);

    // keep typing focus inside app
    document.addEventListener("click", (e) => {
      const within = e.target.closest(".app");
      if (within) el.hiddenInput.focus();
    });

    // capture typing globally (works even if focus wanders)
    document.addEventListener("keydown", handleKeydown);

    // pills
    el.pills.forEach((btn) => {
      btn.addEventListener("click", () => {
        const d = btn.dataset.difficulty;
        const m = btn.dataset.mode;

        if (d) state.difficulty = d;
        if (m) state.mode = m;

        state.durationSec = 60; // per design
        restart();
      });
    });

    el.restartBtn.addEventListener("click", restart);
  }

  // init
  loadBest();
  setActivePills();
  setupInteractions();
  restart();
})();
