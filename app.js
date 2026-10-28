'use strict';

// Segments match the Trial Time Tracker sheet. `side` is who the time counts
// against: witnesses 1-2 are called by P, 3-4 by D, and cross goes to the
// side doing the crossing.
const SEGMENTS = [
  { id: 'p-open', label: P => `${P} Opening`, side: 'P' },
  { id: 'd-open', label: () => 'Defense Opening', side: 'D' },
  ...[1, 2, 3, 4].flatMap(n => {
    const caller = n <= 2 ? 'P' : 'D';
    const other = caller === 'P' ? 'D' : 'P';
    return [
      { id: `w${n}-direct`, witness: n, exam: 'Direct', side: caller },
      { id: `w${n}-cross`, witness: n, exam: 'Cross', side: other },
      { id: `w${n}-redirect`, witness: n, exam: 'Redirect', side: caller },
    ];
  }),
  { id: 'p-close', label: P => `${P} Closing`, side: 'P' },
  { id: 'd-close', label: () => 'Defense Closing', side: 'D' },
  { id: 'p-rebuttal', label: P => `${P} Rebuttal`, side: 'P' },
];

const STORAGE_KEY = 'trial-time-tracker-v1';

function freshState(prev) {
  return {
    round: '',
    limit: prev ? prev.limit : 60,
    warn: prev ? prev.warn : 5,
    pLabel: prev ? prev.pLabel : 'Prosecution/Plaintiff',
    witnesses: ['', '', '', ''],
    times: {},              // segment id -> seconds; missing means not used
    selected: SEGMENTS[0].id,
    timer: { running: false, startedAt: null, accumulated: 0 },
    undo: null,             // { id, prev, selected } for the last record
  };
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.times) return Object.assign(freshState(), saved);
  } catch (e) { /* fall through to a fresh state */ }
  return freshState();
}

let state = loadState();

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage unavailable */ }
}

// ---------- helpers ----------

const $ = id => document.getElementById(id);

function fmt(sec) {
  const neg = sec < 0;
  sec = Math.abs(Math.round(sec));
  const s = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  return neg ? `-${s}` : s;
}

function witnessName(n) {
  return state.witnesses[n - 1].trim() || `Witness ${n}`;
}

function segLabel(seg) {
  if (seg.witness) return `${witnessName(seg.witness)} ${seg.exam.toLowerCase()}`;
  return seg.label(state.pLabel || 'Prosecution/Plaintiff');
}

function segById(id) {
  return SEGMENTS.find(s => s.id === id);
}

function elapsedMs() {
  const t = state.timer;
  return t.accumulated + (t.running ? Date.now() - t.startedAt : 0);
}

function elapsedSec() {
  return Math.round(elapsedMs() / 1000);
}

function sideTotals(includeLive) {
  const used = { P: 0, D: 0 };
  for (const seg of SEGMENTS) {
    if (state.times[seg.id] != null) used[seg.side] += state.times[seg.id];
  }
  if (includeLive) used[segById(state.selected).side] += elapsedMs() / 1000;
  const limit = state.limit * 60;
  return { used, left: { P: limit - used.P, D: limit - used.D } };
}

// ---------- rendering ----------

function renderSegments() {
  const list = $('segments');
  list.innerHTML = '';
  let lastWitness = 0;
  for (const seg of SEGMENTS) {
    if (seg.witness && seg.witness !== lastWitness) {
      lastWitness = seg.witness;
      const head = document.createElement('li');
      head.className = 'witness-head';
      const caller = seg.witness <= 2 ? (state.pLabel || 'Prosecution/Plaintiff') : 'Defense';
      head.innerHTML = `<button class="witness-name" data-witness="${seg.witness}"></button><span class="called-by"></span>`;
      head.querySelector('.witness-name').textContent = `${witnessName(seg.witness)} ✎`;
      head.querySelector('.called-by').textContent = `called by ${caller}`;
      list.appendChild(head);
    }
    const li = document.createElement('li');
    li.className = 'seg' + (seg.witness ? ' exam' : '') + (seg.id === state.selected ? ' selected' : '');
    li.dataset.id = seg.id;
    const t = state.times[seg.id];
    li.innerHTML = `
      <button class="seg-main" data-select="${seg.id}">
        <span class="seg-name"></span>
        <span class="tag tag-${seg.side}">${seg.side === 'P' ? 'P' : 'D'}</span>
      </button>
      <button class="seg-time${t == null ? ' empty' : ''}" data-edit="${seg.id}" aria-label="Edit time">${t == null ? '—' : fmt(t)}</button>`;
    li.querySelector('.seg-name').textContent = seg.witness ? seg.exam : segLabel(seg);
    list.appendChild(li);
  }
}

