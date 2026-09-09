/* Severity tiers.
 *
 * The three ids are shared by every inspection type so the numbering, colours
 * and scoring stay in one place; a domain overrides the wording when its trade
 * calls them something else (a health inspector says "Critical Violation", a
 * mechanic says "Fails / Unsafe"). */

export const BASE_SEVERITIES = [
  {
    id: 'significant',
    label: 'Significant Defect',
    short: 'Significant',
    blurb: 'Not functional, a serious safety concern, and/or a major expense to correct. '
      + 'Further evaluation and repair by a qualified contractor before the end of the '
      + 'contingency period.',
  },
  {
    id: 'marginal',
    label: 'Marginal Defect',
    short: 'Marginal',
    blurb: 'A safety hazard, or a functional or installation-related deficiency. It may have '
      + 'worked at the time of inspection, but the defect can lead to further problems. Most '
      + 'defects land here.',
  },
  {
    id: 'minor',
    label: 'Minor Defect, Maintenance Item, or FYI Item',
    short: 'Minor / FYI',
    blurb: 'Minor repairs that improve function, recurring maintenance, observations, and '
      + 'recommended upgrades.',
  },
];

export const SEVERITY_IDS = BASE_SEVERITIES.map((s) => s.id);

/* A domain supplies overrides keyed by id; anything it leaves out falls back. */
export function severitiesFor(domain) {
  const overrides = domain?.severities || {};
  return BASE_SEVERITIES.map((base) => ({ ...base, ...(overrides[base.id] || {}) }));
}

export function severityMap(domain) {
  return Object.fromEntries(severitiesFor(domain).map((s) => [s.id, s]));
}
