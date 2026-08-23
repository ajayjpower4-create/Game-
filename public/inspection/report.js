/* Turns the intake answers plus a list of findings into a finished report.
 * Pure functions — no DOM, so the server can use them too. */

import { SECTIONS, SEVERITY_BY_ID } from './data.js';
import { DEFECTS_BY_ID } from './defects.js';

/* The rooms a finding can be attached to, generated from the intake so the
 * inspector picks a location instead of typing one. */
export function locationsFor(p) {
  const out = [];
  const n = (v) => Number(v) || 0;
  if (n(p.bedrooms) > 0) out.push('Master Bedroom');
  for (let i = 2; i <= n(p.bedrooms); i += 1) out.push(`Bedroom ${i}`);
  if (n(p.fullBaths) > 0) out.push('Master Bathroom');
  for (let i = 2; i <= n(p.fullBaths); i += 1) out.push(`Bathroom ${i}`);
  for (let i = 1; i <= n(p.halfBaths); i += 1) out.push(n(p.halfBaths) > 1 ? `Half Bathroom ${i}` : 'Half Bathroom');
  if (n(p.livingRooms) > 0) out.push('Living Room');
  if (n(p.livingRooms) > 1) out.push('Family Room');
  if (n(p.livingRooms) > 2) out.push('Den / Bonus Room');
  for (let i = 1; i <= n(p.diningRooms); i += 1) out.push(i === 1 ? 'Dining Room' : `Dining Room ${i}`);
  for (let i = 1; i <= n(p.kitchens); i += 1) out.push(i === 1 ? 'Kitchen' : `Kitchen ${i}`);
  out.push('Hallway', 'Stairway', 'Entry / Foyer');
  if (p.laundry && p.laundry !== 'Not Present') out.push(`Laundry (${p.laundry})`);
  if (n(p.garageBays) > 0) out.push('Garage');
  if (String(p.foundation || '').includes('Basement')) out.push('Basement');
  if (String(p.foundation || '').includes('Crawl')) out.push('Crawl Space');
  if (p.attic !== 'No Accessible Attic') out.push('Attic');
  out.push(
    'Exterior Front', 'Exterior Rear', 'Exterior Left Side', 'Exterior Right Side',
    'Roof', 'Perimeter of Home', 'Throughout the Home', 'Multiple Locations',
  );
  return out;
}

const money = (n) => `$${n.toLocaleString('en-US')}`;

/* Rough repair-cost bands, used for the client-facing budget estimate. Broad on
 * purpose — a home inspection is qualitative, and the report says so. */
const COST_BANDS = { significant: [1500, 9000], marginal: [200, 1200], minor: [0, 300] };

export function estimateCost(findings) {
  let low = 0;
  let high = 0;
  for (const f of findings) {
    const band = COST_BANDS[f.sev] || COST_BANDS.minor;
    low += band[0];
    high += band[1];
  }
  return { low, high, label: `${money(low)} - ${money(high)}` };
}

export function propertyLine(p) {
  return [p.address, p.city, p.state].filter(Boolean).join(', ') + (p.zip ? ` ${p.zip}` : '');
}

/* Number findings the way an inspection report does: section.item.occurrence
 * (3.1.1 = section three, first item in that section, first finding on it). */
export function buildReport(state) {
  const p = state.profile;
  const findings = state.findings || [];
  const sections = [];
  const summary = [];

  SECTIONS.forEach((section, sIdx) => {
    const num = sIdx + 1;
    const mine = findings.filter((f) => f.section === section.id);
    const counters = {};
    const numbered = [];

    section.items.forEach((item, iIdx) => {
      mine.filter((f) => f.item === item.id).forEach((f) => {
        counters[item.id] = (counters[item.id] || 0) + 1;
        const ref = `${num}.${iIdx + 1}.${counters[item.id]}`;
        const entry = {
          ...f,
          ref,
          itemName: item.name,
          sectionTitle: section.title,
          severity: SEVERITY_BY_ID[f.sev],
        };
        numbered.push(entry);
        summary.push(entry);
      });
    });

    sections.push({
      num,
      id: section.id,
      title: section.title,
      info: (section.info ? section.info(p) : []).filter(([, v]) => v),
      narrative: section.narrative ? section.narrative(p) : [],
      findings: numbered,
    });
  });

  const counts = {
    significant: summary.filter((f) => f.sev === 'significant').length,
    marginal: summary.filter((f) => f.sev === 'marginal').length,
    minor: summary.filter((f) => f.sev === 'minor').length,
  };

  return {
    meta: {
      address: propertyLine(p),
      client: p.client,
      inspector: p.inspector,
      company: p.company,
      date: p.date,
      yearBuilt: p.yearBuilt,
      type: p.houseType,
    },
    profile: p,
    sections,
    summary,
    counts,
    total: summary.length,
    cost: estimateCost(summary),
    narrative: state.narrative || null,
  };
}

