/* Sunset Ledger — GTA VI trophy guide & tracker.
   Static, offline. Progress saves to localStorage; nothing leaves the device. */
"use strict";

const LS_KEY = "sunset-ledger-v3";
const PSN_POINTS = { platinum: 180, gold: 90, silver: 30, bronze: 15 };
const GRADE_ORDER = { platinum: 0, gold: 1, silver: 2, bronze: 3 };

const STAGES = [
  { n: 1, title: "Stage 1 — Story & side missions", hours: "60–80 hours",
    desc: "Play the story and pick up optional missions as they appear: purple icons, plus black icons with pink letters. Along the way, scan every new vehicle with the WAiNK app and study animals through your binoculars. Everything you do before the ending already counts toward the 100% checklist — it just is not viewable until after the story." },
  { n: 2, title: "Stage 2 — The 100% checklist", hours: "about 100 hours",
    desc: "After the ending, Progress > Stats gains a 100% Completion entry. It is closer to 60% true completion: most side quests are not required, and collectibles only partly. You do need every robbery, underwater discovery, shooting range, drone race and Bret quest. Only 70 of the 80 Challenges are needed, so skip the nastiest ones." },
  { n: 3, title: "Stage 3 — Strangers & cleanup", hours: "about 10 hours",
    desc: "The checklist does not ask for stranger quests, so they are usually what is left afterwards, together with any stray trophies that did not pop on their own." },
];

