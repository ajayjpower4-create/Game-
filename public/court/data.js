/* Court Simulator — the cast list and the setup questions. */

/* Every role the player can hand out. `sides` decides which ones show up for a
 * criminal case, a civil case, or both. `core` roles are offered by default;
 * the rest are opt-in extras. */
export const ROLES = [
  { id: 'judge', name: 'Judge', core: true, sides: 'both',
    hint: 'runs the room, rules on objections, sentences or enters judgment' },
  { id: 'defendant', name: 'Defendant', core: true, sides: 'both',
    hint: 'the person on trial' },
  { id: 'defense', name: 'Defense Attorney', core: true, sides: 'both',
    hint: 'defends the defendant' },
  { id: 'prosecutor', name: 'Prosecutor', core: true, sides: 'criminal',
    hint: 'brings the case for the state' },
  { id: 'plaintiff', name: 'Plaintiff', core: true, sides: 'civil',
    hint: 'the party who filed the suit' },
  { id: 'plaintiffLawyer', name: "Plaintiff's Attorney", core: true, sides: 'civil',
    hint: 'argues the case for the plaintiff' },
  { id: 'witness1', name: 'Witness for the Prosecution', core: true, sides: 'criminal',
    hint: 'saw something that hurts the defendant' },
  { id: 'witness2', name: 'Witness for the Defense', core: true, sides: 'criminal',
    hint: 'saw something that helps the defendant' },
  { id: 'witnessP', name: "Witness for the Plaintiff", core: true, sides: 'civil',
    hint: 'testifies for the side that filed' },
  { id: 'witnessD', name: 'Witness for the Defense', core: true, sides: 'civil',
    hint: 'testifies for the side being sued' },
  { id: 'bailiff', name: 'Bailiff', core: true, sides: 'both',
    hint: 'swears in witnesses, keeps order' },
  { id: 'foreperson', name: 'Jury Foreperson', core: false, sides: 'both',
    hint: 'speaks for the jury, reads the verdict' },
  { id: 'clerk', name: 'Court Clerk', core: false, sides: 'both',
    hint: 'calls the case, handles exhibits' },
  { id: 'expert', name: 'Expert Witness', core: false, sides: 'both',
    hint: 'forensics, medicine, accounting — testifies to the technical facts' },
  { id: 'detective', name: 'Lead Detective', core: false, sides: 'criminal',
    hint: 'ran the investigation, wrote the report' },
  { id: 'coCounsel', name: 'Co-Counsel', core: false, sides: 'both',
    hint: 'second chair, passes notes, handles one witness' },
  { id: 'victim', name: 'Victim / Complaining Witness', core: false, sides: 'criminal',
    hint: 'the person the charge is about' },
  { id: 'reporter', name: 'Court Reporter', core: false, sides: 'both',
    hint: 'reads back testimony when asked' },
  { id: 'press', name: 'Reporter in the Gallery', core: false, sides: 'both',
    hint: 'watching from the back row, filing copy' },
  { id: 'family', name: 'Family in the Gallery', core: false, sides: 'both',
    hint: 'someone with a stake in how this ends' },
];

export const ROLE_BY_ID = Object.fromEntries(ROLES.map((r) => [r.id, r]));

export const rolesFor = (type) => ROLES.filter((r) => r.sides === 'both' || r.sides === type);

/* Openings the player can fire off without typing, once the trial starts. */
export const QUICK_LINES = [
  'Objection — hearsay.',
  'Objection — leading the witness.',
  'Objection — relevance.',
  'Sustained.',
  'Overruled.',
  'No further questions, Your Honor.',
  'Your Honor, the defense calls its next witness.',
  'Permission to approach the bench?',
  '*I stand up slowly and button my jacket.*',
  'The witness may step down.',
];

export const BLANK_CASE = {
  type: 'criminal',
  id: '',
  court: '',
  partyA: '',
  partyB: '',
  charge: '',
  summary: '',
};
