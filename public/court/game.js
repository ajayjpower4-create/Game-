/* Court Simulator — setup wizard, the courtroom, and the verdict.
 *
 * The player picks who they are, writes their character, and everyone else is
 * played by Claude. The player can switch character, take one back off the AI,
 * or play two at once, at any point in the trial. */

import { ROLES, rolesFor, QUICK_LINES, BLANK_CASE } from './data.js';

const SAVE_KEY = 'court-sim-v1';
const app = document.getElementById('app');
const crumb = document.getElementById('crumb');
const autosaveEl = document.getElementById('autosave');
const menuBtn = document.getElementById('menuBtn');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

/* Asterisks are stage directions, ** is a speaker label. Everything else is
 * escaped first, so nothing in a transcript can inject markup. */
function fmt(text) {
  return esc(text)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n][^*]*)\*/g, '<em>$1</em>');
}

const STEPS = ['device', 'case', 'you', 'youDesc', 'cast', 'decider'];
const STEP_LABEL = {
  device: 'Device', case: 'The case', you: 'Who you are',
  youDesc: 'Your character', cast: 'The room', decider: 'The verdict',
};

/* ------------------------------------------------------------------- state */

function blankState() {
  return {
    screen: 'setup',
    step: 'device',
    device: null,
    caseInfo: { ...BLANK_CASE },
    roles: [],            // { rid, role, character, description, played: 'user'|'ai' }
    picked: [],           // role names the player chose for themselves
    verdictBy: 'jury',
    juryCount: 12,
    speaking: null,       // rid of the character the player is speaking as
    messages: [],         // { id, role, content, speaker, kind }
    verdict: null,
    busy: false,
  };
}

let state = load() || blankState();
state.busy = false;
let streamText = '';     // partial reply, held outside state so it isn't saved

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, busy: false }));
    autosaveEl.textContent = 'Saved';
    clearTimeout(save.t);
    save.t = setTimeout(() => { autosaveEl.textContent = ''; }, 1200);
  } catch { /* private mode: the trial still runs, it just won't resume */ }
}

function set(patch, { rerender = true } = {}) {
  state = { ...state, ...patch };
  save();
  if (rerender) render();
}

/* Layout mode. The player picks it up front, but a narrow window forces the
 * compact layout anyway so a desktop pick never traps them on a phone. */
function detectDevice() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  return coarse || window.innerWidth < 820 ? 'mobile' : 'desktop';
}

function applyDevice() {
  document.body.classList.toggle('compact', state.device === 'mobile' || window.innerWidth < 760);
  document.body.classList.toggle('device-mobile', state.device === 'mobile');
}
window.addEventListener('resize', () => {
  applyDevice();
  // A rotate or a keyboard opening shouldn't strand the player up the transcript.
  const log = document.getElementById('log');
  if (log) log.scrollTop = log.scrollHeight;
});

/* ------------------------------------------------------------------- modal */

