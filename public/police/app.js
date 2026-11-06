/* Police Form Maker — app logic.
   Three working forms (incident, citation, arrest) share one state object that
   autosaves to this browser. The form creator turns that state into paper. */
(() => {
  'use strict';
  const L = window.PFM_LISTS;
  const CB = window.PFM_CHARGES;
  const KEY = 'pfm.v1';
  const THEME_KEY = 'pfm.theme';

  /* ------------------------------------------------------------ helpers */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pad = (n, w = 2) => String(n).padStart(w, '0');
  const isoDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => isoDate(new Date());
  const nowHM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const addDays = (iso, n) => { const [y, m, d] = (iso || today()).split('-').map(Number); return isoDate(new Date(y, m - 1, d + n)); };
  const fmtDate = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${m}/${d}/${y}`; };
  const fmtTime = hm => (hm ? hm.replace(':', '') : '');
  const dayName = iso => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(y, m - 1, d).getDay()]; };
  const digits = n => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
  const yy = () => String(new Date().getFullYear()).slice(2);
  const money = n => '$' + (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const money0 = n => '$' + Math.round(+n || 0).toLocaleString('en-US');
  const get = (o, p) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o);
  const setp = (o, p, v) => { const ks = p.split('.'); let a = o; for (let i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null) a[ks[i]] = {}; a = a[ks[i]]; } a[ks[ks.length - 1]] = v; };
  const optVal = o => (Array.isArray(o) ? o[0] : o);
  const optLab = o => (Array.isArray(o) ? o[1] : o);
  const labelOf = (list, v) => { if (!v) return ''; const f = list.find(o => optVal(o) === v); return f ? optLab(f) : v; };
  const ageOf = dob => { if (!dob) return ''; const [y, m, d] = dob.split('-').map(Number); const t = new Date(); let a = t.getFullYear() - y; if (t.getMonth() + 1 < m || (t.getMonth() + 1 === m && t.getDate() < d)) a--; return a >= 0 && a < 130 ? a : ''; };
  const yearsAgo = (n, md) => `${new Date().getFullYear() - n}-${md}`;
  const monthsTxt = m => { if (m < 0) return 'Life'; if (!m) return '—'; const y = Math.floor(m / 12), r = m % 12; return [y ? `${y} yr` : '', r ? `${r} mo` : ''].filter(Boolean).join(' '); };
  const fullName = p => [p.first, p.middle, p.last].filter(Boolean).join(' ');
  const lastFirst = p => (p.last ? `${p.last}, ${[p.first, p.middle].filter(Boolean).join(' ')}`.replace(/, $/, '') : [p.first, p.middle].filter(Boolean).join(' '));
  const stateName = c => labelOf(L.states, c);
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  const merge = (base, over) => { if (!isObj(over)) return base; const out = { ...base }; for (const k of Object.keys(over)) out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k]; return out; };

  /* ------------------------------------------------------------ charge book */
  const ALL = [...CB.traffic, ...CB.other, ...CB.arrest];
  const BY = new Map();
  const norm = s => s.toLowerCase().replace(/[–—]/g, '-');
  for (const c of ALL) { c.ttl = norm(c.title); c.hay = norm(`${c.title} | ${c.code} ${c.cat}`); BY.set(c.id, c); }
  const catsOf = list => [...new Set(list.map(c => c.cat))];
  const ARREST_CATS = catsOf(CB.arrest);
  const SYN = { dwi: 'dui', owi: 'dui', drunk: 'dui', weed: 'cannabis', marijuana: 'cannabis', pot: 'cannabis', coke: 'cocaine',
    molly: 'mdma', ecstasy: 'mdma', shrooms: 'psilocybin', gun: 'firearm', guns: 'firearm', pistol: 'firearm', cop: 'peace officer',
    police: 'peace officer', car: 'vehicle', truck: 'vehicle', gta: 'grand theft auto', seatbelt: 'seat belt', belt: 'belt',
    tags: 'registration', reg: 'registration', lic: 'license', licence: 'license', jaywalk: 'jaywalking', tailgate: 'tailgating',
    cell: 'phone', texting: 'texting', ped: 'pedestrian', stop: 'stop', redlight: 'red signal',
    shoplift: 'shoplifting', dope: 'controlled', crack: 'crack', heroin: 'heroin', fent: 'fentanyl', knife: 'knife',
    tint: 'tint', tinted: 'tint', muffler: 'muffler', exhaust: 'exhaust', plate: 'plate', plates: 'plate' };
  const STOP = new Set(['a', 'an', 'the', 'of', 'for', 'to', 'in', 'on', 'at', 'with', 'and', 'or', 'ran', 'running', 'was', 'is', 'by']);
  const PHRASES = [[/\bred ?lights?\b/g, 'red signal'], [/\bstop ?lights?\b/g, 'red signal'], [/\bcell ?phone\b/g, 'phone'],
    [/\bno insurance\b/g, 'insurance'], [/\bsuspended (driver'?s )?licen[sc]e\b/g, 'suspended license'], [/\bseat ?belts?\b/g, 'seat belt'],
    [/\b(stolen (car|vehicle|truck|auto)|(car|auto|vehicle) theft)\b/g, 'grand theft auto']];
  const COMMON = new Set(['Failure to stop at a stop sign', 'Failure to stop for a steady red signal', 'Unsafe lane change', 'Driver not wearing a seat belt',
    'Handheld phone while driving — texting', 'No proof of insurance — first offense', "Driver's license not in possession", 'Following too closely (tailgating)',
    'Driving on a suspended license — DUI related', 'DUI — alcohol, first offense', 'Murder, first degree (premeditated)', 'Grand theft auto',
    'Resisting, delaying or obstructing a peace officer', 'Possession of a firearm by a convicted felon']);
  const tokens = q => {
    let s = norm(q);
    for (const [re, to] of PHRASES) s = s.replace(re, to);
    const out = [];
    for (const t of s.replace(/[^\w\s$.\-/']/g, ' ').split(/\s+/)) {
      if (!t || STOP.has(t)) continue;
      const w = t.length > 3 && t.endsWith('s') && !t.endsWith('ss') ? t.slice(0, -1) : t;
      if (SYN[t]) out.push(...SYN[t].split(' ')); else if (SYN[w]) out.push(...SYN[w].split(' ')); else out.push(w);
    }
    return [...new Set(out)];
  };
  function searchPool(pool, q) {
    const toks = tokens(q);
    if (!toks.length) return pool.slice();
    const strict = [], loose = [];
    for (const c of pool) {
      let hit = 0, score = 0;
      for (const t of toks) {
        const i = c.ttl.indexOf(t);
        if (i >= 0) { hit++; score += (i === 0 || /[\s(]/.test(c.ttl[i - 1])) ? 3 : 1.5; continue; }
        if (c.hay.indexOf(t) >= 0) { hit++; score += 0.5; }
      }
      if (!hit) continue;
      if (c.ttl.startsWith(toks[0])) score += 1.5;
      if (COMMON.has(c.title)) score += 2;
      (hit === toks.length ? strict : loose).push([score + hit * 2, c]);
    }
    const sort = a => a.sort((x, y) => y[0] - x[0]).map(r => r[1]);
    return strict.length ? sort(strict) : sort(loose);
  }

  const bailFor = c => {
    if (c.months < 0) return { n: 0, txt: 'No bail', none: true };
    if (c.months === 0) return { n: 0, txt: 'Per warrant', warrant: true };
    const n = c.cls === 'F' ? Math.max(10000, Math.round((c.months * 1500) / 500) * 500) : Math.max(500, c.months * 500);
    return { n, txt: money0(n) };
  };

  /* ------------------------------------------------------------ state */
  const defOfficer = () => ({
    rank: 'Officer', name: 'J. Ramirez', badge: '4127', unit: '2A-14', division: 'Patrol',
    agency: 'Port Calder Police Department', abbr: 'PCPD', city: 'Port Calder', county: 'Calder County', state: 'CA',
    address: '1100 Harbor Way, Port Calder', phone: '(555) 010-4400', ori: 'XX9990000',
    court: 'Calder County Superior Court — Traffic Division', courtAddr: '200 Civic Center Plaza, Port Calder',
    surcharge: 20, courtFee: 45, fixFee: 25
  });
  const blankPerson = () => ({ role: '', last: '', first: '', middle: '', dob: '', sex: '', race: '', height: '', weight: '', hair: '', eyes: '',
    address: '', phone: '', dl: '', dlState: '', injury: 'None', medical: 'None needed', statement: 'None' });
  const blankVehicle = () => ({ role: '', year: '', make: '', model: '', color: '', body: '', plate: '', plateState: '', vin: '', damage: 'None', disp: '', tow: '' });
  const blankItem = () => ({ desc: '', cat: '', status: '', qty: '1', value: '', serial: '', tag: '', stored: '' });
  const blankIncident = () => ({
    caseNo: `${yy()}-${digits(6)}`, reportType: 'Original', dateReported: today(), timeReported: nowHM(), dateOccurred: today(), timeOccurred: '',
    dateTo: '', timeTo: '', beat: '', shift: '', address: '', city: '', state: '', zip: '', locType: '', weather: '', lighting: '',
    incidentType: '', callSource: '', priority: '', disposition: '', status: 'Open', weapon: 'None', substance: 'None', dv: 'No', gang: 'No',
    offenses: '', persons: [], vehicles: [], property: [], actions: { bwc: true }, force: 'None', assisting: '', narrative: '',
    approval: 'Pending supervisor review', supervisor: '', supervisorBadge: ''
  });
  const blankDriver = () => ({ last: '', first: '', middle: '', dob: '', sex: '', race: '', height: '', weight: '', hair: '', eyes: '',
    address: '', city: '', state: '', zip: '', phone: '', dl: '', dlState: '', dlClass: '', cdl: 'No', hazmat: 'No' });
  const blankCitation = () => ({
    citeNo: `T${digits(7)}`, type: 'Traffic', date: today(), time: nowHM(), address: '', city: '', dir: '', beat: '',
    d: blankDriver(),
    v: { plate: '', plateState: '', year: '', make: '', model: '', color: '', body: '', vin: '', owner: 'Same as driver', ownerName: '', commercial: 'No', hazmat: 'No' },
    speed: { approx: '', posted: '', method: '', device: '' }, cond: { road: '', traffic: '', weather: '', lighting: '' },
    charges: [], court: '', courtAddr: '', appearDate: addDays(today(), 30), appearTime: '08:30', pay: 'Mail', sign: '', notes: ''
  });
  const blankArrest = () => ({
    bookNo: `B${yy()}-${digits(5)}`, caseNo: '', date: today(), time: nowHM(), address: '', city: '', type: '', warrant: '', beat: '',
    p: { last: '', first: '', middle: '', aka: '', dob: '', sex: '', race: '', height: '', weight: '', build: '', hair: '', eyes: '', complexion: '',
      facial: '', smt: '', address: '', city: '', state: '', zip: '', phone: '', pob: '', occupation: '', employer: '', dl: '', dlState: '', gang: 'None known' },
    photo: '', charges: [], enh: {}, miranda: 'Yes', mirandaTime: '', advisedBy: '', rights: '', search: '', force: 'None', injuries: 'None',
    medical: '', restraints: 'Handcuffs, double-locked', transport: '', facility: '', vehDisp: '', tow: '', propertyStored: '', hold: 'None',
    release: '', pc: '', assisting: '', bookingOfficer: '', supervisor: '', supervisorBadge: ''
  });
  const defaults = () => ({
    v: 1, view: 'incident', status: '10-8', example: false, officer: defOfficer(), incident: blankIncident(), citation: blankCitation(),
    arrest: blankArrest(), creator: { doc: 'incident', copy: 'Court copy' },
    ui: { cp: { citation: { q: '', kind: 'all', cat: '' }, arrest: { q: '', cat: '' } } }
  });

  let S;
  let storageOK = true;
  function loadStored() {
    try { const raw = localStorage.getItem(KEY); if (!raw) return null; const s = JSON.parse(raw); return s && s.v === 1 ? s : null; }
    catch { storageOK = false; return null; }
  }
  function normalize(s) {
    const d = defaults();
    const out = merge(d, s);
    out.incident = merge(blankIncident(), s.incident);
    out.incident.actions = { ...(s.incident && s.incident.actions || {}) };
    out.citation = merge(blankCitation(), s.citation);
    out.arrest = merge(blankArrest(), s.arrest);
    out.arrest.enh = { ...(s.arrest && s.arrest.enh || {}) };
    for (const k of ['persons', 'vehicles', 'property']) if (!Array.isArray(out.incident[k])) out.incident[k] = [];
    out.citation.charges = (out.citation.charges || []).filter(r => BY.has(r.id));
    out.arrest.charges = (out.arrest.charges || []).filter(r => BY.has(r.id));
    if (!['incident', 'citation', 'arrest', 'forms', 'setup'].includes(out.view)) out.view = 'incident';
    return out;
  }
  let saveT;
  function save() {
    clearTimeout(saveT);
    saveT = setTimeout(() => {
      try { localStorage.setItem(KEY, JSON.stringify(S)); storageOK = true; }
      catch { storageOK = false; }
      const el = $('#savedAt');
      if (el) { el.textContent = storageOK ? `Saved ${new Date().toLocaleTimeString('en-US', { hour12: false })}` : 'Not saved — browser storage is off'; el.classList.toggle('bad', !storageOK); }
    }, 300);
    clearTimeout(navT); navT = setTimeout(updateNav, 200);
  }
  let navT;

  /* ------------------------------------------------------------ example case */
  const findId = (kind, title) => { const c = CB[kind].find(x => x.title === title); return c ? c.id : null; };
  function exampleCase() {
    const d = today();
    const pruitt = { last: 'PRUITT', first: 'DALTON', middle: 'RAY', dob: yearsAgo(34, '03-22'), sex: 'M', race: 'W', height: `5'11"`, weight: '190', hair: 'BRO', eyes: 'BLU',
      address: '1187 Canal St Apt 4', phone: '(555) 010-7731', dl: 'D4471902', dlState: 'CA' };
    const incident = merge(blankIncident(), {
      caseNo: `${yy()}-004817`, reportType: 'Original', dateReported: d, timeReported: '23:58', dateOccurred: d, timeOccurred: '23:14',
      beat: 'Beat 2 — Harbor District', shift: 'Graveyard watch (2200–0800)', address: '4400 block of Harbor Blvd', city: 'Port Calder', state: 'CA',
      locType: 'Street / highway', weather: 'Clear', lighting: 'Dark — street lights', incidentType: 'DUI / impaired driver',
      callSource: 'Officer initiated (on-view)', priority: 'Priority 2 — Urgent', disposition: 'Arrest made', status: 'Cleared by arrest',
      weapon: 'None', substance: 'Alcohol and drugs', dv: 'No', gang: 'No',
      offenses: 'DUI; possession of methamphetamine; paraphernalia; suspended license; speeding; red signal',
      persons: [
        { ...blankPerson(), ...pruitt, role: 'Arrestee', statement: 'Verbal' },
        { ...blankPerson(), role: 'Witness', last: 'VEGA', first: 'MARISOL', middle: 'A', dob: yearsAgo(37, '09-04'), sex: 'F', race: 'H', height: `5'4"`, weight: '135',
          hair: 'BLK', eyes: 'BRO', address: '72 Lantern Ct, Port Calder', phone: '(555) 010-2286', statement: 'Written' }
      ],
      vehicles: [{ ...blankVehicle(), role: 'Suspect vehicle', year: '2014', make: 'Chevrolet', model: 'Silverado 1500', color: 'GRY', body: 'Pickup truck',
        plate: '8KPL442', plateState: 'CA', vin: '1GCVKREC5EZ104472', damage: 'None', disp: 'Impounded — 30 day', tow: 'Harborside Towing' }],
      property: [
        { desc: 'Plastic baggie, white crystalline substance (approx 1.2 g gross)', cat: 'Narcotics', status: 'Evidence', qty: '1', value: '', serial: '', tag: 'E26-11873', stored: 'Narcotics vault' },
        { desc: 'Glass smoking pipe with burnt residue', cat: 'Drug paraphernalia', status: 'Evidence', qty: '1', value: '', serial: '', tag: 'E26-11874', stored: 'Property room' },
        { desc: 'Open 24 oz can of beer, partly full', cat: 'Alcohol', status: 'Evidence', qty: '1', value: '', serial: '', tag: 'E26-11875', stored: 'Property room' }
      ],
      actions: { bwc: true, dash: true, photos: true, evidence: true, statements: true, supervisor: true, tow: true, ncic: true },
      force: 'None', assisting: 'Unit 2A-11 — Ofc. K. Brandt #3390',
      narrative:
`On the listed date at approximately 2314 hours, while on patrol in a marked unit, I saw a gray Chevrolet Silverado (CA 8KPL442) traveling northbound on Harbor Blvd at a high rate of speed. My Lidar unit measured the truck at 58 mph in a posted 35 mph zone. The truck continued through the steady red signal at Pier Ave without slowing.

I stopped the truck in the 4400 block of Harbor Blvd and contacted the driver, identified by his driver's license as Dalton Ray PRUITT. I smelled a strong odor of an alcoholic beverage coming from the cab and saw an open 24 oz can of beer in the center console. PRUITT's speech was slurred and his eyes were red and watery. A records check through dispatch showed his license was suspended for failure to appear.

PRUITT performed poorly on standardized field sobriety tests. A preliminary alcohol screening test showed 0.14% and 0.13% BAC. A search incident to arrest located a baggie of a white crystalline substance I believed to be methamphetamine in his right front pants pocket, and a glass pipe in the driver door pocket.

Witness Marisol VEGA, who was stopped at the intersection, stated the truck "flew through the red" and nearly hit her car. VEGA gave a written statement.

PRUITT was arrested without incident and transported to Central Jail. The truck was impounded by Harborside Towing. See the arrest report and citation under this case number.`,
      approval: 'Pending supervisor review', supervisor: 'Sgt. L. Okafor', supervisorBadge: '2215'
    });
    const citation = merge(blankCitation(), {
      citeNo: 'T4471209', type: 'Traffic', date: d, time: '23:14', address: 'Harbor Blvd at Pier Ave', city: 'Port Calder', dir: 'NB', beat: 'Beat 2 — Harbor District',
      d: { ...blankDriver(), ...pruitt, city: 'Port Calder', state: 'CA', dlClass: 'C — Passenger vehicle' },
      v: { plate: '8KPL442', plateState: 'CA', year: '2014', make: 'Chevrolet', model: 'Silverado 1500', color: 'GRY', body: 'Pickup truck', vin: '1GCVKREC5EZ104472',
        owner: 'Same as driver', ownerName: '', commercial: 'No', hazmat: 'No' },
      speed: { approx: '58', posted: '35', method: 'Lidar', device: 'LT-207' }, cond: { road: 'Dry', traffic: 'Light', weather: 'Clear', lighting: 'Dark — street lights' },
      charges: [
        findId('traffic', 'Speeding 21–25 mph over the limit in a business district'),
        findId('traffic', 'Failure to stop for a steady red signal'),
        findId('traffic', 'Open container of alcohol in vehicle — driver'),
        findId('traffic', 'Expired registration — 31 to 90 days')
      ].filter(Boolean).map(id => ({ id, offense: '1' })),
      appearDate: addDays(d, 30), appearTime: '08:30', pay: 'Mail', sign: 'Refused to sign — booked',
      notes: 'Violations observed before the DUI investigation. Driver booked; see arrest report under the same case number.'
    });
    const arrest = merge(blankArrest(), {
      bookNo: `B${yy()}-31877`, caseNo: incident.caseNo, date: d, time: '23:52', address: '4400 block of Harbor Blvd', city: 'Port Calder', type: 'Probable cause arrest',
      beat: 'Beat 2 — Harbor District',
      p: { ...blankArrest().p, ...pruitt, city: 'Port Calder', state: 'CA', aka: '', build: 'Medium', complexion: 'Fair', facial: 'Goatee',
        smt: 'Tattoo — anchor, right forearm', pob: 'Bakersfield, CA', occupation: 'Warehouse associate', employer: 'Seaport Logistics', gang: 'None known' },
      charges: [
        findId('arrest', 'DUI — combined alcohol and drugs'),
        findId('arrest', 'Possession of methamphetamine'),
        findId('arrest', 'Possession of drug paraphernalia'),
        findId('arrest', 'Driving on a suspended license — failure to appear')
      ].filter(Boolean).map(id => ({ id, mod: '', count: 1 })),
      miranda: 'Yes', mirandaTime: '00:21', advisedBy: 'Ofc. J. Ramirez #4127', rights: 'Waived — agreed to speak', search: 'Yes — contraband found',
      force: 'None', injuries: 'None', medical: 'Cleared — no medical needed', restraints: 'Handcuffs, double-locked', transport: 'Unit 2A-14',
      facility: 'Central Jail', vehDisp: 'Impounded — 30 day', tow: 'Harborside Towing', propertyStored: 'Wallet, phone, keys — inmate property bag P-5521',
      hold: 'None', release: 'Held — bail per schedule', assisting: 'Ofc. K. Brandt #3390', bookingOfficer: 'Dep. R. Castillo #7781',
      supervisor: 'Sgt. L. Okafor', supervisorBadge: '2215',
      pc:
`On the listed date at approximately 2314 hours I saw PRUITT drive a gray Chevrolet Silverado (CA 8KPL442) northbound on Harbor Blvd at 58 mph in a posted 35 mph zone (Lidar) and through the steady red signal at Pier Ave.

During the traffic stop PRUITT showed objective signs of intoxication: a strong odor of an alcoholic beverage, slurred speech, and red, watery eyes. An open 24 oz can of beer was in the center console. He performed poorly on standardized field sobriety tests, and a preliminary alcohol screening test showed 0.14% and 0.13% BAC. His pupils were dilated and did not react to light, consistent with stimulant use.

A search incident to arrest found a baggie of a white crystalline substance I believed to be methamphetamine (approx 1.2 g gross) in his right front pants pocket, and a glass pipe with burnt residue in the driver door pocket. Dispatch confirmed his driver's license was suspended for failure to appear, and PRUITT admitted he knew it was suspended.

At 0021 hours I advised PRUITT of his Miranda rights. He said he understood them and admitted drinking "three or four beers" and smoking methamphetamine "earlier tonight." He agreed to a blood test, which was drawn at Central Jail.`
    });
    return { incident, citation, arrest };
  }

  /* ------------------------------------------------------------ officer helpers */
  const RANK_ABBR = { 'Officer': 'Ofc.', 'Police Officer II': 'PO II', 'Senior Officer': 'Sr. Ofc.', 'Corporal': 'Cpl.', 'Sergeant': 'Sgt.', 'Lieutenant': 'Lt.',
    'Captain': 'Capt.', 'Detective': 'Det.', 'Deputy': 'Dep.', 'Senior Deputy': 'Sr. Dep.', 'Trooper': 'Tpr.', 'Reserve Officer': 'Res. Ofc.' };
  const O = () => S.officer;
  const officerShort = () => `${RANK_ABBR[O().rank] || ''} ${O().name || ''}`.trim();
  const officerLine = () => `${officerShort()}${O().badge ? ' #' + O().badge : ''}`;
  const formNo = kind => `${O().abbr || 'PD'} Form ${({ incident: 'IR-101', citation: 'TC-200', arrest: 'AR-300', packet: 'CP-000' })[kind]} (Rev. 06/26)`;

  /* ------------------------------------------------------------ field builders */
  const fid = p => 'f-' + p.replace(/\./g, '-');
  const cls = o => ['fld', o.span ? 's' + o.span : '', o.req ? 'req' : ''].filter(Boolean).join(' ');
  function inp(p, lab, o = {}) {
    const v = get(S, p) ?? '';
    return `<label class="${cls(o)}"><span>${esc(lab)}</span><input id="${fid(p)}" data-b="${p}" type="${o.type || 'text'}" value="${esc(v)}"` +
      `${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.list ? ` list="${o.list}"` : ''}${o.mono ? ' class="mono"' : ''}${o.mode ? ` inputmode="${o.mode}"` : ''}` +
      `${o.max ? ` maxlength="${o.max}"` : ''}${o.min != null ? ` min="${o.min}"` : ''} autocomplete="off" spellcheck="${o.spell ? 'true' : 'false'}"></label>`;
  }
  function sel(p, lab, list, o = {}) {
    const v = get(S, p) ?? '';
    const known = list.some(x => optVal(x) === v);
    const opts = `<option value="">— Select —</option>` + (v && !known ? `<option value="${esc(v)}" selected>${esc(v)}</option>` : '') +
      list.map(x => `<option value="${esc(optVal(x))}"${optVal(x) === v ? ' selected' : ''}>${esc(optLab(x))}</option>`).join('');
    return `<label class="${cls(o)}"><span>${esc(lab)}</span><select id="${fid(p)}" data-b="${p}">${opts}</select></label>`;
  }
  function area(p, lab, o = {}) {
    const v = get(S, p) ?? '';
    return `<label class="${cls({ ...o, span: 'full' })}"><span>${esc(lab)}</span><textarea id="${fid(p)}" data-b="${p}" rows="${o.rows || 6}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''} spellcheck="true">${esc(v)}</textarea></label>`;
  }
  const chk = (p, lab, extra = '') => `<label class="chk"><input type="checkbox" id="${fid(p)}" data-b="${p}"${get(S, p) ? ' checked' : ''}><span>${esc(lab)}</span>${extra}</label>`;
  const ro = (lab, val, id = '', span = '') => `<label class="fld${span ? ' s' + span : ''}"><span>${esc(lab)}</span><output class="out"${id ? ` id="${id}"` : ''}>${esc(val) || '&nbsp;'}</output></label>`;
  const grid = (...items) => `<div class="grid">${items.join('')}</div>`;
  const sec = (n, title, body, tools = '', id = '') => `<section class="sec"${id ? ` id="${id}"` : ''}><header class="sec-h"><span class="sec-n">${n}</span><h2>${title}</h2>` +
    `${tools ? `<div class="sec-tools">${tools}</div>` : ''}</header><div class="sec-b">${body}</div></section>`;
  const btn = (act, text, o = {}) => `<button type="button" class="btn ${o.cls || ''}" data-act="${act}"${o.data ? ' ' + Object.entries(o.data).map(([k, v]) => `data-${k}="${esc(v)}"`).join(' ') : ''}${o.id ? ` id="${o.id}"` : ''}>${text}</button>`;
  const datalists = () => `<datalist id="dl-makes">${L.makes.map(m => `<option value="${esc(m)}"></option>`).join('')}</datalist>`;

  function docHead(kind, title, numLab, num) {
    return `<div class="doc-h"><div><div class="eyebrow">${esc(formNo(kind))}</div><h1>${title}</h1>` +
      `<div class="doc-meta"><span>${numLab} <b id="docNum">${esc(num)}</b></span><span id="savedAt" class="saved">${storageOK ? 'Autosaves in this browser' : ''}</span></div></div>` +
      `<div class="doc-actions">${btn('example', 'Load example')}${btn('clear', 'Clear form', { cls: 'warn', data: { form: kind } })}${btn('generate', 'Create formal form →', { cls: 'pri', data: { doc: kind } })}</div></div>` + banner();
  }
  const banner = () => (S.example ? `<div class="banner"><p><b>Example case loaded.</b> All three forms hold one sample DUI stop so you can see every box filled in. Edit anything, or start over with blank forms.</p>` +
    `${btn('clearAll', 'Start blank', { cls: 'pri sm' })}${btn('dismissBanner', 'Keep example', { cls: 'sm ghost' })}</div>` : '');
  const narrTools = target => `<label class="fld"><span>Insert a standard phrase at the cursor</span><select data-phrase="${target}" id="ph-${target}">` +
    `<option value="">— Choose a phrase —</option>${L.phrases.map((x, i) => `<option value="${i}">${esc(x)}</option>`).join('')}</select></label>`;

  /* ------------------------------------------------------------ incident view */
  function repSummary(kind, x) {
    if (kind === 'persons') return [x.role, lastFirst(x), x.dob ? 'DOB ' + fmtDate(x.dob) : ''].filter(Boolean).join(' · ');
    if (kind === 'vehicles') return [x.role, [x.year, x.make, x.model].filter(Boolean).join(' '), x.plate ? `${x.plateState || ''} ${x.plate}`.trim() : ''].filter(Boolean).join(' · ');
    return [x.cat, x.desc, x.tag ? 'Tag ' + x.tag : ''].filter(Boolean).join(' · ');
  }
  function repCard(kind, i) {
    const base = `incident.${kind}.${i}`, q = k => `${base}.${k}`;
    const x = S.incident[kind][i];
    let title, body;
    if (kind === 'persons') {
      title = `Person ${i + 1}`;
      body = grid(sel(q('role'), 'Role', L.personRoles, { req: true }), inp(q('last'), 'Last name', { req: true }), inp(q('first'), 'First name'), inp(q('middle'), 'Middle'),
        inp(q('dob'), 'Date of birth', { type: 'date' }), sel(q('sex'), 'Sex', L.sex), sel(q('race'), 'Race', L.race), inp(q('height'), 'Height', { ph: `5'10"` }),
        inp(q('weight'), 'Weight (lbs)', { mode: 'numeric' }), sel(q('hair'), 'Hair', L.hair), sel(q('eyes'), 'Eyes', L.eyes), inp(q('phone'), 'Phone', { type: 'tel' }),
        inp(q('address'), 'Address', { span: 2 }), inp(q('dl'), "Driver's license #", { mono: true }), sel(q('dlState'), 'DL state', L.states),
        sel(q('injury'), 'Injury', L.injuries), sel(q('medical'), 'Medical', L.medical), sel(q('statement'), 'Statement', L.statements));
    } else if (kind === 'vehicles') {
      title = `Vehicle ${i + 1}`;
      body = grid(sel(q('role'), 'Role', L.vehicleRoles, { req: true }), inp(q('year'), 'Year', { mode: 'numeric', max: 4 }), inp(q('make'), 'Make', { list: 'dl-makes' }),
        inp(q('model'), 'Model'), sel(q('color'), 'Color', L.colors), sel(q('body'), 'Body style', L.bodyStyles), inp(q('plate'), 'License plate', { mono: true, max: 10 }),
        sel(q('plateState'), 'Plate state', L.states), inp(q('vin'), 'VIN', { mono: true, max: 17, span: 2 }), sel(q('damage'), 'Damage', L.damage),
        sel(q('disp'), 'Disposition', L.vehicleDisp), inp(q('tow'), 'Tow company'));
    } else {
      title = `Item ${i + 1}`;
      body = grid(inp(q('desc'), 'Description', { span: 2, req: true }), sel(q('cat'), 'Category', L.propertyCats), sel(q('status'), 'Status', L.propertyStatus),
        inp(q('qty'), 'Quantity', { mode: 'numeric' }), inp(q('value'), 'Value ($)', { mode: 'decimal' }), inp(q('serial'), 'Serial / ID #', { mono: true }),
        inp(q('tag'), 'Evidence tag #', { mono: true }), sel(q('stored'), 'Stored at', L.storedAt));
    }
    return `<div class="rep" id="rep-${kind}-${i}"><div class="rep-h"><b>${title}</b><span class="rep-sum" id="sum-${kind}-${i}">${esc(repSummary(kind, x))}</span>` +
      `${btn('del', 'Remove', { cls: 'sm ghost warn', data: { list: `incident.${kind}`, i } })}</div>${body}</div>`;
  }
  function reps(kind) {
    const list = S.incident[kind];
    if (!list.length) return `<p class="empty">${({ persons: 'No one added yet. Add the victim, suspect, witnesses and reporting party.', vehicles: 'No vehicles added.', property: 'No property or evidence added.' })[kind]}</p>`;
    return list.map((_, i) => repCard(kind, i)).join('');
  }
  function viewIncident() {
    const p = k => `incident.${k}`;
    return docHead('incident', 'Incident Report', 'Case #', S.incident.caseNo) + `<div class="stack">` +
      sec(1, 'Report information', grid(
        inp(p('caseNo'), 'Case number', { mono: true, req: true }), sel(p('reportType'), 'Report type', L.reportTypes),
        inp(p('dateReported'), 'Date reported', { type: 'date' }), inp(p('timeReported'), 'Time reported', { type: 'time' }),
        inp(p('dateOccurred'), 'Date occurred', { type: 'date', req: true }), inp(p('timeOccurred'), 'Time occurred', { type: 'time', req: true }),
        inp(p('dateTo'), 'Occurred until — date', { type: 'date' }), inp(p('timeTo'), 'Occurred until — time', { type: 'time' }),
        sel(p('beat'), 'Beat / district', L.beats), sel(p('shift'), 'Shift', L.shifts)
      ), btn('newnum', 'New case #', { cls: 'sm', data: { path: 'incident.caseNo', fmt: 'case' } }), 'sec-incident-1') +
      sec(2, 'Location', grid(
        inp(p('address'), 'Address or block', { span: 2, req: true, ph: '4400 block of Harbor Blvd' }), inp(p('city'), 'City', { ph: O().city }),
        sel(p('state'), 'State', L.states), inp(p('zip'), 'ZIP', { mode: 'numeric', max: 10 }), sel(p('locType'), 'Location type', L.locTypes, { req: true }),
        sel(p('weather'), 'Weather', L.weather), sel(p('lighting'), 'Lighting', L.lighting)
      ), '', 'sec-incident-2') +
      sec(3, 'Classification', grid(
        sel(p('incidentType'), 'Incident type', L.incidentTypes, { req: true }), sel(p('callSource'), 'Call source', L.callSources),
        sel(p('priority'), 'Priority', L.priorities), sel(p('disposition'), 'Disposition', L.dispositions, { req: true }), sel(p('status'), 'Case status', L.caseStatus),
        sel(p('weapon'), 'Weapon involved', L.weapons), sel(p('substance'), 'Alcohol / drugs', L.substance), sel(p('dv'), 'Domestic violence', L.yesNo),
        sel(p('gang'), 'Gang related', L.yesNoUnk), inp(p('offenses'), 'Offenses involved', { span: 3, ph: 'DUI; possession of methamphetamine' })
      ), '', 'sec-incident-3') +
      sec(4, 'Involved persons', reps('persons'), btn('add', '+ Add person', { cls: 'sm', data: { list: 'incident.persons' } }), 'sec-incident-4') +
      sec(5, 'Vehicles', reps('vehicles'), btn('add', '+ Add vehicle', { cls: 'sm', data: { list: 'incident.vehicles' } }), 'sec-incident-5') +
      sec(6, 'Property & evidence', reps('property'), btn('add', '+ Add item', { cls: 'sm', data: { list: 'incident.property' } }), 'sec-incident-6') +
      sec(7, 'Officer actions', `<div class="chks">${L.actions.map(([k, l]) => chk(p('actions.' + k), l)).join('')}</div>` +
        grid(sel(p('force'), 'Use of force', L.force), inp(p('assisting'), 'Assisting units', { span: 2 }))) +
      sec(8, 'Narrative', narrTools('f-incident-narrative') + area(p('narrative'), 'Narrative', { rows: 14, req: true, ph: 'What happened, in the first person, in the order it happened.' }) +
        `<p class="hint">“Write from my selections” drafts the opening paragraphs from everything you picked above. Add the details of your investigation after it.</p>`,
        btn('gen-narr', 'Write from my selections', { cls: 'sm', data: { form: 'incident' } }), 'sec-incident-8') +
      sec(9, 'Review & approval', grid(ro('Reporting officer', `${officerLine()} · Unit ${O().unit}`, '', 2), sel(p('approval'), 'Approval status', L.approval),
        inp(p('supervisor'), 'Supervisor'), inp(p('supervisorBadge'), 'Supervisor badge #', { mono: true }))) +
      `</div>` + datalists();
  }

  /* ------------------------------------------------------------ shared: import from incident */
  function importBar(form, what) {
    const list = what === 'vehicle' ? S.incident.vehicles : S.incident.persons;
    if (!list.length) return '';
    const opts = list.map((x, i) => `<option value="${i}">${esc(what === 'vehicle' ? repSummary('vehicles', x) : repSummary('persons', x)) || (what === 'vehicle' ? 'Vehicle ' : 'Person ') + (i + 1)}</option>`).join('');
    return `<div class="import"><span>Copy from the incident report:</span><select id="imp-${form}-${what}" aria-label="Choose from the incident report">${opts}</select>` +
      `${btn('import', 'Copy in', { cls: 'sm', data: { form, what } })}</div>`;
  }

  /* ------------------------------------------------------------ citation */
  const citeLine = row => { const c = BY.get(row.id); const o = L.offenseNo.find(x => x[0] === (row.offense || '1')) || L.offenseNo[0]; return { c, o, fine: c.fine * o[2] }; };
  function citeTotals() {
    const lines = S.citation.charges.map(citeLine);
    const base = lines.reduce((a, l) => a + l.fine, 0);
    const sur = base * (+O().surcharge || 0) / 100;
    const court = lines.length ? (+O().courtFee || 0) : 0;
    return { lines, base, sur, court, total: base + sur + court, fix: lines.filter(l => l.c.fix).length };
  }
  const kindPill = c => (c.kind === 'traffic' ? '<span class="pill k">Traffic</span>' : c.kind === 'other' ? '<span class="pill">Infraction</span>' : '');
  function citeTotalsHTML(t) {
    return `<div class="totals" id="citeTotals"><div><span>Base fines</span><b>${money(t.base)}</b></div><div><span>State surcharge (${+O().surcharge || 0}%)</span><b>${money(t.sur)}</b></div>` +
      `<div><span>Court &amp; processing fee</span><b>${money(t.court)}</b></div><div class="grand"><span>Total due</span><b>${money(t.total)}</b></div>` +
      (t.fix ? `<p class="fine-note">${t.fix} correctable violation${t.fix > 1 ? 's' : ''} can be dismissed with proof of correction and a ${money(O().fixFee)} fee each.</p>` : '') + `</div>`;
  }
  function citeChargesHTML() {
    const t = citeTotals();
    if (!t.lines.length) return `<p class="empty">No violations yet. Type one into the charge panel — <i>red light</i>, <i>speeding 15 school</i>, <i>expired registration</i>, <i>dog off leash</i> — and click it to charge.</p>` + citeTotalsHTML(t);
    return `<ol class="clist">${t.lines.map((l, i) => `<li class="crow"><div class="crow-main"><span class="code">${i + 1}. ${esc(l.c.code)} · ${esc(l.c.cat)}</span><span class="ct">${esc(l.c.title)}</span>` +
      `<span class="crow-tags">${kindPill(l.c)}${l.c.fix ? '<span class="pill ok">Correctable</span>' : ''}</span></div><div class="crow-ctl">` +
      `<label class="mini">Offense <select id="f-citation-charges-${i}-offense" data-b="citation.charges.${i}.offense">${L.offenseNo.map(o => `<option value="${o[0]}"${o[0] === (S.citation.charges[i].offense || '1') ? ' selected' : ''}>${o[1]}${o[2] > 1 ? ' (×' + o[2] + ')' : ''}</option>`).join('')}</select></label>` +
      `<b class="amt" id="cl-${i}">${money(l.fine)}</b><button type="button" class="x" data-act="rm-charge" data-form="citation" data-i="${i}" aria-label="Remove ${esc(l.c.title)}">×</button></div></li>`).join('')}</ol>` + citeTotalsHTML(t);
  }
  function viewCitation() {
    const p = k => `citation.${k}`;
    const C = S.citation;
    return docHead('citation', 'Citation', 'Citation #', C.citeNo) + `<div class="work"><div class="stack">` +
      sec(1, 'Citation information', grid(
        inp(p('citeNo'), 'Citation number', { mono: true, req: true }), sel(p('type'), 'Citation type', L.citationTypes),
        inp(p('date'), 'Violation date', { type: 'date', req: true }), inp(p('time'), 'Violation time', { type: 'time', req: true }),
        inp(p('address'), 'Location', { span: 2, req: true, ph: 'Harbor Blvd at Pier Ave' }), inp(p('city'), 'City', { ph: O().city }),
        sel(p('dir'), 'Direction of travel', L.directions), sel(p('beat'), 'Beat', L.beats)
      ), btn('newnum', 'New citation #', { cls: 'sm', data: { path: 'citation.citeNo', fmt: 'cite' } }), 'sec-citation-1') +
      sec(2, 'Violator', importBar('citation', 'person') + grid(
        inp(p('d.last'), 'Last name', { req: true }), inp(p('d.first'), 'First name', { req: true }), inp(p('d.middle'), 'Middle'),
        inp(p('d.dob'), 'Date of birth', { type: 'date', req: true }), sel(p('d.sex'), 'Sex', L.sex), sel(p('d.race'), 'Race', L.race),
        inp(p('d.height'), 'Height', { ph: `5'10"` }), inp(p('d.weight'), 'Weight (lbs)', { mode: 'numeric' }), sel(p('d.hair'), 'Hair', L.hair), sel(p('d.eyes'), 'Eyes', L.eyes),
        inp(p('d.address'), 'Street address', { span: 2 }), inp(p('d.city'), 'City'), sel(p('d.state'), 'State', L.states), inp(p('d.zip'), 'ZIP', { mode: 'numeric', max: 10 }),
        inp(p('d.phone'), 'Phone', { type: 'tel' }), inp(p('d.dl'), "Driver's license #", { mono: true }), sel(p('d.dlState'), 'DL state', L.states),
        sel(p('d.dlClass'), 'License class', L.dlClass), sel(p('d.cdl'), 'Commercial driver', L.yesNo), sel(p('d.hazmat'), 'Hazmat endorsement', L.yesNo)
      ), '', 'sec-citation-2') +
      sec(3, 'Vehicle', importBar('citation', 'vehicle') + grid(
        inp(p('v.plate'), 'License plate', { mono: true, max: 10 }), sel(p('v.plateState'), 'Plate state', L.states), inp(p('v.year'), 'Year', { mode: 'numeric', max: 4 }),
        inp(p('v.make'), 'Make', { list: 'dl-makes' }), inp(p('v.model'), 'Model'), sel(p('v.color'), 'Color', L.colors), sel(p('v.body'), 'Body style', L.bodyStyles),
        inp(p('v.vin'), 'VIN', { mono: true, max: 17, span: 2 }), sel(p('v.owner'), 'Registered owner', ['Same as driver', 'Other person', 'Business / fleet', 'Rental company', 'Unknown']),
        inp(p('v.ownerName'), 'Owner name (if not driver)'), sel(p('v.commercial'), 'Commercial vehicle', L.yesNo), sel(p('v.hazmat'), 'Hazardous materials', L.yesNo)
      ), '', 'sec-citation-3') +
      sec(4, 'Speed & conditions', grid(
        inp(p('speed.approx'), 'Recorded speed (mph)', { mode: 'numeric', max: 3 }), inp(p('speed.posted'), 'Posted limit (mph)', { mode: 'numeric', max: 3 }),
        sel(p('speed.method'), 'Measured by', L.enforcement), inp(p('speed.device'), 'Device / unit #', { mono: true }),
        sel(p('cond.road'), 'Road', L.roadConditions), sel(p('cond.traffic'), 'Traffic', L.trafficLevels), sel(p('cond.weather'), 'Weather', L.weather),
        sel(p('cond.lighting'), 'Lighting', L.lighting)
      )) +
      sec(5, 'Violations', `<div id="chargeList">${citeChargesHTML()}</div>`, btn('openpanel', '+ Add violation', { cls: 'pri sm' }), 'sec-citation-5') +
      sec(6, 'Court & appearance', grid(
        inp(p('court'), 'Court', { span: 2, ph: O().court }), inp(p('courtAddr'), 'Court address', { span: 2, ph: O().courtAddr }),
        inp(p('appearDate'), 'Appear on or before', { type: 'date', req: true }), inp(p('appearTime'), 'Time', { type: 'time' }),
        sel(p('pay'), 'Payment', L.payMethods), sel(p('sign'), 'Violator signature', L.violatorSign, { req: true })
      ), '', 'sec-citation-6') +
      sec(7, 'Officer notes', area(p('notes'), 'Notes (left off the violator copy)', { rows: 4 })) +
      `</div>${chargePanel('citation')}</div>` + datalists();
  }

  /* ------------------------------------------------------------ arrest */
  function arrestLine(row) {
    const c = BY.get(row.id);
    const mod = L.modifiers.find(m => m[0] === (row.mod || '')) || L.modifiers[0];
    const k = mod[2], n = Math.max(1, Math.min(99, parseInt(row.count, 10) || 1));
    const b = bailFor(c);
    return {
      c, mod, n, title: (mod[0] ? mod[1] + ' — ' : '') + c.title,
      months: c.months < 0 ? -1 : Math.round(c.months * k) * n,
      fine: c.fine * k * n,
      bail: b.none || b.warrant ? 0 : b.n * k * n,
      bailTxt: b.none ? 'No bail' : b.warrant ? 'Per warrant' : money0(b.n * k * n),
      noBail: !!b.none
    };
  }
  function arrestTotals() {
    const lines = S.arrest.charges.map(arrestLine);
    const enh = L.enhancements.filter(e => S.arrest.enh[e[0]]);
    const enhMo = enh.reduce((a, e) => a + e[2], 0);
    const life = lines.some(l => l.months < 0);
    const months = lines.reduce((a, l) => a + Math.max(0, l.months), 0) + enhMo;
    return {
      lines, enh, enhMo, life, months,
      fine: lines.reduce((a, l) => a + l.fine, 0),
      bail: lines.reduce((a, l) => a + l.bail, 0),
      noBail: lines.some(l => l.noBail),
      counts: lines.reduce((a, l) => a + l.n, 0),
      top: lines.some(l => l.c.cls === 'F') ? 'Felony' : lines.length ? 'Misdemeanor' : '—'
    };
  }
  const exposureTxt = t => (t.life ? `Life${t.months ? ' + ' + monthsTxt(t.months) : ''}` : monthsTxt(t.months));
  function arrestTotalsHTML(t) {
    return `<div class="totals" id="arrTotals"><div><span>Charges · counts</span><b>${t.lines.length} · ${t.counts}</b></div><div><span>Highest class</span><b>${t.top}</b></div>` +
      `<div><span>Total fines</span><b>${money(t.fine)}</b></div>${t.enhMo ? `<div><span>Enhancements</span><b>+${monthsTxt(t.enhMo)}</b></div>` : ''}` +
      `<div><span>Max exposure (consecutive)</span><b>${exposureTxt(t)}</b></div><div class="grand"><span>Total bail</span><b>${t.noBail ? 'No bail' : money0(t.bail)}</b></div></div>`;
  }
  const clsPill = c => `<span class="pill ${c.cls === 'F' ? 'f' : 'm'}">${c.cls === 'F' ? 'Felony' : 'Misd.'}</span>`;
  function arrestChargesHTML() {
    const t = arrestTotals();
    if (!t.lines.length) return `<p class="empty">No charges yet. Type one into the charge panel — <i>burglary</i>, <i>DUI injury</i>, <i>meth for sale</i>, <i>resisting</i> — and click it to charge. Click it again to add a count.</p>` + arrestTotalsHTML(t);
    return `<ol class="clist">${t.lines.map((l, i) => {
      const r = S.arrest.charges[i];
      return `<li class="crow"><div class="crow-main"><span class="code">${i + 1}. ${esc(l.c.code)} · ${esc(l.c.cat)}</span><span class="ct">${esc(l.c.title)}</span>` +
        `<span class="crow-tags">${clsPill(l.c)}<span class="pill" id="al-${i}">${esc(monthsTxt(l.months))} · ${esc(l.bailTxt)}</span></span></div><div class="crow-ctl">` +
        `<label class="mini">As <select id="f-arrest-charges-${i}-mod" data-b="arrest.charges.${i}.mod">${L.modifiers.map(m => `<option value="${m[0]}"${m[0] === (r.mod || '') ? ' selected' : ''}>${m[1]}</option>`).join('')}</select></label>` +
        `<label class="mini">Counts <input type="number" min="1" max="99" id="f-arrest-charges-${i}-count" data-b="arrest.charges.${i}.count" value="${esc(r.count || 1)}" inputmode="numeric"></label>` +
        `<button type="button" class="x" data-act="rm-charge" data-form="arrest" data-i="${i}" aria-label="Remove ${esc(l.c.title)}">×</button></div></li>`;
    }).join('')}</ol>` + arrestTotalsHTML(t);
  }
  function photoBlock() {
    const ph = S.arrest.photo;
    return `<div class="photo-up"><div class="photo-prev" id="photoPrev">${ph ? `<img src="${ph}" alt="Booking photo">` : 'No photo'}</div>` +
      `<label class="btn sm">${ph ? 'Replace booking photo' : 'Add booking photo'}<input type="file" accept="image/*" id="photoIn" hidden></label>` +
      `${ph ? btn('rm-photo', 'Remove photo', { cls: 'sm ghost warn' }) : ''}<p class="hint">Optional. The photo is shrunk and kept in this browser only.</p></div>`;
  }
  function viewArrest() {
    const p = k => `arrest.${k}`;
    const A = S.arrest;
    const age = ageOf(A.p.dob);
    return docHead('arrest', 'Arrest Report', 'Booking #', A.bookNo) + `<div class="work"><div class="stack">` +
      sec(1, 'Arrest information', grid(
        inp(p('bookNo'), 'Booking number', { mono: true, req: true }), inp(p('caseNo'), 'Related case #', { mono: true, ph: S.incident.caseNo }),
        inp(p('date'), 'Arrest date', { type: 'date', req: true }), inp(p('time'), 'Arrest time', { type: 'time', req: true }),
        inp(p('address'), 'Arrest location', { span: 2, req: true }), inp(p('city'), 'City', { ph: O().city }), sel(p('type'), 'Arrest type', L.arrestTypes, { req: true }),
        inp(p('warrant'), 'Warrant #', { mono: true }), sel(p('beat'), 'Beat', L.beats)
      ), btn('usecase', 'Use incident case #', { cls: 'sm' }) + btn('newnum', 'New booking #', { cls: 'sm', data: { path: 'arrest.bookNo', fmt: 'book' } }), 'sec-arrest-1') +
      sec(2, 'Arrestee', importBar('arrest', 'person') + grid(
        inp(p('p.last'), 'Last name', { req: true }), inp(p('p.first'), 'First name', { req: true }), inp(p('p.middle'), 'Middle'), inp(p('p.aka'), 'AKA / aliases'),
        inp(p('p.dob'), 'Date of birth', { type: 'date', req: true }), ro('Age', age === '' ? '' : `${age}${age < 18 ? ' — juvenile' : ''}`, 'ageOut'),
        sel(p('p.sex'), 'Sex', L.sex, { req: true }), sel(p('p.race'), 'Race', L.race), inp(p('p.height'), 'Height', { ph: `5'10"` }), inp(p('p.weight'), 'Weight (lbs)', { mode: 'numeric' }),
        sel(p('p.build'), 'Build', L.build), sel(p('p.hair'), 'Hair', L.hair), sel(p('p.eyes'), 'Eyes', L.eyes), sel(p('p.complexion'), 'Complexion', L.complexion),
        sel(p('p.facial'), 'Facial hair', L.facialHair), inp(p('p.smt'), 'Scars, marks, tattoos', { span: 2 }),
        inp(p('p.address'), 'Street address', { span: 2 }), inp(p('p.city'), 'City'), sel(p('p.state'), 'State', L.states), inp(p('p.zip'), 'ZIP', { mode: 'numeric', max: 10 }),
        inp(p('p.phone'), 'Phone', { type: 'tel' }), inp(p('p.pob'), 'Place of birth'), inp(p('p.occupation'), 'Occupation'), inp(p('p.employer'), 'Employer'),
        inp(p('p.dl'), "Driver's license #", { mono: true }), sel(p('p.dlState'), 'DL state', L.states), sel(p('p.gang'), 'Gang affiliation', L.gang)
      ) + photoBlock(), '', 'sec-arrest-2') +
      sec(3, 'Charges', `<div id="chargeList">${arrestChargesHTML()}</div>`, btn('openpanel', '+ Add charge', { cls: 'pri sm' }), 'sec-arrest-3') +
      sec(4, 'Sentencing enhancements', `<div class="enh">${L.enhancements.map(e => chk(p('enh.' + e[0]), e[1], `<em>+${monthsTxt(e[2])}</em>`)).join('')}</div>`) +
      sec(5, 'Custody & processing', grid(
        sel(p('miranda'), 'Miranda advised', L.miranda), inp(p('mirandaTime'), 'Miranda time', { type: 'time' }), inp(p('advisedBy'), 'Advised by', { ph: officerLine() }),
        sel(p('rights'), 'Rights', L.rights), sel(p('search'), 'Search incident to arrest', L.search), sel(p('restraints'), 'Restraints', L.restraints),
        sel(p('force'), 'Use of force', L.force), sel(p('injuries'), 'Injuries', L.injuries), sel(p('medical'), 'Medical clearance', L.custodyMedical),
        inp(p('transport'), 'Transported by', { ph: 'Unit ' + O().unit }), sel(p('facility'), 'Booked at', L.facilities, { req: true }), sel(p('hold'), 'Holds', L.holds),
        sel(p('release'), 'Release status', L.release, { req: true }), sel(p('vehDisp'), 'Vehicle', L.vehicleDisp), inp(p('tow'), 'Tow company'),
        inp(p('propertyStored'), 'Property stored', { span: 2 })
      ), '', 'sec-arrest-5') +
      sec(6, 'Probable cause declaration', narrTools('f-arrest-pc') + area(p('pc'), 'Facts establishing probable cause', { rows: 12, req: true, ph: 'What you saw and learned that justifies each charge.' }),
        btn('gen-narr', 'Write from my selections', { cls: 'sm', data: { form: 'arrest' } }), 'sec-arrest-6') +
      sec(7, 'Officers', grid(ro('Arresting officer', `${officerLine()} · Unit ${O().unit}`, '', 2), inp(p('assisting'), 'Assisting officers', { span: 2 }),
        inp(p('bookingOfficer'), 'Booking officer'), inp(p('supervisor'), 'Approving supervisor'), inp(p('supervisorBadge'), 'Supervisor badge #', { mono: true }))) +
      `</div>${chargePanel('arrest')}</div>`;
  }

  /* ------------------------------------------------------------ charge panel */
  function poolFor(form) {
    const ui = S.ui.cp[form];
    let pool = form === 'citation' ? (ui.kind === 'traffic' ? CB.traffic : ui.kind === 'other' ? CB.other : CB.traffic.concat(CB.other)) : CB.arrest;
    if (ui.cat) pool = pool.filter(c => c.cat === ui.cat);
    return pool;
  }
  const isAdded = (form, id) => S[form].charges.some(r => r.id === id);
  const LIMIT = 80;
  function cpListHTML(form) {
    const ui = S.ui.cp[form];
    const res = searchPool(poolFor(form), ui.q);
    if (!res.length) return { html: `<div class="cp-empty">Nothing matches “${esc(ui.q)}”. Try fewer words, or a different word — <i>signal</i> instead of <i>light</i>, <i>firearm</i> instead of <i>gun</i>.</div>`, foot: '0 matches' };
    const rows = res.slice(0, LIMIT).map(c => {
      const added = isAdded(form, c.id);
      const meta = form === 'arrest' ? `${c.cls === 'F' ? 'FEL' : 'MISD'} · ${monthsTxt(c.months)}` : money0(c.fine) + (c.fix ? ' · fix-it' : '');
      return `<button type="button" class="cp-row${added ? ' added' : ''}" data-act="charge" data-id="${esc(c.id)}"><span class="code">${esc(c.code)} · ${esc(c.cat)}</span>` +
        `<span class="meta">${esc(meta)}</span><span class="t">${esc(c.title)}</span><span class="add">${added ? (form === 'arrest' ? '+1 count' : '✓ Charged') : '+ Charge'}</span></button>`;
    }).join('');
    const foot = `${res.length > LIMIT ? `Showing ${LIMIT} of ${res.length.toLocaleString()} — keep typing to narrow it down.` : `${res.length.toLocaleString()} match${res.length === 1 ? '' : 'es'}.`} Press Enter to charge the top one.`;
    return { html: rows, foot };
  }
  function chargePanel(form) {
    const ui = S.ui.cp[form];
    const isCite = form === 'citation';
    const total = isCite ? CB.traffic.length + CB.other.length : CB.arrest.length;
    const cats = isCite ? catsOf(ui.kind === 'traffic' ? CB.traffic : ui.kind === 'other' ? CB.other : CB.traffic.concat(CB.other)) : ARREST_CATS;
    const r = cpListHTML(form);
    const n = S[form].charges.length;
    return `<aside class="cpanel" id="cpanel" aria-label="Charge panel"><div class="cp-h"><div><h2>Charge panel</h2><div class="cp-count">${total.toLocaleString()} ${isCite ? `infractions · ${CB.traffic.length} traffic · ${CB.other.length} other` : 'arrest charges'}</div></div>` +
      `<button type="button" class="btn sm cp-close" data-act="closepanel" id="cpDone">Done${n ? ` (${n})` : ''}</button></div>` +
      `<div class="cp-s"><input type="search" id="cp-q" value="${esc(ui.q)}" placeholder="${isCite ? 'Type a violation — red light, speeding 20…' : 'Type a charge — burglary, DUI, meth for sale…'}" autocomplete="off" spellcheck="false" aria-label="Search charges" enterkeyhint="done">` +
      (isCite ? `<div class="seg sm" role="group" aria-label="Charge book">${[['all', 'All', total], ['traffic', 'Traffic', CB.traffic.length], ['other', 'Other', CB.other.length]].map(([k, l, c]) =>
        `<button type="button" data-act="cp-kind" data-kind="${k}" aria-pressed="${ui.kind === k}">${l}<span>${c}</span></button>`).join('')}</div>` : '') +
      `<select id="cp-cat" aria-label="Category"><option value="">All categories</option>${cats.map(c => `<option${c === ui.cat ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>` +
      `<div class="cp-list" id="cp-list">${r.html}</div><div class="cp-foot" id="cp-foot">${r.foot}</div></aside>`;
  }
  function refreshPanelList() {
    const form = S.view; if (form !== 'citation' && form !== 'arrest') return;
    const r = cpListHTML(form);
    const list = $('#cp-list'); if (list) { list.innerHTML = r.html; }
    const foot = $('#cp-foot'); if (foot) foot.textContent = r.foot;
    const done = $('#cpDone'); if (done) { const n = S[form].charges.length; done.textContent = `Done${n ? ` (${n})` : ''}`; }
  }
  function refreshPanel() {
    const old = $('#cpanel'); if (!old) return;
    const open = old.classList.contains('open');
    const scroll = $('#cp-list') ? $('#cp-list').scrollTop : 0;
    keepFocus(() => { old.outerHTML = chargePanel(S.view); });
    if (open) $('#cpanel').classList.add('open');
    if ($('#cp-list')) $('#cp-list').scrollTop = scroll;
  }
  function addCharge(form, id) {
    const c = BY.get(id); if (!c) return;
    const list = S[form].charges;
    const ex = list.find(r => r.id === id);
    if (form === 'citation') {
      if (ex) { toast(`Already on this citation: ${c.title}`); return; }
      list.push({ id, offense: '1' });
    } else if (ex) {
      ex.count = Math.min(99, (parseInt(ex.count, 10) || 1) + 1);
      toast(`Count ${ex.count}: ${c.title}`);
    } else list.push({ id, mod: '', count: 1 });
    if (!ex) toast(`Charged ${c.code} — ${c.title}`);
    refreshCharges(); refreshPanelList(); save();
  }
  function refreshCharges() {
    const el = $('#chargeList'); if (!el) return;
    keepFocus(() => { el.innerHTML = S.view === 'citation' ? citeChargesHTML() : arrestChargesHTML(); });
  }

  /* ------------------------------------------------------------ setup view */
  function viewSetup() {
    const p = k => `officer.${k}`;
    return `<div class="doc-h"><div><div class="eyebrow">Configuration</div><h1>Officer setup</h1><div class="doc-meta"><span>Prints on every form you create</span><span id="savedAt" class="saved"></span></div></div></div><div class="stack">` +
      sec(1, 'Officer', grid(sel(p('rank'), 'Rank', L.ranks), inp(p('name'), 'Name as signed', { req: true, ph: 'J. Ramirez' }), inp(p('badge'), 'Badge #', { mono: true, req: true }),
        inp(p('unit'), 'Unit / call sign', { mono: true }), sel(p('division'), 'Division', L.divisions)), '', 'sec-setup-1') +
      sec(2, 'Agency', grid(inp(p('agency'), 'Agency name', { span: 2, req: true }), inp(p('abbr'), 'Abbreviation', { mono: true, max: 8 }), inp(p('ori'), 'ORI number', { mono: true, max: 9 }),
        inp(p('city'), 'City'), inp(p('county'), 'County'), sel(p('state'), 'State', L.states), inp(p('address'), 'Agency address', { span: 2 }), inp(p('phone'), 'Agency phone', { type: 'tel' }))) +
      sec(3, 'Court & citation fees', grid(inp(p('court'), 'Default court', { span: 2 }), inp(p('courtAddr'), 'Court address', { span: 2 }),
        inp(p('surcharge'), 'State surcharge (%)', { type: 'number', min: 0, mode: 'decimal' }), inp(p('courtFee'), 'Court & processing fee ($)', { type: 'number', min: 0, mode: 'decimal' }),
        inp(p('fixFee'), 'Proof-of-correction fee ($)', { type: 'number', min: 0, mode: 'decimal' }))) +
      sec(4, 'Saved data', `<p class="hint">Everything you type is kept in this browser on this device. Nobody else sees it, and clearing your browser data erases it.</p>` +
        `<div class="doc-actions">${btn('example', 'Load the example case')}${btn('clearAll', 'Clear all three forms', { cls: 'warn' })}</div>`) +
      `</div>`;
  }

  /* ------------------------------------------------------------ completeness */
  function missing(doc) {
    const m = [];
    const need = (ok, label, view, path, secId) => { if (!ok) m.push({ label, view, path: path || '', sec: secId || '' }); };
    if (doc === 'incident') {
      const I = S.incident;
      need(I.caseNo, 'Case number', 'incident', 'incident.caseNo');
      need(I.dateOccurred, 'Date occurred', 'incident', 'incident.dateOccurred');
      need(I.timeOccurred, 'Time occurred', 'incident', 'incident.timeOccurred');
      need(I.address, 'Location', 'incident', 'incident.address');
      need(I.locType, 'Location type', 'incident', 'incident.locType');
      need(I.incidentType, 'Incident type', 'incident', 'incident.incidentType');
      need(I.disposition, 'Disposition', 'incident', 'incident.disposition');
      need(I.persons.length, 'An involved person', 'incident', '', 'sec-incident-4');
      I.persons.forEach((x, i) => { need(x.role, `Person ${i + 1} role`, 'incident', `incident.persons.${i}.role`); need(x.last, `Person ${i + 1} last name`, 'incident', `incident.persons.${i}.last`); });
      need(I.narrative.trim(), 'Narrative', 'incident', 'incident.narrative');
    } else if (doc === 'citation') {
      const C = S.citation;
      need(C.citeNo, 'Citation number', 'citation', 'citation.citeNo');
      need(C.date, 'Violation date', 'citation', 'citation.date');
      need(C.time, 'Violation time', 'citation', 'citation.time');
      need(C.address, 'Violation location', 'citation', 'citation.address');
      need(C.d.last, 'Violator last name', 'citation', 'citation.d.last');
      need(C.d.first, 'Violator first name', 'citation', 'citation.d.first');
      need(C.d.dob, 'Violator date of birth', 'citation', 'citation.d.dob');
      if (C.type !== 'Non-traffic infraction') need(C.v.plate, 'License plate', 'citation', 'citation.v.plate');
      need(C.charges.length, 'At least one violation', 'citation', '', 'sec-citation-5');
      need(C.appearDate, 'Appearance date', 'citation', 'citation.appearDate');
      need(C.sign, 'Violator signature', 'citation', 'citation.sign');
    } else if (doc === 'arrest') {
      const A = S.arrest;
      need(A.bookNo, 'Booking number', 'arrest', 'arrest.bookNo');
      need(A.date, 'Arrest date', 'arrest', 'arrest.date');
      need(A.time, 'Arrest time', 'arrest', 'arrest.time');
      need(A.address, 'Arrest location', 'arrest', 'arrest.address');
      need(A.type, 'Arrest type', 'arrest', 'arrest.type');
      need(A.p.last, 'Arrestee last name', 'arrest', 'arrest.p.last');
      need(A.p.first, 'Arrestee first name', 'arrest', 'arrest.p.first');
      need(A.p.dob, 'Arrestee date of birth', 'arrest', 'arrest.p.dob');
      need(A.p.sex, 'Arrestee sex', 'arrest', 'arrest.p.sex');
      need(A.charges.length, 'At least one charge', 'arrest', '', 'sec-arrest-3');
      need(A.facility, 'Booking facility', 'arrest', 'arrest.facility');
      need(A.release, 'Release status', 'arrest', 'arrest.release');
      need(A.pc.trim(), 'Probable cause declaration', 'arrest', 'arrest.pc');
    }
    if (doc !== 'setup') { need(O().name, 'Officer name', 'setup', 'officer.name'); need(O().badge, 'Badge number', 'setup', 'officer.badge'); }
    return m;
  }
  function updateNav() {
    for (const k of ['incident', 'citation', 'arrest']) {
      const el = $('#nc-' + k); if (!el) continue;
      const n = missing(k).filter(x => x.view === k).length;
      el.className = 'nav-c ' + (n ? 'todo' : 'done');
      el.textContent = n ? String(n) : '✓';
      el.title = n ? `${n} required box${n > 1 ? 'es' : ''} empty` : 'Complete';
    }
    const s = $('#nc-setup'); if (s) { const ok = O().name && O().badge; s.className = 'nav-c ' + (ok ? 'done' : 'todo'); s.textContent = ok ? '✓' : '!'; }
    const note = $('#railNote');
    if (note) note.textContent = `${CB.traffic.length} traffic infractions, ${CB.other.length} other infractions and ${CB.arrest.length.toLocaleString()} arrest charges on file.`;
  }

  /* ------------------------------------------------------------ narrative drafts */
  function draftIncident() {
    const I = S.incident;
    const where = I.address ? [I.address, I.city || O().city].filter(Boolean).join(', ') : '';
    const onView = I.callSource === 'Officer initiated (on-view)' || I.callSource === 'Flagged down';
    const out = [];
    let first = `On ${fmtDate(I.dateReported) || 'the listed date'} at approximately ${fmtTime(I.timeReported) || '____'} hours, I, ${O().rank} ${O().name} #${O().badge} (Unit ${O().unit}), `;
    first += onView ? `${I.callSource === 'Flagged down' ? 'was flagged down' : 'initiated contact'} at ${where || 'the listed location'}` : `was dispatched to ${where || 'the listed location'}`;
    if (I.locType) first += `, a ${I.locType.toLowerCase().replace(' — ', ' (') + (I.locType.includes(' — ') ? ')' : '')}`;
    first += I.incidentType ? `, regarding a ${I.incidentType.toLowerCase()} call` : '';
    if (I.callSource && !onView) first += ` (${I.callSource.toLowerCase()}${I.priority ? ', ' + I.priority.split(' — ')[0].toLowerCase() : ''})`;
    first += '.';
    if (I.dateOccurred || I.timeOccurred) first += ` The incident occurred on ${fmtDate(I.dateOccurred) || 'the listed date'} at approximately ${fmtTime(I.timeOccurred) || '____'} hours${I.dateTo ? ` and continued until ${fmtDate(I.dateTo)}${I.timeTo ? ' at ' + fmtTime(I.timeTo) + ' hours' : ''}` : ''}.`;
    if (I.weather || I.lighting) first += ` Weather was ${(I.weather || 'unknown').toLowerCase()} and lighting was ${(I.lighting || 'unknown').toLowerCase()}.`;
    out.push(first);
    if (I.persons.length) {
      out.push('Involved parties: ' + I.persons.map(x => `${(x.role || 'Involved').toLowerCase()} ${fullName(x) || '(name unknown)'}${x.dob ? ` (DOB ${fmtDate(x.dob)})` : ''}${x.statement && x.statement !== 'None' ? `, who gave a ${x.statement.toLowerCase()} statement` : ''}`).join('; ') + '.');
      const hurt = I.persons.filter(x => x.injury && x.injury !== 'None');
      if (hurt.length) out.push(hurt.map(x => `${fullName(x)} had ${x.injury.toLowerCase()}${x.medical && x.medical !== 'None needed' ? ` and was ${x.medical.toLowerCase().replace('refused medical', 'refused medical care')}` : ''}.`).join(' '));
    }
    if (I.vehicles.length) out.push(I.vehicles.map(v => `${v.role || 'Involved vehicle'}: ${[v.year, labelOf(L.colors, v.color), v.make, v.model].filter(Boolean).join(' ') || 'vehicle'}${v.plate ? `, ${v.plateState || ''} plate ${v.plate}`.replace(' ,', ',') : ''}${v.disp ? ` — ${v.disp.toLowerCase()}${v.tow ? ' by ' + v.tow : ''}` : ''}.`).join(' '));
    if (I.property.length) out.push(`${I.property.length} item${I.property.length > 1 ? 's were' : ' was'} documented: ` + I.property.map(x => `${x.qty && x.qty !== '1' ? x.qty + ' × ' : ''}${x.desc || x.cat || 'item'}${x.status ? ` (${x.status.toLowerCase()}${x.tag ? ', tag ' + x.tag : ''})` : ''}`).join('; ') + '.');
    const acts = L.actions.filter(([k]) => I.actions[k]).map(([, l]) => l.toLowerCase());
    if (acts.length) out.push(`Actions taken: ${acts.join(', ')}.`);
    out.push(I.force && I.force !== 'None' ? `Force used: ${I.force.toLowerCase()}.` : 'No force was used.');
    if (I.assisting) out.push(`Assisting: ${I.assisting}.`);
    if (I.disposition) out.push(`Disposition: ${I.disposition.toLowerCase()}. Case status: ${(I.status || 'open').toLowerCase()}.`);
    out.push('[Describe what you saw, what each person told you, and what you did, in order.]');
    return out.join('\n\n');
  }
  function draftArrest() {
    const A = S.arrest, t = arrestTotals();
    const nm = fullName(A.p) || '(arrestee)';
    const out = [];
    out.push(`On ${fmtDate(A.date) || 'the listed date'} at approximately ${fmtTime(A.time) || '____'} hours, at ${[A.address, A.city || O().city].filter(Boolean).join(', ') || 'the listed location'}, I, ${O().rank} ${O().name} #${O().badge}, placed ${nm}${A.p.dob ? ` (DOB ${fmtDate(A.p.dob)})` : ''} under arrest${A.type ? ` (${A.type.toLowerCase()})` : ''}${A.warrant ? ` on warrant #${A.warrant}` : ''}.`);
    if (t.lines.length) out.push('Charges: ' + t.lines.map(l => `${l.c.code} ${l.title}${l.n > 1 ? ` (${l.n} counts)` : ''}`).join('; ') + '.');
    if (t.enh.length) out.push('Enhancements alleged: ' + t.enh.map(e => e[1].toLowerCase()).join('; ') + '.');
    const bits = [];
    if (A.search) bits.push(`A search incident to arrest was ${A.search.startsWith('No') ? 'not conducted' : 'conducted (' + A.search.replace('Yes — ', '').toLowerCase() + ')'}`);
    if (A.restraints) bits.push(`${nm} was restrained with ${A.restraints.toLowerCase()}`);
    bits.push(A.force && A.force !== 'None' ? `force used: ${A.force.toLowerCase()}` : 'no force was used');
    if (A.injuries) bits.push(`injuries: ${A.injuries.toLowerCase()}`);
    out.push(bits.join('; ') + '.');
    if (A.miranda === 'Yes') out.push(`At ${fmtTime(A.mirandaTime) || '____'} hours, ${A.advisedBy || officerLine()} advised ${nm} of their Miranda rights. ${nm} ${A.rights ? A.rights.toLowerCase().replace('waived — ', 'waived them and ') : 'responded: ____'}.`);
    else if (A.miranda) out.push(`Miranda: ${A.miranda.toLowerCase()}.`);
    out.push(`${nm} was transported by ${A.transport || 'Unit ' + O().unit} to ${A.facility || '____'} for booking${A.medical ? ` (${A.medical.toLowerCase()})` : ''}.${A.vehDisp && A.vehDisp !== 'Not applicable' ? ` The vehicle was ${A.vehDisp.toLowerCase()}${A.tow ? ' by ' + A.tow : ''}.` : ''}`);
    out.push('[State the facts you saw and learned that establish probable cause for each charge.]');
    return out.join('\n\n');
  }

  /* ------------------------------------------------------------ paper: graphics */
  let sealN = 0;
  function seal() {
    const n = ++sealN;
    const name = (O().agency || 'Police Department').toUpperCase();
    const sub = [O().city, O().state].filter(Boolean).join(' · ').toUpperCase();
    const fs = Math.min(7.4, 205 / Math.max(10, name.length));
    const pts = [];
    for (let i = 0; i < 14; i++) { const a = -Math.PI / 2 + i * Math.PI / 7; const r = i % 2 ? 9.5 : 21; pts.push(`${(50 + r * Math.cos(a)).toFixed(2)},${(50 + r * Math.sin(a)).toFixed(2)}`); }
    const abbr = esc((O().abbr || 'PD').slice(0, 5));
    return `<svg viewBox="0 0 100 100" role="img" aria-label="${esc(O().agency)} seal"><defs><path id="sT${n}" d="M 13 50 A 37 37 0 0 1 87 50"/><path id="sB${n}" d="M 9.6 50 A 40.4 40.4 0 0 0 90.4 50"/></defs>` +
      `<circle cx="50" cy="50" r="48.5" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="50" cy="50" r="45.5" fill="none" stroke="currentColor" stroke-width=".7"/>` +
      `<circle cx="50" cy="50" r="31" fill="none" stroke="currentColor" stroke-width=".7"/>` +
      `<text fill="currentColor" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="${fs.toFixed(2)}" letter-spacing=".5"><textPath href="#sT${n}" startOffset="50%" text-anchor="middle">${esc(name)}</textPath></text>` +
      `<text fill="currentColor" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="600" font-size="6" letter-spacing="1"><textPath href="#sB${n}" startOffset="50%" text-anchor="middle">★ ${esc(sub)} ★</textPath></text>` +
      `<polygon points="${pts.join(' ')}" fill="currentColor"/>` +
      `<circle cx="50" cy="50" r="7.6" fill="#fff" stroke="currentColor" stroke-width=".6"/><text x="50" y="52.2" text-anchor="middle" font-family="Barlow Condensed, Arial Narrow, sans-serif" font-weight="700" font-size="${abbr.length > 3 ? 4.2 : 5.4}" fill="#111">${abbr}</text></svg>`;
  }
  const C39 = { '0': '101001101101', '1': '110100101011', '2': '101100101011', '3': '110110010101', '4': '101001101011', '5': '110100110101',
    '6': '101100110101', '7': '101001011011', '8': '110100101101', '9': '101100101101', 'A': '110101001011', 'B': '101101001011', 'C': '110110100101',
    'D': '101011001011', 'E': '110101100101', 'F': '101101100101', 'G': '101010011011', 'H': '110101001101', 'I': '101101001101', 'J': '101011001101',
    'K': '110101010011', 'L': '101101010011', 'M': '110110101001', 'N': '101011010011', 'O': '110101101001', 'P': '101101101001', 'Q': '101010110011',
    'R': '110101011001', 'S': '101101011001', 'T': '101011011001', 'U': '110010101011', 'V': '100110101011', 'W': '110011010101', 'X': '100101101011',
    'Y': '110010110101', 'Z': '100110110101', '-': '100101011011', '.': '110010101101', ' ': '100110101101', '*': '100101101101' };
  function barcode(text) {
    const s = `*${String(text || '').toUpperCase().replace(/[^0-9A-Z\-. ]/g, '')}*`;
    let bits = '';
    for (const ch of s) bits += C39[ch] + '0';
    let rects = '';
    for (let i = 0; i < bits.length;) { if (bits[i] === '1') { let j = i; while (bits[j] === '1') j++; rects += `<rect x="${i}" y="0" width="${j - i}" height="30"/>`; i = j; } else i++; }
    return `<svg viewBox="0 0 ${bits.length} 30" preserveAspectRatio="none" aria-label="Barcode ${esc(text)}"><g fill="#000">${rects}</g></svg>`;
  }
  const silhouette = `<svg viewBox="0 0 80 100" aria-hidden="true"><circle cx="40" cy="34" r="17" fill="#c9c9c9"/><path d="M8 100c0-22 14-36 32-36s32 14 32 36z" fill="#c9c9c9"/><text x="40" y="96" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-size="7" font-weight="700" fill="#777" letter-spacing=".6">NO PHOTO</text></svg>`;

  /* ------------------------------------------------------------ paper: building blocks */
  const v = x => (x === undefined || x === null || x === '' ? '' : esc(x));
  const cell = (lab, val, span = 3, extra = '') => `<div class="pc p${span}${extra ? ' ' + extra : ''}"><i>${lab}</i><b>${val || '&nbsp;'}</b></div>`;
  const pg = (...cells) => `<div class="pg">${cells.join('')}</div>`;
  const bar = (t, right = '') => `<div class="pbar">${t}${right ? `<span>${right}</span>` : ''}</div>`;
  const dt = (d, t) => [fmtDate(d), fmtTime(t)].filter(Boolean).join(' ');
  const boxes = items => `<div class="pchk">${items.map(([on, l]) => `<span><span class="box${on ? ' on' : ''}"></span>${esc(l)}</span>`).join('')}</div>`;
  const generated = () => { const d = new Date(); return `${fmtDate(isoDate(d))} ${pad(d.getHours())}${pad(d.getMinutes())}`; };
  const esign = name => `<span class="es">/s/ ${esc(name)}</span>`;
  const sig = (val, lab) => `<div><div class="sig-v">${val || '&nbsp;'}</div><div class="sig-l">${lab}${String(val).includes('class="es"') ? ` · e-signed ${generated()}` : ''}</div></div>`;
  function pHead(title, sub, numLab, num, withBarcode) {
    return `<header class="ph"><div class="ph-seal">${seal()}</div><div class="ph-ag"><div class="ph-state">State of ${v(stateName(O().state))}${O().county ? ' · ' + v(O().county) : ''}</div>` +
      `<div class="ph-name">${v(O().agency)}</div><div class="ph-addr">${v(O().address)}${O().phone ? ' · ' + v(O().phone) : ''}</div><div class="ph-ori">ORI ${v(O().ori)} · ${v(O().division)} Division</div></div>` +
      `<div class="ph-form"><div class="ph-title">${title}</div><div class="ph-sub">${sub}</div><div class="ph-num"><i>${numLab}</i><b>${v(num) || '—'}</b></div>` +
      `${withBarcode && num ? `<div class="ph-bc">${barcode(num)}</div>` : ''}</div></header>`;
  }
  const pFoot = (kind, num) => `<div class="pf-wrap"><div class="pf"><span>${esc(formNo(kind))}</span><span>${esc(num || '')}</span><span>Generated ${generated()}</span></div>` +
    `<div class="pf-note">Simulated form for training and roleplay · not an official government record</div></div>`;

  /* ------------------------------------------------------------ paper: incident */
  function paperIncident() {
    const I = S.incident;
    const persons = I.persons.length ? I.persons.map((x, i) => (i ? '<div class="pgap"></div>' : '') + pg(
      cell(`Person ${i + 1} · role`, v(x.role), 2, 'tag hi'), cell('Name (last, first middle)', v(lastFirst(x)), 4), cell('Date of birth', v(fmtDate(x.dob)), 2), cell('Age', v(ageOf(x.dob)), 1),
      cell('Sex', v(x.sex), 1), cell('Race', v(x.race), 2),
      cell('Height', v(x.height), 1), cell('Weight', v(x.weight), 1), cell('Hair', v(x.hair), 1), cell('Eyes', v(x.eyes), 1), cell('Address', v(x.address), 4), cell('Phone', v(x.phone), 2),
      cell("Driver's license / state", v([x.dl, x.dlState].filter(Boolean).join(' / ')), 2),
      cell('Injury', v(x.injury), 4), cell('Medical', v(x.medical), 4), cell('Statement', v(x.statement), 4))).join('') : pg(cell('Persons', 'None listed', 12));
    const vehicles = I.vehicles.length ? I.vehicles.map((x, i) => (i ? '<div class="pgap"></div>' : '') + pg(
      cell(`Vehicle ${i + 1} · role`, v(x.role), 2, 'tag hi'), cell('Year', v(x.year), 1), cell('Make', v(x.make), 2), cell('Model', v(x.model), 2), cell('Color', v(labelOf(L.colors, x.color)), 1),
      cell('Body style', v(x.body), 2), cell('Damage', v(x.damage), 2),
      cell('Plate', v(x.plate), 2), cell('State', v(x.plateState), 1), cell('VIN', v(x.vin), 4), cell('Disposition', v(x.disp), 3), cell('Tow company', v(x.tow), 2))).join('') : pg(cell('Vehicles', 'None listed', 12));
    const prop = `<table class="pt"><thead><tr><th>#</th><th>Qty</th><th>Category</th><th>Description</th><th>Serial / ID</th><th>Status</th><th>Tag #</th><th>Stored</th><th>Value</th></tr></thead><tbody>` +
      (I.property.length ? I.property.map((x, i) => `<tr><td class="c">${i + 1}</td><td class="c">${v(x.qty)}</td><td>${v(x.cat)}</td><td>${v(x.desc)}</td><td>${v(x.serial)}</td><td>${v(x.status)}</td><td class="code">${v(x.tag)}</td><td>${v(x.stored)}</td><td class="n">${x.value ? money(x.value) : ''}</td></tr>`).join('')
        : `<tr><td colspan="9">None listed</td></tr>`) + `</tbody></table>`;
    const totalValue = I.property.reduce((a, x) => a + (parseFloat(x.value) || 0), 0);
    return `<article class="paper">` +
      `<div class="pcopy"><span>${v(O().abbr)} Records Division</span><b>Records copy</b></div>` +
      pHead('Incident Report', `${v(I.reportType || 'Original')} report`, 'Case No.', I.caseNo, true) +
      bar('1 · Report information') +
      pg(cell('Case number', v(I.caseNo), 3, 'tag'), cell('Report type', v(I.reportType), 2), cell('Reported', v(dt(I.dateReported, I.timeReported)), 2), cell('Occurred', v(dt(I.dateOccurred, I.timeOccurred)), 2),
        cell('Occurred until', v(dt(I.dateTo, I.timeTo)), 2), cell('Day', v(dayName(I.dateOccurred)), 1),
        cell('Beat / district', v(I.beat), 3), cell('Shift', v(I.shift), 3), cell('Reporting officer', v(officerLine()), 4), cell('Unit', v(O().unit), 2)) +
      bar('2 · Location') +
      pg(cell('Address / block', v(I.address), 6), cell('City', v(I.city || O().city), 3), cell('State', v(I.state || O().state), 1), cell('ZIP', v(I.zip), 2),
        cell('Location type', v(I.locType), 4), cell('Weather', v(I.weather), 4), cell('Lighting', v(I.lighting), 4)) +
      bar('3 · Classification') +
      pg(cell('Incident type', v(I.incidentType), 4, 'tag'), cell('Call source', v(I.callSource), 3), cell('Priority', v(I.priority), 3), cell('Case status', v(I.status), 2),
        cell('Disposition', v(I.disposition), 4), cell('Weapon', v(I.weapon), 3), cell('Alcohol / drugs', v(I.substance), 3), cell('DV', v(I.dv), 1), cell('Gang', v(I.gang), 1),
        cell('Offenses involved', v(I.offenses), 12)) +
      bar('4 · Involved persons', `${I.persons.length} listed`) + persons +
      bar('5 · Vehicles', `${I.vehicles.length} listed`) + vehicles +
      bar('6 · Property & evidence', `${I.property.length} item${I.property.length === 1 ? '' : 's'}${totalValue ? ' · ' + money(totalValue) : ''}`) + prop +
      bar('7 · Officer actions') + boxes(L.actions.map(([k, l]) => [I.actions[k], l])) +
      pg(cell('Use of force', v(I.force), 4), cell('Assisting units', v(I.assisting), 8)) +
      bar('8 · Narrative') + `<div class="pnarr">${v(I.narrative) || '\n\n\n\n'}</div>` +
      `<div class="ptext">I declare under penalty of perjury that the information in this report is true and correct to the best of my knowledge.</div>` +
      `<div class="psig" style="--n:4">${sig(esign(officerShort()), 'Reporting officer signature')}${sig(v(O().badge), 'Badge #')}${sig(v(fmtDate(I.dateReported)), 'Date')}` +
      `${sig(I.approval === 'Approved' && I.supervisor ? esign(I.supervisor) : I.approval && I.approval !== 'Approved' ? `<small class="pend">[ ${v(I.approval)} ]</small>` : '', `Supervisor approval${I.supervisor ? ' · ' + v(I.supervisor) : ''}${I.supervisorBadge ? ' #' + v(I.supervisorBadge) : ''}`)}</div>` +
      pFoot('incident', 'Case ' + I.caseNo) + `</article>`;
  }

  /* ------------------------------------------------------------ paper: citation */
  function paperCitation() {
    const C = S.citation, d = C.d, vh = C.v, t = citeTotals();
    const copy = S.creator.copy || 'Court copy';
    const signed = C.sign === 'Signed promise to appear' || C.sign === 'Electronically signed';
    const rows = t.lines.map((l, i) => `<tr><td class="c">${i + 1}</td><td class="code">${v(l.c.code)}</td><td>${v(l.c.title)}</td><td class="c">${l.c.kind === 'traffic' ? 'TRAF' : 'INF'}</td>` +
      `<td class="c">${v(l.o[1])}</td><td class="c">${l.c.fix ? 'YES' : '—'}</td><td class="n">${money(l.fine)}</td></tr>`).join('');
    const blanks = Math.max(0, 4 - t.lines.length);
    return `<article class="paper">` +
      `<div class="pcopy"><span>${v(O().county || O().agency)} · ${v(C.type)} citation</span><b>${v(copy)}</b></div>` +
      pHead('Notice to Appear', `${v(C.type || 'Traffic')} · infraction`, 'Citation No.', C.citeNo, true) +
      bar('Violation') +
      pg(cell('Date', v(fmtDate(C.date)), 2), cell('Time', v(fmtTime(C.time)), 1), cell('Day', v(dayName(C.date)), 1), cell('Location', v(C.address), 5), cell('City', v(C.city || O().city), 2), cell('Dir.', v(C.dir), 1),
        cell('Beat', v(C.beat), 3), cell('Speed (approx.)', v(C.speed.approx ? C.speed.approx + ' MPH' : ''), 2), cell('Posted / max', v(C.speed.posted ? C.speed.posted + ' MPH' : ''), 2), cell('Measured by', v(C.speed.method), 3), cell('Device #', v(C.speed.device), 2),
        cell('Road', v(C.cond.road), 3), cell('Traffic', v(C.cond.traffic), 3), cell('Weather', v(C.cond.weather), 3), cell('Lighting', v(C.cond.lighting), 3)) +
      bar('Driver / violator') +
      pg(cell('Name (last, first middle)', v(lastFirst(d)), 6, 'tag'), cell('Date of birth', v(fmtDate(d.dob)), 2), cell('Age', v(ageOf(d.dob)), 1), cell('Sex', v(d.sex), 1), cell('Race', v(d.race), 2),
        cell('Street address', v(d.address), 6), cell('City', v(d.city), 3), cell('State', v(d.state), 1), cell('ZIP', v(d.zip), 2),
        cell("Driver's license no.", v(d.dl), 4), cell('State', v(d.dlState), 2), cell('Class', v(d.dlClass), 4), cell('CDL', v(d.cdl), 1), cell('Hazmat', v(d.hazmat), 1),
        cell('Height', v(d.height), 2), cell('Weight', v(d.weight), 2), cell('Hair', v(d.hair), 2), cell('Eyes', v(d.eyes), 2), cell('Phone', v(d.phone), 4)) +
      bar('Vehicle') +
      pg(cell('License plate', v(vh.plate), 2, 'tag'), cell('State', v(vh.plateState), 1), cell('Year', v(vh.year), 1), cell('Make', v(vh.make), 2), cell('Model', v(vh.model), 2), cell('Color', v(labelOf(L.colors, vh.color)), 2), cell('Body', v(vh.body), 2),
        cell('VIN', v(vh.vin), 4), cell('Registered owner', v(vh.owner === 'Same as driver' ? 'Same as driver' : [vh.owner, vh.ownerName].filter(Boolean).join(' — ')), 5), cell('Commercial', v(vh.commercial), 1), cell('Hazardous materials', v(vh.hazmat), 2)) +
      bar('Violations', `${t.lines.length} charged`) +
      `<table class="pt"><thead><tr><th>#</th><th>Code section</th><th>Description of violation</th><th>Type</th><th>Offense</th><th>Correctable</th><th>Fine</th></tr></thead><tbody>${rows}` +
      `${'<tr class="blank"><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(blanks)}</tbody></table>` +
      `<div class="ptotal"><div><span>Base fines</span><b>${money(t.base)}</b></div><div><span>State surcharge ${+O().surcharge || 0}%</span><b>${money(t.sur)}</b></div>` +
      `<div><span>Court &amp; processing fee</span><b>${money(t.court)}</b></div><div class="grand"><span>Total due</span><b>${money(t.total)}</b></div></div>` +
      (t.fix ? `<div class="ptext" style="border-top:1px solid #1b1b1b;margin-top:8px"><strong>Correctable violation${t.fix > 1 ? 's' : ''}:</strong> ${t.fix} of the violations above may be dismissed if you show proof of correction, signed by an authorized officer, to the court by the appearance date and pay a ${money(O().fixFee)} fee for each.</div>` : '') +
      bar('Appearance') +
      pg(cell('Court', v(C.court || O().court), 6), cell('Court address', v(C.courtAddr || O().courtAddr), 6),
        cell('Appear on or before', v(fmtDate(C.appearDate)), 3, 'tag'), cell('Time', v(fmtTime(C.appearTime)), 2), cell('Payment', v(C.pay), 3), cell('Amount due', v(money(t.total)), 4, 'tag')) +
      `<div class="ptext"><strong>Without admitting guilt, I promise to appear at the time and place indicated above.</strong> If you do not appear or pay by the date shown, a warrant may be issued for your arrest, your driving privilege may be suspended, and a civil assessment may be added.</div>` +
      `<div class="psig" style="--n:2">${sig(signed ? esign(fullName(d)) : C.sign ? `<small class="pend">[ ${v(C.sign)} ]</small>` : '', 'Signature of violator')}${sig(v(fmtDate(C.date)), 'Date')}</div>` +
      `<div class="ptext" style="border-top:1px solid #1b1b1b;margin-top:12px">I declare under penalty of perjury that the foregoing is true and correct, and that I observed the violations listed above.</div>` +
      `<div class="psig" style="--n:4">${sig(esign(officerShort()), 'Issuing officer signature')}${sig(v(O().badge), 'Badge #')}${sig(v(O().unit), 'Unit')}${sig(v(fmtDate(C.date)), 'Date issued')}</div>` +
      (C.notes && copy !== 'Violator copy' ? bar('Officer notes', 'Not on violator copy') + `<div class="pnarr" style="min-height:60px">${v(C.notes)}</div>` : '') +
      pFoot('citation', 'Citation ' + C.citeNo) + `</article>`;
  }

  /* ------------------------------------------------------------ paper: arrest */
  function paperArrest() {
    const A = S.arrest, p = A.p, t = arrestTotals();
    const age = ageOf(p.dob);
    const rows = t.lines.map((l, i) => `<tr><td class="c">${i + 1}</td><td class="code">${v(l.c.code)}</td><td>${v(l.title)}</td><td class="c">${l.c.cls === 'F' ? 'FEL' : 'MISD'}</td>` +
      `<td class="c">${l.n}</td><td class="n">${v(monthsTxt(l.months))}</td><td class="n">${l.fine ? money0(l.fine) : '—'}</td><td class="n">${v(l.bailTxt)}</td></tr>`).join('');
    const blanks = Math.max(0, 3 - t.lines.length);
    return `<article class="paper">` +
      `<div class="pcopy"><span>${v(O().abbr)} · Jail booking packet</span><b>${A.release ? v(A.release.split(' — ')[0]) : 'In custody'}</b></div>` +
      pHead('Arrest Report', 'Booking &amp; probable cause', 'Booking No.', A.bookNo, true) +
      bar('1 · Arrest') +
      pg(cell('Booking number', v(A.bookNo), 3, 'tag'), cell('Related case #', v(A.caseNo || S.incident.caseNo), 3), cell('Arrest date', v(fmtDate(A.date)), 2), cell('Time', v(fmtTime(A.time)), 1), cell('Arrest type', v(A.type), 3),
        cell('Arrest location', v(A.address), 6), cell('City', v(A.city || O().city), 3), cell('Beat', v(A.beat), 3),
        cell('Warrant #', v(A.warrant), 3), cell('Arresting officer', v(officerLine()), 5), cell('Unit', v(O().unit), 2), cell('Division', v(O().division), 2)) +
      bar('2 · Arrestee') +
      `<div class="pg"><div class="pphoto">${A.photo ? `<img src="${A.photo}" alt="Booking photo">` : silhouette}</div>` +
      cell('Name (last, first middle)', v(lastFirst(p)), 6, 'tag') + cell('AKA / aliases', v(p.aka), 3) +
      cell('Date of birth', v(fmtDate(p.dob)), 2) + cell('Age', v(age), 1) + cell('Sex', v(p.sex), 1) + cell('Race', v(p.race), 1) + cell('Height', v(p.height), 1) + cell('Weight', v(p.weight), 1) + cell('Build', v(p.build), 2) +
      cell('Hair', v(p.hair), 2) + cell('Eyes', v(p.eyes), 2) + cell('Complexion', v(p.complexion), 2) + cell('Facial hair', v(p.facial), 3) +
      cell('Scars, marks, tattoos', v(p.smt), 9) +
      cell('Street address', v(p.address), 6) + cell('City', v(p.city), 3) + cell('State', v(p.state), 1) + cell('ZIP', v(p.zip), 2) +
      cell('Phone', v(p.phone), 2) + cell('Place of birth', v(p.pob), 3) + cell('Occupation', v(p.occupation), 3) + cell('Employer', v(p.employer), 4) +
      cell("Driver's license", v(p.dl), 4) + cell('DL state', v(p.dlState), 2) + cell('Gang affiliation', v(p.gang), 4) + cell('Juvenile', age === '' ? '' : age < 18 ? 'YES' : 'NO', 2) + `</div>` +
      bar('3 · Charges', `${t.lines.length} charge${t.lines.length === 1 ? '' : 's'} · ${t.counts} count${t.counts === 1 ? '' : 's'}`) +
      `<table class="pt"><thead><tr><th>#</th><th>Code section</th><th>Charge</th><th>Class</th><th>Cts</th><th>Max term</th><th>Max fine</th><th>Bail</th></tr></thead><tbody>${rows}` +
      `${'<tr class="blank"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>'.repeat(blanks)}</tbody></table>` +
      (t.enh.length ? `<div class="ptext"><strong>Enhancements alleged:</strong> ${t.enh.map(e => `${esc(e[1])} (+${monthsTxt(e[2])})`).join(' · ')}</div>` : '') +
      `<div class="ptotal"><div><span>Highest class</span><b>${t.top}</b></div><div><span>Total max fines</span><b>${money0(t.fine)}</b></div>` +
      `<div><span>Max exposure (consecutive)</span><b>${exposureTxt(t)}</b></div><div class="grand"><span>Total bail</span><b>${t.noBail ? 'NO BAIL' : money0(t.bail)}</b></div></div>` +
      bar('4 · Custody & processing') +
      pg(cell('Miranda advised', v(A.miranda), 3), cell('Time', v(fmtTime(A.mirandaTime)), 2), cell('Advised by', v(A.advisedBy || (A.miranda === 'Yes' ? officerLine() : '')), 4), cell('Rights', v(A.rights), 3),
        cell('Search incident to arrest', v(A.search), 4), cell('Restraints', v(A.restraints), 4), cell('Use of force', v(A.force), 4),
        cell('Injuries', v(A.injuries), 4), cell('Medical clearance', v(A.medical), 4), cell('Transported by', v(A.transport), 4),
        cell('Booked at', v(A.facility), 4, 'tag'), cell('Holds', v(A.hold), 4), cell('Release status', v(A.release), 4, 'tag'),
        cell('Vehicle', v(A.vehDisp), 4), cell('Tow company', v(A.tow), 3), cell('Property stored', v(A.propertyStored), 5)) +
      bar('5 · Probable cause declaration') + `<div class="pnarr">${v(A.pc) || '\n\n\n\n'}</div>` +
      `<div class="ptext">I declare under penalty of perjury that the foregoing is true and correct, and that the facts above establish probable cause for the arrest of the person named.</div>` +
      `<div class="psig" style="--n:3">${sig(esign(officerShort()), `Arresting officer · #${v(O().badge)}`)}${sig(A.bookingOfficer ? `<span>${v(A.bookingOfficer)}</span>` : '', 'Booking officer')}` +
      `${sig(A.supervisor ? `<span>${v(A.supervisor)}</span>` : '', `Approving supervisor${A.supervisorBadge ? ' · #' + v(A.supervisorBadge) : ''}`)}</div>` +
      (A.assisting ? `<div class="ptext" style="border-top:1px solid #1b1b1b;margin-top:10px"><strong>Assisting officers:</strong> ${v(A.assisting)}</div>` : '') +
      pFoot('arrest', 'Booking ' + A.bookNo) + `</article>`;
  }

  /* ------------------------------------------------------------ paper: packet cover */
  function paperCover() {
    const I = S.incident, C = S.citation, A = S.arrest;
    const ct = citeTotals(), at = arrestTotals();
    return `<article class="paper cover"><div class="cv-seal">${seal()}</div><div class="ph-state" style="margin-top:14px">State of ${v(stateName(O().state))}${O().county ? ' · ' + v(O().county) : ''}</div>` +
      `<div class="ph-name">${v(O().agency)}</div><h2>Case Packet</h2><div class="cv-num">${v(I.caseNo)}</div>` +
      `<table class="pt"><thead><tr><th>Doc</th><th>Form</th><th>Number</th><th>Summary</th></tr></thead><tbody>` +
      `<tr><td class="c">1</td><td>Incident report</td><td class="code">${v(I.caseNo)}</td><td>${v(I.incidentType)}${I.disposition ? ' · ' + v(I.disposition) : ''}</td></tr>` +
      `<tr><td class="c">2</td><td>Notice to appear</td><td class="code">${v(C.citeNo)}</td><td>${ct.lines.length} violation${ct.lines.length === 1 ? '' : 's'} · ${money(ct.total)} due</td></tr>` +
      `<tr><td class="c">3</td><td>Arrest report</td><td class="code">${v(A.bookNo)}</td><td>${at.lines.length} charge${at.lines.length === 1 ? '' : 's'} · ${at.top} · bail ${at.noBail ? 'none' : money0(at.bail)}</td></tr></tbody></table>` +
      `<table class="pt"><tbody><tr><th style="width:34%">Subject</th><td>${v(lastFirst(A.p) || lastFirst(C.d))}</td></tr><tr><th>Date of incident</th><td>${v(fmtDate(I.dateOccurred))}</td></tr>` +
      `<tr><th>Location</th><td>${v([I.address, I.city || O().city].filter(Boolean).join(', '))}</td></tr><tr><th>Prepared by</th><td>${v(officerLine())} · Unit ${v(O().unit)}</td></tr>` +
      `<tr><th>Distribution</th><td>Records · Court · District Attorney</td></tr></tbody></table>` +
      pFoot('packet', 'Case ' + I.caseNo) + `</article>`;
  }
  function papers(doc) {
    sealN = 0;
    if (doc === 'incident') return paperIncident();
    if (doc === 'citation') return paperCitation();
    if (doc === 'arrest') return paperArrest();
    return paperCover() + paperIncident() + paperCitation() + paperArrest();
  }

  /* ------------------------------------------------------------ form creator view */
  const DOCS = [['incident', 'Incident report'], ['citation', 'Citation'], ['arrest', 'Arrest report'], ['packet', 'Full case packet']];
  function missingFor(doc) {
    const list = doc === 'packet' ? ['incident', 'citation', 'arrest'].flatMap(k => missing(k).filter(m => m.view === k)).concat(missing('incident').filter(m => m.view === 'setup')) : missing(doc);
    return list;
  }
  function noticeHTML(doc) {
    const miss = missingFor(doc);
    return miss.length ? `<div class="notice" id="notice"><b>${miss.length} required box${miss.length > 1 ? 'es are' : ' is'} empty:</b> ${miss.map(m =>
      `<button type="button" class="chipbtn" data-act="goto" data-view="${m.view}" data-path="${esc(m.path)}" data-sec="${esc(m.sec)}">${esc(m.label)}</button>`).join('')}<span class="muted">They print as blank boxes.</span></div>`
      : `<div class="notice ok" id="notice"><b>Complete.</b>&nbsp;Every required box is filled in and the form is signed.</div>`;
  }
  function viewForms() {
    const d = S.creator.doc;
    const showCopy = d === 'citation' || d === 'packet';
    return `<div class="doc-h"><div><div class="eyebrow">Form creator</div><h1>Formal forms</h1><div class="doc-meta"><span>Your entries, set as finished, signed paperwork</span></div></div>` +
      `<div class="doc-actions">${btn('copytext', 'Copy as text', { cls: 'pri' })}${d !== 'packet' ? btn('nav', '← Edit this form', { data: { view: d } }) : ''}</div></div>` +
      `<div class="creator-bar"><div class="seg" role="group" aria-label="Document">${DOCS.map(([k, l]) => `<button type="button" data-act="doc" data-doc="${k}" aria-pressed="${k === d}">${l}</button>`).join('')}</div>` +
      (showCopy ? `<label class="fld inline"><span>Citation copy</span><select id="f-creator-copy" data-b="creator.copy">${['Court copy', 'Violator copy', 'Agency copy'].map(c => `<option${c === S.creator.copy ? ' selected' : ''}>${c}</option>`).join('')}</select></label>` : '') +
      `</div>${noticeHTML(d)}<div class="sheets" id="sheets">${papers(d)}</div>`;
  }
  function fitPapers() {
    const wrap = $('#sheets'); if (!wrap) return;
    const z = Math.min(1, wrap.clientWidth / 816);
    for (const p of $$('.paper', wrap)) p.style.zoom = z < 1 ? z.toFixed(4) : '';
  }

  /* ------------------------------------------------------------ plain text */
  function TX() {
    const out = [];
    const W = 72;
    return {
      head(t, sub) { out.push('='.repeat(W), (O().agency || '').toUpperCase(), t.toUpperCase() + (sub ? '  ·  ' + sub : ''), '='.repeat(W)); },
      sec(t) { out.push('', `-- ${t.toUpperCase()} ${'-'.repeat(Math.max(2, W - t.length - 4))}`); },
      f(l, x) { if (x !== undefined && x !== null && String(x).trim() !== '') out.push(`${(l + ':').padEnd(26)}${x}`); },
      p(t) { out.push(t); },
      blank() { out.push(''); },
      done() { return out.join('\n') + '\n'; }
    };
  }
  function txtIncident(t) {
    const I = S.incident;
    t.head('Incident Report', `Case ${I.caseNo}`);
    t.sec('Report information'); t.f('Case number', I.caseNo); t.f('Report type', I.reportType); t.f('Reported', dt(I.dateReported, I.timeReported)); t.f('Occurred', dt(I.dateOccurred, I.timeOccurred));
    t.f('Occurred until', dt(I.dateTo, I.timeTo)); t.f('Beat', I.beat); t.f('Shift', I.shift); t.f('Reporting officer', `${officerLine()} · Unit ${O().unit}`);
    t.sec('Location'); t.f('Address', I.address); t.f('City / state', [I.city || O().city, I.state || O().state, I.zip].filter(Boolean).join(', ')); t.f('Location type', I.locType); t.f('Weather', I.weather); t.f('Lighting', I.lighting);
    t.sec('Classification'); t.f('Incident type', I.incidentType); t.f('Call source', I.callSource); t.f('Priority', I.priority); t.f('Disposition', I.disposition); t.f('Status', I.status);
    t.f('Weapon', I.weapon); t.f('Alcohol / drugs', I.substance); t.f('Domestic violence', I.dv); t.f('Gang related', I.gang); t.f('Offenses', I.offenses);
    t.sec(`Involved persons (${I.persons.length})`);
    I.persons.forEach((x, i) => { t.p(`${i + 1}. ${(x.role || 'Involved').toUpperCase()} — ${lastFirst(x)}`); t.f('   DOB / age', [fmtDate(x.dob), ageOf(x.dob)].filter(String).join(' / ')); t.f('   Sex / race', [x.sex, x.race].filter(Boolean).join(' / '));
      t.f('   Ht / wt / hair / eyes', [x.height, x.weight, x.hair, x.eyes].filter(Boolean).join(' / ')); t.f('   Address', x.address); t.f('   Phone', x.phone); t.f('   DL', [x.dl, x.dlState].filter(Boolean).join(' ')); t.f('   Injury / medical', [x.injury, x.medical].filter(Boolean).join(' / ')); t.f('   Statement', x.statement); });
    t.sec(`Vehicles (${I.vehicles.length})`);
    I.vehicles.forEach((x, i) => { t.p(`${i + 1}. ${(x.role || 'Vehicle').toUpperCase()} — ${[x.year, labelOf(L.colors, x.color), x.make, x.model, x.body].filter(Boolean).join(' ')}`); t.f('   Plate', [x.plateState, x.plate].filter(Boolean).join(' ')); t.f('   VIN', x.vin); t.f('   Damage', x.damage); t.f('   Disposition', [x.disp, x.tow].filter(Boolean).join(' — ')); });
    t.sec(`Property & evidence (${I.property.length})`);
    I.property.forEach((x, i) => t.p(`${i + 1}. [${x.status || '—'}] ${x.qty || 1} x ${x.desc || x.cat}${x.serial ? ' · S/N ' + x.serial : ''}${x.tag ? ' · tag ' + x.tag : ''}${x.stored ? ' · ' + x.stored : ''}${x.value ? ' · ' + money(x.value) : ''}`));
    t.sec('Officer actions'); L.actions.filter(([k]) => I.actions[k]).forEach(([, l]) => t.p(`[X] ${l}`)); t.f('Use of force', I.force); t.f('Assisting units', I.assisting);
    t.sec('Narrative'); t.p(I.narrative || '(none)');
    t.blank(); t.f('Signed', `/s/ ${officerShort()} #${O().badge}  ${fmtDate(I.dateReported)}`); t.f('Supervisor', [I.supervisor, I.supervisorBadge ? '#' + I.supervisorBadge : '', I.approval].filter(Boolean).join(' · '));
  }
  function txtCitation(t) {
    const C = S.citation, d = C.d, vh = C.v, tt = citeTotals();
    t.head('Notice to Appear', `Citation ${C.citeNo} · ${S.creator.copy || 'Court copy'}`);
    t.sec('Violation'); t.f('Date / time', `${fmtDate(C.date)} ${fmtTime(C.time)} (${dayName(C.date)})`); t.f('Location', [C.address, C.city || O().city].filter(Boolean).join(', ')); t.f('Direction', C.dir); t.f('Beat', C.beat);
    t.f('Speed', C.speed.approx ? `${C.speed.approx} mph in a ${C.speed.posted || '?'} mph zone${C.speed.method ? ' · ' + C.speed.method : ''}${C.speed.device ? ' #' + C.speed.device : ''}` : '');
    t.f('Conditions', [C.cond.road, C.cond.traffic, C.cond.weather, C.cond.lighting].filter(Boolean).join(' / '));
    t.sec('Driver / violator'); t.f('Name', lastFirst(d)); t.f('DOB / age', [fmtDate(d.dob), ageOf(d.dob)].filter(String).join(' / ')); t.f('Sex / race', [d.sex, d.race].filter(Boolean).join(' / '));
    t.f('Ht / wt / hair / eyes', [d.height, d.weight, d.hair, d.eyes].filter(Boolean).join(' / ')); t.f('Address', [d.address, d.city, d.state, d.zip].filter(Boolean).join(', ')); t.f('Phone', d.phone);
    t.f("Driver's license", [d.dl, d.dlState, d.dlClass].filter(Boolean).join(' · ')); t.f('Commercial / hazmat', `${d.cdl || 'No'} / ${d.hazmat || 'No'}`);
    t.sec('Vehicle'); t.f('Plate', [vh.plateState, vh.plate].filter(Boolean).join(' ')); t.f('Vehicle', [vh.year, labelOf(L.colors, vh.color), vh.make, vh.model, vh.body].filter(Boolean).join(' ')); t.f('VIN', vh.vin);
    t.f('Registered owner', vh.owner === 'Same as driver' ? vh.owner : [vh.owner, vh.ownerName].filter(Boolean).join(' — '));
    t.sec('Violations');
    tt.lines.forEach((l, i) => t.p(`${String(i + 1).padStart(2)}. ${l.c.code.padEnd(11)} ${l.c.title}${l.o[2] > 1 ? ` (${l.o[1]} offense)` : ''}${l.c.fix ? ' [correctable]' : ''}`.padEnd(60) + money(l.fine).padStart(12)));
    t.blank(); t.f('Base fines', money(tt.base)); t.f(`State surcharge ${+O().surcharge || 0}%`, money(tt.sur)); t.f('Court & processing fee', money(tt.court)); t.f('TOTAL DUE', money(tt.total));
    t.sec('Appearance'); t.f('Court', C.court || O().court); t.f('Address', C.courtAddr || O().courtAddr); t.f('Appear on or before', `${fmtDate(C.appearDate)} ${fmtTime(C.appearTime)}`); t.f('Payment', C.pay);
    t.blank(); t.p('WITHOUT ADMITTING GUILT, I PROMISE TO APPEAR AT THE TIME AND PLACE INDICATED ABOVE.'); t.f('Violator', C.sign); t.f('Issuing officer', `/s/ ${officerShort()} #${O().badge} · Unit ${O().unit}`);
    if (C.notes && S.creator.copy !== 'Violator copy') { t.sec('Officer notes'); t.p(C.notes); }
  }
  function txtArrest(t) {
    const A = S.arrest, p = A.p, tt = arrestTotals();
    t.head('Arrest Report', `Booking ${A.bookNo}`);
    t.sec('Arrest'); t.f('Booking number', A.bookNo); t.f('Related case', A.caseNo || S.incident.caseNo); t.f('Date / time', `${fmtDate(A.date)} ${fmtTime(A.time)}`); t.f('Location', [A.address, A.city || O().city].filter(Boolean).join(', '));
    t.f('Arrest type', A.type); t.f('Warrant #', A.warrant); t.f('Arresting officer', `${officerLine()} · Unit ${O().unit}`);
    t.sec('Arrestee'); t.f('Name', lastFirst(p)); t.f('AKA', p.aka); t.f('DOB / age', [fmtDate(p.dob), ageOf(p.dob)].filter(String).join(' / ')); t.f('Sex / race', [p.sex, p.race].filter(Boolean).join(' / '));
    t.f('Ht / wt / build', [p.height, p.weight, p.build].filter(Boolean).join(' / ')); t.f('Hair / eyes', [p.hair, p.eyes].filter(Boolean).join(' / ')); t.f('Complexion / facial hair', [p.complexion, p.facial].filter(Boolean).join(' / '));
    t.f('Scars, marks, tattoos', p.smt); t.f('Address', [p.address, p.city, p.state, p.zip].filter(Boolean).join(', ')); t.f('Phone', p.phone); t.f('Place of birth', p.pob); t.f('Occupation', [p.occupation, p.employer].filter(Boolean).join(' · '));
    t.f("Driver's license", [p.dl, p.dlState].filter(Boolean).join(' ')); t.f('Gang affiliation', p.gang);
    t.sec('Charges');
    tt.lines.forEach((l, i) => t.p(`${String(i + 1).padStart(2)}. ${l.c.code.padEnd(10)} ${l.c.cls === 'F' ? 'FEL ' : 'MISD'}  ${l.title}${l.n > 1 ? ` x${l.n}` : ''}  ·  ${monthsTxt(l.months)}  ·  bail ${l.bailTxt}`));
    tt.enh.forEach(e => t.p(`    + ${e[1]} (+${monthsTxt(e[2])})`));
    t.blank(); t.f('Highest class', tt.top); t.f('Total max fines', money0(tt.fine)); t.f('Max exposure', exposureTxt(tt)); t.f('TOTAL BAIL', tt.noBail ? 'NO BAIL' : money0(tt.bail));
    t.sec('Custody & processing'); t.f('Miranda', [A.miranda, fmtTime(A.mirandaTime), A.advisedBy].filter(Boolean).join(' · ')); t.f('Rights', A.rights); t.f('Search', A.search); t.f('Restraints', A.restraints);
    t.f('Use of force', A.force); t.f('Injuries', A.injuries); t.f('Medical', A.medical); t.f('Transported by', A.transport); t.f('Booked at', A.facility); t.f('Holds', A.hold); t.f('Release status', A.release);
    t.f('Vehicle', [A.vehDisp, A.tow].filter(Boolean).join(' — ')); t.f('Property stored', A.propertyStored);
    t.sec('Probable cause declaration'); t.p(A.pc || '(none)');
    t.blank(); t.f('Signed', `/s/ ${officerShort()} #${O().badge}`); t.f('Assisting', A.assisting); t.f('Booking officer', A.bookingOfficer); t.f('Supervisor', [A.supervisor, A.supervisorBadge ? '#' + A.supervisorBadge : ''].filter(Boolean).join(' '));
  }
  function textFor(doc) {
    const t = TX();
    const run = { incident: txtIncident, citation: txtCitation, arrest: txtArrest };
    if (doc === 'packet') { ['incident', 'citation', 'arrest'].forEach((k, i) => { if (i) { t.blank(); t.blank(); } run[k](t); }); }
    else run[doc](t);
    t.blank(); t.p('Simulated form for training and roleplay. Not an official government record.');
    return t.done();
  }
  function copyText(txt) {
    const fallback = () => { const m = $('#modal'); $('#modalText').value = txt; m.hidden = false; const ta = $('#modalText'); ta.focus(); ta.select(); };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(() => toast('Copied the form as plain text'), fallback);
      else fallback();
    } catch { fallback(); }
  }

  /* ------------------------------------------------------------ rendering */
  function keepFocus(fn) {
    const a = document.activeElement;
    const id = a && a.id;
    let s = null, e = null;
    try { if (a && 'selectionStart' in a) { s = a.selectionStart; e = a.selectionEnd; } } catch { s = null; }
    fn();
    if (id) { const n = document.getElementById(id); if (n && n !== a) { n.focus({ preventScroll: true }); try { if (s != null && 'setSelectionRange' in n) n.setSelectionRange(s, e); } catch { /* not a text field */ } } }
  }
  const VIEWS = { incident: viewIncident, citation: viewCitation, arrest: viewArrest, forms: viewForms, setup: viewSetup };
  function render() {
    const view = S.view;
    for (const b of $$('.nav')) b.setAttribute('aria-current', b.dataset.view === view ? 'page' : 'false');
    $('#main').innerHTML = VIEWS[view]();
    if (view === 'forms') fitPapers();
    updateNav(); updateTopbar();
    document.title = 'Police Form Maker';
  }
  function go(view, after) {
    if (!VIEWS[view]) return;
    S.view = view;
    if (location.hash !== '#' + view) { try { history.replaceState(null, '', '#' + view); } catch { /* sandboxed */ } }
    render(); save();
    if (after) after(); else window.scrollTo(0, 0);
  }
  function updateTopbar() {
    $('#tbAgency').textContent = O().agency || 'Police Department';
    $('#tbUnit').textContent = O().unit || '—';
    $('#tbOfficer').textContent = `${officerLine()}`;
    sealN = 0;
    $('#tbSeal').innerHTML = seal();
    const st = $('#tbStatus');
    if (!st.options.length) st.innerHTML = L.statusCodes.map(([k, l]) => `<option value="${k}">${l}</option>`).join('');
    st.value = S.status || '10-8';
    $('#tbLed').dataset.s = st.value;
  }
  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function arm(b, label) {
    if (b.dataset.armed === '1') { b.dataset.armed = ''; b.classList.remove('armed'); return true; }
    const old = b.innerHTML; b.dataset.armed = '1'; b.classList.add('armed'); b.textContent = label;
    setTimeout(() => { if (b.isConnected && b.dataset.armed === '1') { b.dataset.armed = ''; b.classList.remove('armed'); b.innerHTML = old; } }, 3500);
    return false;
  }
  const hasData = () => S.incident.persons.length || S.incident.narrative || S.citation.charges.length || S.arrest.charges.length || S.citation.d.last || S.arrest.p.last;

  /* ------------------------------------------------------------ input handling */
  function onChanged(p, el, isChange) {
    let m;
    if ((m = p.match(/^incident\.(persons|vehicles|property)\.(\d+)\./))) {
      const s = $(`#sum-${m[1]}-${m[2]}`); if (s) s.textContent = repSummary(m[1], S.incident[m[1]][+m[2]]);
    } else if ((m = p.match(/^citation\.charges\.(\d+)\./))) {
      const t = citeTotals(); const a = $('#cl-' + m[1]); if (a) a.textContent = money(t.lines[+m[1]].fine);
      const box = $('#citeTotals'); if (box) box.outerHTML = citeTotalsHTML(t);
    } else if ((m = p.match(/^arrest\.charges\.(\d+)\./))) {
      const t = arrestTotals(); const l = t.lines[+m[1]]; const a = $('#al-' + m[1]); if (a && l) a.textContent = `${monthsTxt(l.months)} · ${l.bailTxt}`;
      const box = $('#arrTotals'); if (box) box.outerHTML = arrestTotalsHTML(t);
      if (isChange && p.endsWith('.count')) { S.arrest.charges[+m[1]].count = l ? l.n : 1; el.value = l ? l.n : 1; }
    } else if (p.startsWith('arrest.enh.')) {
      const box = $('#arrTotals'); if (box) box.outerHTML = arrestTotalsHTML(arrestTotals());
    } else if (p === 'arrest.p.dob') {
      const o = $('#ageOut'); const a = ageOf(S.arrest.p.dob); if (o) o.textContent = a === '' ? '' : `${a}${a < 18 ? ' — juvenile' : ''}`;
    } else if (p.startsWith('officer.')) {
      updateTopbar();
    } else if (p === 'creator.copy') {
      const sh = $('#sheets'); if (sh) { sh.innerHTML = papers(S.creator.doc); fitPapers(); }
    }
    if (/\.(caseNo|citeNo|bookNo)$/.test(p) && p.split('.').length === 2) { const n = $('#docNum'); if (n) n.textContent = el.value; }
  }
  function handleField(e) {
    const el = e.target;
    const p = el.dataset && el.dataset.b; if (!p) return;
    const val = el.type === 'checkbox' ? el.checked : el.value;
    if (e.type === 'change' && el.type !== 'checkbox' && el.tagName !== 'SELECT' && !/\.count$/.test(p)) return;
    if (e.type === 'change' && get(S, p) === val && !/\.count$/.test(p)) return;
    setp(S, p, val);
    if (S.example && !p.startsWith('creator.')) { /* keep banner until dismissed */ }
    onChanged(p, el, e.type === 'change');
    save();
  }
  document.addEventListener('input', e => {
    const el = e.target;
    if (el.id === 'cp-q') { S.ui.cp[S.view].q = el.value; refreshPanelList(); save(); return; }
    handleField(e);
  });
  document.addEventListener('change', e => {
    const el = e.target;
    if (el.id === 'tbStatus') { S.status = el.value; $('#tbLed').dataset.s = el.value; save(); toast(`Status: ${labelOf(L.statusCodes, el.value)}`); return; }
    if (el.id === 'cp-cat') { S.ui.cp[S.view].cat = el.value; refreshPanelList(); save(); return; }
    if (el.dataset && el.dataset.phrase) { insertPhrase(el); return; }
    if (el.id === 'photoIn') { loadPhoto(el.files && el.files[0]); return; }
    handleField(e);
  });
  document.addEventListener('keydown', e => {
    const el = e.target;
    if (el.id === 'cp-q' && e.key === 'Enter') {
      e.preventDefault();
      const first = $('#cp-list .cp-row'); if (first) addCharge(S.view, first.dataset.id);
      return;
    }
    if (el.id === 'cp-q' && e.key === 'ArrowDown') { e.preventDefault(); const first = $('#cp-list .cp-row'); if (first) first.focus(); return; }
    if (el.classList && el.classList.contains('cp-row') && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault(); const sib = e.key === 'ArrowDown' ? el.nextElementSibling : el.previousElementSibling; if (sib) sib.focus(); else if (e.key === 'ArrowUp') $('#cp-q').focus(); return;
    }
    if (e.key === 'Escape') {
      if (!$('#modal').hidden) { $('#modal').hidden = true; return; }
      const cp = $('#cpanel'); if (cp && cp.classList.contains('open')) { cp.classList.remove('open'); return; }
    }
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(el.tagName) && $('#cp-q')) { e.preventDefault(); openPanel(); }
  });
  function insertPhrase(sel) {
    const i = sel.value; if (i === '') return;
    const ta = document.getElementById(sel.dataset.phrase); if (!ta) return;
    const phrase = L.phrases[+i];
    const s = ta.selectionStart ?? ta.value.length, e = ta.selectionEnd ?? ta.value.length;
    const before = ta.value.slice(0, s), after = ta.value.slice(e);
    const lead = before && !/\s$/.test(before) ? ' ' : '';
    ta.value = before + lead + phrase + (after && !/^\s/.test(after) ? ' ' : '') + after;
    const pos = (before + lead + phrase).length;
    ta.focus(); try { ta.setSelectionRange(pos, pos); } catch { /* ignore */ }
    setp(S, ta.dataset.b, ta.value); save();
    sel.value = '';
  }
  function loadPhoto(file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) { toast('That file is not an image. Choose a JPG or PNG photo.'); return; }
    const fr = new FileReader();
    fr.onload = () => {
      const img = new Image();
      img.onload = () => {
        const W = 240, H = 300, c = document.createElement('canvas'); c.width = W; c.height = H;
        const g = c.getContext('2d'); const r = Math.max(W / img.width, H / img.height);
        const w = img.width * r, h = img.height * r;
        g.fillStyle = '#ddd'; g.fillRect(0, 0, W, H); g.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
        S.arrest.photo = c.toDataURL('image/jpeg', 0.82);
        save(); render(); toast('Booking photo added');
      };
      img.onerror = () => toast('That image could not be read. Try a different photo.');
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  }
  function openPanel() {
    const cp = $('#cpanel'); if (!cp) return;
    cp.classList.add('open');
    const q = $('#cp-q');
    if (getComputedStyle(cp).position !== 'fixed') cp.scrollIntoView({ block: 'nearest' });
    if (q) { q.focus(); q.select(); }
  }

  /* ------------------------------------------------------------ actions */
  const NUMS = { case: () => `${yy()}-${digits(6)}`, cite: () => `T${digits(7)}`, book: () => `B${yy()}-${digits(5)}` };
  const BLANK = { incident: blankIncident, citation: blankCitation, arrest: blankArrest };
  const ACT = {
    nav: b => { go(b.dataset.view); },
    theme: () => { const order = ['auto', 'light', 'dark']; const cur = getTheme(); setTheme(order[(order.indexOf(cur) + 1) % 3]); },
    example: b => {
      if (hasData() && !S.example && !arm(b, 'Replace all 3 forms?')) return;
      Object.assign(S, exampleCase()); S.example = true; save(); render(); toast('Example case loaded into all three forms');
    },
    clear: b => {
      const f = b.dataset.form; if (!arm(b, 'Click again to clear')) return;
      S[f] = BLANK[f](); if (f === 'citation' || f === 'arrest') S.ui.cp[f].q = '';
      S.example = false; save(); render(); toast('Form cleared');
    },
    clearAll: b => {
      if (!arm(b, 'Click again to clear all')) return;
      S.incident = blankIncident(); S.citation = blankCitation(); S.arrest = blankArrest(); S.example = false;
      S.ui.cp.citation.q = ''; S.ui.cp.arrest.q = '';
      save(); render(); toast('All three forms are blank');
    },
    dismissBanner: () => { S.example = false; save(); render(); },
    generate: b => { S.creator.doc = b.dataset.doc; go('forms'); },
    newnum: b => { setp(S, b.dataset.path, NUMS[b.dataset.fmt]()); save(); render(); toast('New number assigned'); },
    usecase: () => { S.arrest.caseNo = S.incident.caseNo; save(); render(); toast(`Linked to case ${S.incident.caseNo}`); },
    add: b => {
      const path = b.dataset.list; const list = get(S, path);
      const kind = path.split('.')[1];
      list.push(kind === 'persons' ? blankPerson() : kind === 'vehicles' ? blankVehicle() : blankItem());
      save(); render();
      const card = $(`#rep-${kind}-${list.length - 1}`);
      if (card) { card.scrollIntoView({ block: 'center' }); const f = $('select,input', card); if (f) f.focus({ preventScroll: true }); card.classList.add('flash'); }
    },
    del: b => { const list = get(S, b.dataset.list); const i = +b.dataset.i; list.splice(i, 1); save(); const y = window.scrollY; render(); window.scrollTo(0, y); toast('Removed'); },
    'gen-narr': b => {
      const f = b.dataset.form; const path = f === 'incident' ? 'incident.narrative' : 'arrest.pc';
      const cur = get(S, path) || '';
      if (cur.trim() && !arm(b, 'Replace what you wrote?')) return;
      const text = f === 'incident' ? draftIncident() : draftArrest();
      setp(S, path, text); const ta = document.getElementById(fid(path)); if (ta) { ta.value = text; ta.focus(); ta.scrollTop = 0; }
      save(); toast('Draft written. Add the details of your investigation.');
    },
    import: b => {
      const { form, what } = b.dataset; const s = $(`#imp-${form}-${what}`); if (!s) return;
      const i = +s.value;
      if (what === 'vehicle') {
        const x = S.incident.vehicles[i]; if (!x) return;
        Object.assign(S.citation.v, { plate: x.plate, plateState: x.plateState, year: x.year, make: x.make, model: x.model, color: x.color, body: x.body, vin: x.vin });
      } else {
        const x = S.incident.persons[i]; if (!x) return;
        const tgt = form === 'citation' ? S.citation.d : S.arrest.p;
        for (const k of ['last', 'first', 'middle', 'dob', 'sex', 'race', 'height', 'weight', 'hair', 'eyes', 'phone', 'dl', 'dlState']) tgt[k] = x[k] || '';
        tgt.address = x.address || '';
        if (form === 'arrest' && !S.arrest.caseNo) S.arrest.caseNo = S.incident.caseNo;
      }
      save(); const y = window.scrollY; render(); window.scrollTo(0, y); toast('Copied from the incident report');
    },
    openpanel: () => openPanel(),
    closepanel: () => { const cp = $('#cpanel'); if (cp) cp.classList.remove('open'); const s = $('#sec-' + S.view + (S.view === 'citation' ? '-5' : '-3')); if (s) s.scrollIntoView({ block: 'start' }); },
    'cp-kind': b => { const ui = S.ui.cp.citation; ui.kind = b.dataset.kind; ui.cat = ''; save(); refreshPanel(); },
    charge: b => addCharge(S.view, b.dataset.id),
    'rm-charge': b => { const f = b.dataset.form; const [r] = S[f].charges.splice(+b.dataset.i, 1); refreshCharges(); refreshPanelList(); save(); const c = r && BY.get(r.id); if (c) toast(`Removed ${c.code}`); },
    'rm-photo': () => { S.arrest.photo = ''; save(); render(); },
    doc: b => { S.creator.doc = b.dataset.doc; save(); render(); },
    copytext: () => copyText(textFor(S.creator.doc)),
    goto: b => {
      const { view, path, sec: secId } = b.dataset;
      go(view, () => {
        const el = path ? document.getElementById(fid(path)) : null;
        const target = el || (secId ? document.getElementById(secId) : null);
        if (!target) return;
        target.scrollIntoView({ block: 'center' });
        if (el) el.focus({ preventScroll: true });
        const box = el ? el.closest('.fld') || el : target; box.classList.remove('flash'); void box.offsetWidth; box.classList.add('flash');
      });
    },
    'modal-close': () => { $('#modal').hidden = true; }
  };
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const f = ACT[b.dataset.act]; if (f) f(b, e);
  });
  $('#modal').addEventListener('click', e => { if (e.target.id === 'modal') e.currentTarget.hidden = true; });

  /* ------------------------------------------------------------ theme & clock */
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'auto'; } catch { return 'auto'; } }
  function setTheme(t) {
    try { localStorage.setItem(THEME_KEY, t); } catch { /* storage off */ }
    applyTheme(t);
    toast(t === 'auto' ? 'Display follows your device' : t === 'dark' ? 'Night mode' : 'Day mode');
  }
  function applyTheme(t = getTheme()) {
    const r = document.documentElement;
    if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
    $('#themeBtn').textContent = t === 'auto' ? 'Auto' : t === 'dark' ? 'Night' : 'Day';
  }
  function tick() {
    const d = new Date();
    $('#clock').textContent = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
    $('#clockDate').textContent = `${dayName(isoDate(d))} ${fmtDate(isoDate(d))}`;
  }

  /* ------------------------------------------------------------ boot */
  function boot(data) {
    const fromHot = data && data.S;
    const stored = fromHot ? null : loadStored();
    if (fromHot) S = normalize(data.S);
    else if (stored) S = normalize(stored);
    else { S = defaults(); Object.assign(S, exampleCase()); S.example = true; }
    const h = (location.hash || '').slice(1);
    if (VIEWS[h]) S.view = h;
    applyTheme(); tick(); setInterval(tick, 1000);
    render();
    if (!stored && !fromHot) save();
    window.addEventListener('resize', () => { clearTimeout(boot.rz); boot.rz = setTimeout(fitPapers, 80); });
    window.addEventListener('hashchange', () => { const v = (location.hash || '').slice(1); if (VIEWS[v] && v !== S.view) go(v); });
  }
  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.snapshot === 'function') { try { hot.snapshot(() => ({ S })); } catch { /* optional */ } }
  if (hot && typeof hot.ready === 'function') hot.ready(boot); else boot((hot && hot.data) || {});
})();