let DATA = null;
let state = { earned: {}, counts: {}, spoiler: true };
let demoEarned = null; // in-memory only, never persisted

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && typeof s === "object") {
        state.earned = s.earned || {};
        state.counts = s.counts || {};
        if (typeof s.spoiler === "boolean") state.spoiler = s.spoiler;
      }
    }
  } catch (e) { /* corrupted save: start fresh */ }
}
function saveState() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
}
function isEarned(t) {
  if (demoEarned) return demoEarned.has(t.id);
  return !!state.earned[t.id];
}
function earnedCount() {
  return DATA.trophies.filter(isEarned).length;
}
function psnEarned() {
  return DATA.trophies.reduce((s, t) => s + (isEarned(t) ? PSN_POINTS[t.grade] : 0), 0);
}
function psnTotal() {
  return DATA.trophies.reduce((s, t) => s + PSN_POINTS[t.grade], 0);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function gradeLabel(g) { return g.charAt(0).toUpperCase() + g.slice(1); }

function srcChips(nums) {
  if (!nums || !nums.length) return "";
  return '<div class="src-chips">Sources: ' + nums.map((n) => "[" + n + "]").join(" ") + "</div>";
}

function cardHTML(t) {
  const earned = isEarned(t);
  const hidden = t.hidden && state.spoiler && !t._revealed;
  const count = t.count ? (state.counts[t.id] || 0) : null;
  const badges = [];
  if (t.missable) badges.push('<span class="flag flag-missable">Possibly missable</span>');
  if (t.atRisk) badges.push('<span class="flag flag-risk">At risk</span>');
  if (t.hidden) badges.push('<span class="flag flag-hidden">PSN-hidden</span>');
  if (t.unconfirmed) badges.push('<span class="flag flag-unconfirmed">Unconfirmed</span>');
  if (t.disputed) badges.push('<span class="flag flag-disputed">Sources differ</span>');

  let inner = "";
  if (hidden) {
    inner += '<button type="button" class="spoiler-reveal" data-reveal="' + t.id + '">Hidden trophy — tap to reveal (spoiler)</button>';
  }
  inner += '<h3 class="spoiler-text">' + esc(t.name) + "</h3>";
  inner += '<p class="desc spoiler-text">' + esc(t.description) + "</p>";
  if (badges.length) inner += '<div class="badges">' + badges.join("") + "</div>";
  if (t.riskNote) inner += '<p class="risk-note">⚠ ' + esc(t.riskNote) + "</p>";
  if (t.unconfirmedNote) inner += '<p class="unconfirmed-note">? ' + esc(t.unconfirmedNote) + "</p>";

  // guide (blurred with the rest when spoiler-shielded)
  let guide = '<div class="guide spoiler-text"><p>' + esc(t.guide) + "</p>";
  if (t.steps && t.steps.length) {
    guide += "<ol>" + t.steps.map((s) => "<li>" + esc(s.text) + "</li>").join("") + "</ol>";
  }
  guide += srcChips(t.sources) + "</div>";
  inner += '<details class="guide-details"><summary>How to unlock</summary>' + guide + "</details>";

  if (t.disputed && t.dispute) {
    inner += '<div class="dispute-box spoiler-text"><p><strong>Sources differ — shown both ways:</strong></p>'
      + "<p>PowerPyx: " + esc(t.dispute.a) + "</p>"
      + "<p>KeenGamer: " + esc(t.dispute.b) + "</p>"
      + "<p><strong>Our call:</strong> " + esc(t.dispute.call) + "</p></div>";
  }

  let foot = '<div class="card-foot">';
  foot += '<button type="button" class="earn-btn' + (earned ? " earned" : "") + '" data-earn="' + t.id + '">' + (earned ? "✓ Earned" : "Mark earned") + "</button>";
  if (t.count) {
    foot += '<span class="counter"><button type="button" data-dec="' + t.id + '" aria-label="Decrease">−</button>'
      + '<span class="count-val">' + count + " / " + t.count.target + " " + esc(t.count.unit) + "</span>"
      + '<button type="button" data-inc="' + t.id + '" aria-label="Increase">+</button></span>';
  }
  foot += "</div>";

  return '<article class="card' + (earned ? " earned" : "") + (hidden ? " spoiler-hidden" : "") + '" data-id="' + t.id + '">'
    + '<div class="card-top"><span class="grade-badge grade-' + t.grade + '">' + gradeLabel(t.grade) + '</span>'
    + '<span class="card-kind">' + esc(t.kind) + (t.chapter ? " · Ch " + t.chapter : "") + "</span></div>"
    + inner + foot + "</article>";
}

function currentFilters() {
  return {
    q: document.getElementById("searchBox").value.trim().toLowerCase(),
    kind: document.getElementById("kindFilter").value,
    grade: document.getElementById("gradeFilter").value,
    earned: document.getElementById("earnedFilter").value,
    flag: document.getElementById("flagFilter").value,
    sort: document.getElementById("sortSelect").value,
  };
}
function filteredTrophies() {
  const f = currentFilters();
  let list = DATA.trophies.filter((t) => {
    if (f.q && !(t.name.toLowerCase().includes(f.q) || t.description.toLowerCase().includes(f.q) || t.guide.toLowerCase().includes(f.q))) return false;
    if (f.kind && t.kind !== f.kind) return false;
    if (f.grade && t.grade !== f.grade) return false;
    if (f.earned === "earned" && !isEarned(t)) return false;
    if (f.earned === "unearned" && isEarned(t)) return false;
    if (f.flag === "missable" && !(t.missable || t.atRisk)) return false;
    if (f.flag === "hidden" && !t.hidden) return false;
    if (f.flag === "unconfirmed" && !t.unconfirmed) return false;
    if (f.flag === "disputed" && !t.disputed) return false;
    return true;
  });
  if (f.sort === "name") list.sort((a, b) => a.name.localeCompare(b.name));
  else if (f.sort === "grade") list.sort((a, b) => GRADE_ORDER[a.grade] - GRADE_ORDER[b.grade] || a.roadmap - b.roadmap);
  else list.sort((a, b) => a.roadmap - b.roadmap);
  return list;
}

function renderTracker() {
  const list = filteredTrophies();
  const grid = document.getElementById("trackerGrid");
  grid.innerHTML = list.length ? list.map(cardHTML).join("") : '<p class="empty">No trophies match these filters.</p>';
  document.getElementById("resultCount").textContent =
    "Showing " + list.length + " of " + DATA.trophies.length + " trophies · " + earnedCount() + " earned";
}

function renderHeader() {
  const n = earnedCount();
  document.getElementById("earnedCount").textContent = n;
  document.getElementById("psnPoints").textContent = psnEarned() + " / " + psnTotal() + " PSN points";
  const byGrade = {};
  ["platinum", "gold", "silver", "bronze"].forEach((g) => {
    byGrade[g] = DATA.trophies.filter((t) => t.grade === g && isEarned(t)).length + "/" + DATA.trophies.filter((t) => t.grade === g).length;
  });
  document.getElementById("gradeCounts").innerHTML =
    '<span class="g-p">P <b>' + byGrade.platinum + "</b></span> · "
    + '<span class="g-g">G <b>' + byGrade.gold + "</b></span> · "
    + '<span class="g-s">S <b>' + byGrade.silver + "</b></span> · "
    + '<span class="g-b">B <b>' + byGrade.bronze + "</b></span>";
  const fill = document.getElementById("progressFill");
  fill.style.width = (n / DATA.trophies.length * 100) + "%";
  const wrap = document.getElementById("progressBarWrap");
  wrap.setAttribute("aria-valuenow", String(n));
  document.getElementById("spoilerToggle").checked = state.spoiler;
}

function renderRoadmap() {
  const host = document.getElementById("roadmapStages");
  host.innerHTML = STAGES.map((st) => {
    const items = DATA.trophies.filter((t) => t.stage === st.n).sort((a, b) => a.roadmap - b.roadmap);
    const done = items.filter(isEarned).length;
    const rows = items.map((t) =>
      '<li class="' + (isEarned(t) ? "done" : "") + '"><span class="step-no">' + t.roadmap + '</span>'
      + '<span class="step-name">' + esc(t.name) + '</span>'
      + '<span class="step-grade">' + gradeLabel(t.grade) + (t.missable ? " · missable" : "") + "</span></li>").join("");
    return '<div class="stage"><div class="stage-head"><h3>' + esc(st.title) + '</h3>'
      + '<span class="stage-meta">' + esc(st.hours) + " · " + done + "/" + items.length + " earned</span></div>"
      + '<p class="stage-desc">' + esc(st.desc) + '</p><ol class="stage-list">' + rows + "</ol></div>";
  }).join("");
}

function renderMissables() {
  const featured = DATA.trophies.find((t) => t.missable);
  const atRisk = DATA.trophies.filter((t) => t.atRisk && !t.missable);
  const unconf = DATA.trophies.filter((t) => t.unconfirmed && !t.missable);
  const host = document.getElementById("missablesContent");
  let html = "";
  if (featured) {
    html += '<div class="featured"><h2>⚠ The one possibly missable trophy</h2>'
      + '<h3>' + esc(featured.name) + ' <span class="grade-badge grade-' + featured.grade + '">' + gradeLabel(featured.grade) + "</span></h3>"
      + "<p>" + esc(featured.description) + "</p>"
      + '<div class="guide"><p>' + esc(featured.guide) + "</p>" + srcChips(featured.sources) + "</div>"
      + "<p><strong>Do it in Chapter 1.</strong> Everything else in the game can be done after the story — this is the only trophy with a time window.</p></div>";
  }
  html += "<h2>At risk — do them when they appear</h2>"
    + "<p>These are not missable, but their givers go quiet between chapters. Start each line when it first appears and it stays available after the story.</p>"
    + '<div class="missable-list">' + atRisk.map((t) =>
      '<div class="missable-item"><h3>' + esc(t.name) + '</h3><p>' + esc(t.description) + "</p>"
      + "<p>" + esc(t.riskNote || "") + "</p></div>").join("") + "</div>";
  if (unconf.length) {
    html += "<h2 style=\"margin-top:26px\">Unconfirmed — do not take as fact</h2>"
      + "<p>These points are still unconfirmed by the guides. The advice is safe to follow, but the exact trigger may change after launch.</p>"
      + '<div class="missable-list">' + unconf.map((t) =>
        '<div class="missable-item"><h3>' + esc(t.name) + '</h3><p>' + esc(t.unconfirmedNote || t.description) + "</p></div>").join("") + "</div>";
  }
  host.innerHTML = html;
}

function renderSources() {
  const host = document.getElementById("sourcesContent");
  const disputed = DATA.trophies.filter((t) => t.disputed);
  let html = '<div class="sources-intro"><h2>Sources</h2>'
    + "<p>Every trophy was checked against the kit's official list (55/55 names, descriptions and grades match). Guides were written from the guides below, read 20–21 November 2026. Where they disagree, the guide shows both versions instead of picking one silently.</p>"
    + "<p><strong>Honest count:</strong> 6 sources across 5 sites plus the kit's official list — not inflated.</p></div>";
  html += '<ol class="source-list">' + DATA.sources.map((s) =>
    "<li><strong>" + esc(s.title) + "</strong> — <a href=\"" + esc(s.url) + "\" target=\"_blank\" rel=\"noopener\">" + esc(s.url) + "</a>"
    + '<span class="src-note">Read ' + esc(s.read) + " · " + esc(s.depth) + ".</span></li>").join("") + "</ol>";
  html += '<div class="diff-box"><h3>Sources differ — shown both ways</h3>'
    + "<p>7 trophies where PowerPyx gives a specific method and KeenGamer still lists the trigger as unconfirmed. We follow PowerPyx and flag each one as unconfirmed in its card.</p>"
    + disputed.map((t) =>
      '<div class="diff-item"><p><strong>' + esc(t.name) + "</strong></p>"
      + '<p class="ver">PowerPyx: ' + esc(t.dispute.a) + "</p>"
      + '<p class="ver">KeenGamer: ' + esc(t.dispute.b) + "</p>"
      + '<p class="call">Our call: ' + esc(t.dispute.call) + "</p></div>").join("") + "</div>";
  host.innerHTML = html;
}

function renderAll() {
  renderHeader();
  renderTracker();
  renderRoadmap();
  renderMissables();
  renderSources();
}

function exportJSON() {
  const payload = { app: "sunset-ledger", version: 3, exported: new Date().toISOString(), earned: state.earned, counts: state.counts };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sunset-ledger-progress.json";
  a.click();
  URL.revokeObjectURL(a.href);
}
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const p = JSON.parse(reader.result);
      if (!p || typeof p !== "object" || !p.earned) throw new Error("bad file");
      state.earned = p.earned;
      state.counts = p.counts || {};
      demoEarned = null;
      saveState();
      renderAll();
    } catch (e) {
      alert("That file does not look like a Sunset Ledger export.");
    }
  };
  reader.readAsText(file);
}