function openModal(html, wire) {
  modalBody.innerHTML = html;
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  if (wire) wire(modalBody);
}
function closeModal() {
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  modalBody.innerHTML = '';
}
modal.addEventListener('click', (e) => {
  if (e.target === modal || e.target.hasAttribute('data-close')) closeModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

/* ------------------------------------------------------------- cast helpers */

const myRoles = () => state.roles.filter((r) => r.played === 'user');
const aiRoles = () => state.roles.filter((r) => r.played !== 'user');
const roleById = (rid) => state.roles.find((r) => r.rid === rid);
const label = (r) => (!r.character || r.character === r.role
  ? r.role
  : `${r.character} (${r.role})`);

function currentSpeaker() {
  const mine = myRoles();
  if (!mine.length) return null;
  return mine.find((r) => r.rid === state.speaking) || mine[0];
}

function sideNames() {
  const c = state.caseInfo;
  return {
    a: c.partyA || (c.type === 'civil' ? 'the plaintiff' : 'the prosecution'),
    b: c.partyB || 'the defendant',
  };
}

/* ------------------------------------------------------------------ screens */

function render() {
  applyDevice();
  if (state.screen === 'setup') renderSetup();
  else if (state.screen === 'trial') renderTrial();
  else if (state.screen === 'verdict') renderVerdictForm();
}

function stepBar() {
  const i = STEPS.indexOf(state.step);
  return `<div class="steps">${STEPS.map((s, n) => `
    <span class="${n === i ? 'on' : n < i ? 'done' : ''}">${esc(STEP_LABEL[s])}</span>`).join('')}</div>`;
}

function renderSetup() {
  crumb.textContent = STEP_LABEL[state.step] || 'Case setup';
  if (state.step === 'device') return stepDevice();
  if (state.step === 'case') return stepCase();
  if (state.step === 'you') return stepYou();
  if (state.step === 'youDesc') return stepYouDesc();
  if (state.step === 'cast') return stepCast();
  return stepDecider();
}

/* 1. Device ---------------------------------------------------------------- */

function stepDevice() {
  const guess = detectDevice();
  app.innerHTML = `
    ${stepBar()}
    <div class="card">
      <h2>Are you on a phone or a computer?</h2>
      <p class="hint">This only changes the layout. You can switch later from the Menu.</p>
      <div class="pick-grid two">
        <button class="pick ${state.device === 'mobile' ? 'on' : ''}" data-device="mobile">
          <strong>📱 Phone</strong>
          <small>One column, big tap targets, full-screen menus, the composer pinned to the bottom.</small>
          ${guess === 'mobile' ? '<em class="tag">Looks like what you are on</em>' : ''}
        </button>
        <button class="pick ${state.device === 'desktop' ? 'on' : ''}" data-device="desktop">
          <strong>💻 Computer</strong>
          <small>Wider transcript, fields side by side, Enter to send and Shift+Enter for a new line.</small>
          ${guess === 'desktop' ? '<em class="tag">Looks like what you are on</em>' : ''}
        </button>
      </div>
    </div>
    <div class="card">
      <h2>You are anybody in the room.</h2>
      <p class="hint tight">Judge, defendant, prosecutor, a witness, the bailiff — or two of them at once.
        Claude Sonnet plays everyone else and nobody you play. Speak in plain lines, put actions in
        asterisks: <em>*I walk over to the prosecutor and grab the papers.*</em> When the other side
        needs evidence off you, the trial stops and asks whether you actually have it.</p>
    </div>`;

  app.querySelectorAll('[data-device]').forEach((b) => b.addEventListener('click', () => {
    set({ device: b.dataset.device, step: 'case' });
  }));
}

/* 2. The case -------------------------------------------------------------- */

function stepCase() {
  const c = state.caseInfo;
  const civil = c.type === 'civil';
  app.innerHTML = `
    ${stepBar()}
    <div class="card">
      <h2>The case</h2>
      <p class="hint">Docket number, who is suing or charging whom, and what it is about.</p>

      <div class="pick-grid two" style="margin-bottom:14px">
        <button class="pick ${!civil ? 'on' : ''}" data-type="criminal">
          <strong>⚖️ Criminal</strong><small>The state prosecutes. Guilty or not guilty.</small>
        </button>
        <button class="pick ${civil ? 'on' : ''}" data-type="civil">
          <strong>📄 Civil</strong><small>One party sues another. Liable or not liable.</small>
        </button>
      </div>

      <div class="row two">
        <label class="field"><span>Case number</span>
          <input type="text" id="f-id" value="${esc(c.id)}" placeholder="${civil ? 'CV-2026-0881' : 'CR-2026-04417'}"></label>
        <label class="field"><span>Court</span>
          <input type="text" id="f-court" value="${esc(c.court)}" placeholder="Marrow County Superior Court"></label>
      </div>
      <div class="row two">
        <label class="field"><span>${civil ? 'Plaintiff' : 'Prosecuting body'}</span>
          <input type="text" id="f-a" value="${esc(c.partyA)}" placeholder="${civil ? 'Dana Ruiz' : 'The People of the State of Marrow'}"></label>
        <label class="field"><span>Defendant</span>
          <input type="text" id="f-b" value="${esc(c.partyB)}" placeholder="Elias Vance"></label>
      </div>
      <label class="field"><span>${civil ? 'The claim' : 'The charge'}</span>
        <input type="text" id="f-charge" value="${esc(c.charge)}" placeholder="${civil ? 'Breach of contract and negligent misrepresentation' : 'Arson in the second degree'}"></label>
      <label class="field"><span>What happened (both sides argue over this)</span>
        <textarea id="f-summary" placeholder="A few lines of background. Leave it blank and the room will fill it in as you go.">${esc(c.summary)}</textarea></label>

      <div class="actions">
        <button class="ghost" data-back>Back</button>
        <button class="ghost" id="surprise">🎲 Invent a case for me</button>
        <span class="spacer"></span>
        <button class="primary" id="next">Next: who are you?</button>
      </div>
      <div class="err" id="caseErr" hidden></div>
    </div>`;

  const readCase = () => ({
    ...state.caseInfo,
    id: app.querySelector('#f-id').value.trim(),
    court: app.querySelector('#f-court').value.trim(),
    partyA: app.querySelector('#f-a').value.trim(),
    partyB: app.querySelector('#f-b').value.trim(),
    charge: app.querySelector('#f-charge').value.trim(),
    summary: app.querySelector('#f-summary').value.trim(),
  });

  app.querySelectorAll('[data-type]').forEach((b) => b.addEventListener('click', () => {
    // Switching type changes which roles exist, so any picks are cleared.
    set({ caseInfo: { ...readCase(), type: b.dataset.type }, picked: [], roles: [] });
  }));

  app.querySelector('[data-back]').addEventListener('click', () => {
    set({ caseInfo: readCase(), step: 'device' });
  });

  app.querySelector('#surprise').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true; btn.textContent = 'Drafting the docket…';
    try {
      const r = await fetch('/api/court/case', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: state.caseInfo.type }),
      });
      if (!r.ok) throw new Error(r.status === 503 ? 'No API key is configured on the server.' : 'Could not reach the court.');
      set({ caseInfo: { ...state.caseInfo, ...(await r.json()) } });
    } catch (err) {
      btn.disabled = false; btn.textContent = '🎲 Invent a case for me';
      const box = app.querySelector('#caseErr');
      box.hidden = false; box.textContent = err.message;
    }
  });

  app.querySelector('#next').addEventListener('click', () => {
    const info = readCase();
    if (!info.partyB) {
      const box = app.querySelector('#caseErr');
      box.hidden = false; box.textContent = 'Give the defendant a name — everything else can wait.';
      return;
    }
    if (!info.id) info.id = `${info.type === 'civil' ? 'CV' : 'CR'}-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
    if (!info.court) info.court = 'Marrow County Superior Court';
    if (!info.partyA) info.partyA = info.type === 'civil' ? 'The plaintiff' : 'The People';
    set({ caseInfo: info, step: 'you' });
  });
}

/* 3. Who the player is ----------------------------------------------------- */

function stepYou() {
  const options = rolesFor(state.caseInfo.type);
  const picked = new Set(state.picked);
  app.innerHTML = `
    ${stepBar()}
    <div class="card">
      <h2>Who are you?</h2>
      <p class="hint">Pick one, or pick two and play both at once — you choose which of them is speaking
        before every line. Claude plays everyone you don't. You can switch, add or drop a character at
        any point in the trial.</p>
      <div class="pick-grid roles">
        ${options.map((r) => `
          <button class="pick ${picked.has(r.name) ? 'on' : ''}" data-role="${esc(r.name)}">
            <strong>${esc(r.name)}</strong><small>${esc(r.hint)}</small>
          </button>`).join('')}
      </div>
      <label class="field" style="margin-top:14px"><span>Somebody else entirely</span>
        <input type="text" id="f-custom" placeholder="Court interpreter, the defendant's brother, a juror…"></label>
      <button class="ghost" id="addCustom">Add that role</button>
      <div class="actions">
        <button class="ghost" data-back>Back</button>
        <span class="spacer"></span>
        <button class="primary" id="next" ${picked.size ? '' : 'disabled'}>
          Next: your character${picked.size > 1 ? 's' : ''}</button>
      </div>
    </div>`;

  const toggle = (name) => {
    const next = picked.has(name)
      ? state.picked.filter((n) => n !== name)
      : [...state.picked, name];
    set({ picked: next });
  };

  app.querySelectorAll('[data-role]').forEach((b) => b.addEventListener('click', () => toggle(b.dataset.role)));
  app.querySelector('#addCustom').addEventListener('click', () => {
    const v = app.querySelector('#f-custom').value.trim();
    if (v && !picked.has(v)) set({ picked: [...state.picked, v] });
  });
  app.querySelector('[data-back]').addEventListener('click', () => set({ step: 'case' }));
  app.querySelector('#next').addEventListener('click', () => {
    if (!state.picked.length) return;
    set({ roles: buildRoster(), step: 'youDesc' });
  });
}

/* The roster keeps anything already written and adds a slot for each new pick.
 * Roles the player took are marked 'user'; the standard cast fills the rest. */
function buildRoster() {
  const kept = new Map(state.roles.map((r) => [r.role, r]));
  const out = [];
  const add = (roleName, played) => {
    const prev = kept.get(roleName);
    out.push(prev
      ? { ...prev, played }
      : { rid: uid(), role: roleName, character: '', description: '', played });
    kept.delete(roleName);
  };

  state.picked.forEach((name) => add(name, 'user'));
  rolesFor(state.caseInfo.type)
    .filter((r) => r.core && !state.picked.includes(r.name))
    .forEach((r) => add(r.name, 'ai'));
  // Extras the player added to the room earlier survive a trip back through setup.
  kept.forEach((r) => out.push({ ...r, played: state.picked.includes(r.role) ? 'user' : r.played }));
  return out;
}

/* 4. The player's own character(s) ------------------------------------------ */

function stepYouDesc() {
  const mine = myRoles();
  app.innerHTML = `
    ${stepBar()}
    <div class="card">
      <h2>Your character${mine.length > 1 ? 's' : ''}</h2>
      <p class="hint">A name, and however much or little you want about them. The room will treat this
        as true — a public defender four cases behind gets a different trial than a name partner.</p>
      ${mine.map((r) => `
        <div class="cast-row" data-rid="${r.rid}">
          <div class="who"><span class="role">${esc(r.role)}</span><span class="badge you">You</span></div>
          <label class="field" style="margin-top:10px"><span>Name</span>
            <input type="text" data-f="character" value="${esc(r.character)}" placeholder="e.g. Nadia Cortez"></label>
          <label class="field"><span>Description</span>
            <textarea data-f="description" placeholder="How they carry themselves, what they want out of this case, what they're hiding.">${esc(r.description)}</textarea></label>
        </div>`).join('')}
      <div class="actions">
        <button class="ghost" data-back>Back</button>
        <span class="spacer"></span>
        <button class="primary" id="next">Next: the rest of the room</button>
      </div>
    </div>`;

  const readMine = () => state.roles.map((r) => {
    const row = app.querySelector(`.cast-row[data-rid="${r.rid}"]`);
    if (!row) return r;
    return {
      ...r,
      character: row.querySelector('[data-f="character"]').value.trim(),
      description: row.querySelector('[data-f="description"]').value.trim(),
    };
  });

  app.querySelector('[data-back]').addEventListener('click', () => set({ roles: readMine(), step: 'you' }));
  app.querySelector('#next').addEventListener('click', () => {
    const roles = readMine().map((r) => (
      r.played === 'user' && !r.character ? { ...r, character: r.role } : r));
    set({ roles, step: 'cast' });
  });
}

/* 5. Everybody else -------------------------------------------------------- */

function stepCast() {
  const others = aiRoles();
  const extras = rolesFor(state.caseInfo.type)
    .filter((r) => !state.roles.some((x) => x.role === r.name));

  app.innerHTML = `
    ${stepBar()}
    <div class="card">
      <h2>Everybody else</h2>
      <p class="hint">Write them yourself, or leave them blank and let Claude write anyone you skipped.
        You can add more people to the room later, and take any of them over mid-trial.</p>
      <div class="cast">
        ${others.map((r) => `
          <div class="cast-row" data-rid="${r.rid}">
            <div class="who"><span class="role">${esc(r.role)}</span><span class="badge">Claude plays this</span></div>
            <div class="row two" style="margin-top:10px">
              <label class="field"><span>Name</span>
                <input type="text" data-f="character" value="${esc(r.character)}" placeholder="leave blank for Claude"></label>
              <label class="field"><span>Description</span>
                <input type="text" data-f="description" value="${esc(r.description)}" placeholder="leave blank for Claude"></label>
            </div>
            <div class="row-actions"><button class="ghost danger" data-drop="${r.rid}">Remove from the room</button></div>
          </div>`).join('') || '<p class="hint">Nobody else yet — add someone below.</p>'}
      </div>

      <h3>Add someone</h3>
      <div class="pick-grid roles">
        ${extras.map((r) => `<button class="pick" data-add="${esc(r.name)}">
          <strong>${esc(r.name)}</strong><small>${esc(r.hint)}</small></button>`).join('')}
      </div>
      <label class="field" style="margin-top:12px"><span>Or somebody not on the list</span>
        <input type="text" id="f-extra" placeholder="A juror, the arson investigator, the defendant's mother…"></label>
      <button class="ghost" id="addExtra">Add to the room</button>

      <div class="actions">
        <button class="ghost" data-back>Back</button>
        <button id="autoCast">✍️ Claude writes the blanks</button>
        <span class="spacer"></span>
        <button class="primary" id="next">Next: the verdict</button>
      </div>
      <div class="err" id="castErr" hidden></div>
    </div>`;

  const readAll = () => state.roles.map((r) => {
    const row = app.querySelector(`.cast-row[data-rid="${r.rid}"]`);
    if (!row) return r;
    return {
      ...r,
      character: row.querySelector('[data-f="character"]').value.trim(),
      description: row.querySelector('[data-f="description"]').value.trim(),
    };
  });

  app.querySelectorAll('[data-drop]').forEach((b) => b.addEventListener('click', () => {
    set({ roles: readAll().filter((r) => r.rid !== b.dataset.drop) });
  }));
  app.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => {
    set({ roles: [...readAll(), { rid: uid(), role: b.dataset.add, character: '', description: '', played: 'ai' }] });
  }));
  app.querySelector('#addExtra').addEventListener('click', () => {
    const v = app.querySelector('#f-extra').value.trim();
    if (!v) return;
    set({ roles: [...readAll(), { rid: uid(), role: v, character: '', description: '', played: 'ai' }] });
  });
  app.querySelector('[data-back]').addEventListener('click', () => set({ roles: readAll(), step: 'youDesc' }));
  app.querySelector('#next').addEventListener('click', () => set({ roles: readAll(), step: 'decider' }));

  app.querySelector('#autoCast').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const roles = readAll();
    const blanks = roles.filter((r) => r.played === 'ai' && (!r.character || !r.description));
    if (!blanks.length) return;
    btn.disabled = true; btn.textContent = 'Writing the room…';
    try {
      const filled = await fillCast(state.caseInfo, blanks);
      set({ roles: roles.map((r) => filled[r.role] ? { ...r, ...filled[r.role] } : r) });
    } catch (err) {
      btn.disabled = false; btn.textContent = '✍️ Claude writes the blanks';
      const box = app.querySelector('#castErr');
      box.hidden = false; box.textContent = err.message;
    }
  });
}

async function fillCast(caseInfo, blanks) {
  const r = await fetch('/api/court/cast', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      caseInfo,
      roles: blanks.map((b) => ({ role: b.role, hint: b.character || b.description || '' })),
    }),
  });
  if (!r.ok) throw new Error(r.status === 503 ? 'No API key is configured on the server.' : 'Could not reach the court.');
  const { cast } = await r.json();
  return Object.fromEntries((cast || []).map((m) => [m.role, { character: m.character, description: m.description }]));
}

/* 6. Who decides ----------------------------------------------------------- */

function stepDecider() {
  const jury = state.verdictBy === 'jury';
  app.innerHTML = `
    ${stepBar()}
    <div class="card">
      <h2>Who decides this case?</h2>
      <p class="hint">You still call the outcome yourself at the end. This decides who is in the room
        deciding it, and who reads it out.</p>
      <div class="pick-grid two">
        <button class="pick ${jury ? 'on' : ''}" data-decider="jury">
          <strong>👥 A jury</strong>
          <small>Twelve of them, watching everything. The foreperson stands up and reads the verdict at
            the end, and you write what they say.</small>
        </button>
        <button class="pick ${!jury ? 'on' : ''}" data-decider="judge">
          <strong>🔨 The judge</strong>
          <small>Bench trial. No jury to play to — the judge hears it all and rules from the bench.</small>
        </button>
      </div>
      ${jury ? `<label class="field" style="margin-top:14px"><span>Jurors</span>
        <input type="text" id="f-jury" value="${esc(state.juryCount)}" inputmode="numeric"></label>` : ''}
      <div class="actions">
        <button class="ghost" data-back>Back</button>
        <span class="spacer"></span>
        <button class="primary" id="start">⚖️ Call the court to order</button>
      </div>
    </div>`;

  app.querySelectorAll('[data-decider]').forEach((b) => b.addEventListener('click', () => {
    set({ verdictBy: b.dataset.decider });
  }));
  app.querySelector('[data-back]').addEventListener('click', () => set({ step: 'cast' }));
  app.querySelector('#start').addEventListener('click', () => {
    const n = Number(app.querySelector('#f-jury')?.value);
    const roles = state.roles.map((r) => (r.character ? r : { ...r, character: r.role }));
    const mine = roles.filter((r) => r.played === 'user');
    // A jury foreperson has to exist for a jury verdict to be read out.
    if (state.verdictBy === 'jury' && !roles.some((r) => /foreperson/i.test(r.role))) {
      roles.push({ rid: uid(), role: 'Jury Foreperson', character: 'the foreperson', description: '', played: 'ai' });
    }
    set({
      roles,
      juryCount: Number.isFinite(n) && n > 0 && n < 25 ? Math.round(n) : 12,
      screen: 'trial',
      speaking: mine[0]?.rid || null,
      messages: state.messages.length ? state.messages : [openingBeat()],
    });
    setTimeout(() => sendTurn(), 0);
  });
}

function openingBeat() {
  const { a, b } = sideNames();
  const c = state.caseInfo;
  return {
    id: uid(), role: 'user', kind: 'note',
    speaker: 'Court',
    content: `Court is called to order in ${c.court}. Case ${c.id}, ${a} v. ${b}`
      + `${c.charge ? `, on the ${c.type === 'civil' ? 'claim' : 'charge'} of ${c.charge}` : ''}. `
      + `The verdict will be decided by ${state.verdictBy === 'jury' ? `a jury of ${state.juryCount}` : 'the judge'}. `
      + `Bring the room in and open the proceedings.`,
  };
}

/* ------------------------------------------------------------------- trial */

function renderTrial() {
  const c = state.caseInfo;
  const { a, b } = sideNames();
  const mine = myRoles();
  const speaker = currentSpeaker();
  crumb.textContent = `${a} v. ${b}`;

  app.innerHTML = `
    <div class="trial">
      <div class="docket">
        <span class="case-id">${esc(c.id)}</span>
        <span><b>${esc(a)}</b> v. <b>${esc(b)}</b></span>
        <span>· ${esc(c.court)}</span>
        <span>· ${state.verdictBy === 'jury' ? `jury of ${esc(state.juryCount)}` : 'bench trial'}</span>
      </div>

      <div id="log">${state.messages.map(turnHtml).join('')}
        <div id="live"></div>
      </div>

      <div class="composer">
        <div class="speaking">
          <span class="lbl">Speaking as</span>
          <select id="speakAs">
            ${mine.map((r) => `<option value="${r.rid}" ${speaker?.rid === r.rid ? 'selected' : ''}>
              ${esc(label(r))}</option>`).join('')}
            ${mine.length > 1 ? `<option value="__multi" ${state.speaking === '__multi' ? 'selected' : ''}>
              Several of mine at once</option>` : ''}
          </select>
          <button class="ghost" id="castBtn">Cast</button>
          <span class="spacer"></span>
          <button class="ghost" id="verdictBtn">Deliver the verdict</button>
        </div>
        <div class="box">
          <textarea id="say" placeholder="${esc(speaker ? `What does ${speaker.character} say or do?` : 'Say something')}"></textarea>
          <button class="primary send" id="send" ${state.busy ? 'disabled' : ''}>Send</button>
        </div>
        <div class="quick">${QUICK_LINES.map((q) => `<button data-quick="${esc(q)}">${esc(q)}</button>`).join('')}</div>
        <div class="err" id="trialErr" hidden></div>
      </div>
    </div>`;

  const log = app.querySelector('#log');
  log.scrollTop = log.scrollHeight;

  const say = app.querySelector('#say');
  app.querySelector('#speakAs')?.addEventListener('change', (e) => {
    set({ speaking: e.target.value }, { rerender: false });
  });
  app.querySelector('#castBtn').addEventListener('click', castModal);
  app.querySelector('#verdictBtn').addEventListener('click', () => set({ screen: 'verdict' }));
  app.querySelector('#send').addEventListener('click', () => submit(say.value));
  app.querySelectorAll('[data-quick]').forEach((qb) => qb.addEventListener('click', () => {
    say.value = say.value ? `${say.value} ${qb.dataset.quick}` : qb.dataset.quick;
    say.focus();
  }));
  say.addEventListener('keydown', (e) => {
    // Enter sends on a keyboard; on a phone it should just be a new line.
    if (e.key === 'Enter' && !e.shiftKey && state.device !== 'mobile') {
      e.preventDefault();
      submit(say.value);
    }
  });
  if (state.device !== 'mobile') say.focus();
}

function turnHtml(m) {
  if (m.kind === 'verdict') return '';   // the directive is for the model, not the transcript
  if (m.kind === 'note' || m.kind === 'local') {
    return `<div class="note">${fmt(m.content)}</div>`;
  }
  if (m.kind === 'evidence') {
    return `<div class="note"><b>Exhibit check.</b> ${fmt(m.content)}</div>`;
  }
  return `<div class="turn ${m.role === 'user' ? 'mine' : ''}">
    ${m.speaker ? `<div class="speaker">${esc(m.speaker)}</div>` : ''}
    <div class="bubble">${fmt(m.content)}</div>
  </div>`;
}

function submit(text) {
  const content = String(text || '').trim();
  if (!content || state.busy) return;
  const speaker = currentSpeaker();
  const multi = state.speaking === '__multi' && myRoles().length > 1;
  push({
    id: uid(), role: 'user', content,
    speaker: multi ? 'You (several characters)' : (speaker ? label(speaker) : 'You'),
  });
  sendTurn();
}

function push(msg) {
  state.messages = [...state.messages, msg];
  save();
}

/* What actually goes to the model: the player's lines carry the character they
 * were spoken as, so a mid-trial switch is unambiguous. */
function wireMessages() {
  return state.messages.map((m) => {
    if (m.role !== 'user') return { role: 'assistant', content: m.content };
    if (m.kind === 'local') return null;   // transcript-only, never sent
    if (m.kind === 'note') return { role: 'user', content: m.content };
    if (m.kind === 'evidence') return { role: 'user', content: `EVIDENCE ANSWER — ${m.content}` };
    if (m.kind === 'verdict') return { role: 'user', content: m.content };
    if (m.speaker === 'You (several characters)') {
      return { role: 'user', content: `The player, speaking for several of their characters at once:\n${m.content}` };
    }
    return { role: 'user', content: `**${m.speaker}:** ${m.content}` };
  }).filter(Boolean);
}

async function sendTurn() {
  if (state.busy) return;
  state.busy = true;
  render();

  const live = app.querySelector('#live');
  const log = app.querySelector('#log');
  const errBox = app.querySelector('#trialErr');
  streamText = '';
  if (live) live.innerHTML = '<div class="thinking">The room is thinking…</div>';

  const paint = () => {
    if (!live) return;
    const shown = streamText.split('[[EVIDENCE]]')[0];
    live.innerHTML = shown
      ? `<div class="turn"><div class="bubble">${fmt(shown)}</div></div>`
      : '<div class="thinking">The room is thinking…</div>';
    log.scrollTop = log.scrollHeight;
  };

  try {
    const res = await fetch('/api/court/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setup: {
          caseInfo: state.caseInfo, roles: state.roles,
          verdictBy: state.verdictBy, juryCount: state.juryCount,
        },
        messages: wireMessages(),
      }),
    });
    if (res.status === 503) throw new Error('No API key is configured on the server, so the room stays empty.');
    if (!res.ok) throw new Error('The court is not responding. Try that line again.');

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let streamErr = null;

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6);
        if (payload === '[DONE]') continue;
        try {
          const data = JSON.parse(payload);
          if (data.error) streamErr = data.error;
          if (data.text) { streamText += data.text; paint(); }
        } catch { /* a split frame; the next chunk completes it */ }
      }
    }
    if (streamErr && !streamText) throw new Error(streamErr);

    const { body, evidence } = splitEvidence(streamText);
    state.busy = false;
    if (body) push({ id: uid(), role: 'assistant', content: body });
    render();
    if (evidence) askEvidence(evidence);
  } catch (err) {
    state.busy = false;
    if (streamText) push({ id: uid(), role: 'assistant', content: splitEvidence(streamText).body });
    render();
    const box = app.querySelector('#trialErr');
    if (box) { box.hidden = false; box.textContent = err.message; }
    if (errBox) errBox.hidden = false;
  }
}

/* The model ends a turn with an evidence block when it needs something off the
 * player's side. Anything after the block is dropped — the answer decides it. */
function splitEvidence(raw) {
  const start = raw.indexOf('[[EVIDENCE]]');
  if (start < 0) return { body: raw.trim(), evidence: null };
  const body = raw.slice(0, start).trim();
  const rest = raw.slice(start + '[[EVIDENCE]]'.length).replace('[[/EVIDENCE]]', '');
  const open = rest.indexOf('{');
  const close = rest.lastIndexOf('}');
  if (open < 0 || close <= open) return { body, evidence: null };
  try {
    const e = JSON.parse(rest.slice(open, close + 1));
    return {
      body,
      evidence: {
        item: String(e.item || 'the exhibit'),
        asker: String(e.asker || 'The court'),
        question: String(e.question || 'Do you have it?'),
        options: Array.isArray(e.options) && e.options.length
          ? e.options.slice(0, 4).map(String)
          : ['Yes, I have it', "No, I don't have it"],
      },
    };
  } catch {
    return { body, evidence: null };
  }
}

function askEvidence(e) {
  openModal(`
    <h3>Do you have this?</h3>
    <p class="hint">The court is asking for something off your side. Whatever you answer becomes true
      for the rest of the trial — including not having it.</p>
    <div class="exhibit">
      <div class="asker">${esc(e.asker)} asks</div>
      <div class="item">${esc(e.item)}</div>
      <p class="hint" style="margin:8px 0 0">${esc(e.question)}</p>
    </div>
    <div class="stack">
      ${e.options.map((o, i) => `<button class="${i === 0 ? 'primary' : ''}" data-opt="${esc(o)}">${esc(o)}</button>`).join('')}
    </div>
    <label class="field" style="margin-top:14px"><span>Or answer in your own words</span>
      <input type="text" id="ev-custom" placeholder="I have it, but it's been redacted…"></label>
    <button class="ghost" id="ev-send">Answer</button>
  `, (root) => {
    const answer = (text) => {
      closeModal();
      push({
        id: uid(), role: 'user', kind: 'evidence', speaker: 'You',
        content: `${e.item} — ${text}`,
      });
      render();
      sendTurn();
    };
    root.querySelectorAll('[data-opt]').forEach((b) => b.addEventListener('click', () => answer(b.dataset.opt)));
    root.querySelector('#ev-send').addEventListener('click', () => {
      const v = root.querySelector('#ev-custom').value.trim();
      if (v) answer(v);
    });
  });
}

/* --------------------------------------------------------- cast, mid-trial */

function castModal() {
  const extras = rolesFor(state.caseInfo.type).filter((r) => !state.roles.some((x) => x.role === r.name));
  openModal(`
    <h3>Who's in the room</h3>
    <p class="hint">Take a character over, hand one back to Claude, or bring somebody new in. Anyone you
      play, Claude stops playing immediately.</p>
    <div class="cast">
      ${state.roles.map((r) => `
        <div class="cast-row">
          <div class="who">
            <span class="name">${esc(r.character || r.role)}</span>
            <span class="role">${esc(r.role)}</span>
            <span class="badge ${r.played === 'user' ? 'you' : ''}">${r.played === 'user' ? 'You' : 'Claude'}</span>
          </div>
          ${r.description ? `<div class="desc">${esc(r.description)}</div>` : ''}
          <div class="row-actions">
            <button data-swap="${r.rid}">${r.played === 'user' ? 'Hand to Claude' : 'Play this one'}</button>
            <button class="ghost" data-edit="${r.rid}">Edit</button>
            <button class="ghost danger" data-drop="${r.rid}">Remove</button>
          </div>
        </div>`).join('')}
    </div>
    <h3>Bring someone in</h3>
    <div class="stack">
      ${extras.slice(0, 8).map((r) => `<button class="ghost" data-add="${esc(r.name)}">${esc(r.name)}</button>`).join('')}
    </div>
    <label class="field" style="margin-top:12px"><span>Or someone new</span>
      <input type="text" id="new-role" placeholder="Surprise witness, a juror, the arson investigator…"></label>
    <button class="ghost" id="add-new">Add to the room</button>
  `, (root) => {
    root.querySelectorAll('[data-swap]').forEach((b) => b.addEventListener('click', () => {
      const roles = state.roles.map((r) => (
        r.rid === b.dataset.swap ? { ...r, played: r.played === 'user' ? 'ai' : 'user' } : r));
      const mine = roles.filter((r) => r.played === 'user');
      closeModal();
      set({
        roles,
        picked: mine.map((r) => r.role),
        speaking: mine.some((r) => r.rid === state.speaking) ? state.speaking : (mine[0]?.rid || null),
        messages: [...state.messages, {
          id: uid(), role: 'user', kind: 'note', speaker: 'Court',
          content: mine.length
            ? `The player now speaks for: ${mine.map(label).join(', ')}. Play everyone else and nobody on that list.`
            : 'The player is watching for now. Carry the room yourself until they step back in.',
        }],
      });
    }));

    root.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => editRole(b.dataset.edit)));

    root.querySelectorAll('[data-drop]').forEach((b) => b.addEventListener('click', () => {
      const gone = roleById(b.dataset.drop);
      const roles = state.roles.filter((r) => r.rid !== b.dataset.drop);
      const mine = roles.filter((r) => r.played === 'user');
      closeModal();
      set({
        roles, picked: mine.map((r) => r.role),
        speaking: mine.some((r) => r.rid === state.speaking) ? state.speaking : (mine[0]?.rid || null),
        messages: [...state.messages, {
          id: uid(), role: 'user', kind: 'note', speaker: 'Court',
          content: `${gone ? esc(gone.character || gone.role) : 'Someone'} has left the courtroom and takes no further part.`,
        }],
      });
    }));

    const addRole = (name) => {
      if (!name) return;
      closeModal();
      const r = { rid: uid(), role: name, character: '', description: '', played: 'ai' };
      set({
        roles: [...state.roles, r],
        messages: [...state.messages, {
          id: uid(), role: 'user', kind: 'note', speaker: 'Court',
          content: `A ${name} has entered the courtroom. Introduce them and give them a name.`,
        }],
      });
      editRole(r.rid);
    };
    root.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => addRole(b.dataset.add)));
    root.querySelector('#add-new').addEventListener('click', () => addRole(root.querySelector('#new-role').value.trim()));
  });
}

function editRole(rid) {
  const r = roleById(rid);
  if (!r) return;
  openModal(`
    <h3>${esc(r.role)}</h3>
    <label class="field"><span>Name</span>
      <input type="text" id="e-name" value="${esc(r.character)}"></label>
    <label class="field"><span>Description</span>
      <textarea id="e-desc">${esc(r.description)}</textarea></label>
    <div class="stack">
      <button class="primary" id="e-save">Save</button>
      <button class="ghost" id="e-auto">✍️ Let Claude write them</button>
    </div>
    <div class="err" id="e-err" hidden></div>
  `, (root) => {
    root.querySelector('#e-save').addEventListener('click', () => {
      const character = root.querySelector('#e-name').value.trim();
      const description = root.querySelector('#e-desc').value.trim();
      closeModal();
      set({ roles: state.roles.map((x) => (x.rid === rid ? { ...x, character, description } : x)) });
    });
    root.querySelector('#e-auto').addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true; btn.textContent = 'Writing…';
      try {
        const filled = await fillCast(state.caseInfo, [{ role: r.role, character: root.querySelector('#e-name').value.trim() }]);
        const got = filled[r.role];
        if (!got) throw new Error('Nobody turned up. Try again.');
        root.querySelector('#e-name').value = got.character;
        root.querySelector('#e-desc').value = got.description;
      } catch (err) {
        const box = root.querySelector('#e-err');
        box.hidden = false; box.textContent = err.message;
      }
      btn.disabled = false; btn.textContent = '✍️ Let Claude write them';
    });
  });
}

/* ----------------------------------------------------------------- verdict */

function renderVerdictForm() {
  const c = state.caseInfo;
  const { a, b } = sideNames();
  const civil = c.type === 'civil';
  const jury = state.verdictBy === 'jury';
  crumb.textContent = 'The verdict';

  app.innerHTML = `
    <div class="card">
      <h2>You call it.</h2>
      <p class="hint">However the trial went, the outcome is yours. The room will read out exactly what
        you write here — and then live with it.</p>

      <h3>Who wins</h3>
      <div class="pick-grid two">
        <button class="pick" data-win="a"><strong>${esc(a)}</strong>
          <small>${civil ? 'The defendant is found liable.' : 'A conviction.'}</small></button>
        <button class="pick" data-win="b"><strong>${esc(b)}</strong>
          <small>${civil ? 'The defendant walks — not liable.' : 'An acquittal.'}</small></button>
      </div>
      <div class="pick-grid two" style="margin-top:10px">
        <button class="pick" data-win="hung"><strong>${jury ? 'Hung jury' : 'Mistrial'}</strong>
          <small>${jury ? 'They cannot agree. No verdict.' : 'The trial collapses before judgment.'}</small></button>
        <button class="pick" data-win="split"><strong>Split it</strong>
          <small>Some counts one way, some the other. Write it below.</small></button>
      </div>

      <label class="field" style="margin-top:16px">
        <span>${jury ? `What the ${state.juryCount === 1 ? 'juror' : 'jury'} finds, in their words`
          : 'What the judge rules, in their words'}</span>
        <textarea id="v-text" placeholder="${civil
          ? 'We find for the plaintiff on the claim of breach of contract, and award $240,000 in damages.'
          : 'We the jury find the defendant guilty of arson in the second degree, and not guilty on count two.'}"></textarea>
      </label>
      <label class="field"><span>${civil ? 'Damages, costs, anything else the court orders' : 'Sentence, or what the judge says before adjourning'} (optional)</span>
        <input type="text" id="v-extra" placeholder="${civil ? '$240,000 plus costs' : 'Eight years, sentencing set for the 14th'}"></label>
      <label class="field"><span>How the room takes it (optional)</span>
        <input type="text" id="v-room" placeholder="The gallery erupts. The defendant does not move."></label>

      <div class="actions">
        <button class="ghost" id="v-back">Back to the trial</button>
        <span class="spacer"></span>
        <button class="primary" id="v-read" disabled>Read the verdict</button>
      </div>
      <div class="err" id="v-err" hidden></div>
    </div>`;

  let win = null;
  app.querySelectorAll('[data-win]').forEach((btn) => btn.addEventListener('click', () => {
    win = btn.dataset.win;
    app.querySelectorAll('[data-win]').forEach((x) => x.classList.toggle('on', x === btn));
    app.querySelector('#v-read').disabled = false;
  }));

  app.querySelector('#v-back').addEventListener('click', () => set({ screen: 'trial' }));
  app.querySelector('#v-read').addEventListener('click', () => {
    if (!win) return;
    const text = app.querySelector('#v-text').value.trim();
    const extra = app.querySelector('#v-extra').value.trim();
    const room = app.querySelector('#v-room').value.trim();
    const outcome = win === 'a' ? `${a} wins` : win === 'b' ? `${b} wins`
      : win === 'hung' ? (jury ? 'the jury hangs and no verdict is returned' : 'the judge declares a mistrial')
      : 'the verdict is split across the counts';

    const directive = `VERDICT — this is final and already decided; play it out, do not change it.\n`
      + `Decided by: ${jury ? `the jury of ${state.juryCount}, read by the foreperson` : 'the judge, from the bench'}\n`
      + `Outcome: ${outcome}.\n`
      + `${text ? `The words to be read: "${text}"\n` : ''}`
      + `${extra ? `Also ordered: ${extra}\n` : ''}`
      + `${room ? `The room reacts: ${room}\n` : ''}`
      + `Play the reading of the verdict and everything that follows it in the courtroom — the clerk, `
      + `the ${jury ? 'foreperson' : 'judge'}, the reaction of everyone you play, and the adjournment. `
      + `Never write for the player's characters.`;

    set({
      screen: 'trial',
      verdict: { win, text, extra, room },
      messages: [...state.messages,
        { id: uid(), role: 'user', kind: 'local', speaker: 'Court', content: `**Verdict returned.** ${outcome}.` },
        { id: uid(), role: 'user', kind: 'verdict', speaker: 'Court', content: directive }],
    });
    sendTurn();
  });
}