function renderSummary() {
  $('summary').textContent = slackSummary();
}

function renderStatic() {
  $('roundTitle').textContent = state.round.trim() || 'Trial Time Tracker';
  document.querySelector('[data-side-label="P"]').textContent = state.pLabel || 'Prosecution/Plaintiff';
  $('undoBtn').hidden = !state.undo;
  renderSegments();
  renderSummary();
  renderLive();
}

function renderLive() {
  const t = state.timer;
  const live = elapsedSec();
  $('clock').textContent = fmt(live);
  $('nowLabel').textContent = segLabel(segById(state.selected));

  const startBtn = $('startBtn');
  startBtn.textContent = t.running ? 'Pause' : (t.accumulated > 0 ? 'Resume' : 'Start');
  startBtn.classList.toggle('pause', t.running);
  document.body.classList.toggle('running', t.running);
  document.body.classList.toggle('paused', !t.running && t.accumulated > 0);
  $('recordBtn').disabled = live === 0 && !t.running;

  const { used, left } = sideTotals(true);
  for (const side of ['P', 'D']) {
    document.querySelector(`[data-used="${side}"]`).textContent = fmt(used[side]);
    document.querySelector(`[data-left="${side}"]`).textContent = fmt(left[side]);
    const card = $(side === 'P' ? 'sideP' : 'sideD');
    card.classList.toggle('warn', left[side] >= 0 && left[side] < state.warn * 60);
    card.classList.toggle('over', left[side] < 0);
    card.classList.toggle('active', segById(state.selected).side === side);
  }

  // Show the live running total on the selected row.
  const row = document.querySelector(`.seg[data-id="${state.selected}"] .seg-time`);
  if (row) {
    const base = state.times[state.selected];
    if (live > 0) {
      row.textContent = base != null ? `${fmt(base)} + ${fmt(live)}` : fmt(live);
      row.classList.add('live');
      row.classList.remove('empty');
    } else {
      row.textContent = base == null ? '—' : fmt(base);
      row.classList.remove('live');
      row.classList.toggle('empty', base == null);
    }
  }
}

// ---------- Slack export ----------

function slackSummary() {
  const { used, left } = sideTotals(false);
  const pName = state.pLabel || 'Prosecution/Plaintiff';
  const lines = [
    `*${state.round.trim() || 'Trial'} time check*`,
    `${pName}: ${fmt(used.P)} used, ${fmt(left.P)} left`,
    `Defense: ${fmt(used.D)} used, ${fmt(left.D)} left`,
    '',
    '*By segment*',
  ];
  for (const seg of SEGMENTS) {
    if (state.times[seg.id] != null) lines.push(`${segLabel(seg)}: ${fmt(state.times[seg.id])}`);
  }
  return lines.join('\n');
}

async function copySummary() {
  const text = slackSummary();
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied! Paste it into Slack.');
  } catch (e) {
    // Older browsers: select the text so the user can copy it by hand.
    const range = document.createRange();
    range.selectNodeContents($('summary'));
    const sel = getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    try { document.execCommand('copy'); toast('Copied! Paste it into Slack.'); }
    catch (e2) { toast('Text selected — tap Copy.'); }
  }
}

// ---------- timer actions ----------

let wakeLock = null;
async function keepAwake(on) {
  try {
    if (on && 'wakeLock' in navigator && !wakeLock) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    } else if (!on && wakeLock) {
      await wakeLock.release();
      wakeLock = null;
    }
  } catch (e) { /* not supported or denied */ }
}

function startPause() {
  const t = state.timer;
  if (t.running) {
    t.accumulated += Date.now() - t.startedAt;
    t.running = false;
    t.startedAt = null;
  } else {
    t.running = true;
    t.startedAt = Date.now();
  }
  keepAwake(t.running);
  save();
  renderLive();
}

function resetTimer() {
  if (elapsedSec() > 5 && !confirm(`Discard ${fmt(elapsedSec())} on the stopwatch without recording it?`)) return;
  state.timer = { running: false, startedAt: null, accumulated: 0 };
  keepAwake(false);
  save();
  renderLive();
}