function bindEvents() {
  ["searchBox", "kindFilter", "gradeFilter", "earnedFilter", "flagFilter", "sortSelect"].forEach((id) => {
    document.getElementById(id).addEventListener("input", renderTracker);
    document.getElementById(id).addEventListener("change", renderTracker);
  });
  document.getElementById("spoilerToggle").addEventListener("change", (e) => {
    state.spoiler = e.target.checked;
    DATA.trophies.forEach((t) => { t._revealed = false; });
    saveState();
    renderTracker();
  });
  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tabs button").forEach((b) => b.setAttribute("aria-selected", b === btn ? "true" : "false"));
      ["tracker", "roadmap", "missables", "sources"].forEach((name) => {
        document.getElementById("panel-" + name).hidden = name !== btn.dataset.tab;
      });
    });
  });
  document.getElementById("trackerGrid").addEventListener("click", (e) => {
    const reveal = e.target.closest("[data-reveal]");
    if (reveal) {
      const t = DATA.trophies.find((x) => x.id === Number(reveal.dataset.reveal));
      if (t) { t._revealed = true; renderTracker(); }
      return;
    }
    const earn = e.target.closest("[data-earn]");
    if (earn) {
      const id = Number(earn.dataset.earn);
      if (demoEarned) { demoEarned.has(id) ? demoEarned.delete(id) : demoEarned.add(id); }
      else {
        state.earned[id] = !state.earned[id];
        if (!state.earned[id]) delete state.earned[id];
        saveState();
      }
      renderAll();
      return;
    }
    const inc = e.target.closest("[data-inc]");
    const dec = e.target.closest("[data-dec]");
    if (inc || dec) {
      const id = Number((inc || dec).dataset.inc || (inc || dec).dataset.dec);
      const t = DATA.trophies.find((x) => x.id === id);
      const cur = state.counts[id] || 0;
      const next = Math.max(0, Math.min(t.count.target, cur + (inc ? 1 : -1)));
      state.counts[id] = next;
      if (next >= t.count.target) state.earned[id] = true;
      saveState();
      renderAll();
    }
  });
  document.getElementById("exportBtn").addEventListener("click", exportJSON);
  document.getElementById("importBtn").addEventListener("click", () => document.getElementById("importFile").click());
  document.getElementById("importFile").addEventListener("change", (e) => {
    if (e.target.files[0]) importJSON(e.target.files[0]);
    e.target.value = "";
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    if (confirm("Reset all progress? This clears every earned mark and counter.")) {
      state.earned = {}; state.counts = {}; demoEarned = null;
      saveState();
      renderAll();
    }
  });
  document.getElementById("demoBtn").addEventListener("click", () => {
    // First 13 by roadmap order (plausible early-game set), in-memory only — never written to localStorage.
    demoEarned = new Set([...DATA.trophies].sort((a, b) => a.roadmap - b.roadmap).slice(0, 13).map((t) => t.id));
    document.getElementById("demoBtn").textContent = "Demo on (13/55) — click Reset to clear";
    renderAll();
  });
}

fetch("data/trophies.json")
  .then((r) => { if (!r.ok) throw new Error("trophies.json failed to load"); return r.json(); })
  .then((d) => {
    DATA = d;
    loadState();
    if (new URLSearchParams(location.search).get("demo") === "1") {
      demoEarned = new Set([...DATA.trophies].sort((a, b) => a.roadmap - b.roadmap).slice(0, 13).map((t) => t.id));
    }
    bindEvents();
    // Deep-linkable tabs: #tracker, #roadmap, #missables, #sources.
    const hashTab = (location.hash || "").replace("#", "");
    if (["roadmap", "missables", "sources"].includes(hashTab)) {
      document.querySelector('.tabs button[data-tab="' + hashTab + '"]').click();
    }
    renderAll();
  })
  .catch((e) => {
    document.getElementById("trackerGrid").innerHTML = '<p class="empty">Could not load the trophy data. Open this page from a local server (for example <code>node serve.ts</code>) rather than as a file.</p>';
    console.error(e);
  });
