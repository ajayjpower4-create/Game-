/* Inspection Simulator — screen flow, defect picker, report rendering. */

import { INTAKE, SECTIONS, SECTION_BY_ID, SEVERITIES, SEVERITY_BY_ID } from './data.js';
import { DEFECTS, defectsFor } from './defects.js';
import { buildReport, reportToText, scoreReport, locationsFor, propertyLine } from './report.js';

const SAVE_KEY = 'inspection-sim-v1';
const app = document.getElementById('app');
const crumb = document.getElementById('crumb');
const autosaveEl = document.getElementById('autosave');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10);

/* -------------------------------------------------------------- game state */

function blankProfile() {
  const p = {};
  INTAKE.forEach((group) => group.fields.forEach((f) => {
    if (f.type === 'choice') p[f.id] = f.options[0];
    else if (f.type === 'counter') p[f.id] = f.value;
    else p[f.id] = '';
  }));
  p.date = new Date().toISOString().slice(0, 10);
  return p;
}

let state = load() || {
  screen: 'start', intakeStep: 0, device: null, profile: blankProfile(), findings: [], narrative: null,
};

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
  if (state.screen === 'start') renderStart();
  else if (state.screen === 'intake') renderIntake();
  else if (state.screen === 'walk') renderWalk();
  else if (state.screen === 'report') renderReport();
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function renderStart() {
  crumb.textContent = 'Field report generator';
  const hasSave = state.findings.length > 0 || state.profile.address;
  const guess = detectDevice();
  const picked = state.device;

  app.innerHTML = `
    <div class="card">
      <h2>Where are you working?</h2>
      <p class="hint">This changes the layout, not the report. You can switch any time from the Menu.</p>
      <div class="pick-grid two">
        <button class="pick device ${picked === 'mobile' ? 'on' : ''}" data-device="mobile">
          <strong>📱 On my phone</strong>
          <small>One column, big tap targets, full-screen menus and a floating Add&nbsp;defect button —
            for tapping findings in while you are still standing in the crawl space.</small>
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
      <h2>Write a 60-page inspection report without writing 60 pages.</h2>
      <p class="hint">You type the address, the client and the year built. Everything else is a click.</p>
      <ol class="how">
        <li><strong>Intake.</strong> Address, house type, floors, basement, bedrooms, living rooms, systems.
            The answers fill the Information block of all sixteen sections.</li>
        <li><strong>Walkthrough.</strong> Add Defect → pick the severity → pick the section → pick the defect.
            The write-up and the contractor recommendation come with it. Attach a location, add your own
            note if you want to. You don't have to.</li>
        <li><strong>Something not on the menu?</strong> Describe it in a line and Claude Sonnet writes the
            defect paragraph and the recommendation in the same voice as the rest.</li>
        <li><strong>Generate.</strong> Claude summarizes the whole inspection, the report assembles itself,
            and you get scored on how thorough you were.</li>
      </ol>
      ${picked ? `
      <div class="row actions" style="margin-top:20px">
        <button class="primary" id="startBtn">${hasSave ? 'Resume inspection' : 'Start an inspection'}</button>
        ${hasSave ? '<button class="quiet" id="freshBtn">Start over</button>' : ''}
        <button class="quiet" id="demoBtn">Load the sample property</button>
      </div>` : '<p class="banner" style="margin-top:20px">Pick phone or computer above to start.</p>'}
      <p class="ai-note">${DEFECTS.length} defects in the menu across ${SECTIONS.length} report sections.
        Everything autosaves to this browser.</p>
    </div>`;

  app.querySelectorAll('[data-device]').forEach((b) => {
    b.onclick = () => set({ device: b.dataset.device });
  });
  if (!picked) return;

  app.querySelector('#startBtn').onclick = () => set({ screen: 'intake' });
  const fresh = app.querySelector('#freshBtn');
  if (fresh) {
    fresh.onclick = () => {
      if (confirm('Wipe the current inspection and start clean?')) {
        state = { ...state, screen: 'intake', intakeStep: 0, profile: blankProfile(), findings: [], narrative: null };
        save();
        render();
      }
    };
  }
  app.querySelector('#demoBtn').onclick = () => {
    state = {
      ...state, screen: 'intake', intakeStep: 0,
      profile: { ...blankProfile(), ...SAMPLE }, findings: [], narrative: null,
    };
    save();
    render();
  };
}

