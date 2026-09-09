/* Inspection Simulator — screen flow, defect picker, report rendering.
 *
 * Nothing in here knows what is being inspected. The active domain supplies the
 * intake form, the sections, the defect menu, the severity wording and the
 * labels; this file just drives the screens. */

import { DOMAINS, DOMAIN_BY_ID, DEFAULT_DOMAIN, sectionById, itemById, defectsFor, defectById } from './domains/index.js';
import { severitiesFor, severityMap } from './severity.js';
import { buildReport, reportToText, scoreReport } from './report.js';

const SAVE_KEY = 'inspection-sim-v2';
const app = document.getElementById('app');
const crumb = document.getElementById('crumb');
const autosaveEl = document.getElementById('autosave');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const brandMark = document.querySelector('.brand .mark');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

/* -------------------------------------------------------------- game state */

function blankProfile(domain) {
  const p = {};
  domain.intake.forEach((group) => group.fields.forEach((f) => {
    if (f.type === 'choice') p[f.id] = f.options[0];
    else if (f.type === 'counter') p[f.id] = f.value;
    else p[f.id] = '';
  }));
  p.date = new Date().toISOString().slice(0, 10);
  return p;
}

function freshState(domainId, keep = {}) {
  const domain = DOMAIN_BY_ID[domainId] || DOMAIN_BY_ID[DEFAULT_DOMAIN];
  return {
    screen: 'start',
    intakeStep: 0,
    device: null,
    domainId: domain.id,
    profile: blankProfile(domain),
    findings: [],
    narrative: null,
    ...keep,
  };
}

let state = load() || freshState(DEFAULT_DOMAIN);
if (!DOMAIN_BY_ID[state.domainId]) state.domainId = DEFAULT_DOMAIN;

const domain = () => DOMAIN_BY_ID[state.domainId];

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    autosaveEl.textContent = 'Saved';
    clearTimeout(save.t);
    save.t = setTimeout(() => { autosaveEl.textContent = ''; }, 1400);
  } catch { /* private mode — the game still runs, it just won't resume */ }
}

function set(patch) {
  state = { ...state, ...patch };
  save();
  render();
}

/* Layout mode. The player picks it on the start screen; a narrow window forces
 * the compact layout either way, so a desktop pick never traps them in a
 * two-column form on a 380px screen. */
function detectDevice() {
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  return coarse || window.innerWidth < 820 ? 'mobile' : 'desktop';
}

function applyDevice() {
  const compact = state.device === 'mobile' || window.innerWidth < 720;
  document.body.classList.toggle('compact', compact);
  document.body.classList.toggle('device-mobile', state.device === 'mobile');
}

window.addEventListener('resize', applyDevice);

/* ------------------------------------------------------------------ modal */

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

/* ----------------------------------------------------------------- screens */