function record() {
  const sec = elapsedSec();
  const id = state.selected;
  const prev = state.times[id];
  state.undo = { id, prev: prev == null ? null : prev, selected: id };
  state.times[id] = (prev || 0) + sec;
  state.timer = { running: false, startedAt: null, accumulated: 0 };
  keepAwake(false);

  const seg = segById(id);
  toast(prev != null
    ? `Added ${fmt(sec)} to ${segLabel(seg)} (now ${fmt(state.times[id])})`
    : `${segLabel(seg)}: ${fmt(sec)}`);

  // Move on to the next segment that has no time yet.
  const i = SEGMENTS.findIndex(s => s.id === id);
  const next = SEGMENTS.slice(i + 1).find(s => state.times[s.id] == null);
  if (next) state.selected = next.id;

  save();
  renderStatic();
  scrollToSelected();
}

function undo() {
  const u = state.undo;
  if (!u) return;
  if (u.prev == null) delete state.times[u.id];
  else state.times[u.id] = u.prev;
  state.selected = u.selected;
  state.undo = null;
  save();
  renderStatic();
  toast('Last record undone');
}

function select(id) {
  state.selected = id;
  save();
  renderStatic();
}

function scrollToSelected() {
  const el = document.querySelector('.seg.selected');
  if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
}

// ---------- dialogs ----------

function openDialog(dlg, onClose) {
  dlg.returnValue = '';
  dlg.onclose = () => onClose(dlg.returnValue);
  dlg.showModal();
}

function editTime(id) {
  const seg = segById(id);
  const t = state.times[id];
  $('timeDlgTitle').textContent = segLabel(seg);
  $('editMin').value = t == null ? '' : Math.floor(t / 60);
  $('editSec').value = t == null ? '' : t % 60;
  openDialog($('timeDlg'), action => {
    if (action === 'clear') delete state.times[id];
    else if (action === 'save') {
      const m = parseInt($('editMin').value, 10) || 0;
      const s = parseInt($('editSec').value, 10) || 0;
      if ($('editMin').value === '' && $('editSec').value === '') delete state.times[id];
      else state.times[id] = Math.max(0, m * 60 + s);
    } else return;
    state.undo = null;
    save();
    renderStatic();
  });
  setTimeout(() => $('editMin').focus(), 50);
}

function editWitness(n) {
  $('nameDlgTitle').textContent = `Witness ${n}`;
  $('nameDlgNote').textContent = `Called by ${n <= 2 ? (state.pLabel || 'Prosecution/Plaintiff') : 'Defense'}. Leave blank to use "Witness ${n}".`;
  $('nameInput').value = state.witnesses[n - 1];
  openDialog($('nameDlg'), action => {
    if (action !== 'save') return;
    state.witnesses[n - 1] = $('nameInput').value.trim();
    save();
    renderStatic();
  });
  setTimeout(() => $('nameInput').focus(), 50);
}

function openSettings() {
  $('setRound').value = state.round;
  $('setLimit').value = state.limit;
  $('setWarn').value = state.warn;
  $('setPLabel').value = state.pLabel;
  openDialog($('settingsDlg'), action => {
    if (action === 'save') {
      state.round = $('setRound').value.trim();
      state.limit = Math.max(1, parseFloat($('setLimit').value) || 60);
      state.warn = Math.max(0, parseFloat($('setWarn').value) || 0);
      state.pLabel = $('setPLabel').value.trim() || 'Prosecution/Plaintiff';
    } else if (action === 'newtrial') {
      if (!confirm('Clear all times, witness names, and the round name for a new trial?')) return;
      state = freshState(state);
      keepAwake(false);
      toast('New trial started');
    } else return;
    save();
    renderStatic();
  });
}

// ---------- misc ----------

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

// ---------- wire up ----------

$('segments').addEventListener('click', e => {
  const sel = e.target.closest('[data-select]');
  const edit = e.target.closest('[data-edit]');
  const wit = e.target.closest('[data-witness]');
  if (sel) select(sel.dataset.select);
  else if (edit) editTime(edit.dataset.edit);
  else if (wit) editWitness(Number(wit.dataset.witness));
});
$('startBtn').addEventListener('click', startPause);
$('recordBtn').addEventListener('click', record);
$('resetBtn').addEventListener('click', resetTimer);
$('undoBtn').addEventListener('click', undo);
$('copyBtn').addEventListener('click', copySummary);
$('settingsBtn').addEventListener('click', openSettings);
$('nowLabel').addEventListener('click', scrollToSelected);

if (navigator.share) {
  $('shareBtn').hidden = false;
  $('shareBtn').addEventListener('click', () => {
    navigator.share({ text: slackSummary() }).catch(() => {});
  });
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (state.timer.running) keepAwake(true);
    renderLive();
  }
});

// The clock is computed from timestamps, so it stays correct even if the
// phone locks or the browser throttles this interval.
setInterval(renderLive, 250);
if (state.timer.running) keepAwake(true);
renderStatic();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