const SAMPLE = {
  address: '8329 Newtown Rd', city: 'Pikesville', state: 'MD', zip: '21208',
  client: 'Liam Powell', inspector: 'A. Inspector', company: 'Chesapeake Inspection Associates',
  yearBuilt: '1966', houseType: 'Single Family, Detached', floors: '2',
  foundation: 'Partially Finished Basement', bedrooms: 3, fullBaths: 2, halfBaths: 1,
  cladding: 'Fiber Cement', roofCovering: '3-Tab Composition Shingles', roofMethod: 'Aerial Drone',
  heating: 'Gas Forced Air Furnace', hvacYear: '1997', waterHeater: 'Gas', whYear: '1992',
  whCapacity: '50 Gallons', service: '100amps 120/240VAC', waterPipes: 'Copper',
  dwv: 'Cast Iron and PVC', occupancy: 'Vacant', weather: 'Overcast, Dry',
};

/* --------------------------------------------------------------- intake */

function renderIntake() {
  const step = state.intakeStep;
  const group = INTAKE[step];
  crumb.textContent = `Intake — ${group.title}`;

  app.innerHTML = `
    <div class="steps">
      ${INTAKE.map((g, i) => `<span class="${i === step ? 'on' : i < step ? 'done' : ''}">${i + 1}. ${esc(g.title)}</span>`).join('')}
    </div>
    <div class="card">
      <h2>${esc(group.title)}</h2>
      <p class="hint">${esc(group.hint)}</p>
      <div class="fields">${group.fields.map(fieldHtml).join('')}</div>
    </div>
    <div class="row">
      <button class="quiet" id="backBtn">${step === 0 ? 'Back to start' : 'Back'}</button>
      <button class="primary" id="nextBtn">${step === INTAKE.length - 1 ? 'Start the walkthrough' : 'Next'}</button>
      <span class="hint" id="err" style="margin:0;color:var(--sig)"></span>
    </div>`;

  wireFields(app, group.fields);

  app.querySelector('#backBtn').onclick = () => (
    step === 0 ? set({ screen: 'start' }) : set({ intakeStep: step - 1 }));

  app.querySelector('#nextBtn').onclick = () => {
    const missing = group.fields.filter((f) => f.required && !String(state.profile[f.id] || '').trim());
    if (missing.length) {
      app.querySelector('#err').textContent = `Still needs: ${missing.map((f) => f.label).join(', ')}`;
      return;
    }
    if (step === INTAKE.length - 1) set({ screen: 'walk' });
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

function wireFields(root, fields) {
  root.querySelectorAll('[data-input]').forEach((input) => {
    input.oninput = () => { state.profile[input.dataset.input] = input.value; save(); };
  });
  root.querySelectorAll('[data-chipset]').forEach((set_) => {
    set_.querySelectorAll('.chip').forEach((chip) => {
      chip.onclick = () => {
        state.profile[set_.dataset.chipset] = chip.dataset.value;
        set_.querySelectorAll('.chip').forEach((c) => c.classList.remove('on'));
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
  crumb.textContent = propertyLine(state.profile) || 'Walkthrough';
  const counts = {
    significant: state.findings.filter((f) => f.sev === 'significant').length,
    marginal: state.findings.filter((f) => f.sev === 'marginal').length,
    minor: state.findings.filter((f) => f.sev === 'minor').length,
  };
  const hit = new Set(state.findings.map((f) => f.section));
  const listed = SECTIONS.filter((s) => s.items.length);

  app.innerHTML = `
    <div class="card">
      <div class="spread">
        <div>
          <h2 style="margin-bottom:2px">${esc(propertyLine(state.profile))}</h2>
          <p class="hint" style="margin:0">${esc(state.profile.houseType)} · built ${esc(state.profile.yearBuilt)} ·
            ${esc(state.profile.bedrooms)} bed / ${esc(state.profile.fullBaths)} bath · ${esc(state.profile.foundation)}</p>
        </div>
        <button class="quiet" id="editIntake">Edit intake</button>
      </div>
      <div class="tally" style="margin-top:16px">
        <div><strong>${state.findings.length}</strong><span>Findings</span></div>
        <div><strong style="color:var(--sig)">${counts.significant}</strong><span>Significant</span></div>
        <div><strong style="color:var(--marg)">${counts.marginal}</strong><span>Marginal</span></div>
        <div><strong style="color:var(--minor)">${counts.minor}</strong><span>Minor / FYI</span></div>
      </div>
      <div class="section-progress">
        ${listed.map((s) => `<span class="${hit.has(s.id) ? 'hit' : ''}">${esc(s.title)}${hit.has(s.id) ? ` ${state.findings.filter((f) => f.section === s.id).length}` : ''}</span>`).join('')}
      </div>
    </div>

    <div class="card">
      <div class="spread" style="margin-bottom:14px">
        <h2 style="margin:0">Defects</h2>
        <div class="row">
          <button class="primary" id="addDefect">+ Add defect</button>
          <button class="quiet" id="addCustom">Not on the menu…</button>
        </div>
      </div>
      <div id="findingList">${state.findings.length ? state.findings.map(findingHtml).join('') : '<p class="hint">Nothing added yet. Every defect you add carries its own write-up and contractor recommendation — you never have to type the paragraph.</p>'}</div>
    </div>

    <button class="fab" id="addDefectFab" aria-label="Add defect">+ Add defect</button>

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
  const sev = SEVERITY_BY_ID[f.sev];
  const section = SECTION_BY_ID[f.section];
  const item = section?.items.find((i) => i.id === f.item);
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
  openModal(`
    <h2>How bad is it?</h2>
    <p class="hint">The severity decides which defects you see next.</p>
    <div class="pick-grid">
      ${SEVERITIES.map((s) => `<button class="pick sev ${s.id}" data-sev="${s.id}">
        <strong>${esc(s.label)}</strong><small>${esc(s.blurb)}</small></button>`).join('')}
    </div>`, (root) => {
    root.querySelectorAll('[data-sev]').forEach((b) => {
      b.onclick = () => pickSection(b.dataset.sev);
    });
  });
}

function pickSection(sev) {
  const available = SECTIONS.filter((s) => defectsFor(s.id, sev).length);
  openModal(`
    <h2>Where?</h2>
    <p class="hint"><span class="sev-pill sev-${sev}">${esc(SEVERITY_BY_ID[sev].short)}</span>
      &nbsp;${available.length} sections carry defects at this severity.</p>
    <div class="pick-grid">
      ${available.map((s) => `<button class="pick" data-section="${s.id}">
        <strong>${esc(s.title)}</strong><small>${defectsFor(s.id, sev).length} defects</small></button>`).join('')}
    </div>
    <div class="row" style="margin-top:16px"><button class="quiet" id="backSev">Back</button></div>`, (root) => {
    root.querySelectorAll('[data-section]').forEach((b) => {
      b.onclick = () => pickDefect(sev, b.dataset.section);
    });
    root.querySelector('#backSev').onclick = () => pickSeverity();
  });
}

function pickDefect(sev, sectionId) {
  const section = SECTION_BY_ID[sectionId];
  const list = defectsFor(sectionId, sev);

  const groups = section.items
    .map((item) => ({ item, defects: list.filter((d) => d.item === item.id) }))
    .filter((g) => g.defects.length);

  const body = (filter = '') => groups.map((g) => {
    const hits = g.defects.filter((d) => !filter
      || d.title.toLowerCase().includes(filter) || d.body.toLowerCase().includes(filter));
    if (!hits.length) return '';
    return `<div class="defect-group"><h4>${esc(g.item.name)}</h4><div class="defect-list">
      ${hits.map((d) => `<button data-defect="${esc(d.id)}">${esc(d.title)}
        <small>${esc(d.body.slice(0, 120))}…</small></button>`).join('')}
    </div></div>`;
  }).join('') || '<p class="hint">Nothing matches. Try a different word, or add your own defect.</p>';

  openModal(`
    <h2>${esc(section.title)}</h2>
    <p class="hint"><span class="sev-pill sev-${sev}">${esc(SEVERITY_BY_ID[sev].short)}</span>
      &nbsp;Pick what you saw. The paragraph and the recommendation come with it.</p>
    <input class="search" id="defectSearch" placeholder="Filter these defects…">
    <div id="defectBody">${body()}</div>
    <div class="row" style="margin-top:8px">
      <button class="quiet" id="backSection">Back</button>
      <button class="link" id="customFromHere">It's not in this list →</button>
    </div>`, (root) => {
    const wire = () => root.querySelectorAll('[data-defect]').forEach((b) => {
      b.onclick = () => {
        const d = DEFECTS.find((x) => x.id === b.dataset.defect);
        detailForm({ ...d, uid: uid(), location: '', note: '' }, false);
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
  const locations = locationsFor(state.profile);
  const section = SECTION_BY_ID[finding.section];
  const item = section?.items.find((i) => i.id === finding.item);

  openModal(`
    <h2>${esc(finding.title)}</h2>
    <p class="hint">${esc(section?.title)} · ${esc(item?.name)} ·
      <span class="sev-pill sev-${finding.sev}">${esc(SEVERITY_BY_ID[finding.sev].short)}</span></p>
    <div class="preview">
      ${esc(finding.body)}
      <div class="rec">Recommendation: ${esc(finding.rec)}</div>
    </div>
    <div class="fields">
      <div class="field">
        <label for="loc">Location (optional, but clients ask)</label>
        <select id="loc">
          <option value="">— no location —</option>
          ${locations.map((l) => `<option ${l === finding.location ? 'selected' : ''}>${esc(l)}</option>`).join('')}
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

/* ----------------------------------------------- custom defect, written by AI */

function customDefectForm(sectionId, sev) {
  const sections = SECTIONS.filter((s) => s.items.length);
  const chosen = sectionId || sections[0].id;

  const itemOptions = (sid) => SECTION_BY_ID[sid].items
    .map((i) => `<option value="${esc(i.id)}">${esc(i.name)}</option>`).join('');

  openModal(`
    <h2>Your own defect</h2>
    <p class="hint">Describe what you saw in a line. Claude Sonnet writes the report paragraph and the
      contractor recommendation in the same voice as the rest of the document.</p>
    <div class="fields">
      <div class="field"><label for="cSection">Section</label>
        <select id="cSection">${sections.map((s) => `<option value="${esc(s.id)}" ${s.id === chosen ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}</select></div>
      <div class="field"><label for="cItem">Item</label><select id="cItem">${itemOptions(chosen)}</select></div>
      <div class="field"><label for="cSev">Severity</label>
        <select id="cSev">${SEVERITIES.map((s) => `<option value="${s.id}" ${s.id === sev ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select></div>
      <div class="field"><label for="cLoc">Location</label>
        <select id="cLoc"><option value="">— no location —</option>
          ${locationsFor(state.profile).map((l) => `<option>${esc(l)}</option>`).join('')}</select></div>
    </div>
    <div class="field" style="margin-top:14px">
      <label for="cTitle">Short title</label>
      <input type="text" id="cTitle" placeholder="Sump discharge line frozen shut">
    </div>
    <div class="field" style="margin-top:14px">
      <label for="cWhat">What did you see?</label>
      <textarea id="cWhat" rows="3" placeholder="The discharge line ran uphill and had no air gap, ice at the termination."></textarea>
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
      const payload = {
        section: SECTION_BY_ID[sectionSel.value].title,
        item: SECTION_BY_ID[sectionSel.value].items.find((i) => i.id === root.querySelector('#cItem').value)?.name,
        severity: SEVERITY_BY_ID[root.querySelector('#cSev').value].label,
        title, observation: what,
        property: { yearBuilt: state.profile.yearBuilt, type: state.profile.houseType },
      };

      const written = await writeCustomDefect(payload);
      btn.disabled = false;
      btn.textContent = 'Rewrite it';

      const finding = {
        uid: uid(),
        section: sectionSel.value,
        item: root.querySelector('#cItem').value,
        sev: root.querySelector('#cSev').value,
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
    return { body: data.body, rec: data.rec || 'Contact a qualified professional.' };
  } catch {
    return {
      offline: true,
      body: `${payload.observation.replace(/\s*$/, '').replace(/\.?$/, '.')} `
        + 'This condition was observed at the referenced area at the time of inspection. Further '
        + 'evaluation with repairs as deemed necessary is recommended by a qualified professional '
        + 'prior to the end of the inspection contingency period.',
      rec: 'Contact a qualified professional.',
    };
  }
}

/* ------------------------------------------------------------- generation */

async function generate() {
  crumb.textContent = 'Generating…';
  app.innerHTML = `<div class="card"><h2><span class="spinner" style="border-color:#14607a33;border-top-color:#14607a"></span>
    Assembling the report…</h2>
    <p class="hint">Numbering the findings, filling every section’s Information block and standing narrative,
      and asking Claude Sonnet to summarize the inspection.</p></div>`;

  const report = buildReport(state);
  let narrative = null;
  try {
    const res = await fetch('/api/inspection/summarize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        property: report.meta,
        profile: {
          type: state.profile.houseType, foundation: state.profile.foundation,
          bedrooms: state.profile.bedrooms, cladding: state.profile.cladding,
          roof: state.profile.roofCovering, heating: state.profile.heating,
          waterHeater: `${state.profile.waterHeater} (${state.profile.whYear})`,
          service: state.profile.service, waterPipes: state.profile.waterPipes, dwv: state.profile.dwv,
        },
        counts: report.counts,
        findings: report.summary.map((f) => ({
          ref: f.ref, severity: f.severity.short, section: f.sectionTitle,
          item: f.itemName, title: f.title, location: f.location || '', note: f.note || '',
        })),
      }),
    });
    if (res.ok) narrative = await res.json();
  } catch { /* fall through to the local summary */ }

  set({ screen: 'report', narrative: narrative && narrative.overview ? narrative : localNarrative(report) });
}

function localNarrative(report) {
  const c = report.counts;
  const worst = report.summary.filter((f) => f.sev === 'significant').slice(0, 3);
  const marg = report.summary.filter((f) => f.sev === 'marginal').slice(0, 3);
  return {
    offline: true,
    overview: `This inspection of ${report.meta.address} produced ${report.total} findings: `
      + `${c.significant} significant, ${c.marginal} marginal, and ${c.minor} minor or informational. `
      + (c.significant
        ? 'The significant items should be evaluated and quoted before the end of the contingency period, '
          + 'as they carry either a safety concern or a material cost.'
        : 'No significant defects were identified, though several marginal items warrant repair.')
      + ' The full detail for every item, including the recommendation, is in the section it belongs to.',
    priorities: [...worst, ...marg].slice(0, 5)
      .map((f) => `${f.ref} — ${f.title} (${f.sectionTitle}${f.location ? `, ${f.location}` : ''})`),
    closing: 'Every item designated for repair, replacement, or further evaluation should be reviewed by '
      + 'the applicable trade before the end of the inspection contingency period.',
  };
}

/* ----------------------------------------------------------------- report */

function renderReport() {
  const report = buildReport(state);
  const score = scoreReport(report);
  crumb.textContent = 'Report';

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
    `${slug(report.meta.address)}-inspection.txt`, reportToText(report), 'text/plain');
  app.querySelector('#jsonBtn').onclick = () => download(
    `${slug(report.meta.address)}-inspection.json`, JSON.stringify({ ...report, score }, null, 2), 'application/json');
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
  return `
  <div class="cover">
    <h1>Home Inspection Report</h1>
    <p><strong>${esc(report.meta.address)}</strong></p>
    <p>Prepared for ${esc(report.meta.client)}</p>
    <p>${esc(report.meta.company)} · ${esc(report.meta.inspector)} · ${esc(report.meta.date)}</p>
  </div>

  <h2>Table of Contents</h2>
  <div class="toc">${report.sections.map((s) => `<div>${s.num}: ${esc(s.title)}${s.findings.length ? ` (${s.findings.length})` : ''}</div>`).join('')}</div>

  ${n ? `<h2>Overview</h2><div class="narr"><p>${esc(n.overview)}</p>
    ${n.priorities?.length ? `<h4>What to address first</h4><ol>${n.priorities.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
    ${n.closing ? `<p>${esc(n.closing)}</p>` : ''}</div>` : ''}

  <h2>Summary</h2>
  <p class="narr">${report.total} findings — ${report.counts.significant} significant,
    ${report.counts.marginal} marginal, ${report.counts.minor} minor / FYI.
    Planning budget range: <strong>${esc(report.cost.label)}</strong>. This range is a rough planning aid only;
    quotes from the recommended tradespeople govern.</p>
  ${report.summary.map((f) => `<div class="sum-line">
      <span class="sev-pill sev-${f.sev}">${esc(f.severity.short)}</span>
      <strong>${f.ref}</strong> ${esc(f.sectionTitle)} - ${esc(f.itemName)}: ${esc(f.title)}
      ${f.location ? `<em>— ${esc(f.location)}</em>` : ''}</div>`).join('')}

  ${report.sections.map((s) => `
    <h2>${s.num}: ${esc(s.title)}</h2>
    ${s.info.length ? `<h3>Information</h3><table><tbody>
      ${s.info.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join('')}
    </tbody></table>` : ''}
    ${s.narrative.length ? `<div class="narr">${s.narrative.map((b) => `<h4>${esc(b.title)}</h4><p>${esc(b.text)}</p>`).join('')}</div>` : ''}
    ${s.findings.length ? `<h3>Recommendations</h3>${s.findings.map((f) => `
      <div class="rec-block ${f.sev}">
        <div class="ref">${f.ref} · ${esc(f.itemName)} · <span class="sev-pill sev-${f.sev}">${esc(f.severity.short)}</span></div>
        <div class="title">${esc(f.title)}${f.location ? ` — ${esc(f.location)}` : ''}</div>
        <p>${esc(f.body)}</p>
        ${f.note ? `<p><em>Inspector's note: ${esc(f.note)}</em></p>` : ''}
        <div class="rec">Recommendation: ${esc(f.rec)}</div>
      </div>`).join('')}` : ''}
  `).join('')}

  <h2>Standards of Practice</h2>
  <div class="narr"><p>This inspection was performed in substantial compliance with the
    ${esc(report.profile.standards)} Standards of Practice. It is a visual, non-invasive examination of the
    readily accessible installed systems and components of the home, and it is neither technically
    exhaustive nor quantitative. This report is not a warranty or guarantee of any kind, and it is provided
    for the exclusive use of the client named above.</p></div>`;
}

/* ------------------------------------------------------------------- menu */

document.getElementById('menuBtn').onclick = () => {
  openModal(`
    <h2>Menu</h2>
    <div class="pick-grid">
      <button class="pick" data-go="start"><strong>Start screen</strong><small>How the simulator works.</small></button>
      <button class="pick" data-go="intake"><strong>Intake</strong><small>Change the property answers.</small></button>
      <button class="pick" data-go="walk"><strong>Walkthrough</strong><small>Add or edit defects.</small></button>
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
      `${slug(state.profile.address || 'inspection')}-save.json`, JSON.stringify(state, null, 2), 'application/json');
    root.querySelector('#importSave').onclick = () => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'application/json';
      input.onchange = async () => {
        try {
          const parsed = JSON.parse(await input.files[0].text());
          if (!parsed.profile) throw new Error('not a save file');
          state = { screen: 'walk', intakeStep: 0, narrative: null, findings: [], ...parsed };
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
      state = {
        screen: 'start', intakeStep: 0, device: state.device,
        profile: blankProfile(), findings: [], narrative: null,
      };
      closeModal();
      render();
    };
  });
};

render();
