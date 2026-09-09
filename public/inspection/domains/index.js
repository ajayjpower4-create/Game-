/* Every inspection type the simulator knows how to run.
 *
 * A domain is self-contained: its own intake form, its own report sections and
 * standing narrative, its own defect menu, its own severity wording and its own
 * cost bands. Adding another one means adding a file here — nothing else in the
 * app is aware of what is being inspected. */

import home from './home.js';
import vehicle from './vehicle.js';
import gamingpc from './gamingpc.js';
import phone from './phone.js';
import restaurant from './restaurant.js';

export const DOMAINS = [home, vehicle, gamingpc, phone, restaurant];

export const DOMAIN_BY_ID = Object.fromEntries(DOMAINS.map((d) => [d.id, d]));

export const DEFAULT_DOMAIN = home.id;

export function sectionById(domain, id) {
  return domain.sections.find((s) => s.id === id);
}

export function itemById(domain, sectionId, itemId) {
  return sectionById(domain, sectionId)?.items.find((i) => i.id === itemId);
}

export function defectsFor(domain, sectionId, severity) {
  return domain.defects.filter((d) => d.section === sectionId && (!severity || d.sev === severity));
}

export function defectById(domain, id) {
  return domain.defects.find((d) => d.id === id);
}
