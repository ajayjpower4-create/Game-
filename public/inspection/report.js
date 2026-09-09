/* Turns the intake answers plus a list of findings into a finished report.
 * Pure functions, and domain-agnostic: everything specific to what is being
 * inspected arrives in the domain argument. */

import { severityMap } from './severity.js';
import { sectionById, itemById } from './domains/index.js';

const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

export function estimateCost(domain, findings) {
  const bands = domain.costBands;
  if (!bands) return null;
  let low = 0;
  let high = 0;
  for (const f of findings) {
    const band = bands[f.sev] || bands.minor;
    low += band[0];
    high += band[1];
  }
  return { low, high, label: `${money(low)} - ${money(high)}`, note: domain.costNote || '' };
}

/* Number findings the way an inspection report does: section.item.occurrence
 * (3.1.1 = section three, first item in that section, first finding on it). */
export function buildReport(domain, state) {
  const p = state.profile;
  const findings = state.findings || [];
  const sevs = severityMap(domain);
  const sections = [];
  const summary = [];

  domain.sections.forEach((section, sIdx) => {
    const num = sIdx + 1;
    const mine = findings.filter((f) => f.section === section.id);
    const counters = {};
    const numbered = [];

    section.items.forEach((item, iIdx) => {
      mine.filter((f) => f.item === item.id).forEach((f) => {
        counters[item.id] = (counters[item.id] || 0) + 1;
        const entry = {
          ...f,
          ref: `${num}.${iIdx + 1}.${counters[item.id]}`,
          itemName: item.name,
          sectionTitle: section.title,
          severity: sevs[f.sev],
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
    domainId: domain.id,
    meta: {
      docTitle: domain.docTitle,
      subjectLabel: domain.subjectLabel,
      subject: domain.subjectLine(p),
      subjectSub: domain.subjectSub ? domain.subjectSub(p) : '',
      clientLabel: domain.clientLabel,
      client: p.client,
      inspector: p.inspector,
      company: p.company,
      date: p.date,
    },
    profile: p,
    severities: sevs,
    sections,
    summary,
    counts,
    total: summary.length,
    cost: estimateCost(domain, summary),
    standardsTitle: domain.standardsTitle,
    standards: domain.standards(p),
    narrative: state.narrative || null,
  };
}

/* The score is the game part: coverage across the sections that carry findings,
 * plus credit for locating them and for writing your own notes. */
export function scoreReport(domain, report) {
  const inspectable = domain.sections.filter((s) => s.items.length).length;
  const covered = report.sections.filter((s) => s.findings.length > 0).length;
  const withNotes = report.summary.filter((f) => f.note && f.note.trim()).length;
  const located = report.summary.filter((f) => f.location).length;

  const target = Math.max(4, Math.round(inspectable * 0.6));
  const coverage = Math.min(1, covered / target);
  const depth = Math.min(1, report.total / Math.max(8, inspectable * 1.5));
  const detail = report.total ? (located * 0.6 + withNotes * 0.4) / report.total : 0;
  const score = Math.round(coverage * 45 + depth * 35 + detail * 20);

  const grade = score >= 90 ? 'A' : score >= 80 ? 'B' : score >= 70 ? 'C' : score >= 60 ? 'D' : 'F';
  const notes = [];
  if (covered < target) {
    notes.push(`Only ${covered} of ${inspectable} sections carry a finding — a thorough `
      + `${domain.name.toLowerCase()} report usually touches more.`);
  }
  if (report.counts.significant === 0 && report.total > 0) {
    notes.push('Nothing was called out at the top severity. That happens, but it is worth a second '
      + 'pass over the safety items before you send it.');
  }
  if (located < report.total) {
    notes.push(`${report.total - located} finding(s) have no location attached. Whoever fixes this `
      + 'needs to know where.');
  }
  if (withNotes === 0 && report.total > 0) {
    notes.push('None of your findings carry your own note. The boilerplate covers the defect; your '
      + 'note covers what you actually saw.');
  }
  if (!notes.length) notes.push('Thorough, located and annotated. This one is ready to send.');

  return { score, grade, covered, sections: inspectable, withNotes, located, notes };
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
  const m = report.meta;

  rule();
  L.push(m.docTitle.toUpperCase());
  L.push(m.subject);
  if (m.subjectSub) L.push(m.subjectSub);
  L.push(`${m.clientLabel}: ${m.client}`);
  L.push(`Inspected by: ${m.inspector}, ${m.company}`);
  L.push(`Date of inspection: ${m.date}`);
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

  const s = report.severities;
  L.push(`SUMMARY — ${report.total} findings `
    + `(${report.counts.significant} ${s.significant.short.toLowerCase()}, `
    + `${report.counts.marginal} ${s.marginal.short.toLowerCase()}, `
    + `${report.counts.minor} ${s.minor.short.toLowerCase()})`);
  rule('-');
  report.summary.forEach((f) => {
    L.push(`${f.ref} ${f.sectionTitle} - ${f.itemName}: ${f.title}${f.location ? `  [${f.location}]` : ''}`);
  });
  L.push('');
  if (report.cost) {
    L.push(`Estimated repair budget range: ${report.cost.label}. ${report.cost.note}`);
    L.push('');
  }

  report.sections.forEach((sec) => {
    rule();
    L.push(`${sec.num}: ${sec.title.toUpperCase()}`);
    rule();
    if (sec.info.length) {
      L.push('');
      L.push('Information');
      sec.info.forEach(([k, v]) => L.push(`  ${k}: ${v}`));
    }
    sec.narrative.forEach((n) => {
      L.push('');
      L.push(n.title);
      L.push(wrap(n.text));
    });
    if (sec.findings.length) {
      L.push('');
      L.push('Findings');
      sec.findings.forEach((f) => {
        L.push('');
        L.push(`${f.ref}  ${f.itemName} — ${f.severity.label}`);
        L.push(`${f.title.toUpperCase()}${f.location ? `  |  ${f.location.toUpperCase()}` : ''}`);
        L.push(wrap(f.body));
        if (f.note && f.note.trim()) L.push(wrap(`Inspector's note: ${f.note.trim()}`));
        L.push(`Recommendation: ${f.rec}`);
      });
    }
    L.push('');
  });

  rule();
  L.push(report.standardsTitle.toUpperCase());
  L.push(wrap(report.standards));
  rule();
  return L.join('\n');
}
