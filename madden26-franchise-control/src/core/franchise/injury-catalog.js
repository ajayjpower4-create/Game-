// Every injury Madden NFL 26 knows about (the InjuryType enum in the
// franchise schema), with the body part, whether it has a left/right side,
// and how many weeks it normally costs. Durations follow the ranges the game
// itself hands out; the user can override them in the injury tool.
//
// severityFor(weeks) maps a duration to the InjurySeverity enum the game
// expects on the Player record.

const W = (min, max) => ({ min, max });

export const BODY_PARTS = ['Ankle', 'Arm', 'Back', 'Elbow', 'Foot', 'Hand', 'Head', 'Neck', 'Hip', 'Knee', 'Leg', 'Rib', 'Shoulder'];

export const INJURY_TYPES = [
  // Ankle
  { key: 'AnkleAchillesSprain', name: 'Achilles Sprain', part: 'Ankle', sided: true, weeks: W(1, 2) },
  { key: 'AnkleBruise', name: 'Ankle Bruise', part: 'Ankle', sided: true, weeks: W(0, 1) },
  { key: 'AnkleSprain', name: 'Ankle Sprain', part: 'Ankle', sided: true, weeks: W(1, 3) },
  { key: 'AnkleHighSprain', name: 'High Ankle Sprain', part: 'Ankle', sided: true, weeks: W(2, 6) },
  { key: 'AnkleBroken', name: 'Broken Ankle', part: 'Ankle', sided: true, weeks: W(8, 12) },
  { key: 'AnkleAchillesTear', name: 'Torn Achilles', part: 'Ankle', sided: true, weeks: W(32, 40), seasonEnding: true },
  { key: 'AnkleDislocated', name: 'Dislocated Ankle', part: 'Ankle', sided: true, weeks: W(6, 10) },
  { key: 'AnkleDislocatedSeveralGames', name: 'Dislocated Ankle (several games)', part: 'Ankle', sided: true, weeks: W(3, 6) },
  // Arm
  { key: 'ArmForearmBruise', name: 'Forearm Bruise', part: 'Arm', sided: true, weeks: W(0, 1) },
  { key: 'ArmForearmStrain', name: 'Forearm Strain', part: 'Arm', sided: true, weeks: W(1, 2) },
  { key: 'ArmStrainedBicep', name: 'Strained Bicep', part: 'Arm', sided: true, weeks: W(2, 4) },
  { key: 'ArmStrainedTricep', name: 'Strained Tricep', part: 'Arm', sided: true, weeks: W(2, 4) },
  { key: 'ArmForearmFracture', name: 'Fractured Forearm', part: 'Arm', sided: true, weeks: W(6, 8) },
  { key: 'ArmTornBicep', name: 'Torn Bicep', part: 'Arm', sided: true, weeks: W(20, 30), seasonEnding: true },
  { key: 'ArmTornTricep', name: 'Torn Tricep', part: 'Arm', sided: true, weeks: W(20, 30), seasonEnding: true },
  { key: 'ArmUpperBruise', name: 'Upper Arm Bruise', part: 'Arm', sided: true, weeks: W(0, 1) },
  { key: 'ArmUpperFracture', name: 'Fractured Upper Arm', part: 'Arm', sided: true, weeks: W(6, 8) },
  // Back
  { key: 'BackStrain', name: 'Back Strain', part: 'Back', sided: false, weeks: W(1, 2) },
  { key: 'BackRupturedDisk', name: 'Ruptured Disk', part: 'Back', sided: false, weeks: W(24, 32), seasonEnding: true },
  { key: 'BackRupturedDiskCouple', name: 'Ruptured Disk (couple games)', part: 'Back', sided: false, weeks: W(2, 4) },
  { key: 'BackVertebraeBroken', name: 'Broken Vertebrae', part: 'Back', sided: false, weeks: W(30, 40), seasonEnding: true },
  { key: 'BackSpasms', name: 'Back Spasms', part: 'Back', sided: false, weeks: W(1, 2) },
  // Elbow
  { key: 'ElbowBruised', name: 'Bruised Elbow', part: 'Elbow', sided: true, weeks: W(0, 1) },
  { key: 'ElbowDislocate', name: 'Dislocated Elbow', part: 'Elbow', sided: true, weeks: W(4, 6) },
  { key: 'ElbowDislocatedSeveralGames', name: 'Dislocated Elbow (several games)', part: 'Elbow', sided: true, weeks: W(2, 4) },
  { key: 'ElbowFracture', name: 'Fractured Elbow', part: 'Elbow', sided: true, weeks: W(6, 8) },
  { key: 'ElbowBursitis', name: 'Elbow Bursitis', part: 'Elbow', sided: true, weeks: W(1, 3) },
  { key: 'ElbowSprain', name: 'Elbow Sprain', part: 'Elbow', sided: true, weeks: W(1, 2) },
  // Foot
  { key: 'FootSprain', name: 'Foot Sprain', part: 'Foot', sided: true, weeks: W(1, 2) },
  { key: 'FootBrokenToe', name: 'Broken Toe', part: 'Foot', sided: true, weeks: W(2, 4) },
  { key: 'FootFractureCoupleGames', name: 'Foot Fracture (couple games)', part: 'Foot', sided: true, weeks: W(2, 4) },
  { key: 'FootFracture', name: 'Foot Fracture', part: 'Foot', sided: true, weeks: W(6, 8) },
  { key: 'FootTurfToe', name: 'Turf Toe', part: 'Foot', sided: true, weeks: W(1, 3) },
  { key: 'FootContusion', name: 'Foot Contusion', part: 'Foot', sided: true, weeks: W(0, 1) },
  { key: 'FootStressFracture', name: 'Stress Fracture (foot)', part: 'Foot', sided: true, weeks: W(6, 8) },
  // Hand
  { key: 'HandBruise', name: 'Bruised Hand', part: 'Hand', sided: true, weeks: W(0, 1) },
  { key: 'HandFingerBroken', name: 'Broken Finger', part: 'Hand', sided: true, weeks: W(1, 3) },
  { key: 'HandFingerDislocated', name: 'Dislocated Finger', part: 'Hand', sided: true, weeks: W(0, 1) },
  { key: 'HandThumbBroken', name: 'Broken Thumb', part: 'Hand', sided: true, weeks: W(3, 5) },
  { key: 'HandBroken', name: 'Broken Hand', part: 'Hand', sided: true, weeks: W(4, 6) },
  { key: 'HandThumbDislocated', name: 'Dislocated Thumb', part: 'Hand', sided: true, weeks: W(1, 2) },
  { key: 'HandWristDislocated', name: 'Dislocated Wrist', part: 'Hand', sided: true, weeks: W(4, 6) },
  { key: 'HandWristBroken', name: 'Broken Wrist', part: 'Hand', sided: true, weeks: W(6, 8) },
  { key: 'HandWristSprain', name: 'Wrist Sprain', part: 'Hand', sided: true, weeks: W(1, 2) },
  // Head / Neck
  { key: 'HeadJawBroken', name: 'Broken Jaw', part: 'Head', sided: false, weeks: W(4, 6) },
  { key: 'NeckPinchedNerver', name: 'Pinched Nerve (neck)', part: 'Neck', sided: false, weeks: W(1, 3) },
  // Hip
  { key: 'HipBursitis', name: 'Hip Bursitis', part: 'Hip', sided: true, weeks: W(1, 3) },
  { key: 'HipDislocation', name: 'Dislocated Hip', part: 'Hip', sided: true, weeks: W(20, 30), seasonEnding: true },
  { key: 'HipDislocationCoupleGames', name: 'Dislocated Hip (couple games)', part: 'Hip', sided: true, weeks: W(3, 6) },
  { key: 'HipPointer', name: 'Hip Pointer', part: 'Hip', sided: true, weeks: W(1, 2) },
  { key: 'HipFracture', name: 'Fractured Hip', part: 'Hip', sided: true, weeks: W(24, 32), seasonEnding: true },
  { key: 'HipTailboneBroken', name: 'Broken Tailbone', part: 'Hip', sided: false, weeks: W(4, 6) },
  // Knee
  { key: 'KneeBruise', name: 'Knee Bruise', part: 'Knee', sided: true, weeks: W(0, 1) },
  { key: 'KneeACLSprain', name: 'ACL Sprain', part: 'Knee', sided: true, weeks: W(2, 4) },
  { key: 'KneeBursitis', name: 'Knee Bursitis', part: 'Knee', sided: true, weeks: W(1, 3) },
  { key: 'KneeMCLSprain', name: 'MCL Sprain', part: 'Knee', sided: true, weeks: W(2, 4) },
  { key: 'KneeACLPartialTear', name: 'Partial ACL Tear', part: 'Knee', sided: true, weeks: W(20, 30), seasonEnding: true },
  { key: 'KneeCartilageTear', name: 'Torn Knee Cartilage', part: 'Knee', sided: true, weeks: W(4, 8) },
  { key: 'KneeDislocated', name: 'Dislocated Knee', part: 'Knee', sided: true, weeks: W(24, 32), seasonEnding: true },
  { key: 'KneeMCLPartialTear', name: 'Partial MCL Tear', part: 'Knee', sided: true, weeks: W(6, 10) },
  { key: 'KneeACLCompleteTear', name: 'ACL Tear', part: 'Knee', sided: true, weeks: W(36, 44), seasonEnding: true },
  { key: 'KneePCLPartialTear', name: 'Partial PCL Tear', part: 'Knee', sided: true, weeks: W(4, 8) },
  { key: 'KneePCLSprain', name: 'PCL Sprain', part: 'Knee', sided: true, weeks: W(1, 3) },
  { key: 'KneeKneecapFracture', name: 'Fractured Kneecap', part: 'Knee', sided: true, weeks: W(24, 32), seasonEnding: true },
  { key: 'KneeMCLCompleteTear', name: 'MCL Tear', part: 'Knee', sided: true, weeks: W(20, 30), seasonEnding: true },
  { key: 'KneePCLCompleteTear', name: 'PCL Tear', part: 'Knee', sided: true, weeks: W(20, 30), seasonEnding: true },
  { key: 'KneeStrain', name: 'Knee Strain', part: 'Knee', sided: true, weeks: W(1, 2) },
  // Leg
  { key: 'LegCalfStrain', name: 'Calf Strain', part: 'Leg', sided: true, weeks: W(1, 3) },
  { key: 'LegCramp', name: 'Leg Cramp', part: 'Leg', sided: true, weeks: W(0, 0) },
  { key: 'LegHamstringPull', name: 'Pulled Hamstring', part: 'Leg', sided: true, weeks: W(2, 4) },
  { key: 'LegQuadBruise', name: 'Quad Bruise', part: 'Leg', sided: true, weeks: W(0, 1) },
  { key: 'LegGroinPull', name: 'Pulled Groin', part: 'Leg', sided: true, weeks: W(2, 4) },
  { key: 'LegFibulaBroken', name: 'Broken Fibula', part: 'Leg', sided: true, weeks: W(8, 12) },
  { key: 'LegGroinTear', name: 'Torn Groin', part: 'Leg', sided: true, weeks: W(6, 10) },
  { key: 'LegHamstringTear', name: 'Torn Hamstring', part: 'Leg', sided: true, weeks: W(8, 12) },
  { key: 'LegQuadStrain', name: 'Quad Strain', part: 'Leg', sided: true, weeks: W(1, 3) },
  { key: 'LegQuadTear', name: 'Torn Quad', part: 'Leg', sided: true, weeks: W(24, 32), seasonEnding: true },
  { key: 'LegBrokenFemur', name: 'Broken Femur', part: 'Leg', sided: true, weeks: W(30, 40), seasonEnding: true },
  { key: 'LegTibiaBroken', name: 'Broken Tibia', part: 'Leg', sided: true, weeks: W(24, 32), seasonEnding: true },
  // Rib / torso
  { key: 'RibBruisedRibs', name: 'Bruised Ribs', part: 'Rib', sided: false, weeks: W(1, 2) },
  { key: 'RibAbdominalStrain', name: 'Abdominal Strain', part: 'Rib', sided: false, weeks: W(1, 3) },
  { key: 'RibBruiseSternum', name: 'Bruised Sternum', part: 'Rib', sided: false, weeks: W(1, 2) },
  { key: 'RibPectoralStrain', name: 'Pectoral Strain', part: 'Rib', sided: true, weeks: W(2, 4) },
  { key: 'RibAbdominalTear', name: 'Torn Abdominal', part: 'Rib', sided: false, weeks: W(6, 10) },
  { key: 'RibBrokenRibs', name: 'Broken Ribs', part: 'Rib', sided: false, weeks: W(3, 5) },
  { key: 'RibCollarboneBroken', name: 'Broken Collarbone', part: 'Rib', sided: true, weeks: W(6, 10) },
  { key: 'RibPectoralTear', name: 'Torn Pectoral', part: 'Rib', sided: true, weeks: W(24, 32), seasonEnding: true },
  { key: 'RibWindKnockedOut', name: 'Wind Knocked Out', part: 'Rib', sided: false, weeks: W(0, 0) },
  // Shoulder
  { key: 'ShoulderBruise', name: 'Bruised Shoulder', part: 'Shoulder', sided: true, weeks: W(0, 1) },
  { key: 'ShoulderDislocation', name: 'Dislocated Shoulder', part: 'Shoulder', sided: true, weeks: W(4, 8) },
  { key: 'ShoulderStrain', name: 'Shoulder Strain', part: 'Shoulder', sided: true, weeks: W(1, 2) },
  { key: 'ShoulderTear', name: 'Torn Shoulder (labrum)', part: 'Shoulder', sided: true, weeks: W(20, 30), seasonEnding: true },
  { key: 'ShoulderBladeFracture', name: 'Fractured Shoulder Blade', part: 'Shoulder', sided: true, weeks: W(6, 8) },
  { key: 'ShoulderRotatorCuffTear', name: 'Torn Rotator Cuff', part: 'Shoulder', sided: true, weeks: W(24, 32), seasonEnding: true },
  { key: 'ShoulderTearSeveralGames', name: 'Torn Shoulder (several games)', part: 'Shoulder', sided: true, weeks: W(4, 8) },
];

const BY_KEY = new Map(INJURY_TYPES.map((t) => [t.key, t]));

export function getInjuryType(key) {
  return BY_KEY.get(key) || null;
}

export function injuryTypesByPart() {
  const out = {};
  for (const part of BODY_PARTS) out[part] = [];
  for (const t of INJURY_TYPES) out[t.part].push(t);
  return out;
}

// Madden's InjurySeverity enum, chosen from how long the player is out.
export function severityFor(weeks, { seasonEnding = false, careerEnding = false } = {}) {
  if (careerEnding) return 'CareerEnding';
  if (seasonEnding) return 'SeasonEnding';
  if (weeks <= 0) return 'GameEnding';
  if (weeks <= 6) return 'CoupleGames';
  if (weeks <= 15) return 'SeveralGames';
  return 'SeasonEnding';
}

// Plain-English injury report label the way a broadcast would say it.
export function describeDuration(weeks, seasonEnding) {
  if (seasonEnding) return 'Out for the season';
  if (weeks <= 0) return 'Left the game, day-to-day';
  if (weeks === 1) return 'Out 1 week';
  return `Out ${weeks} weeks`;
}