/* The score is the game part: coverage across the sections that carry defects,
 * plus credit for catching the safety items and for writing your own notes. */
export function scoreReport(report) {
  const inspectable = report.sections.filter((s) => s.findings.length > 0 || s.id !== 'info');
  const covered = report.sections.filter((s) => s.findings.length > 0).length;
  const withNotes = report.summary.filter((f) => f.note && f.note.trim()).length;
  const located = report.summary.filter((f) => f.location).length;

  const coverage = Math.min(1, covered / 10);
  const depth = Math.min(1, report.total / 25);
  const detail = report.total ? (located * 0.6 + withNotes * 0.4) / report.total : 0;
  const raw = coverage * 45 + depth * 35 + detail * 20;
  const score = Math.round(raw);

  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  const notes = [];
  if (covered < 6) notes.push(`Only ${covered} of ${inspectable.length} sections carry a finding — a real report on a home this age usually touches more.`);
  if (report.counts.significant === 0) notes.push('No significant defects were called out. That happens, but re-check the panel, the roof and the areas below grade before you send it.');
  if (located < report.total) notes.push(`${report.total - located} finding(s) have no location attached. Clients and contractors need to know where.`);
  if (withNotes === 0 && report.total > 0) notes.push('None of your findings carry your own note. The boilerplate covers the defect; your note covers what you actually saw.');
  if (!notes.length) notes.push('Thorough, located and annotated. This one is ready to send.');

  return { score, grade, covered, sections: inspectable.length, withNotes, located, notes };
}

/* --------------------------------------------------------- text rendering */

const wrap = (text, width = 92) => {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) { lines.push(line.trim()); line = w; } else { line += ` ${w}`; }
  }
  if (line.trim()) lines.push(line.trim());
  return lines.join('\n');
};

export function reportToText(report) {
  const L = [];
  const rule = (c = '=') => L.push(c.repeat(92));

  rule();
  L.push(`HOME INSPECTION REPORT`);
  L.push(report.meta.address);
  L.push(`Prepared for: ${report.meta.client}`);
  L.push(`Inspected by: ${report.meta.inspector}, ${report.meta.company}`);
  L.push(`Date of inspection: ${report.meta.date}`);
  rule();
  L.push('');

  L.push('TABLE OF CONTENTS');
  report.sections.forEach((s) => L.push(`${s.num}: ${s.title}${s.findings.length ? `  (${s.findings.length})` : ''}`));
  L.push('');

  if (report.narrative) {
    L.push('OVERVIEW');
    rule('-');
    L.push(wrap(report.narrative.overview || ''));
    L.push('');
    if (report.narrative.priorities?.length) {
      L.push('WHAT TO ADDRESS FIRST');
      report.narrative.priorities.forEach((t, i) => L.push(wrap(`${i + 1}. ${t}`)));
      L.push('');
    }
  }

  L.push(`SUMMARY — ${report.total} findings `
    + `(${report.counts.significant} significant, ${report.counts.marginal} marginal, ${report.counts.minor} minor/FYI)`);
  rule('-');
  report.summary.forEach((f) => {
    L.push(`${f.ref} ${f.sectionTitle} - ${f.itemName}: ${f.title}${f.location ? `  [${f.location}]` : ''}`);
  });
  L.push('');
  L.push(`Estimated repair budget range: ${report.cost.label}. This is a planning range only; `
    + 'quotes from the recommended tradespeople govern.');
  L.push('');

  report.sections.forEach((s) => {
    rule();
    L.push(`${s.num}: ${s.title.toUpperCase()}`);
    rule();
    if (s.info.length) {
      L.push('');
      L.push('Information');
      s.info.forEach(([k, v]) => L.push(`  ${k}: ${v}`));
    }
    s.narrative.forEach((n) => {
      L.push('');
      L.push(n.title);
      L.push(wrap(n.text));
    });
    if (s.findings.length) {
      L.push('');
      L.push('Recommendations');
      s.findings.forEach((f) => {
        L.push('');
        L.push(`${f.ref}  ${f.itemName} — ${f.severity.label}`);
        L.push(`${f.title.toUpperCase()}${f.location ? `  |  ${f.location.toUpperCase()}` : ''}`);
        L.push(wrap(f.body));
        if (f.note && f.note.trim()) {
          L.push(wrap(`Inspector's note: ${f.note.trim()}`));
        }
        L.push(`Recommendation: ${f.rec}`);
      });
    }
    L.push('');
  });

  rule();
  L.push('This report is the property of the inspection company named above and is provided for the');
  L.push('exclusive use of the client named above. It is not a warranty or guarantee of any kind.');
  rule();
  return L.join('\n');
}