/* -------------------------------------------------------------------- menu */

menuBtn.addEventListener('click', () => {
  const c = state.caseInfo;
  openModal(`
    <h3>Menu</h3>
    ${state.screen !== 'setup' ? `<p class="hint">Case ${esc(c.id)} — ${esc(sideNames().a)} v. ${esc(sideNames().b)}</p>` : ''}
    <div class="stack">
      <button data-m="device">📱 / 💻 Switch layout (now: ${state.device === 'mobile' ? 'phone' : 'computer'})</button>
      ${state.screen === 'trial' ? '<button data-m="cast">👥 Who\'s in the room</button>' : ''}
      ${state.screen === 'trial' ? '<button data-m="verdict">⚖️ Deliver the verdict</button>' : ''}
      ${state.screen !== 'setup' ? '<button data-m="sheet">📄 The case sheet</button>' : ''}
      ${state.screen !== 'setup' ? '<button data-m="copy">📋 Copy the transcript</button>' : ''}
      <button class="ghost danger" data-m="reset">🗑️ Start a new case</button>
      <button class="ghost" data-m="hub">← Back to the games</button>
    </div>
  `, (root) => {
    root.querySelectorAll('[data-m]').forEach((b) => b.addEventListener('click', () => {
      const m = b.dataset.m;
      if (m === 'device') { closeModal(); set({ device: state.device === 'mobile' ? 'desktop' : 'mobile' }); }
      else if (m === 'cast') castModal();
      else if (m === 'verdict') { closeModal(); set({ screen: 'verdict' }); }
      else if (m === 'sheet') caseSheet();
      else if (m === 'copy') copyTranscript(b);
      else if (m === 'hub') { window.location.href = '/'; }
      else if (m === 'reset') {
        if (!confirm('Throw out this case and start a new one?')) return;
        closeModal();
        state = blankState();
        save();
        render();
      }
    }));
  });
});

