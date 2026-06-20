// ---- State ----
const STEPS = ['intro', 'job', 'car', 'subs', 'home', 'extra', 'results'];
let stepIndex = 0;

const budget = {
  job: { title: '', employer: '', rank: '', hourlyWage: 0, hoursPerWeek: 0 },
  car: { hasCar: null, type: '', carNote: 0 },
  subscriptions: [],
  home: { rent: 0, utilities: 0 },
  extra: { groceries: 0, carGas: 0, custom: [] },
  totals: {},
};

// ---- Elements ----
const steps = Array.from(document.querySelectorAll('.step'));
const progressBar = document.getElementById('progressBar');
const screen = document.getElementById('screen');

// ---- Navigation ----
function showStep(i) {
  stepIndex = Math.max(0, Math.min(STEPS.length - 1, i));
  steps.forEach(s => s.classList.toggle('active', s.dataset.step === STEPS[stepIndex]));
  const pct = (stepIndex / (STEPS.length - 1)) * 100;
  progressBar.style.width = `${pct}%`;
  screen.scrollTop = 0;
  window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const action = e.target.closest('[data-action]')?.dataset.action;
  if (action === 'next') goNext();
  if (action === 'back') showStep(stepIndex - 1);
});

function goNext() {
  // Capture data for the current step before advancing
  captureCurrentStep();
  if (STEPS[stepIndex] === 'extra') {
    showStep(stepIndex + 1);
    runResults();
    return;
  }
  showStep(stepIndex + 1);
}

function captureCurrentStep() {
  const step = STEPS[stepIndex];
  if (step === 'job') {
    budget.job.title = val('jobTitle');
    budget.job.employer = val('jobEmployer');
    budget.job.rank = val('jobRank');
    budget.job.hourlyWage = num('jobWage');
    budget.job.hoursPerWeek = num('jobHours');
  } else if (step === 'car') {
    budget.car.type = val('carType');
    budget.car.carNote = num('carNote');
  } else if (step === 'subs') {
    budget.subscriptions = readList('subsList');
  } else if (step === 'home') {
    budget.home.rent = num('homeRent');
    budget.home.utilities = num('homeUtil');
  } else if (step === 'extra') {
    budget.extra.groceries = num('exGroceries');
    budget.extra.carGas = num('exCarGas');
    budget.extra.custom = readList('extraList');
  }
}

// ---- Car toggle ----
const carFields = document.getElementById('carFields');
document.getElementById('carYes').addEventListener('click', () => setCar(true));
document.getElementById('carNo').addEventListener('click', () => setCar(false));
function setCar(hasCar) {
  budget.car.hasCar = hasCar;
  document.getElementById('carYes').classList.toggle('selected', hasCar);
  document.getElementById('carNo').classList.toggle('selected', !hasCar);
  carFields.hidden = !hasCar;
  if (!hasCar) { budget.car.type = ''; budget.car.carNote = 0; }
}

// ---- Dynamic lists (subscriptions + extra expenses) ----
function makeRow(listEl, namePlaceholder) {
  const row = document.createElement('div');
  row.className = 'list-row';
  row.innerHTML = `
    <input type="text" class="row-name" placeholder="${namePlaceholder}">
    <div class="row-cost">
      <span class="dollar">$</span>
      <input type="number" class="row-amount" min="0" step="1" placeholder="0">
    </div>
    <button class="remove-btn" title="Remove">✕</button>`;
  row.querySelector('.remove-btn').addEventListener('click', () => row.remove());
  listEl.appendChild(row);
}

function readList(listId) {
  const rows = document.querySelectorAll(`#${listId} .list-row`);
  const out = [];
  rows.forEach(r => {
    const name = r.querySelector('.row-name').value.trim();
    const cost = parseFloat(r.querySelector('.row-amount').value) || 0;
    if (name || cost) out.push({ name: name || 'Unnamed', cost });
  });
  return out;
}

document.getElementById('addSub').addEventListener('click', () =>
  makeRow(document.getElementById('subsList'), 'e.g. Netflix, Spotify, Gym'));
document.getElementById('addExtra').addEventListener('click', () =>
  makeRow(document.getElementById('extraList'), 'e.g. Phone bill, Insurance, Eating out'));

// Seed one empty row in each list to start
makeRow(document.getElementById('subsList'), 'e.g. Netflix, Spotify, Gym');
makeRow(document.getElementById('extraList'), 'e.g. Phone bill, Insurance, Eating out');

// ---- Restart ----
document.getElementById('restartBtn').addEventListener('click', () => location.reload());
document.getElementById('restartBtn2').addEventListener('click', () => location.reload());