function render() {
  applyDevice();
  brandMark.textContent = domain().icon;
  if (state.screen === 'start') renderStart();
  else if (state.screen === 'intake') renderIntake();
  else if (state.screen === 'walk') renderWalk();
  else if (state.screen === 'report') renderReport();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function renderStart() {
  crumb.textContent = 'Pick what you are inspecting';
  const d = domain();
  const hasWork = state.findings.length > 0;
  const guess = detectDevice();
  const picked = state.device;
  const totalDefects = DOMAINS.reduce((n, x) => n + x.defects.length, 0);

  app.innerHTML = `
    <div class="card">
      <h2>What are you inspecting?</h2>
      <p class="hint">Each one is a different report: its own intake, its own sections, its own
        defect menu written in that trade's voice.</p>
      <div class="pick-grid two">
        ${DOMAINS.map((x) => `<button class="pick domain ${x.id === state.domainId ? 'on' : ''}" data-domain="${x.id}">
          <span class="dom-head"><span class="dom-icon">${x.icon}</span>
            <strong>${esc(x.name)}</strong></span>
          <small>${esc(x.blurb)}</small>
          <em class="tag">${x.defects.length} defects · ${x.sections.length} sections</em>
        </button>`).join('')}
      </div>
    </div>

    <div class="card">
      <h2>Where are you working?</h2>
      <p class="hint">This changes the layout, not the report. You can switch any time from the Menu.</p>
      <div class="pick-grid two">
        <button class="pick device ${picked === 'mobile' ? 'on' : ''}" data-device="mobile">
          <strong>📱 On my phone</strong>
          <small>One column, big tap targets, full-screen menus and a floating Add&nbsp;defect button —
            for tapping findings in while you are still standing in front of the thing.</small>
          ${guess === 'mobile' ? '<em class="tag">Looks like what you are on</em>' : ''}
        </button>
        <button class="pick device ${picked === 'desktop' ? 'on' : ''}" data-device="desktop">
          <strong>💻 On a computer</strong>
          <small>Wider layout, fields side by side, the whole defect menu on screen at once —
            for writing the report up afterwards.</small>
          ${guess === 'desktop' ? '<em class="tag">Looks like what you are on</em>' : ''}
        </button>
      </div>
    </div>

    <div class="card">
      <h2>${esc(d.icon)} ${esc(d.docTitle)}</h2>
      <p class="hint">${esc(d.tagline)} — you type the ${esc(d.subjectLabel.toLowerCase())} details and
        the client. Everything else is a click.</p>
      <ol class="how">
        <li><strong>Intake.</strong> A few screens of buttons. The answers fill the Information block
            of all ${d.sections.length} sections and build the list of places a finding can be attached to.</li>
        <li><strong>Walkthrough.</strong> Add finding → pick the severity → pick the section → pick the
            defect. The write-up and the recommendation come with it. Add your own note if you want to.
            You don't have to.</li>
        <li><strong>Not on the menu?</strong> Describe it in a line and Claude Sonnet writes it up in
            the same voice as the rest.</li>
        <li><strong>Generate.</strong> Claude summarizes the whole inspection, the report assembles
            itself, and you get scored on how thorough you were.</li>
      </ol>
      ${picked ? `
      <div class="row actions" style="margin-top:20px">
        <button class="primary" id="startBtn">${hasWork ? 'Resume inspection' : 'Start an inspection'}</button>
        ${hasWork ? '<button class="quiet" id="freshBtn">Start over</button>' : ''}
        <button class="quiet" id="demoBtn">Load the sample ${esc(d.subjectLabel.toLowerCase())}</button>
      </div>` : '<p class="banner" style="margin-top:20px">Pick phone or computer above to start.</p>'}
      <p class="ai-note">${totalDefects} defects in the menu across ${DOMAINS.length} inspection types.
        Everything autosaves to this browser.</p>
    </div>`;

  app.querySelectorAll('[data-device]').forEach((b) => {
    b.onclick = () => set({ device: b.dataset.device });
  });
  app.querySelectorAll('[data-domain]').forEach((b) => {
    b.onclick = () => switchDomain(b.dataset.domain);
  });
  if (!picked) return;

  app.querySelector('#startBtn').onclick = () => set({ screen: 'intake' });
  const fresh = app.querySelector('#freshBtn');
  if (fresh) {
    fresh.onclick = () => {
      if (confirm('Wipe the current inspection and start clean?')) {
        state = freshState(state.domainId, { screen: 'intake', device: state.device });
        save();
        render();
      }
    };
  }
  app.querySelector('#demoBtn').onclick = () => {
    const d2 = domain();
    state = freshState(d2.id, {
      screen: 'intake',
      device: state.device,
      profile: { ...blankProfile(d2), ...d2.sample },
    });
    save();
    render();
  };
}

function switchDomain(id) {
  if (id === state.domainId) return;
  const target = DOMAIN_BY_ID[id];
  if (state.findings.length
    && !confirm(`Switching to ${target.name} clears the ${state.findings.length} finding(s) on the `
      + 'current inspection, because the defect menu and the sections are different. Continue?')) {
    return;
  }
  state = freshState(id, { screen: state.screen === 'start' ? 'start' : 'intake', device: state.device });
  save();
  render();
}

/* --------------------------------------------------------------- intake */

function renderIntake() {
  const d = domain();
  const step = state.intakeStep;
  const group = d.intake[step];
  crumb.textContent = `${d.icon} Intake — ${group.title}`;

  app.innerHTML = `
    <div class="steps">
      ${d.intake.map((g, i) => `<span class="${i === step ? 'on' : i < step ? 'done' : ''}">${i + 1}. ${esc(g.title)}</span>`).join('')}
    </div>
    <div class="card">
      <h2>${esc(group.title)}</h2>
      <p class="hint">${esc(group.hint)}</p>
      <div class="fields">${group.fields.map(fieldHtml).join('')}</div>
    </div>
    <div class="row">
      <button class="quiet" id="backBtn">${step === 0 ? 'Back to start' : 'Back'}</button>
      <button class="primary" id="nextBtn">${step === d.intake.length - 1 ? 'Start the walkthrough' : 'Next'}</button>
      <span class="hint" id="err" style="margin:0;color:var(--sig)"></span>
    </div>`;

  wireFields(app);

  app.querySelector('#backBtn').onclick = () => (
    step === 0 ? set({ screen: 'start' }) : set({ intakeStep: step - 1 }));

  app.querySelector('#nextBtn').onclick = () => {
    const missing = group.fields.filter((f) => f.required && !String(state.profile[f.id] || '').trim());
    if (missing.length) {
      app.querySelector('#err').textContent = `Still needs: ${missing.map((f) => f.label).join(', ')}`;
      return;
    }
    if (step === d.intake.length - 1) set({ screen: 'walk' });
    else set({ intakeStep: step + 1 });
  };
}

function fieldHtml(f) {
  const v = state.profile[f.id];
  const label = `<label for="f-${f.id}">${esc(f.label)}${f.required ? ' <span class="req">*</span>' : ''}</label>`;
  if (f.type === 'choice') {
    return `<div class="field"><label>${esc(f.label)}</label>
      <div class="chipset" data-chipset="${f.id}">
        ${f.options.map((o) => `<button type="button" class="chip ${o === v ? 'on' : ''}" data-value="${esc(o)}">${esc(o)}</button>`).join('')}
      </div></div>`;
  }
  if (f.type === 'counter') {
    return `<div class="field"><label>${esc(f.label)}</label>
      <div class="counter" data-counter="${f.id}" data-min="${f.min}" data-max="${f.max}">
        <button type="button" data-step="-1">−</button><output>${esc(v)}</output><button type="button" data-step="1">+</button>
      </div></div>`;
  }
  const type = f.type === 'number' ? 'number' : f.type === 'date' ? 'date' : 'text';
  return `<div class="field ${f.width === 'short' ? 'short' : ''}">${label}
    <input id="f-${f.id}" type="${type}" data-input="${f.id}" value="${esc(v)}"
      placeholder="${esc(f.placeholder || '')}"></div>`;
}

function wireFields(root) {
  root.querySelectorAll('[data-input]').forEach((input) => {
    input.oninput = () => { state.profile[input.dataset.input] = input.value; save(); };
  });
  root.querySelectorAll('[data-chipset]').forEach((group) => {
    group.querySelectorAll('.chip').forEach((chip) => {
      chip.onclick = () => {
        state.profile[group.dataset.chipset] = chip.dataset.value;
        group.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
        chip.classList.add('on');
        save();
      };
    });
  });
  root.querySelectorAll('[data-counter]').forEach((c) => {
    const out = c.querySelector('output');
    c.querySelectorAll('button').forEach((b) => {
      b.onclick = () => {
        const min = Number(c.dataset.min);
        const max = Number(c.dataset.max);
        const next = Math.min(max, Math.max(min, Number(state.profile[c.dataset.counter]) + Number(b.dataset.step)));
        state.profile[c.dataset.counter] = next;
        out.textContent = next;
        save();
      };
    });
  });
}

/* ------------------------------------------------------------ walkthrough */

function renderWalk() {
  const d = domain();
  const sevs = severitiesFor(d);
  crumb.textContent = `${d.icon} ${d.subjectLine(state.profile) || 'Walkthrough'}`;
  const counts = Object.fromEntries(sevs.map((s) => (
    [s.id, state.findings.filter((f) => f.sev === s.id).length])));
  const hit = new Set(state.findings.map((f) => f.section));
  const listed = d.sections.filter((s) => s.items.length);

  app.innerHTML = `
    <div class="card">
      <div class="spread">
        <div>
          <h2 style="margin-bottom:2px">${esc(d.subjectLine(state.profile))}</h2>
          <p class="hint" style="margin:0">${esc(d.subjectSub ? d.subjectSub(state.profile) : d.tagline)}</p>
        </div>
        <button class="quiet" id="editIntake">Edit intake</button>
      </div>
      <div class="tally" style="margin-top:16px">
        <div><strong>${state.findings.length}</strong><span>Findings</span></div>
        ${sevs.map((s) => `<div><strong class="sev-text-${s.id}">${counts[s.id]}</strong><span>${esc(s.short)}</span></div>`).join('')}
      </div>
      <div class="section-progress">
        ${listed.map((s) => `<span class="${hit.has(s.id) ? 'hit' : ''}">${esc(s.title)}${hit.has(s.id) ? ` ${state.findings.filter((f) => f.section === s.id).length}` : ''}</span>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="spread" style="margin-bottom:14px">
        <h2 style="margin:0">Findings</h2>
        <div class="row">
          <button class="primary" id="addDefect">+ Add finding</button>
          <button class="quiet" id="addCustom">Not on the menu…</button>
        </div>
      </div>
      <div id="findingList">${state.findings.length ? state.findings.map(findingHtml).join('') : `<p class="hint">Nothing added yet. Every finding you add carries its own write-up and recommendation — you never have to type the paragraph. There are ${d.defects.length} in this menu.</p>`}</div>
    </div>

    <button class="fab" id="addDefectFab" aria-label="Add finding">+ Add finding</button>

    <div class="row">
      <button class="primary" id="finishBtn" ${state.findings.length ? '' : 'disabled'}>Generate the report</button>
      <span class="hint" style="margin:0">${state.findings.length ? 'Claude Sonnet writes the summary, then the document assembles itself.' : 'Add at least one finding first.'}</span>
    </div>`;

  app.querySelector('#editIntake').onclick = () => set({ screen: 'intake', intakeStep: 0 });
  app.querySelector('#addDefect').onclick = () => pickSeverity();
  app.querySelector('#addDefectFab').onclick = () => pickSeverity();
  app.querySelector('#addCustom').onclick = () => customDefectForm();
  app.querySelector('#finishBtn').onclick = () => generate();

  app.querySelectorAll('[data-remove]').forEach((b) => {
    b.onclick = () => set({ findings: state.findings.filter((f) => f.uid !== b.dataset.remove) });
  });
  app.querySelectorAll('[data-edit]').forEach((b) => {
    b.onclick = () => {
      const f = state.findings.find((x) => x.uid === b.dataset.edit);
      if (f) detailForm(f, true);
    };
  });
}

function findingHtml(f) {
  const d = domain();
  const sev = severityMap(d)[f.sev];
  const section = sectionById(d, f.section);
  const item = itemById(d, f.section, f.item);
  return `<div class="finding ${f.sev}">
    <div class="spread">
      <span class="sev-pill sev-${f.sev}">${esc(sev.short)}</span>
      <span class="where">${esc(section?.title || '')} · ${esc(item?.name || '')}${f.location ? ` · ${esc(f.location)}` : ''}</span>
    </div>
    <h4>${esc(f.title)}${f.custom ? ' <small style="font-weight:400;color:var(--accent)">· written by Claude</small>' : ''}</h4>
    <p>${esc(f.body)}</p>
    ${f.note ? `<p class="note">${esc(f.note)}</p>` : ''}
    <p style="color:var(--accent);font-weight:600">${esc(f.rec)}</p>
    <div class="actions">
      <button class="link" data-edit="${f.uid}">Edit location / note</button>
      <button class="link" data-remove="${f.uid}" style="color:var(--sig)">Remove</button>
    </div>
  </div>`;
}

/* ------------------------------------------------------- the defect picker */

function pickSeverity() {
  const d = domain();
  openModal(`
    <h2>How bad is it?</h2>
    <p class="hint">The severity decides which findings you see next.</p>
    <div class="pick-grid">
      ${severitiesFor(d).map((s) => `<button class="pick sev ${s.id}" data-sev="${s.id}">
        <strong>${esc(s.label)}</strong><small>${esc(s.blurb)}</small></button>`).join('')}
    </div>`, (root) => {
    root.querySelectorAll('[data-sev]').forEach((b) => {
      b.onclick = () => pickSection(b.dataset.sev);
    });
  });
}

function pickSection(sev) {
  const d = domain();
  const sevInfo = severityMap(d)[sev];
  const available = d.sections.filter((s) => defectsFor(d, s.id, sev).length);
  openModal(`
    <h2>Where?</h2>
    <p class="hint"><span class="sev-pill sev-${sev}">${esc(sevInfo.short)}</span>
      &nbsp;${available.length} sections carry findings at this severity.</p>
    ${available.length ? `<div class="pick-grid">
      ${available.map((s) => `<button class="pick" data-section="${s.id}">
        <strong>${esc(s.title)}</strong><small>${defectsFor(d, s.id, sev).length} to choose from</small></button>`).join('')}
    </div>` : `<p class="banner">This menu carries nothing at that severity yet. Pick another
      severity, or write your own finding and Claude will draft it.</p>`}
    <div class="row" style="margin-top:16px">
      <button class="quiet" id="backSev">Back</button>
      <button class="link" id="customHere">Write my own →</button>
    </div>`, (root) => {
    root.querySelectorAll('[data-section]').forEach((b) => {
      b.onclick = () => pickDefect(sev, b.dataset.section);
    });
    root.querySelector('#backSev').onclick = () => pickSeverity();
    root.querySelector('#customHere').onclick = () => customDefectForm(undefined, sev);
  });
}

function pickDefect(sev, sectionId) {
  const d = domain();
  const section = sectionById(d, sectionId);
  const list = defectsFor(d, sectionId, sev);
  const sevInfo = severityMap(d)[sev];

  const groups = section.items
    .map((item) => ({ item, defects: list.filter((x) => x.item === item.id) }))
    .filter((g) => g.defects.length);

  const body = (filter = '') => groups.map((g) => {
    const hits = g.defects.filter((x) => !filter
      || x.title.toLowerCase().includes(filter) || x.body.toLowerCase().includes(filter));
    if (!hits.length) return '';
    return `<div class="defect-group"><h4>${esc(g.item.name)}</h4><div class="defect-list">
      ${hits.map((x) => `<button data-defect="${esc(x.id)}">${esc(x.title)}
        <small>${esc(x.body.slice(0, 120))}…</small></button>`).join('')}
    </div></div>`;
  }).join('') || '<p class="hint">Nothing matches. Try a different word, or add your own.</p>';

  openModal(`
    <h2>${esc(section.title)}</h2>
    <p class="hint"><span class="sev-pill sev-${sev}">${esc(sevInfo.short)}</span>
      &nbsp;Pick what you saw. The paragraph and the recommendation come with it.</p>
    <input class="search" id="defectSearch" placeholder="Filter these…">
    <div id="defectBody">${body()}</div>
    <div class="row" style="margin-top:8px">
      <button class="quiet" id="backSection">Back</button>
      <button class="link" id="customFromHere">It's not in this list →</button>
    </div>`, (root) => {
    const wire = () => root.querySelectorAll('[data-defect]').forEach((b) => {
      b.onclick = () => {
        const found = defectById(d, b.dataset.defect);
        detailForm({ ...found, uid: uid(), location: '', note: '' }, false);
      };
    });
    wire();
    root.querySelector('#defectSearch').oninput = (e) => {
      root.querySelector('#defectBody').innerHTML = body(e.target.value.trim().toLowerCase());
      wire();
    };
    root.querySelector('#backSection').onclick = () => pickSection(sev);
    root.querySelector('#customFromHere').onclick = () => customDefectForm(sectionId, sev);
  });
}

function detailForm(finding, isEdit) {
  const d = domain();
  const places = d.locations(state.profile);
  const section = sectionById(d, finding.section);
  const item = itemById(d, finding.section, finding.item);

  openModal(`
    <h2>${esc(finding.title)}</h2>
    <p class="hint">${esc(section?.title)} · ${esc(item?.name)} ·
      <span class="sev-pill sev-${finding.sev}">${esc(severityMap(d)[finding.sev].short)}</span></p>
    <div class="preview">
      ${esc(finding.body)}
      <div class="rec">Recommendation: ${esc(finding.rec)}</div>
    </div>
    <div class="fields">
      <div class="field">
        <label for="loc">Location (optional, but everyone asks)</label>
        <select id="loc">
          <option value="">— no location —</option>
          ${places.map((l) => `<option ${l === finding.location ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="field" style="margin-top:14px">
      <label for="note">Your own note (optional — you don't have to write anything)</label>
      <textarea id="note" rows="3" placeholder="Anything you want to add in your own words.">${esc(finding.note || '')}</textarea>
    </div>
    <div class="row" style="margin-top:18px">
      <button class="primary" id="addIt">${isEdit ? 'Save' : 'Add to report'}</button>
      <button class="quiet" data-close>Cancel</button>
    </div>`, (root) => {
    root.querySelector('#addIt').onclick = () => {
      const entry = {
        ...finding,
        location: root.querySelector('#loc').value,
        note: root.querySelector('#note').value,
      };
      const findings = isEdit
        ? state.findings.map((f) => (f.uid === entry.uid ? entry : f))
        : [...state.findings, entry];
      closeModal();
      set({ findings, narrative: null });
    };
  });
}

/* ----------------------------------------------- custom finding, written by AI */

function customDefectForm(sectionId, sev) {
  const d = domain();
  const sections = d.sections.filter((s) => s.items.length);
  const chosen = sectionId || sections[0].id;
  const sevs = severitiesFor(d);

  const itemOptions = (sid) => sectionById(d, sid).items
    .map((i) => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('');

  openModal(`
    <h2>Your own finding</h2>
    <p class="hint">Describe what you saw in a line. Claude Sonnet writes the report paragraph and
      the recommendation in the same voice as the rest of this ${esc(d.name.toLowerCase())} report.</p>
    <div class="fields">
      <div class="field"><label for="cSection">Section</label>
        <select id="cSection">${sections.map((s) => `<option value="${esc(s.id)}" ${s.id === chosen ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}</select></div>
      <div class="field"><label for="cItem">Item</label><select id="cItem">${itemOptions(chosen)}</select></div>
      <div class="field"><label for="cSev">Severity</label>
        <select id="cSev">${sevs.map((s) => `<option value="${s.id}" ${s.id === sev ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></div>
      <div class="field"><label for="cLoc">Location</label>
        <select id="cLoc"><option value="">— no location —</option>
          ${d.locations(state.profile).map((l) => `<option>${esc(l)}</option>`).join('')}</select></div>
    </div>
    <div class="field" style="margin-top:14px">
      <label for="cTitle">Short title</label>
      <input type="text" id="cTitle" placeholder="Short name for what you found">
    </div>
    <div class="field" style="margin-top:14px">
      <label for="cWhat">What did you see?</label>
      <textarea id="cWhat" rows="3" placeholder="One or two sentences in your own words."></textarea>
    </div>
    <div id="cOut"></div>
    <div class="row" style="margin-top:18px">
      <button class="primary" id="cWrite">Have Claude write it up</button>
      <button class="quiet" data-close>Cancel</button>
    </div>`, (root) => {
    const sectionSel = root.querySelector('#cSection');
    sectionSel.onchange = () => { root.querySelector('#cItem').innerHTML = itemOptions(sectionSel.value); };

    root.querySelector('#cWrite').onclick = async () => {
      const title = root.querySelector('#cTitle').value.trim();
      const what = root.querySelector('#cWhat').value.trim();
      const out = root.querySelector('#cOut');
      if (!title || !what) { out.innerHTML = '<p class="banner">Give it a title and a sentence about what you saw.</p>'; return; }

      const btn = root.querySelector('#cWrite');
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Writing…';
      const chosenSev = root.querySelector('#cSev').value;
      const payload = {
        domain: d.id,
        domainName: d.name,
        section: sectionById(d, sectionSel.value).title,
        item: itemById(d, sectionSel.value, root.querySelector('#cItem').value)?.name,
        severity: severityMap(d)[chosenSev].label,
        title,
        observation: what,
        subject: d.subjectLine(state.profile),
        subjectDetail: d.subjectSub ? d.subjectSub(state.profile) : '',
      };

      const written = await writeCustomDefect(payload);
      btn.disabled = false;
      btn.textContent = 'Rewrite it';

      const finding = {
        uid: uid(),
        section: sectionSel.value,
        item: root.querySelector('#cItem').value,
        sev: chosenSev,
        title: title.toUpperCase(),
        body: written.body,
        rec: written.rec,
        location: root.querySelector('#cLoc').value,
        note: '',
        custom: true,
      };

      out.innerHTML = `
        ${written.offline ? '<p class="banner">No API key configured on the server, so this was written from the local template. Set ANTHROPIC_API_KEY to have Claude write it.</p>' : ''}
        <div class="preview">${esc(finding.body)}<div class="rec">Recommendation: ${esc(finding.rec)}</div></div>
        <button class="primary" id="cAdd">Add to report</button>`;
      out.querySelector('#cAdd').onclick = () => {
        closeModal();
        set({ findings: [...state.findings, finding], narrative: null });
      };
    };
  });
}

async function writeCustomDefect(payload) {
  try {
    const res = await fetch('/api/inspection/defect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    if (!data.body) throw new Error('empty');
    return { body: data.body, rec: data.rec || 'Further evaluation is recommended.' };
  } catch {
    return {
      offline: true,
      body: `${payload.observation.replace(/\s*$/, '').replace(/\.?$/, '.')} `
        + 'This condition was observed at the referenced area at the time of inspection. Further '
        + 'evaluation with correction as deemed necessary is recommended by a qualified professional.',
      rec: 'Further evaluation by a qualified professional is recommended.',
    };
  }
}

/* ------------------------------------------------------------- generation */

async function generate() {
  const d = domain();
  crumb.textContent = 'Generating…';
  app.innerHTML = `<div class="card"><h2><span class="spinner" style="border-color:#14607a33;border-top-color:#14607a"></span>
    Assembling the report…</h2>
    <p class="hint">Numbering the findings, filling every section’s Information block and standing
      narrative, and asking Claude Sonnet to summarize the inspection.</p></div>`;

  const report = buildReport(d, state);
  let narrative = null;
  try {
    const res = await fetch('/api/inspection/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        domain: d.id,
        domainName: d.name,
        docTitle: d.docTitle,
        subject: report.meta.subject,
        subjectDetail: report.meta.subjectSub,
        counts: report.counts,
        findings: report.summary.map((f) => ({
          ref: f.ref, severity: f.severity.short, section: f.sectionTitle,
          item: f.itemName, title: f.title, location: f.location || '', note: f.note || '',
        })),
      }),
    });
    if (res.ok) narrative = await res.json();
  } catch { /* fall through to the local summary */ }

  set({ screen: 'report', narrative: narrative && narrative.overview ? narrative : localNarrative(d, report) });
}

function localNarrative(d, report) {
  const c = report.counts;
  const s = report.severities;
  const worst = report.summary.filter((f) => f.sev === 'significant').slice(0, 3);
  const marg = report.summary.filter((f) => f.sev === 'marginal').slice(0, 3);
  return {
    offline: true,
    overview: `This inspection of ${report.meta.subject} produced ${report.total} findings: `
      + `${c.significant} ${s.significant.short.toLowerCase()}, ${c.marginal} `
      + `${s.marginal.short.toLowerCase()}, and ${c.minor} ${s.minor.short.toLowerCase()}. `
      + (c.significant
        ? `The ${s.significant.short.toLowerCase()} items should be resolved first; they carry either `
          + 'a safety concern or a material cost.'
        : `Nothing was identified at the ${s.significant.short.toLowerCase()} level, though several `
          + 'items warrant attention.')
      + ' The full detail for every item, including the recommendation, is in the section it belongs to.',
    priorities: [...worst, ...marg].slice(0, 5)
      .map((f) => `${f.ref} — ${f.title} (${f.sectionTitle}${f.location ? `, ${f.location}` : ''})`),
    closing: 'Every item designated for repair, correction, or further evaluation should be reviewed '
      + 'by the applicable trade or specialist.',
  };
}

/* ----------------------------------------------------------------- report */

function renderReport() {
  const d = domain();
  const report = buildReport(d, state);
  const score = scoreReport(d, report);
  crumb.textContent = `${d.icon} Report`;

  app.innerHTML = `
    <div class="card no-print">
      <div class="scorecard">
        <div class="grade">${esc(score.grade)}</div>
        <div class="grow">
          <h2 style="margin-bottom:4px">Inspection score: ${score.score}/100</h2>
          <p class="hint" style="margin:0">${score.covered} of ${score.sections} sections carry a finding ·
            ${score.located}/${report.total} located · ${score.withNotes} with your own note</p>
          <ul>${score.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>
        </div>
      </div>
      <div class="row" style="margin-top:18px">
        <button class="quiet" id="backWalk">Back to the walkthrough</button>
        <button class="quiet" id="copyBtn">Copy as text</button>
        <button class="quiet" id="dlBtn">Download .txt</button>
        <button class="quiet" id="jsonBtn">Download .json</button>
        <button class="primary" id="printBtn">Print / Save as PDF</button>
      </div>
      ${state.narrative?.offline ? '<p class="banner" style="margin-top:14px">The summary below was written locally — the server has no ANTHROPIC_API_KEY set, so Claude did not write it.</p>' : ''}
    </div>
    <div class="doc" id="doc">${docHtml(report)}</div>`;

  app.querySelector('#backWalk').onclick = () => set({ screen: 'walk' });
  app.querySelector('#printBtn').onclick = () => window.print();
  app.querySelector('#copyBtn').onclick = async (e) => {
    await navigator.clipboard.writeText(reportToText(report));
    e.target.textContent = 'Copied';
    setTimeout(() => { e.target.textContent = 'Copy as text'; }, 1500);
  };
  app.querySelector('#dlBtn').onclick = () => download(
    `${slug(report.meta.subject)}-inspection.txt`, reportToText(report), 'text/plain');
  app.querySelector('#jsonBtn').onclick = () => download(
    `${slug(report.meta.subject)}-inspection.json`, JSON.stringify({ ...report, score }, null, 2), 'application/json');
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function docHtml(report) {
  const n = report.narrative;
  const m = report.meta;
  const s = report.severities;
  return `
  <div class="cover">
    <h1>${esc(m.docTitle)}</h1>
    <p><strong>${esc(m.subject)}</strong></p>
    ${m.subjectSub ? `<p>${esc(m.subjectSub)}</p>` : ''}
    <p>${esc(m.clientLabel)}: ${esc(m.client)}</p>
    <p>${esc(m.company)} · ${esc(m.inspector)} · ${esc(m.date)}</p>
  </div>

  <h2>Table of Contents</h2>
  <div class="toc">${report.sections.map((sec) => `<div>${sec.num}: ${esc(sec.title)}${sec.findings.length ? ` (${sec.findings.length})` : ''}</div>`).join('')}</div>

  ${n ? `<h2>Overview</h2><div class="narr"><p>${esc(n.overview)}</p>
    ${n.priorities?.length ? `<h4>What to address first</h4><ol>${n.priorities.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
    ${n.closing ? `<p>${esc(n.closing)}</p>` : ''}</div>` : ''}

  <h2>Summary</h2>
  <p class="narr">${report.total} findings — ${report.counts.significant} ${esc(s.significant.short.toLowerCase())},
    ${report.counts.marginal} ${esc(s.marginal.short.toLowerCase())}, ${report.counts.minor} ${esc(s.minor.short.toLowerCase())}.
    ${report.cost ? `Planning budget range: <strong>${esc(report.cost.label)}</strong>. ${esc(report.cost.note)}` : ''}</p>
  ${report.summary.map((f) => `<div class="sum-line">
      <span class="sev-pill sev-${f.sev}">${esc(f.severity.short)}</span>
      <strong>${f.ref}</strong> ${esc(f.sectionTitle)} - ${esc(f.itemName)}: ${esc(f.title)}
      ${f.location ? `<em>— ${esc(f.location)}</em>` : ''}</div>`).join('')}

  ${report.sections.map((sec) => `
    <h2>${sec.num}: ${esc(sec.title)}</h2>
    ${sec.info.length ? `<h3>Information</h3><table><tbody>
      ${sec.info.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
    </tbody></table>` : ''}
    ${sec.narrative.length ? `<div class="narr">${sec.narrative.map((b) => `<h4>${esc(b.title)}</h4><p>${esc(b.text)}</p>`).join('')}</div>` : ''}
    ${sec.findings.length ? `<h3>Findings</h3>${sec.findings.map((f) => `
      <div class="rec-block ${f.sev}">
        <div class="ref">${f.ref} · ${esc(f.itemName)} · <span class="sev-pill sev-${f.sev}">${esc(f.severity.short)}</span></div>
        <div class="title">${esc(f.title)}${f.location ? ` — ${esc(f.location)}` : ''}</div>
        <p>${esc(f.body)}</p>
        ${f.note ? `<p><em>Inspector's note: ${esc(f.note)}</em></p>` : ''}
        <div class="rec">Recommendation: ${esc(f.rec)}</div>
      </div>`).join('')}` : ''}
  `).join('')}

  <h2>${esc(report.standardsTitle)}</h2>
  <div class="narr"><p>${esc(report.standards)}</p></div>`;
}

/* ------------------------------------------------------------------- menu */

document.getElementById('menuBtn').onclick = () => {
  const d = domain();
  openModal(`
    <h2>Menu</h2>
    <p class="hint">Inspecting: <strong>${d.icon} ${esc(d.name)}</strong></p>
    <div class="pick-grid">
      <button class="pick" data-go="start"><strong>Start screen</strong><small>Change what you are inspecting.</small></button>
      <button class="pick" data-go="intake"><strong>Intake</strong><small>Change the answers.</small></button>
      <button class="pick" data-go="walk"><strong>Walkthrough</strong><small>Add or edit findings.</small></button>
      <button class="pick" data-go="report"><strong>Report</strong><small>The assembled document.</small></button>
    </div>
    <p class="hint" style="margin:18px 0 8px">Layout: <strong>${state.device === 'mobile' ? 'phone' : 'computer'}</strong></p>
    <div class="row">
      <button class="quiet" id="switchDevice">Switch to the ${state.device === 'mobile' ? 'computer' : 'phone'} layout</button>
    </div>
    <div class="row" style="margin-top:18px">
      <button class="quiet" id="exportSave">Export save file</button>
      <button class="quiet" id="importSave">Import save file</button>
      <button class="danger" id="wipe">Wipe everything</button>
    </div>`, (root) => {
    root.querySelectorAll('[data-go]').forEach((b) => {
      b.onclick = () => { closeModal(); set({ screen: b.dataset.go }); };
    });
    root.querySelector('#switchDevice').onclick = () => {
      closeModal();
      set({ device: state.device === 'mobile' ? 'desktop' : 'mobile' });
    };
    root.querySelector('#exportSave').onclick = () => download(
      `${slug(d.subjectLine(state.profile) || 'inspection')}-save.json`, JSON.stringify(state, null, 2), 'application/json');
    root.querySelector('#importSave').onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = async () => {
        try {
          const parsed = JSON.parse(await input.files[0].text());
          if (!parsed.profile || !DOMAIN_BY_ID[parsed.domainId || DEFAULT_DOMAIN]) throw new Error('not a save file');
          state = { ...freshState(parsed.domainId || DEFAULT_DOMAIN), screen: 'walk', ...parsed };
          closeModal();
          save();
          render();
        } catch { alert("That file isn't an inspection save."); }
      };
      input.click();
    };
    root.querySelector('#wipe').onclick = () => {
      if (!confirm('Delete the saved inspection from this browser?')) return;
      localStorage.removeItem(SAVE_KEY);
      state = freshState(state.domainId, { device: state.device });
      closeModal();
      render();
    };
  });
};

render();