function caseSheet() {
  const c = state.caseInfo;
  openModal(`
    <h3>Case sheet</h3>
    <label class="field"><span>Case number</span><input type="text" id="s-id" value="${esc(c.id)}"></label>
    <label class="field"><span>Court</span><input type="text" id="s-court" value="${esc(c.court)}"></label>
    <label class="field"><span>${c.type === 'civil' ? 'The claim' : 'The charge'}</span>
      <input type="text" id="s-charge" value="${esc(c.charge)}"></label>
    <label class="field"><span>Background</span><textarea id="s-sum">${esc(c.summary)}</textarea></label>
    <div class="stack"><button class="primary" id="s-save">Save</button></div>
  `, (root) => {
    root.querySelector('#s-save').addEventListener('click', () => {
      const info = {
        ...c,
        id: root.querySelector('#s-id').value.trim(),
        court: root.querySelector('#s-court').value.trim(),
        charge: root.querySelector('#s-charge').value.trim(),
        summary: root.querySelector('#s-sum').value.trim(),
      };
      closeModal();
      set({ caseInfo: info });
    });
  });
}

async function copyTranscript(btn) {
  const c = state.caseInfo;
  const text = `${c.court}\nCase ${c.id} — ${sideNames().a} v. ${sideNames().b}\n\n`
    + state.messages
      .filter((m) => m.kind !== 'verdict')
      .map((m) => (m.kind ? `— ${m.content.replace(/\*\*/g, '')} —` : `${m.speaker ? `${m.speaker}\n` : ''}${m.content}`))
      .join('\n\n');
  try {
    await navigator.clipboard.writeText(text);
    btn.textContent = '📋 Copied';
  } catch {
    btn.textContent = 'Clipboard blocked — select the transcript instead';
  }
}

render();