// ---- Calculations ----
const WEEKS_PER_MONTH = 52 / 12; // ~4.333
const TAX_RATE = 0.20;

function computeTotals() {
  const gross = budget.job.hourlyWage * budget.job.hoursPerWeek * WEEKS_PER_MONTH;
  const net = gross * (1 - TAX_RATE);

  let expenses = 0;
  if (budget.car.hasCar) expenses += budget.car.carNote;
  budget.subscriptions.forEach(s => expenses += s.cost);
  expenses += budget.home.rent + budget.home.utilities;
  expenses += budget.extra.groceries + budget.extra.carGas;
  budget.extra.custom.forEach(c => expenses += c.cost);

  budget.totals = {
    grossIncome: round2(gross),
    netIncome: round2(net),
    totalExpenses: round2(expenses),
    leftover: round2(net - expenses),
  };
}

// ---- Results rendering ----
function runResults() {
  computeTotals();
  const t = budget.totals;

  document.getElementById('resIncome').textContent = money(t.netIncome);
  document.getElementById('resExpenses').textContent = money(t.totalExpenses);
  const leftoverEl = document.getElementById('resLeftover');
  leftoverEl.textContent = money(t.leftover);
  const card = document.getElementById('leftoverCard');
  card.classList.toggle('good', t.leftover > 0);
  card.classList.toggle('bad', t.leftover <= 0);

  renderBreakdown();
  fetchVerdict();
}

function renderBreakdown() {
  const items = [];
  if (budget.car.hasCar && budget.car.carNote) items.push(['🚗 Car note', budget.car.carNote]);
  if (budget.home.rent) items.push(['🏠 Rent / Mortgage', budget.home.rent]);
  if (budget.home.utilities) items.push(['💡 Gas & Electric', budget.home.utilities]);
  if (budget.extra.groceries) items.push(['🛒 Groceries', budget.extra.groceries]);
  if (budget.extra.carGas) items.push(['⛽ Gas for car', budget.extra.carGas]);
  const subTotal = budget.subscriptions.reduce((a, s) => a + s.cost, 0);
  if (subTotal) items.push(['📺 Subscriptions', subTotal]);
  budget.extra.custom.forEach(c => { if (c.cost) items.push([`• ${escapeHtml(c.name)}`, c.cost]); });

  const max = Math.max(1, ...items.map(i => i[1]));
  const el = document.getElementById('breakdown');
  el.innerHTML = `<h4 class="breakdown-title">Where your money goes</h4>` + items
    .sort((a, b) => b[1] - a[1])
    .map(([label, amt]) => `
      <div class="bar-row">
        <span class="bar-label">${label}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(amt / max) * 100}%"></div></div>
        <span class="bar-amt">${money(amt)}</span>
      </div>`).join('') || '<p class="muted">No expenses entered.</p>';
}

// ---- Verdict (streamed from Claude) ----
async function fetchVerdict() {
  const verdictEl = document.getElementById('verdictText');
  verdictEl.innerHTML = `<div class="thinking" id="thinking">Crunching your numbers<span class="dots"><span>.</span><span>.</span><span>.</span></span></div>`;

  try {
    const res = await fetch('/api/verdict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ budget }),
    });
    if (!res.ok) throw new Error(`Server error: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = '';
    let buffer = '';
    let started = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop();
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const data = line.slice(6).trim();
        if (data === '[DONE]') break;
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            verdictEl.innerHTML = `<div class="error-msg">${escapeHtml(parsed.error)}</div>`;
            return;
          }
          if (parsed.text) {
            if (!started) { verdictEl.innerHTML = ''; started = true; }
            text += parsed.text;
            verdictEl.innerHTML = renderMarkdown(text);
          }
        } catch {}
      }
    }
    if (text) verdictEl.innerHTML = renderMarkdown(text);
  } catch (err) {
    verdictEl.innerHTML = `<div class="error-msg">Couldn't reach the coach: ${escapeHtml(err.message)}. Make sure ANTHROPIC_API_KEY is set on the server.</div>`;
  }
}

// ---- Helpers ----
function val(id) { return document.getElementById(id).value.trim(); }
function num(id) { return parseFloat(document.getElementById(id).value) || 0; }
function round2(n) { return Math.round(n * 100) / 100; }
function money(n) {
  return `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function renderMarkdown(text) {
  let html = escapeHtml(text);
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^[*\-] (.+)$/gm, '<li>$1</li>');
  html = html.replace(/(<li>[\s\S]+?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>');
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
  html = html
    .split(/\n\n+/)
    .map(block => {
      if (/^<(h[123]|ul|ol|pre|blockquote|hr)/.test(block.trim())) return block;
      return `<p>${block.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
  return html;
}

// ---- Init ----
showStep(0);
