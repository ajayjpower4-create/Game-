import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { documentsCandidates, settingsDirs, franchiseFilesIn, findFranchiseFiles } from '../src/core/franchise/locate.js';

// A stand-in Windows profile: plain Documents, OneDrive-redirected Documents,
// and a business OneDrive, which is where franchise files actually hide.
function fakeHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'm26fc-home-'));
  const save = (dir, name, kb) => {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, name), Buffer.alloc(kb * 1024, 7));
  };
  save(path.join(home, 'Documents', 'Madden NFL 26', 'settings'), 'CAREER-PLAINDOCS', 5000);
  save(path.join(home, 'Documents', 'Madden NFL 26', 'settings'), 'SETTINGS', 5000); // not a franchise
  save(path.join(home, 'Documents', 'Madden NFL 26', 'settings'), 'CAREER-STUB', 4); // too small to be real
  save(path.join(home, 'OneDrive', 'Documents', 'Madden NFL 26', 'settings'), 'CAREER-ONEDRIVE', 5200);
  save(path.join(home, 'OneDrive - Acme', 'Documents', 'Madden NFL 27', 'settings'), 'CAREER-WORKLAPTOP', 5100);
  return home;
}

test('Documents is looked for everywhere Windows puts it', () => {
  const home = fakeHome();
  const cands = documentsCandidates(home, {});
  assert.ok(cands.includes(path.join(home, 'Documents')));
  assert.ok(cands.includes(path.join(home, 'OneDrive', 'Documents')), 'OneDrive redirect');
  assert.ok(cands.includes(path.join(home, 'OneDrive - Acme', 'Documents')), 'business OneDrive');
  assert.equal(new Set(cands).size, cands.length, 'no duplicates');
  fs.rmSync(home, { recursive: true, force: true });
});

test('an OneDrive environment variable is honoured even off the home folder', () => {
  const other = fs.mkdtempSync(path.join(os.tmpdir(), 'm26fc-od-'));
  const cands = documentsCandidates(os.tmpdir(), { OneDrive: other });
  assert.ok(cands.includes(path.join(other, 'Documents')));
  fs.rmSync(other, { recursive: true, force: true });
});

test('a missing home folder does not throw', () => {
  const gone = path.join(os.tmpdir(), 'm26fc-does-not-exist-' + Date.now());
  assert.ok(Array.isArray(documentsCandidates(gone, {})));
  assert.deepEqual(settingsDirs({ home: gone, env: {} }), []);
});

test('every Madden settings folder on the machine is found', () => {
  const home = fakeHome();
  const dirs = settingsDirs({ home, env: {} });
  const years = dirs.map((d) => d.year).sort();
  assert.deepEqual(years, [26, 26, 27]);
  fs.rmSync(home, { recursive: true, force: true });
});

test('only real franchise saves are listed', () => {
  const home = fakeHome();
  const dir = path.join(home, 'Documents', 'Madden NFL 26', 'settings');
  const files = franchiseFilesIn(dir, 26);
  assert.equal(files.length, 1, 'SETTINGS and the tiny stub are skipped');
  assert.equal(files[0].name, 'CAREER-PLAINDOCS');
  assert.equal(files[0].league, 'PLAINDOCS', 'the league name is pulled out of the file name');
  assert.equal(files[0].year, 26);
  assert.ok(files[0].size > 64 * 1024);
  assert.equal(franchiseFilesIn(path.join(home, 'nope'), 26).length, 0);
  fs.rmSync(home, { recursive: true, force: true });
});

test('findFranchiseFiles gathers every save across all the Documents folders', () => {
  const home = fakeHome();
  const { files, searched } = findFranchiseFiles({ home, env: {} });
  const names = files.map((f) => f.name).sort();
  assert.deepEqual(names, ['CAREER-ONEDRIVE', 'CAREER-PLAINDOCS', 'CAREER-WORKLAPTOP']);
  assert.equal(searched.length, 3);
  // Newest first, so the franchise last played is the one at the top.
  const times = files.map((f) => f.modified);
  assert.deepEqual(times, [...times].sort().reverse());
  fs.rmSync(home, { recursive: true, force: true });
});

test('an extra folder can be searched and is never listed twice', () => {
  const home = fakeHome();
  const extra = path.join(home, 'Documents', 'Madden NFL 26', 'settings');
  const { files } = findFranchiseFiles({ home, env: {}, extraDirs: [extra] });
  assert.equal(files.filter((f) => f.name === 'CAREER-PLAINDOCS').length, 1);
  fs.rmSync(home, { recursive: true, force: true });
});
