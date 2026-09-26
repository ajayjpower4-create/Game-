/* KingstarSchool: a school grades app for teachers and students.
 *
 * Teachers create an account, paste in class lists, set up courses, fill
 * them with folders and assignments, and keep a gradebook. Students pick
 * their teacher's file, find their name, and type in the grades they got.
 *
 * When the page runs as a Claude artifact, everything is kept in the
 * artifact's shared database. Anywhere else it is kept in this browser's
 * localStorage.
 */
(() => {
  'use strict';

  // ---------- Small helpers ----------

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);
  const clone = (o) => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  const now = () => Date.now();
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const round2 = (n) => Math.round(n * 100) / 100;
  const fmtNum = (n) => String(round2(Number(n) || 0));
  const fmtPct = (p) => `${round2(p)}%`;
  const plural = (n, word, many) => `${n} ${n === 1 ? word : many || `${word}s`}`;
  const truncate = (s, n) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s);
  const nl2br = (s) => esc(s).replace(/\n/g, '<br>');
  const opt = (value, label, current) =>
    `<option value="${esc(value)}"${String(value) === String(current) ? ' selected' : ''}>${esc(label)}</option>`;

  function uid(len = 10) {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    const bytes = crypto.getRandomValues(new Uint8Array(len));
    let out = '';
    for (const b of bytes) out += chars[b % chars.length];
    return out;
  }

  function initials(name) {
    const parts = String(name || '').replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    const pick = parts.length > 1 ? [parts[0], parts[parts.length - 1]] : [parts[0]];
    return pick.map((p) => p[0]).join('').toUpperCase();
  }

  function listNames(names) {
    if (names.length < 3) return names.join(' and ');
    return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  }

  // Merge `patch` into `base` the way the artifact database's update() does:
  // nested objects merge, everything else (arrays, null) replaces.
  function deepMerge(base, patch) {
    const out = isObj(base) ? { ...base } : {};
    for (const [k, v] of Object.entries(patch)) {
      out[k] = isObj(v) && isObj(out[k]) ? deepMerge(out[k], v) : clone(v);
    }
    return out;
  }

  function setPath(root, path, value) {
    const keys = path.split('.');
    let obj = root;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
      if (obj == null) return;
    }
    obj[keys[keys.length - 1]] = value;
  }

  // A light password check for teacher accounts. This keeps classmates out
  // of a teacher's gradebook on a shared page; it is not real security.
  function hashPass(teacherId, pass) {
    if (!pass) return '';
    const str = `kingstar:${teacherId}:${pass}`;
    let h1 = 0xdeadbeef;
    let h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0');
  }

  // Class lists are pasted in, one student per line.
  function parseNames(text) {
    const seen = new Set();
    const out = [];
    for (let line of String(text || '').split(/\r?\n/)) {
      line = line.replace(/\t+/g, ' ').replace(/^\s*\d+\s*[.)]\s+/, '').replace(/\s+/g, ' ').trim().slice(0, 60);
      if (!line) continue;
      const key = line.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(line);
    }
    return out;
  }

  // ---------- Dates ----------

  const LONG_DAY = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  const pad2 = (n) => String(n).padStart(2, '0');

  function parseDue(due) {
    if (!due) return null;
    const d = new Date(due);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const fmtTime = (d) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }).toLowerCase();
  const fmtDay = (d) => d.toLocaleDateString('en-US', LONG_DAY);
  function fmtDue(due) {
    const d = parseDue(due);
    return d ? `${fmtDay(d)} at ${fmtTime(d)}` : 'No due date';
  }
  function fmtShort(due) {
    const d = parseDue(due);
    if (!d) return '';
    return `${d.getMonth() + 1}/${pad2(d.getDate())}/${pad2(d.getFullYear() % 100)} ${fmtTime(d).replace(' ', '')}`;
  }
  function startOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }
  function fmtWhen(ts) {
    const d = new Date(ts);
    const today = startOfToday().getTime();
    const day = 86400000;
    const time = fmtTime(d);
    if (ts >= today) return `Today at ${time}`;
    if (ts >= today - day) return `Yesterday at ${time}`;
    if (ts >= today - 6 * day) return `${d.toLocaleDateString('en-US', { weekday: 'short' })} at ${time}`;
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${time}`;
  }
  const toDateInput = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  function nextFriday() {
    const d = new Date();
    d.setDate(d.getDate() + (((5 - d.getDay() + 7) % 7) || 7));
    return toDateInput(d);
  }
  function schoolYear(d = new Date()) {
    const y = d.getFullYear();
    return d.getMonth() >= 6 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }
  // A best guess at the marking period for new assignments; teachers can change it.
  function currentMp() {
    const m = new Date().getMonth();
    if (m >= 7 && m <= 9) return 1;
    if (m >= 10 || m === 0) return 2;
    if (m <= 2) return 3;
    return 4;
  }
  function isPastDue(a) {
    const d = parseDue(a.due);
    return !!d && d.getTime() < now();
  }
  function byDue(a, b) {
    const da = parseDue(a.due);
    const db = parseDue(b.due);
    return (da ? da.getTime() : Infinity) - (db ? db.getTime() : Infinity) || (a.createdAt || 0) - (b.createdAt || 0);
  }

  // ---------- Grading ----------

  const CATS = [
    { key: 'minor', label: 'Minor' },
    { key: 'major', label: 'Major' },
    { key: 'practice', label: 'Practice' },
  ];
  const CAT_LABEL = { minor: 'Minor', major: 'Major', practice: 'Practice' };
  const DEFAULT_WEIGHTS = { minor: 60, major: 50, practice: 0 };
  const MPS = [1, 2, 3, 4];
  const MP_WEIGHT = 25;
  // The school's scale. A score right on a line gets the higher grade.
  const SCALE = [
    { l: 'A', min: 89, text: '89 and higher' },
    { l: 'B', min: 75, text: '75 to 89' },
    { l: 'C', min: 65, text: '65 to 75' },
    { l: 'D', min: 55, text: '55 to 65' },
    { l: 'E', min: -Infinity, text: '55 and below' },
  ];

  function letterFor(pct) {
    if (pct == null || Number.isNaN(pct)) return null;
    const p = round2(pct);
    for (const s of SCALE) if (p >= s.min) return s.l;
    return 'E';
  }
  const mpLabel = (mp, year) => (mp ? `MP ${mp} ${year || schoolYear()}` : '(no grading period)');
  const gkey = (aid, sid) => `${aid}_${sid}`;

  function entryOf(courseId, aid, sid) {
    const g = Store.get('grades', courseId);
    const e = g && g.e && g.e[gkey(aid, sid)];
    return e && e.t ? e : null;
  }

  function displayValue(e) {
    if (!e) return '';
    if (e.t === 'a') return 'ABS';
    if (e.t === 'x') return 'EX';
    return fmtNum(e.s);
  }

  // Works out one student's grade in one course: each category is points
  // earned over points possible, each marking period is the weighted mix of
  // its categories, and the course grade averages the marking periods.
  function calcStudent(course, sid) {
    const weights = { ...DEFAULT_WEIGHTS, ...(course.weights || {}) };
    const items = assignmentsOf(course);
    const periods = [...MPS, 0].map((mp) => {
      const cats = CATS.map((c) => {
        const rows = items
          .filter((a) => Number(a.mp ?? 1) === mp && a.cat === c.key)
          .sort(byDue)
          .map((a) => ({ a, e: entryOf(course.id, a.id, sid) }));
        let earned = 0;
        let possible = 0;
        for (const { a, e } of rows) {
          if (!e || e.t === 'x') continue;
          const pts = Number(a.points) || 0;
          if (e.t === 'a') possible += pts;
          else if (typeof e.s === 'number') {
            earned += e.s;
            possible += pts;
          }
        }
        const pct = possible > 0 ? (earned / possible) * 100 : null;
        return { ...c, weight: Number(weights[c.key]) || 0, rows, earned, possible, pct };
      });
      // A grade type set to 0% (Practice, by default) never changes the grade.
      let pct = null;
      const counted = cats.filter((c) => c.pct != null && c.weight > 0);
      if (counted.length) {
        const total = counted.reduce((s, c) => s + c.weight, 0);
        pct = counted.reduce((s, c) => s + c.pct * c.weight, 0) / total;
      }
      return { mp, cats, pct, weight: mp ? MP_WEIGHT : 0, rows: cats.flatMap((c) => c.rows) };
    });
    const scored = periods.filter((p) => p.mp && p.pct != null);
    let pct = scored.length ? scored.reduce((s, p) => s + p.pct, 0) / scored.length : null;
    if (pct == null) {
      const loose = periods.find((p) => !p.mp);
      if (loose && loose.pct != null) pct = loose.pct;
    }
    return { pct, letter: letterFor(pct), periods };
  }

  function pctChip(pct) {
    if (pct == null) return '<span class="gchip g-none">—</span>';
    const l = letterFor(pct);
    return `<span class="gchip g-${l}"><b>${l}</b> (${fmtPct(pct)})</span>`;
  }

  function entryChip(e, a) {
    if (e.t === 'x') return '<span class="gchip g-x">Exempt</span>';
    if (e.t === 'a') return `<span class="gchip g-E"><b>Absent</b> 0/ ${fmtNum(a.points)}</span>`;
    const l = letterFor((e.s / (Number(a.points) || 1)) * 100);
    return `<span class="gchip g-${l}"><b>${l}</b> ${fmtNum(e.s)}/ ${fmtNum(a.points)}</span>`;
  }

  // ---------- Data helpers ----------

  const KIND = {
    folder: { label: 'Folder', short: 'Folder', add: 'Add Folder' },
    paper: {
      label: 'Paper assignment',
      short: 'Paper Assignment',
      add: 'Add Paper Assignment',
      help: 'Done on paper. You type in each student’s grade.',
    },
    test: {
      label: 'Test',
      short: 'Test',
      add: 'Add Test',
      help: 'Students take the test, then type in the grade they got.',
    },
    link: {
      label: 'Link',
      short: 'Link',
      add: 'Add Link',
      help: 'A link that leads to a test. Students open it, then type in the grade they got.',
    },
  };
  const SUBJECTS = [
    'Art', 'Health Education', 'Homeroom', 'Language Arts', 'Library/Media', 'Mathematics',
    'Music Instrumental', 'Music Vocal', 'Physical Education', 'Science', 'Social Studies',
  ];
  const FOLDER_COLORS = {
    blue: '#5B9BE6', pink: '#EE8BA6', green: '#4FB885', yellow: '#E9BD3C',
    orange: '#F09A4E', purple: '#A47BE0', red: '#E06464', gray: '#98A3B4',
  };

  const courseTitle = (c) => (c.section ? `${c.name}: ${c.section}` : c.name);
  const findItem = (course, id) => (course.items || []).find((i) => i.id === id);
  const childrenOf = (course, parentId) => (course.items || []).filter((i) => (i.parentId || null) === (parentId || null));
  const assignmentsOf = (course) => (course.items || []).filter((i) => i.kind !== 'folder');
  const studentName = (teacher, sid) => ((teacher.students || []).find((s) => s.id === sid) || {}).name;

  function sortItems(list) {
    return [...list].sort((a, b) => {
      const fa = a.kind === 'folder' ? 0 : 1;
      const fb = b.kind === 'folder' ? 0 : 1;
      if (fa !== fb) return fa - fb;
      if (fa === 0) return (a.createdAt || 0) - (b.createdAt || 0);
      return byDue(a, b);
    });
  }

  function ancestors(course, id) {
    const out = [];
    const seen = new Set();
    const start = findItem(course, id);
    let pid = start && start.parentId;
    while (pid && !seen.has(pid)) {
      seen.add(pid);
      const f = findItem(course, pid);
      if (!f) break;
      out.unshift(f);
      pid = f.parentId;
    }
    return out;
  }

  function descendants(course, id) {
    const out = [];
    const stack = [id];
    while (stack.length) {
      const pid = stack.pop();
      for (const i of course.items || []) {
        if (i.parentId !== pid) continue;
        out.push(i.id);
        if (i.kind === 'folder') stack.push(i.id);
      }
    }
    return out;
  }

  function folderOptions(course, excludeId) {
    const skip = new Set(excludeId ? [excludeId, ...descendants(course, excludeId)] : []);
    const out = [];
    const walk = (pid, depth) => {
      for (const f of sortItems(childrenOf(course, pid))) {
        if (f.kind !== 'folder' || skip.has(f.id)) continue;
        out.push({ id: f.id, label: `${' '.repeat(depth)}${f.title}` });
        walk(f.id, depth + 1);
      }
    };
    walk(null, 0);
    return out;
  }

  function inCourse(teacher, course, sid) {
    const list = (teacher.classLists || []).find((l) => l.id === course.classListId);
    return !!list && list.studentIds.includes(sid);
  }

  function rosterOf(teacher, course) {
    const list = (teacher.classLists || []).find((l) => l.id === course.classListId);
    if (!list) return [];
    const byId = new Map((teacher.students || []).map((s) => [s.id, s]));
    return list.studentIds.map((id) => byId.get(id)).filter(Boolean);
  }

  // Students who are on at least one of the teacher's class lists.
  function activeStudents(teacher) {
    const lists = new Map();
    for (const l of teacher.classLists || []) {
      for (const id of l.studentIds) {
        if (!lists.has(id)) lists.set(id, []);
        lists.get(id).push(l.name);
      }
    }
    return (teacher.students || [])
      .filter((s) => lists.has(s.id))
      .map((s) => ({ ...s, lists: lists.get(s.id) }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function courseImage(course) {
    const img = course && course.imageId && Store.get('images', course.imageId);
    return (img && img.data) || DEFAULT_COVER;
  }

  function me() {
    const s = S.session;
    if (!s) return null;
    const teacher = Store.get('teachers', s.teacherId);
    if (!teacher) return null;
    if (s.role === 'student') {
      const student = (teacher.students || []).find((x) => x.id === s.studentId);
      if (!student || !(teacher.classLists || []).some((l) => l.studentIds.includes(student.id))) return null;
      return { role: 'student', teacher, student };
    }
    return { role: 'teacher', teacher };
  }

  function canSee(ctx, course) {
    if (!course || course.teacherId !== ctx.teacher.id) return false;
    if (ctx.role === 'teacher') return true;
    return !!course.visible && inCourse(ctx.teacher, course, ctx.student.id);
  }

  function coursesFor(ctx) {
    return Store.all('courses')
      .filter((c) => canSee(ctx, c))
      .sort((a, b) => a.name.localeCompare(b.name) || (a.section || '').localeCompare(b.section || ''));
  }

  function createCourse(teacherId, d) {
    const id = uid();
    let imageId = null;
    if (d.image) {
      imageId = uid();
      Store.put('images', imageId, { teacherId, data: d.image });
    }
    Store.put('courses', id, {
      id,
      teacherId,
      name: d.name.trim(),
      section: (d.section || '').trim(),
      classListId: d.listId,
      visible: !!d.visible,
      imageId,
      weights: { ...DEFAULT_WEIGHTS },
      year: schoolYear(),
      createdAt: now(),
      items: [],
    });
    Store.put('grades', id, { teacherId, courseId: id, e: {} });
    return id;
  }

  // Saves a pasted class list. Names already on another list keep the same
  // student record, so a student has one login and one set of grades.
  function saveClassList(teacher, listId, name, names) {
    const t = clone(teacher);
    t.students = t.students || [];
    t.classLists = t.classLists || [];
    const byName = new Map(t.students.map((s) => [s.name.toLowerCase(), s]));
    const ids = names.map((n) => {
      let s = byName.get(n.toLowerCase());
      if (!s) {
        s = { id: uid(), name: n };
        t.students.push(s);
        byName.set(n.toLowerCase(), s);
      } else {
        s.name = n;
      }
      return s.id;
    });
    const list = listId && t.classLists.find((l) => l.id === listId);
    if (list) {
      list.name = name;
      list.studentIds = ids;
    } else {
      t.classLists.push({ id: listId || uid(), name, studentIds: ids });
    }
    Store.put('teachers', t.id, t);
    return t;
  }

  function setEntry(courseId, aid, sid, next, by) {
    const course = Store.get('courses', courseId);
    if (!course) return;
    const val = next ? { s: next.t === 'g' ? next.s : null, t: next.t, b: by, at: now() } : null;
    if (Store.get('grades', courseId)) {
      Store.patch('grades', courseId, { e: { [gkey(aid, sid)]: val } });
    } else {
      Store.put('grades', courseId, { teacherId: course.teacherId, courseId, e: { [gkey(aid, sid)]: val } });
    }
  }

  // ---------- Storage ----------

  const DOC_PREFIX = 'kingstar-school/doc/';
  const SESSION_KEY = 'kingstar-school/session';
  const COLS = ['teachers', 'courses', 'grades', 'images'];

  function combineOps(a, b) {
    if (b.op !== 'update') return b;
    if (a.op === 'update') return { op: 'update', patch: deepMerge(a.patch, b.patch) };
    return { op: 'set' };
  }

  const Store = {
    mode: 'loading',
    db: null,
    cols: { teachers: {}, courses: {}, grades: {}, images: {} },
    seenSnap: {},
    queues: {},
    listeners: new Set(),

    get(col, id) {
      return this.cols[col][id];
    },
    all(col) {
      return Object.values(this.cols[col]);
    },
    subscribe(fn) {
      this.listeners.add(fn);
    },
    emit() {
      for (const fn of this.listeners) fn();
    },

    async init() {
      let db = null;
      try {
        if (window.claude && typeof window.claude.use === 'function') db = await window.claude.use('db');
      } catch (_) {
        db = null;
      }
      if (db) {
        try {
          await this.startCloud(db);
          return;
        } catch (err) {
          console.warn('KingstarSchool: the shared database is not available here, so this browser will keep the data.', err);
          for (const unsub of this.unsubs || []) unsub();
          this.db = null;
        }
      }
      this.startLocal();
    },

    startLocal() {
      this.mode = 'local';
      const load = () => {
        for (const col of COLS) this.cols[col] = {};
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(DOC_PREFIX)) this.loadLocalKey(key, localStorage.getItem(key));
          }
        } catch (_) {
          /* storage blocked: start empty */
        }
      };
      load();
      // Another tab (a teacher in one, a student in another) saved something.
      window.addEventListener('storage', (e) => {
        if (e.key === null) load();
        else if (e.key.startsWith(DOC_PREFIX)) this.loadLocalKey(e.key, e.newValue);
        else return;
        this.emit();
      });
    },

    loadLocalKey(key, value) {
      const [col, id] = key.slice(DOC_PREFIX.length).split('/');
      if (!this.cols[col] || !id) return;
      if (value == null) {
        delete this.cols[col][id];
        return;
      }
      try {
        this.cols[col][id] = JSON.parse(value);
      } catch (_) {
        /* ignore a damaged entry */
      }
    },

    startCloud(db) {
      this.db = db;
      this.unsubs = [];
      return new Promise((resolve, reject) => {
        const ready = new Set();
        let settled = false;
        const finish = () => {
          settled = true;
          this.mode = 'cloud';
          resolve();
        };
        const timer = setTimeout(() => {
          if (!settled) finish();
        }, 15000);
        for (const col of COLS) {
          const unsub = db.collection(col).onSnapshot(
            (snap) => {
              this.applySnap(col, snap);
              if (settled) {
                this.emit();
                return;
              }
              ready.add(col);
              if (ready.size === COLS.length) {
                clearTimeout(timer);
                finish();
              }
            },
            (err) => {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(err);
              } else {
                console.warn('KingstarSchool: live updates stopped.', err);
                toast('Live updates stopped. Reload the page to see new changes.', 'error');
              }
            }
          );
          this.unsubs.push(unsub);
        }
      });
    },

    applySnap(col, snap) {
      const next = {};
      for (const d of snap.docs) {
        const path = `${col}/${d.id}`;
        if (this.queues[path]) {
          // This document has local changes on their way; keep them on screen.
          const local = this.cols[col][d.id];
          if (local !== undefined) next[d.id] = local;
          continue;
        }
        if (this.seenSnap[path] === d && this.cols[col][d.id] !== undefined) {
          next[d.id] = this.cols[col][d.id];
        } else {
          next[d.id] = clone(d.data());
          this.seenSnap[path] = d;
        }
      }
      for (const [id, doc] of Object.entries(this.cols[col])) {
        if (!(id in next) && this.queues[`${col}/${id}`] && doc !== undefined) next[id] = doc;
      }
      this.cols[col] = next;
    },

    put(col, id, body) {
      this.cols[col][id] = body;
      this.persist(col, id, { op: 'set' });
    },
    patch(col, id, patch) {
      this.cols[col][id] = deepMerge(this.cols[col][id], patch);
      this.persist(col, id, { op: 'update', patch: clone(patch) });
    },
    remove(col, id) {
      delete this.cols[col][id];
      this.persist(col, id, { op: 'delete' });
    },

    persist(col, id, op) {
      this.emit();
      if (this.mode !== 'cloud') {
        const key = `${DOC_PREFIX}${col}/${id}`;
        try {
          if (op.op === 'delete') localStorage.removeItem(key);
          else localStorage.setItem(key, JSON.stringify(this.cols[col][id]));
        } catch (err) {
          const full = err && (err.name === 'QuotaExceededError' || err.code === 22);
          toast(full ? 'This browser is out of room. Try smaller course pictures.' : 'This browser would not save that change.', 'error');
        }
        return;
      }
      const path = `${col}/${id}`;
      const q = this.queues[path] || (this.queues[path] = { next: null, busy: false });
      q.next = q.next ? combineOps(q.next, op) : op;
      if (!q.busy) this.flush(col, id);
    },

    // Sends one document's changes one write at a time, then re-reads it so
    // anything another viewer wrote meanwhile shows up.
    async flush(col, id) {
      const path = `${col}/${id}`;
      const q = this.queues[path];
      q.busy = true;
      for (;;) {
        while (q.next) {
          const op = q.next;
          q.next = null;
          await this.exec(col, id, op);
        }
        let snap = null;
        try {
          snap = await this.db.doc(path).get();
        } catch (_) {
          snap = null;
        }
        if (q.next) continue;
        if (snap) {
          if (snap.exists) this.cols[col][id] = clone(snap.data());
          else delete this.cols[col][id];
          this.seenSnap[path] = null;
        }
        break;
      }
      delete this.queues[path];
      this.emit();
    },

    async exec(col, id, op, retried) {
      const ref = this.db.doc(`${col}/${id}`);
      try {
        if (op.op === 'delete') {
          await ref.delete();
        } else if (op.op === 'update') {
          try {
            await ref.update(op.patch);
          } catch (err) {
            const body = this.cols[col][id];
            if (err && err.code === 'invalid_argument' && body) await ref.set(clone(body));
            else throw err;
          }
        } else {
          const body = this.cols[col][id];
          if (body) await ref.set(clone(body));
          else await ref.delete();
        }
      } catch (err) {
        if (!retried && err && err.code === 'unavailable') {
          await wait(400 + Math.random() * 800);
          return this.exec(col, id, op, true);
        }
        console.warn('KingstarSchool: save failed', err);
        const code = err && err.code;
        toast(
          code === 'quota_exceeded'
            ? 'KingstarSchool is full. Delete old courses or pictures to make room.'
            : code === 'invalid_argument'
              ? 'That change was not saved. You may only have permission to view this page.'
              : 'That change was not saved. Check your connection and try again.',
          'error'
        );
      }
      return undefined;
    },
  };

  // ---------- App state ----------

  const S = {
    booting: true,
    session: null, // { role: 'teacher', teacherId } or { role: 'student', teacherId, studentId }
    route: { name: 'home' },
    wizard: null,
    modal: null,
    pop: null,
    ui: {
      filter: { type: 'all', q: '' },
      gb: { mp: 'all', cat: 'all', q: '' },
      courseQ: '',
      open: {},
      reportTab: 'current',
      loginTeacherId: null,
      loginPass: '',
      loginError: '',
      studentTeacherId: null,
      studentQ: '',
      myScore: '',
      myScoreError: '',
      settings: null,
    },
  };

  function saveSession() {
    try {
      if (S.session) localStorage.setItem(SESSION_KEY, JSON.stringify({ session: S.session, route: S.route }));
      else localStorage.removeItem(SESSION_KEY);
    } catch (_) {
      /* storage blocked */
    }
  }
  function loadSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
    } catch (_) {
      return null;
    }
  }

  function go(route) {
    const prev = S.route;
    if (route.courseId !== prev.courseId) {
      S.ui.filter = { type: 'all', q: '' };
      S.ui.gb = { mp: 'all', cat: 'all', q: '' };
    }
    S.ui.myScore = '';
    S.ui.myScoreError = '';
    if (route.name === 'settings') initSettings(route.courseId);
    S.route = route;
    closePop();
    saveSession();
    render();
    window.scrollTo(0, 0);
  }

  function initSettings(courseId) {
    const c = Store.get('courses', courseId);
    if (!c) return;
    S.ui.settings = {
      name: c.name,
      section: c.section || '',
      listId: c.classListId,
      visible: !!c.visible,
      weights: { ...DEFAULT_WEIGHTS, ...(c.weights || {}) },
      image: undefined,
      error: '',
    };
  }

  function logout() {
    S.session = null;
    S.ui.loginTeacherId = null;
    S.ui.loginPass = '';
    S.ui.loginError = '';
    S.ui.studentTeacherId = null;
    S.ui.studentQ = '';
    S.ui.open = {};
    closeModal();
    go({ name: 'home' });
  }

  // ---------- Notifications ----------

  const seenKey = (ctx) => `kingstar-school/seen/${ctx.teacher.id}/${ctx.role === 'student' ? ctx.student.id : 'teacher'}`;
  function getSeen(ctx) {
    try {
      return Number(localStorage.getItem(seenKey(ctx))) || 0;
    } catch (_) {
      return 0;
    }
  }
  function setSeen(ctx) {
    try {
      localStorage.setItem(seenKey(ctx), String(now()));
    } catch (_) {
      /* storage blocked */
    }
  }

  function notifications(ctx) {
    const list = [];
    for (const c of coursesFor(ctx)) {
      const items = assignmentsOf(c);
      if (ctx.role === 'student') {
        for (const a of items) {
          const to = { course: c.id, item: a.id };
          if (a.createdAt) {
            list.push({ at: a.createdAt, icon: 'posted', to, html: `<b>${esc(courseTitle(c))}</b> posted ${esc(a.title)}` });
          }
          const e = entryOf(c.id, a.id, ctx.student.id);
          if (e && e.b === 't' && e.at) {
            list.push({ at: e.at, icon: 'grade', to, html: `A new grade was posted for <b>${esc(a.title)}</b>` });
          }
        }
      } else {
        const g = Store.get('grades', c.id);
        if (!g || !g.e) continue;
        const byId = new Map(items.map((a) => [a.id, a]));
        for (const [key, e] of Object.entries(g.e)) {
          if (!e || e.b !== 's' || !e.at) continue;
          const [aid, sid] = key.split('_');
          const a = byId.get(aid);
          if (!a) continue;
          const who = studentName(ctx.teacher, sid) || 'A student';
          list.push({
            at: e.at,
            icon: 'grade',
            to: { course: c.id, item: a.id },
            html: `<b>${esc(who)}</b> turned in a grade for <b>${esc(a.title)}</b> in ${esc(courseTitle(c))}`,
          });
        }
      }
    }
    return list.sort((a, b) => b.at - a.at).slice(0, 30);
  }

  // ---------- Icons and pictures ----------

  const ICONS = {
    bell: '<path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    chevDown: '<path d="M6 9l6 6 6-6"/>',
    chevRight: '<path d="M9 6l6 6-6 6"/>',
    chevLeft: '<path d="M15 6l-6 6 6 6"/>',
    back: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    dots: '<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
    eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    eyeOff: '<path d="M3 3l18 18"/><path d="M10.6 5.6A9.7 9.7 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.4 6.9C3.9 8.6 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1"/><path d="M9.9 10a2.8 2.8 0 0 0 4 4"/>',
    materials: '<rect x="4.5" y="3.5" width="15" height="17" rx="1.5"/><path d="M8 8h8M8 12h8M8 16h5"/>',
    grades: '<path d="M5 20v-8M10 20V5M15 20v-6M20 20V9"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 13.5a7.6 7.6 0 0 0 0-3l2-1.6-2-3.4-2.4 1a7.6 7.6 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.5A7.6 7.6 0 0 0 7 6.5l-2.4-1-2 3.4 2 1.6a7.6 7.6 0 0 0 0 3l-2 1.6 2 3.4 2.4-1a7.6 7.6 0 0 0 2.6 1.5l.4 2.5h4l.4-2.5a7.6 7.6 0 0 0 2.6-1.5l2.4 1 2-3.4z"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17.5" cy="9" r="2.5"/><path d="M16.5 14.3A5 5 0 0 1 21.5 19"/>',
    image: '<rect x="3" y="4.5" width="18" height="15" rx="2"/><circle cx="8.5" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 8.5"/>',
    trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13"/>',
    pencil: '<path d="M4 20l1-4.5L16 4.5l3.5 3.5-11 11z"/><path d="M13.5 7l3.5 3.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    logout: '<path d="M14.5 4H19a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4.5"/><path d="M10 16.5L5.5 12 10 7.5M5.5 12H16"/>',
    board: '<rect x="3" y="4" width="18" height="12" rx="1.5"/><path d="M8.5 20l2-4M15.5 20l-2-4M7 8.5h6M7 11.5h4"/>',
    cap: '<path d="M2 9.5L12 5l10 4.5-10 4.5z"/><path d="M6 11.3V16c2.5 2.2 9.5 2.2 12 0v-4.7"/><path d="M22 9.5v5"/>',
    triLeft: '<path d="M15 6l-7 6 7 6z" fill="currentColor"/>',
    triRight: '<path d="M9 6l7 6-7 6z" fill="currentColor"/>',
    posted: '<path d="M4 20l1-4.5L16 4.5l3.5 3.5-11 11z"/><path d="M13.5 7l3.5 3.5"/>',
    grade: '<path d="M4 12.5l4.5 4.5L20 5.5"/><path d="M4 20h16"/>',
  };
  const ic = (name, cls = '') =>
    `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  function kindIcon(kind, color) {
    if (kind === 'folder') {
      const c = color && color.startsWith('#') ? color : FOLDER_COLORS[color] || FOLDER_COLORS.blue;
      return `<svg class="kic kic-folder" viewBox="0 0 28 24" aria-hidden="true"><path d="M1.5 5A2 2 0 0 1 3.5 3h7l2.5 2.5h11.5a2 2 0 0 1 2 2V19a2 2 0 0 1-2 2h-21a2 2 0 0 1-2-2z" fill="${c}"/><path d="M1.5 9.5h25" stroke="#fff" stroke-opacity=".4" stroke-width="1.2"/></svg>`;
    }
    if (kind === 'test') {
      return '<svg class="kic" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="4" fill="#B846B0"/><path d="M5.5 7.8h5M5.5 10.6h5M5.5 14.6h5M5.5 17.4h5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M13.6 9.3l1.9 1.9 3.3-3.8" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.2 14.2l3.6 3.6M17.8 14.2l-3.6 3.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/></svg>';
    }
    if (kind === 'link') {
      return '<svg class="kic" viewBox="0 0 24 24" aria-hidden="true"><rect x="1" y="1" width="22" height="22" rx="4" fill="#0F78B5"/><path d="M8 16L16 8M10 8h6v6" stroke="#fff" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    }
    return '<svg class="kic" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 1.8h9.2L19 6.6v15.6H5z" fill="var(--paper-bg)" stroke="var(--paper-ink)" stroke-width="1.3" stroke-linejoin="round"/><path d="M14 1.8v5h5" fill="none" stroke="var(--paper-ink)" stroke-width="1.3" stroke-linejoin="round"/><path d="M7.8 10.5h7.4M7.8 13.5h7.4M7.8 16.5h3.6" stroke="var(--paper-ink)" stroke-width="1.2" stroke-linecap="round"/><path d="M12.6 21.6l.9-3.1 6.6-6.6 2.2 2.2-6.6 6.6z" fill="#F2B51D" stroke="#8A5A00" stroke-width=".9" stroke-linejoin="round"/></svg>';
  }

  const STAR = 'M16 5.2l3.2 6.5 7.2 1-5.2 5.1 1.2 7.1L16 21.5l-6.4 3.4 1.2-7.1-5.2-5.1 7.2-1z';
  const logoMark = () =>
    `<svg class="logo" viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="8" fill="#1B2D5E"/><path d="${STAR}" fill="#F4BE2E"/></svg>`;

  // The blank course picture.
  const DEFAULT_COVER = (() => {
    const lines = [];
    for (let y = 50; y <= 170; y += 20) {
      lines.push(`<path d="M418 ${y}q9-6 18 0t18 0t18 0t18 0"/>`);
      lines.push(`<path d="M506 ${y}q9-6 18 0t18 0t18 0t18 0"/>`);
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 200" preserveAspectRatio="xMidYMid slice">
<rect width="680" height="200" fill="#1E74C6"/>
<g fill="none" stroke="#1561AA" stroke-width="13" stroke-linecap="round">
<path d="M-20 52c28-20 56 20 84 0s56-20 84 0 56 20 84 0"/>
<path d="M110 178c28-20 56 20 84 0s56-20 84 0"/>
<path d="M560 38c28-20 56 20 84 0s56-20 84 0"/>
</g>
<path d="M226 200l96-150 108 150z" fill="#3D8EDB"/>
<path d="M300 200l60-94 68 94z" fill="#63AAEB"/>
<path d="M586 200l64-102 66 102z" fill="#3D8EDB"/>
<g transform="rotate(13 490 110)">
<rect x="404" y="22" width="86" height="172" rx="3" fill="#FFFFFF"/>
<rect x="492" y="22" width="86" height="172" rx="3" fill="#EEF4FB"/>
<g fill="none" stroke="#8FA8C6" stroke-width="3" stroke-linecap="round">${lines.join('')}</g>
</g>
<g transform="rotate(-30 250 110)">
<rect x="184" y="102" width="110" height="16" rx="2" fill="#1A2B52"/>
<path d="M294 102l26 8-26 8z" fill="#E9C58E"/>
<path d="M311 107.2l9 2.8-9 2.8z" fill="#1A2B52"/>
<rect x="168" y="102" width="16" height="16" rx="2" fill="#F2B51D"/>
</g>
<path transform="translate(58 58) scale(2.3)" d="${STAR}" fill="#F6C343"/>
</svg>`;
    return `data:image/svg+xml,${encodeURIComponent(svg)}`;
  })();

  // Shrinks an uploaded picture so it fits comfortably in storage.
  function readImage(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) {
        reject(new Error('Pick a picture file, like a JPG or PNG.'));
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('That picture could not be opened.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('That picture could not be opened.'));
        img.onload = () => {
          let scale = Math.min(1, 720 / img.width, 420 / img.height);
          for (let tries = 0; tries < 4; tries++) {
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(img.width * scale));
            canvas.height = Math.max(1, Math.round(img.height * scale));
            const g = canvas.getContext('2d');
            g.fillStyle = '#ffffff';
            g.fillRect(0, 0, canvas.width, canvas.height);
            g.drawImage(img, 0, 0, canvas.width, canvas.height);
            const url = canvas.toDataURL('image/jpeg', tries ? 0.65 : 0.8);
            if (url.length < 170000) {
              resolve(url);
              return;
            }
            scale *= 0.7;
          }
          reject(new Error('That picture is too big. Try a smaller one.'));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  // ---------- Rendering ----------

  let rafId = 0;
  function scheduleRender() {
    if (rafId) return;
    rafId = requestAnimationFrame(() => {
      rafId = 0;
      render();
    });
  }

  function captureFocus(root) {
    const keep = { scroll: [] };
    for (const el of $$('[data-keep-scroll]', root)) keep.scroll.push([el.id, el.scrollLeft, el.scrollTop]);
    const a = document.activeElement;
    if (a && a.id && root.contains(a)) {
      keep.id = a.id;
      if (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && a.type !== 'file' && a.type !== 'checkbox' && a.type !== 'radio')) {
        keep.value = a.value;
        try {
          keep.sel = [a.selectionStart, a.selectionEnd];
        } catch (_) {
          keep.sel = null;
        }
      }
    }
    return keep;
  }

  function restoreFocus(keep) {
    for (const [id, left, top] of keep.scroll) {
      const el = id && document.getElementById(id);
      if (el) {
        el.scrollLeft = left;
        el.scrollTop = top;
      }
    }
    if (!keep.id) return;
    const el = document.getElementById(keep.id);
    if (!el) return;
    if (keep.value !== undefined && el.value !== keep.value) el.value = keep.value;
    el.focus({ preventScroll: true });
    if (keep.sel && keep.sel[0] != null && el.setSelectionRange) {
      try {
        el.setSelectionRange(keep.sel[0], keep.sel[1]);
      } catch (_) {
        /* not a text field */
      }
    }
  }

  // Replacing a focused, edited field can fire a stray `change` event with a
  // half-typed value; events that arrive while the DOM is swapped are ignored.
  let swapping = false;
  function swapHtml(el, html) {
    swapping = true;
    try {
      el.innerHTML = html;
    } finally {
      swapping = false;
    }
  }

  function render() {
    const app = $('#app');
    const keep = captureFocus(app);
    swapHtml(app, S.booting ? viewBoot() : screen());
    restoreFocus(keep);
    if (S.pop) renderPop();
  }

  function focusId(id) {
    requestAnimationFrame(() => {
      const el = document.getElementById(id);
      if (el) el.focus();
    });
  }

  function toast(msg, kind = '') {
    const root = $('#toast-root');
    if (!root) return;
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.textContent = msg;
    root.appendChild(el);
    while (root.children.length > 3) root.firstElementChild.remove();
    setTimeout(() => el.remove(), kind === 'error' ? 5200 : 3200);
  }

  function screen() {
    const ctx = me();
    if (!ctx) {
      if (S.session) {
        S.session = null;
        saveSession();
      }
      return viewAuth();
    }
    return `${topbar(ctx)}<main class="page" id="main">${viewFor(ctx)}</main>`;
  }

  function viewBoot() {
    return `<div class="boot"><div class="boot-inner">${logoMark()}<p>Opening KingstarSchool…</p></div></div>`;
  }

  function viewFor(ctx) {
    const r = S.route;
    const isT = ctx.role === 'teacher';
    if (r.name === 'report') return isT ? viewCourses(ctx) : viewReport(ctx);
    if (r.name === 'classlists') return isT ? viewClassLists(ctx) : viewCourses(ctx);
    if (['course', 'assignment', 'gradebook', 'grades', 'settings'].includes(r.name)) {
      const course = Store.get('courses', r.courseId);
      if (!canSee(ctx, course)) return viewCourses(ctx);
      if (r.name === 'assignment') {
        const a = findItem(course, r.itemId);
        return a && a.kind !== 'folder' ? viewAssignment(ctx, course, a) : viewCourse(ctx, course);
      }
      if (r.name === 'gradebook') return isT ? viewGradebook(ctx, course) : viewStudentGrades(ctx, course);
      if (r.name === 'grades') return isT ? viewGradebook(ctx, course) : viewStudentGrades(ctx, course);
      if (r.name === 'settings') {
        if (!isT) return viewCourse(ctx, course);
        if (!S.ui.settings) initSettings(course.id);
        return viewSettings(ctx, course);
      }
      return viewCourse(ctx, course);
    }
    return viewCourses(ctx);
  }

  // ---------- Views: sign in ----------

  function viewAuth() {
    const r = S.route.name;
    if (r === 'teacher-login') return viewTeacherLogin();
    if (r === 'student-login') return viewStudentLogin();
    if (r === 'create' && S.wizard) return viewCreate();
    return viewHome();
  }

  function brandLine() {
    return `<div class="auth-brand">${logoMark()}<span class="brand-word"><b>Kingstar</b>School</span></div>`;
  }

  function storageNote() {
    return Store.mode === 'cloud'
      ? 'Everything is saved to this KingstarSchool page, so it is here the next time you open it.'
      : 'Everything is saved in this browser, so it is here the next time you open KingstarSchool on this device.';
  }

  function scaleTable() {
    return `<table class="scale"><tbody>${SCALE.map(
      (s) => `<tr><td class="letter g-${s.l}">${s.l}</td><td>${esc(s.text)}</td></tr>`
    ).join('')}</tbody></table>`;
  }

  function viewHome() {
    return `<main class="auth">
      <section class="auth-panel">
        ${brandLine()}
        <h1 class="auth-title">Sign in</h1>
        <p class="auth-lede">Choose who is signing in to see courses, assignments and grades.</p>
        <div class="role-grid">
          <button type="button" class="role-card" data-act="nav" data-to="teacher-login">
            <span class="role-ic">${ic('board')}</span>
            <span class="role-name">Teacher</span>
            <span class="role-desc">Open your saved account, or create a new one.</span>
          </button>
          <button type="button" class="role-card" data-act="nav" data-to="student-login">
            <span class="role-ic">${ic('cap')}</span>
            <span class="role-name">Student</span>
            <span class="role-desc">Pick your teacher, then find your name.</span>
          </button>
        </div>
        <p class="auth-foot">${esc(storageNote())}</p>
      </section>
      <aside class="auth-aside" aria-label="How grades work">
        <h2 class="aside-h">Grading scale</h2>
        ${scaleTable()}
        <p class="aside-note">A score right on a line gets the higher grade.</p>
        <h2 class="aside-h">Assignment types</h2>
        <ul class="legend">
          <li>${kindIcon('paper')}<span><b>Paper</b> Done on paper. The teacher types in the grade.</span></li>
          <li>${kindIcon('test')}<span><b>Test</b> Take the test, then type in the grade you got.</span></li>
          <li>${kindIcon('link')}<span><b>Link</b> Opens a test. Take it, then type in the grade you got.</span></li>
        </ul>
      </aside>
    </main>`;
  }

  function viewTeacherLogin() {
    const teachers = Store.all('teachers').sort((a, b) => a.name.localeCompare(b.name));
    const sel = S.ui.loginTeacherId;
    const rows = teachers
      .map((t) => {
        const n = Store.all('courses').filter((c) => c.teacherId === t.id).length;
        const open = sel === t.id && !!t.pass;
        return `<li class="acct${sel === t.id ? ' is-on' : ''}">
          <button type="button" class="acct-row" id="acct-${t.id}" data-act="pick-teacher" data-id="${t.id}"${t.pass ? ` aria-expanded="${open}"` : ''}>
            <span class="avatar lg">${esc(initials(t.name))}</span>
            <span class="acct-text"><b>${esc(t.name)}</b><small>${esc(t.school || 'No school name')} · ${plural(n, 'course')}</small></span>
            ${ic('chevRight', 'acct-chev')}
          </button>
          ${open ? `<form class="acct-pass" data-form="teacher-login" novalidate>
              <label class="field" for="login-pass"><span>Password</span><input id="login-pass" type="password" autocomplete="current-password" data-ui="loginPass" value="${esc(S.ui.loginPass)}"></label>
              ${S.ui.loginError ? `<p class="form-error" role="alert">${esc(S.ui.loginError)}</p>` : ''}
              <button type="submit" class="btn primary">Open my account</button>
            </form>` : ''}
        </li>`;
      })
      .join('');
    return `<main class="auth single">
      <section class="auth-panel">
        <button type="button" class="linkbtn back" data-act="nav" data-to="home">${ic('chevLeft')} Back</button>
        <h1 class="auth-title">Teacher sign in</h1>
        <p class="auth-lede">Pick your saved account to pick up where you left off.</p>
        ${teachers.length ? `<ul class="acct-list">${rows}</ul>` : '<div class="empty slim"><p>No teacher accounts yet. Create one to get started.</p></div>'}
        <button type="button" class="btn primary wide" data-act="start-create">${ic('plus')} Create a teacher account</button>
      </section>
    </main>`;
  }

  function viewStudentLogin() {
    const t = S.ui.studentTeacherId && Store.get('teachers', S.ui.studentTeacherId);
    if (!t) {
      const teachers = Store.all('teachers').sort((a, b) => a.name.localeCompare(b.name));
      const rows = teachers
        .map((x) => {
          const n = activeStudents(x).length;
          return `<li class="acct"><button type="button" class="acct-row" data-act="pick-student-teacher" data-id="${x.id}">
            <span class="avatar lg">${esc(initials(x.name))}</span>
            <span class="acct-text"><b>${esc(x.name)}</b><small>${esc(x.school || 'No school name')} · ${plural(n, 'student')}</small></span>
            ${ic('chevRight', 'acct-chev')}
          </button></li>`;
        })
        .join('');
      return `<main class="auth single">
        <section class="auth-panel">
          <button type="button" class="linkbtn back" data-act="nav" data-to="home">${ic('chevLeft')} Back</button>
          <h1 class="auth-title">Student sign in</h1>
          <p class="auth-lede">Step 1 of 2: pick your teacher's file.</p>
          ${teachers.length ? `<ul class="acct-list">${rows}</ul>` : '<div class="empty slim"><p>There are no teacher files yet. Ask your teacher to create their KingstarSchool account first.</p></div>'}
        </section>
      </main>`;
    }
    const q = S.ui.studentQ.trim().toLowerCase();
    const all = activeStudents(t);
    const students = all.filter((s) => !q || s.name.toLowerCase().includes(q));
    return `<main class="auth single">
      <section class="auth-panel">
        <button type="button" class="linkbtn back" data-act="student-back">${ic('chevLeft')} Pick a different teacher</button>
        <h1 class="auth-title">Find your name</h1>
        <p class="auth-lede">Step 2 of 2: tap your name on ${esc(t.name)}'s class list.</p>
        ${all.length > 8 ? `<label class="search wide" for="student-q">${ic('search')}<input id="student-q" type="search" placeholder="Search for your name" autocomplete="off" data-ui="studentQ" data-live value="${esc(S.ui.studentQ)}"></label>` : ''}
        ${all.length ? `<ul class="name-grid">${students
          .map(
            (s) => `<li><button type="button" class="name-btn" data-act="login-student" data-id="${s.id}">
              <span class="avatar">${esc(initials(s.name))}</span>
              <span class="acct-text"><b>${esc(s.name)}</b><small>${esc(s.lists.join(', '))}</small></span>
            </button></li>`
          )
          .join('')}</ul>${students.length ? '' : '<p class="muted pad">No names match that search.</p>'}` : '<div class="empty slim"><p>This teacher has not added any students yet.</p></div>'}
      </section>
    </main>`;
  }

  // ---------- Views: create a teacher account ----------

  function newWizard() {
    return {
      step: 1,
      name: '',
      school: '',
      pass: '',
      lists: [{ id: uid(), name: '', text: '' }],
      grade: '',
      section: '',
      custom: '',
      courses: [],
      error: '',
    };
  }

  function newPick(w, key, name) {
    const grade = w.grade.trim();
    const full = grade && !name.toLowerCase().includes(grade.toLowerCase()) ? `${name} ${grade}` : name;
    return { key, name: full, section: w.section.trim(), listId: w.lists[0].id, visible: true, image: null };
  }

  function coverPicker(image, id, fileKind, blankAct, extra = '') {
    return `<div class="field"><span>Course picture</span>
      <div class="cover-edit">
        <img src="${esc(image || DEFAULT_COVER)}" alt="">
        <div class="cover-btns">
          <input class="sr-only" type="file" accept="image/*" id="${id}" data-file="${fileKind}" ${extra}>
          <label class="btn small" for="${id}">${ic('image')} ${image ? 'Change picture' : 'Add picture'}</label>
          ${image ? `<button type="button" class="btn small ghost" data-act="${blankAct}" ${extra}>Use blank picture</button>` : '<small class="muted">Using the blank picture</small>'}
        </div>
      </div>
    </div>`;
  }

  function viewCreate() {
    const w = S.wizard;
    const steps = ['Your account', 'Class lists', 'Courses'];
    const body = w.step === 1 ? wizAccount(w) : w.step === 2 ? wizLists(w) : wizCourses(w);
    return `<main class="auth single wide">
      <section class="auth-panel" data-scope="wizard">
        <button type="button" class="linkbtn back" data-act="nav" data-to="teacher-login">${ic('chevLeft')} Back to sign in</button>
        <h1 class="auth-title">Create a teacher account</h1>
        <ol class="stepper">${steps
          .map((s, i) => {
            const n = i + 1;
            const cls = n === w.step ? 'is-on' : n < w.step ? 'is-done' : '';
            return `<li class="${cls}"${n === w.step ? ' aria-current="step"' : ''}><span class="step-n">${n < w.step ? ic('check') : n}</span>${s}</li>`;
          })
          .join('')}</ol>
        <form data-form="wizard" novalidate>
          ${body}
          ${w.error ? `<p class="form-error" role="alert">${esc(w.error)}</p>` : ''}
          <div class="wiz-foot">
            ${w.step > 1 ? '<button type="button" class="btn" data-act="wiz-back">Back</button>' : '<span></span>'}
            <button type="submit" class="btn primary">${w.step < 3 ? 'Next' : 'Create account'}</button>
          </div>
        </form>
      </section>
    </main>`;
  }

  function wizAccount(w) {
    return `<div class="fields">
      <label class="field" for="w-name"><span>Your name <em>(students see this)</em></span>
        <input id="w-name" data-bind="name" value="${esc(w.name)}" placeholder="Ms. Rivera" autocomplete="off"></label>
      <label class="field" for="w-school"><span>School</span>
        <input id="w-school" data-bind="school" value="${esc(w.school)}" placeholder="Kingstar Elementary" autocomplete="off"></label>
      <label class="field" for="w-pass"><span>Password <em>(optional)</em></span>
        <input id="w-pass" type="password" data-bind="pass" value="${esc(w.pass)}" autocomplete="new-password">
        <small>Leave it blank if you don't want one. Students never need it.</small></label>
    </div>`;
  }

  function wizLists(w) {
    return `<p class="wiz-lede">Paste in your class list, one student per line. If you have two classes that take different courses, add a second class list. In the next step you pick which list each course uses.</p>
      <div class="lists">${w.lists
        .map((l, i) => {
          const n = parseNames(l.text).length;
          return `<fieldset class="wl">
            <div class="wl-head">
              <label class="field grow" for="wl-name-${i}"><span>Class list name</span>
                <input id="wl-name-${i}" data-bind="lists.${i}.name" value="${esc(l.name)}" placeholder="${i ? 'Math Sec 051' : 'Homeroom 052'}" autocomplete="off"></label>
              ${w.lists.length > 1 ? `<button type="button" class="btn small ghost danger" data-act="wiz-remove-list" data-index="${i}">${ic('trash')} Remove</button>` : ''}
            </div>
            <label class="field" for="wl-text-${i}"><span>Students</span>
              <textarea id="wl-text-${i}" rows="8" data-bind="lists.${i}.text" data-count="wl-count-${i}" placeholder="Jordan Lee&#10;Maya Patel&#10;Chris Walker">${esc(l.text)}</textarea></label>
            <p class="count" id="wl-count-${i}">${plural(n, 'student')}</p>
          </fieldset>`;
        })
        .join('')}</div>
      <button type="button" class="btn ghost" data-act="wiz-add-list">${ic('plus')} Add another class list</button>`;
  }

  function wizCourses(w) {
    const picked = new Set(w.courses.map((c) => c.key));
    return `<p class="wiz-lede">Pick your courses. Each one starts with a blank picture, or you can add your own.</p>
      <div class="field-row">
        <label class="field" for="w-grade"><span>Grade</span><input id="w-grade" data-bind="grade" value="${esc(w.grade)}" placeholder="Grade 5" autocomplete="off"></label>
        <label class="field" for="w-section"><span>Section</span><input id="w-section" data-bind="section" value="${esc(w.section)}" placeholder="Sec 052" autocomplete="off"></label>
      </div>
      <p class="hint">Grade and section fill in for each course you pick next. You can still change them on each course.</p>
      <div class="chips" role="group" aria-label="Courses">${SUBJECTS.map(
        (s, i) => `<button type="button" id="chip-${i}" class="chip${picked.has(s) ? ' on' : ''}" aria-pressed="${picked.has(s)}" data-act="wiz-toggle-subject" data-subject="${esc(s)}">${ic(picked.has(s) ? 'check' : 'plus')}${esc(s)}</button>`
      ).join('')}</div>
      <div class="custom-add">
        <label class="sr-only" for="w-custom">Another course</label>
        <input id="w-custom" class="ctl" data-bind="custom" value="${esc(w.custom)}" placeholder="Another course, like Spanish" autocomplete="off">
        <button type="button" class="btn" data-act="wiz-add-custom">${ic('plus')} Add</button>
      </div>
      ${w.courses.length ? `<div class="picked">${w.courses.map((c, i) => pickRow(w, c, i)).join('')}</div>` : '<p class="muted pad">No courses picked yet. You can also add courses later.</p>'}`;
  }

  function pickRow(w, c, i) {
    return `<div class="pick">
      <img class="pick-cover" src="${esc(c.image || DEFAULT_COVER)}" alt="">
      <div class="pick-fields">
        <div class="field-row">
          <label class="field grow" for="wc-name-${i}"><span>Course name</span><input id="wc-name-${i}" data-bind="courses.${i}.name" value="${esc(c.name)}" autocomplete="off"></label>
          <label class="field narrow" for="wc-sec-${i}"><span>Section</span><input id="wc-sec-${i}" data-bind="courses.${i}.section" value="${esc(c.section)}" autocomplete="off"></label>
        </div>
        <div class="field-row align-end">
          <label class="field" for="wc-list-${i}"><span>Class list</span><select id="wc-list-${i}" data-bind="courses.${i}.listId">${w.lists
            .map((l, j) => opt(l.id, l.name.trim() || `Class list ${j + 1}`, c.listId))
            .join('')}</select></label>
          <label class="check" for="wc-vis-${i}"><input type="checkbox" id="wc-vis-${i}" data-bind="courses.${i}.visible"${c.visible ? ' checked' : ''}> Students can see this course</label>
        </div>
        <div class="pick-actions">
          <input class="sr-only" type="file" accept="image/*" id="wc-img-${i}" data-file="wizard" data-index="${i}">
          <label class="btn small" for="wc-img-${i}">${ic('image')} ${c.image ? 'Change picture' : 'Add picture'}</label>
          ${c.image ? `<button type="button" class="btn small ghost" data-act="wiz-blank" data-index="${i}">Use blank picture</button>` : '<small class="muted">Blank picture</small>'}
          <button type="button" class="btn small ghost danger push" data-act="wiz-remove-course" data-index="${i}">${ic('trash')} Remove</button>
        </div>
      </div>
    </div>`;
  }

  function finishWizard() {
    const w = S.wizard;
    const tid = uid();
    const teacher = {
      id: tid,
      name: w.name.trim(),
      school: w.school.trim(),
      pass: hashPass(tid, w.pass),
      createdAt: now(),
      students: [],
      classLists: [],
    };
    // Students who are on more than one class list share one record.
    const byName = new Map();
    teacher.classLists = w.lists.map((l, i) => ({
      id: l.id,
      name: l.name.trim() || `Class list ${i + 1}`,
      studentIds: parseNames(l.text).map((n) => {
        const key = n.toLowerCase();
        if (!byName.has(key)) {
          const s = { id: uid(), name: n };
          byName.set(key, s);
          teacher.students.push(s);
        }
        return byName.get(key).id;
      }),
    }));
    Store.put('teachers', tid, teacher);
    for (const c of w.courses) createCourse(tid, c);
    S.wizard = null;
    S.session = { role: 'teacher', teacherId: tid };
    go({ name: 'courses' });
    toast(`Welcome to KingstarSchool, ${w.name.trim()}!`);
  }

  // ---------- Views: top bar ----------

  function topbar(ctx) {
    const name = ctx.role === 'teacher' ? ctx.teacher.name : ctx.student.name;
    const seen = getSeen(ctx);
    const unread = notifications(ctx).filter((n) => n.at > seen).length;
    const r = S.route.name;
    const inCourses = ['courses', 'course', 'assignment', 'gradebook', 'grades', 'settings'].includes(r);
    return `<header class="topbar"><div class="topbar-inner">
      <button type="button" class="brand" data-act="nav" data-to="courses" aria-label="KingstarSchool, my courses">${logoMark()}<span class="brand-word"><b>Kingstar</b>School</span></button>
      <nav class="mainnav" aria-label="Main">
        <button type="button" class="navbtn${inCourses ? ' is-on' : ''}" data-act="pop" data-pop="courses" aria-haspopup="true">Courses ${ic('chevDown')}</button>
        ${ctx.role === 'teacher'
          ? `<button type="button" class="navbtn${r === 'classlists' ? ' is-on' : ''}" data-act="nav" data-to="classlists">Class Lists</button>`
          : `<button type="button" class="navbtn${r === 'report' ? ' is-on' : ''}" data-act="nav" data-to="report">Grade Report</button>`}
      </nav>
      <div class="tools">
        <button type="button" class="iconbtn" data-act="pop" data-pop="notes" aria-haspopup="true" aria-label="Notifications${unread ? `, ${unread} new` : ''}">${ic('bell')}${unread ? `<span class="badge">${unread > 9 ? '9+' : unread}</span>` : ''}</button>
        <button type="button" class="userbtn" data-act="pop" data-pop="user" aria-haspopup="true"><span class="avatar">${esc(initials(name))}</span><span class="user-name">${esc(name)}</span>${ic('chevDown')}</button>
      </div>
    </div></header>`;
  }

  // ---------- Views: courses ----------

  function viewCourses(ctx) {
    const isT = ctx.role === 'teacher';
    const q = S.ui.courseQ.trim().toLowerCase();
    const all = coursesFor(ctx);
    const list = all.filter((c) => !q || `${c.name} ${c.section}`.toLowerCase().includes(q));
    let body;
    if (!all.length) {
      body = isT
        ? `<div class="empty"><h2>No courses yet</h2><p>Add the courses you teach. Each one gets a gradebook.</p><button type="button" class="btn primary" data-act="add-course">${ic('plus')} Add course</button></div>`
        : `<div class="empty"><h2>No courses yet</h2><p>Your teacher has not shared any courses with you yet.</p></div>`;
    } else if (!list.length) {
      body = '<div class="empty"><p>No courses match that filter.</p></div>';
    } else {
      body = `<div class="course-grid">${list.map((c) => courseCard(ctx, c)).join('')}</div>`;
    }
    return `<div class="wrap">
      <div class="page-head">
        <h1 class="page-title">Courses</h1>
        <div class="head-tools">
          ${all.length > 1 ? `<label class="search" for="course-q">${ic('search')}<input id="course-q" type="search" placeholder="Filter courses" autocomplete="off" data-ui="courseQ" data-live value="${esc(S.ui.courseQ)}"></label>` : ''}
          ${isT && all.length ? `<button type="button" class="btn primary" data-act="add-course">${ic('plus')} Add course</button>` : ''}
        </div>
      </div>
      ${body}
    </div>`;
  }

  function courseCard(ctx, c) {
    const flag = ctx.role === 'teacher' && !c.visible ? `<span class="pill">${ic('eyeOff')} Hidden from students</span>` : '';
    return `<button type="button" class="course-card" data-act="nav" data-to="course" data-course="${c.id}">
      <span class="cover"><img src="${esc(courseImage(c))}" alt=""></span>
      <span class="card-body">
        <span class="card-title">${esc(c.name)}</span>
        <span class="card-sec">${esc(c.section || ' ')}</span>
        <span class="card-school">${esc(ctx.teacher.school || ctx.teacher.name)}</span>
        ${flag ? `<span class="card-flag">${flag}</span>` : ''}
      </span>
    </button>`;
  }

  // ---------- Views: inside a course ----------

  function courseShell(ctx, course, tab, inner, upcoming) {
    return `<div class="course-layout">
      ${courseSide(ctx, course, tab)}
      <div class="course-panel${upcoming ? '' : ' solo'}">
        <section class="course-main">${inner}</section>
        ${upcoming ? upcomingPanel(ctx, course) : ''}
      </div>
    </div>`;
  }

  function courseSide(ctx, course, tab) {
    const isT = ctx.role === 'teacher';
    const link = (to, key, icon, label) =>
      `<button type="button" class="side-link${tab === key ? ' is-on' : ''}" data-act="nav" data-to="${to}" data-course="${course.id}"${tab === key ? ' aria-current="page"' : ''}>${ic(icon)}${label}</button>`;
    const list = (ctx.teacher.classLists || []).find((l) => l.id === course.classListId);
    const periods = MPS.map((mp) => mpLabel(mp, course.year)).join(', ');
    return `<aside class="course-side">
      <img class="side-cover" src="${esc(courseImage(course))}" alt="">
      <nav class="side-nav" aria-label="Course">
        ${link('course', 'materials', 'materials', 'Materials')}
        ${isT ? link('gradebook', 'gradebook', 'grades', 'Gradebook') : link('grades', 'grades', 'grades', 'Grades')}
        ${isT ? link('settings', 'settings', 'gear', 'Settings') : ''}
      </nav>
      <div class="side-info">
        <h2>Information</h2>
        <p class="caps">${esc(course.name)}</p>
        <dl>
          <dt>Grading periods</dt><dd>${esc(periods)}</dd>
          ${isT ? `<dt>Class list</dt><dd>${list ? `${esc(list.name)} · ${plural(list.studentIds.length, 'student')}` : 'None picked'}</dd>
          <dt>Students</dt><dd class="vis">${course.visible ? `${ic('eye')} Can see this course` : `${ic('eyeOff')} Hidden from students`}</dd>` : `<dt>Teacher</dt><dd>${esc(ctx.teacher.name)}</dd>`}
        </dl>
      </div>
    </aside>`;
  }

  function courseHead(ctx, course, tools = '') {
    return `<div class="course-head">
      <div class="course-head-text">
        <h1 class="course-title">${esc(courseTitle(course))}</h1>
        <p class="course-school">${esc(ctx.teacher.school || ctx.teacher.name)}</p>
      </div>
      ${tools}
    </div>`;
  }

  const addButton = () =>
    `<button type="button" class="btn primary" data-act="pop" data-pop="add" aria-haspopup="true">${ic('plus')} Add Materials ${ic('chevDown')}</button>`;

  function filteredItems(ctx, course, parentId) {
    const f = S.ui.filter;
    const q = f.q.trim().toLowerCase();
    const active = f.type !== 'all' || !!q;
    let list;
    if (active) {
      const scope = parentId ? new Set(descendants(course, parentId)) : null;
      list = (course.items || []).filter((i) => !scope || scope.has(i.id));
    } else {
      list = childrenOf(course, parentId);
    }
    const t = f.type;
    if (t === 'folder' || t === 'paper' || t === 'test' || t === 'link') list = list.filter((i) => i.kind === t);
    else if (CAT_LABEL[t]) list = list.filter((i) => i.kind !== 'folder' && i.cat === t);
    else if (t.startsWith('mp')) list = list.filter((i) => i.kind !== 'folder' && String(i.mp) === t.slice(2));
    else if (t === 'notdone' && ctx.role === 'student') {
      list = list.filter((i) => i.kind !== 'folder' && !entryOf(course.id, i.id, ctx.student.id));
    }
    if (q) list = list.filter((i) => `${i.title} ${i.description || ''}`.toLowerCase().includes(q));
    return { list: sortItems(list), active };
  }

  function viewCourse(ctx, course) {
    const isT = ctx.role === 'teacher';
    const r = S.route;
    const folder = r.folderId ? findItem(course, r.folderId) : null;
    const parentId = folder && folder.kind === 'folder' ? folder.id : null;
    const { list, active } = filteredItems(ctx, course, parentId);
    let top;
    if (parentId) {
      const trail = ancestors(course, folder.id);
      const sibs = sortItems(childrenOf(course, folder.parentId || null)).filter((i) => i.kind === 'folder');
      const idx = sibs.findIndex((s) => s.id === folder.id);
      const prev = sibs[idx - 1];
      const next = sibs[idx + 1];
      const up = trail[trail.length - 1];
      const folderLink = (f) => `data-act="nav" data-to="course" data-course="${course.id}"${f ? ` data-folder="${f.id}"` : ''}`;
      top = `<nav class="crumbs" aria-label="Folder path">
          <button type="button" class="crumb" ${folderLink(null)}>${esc(courseTitle(course))}</button>
          ${trail.map((f) => `<span class="crumb-sep" aria-hidden="true">▸</span><button type="button" class="crumb" ${folderLink(f)}>${esc(f.title)}</button>`).join('')}
        </nav>
        <div class="folder-bar">
          <h1 class="folder-name">${kindIcon('folder', folder.color)}<span>${esc(folder.title)}</span></h1>
          <div class="folder-nav">
            <button type="button" class="btn small" ${prev ? folderLink(prev) : 'disabled'}>${ic('triLeft')} Prev</button>
            <button type="button" class="btn small" ${next ? folderLink(next) : 'disabled'}>Next ${ic('triRight')}</button>
          </div>
        </div>
        <div class="folder-sub">
          <button type="button" class="btn small square" ${folderLink(up)} aria-label="Back to ${esc(up ? up.title : courseTitle(course))}" title="Back">${ic('back')}</button>
          ${folder.description ? `<p class="folder-desc">${nl2br(folder.description)}</p>` : ''}
          ${isT ? `<span class="push folder-tools"><button type="button" class="btn small" data-act="edit-item" data-id="${folder.id}">${ic('pencil')} Edit folder</button>${addButton()}</span>` : ''}
        </div>`;
    } else {
      top = courseHead(ctx, course, isT ? addButton() : '');
    }
    const types = [
      ['all', 'All Materials'],
      ['folder', 'Folders'],
      ['paper', 'Paper assignments'],
      ['test', 'Tests'],
      ['link', 'Links'],
      ['minor', 'Minor grades'],
      ['major', 'Major grades'],
      ['practice', 'Practice grades'],
      ['mp1', 'MP 1'],
      ['mp2', 'MP 2'],
      ['mp3', 'MP 3'],
      ['mp4', 'MP 4'],
    ];
    if (!isT) types.splice(5, 0, ['notdone', 'Not done yet']);
    const tools = `<div class="mat-tools">
      ${active ? `<p class="filter-note">${plural(list.length, 'match', 'matches')} ${parentId ? 'in this folder' : 'in this course'} <button type="button" class="linkbtn" data-act="clear-filter">Clear</button></p>` : ''}
      <label class="sr-only" for="mat-filter">Show</label>
      <select id="mat-filter" class="ctl slim" data-ui="filter.type" data-live>${types.map(([v, l]) => opt(v, l, S.ui.filter.type)).join('')}</select>
      <label class="search" for="mat-q">${ic('search')}<input id="mat-q" type="search" placeholder="Search materials" autocomplete="off" data-ui="filter.q" data-live value="${esc(S.ui.filter.q)}"></label>
    </div>`;
    let rows;
    if (list.length) {
      rows = `<ul class="mat-list">${list.map((it) => matRow(ctx, course, it, active)).join('')}</ul>`;
    } else if (active) {
      rows = '<div class="empty slim"><p>Nothing matches that filter.</p></div>';
    } else if (isT) {
      rows = `<div class="empty slim"><h2>${parentId ? 'This folder is empty' : 'No materials yet'}</h2><p>Use <b>Add Materials</b> to add a folder, a paper assignment, a test, or a link.</p></div>`;
    } else {
      rows = `<div class="empty slim"><p>${parentId ? 'This folder is empty.' : 'Your teacher has not posted anything here yet.'}</p></div>`;
    }
    return courseShell(ctx, course, 'materials', top + tools + rows, true);
  }

  function matRow(ctx, course, it, showPath) {
    const isT = ctx.role === 'teacher';
    const path = showPath ? ancestors(course, it.id).map((f) => f.title).join(' ▸ ') : '';
    const more = isT
      ? `<button type="button" class="iconbtn sm mat-more" data-act="pop" data-pop="item" data-id="${it.id}" aria-label="Options for ${esc(it.title)}">${ic('dots')}</button>`
      : '';
    if (it.kind === 'folder') {
      const n = childrenOf(course, it.id).length;
      const meta = it.description ? truncate(it.description, 90) : plural(n, 'item');
      return `<li class="mat-row is-folder">
        <button type="button" class="mat-hit" data-act="nav" data-to="course" data-course="${course.id}" data-folder="${it.id}">
          <span class="mat-chev">${ic('chevRight')}</span>
          <span class="mat-ic">${kindIcon('folder', it.color)}</span>
          <span class="mat-text"><span class="mat-title">${esc(it.title)}</span><span class="mat-meta">${esc(meta)}${path ? ` · in ${esc(path)}` : ''}</span></span>
        </button>
        ${more}
      </li>`;
    }
    let side;
    if (isT) {
      const roster = rosterOf(ctx.teacher, course);
      const done = roster.filter((s) => entryOf(course.id, it.id, s.id)).length;
      side = `<span class="mat-count">${done}/${roster.length} graded</span>`;
    } else {
      side = studentStatus(ctx, course, it);
    }
    return `<li class="mat-row">
      <button type="button" class="mat-hit" data-act="nav" data-to="assignment" data-course="${course.id}" data-item="${it.id}">
        <span class="mat-chev"></span>
        <span class="mat-ic">${kindIcon(it.kind)}</span>
        <span class="mat-text">
          <span class="mat-title">${esc(it.title)}</span>
          <span class="mat-meta">Due ${esc(fmtDue(it.due))}</span>
          <span class="mat-tags">${esc(CAT_LABEL[it.cat] || 'Minor')} · ${it.mp ? `MP ${it.mp}` : 'No grading period'} · ${fmtNum(it.points)} pts${path ? ` · in ${esc(path)}` : ''}</span>
        </span>
      </button>
      <span class="mat-side">${side}</span>
      ${more}
    </li>`;
  }

  function studentStatus(ctx, course, a) {
    const e = entryOf(course.id, a.id, ctx.student.id);
    if (e) return entryChip(e, a);
    if (a.kind === 'paper') return '<span class="pill">Not graded yet</span>';
    if (isPastDue(a)) return '<span class="pill bad">Not done</span>';
    return '<span class="pill todo">To do</span>';
  }

  function upcomingPanel(ctx, course) {
    const start = startOfToday().getTime();
    const items = assignmentsOf(course)
      .filter((a) => {
        const d = parseDue(a.due);
        return d && d.getTime() >= start;
      })
      .sort(byDue)
      .slice(0, 8);
    const groups = [];
    for (const a of items) {
      const day = fmtDay(parseDue(a.due));
      let g = groups[groups.length - 1];
      if (!g || g.day !== day) {
        g = { day, items: [] };
        groups.push(g);
      }
      g.items.push(a);
    }
    const body = groups.length
      ? groups
          .map(
            (g) => `<h3 class="up-day">${esc(g.day)}</h3><ul class="up-list">${g.items
              .map((a) => {
                const done = ctx.role === 'student' && entryOf(course.id, a.id, ctx.student.id);
                return `<li><button type="button" class="up-item" data-act="nav" data-to="assignment" data-course="${course.id}" data-item="${a.id}">
                  ${kindIcon(a.kind)}<span class="up-text"><span class="up-name">${esc(a.title)}</span> <span class="up-time">${esc(fmtTime(parseDue(a.due)))}</span></span>
                  ${done ? `<span class="up-done" title="Done">${ic('check')}<span class="sr-only">Done</span></span>` : ''}
                </button></li>`;
              })
              .join('')}</ul>`
          )
          .join('')
      : '<p class="up-empty">Nothing is due soon.</p>';
    return `<aside class="upcoming" aria-label="Upcoming"><h2 class="up-title">Upcoming ${ic('calendar')}</h2>${body}</aside>`;
  }

  // ---------- Views: one assignment ----------

  function viewAssignment(ctx, course, a) {
    const isT = ctx.role === 'teacher';
    const trail = ancestors(course, a.id);
    const crumbs = `<nav class="crumbs" aria-label="Folder path">
      <button type="button" class="crumb" data-act="nav" data-to="course" data-course="${course.id}">${esc(courseTitle(course))}</button>
      ${trail.map((f) => `<span class="crumb-sep" aria-hidden="true">▸</span><button type="button" class="crumb" data-act="nav" data-to="course" data-course="${course.id}" data-folder="${f.id}">${esc(f.title)}</button>`).join('')}
    </nav>`;
    const head = `<div class="a-head">
      ${kindIcon(a.kind)}
      <div class="a-head-text">
        <h1 class="a-title">${esc(a.title)}</h1>
        <p class="a-due">Due ${esc(fmtDue(a.due))}</p>
        <div class="a-meta">
          <span class="pill">${esc(KIND[a.kind].label)}</span>
          <span class="pill">${esc(CAT_LABEL[a.cat] || 'Minor')} grade</span>
          <span class="pill">${esc(a.mp ? `MP ${a.mp}` : 'No grading period')}</span>
          <span class="pill">${fmtNum(a.points)} points</span>
        </div>
      </div>
    </div>`;
    const desc = a.description ? `<p class="a-desc">${nl2br(a.description)}</p>` : '';
    const link = a.kind === 'link' && a.url
      ? `<a class="btn${isT ? '' : ' primary'}" href="${esc(a.url)}" target="_blank" rel="noopener noreferrer">${ic('external')} Open the test</a>`
      : '';
    let actions = '';
    if (isT) {
      actions = `<div class="a-actions">
        ${link}
        <button type="button" class="btn" data-act="edit-item" data-id="${a.id}">${ic('pencil')} Edit</button>
        <button type="button" class="btn" data-act="nav" data-to="gradebook" data-course="${course.id}">${ic('grades')} Gradebook</button>
        <button type="button" class="btn danger" data-act="delete-item" data-id="${a.id}">${ic('trash')} Delete</button>
      </div>`;
    }
    const main = isT ? teacherGradeTable(ctx, course, a) : studentSubmit(ctx, course, a, link);
    return courseShell(ctx, course, 'materials', crumbs + head + desc + actions + main, true);
  }

  function teacherGradeTable(ctx, course, a) {
    const roster = rosterOf(ctx.teacher, course);
    if (!roster.length) {
      return '<section class="panel"><div class="panel-body"><p class="muted">This course\'s class list has no students yet. Add names under Class Lists.</p></div></section>';
    }
    const entries = roster.map((s) => ({ s, e: entryOf(course.id, a.id, s.id) }));
    const done = entries.filter((x) => x.e).length;
    const counted = entries.filter((x) => x.e && x.e.t !== 'x');
    const avg = counted.length
      ? counted.reduce((sum, x) => sum + (x.e.t === 'g' ? x.e.s : 0), 0) / counted.length / (Number(a.points) || 1) * 100
      : null;
    const who = a.kind === 'paper' ? 'Type in each grade.' : 'Students type in their own grade. You can change any of them.';
    return `<section class="panel">
      <div class="panel-head"><h2>Grades</h2><p class="muted">${done}/${roster.length} graded${avg != null ? ` · class average ${pctChip(avg)}` : ''}</p></div>
      <p class="panel-note">${who} Type <b>ABS</b> for absent (0 points) or <b>EX</b> for exempt, or use the buttons.</p>
      <div class="table-scroll">
        <table class="gtable">
          <thead><tr><th scope="col">Student</th><th scope="col">Score</th><th scope="col">Grade</th><th scope="col">Mark as</th></tr></thead>
          <tbody>${entries
            .map(({ s, e }) => {
              const miss = !e && isPastDue(a);
              return `<tr>
                <th scope="row">${esc(s.name)}${e && e.b === 's' ? '<span class="tag">typed by student</span>' : ''}</th>
                <td><span class="score-cell"><input class="score-input${e && e.t === 'a' ? ' is-abs' : ''}" id="as-${a.id}-${s.id}" data-grade data-course="${course.id}" data-aid="${a.id}" data-sid="${s.id}" inputmode="decimal" autocomplete="off" value="${esc(displayValue(e))}" placeholder="${miss ? 'Not done' : '—'}" aria-label="Score for ${esc(s.name)}"><span class="of">/ ${fmtNum(a.points)}</span></span></td>
                <td>${e ? entryChip(e, a) : miss ? '<span class="pill bad">Not done</span>' : '<span class="muted">—</span>'}</td>
                <td><span class="mark-btns">
                  <button type="button" class="markbtn${e && e.t === 'a' ? ' on abs' : ''}" data-act="mark" data-mark="a" data-course="${course.id}" data-aid="${a.id}" data-sid="${s.id}" aria-pressed="${!!(e && e.t === 'a')}">Absent</button>
                  <button type="button" class="markbtn${e && e.t === 'x' ? ' on ex' : ''}" data-act="mark" data-mark="x" data-course="${course.id}" data-aid="${a.id}" data-sid="${s.id}" aria-pressed="${!!(e && e.t === 'x')}">Exempt</button>
                  ${e ? `<button type="button" class="markbtn" data-act="mark" data-mark="clear" data-course="${course.id}" data-aid="${a.id}" data-sid="${s.id}">Clear</button>` : ''}
                </span></td>
              </tr>`;
            })
            .join('')}</tbody>
        </table>
      </div>
    </section>`;
  }

  function studentSubmit(ctx, course, a, link) {
    const e = entryOf(course.id, a.id, ctx.student.id);
    const pts = fmtNum(a.points);
    if (e) {
      let text;
      let big;
      if (e.t === 'x') {
        big = '<span class="big-letter g-x">EX</span>';
        text = '<b>You are exempt.</b><p>This assignment does not count toward your grade.</p>';
      } else if (e.t === 'a') {
        big = '<span class="big-letter g-E">0</span>';
        text = `<b>Marked absent</b><p>Your teacher marked you absent, so it counts as 0/ ${pts}.</p>`;
      } else {
        const pct = (e.s / (Number(a.points) || 1)) * 100;
        const l = letterFor(pct);
        big = `<span class="big-letter g-${l}">${l}</span>`;
        text = `<b>${fmtNum(e.s)}/ ${pts} (${fmtPct(pct)})</b><p>${e.b === 's' ? 'You turned this in' : 'Your teacher posted this grade'} ${esc(fmtWhen(e.at).replace(/^[A-Z]/, (c) => c.toLowerCase()))}.${e.b === 's' ? ' Only your teacher can change it now.' : ''}</p>`;
      }
      return `<section class="panel"><div class="panel-head"><h2>Your grade</h2></div><div class="result">${big}<div class="result-text">${text}</div></div>${link ? `<div class="panel-body tight">${link}</div>` : ''}</section>`;
    }
    if (a.kind === 'paper') {
      return `<section class="panel"><div class="panel-head"><h2>Done on paper</h2></div><div class="panel-body"><p>Turn this in to your teacher on paper. Your grade shows up here after your teacher types it in.</p></div></section>`;
    }
    const how = a.kind === 'test'
      ? 'Take the test, then type in the grade you got.'
      : 'Open the link and take the test. When you finish, come back and type in the grade you got.';
    return `<section class="panel">
      <div class="panel-head"><h2>Type in your grade</h2>${isPastDue(a) ? '<span class="pill bad">Past due</span>' : ''}</div>
      <form class="submit" data-form="student-grade" novalidate>
        <p>${how}</p>
        ${link ? `<div>${link}</div>` : ''}
        <label class="score-label" for="my-score">Your score</label>
        <div class="score-line"><input id="my-score" class="ctl" inputmode="decimal" autocomplete="off" data-ui="myScore" value="${esc(S.ui.myScore)}" aria-describedby="my-score-of"><span id="my-score-of">out of ${pts}</span></div>
        ${S.ui.myScoreError ? `<p class="form-error" role="alert">${esc(S.ui.myScoreError)}</p>` : ''}
        <div><button type="submit" class="btn primary">Submit grade</button></div>
      </form>
    </section>`;
  }

  // ---------- Views: gradebook (teacher) ----------

  function viewGradebook(ctx, course) {
    const g = S.ui.gb;
    const roster = rosterOf(ctx.teacher, course);
    const q = g.q.trim().toLowerCase();
    const students = roster.filter((s) => !q || s.name.toLowerCase().includes(q));
    const items = assignmentsOf(course)
      .filter((a) => (g.mp === 'all' || String(a.mp) === g.mp) && (g.cat === 'all' || a.cat === g.cat))
      .sort(byDue);
    const mpSel = g.mp !== 'all' && g.mp !== '0' ? Number(g.mp) : null;
    const tools = `<div class="gb-tools">
      <label class="field inline" for="gb-mp"><span>Marking period</span><select id="gb-mp" class="ctl slim" data-ui="gb.mp" data-live>
        ${opt('all', 'All', g.mp)}${MPS.map((m) => opt(String(m), `MP ${m}`, g.mp)).join('')}${opt('0', 'No grading period', g.mp)}
      </select></label>
      <label class="field inline" for="gb-cat"><span>Grade type</span><select id="gb-cat" class="ctl slim" data-ui="gb.cat" data-live>
        ${opt('all', 'All', g.cat)}${CATS.map((c) => opt(c.key, c.label, g.cat)).join('')}
      </select></label>
      <label class="search" for="gb-q">${ic('search')}<input id="gb-q" type="search" placeholder="Find a student" autocomplete="off" data-ui="gb.q" data-live value="${esc(g.q)}"></label>
    </div>
    <p class="gb-legend">Type a score and press Enter. Type <b>ABS</b> for absent (0 points) or <b>EX</b> for exempt, or use the <span class="nowrap">${ic('dots')}</span> button in a cell. A red cell was due and has no grade yet. A blue dot means the student typed the grade in.</p>`;
    let table;
    if (!roster.length) {
      table = '<div class="empty slim"><h2>No students yet</h2><p>Add names to this course\'s class list under Class Lists.</p></div>';
    } else if (!assignmentsOf(course).length) {
      table = `<div class="empty slim"><h2>No assignments yet</h2><p>Add one from <button type="button" class="linkbtn" data-act="nav" data-to="course" data-course="${course.id}">Materials</button> with Add Materials.</p></div>`;
    } else {
      const results = new Map(students.map((s) => [s.id, calcStudent(course, s.id)]));
      const overallOf = (s) => {
        const r = results.get(s.id);
        return mpSel ? r.periods.find((p) => p.mp === mpSel).pct : r.pct;
      };
      const head = `<tr>
        <th scope="col" class="stick gb-name">Student</th>
        <th scope="col" class="gb-sum">${mpSel ? `MP ${mpSel}` : 'Overall'}</th>
        <th scope="col" class="gb-sum">Not done</th>
        ${items
          .map(
            (a) => `<th scope="col" class="gb-col">
            <button type="button" class="gb-colbtn" data-act="nav" data-to="assignment" data-course="${course.id}" data-item="${a.id}">${kindIcon(a.kind)}<span>${esc(a.title)}</span></button>
            <span class="gb-colmeta">${esc(CAT_LABEL[a.cat] || 'Minor')} · ${a.mp ? `MP ${a.mp}` : 'No MP'} · /${fmtNum(a.points)}</span>
            <span class="gb-colmeta">Due ${esc(fmtShort(a.due))}</span>
          </th>`
          )
          .join('')}
      </tr>`;
      const rows = students
        .map((s) => {
          const missing = assignmentsOf(course).filter((a) => isPastDue(a) && !entryOf(course.id, a.id, s.id)).length;
          const cells = items
            .map((a) => {
              const e = entryOf(course.id, a.id, s.id);
              const miss = !e && isPastDue(a);
              const cls = [
                'gb-cell',
                miss ? 'is-miss' : '',
                e && e.t === 'a' ? 'is-abs' : '',
                e && e.t === 'x' ? 'is-ex' : '',
                e && e.b === 's' ? 'by-s' : '',
              ].filter(Boolean).join(' ');
              return `<td class="${cls}"><input class="gb-input" id="gb-${a.id}-${s.id}" data-grade data-course="${course.id}" data-aid="${a.id}" data-sid="${s.id}" inputmode="decimal" autocomplete="off" value="${esc(displayValue(e))}" placeholder="${miss ? 'Not done' : '—'}" aria-label="${esc(s.name)}, ${esc(a.title)}"><button type="button" class="gb-more" data-act="pop" data-pop="cell" data-id="${a.id}.${s.id}" aria-label="More for ${esc(s.name)}, ${esc(a.title)}">${ic('dots')}</button></td>`;
            })
            .join('');
          return `<tr><th scope="row" class="stick gb-name">${esc(s.name)}</th><td class="gb-sum">${pctChip(overallOf(s))}</td><td class="gb-sum${missing ? ' has-miss' : ''}">${missing || '—'}</td>${cells}</tr>`;
        })
        .join('');
      const avgs = items
        .map((a) => {
          const got = students.map((s) => entryOf(course.id, a.id, s.id)).filter((e) => e && e.t !== 'x');
          if (!got.length) return '<td>—</td>';
          const pct = (got.reduce((sum, e) => sum + (e.t === 'g' ? e.s : 0), 0) / got.length / (Number(a.points) || 1)) * 100;
          return `<td>${fmtPct(pct)}</td>`;
        })
        .join('');
      const overalls = students.map(overallOf).filter((p) => p != null);
      const classAvg = overalls.length ? overalls.reduce((a, b) => a + b, 0) / overalls.length : null;
      table = `<div class="gb-scroll" id="gb-scroll" data-keep-scroll>
        <table class="gb">
          <thead>${head}</thead>
          <tbody>${rows || `<tr><td class="gb-none" colspan="${items.length + 3}">No students match that search.</td></tr>`}</tbody>
          <tfoot><tr><th scope="row" class="stick gb-name">Class average</th><td class="gb-sum">${pctChip(classAvg)}</td><td class="gb-sum"></td>${avgs}</tr></tfoot>
        </table>
      </div>
      ${items.length ? '' : '<p class="muted pad">No assignments match these filters.</p>'}`;
    }
    const inner = `${courseHead(ctx, course)}<h2 class="section-title">Gradebook</h2>${tools}${table}`;
    return courseShell(ctx, course, 'gradebook', inner, false);
  }

  // ---------- Views: grades (student) ----------

  const chev = (open) => ic('chevRight', `chev${open ? ' is-open' : ''}`);

  function gradeTree(ctx, course, openByDefault) {
    const res = calcStudent(course, ctx.student.id);
    const ckey = `c:${course.id}`;
    const open = S.ui.open[ckey] ?? openByDefault;
    let html = `<div class="gt">
      <div class="gt-row gt-course">
        <button type="button" class="gt-toggle" data-act="toggle-open" data-key="${ckey}" aria-expanded="${open}">${chev(open)}<span class="gt-cic">${ic('grades')}</span><span class="gt-name">${esc(courseTitle(course))}</span></button>
        <span class="gt-grade">${pctChip(res.pct)}</span>
      </div>`;
    if (open) {
      for (const p of res.periods) {
        const pkey = `p:${course.id}:${p.mp}`;
        const has = p.rows.length > 0;
        const popen = has && (S.ui.open[pkey] ?? p.pct != null);
        html += `<div class="gt-row gt-mp">
          <button type="button" class="gt-toggle" data-act="toggle-open" data-key="${pkey}" aria-expanded="${popen}"${has ? '' : ' disabled'}>${chev(popen)}<span class="gt-label">${esc(mpLabel(p.mp, course.year))}</span><span class="gt-w">(${p.weight}%)</span></button>
          <span class="gt-grade">${pctChip(p.pct)}</span>
        </div>`;
        if (!popen) continue;
        for (const c of p.cats) {
          if (!c.rows.length) continue;
          const kkey = `k:${course.id}:${p.mp}:${c.key}`;
          const kopen = S.ui.open[kkey] ?? true;
          html += `<div class="gt-row gt-cat">
            <button type="button" class="gt-toggle" data-act="toggle-open" data-key="${kkey}" aria-expanded="${kopen}">${chev(kopen)}<span class="gt-label">${c.label}</span><span class="gt-w">(${c.weight}%)</span></button>
            <span class="gt-grade">${pctChip(c.pct)}</span>
          </div>`;
          if (!kopen) continue;
          for (const { a, e } of c.rows) {
            const status = e
              ? entryChip(e, a)
              : a.kind !== 'paper' && isPastDue(a)
                ? '<span class="pill bad">Not done</span>'
                : '<span class="gt-dash">—</span>';
            html += `<div class="gt-row gt-item">
              <button type="button" class="gt-link" data-act="nav" data-to="assignment" data-course="${course.id}" data-item="${a.id}">${esc(a.title)}</button>
              <span class="gt-due">${esc(fmtShort(a.due))}</span>
              <span class="gt-grade">${status}</span>
            </div>`;
          }
        }
      }
    }
    return `${html}</div>`;
  }

  function viewStudentGrades(ctx, course) {
    const inner = `${courseHead(ctx, course)}<h2 class="section-title">Grades</h2>${gradeTree(ctx, course, true)}`;
    return courseShell(ctx, course, 'grades', inner, false);
  }

  function viewReport(ctx) {
    const tab = S.ui.reportTab;
    const year = schoolYear();
    const courses = coursesFor(ctx).filter((c) => (tab === 'current' ? !c.year || c.year === year : c.year && c.year !== year));
    return `<div class="wrap"><section class="report">
      <h1 class="report-title">Grades</h1>
      <div class="seg" role="group" aria-label="Which courses">
        <button type="button" class="seg-btn${tab === 'current' ? ' on' : ''}" aria-pressed="${tab === 'current'}" data-act="report-tab" data-tab="current">Current</button>
        <button type="button" class="seg-btn${tab === 'past' ? ' on' : ''}" aria-pressed="${tab === 'past'}" data-act="report-tab" data-tab="past">Past</button>
      </div>
      ${courses.length ? courses.map((c) => gradeTree(ctx, c, false)).join('') : `<div class="empty slim"><p>${tab === 'current' ? 'You are not in any courses yet.' : 'No courses from past school years.'}</p></div>`}
    </section></div>`;
  }

  // ---------- Views: course settings (teacher) ----------

  function viewSettings(ctx, course) {
    const d = S.ui.settings;
    const shown = d.image === undefined ? (course.imageId ? courseImage(course) : null) : d.image;
    const lists = ctx.teacher.classLists || [];
    const inner = `${courseHead(ctx, course)}
      <form class="settings" data-form="settings" data-scope="settings" novalidate>
        <h2 class="section-title">Course settings</h2>
        <div class="field-row">
          <label class="field grow" for="s-name"><span>Course name</span><input id="s-name" data-bind="name" value="${esc(d.name)}" autocomplete="off"></label>
          <label class="field narrow" for="s-sec"><span>Section</span><input id="s-sec" data-bind="section" value="${esc(d.section)}" autocomplete="off"></label>
        </div>
        <label class="field" for="s-list"><span>Class list</span>
          <select id="s-list" data-bind="listId">${lists.map((l) => opt(l.id, `${l.name} (${plural(l.studentIds.length, 'student')})`, d.listId)).join('')}</select>
          <small>Students on this list can open this course.</small></label>
        <label class="check" for="s-vis"><input type="checkbox" id="s-vis" data-bind="visible"${d.visible ? ' checked' : ''}> Students can see this course</label>
        ${coverPicker(shown, 's-img', 'settings', 'settings-blank')}
        <fieldset class="weights">
          <legend>Grade weights</legend>
          <p class="hint">How much each grade type counts in a marking period. A type set to 0% still shows its grades but does not count.</p>
          <div class="field-row">${CATS.map(
            (c) => `<label class="field narrow" for="s-w-${c.key}"><span>${c.label}</span><span class="suffix-input"><input id="s-w-${c.key}" type="number" min="0" max="100" step="1" inputmode="numeric" data-bind="weights.${c.key}" value="${esc(d.weights[c.key])}"><span>%</span></span></label>`
          ).join('')}</div>
        </fieldset>
        ${d.error ? `<p class="form-error" role="alert">${esc(d.error)}</p>` : ''}
        <div><button type="submit" class="btn primary">Save changes</button></div>
      </form>
      <section class="danger-zone">
        <h2 class="section-title">Delete this course</h2>
        <p class="muted">This removes the course, its folders and assignments, and every grade in its gradebook.</p>
        <button type="button" class="btn danger" data-act="delete-course">${ic('trash')} Delete course</button>
      </section>`;
    return courseShell(ctx, course, 'settings', inner, false);
  }

  // ---------- Views: class lists (teacher) ----------

  function viewClassLists(ctx) {
    const t = ctx.teacher;
    const courses = coursesFor(ctx);
    const cards = (t.classLists || [])
      .map((l) => {
        const names = l.studentIds.map((id) => studentName(t, id)).filter(Boolean);
        const used = courses.filter((c) => c.classListId === l.id).map(courseTitle);
        const shown = names.slice(0, 12);
        return `<article class="cl-card">
          <header class="cl-head"><h2>${esc(l.name)}</h2><span class="pill">${plural(names.length, 'student')}</span></header>
          <p class="muted small">${used.length ? `Used by ${esc(listNames(used))}` : 'Not used by any course yet'}</p>
          ${names.length ? `<ol class="cl-names">${shown.map((n) => `<li>${esc(n)}</li>`).join('')}</ol>${names.length > shown.length ? `<p class="muted small">and ${names.length - shown.length} more</p>` : ''}` : '<p class="muted">No students on this list yet.</p>'}
          <footer class="cl-foot">
            <button type="button" class="btn small" data-act="edit-classlist" data-id="${l.id}">${ic('pencil')} Edit list</button>
            <button type="button" class="btn small ghost danger" data-act="delete-classlist" data-id="${l.id}">${ic('trash')} Delete</button>
          </footer>
        </article>`;
      })
      .join('');
    return `<div class="wrap">
      <div class="page-head">
        <h1 class="page-title">Class Lists</h1>
        <div class="head-tools"><button type="button" class="btn primary" data-act="new-classlist">${ic('plus')} New class list</button></div>
      </div>
      <p class="lede">Each course uses one class list. If you have two classes that take different courses, give each class its own list and pick it in the course's settings.</p>
      <div class="cl-grid">${cards}</div>
    </div>`;
  }

  // ---------- Pop-up menus ----------

  const POPS = {
    courses(ctx) {
      const list = coursesFor(ctx);
      return `<div class="pop-head"><span class="pop-h">My Courses</span><button type="button" class="linkbtn" data-act="nav" data-to="courses">See all</button></div>
        ${list.length ? `<ul class="pop-courses">${list
          .map(
            (c) => `<li><button type="button" class="pop-course" data-act="nav" data-to="course" data-course="${c.id}"><img src="${esc(courseImage(c))}" alt=""><span><b>${esc(c.name)}</b><small>${esc(c.section || '')}</small></span></button></li>`
          )
          .join('')}</ul>` : '<p class="pop-empty">No courses yet.</p>'}`;
    },
    notes(ctx, pop) {
      const list = notifications(ctx);
      return `<div class="pop-head"><span class="pop-tab">Notifications</span></div>
        ${list.length ? `<ul class="notes">${list
          .map(
            (n) => `<li><button type="button" class="note${n.at > pop.seenAt ? ' is-new' : ''}" data-act="nav" data-to="assignment" data-course="${n.to.course}" data-item="${n.to.item}">
              <span class="note-ic ${n.icon}">${ic(n.icon)}</span>
              <span class="note-text"><span>${n.html}</span><em>${esc(fmtWhen(n.at))}</em></span>
            </button></li>`
          )
          .join('')}</ul>` : `<p class="pop-empty">${ctx.role === 'teacher' ? 'When students type in their grades, you will see it here.' : 'New assignments and grades show up here.'}</p>`}`;
    },
    user(ctx) {
      const isT = ctx.role === 'teacher';
      const name = isT ? ctx.teacher.name : ctx.student.name;
      const sub = isT ? `Teacher${ctx.teacher.school ? ` · ${ctx.teacher.school}` : ''}` : `Student · ${ctx.teacher.name}'s class`;
      return `<div class="pop-user"><span class="avatar lg">${esc(initials(name))}</span><span><b>${esc(name)}</b><small>${esc(sub)}</small></span></div>
        <div class="pop-list">
          <button type="button" class="pop-item" data-act="nav" data-to="courses">${ic('materials')} My courses</button>
          ${isT
            ? `<button type="button" class="pop-item" data-act="nav" data-to="classlists">${ic('users')} Class lists</button>`
            : `<button type="button" class="pop-item" data-act="nav" data-to="report">${ic('grades')} Grade report</button>`}
          <button type="button" class="pop-item" data-act="logout">${ic('logout')} Log out</button>
        </div>`;
    },
    add() {
      return `<div class="pop-list">${['folder', 'paper', 'test', 'link']
        .map((k) => `<button type="button" class="pop-item" data-act="add-item" data-kind="${k}">${kindIcon(k)} ${esc(KIND[k].add)}</button>`)
        .join('')}</div>`;
    },
    item(ctx, pop) {
      const course = Store.get('courses', S.route.courseId);
      const it = course && findItem(course, pop.id);
      if (!it) return '';
      return `<div class="pop-list">
        <button type="button" class="pop-item" data-act="edit-item" data-id="${it.id}">${ic('pencil')} Edit</button>
        <button type="button" class="pop-item danger" data-act="delete-item" data-id="${it.id}">${ic('trash')} Delete</button>
      </div>`;
    },
    cell(ctx, pop) {
      const [aid, sid] = pop.id.split('.');
      const cid = S.route.courseId;
      const e = entryOf(cid, aid, sid);
      const data = `data-course="${cid}" data-aid="${aid}" data-sid="${sid}"`;
      return `<div class="pop-list">
        <button type="button" class="pop-item" data-act="mark" data-mark="a" ${data}>${e && e.t === 'a' ? ic('check') : ic('x')} Absent (0 points)</button>
        <button type="button" class="pop-item" data-act="mark" data-mark="x" ${data}>${e && e.t === 'x' ? ic('check') : ic('eyeOff')} Exempt</button>
        ${e ? `<button type="button" class="pop-item" data-act="mark" data-mark="clear" ${data}>${ic('trash')} Clear grade</button>` : ''}
      </div>`;
    },
  };

  function togglePop(el) {
    const key = `${el.dataset.pop}:${el.dataset.id || ''}`;
    if (S.pop && S.pop.key === key) {
      closePop();
      return;
    }
    const ctx = me();
    if (!ctx) return;
    const r = el.getBoundingClientRect();
    S.pop = {
      key,
      type: el.dataset.pop,
      id: el.dataset.id,
      rect: { top: r.top, bottom: r.bottom, left: r.left, right: r.right },
      right: ['notes', 'user', 'item', 'cell', 'add'].includes(el.dataset.pop),
      seenAt: el.dataset.pop === 'notes' ? getSeen(ctx) : 0,
    };
    renderPop();
    if (S.pop.type === 'notes') {
      setSeen(ctx);
      scheduleRender();
    }
    const first = $('#pop-root button');
    if (first) first.focus({ preventScroll: true });
  }

  function renderPop() {
    const root = $('#pop-root');
    if (!root) return;
    const ctx = S.pop && me();
    const html = ctx && POPS[S.pop.type] ? POPS[S.pop.type](ctx, S.pop) : '';
    if (!html) {
      S.pop = null;
      root.innerHTML = '';
      return;
    }
    root.innerHTML = `<div class="pop pop-${S.pop.type}">${html}</div>`;
    const pop = root.firstElementChild;
    const { rect } = S.pop;
    const vw = document.documentElement.clientWidth;
    const vh = window.innerHeight;
    const w = pop.offsetWidth;
    const h = pop.offsetHeight;
    let left = S.pop.right ? rect.right - w : rect.left;
    left = Math.max(8, Math.min(left, vw - w - 8));
    let top = rect.bottom + 6;
    if (top + h > vh - 8 && rect.top - h - 6 > 8) top = rect.top - h - 6;
    pop.style.left = `${left}px`;
    pop.style.top = `${top}px`;
  }

  function closePop() {
    if (!S.pop) return;
    S.pop = null;
    const root = $('#pop-root');
    if (root) root.innerHTML = '';
  }

  // ---------- Dialogs ----------

  const modalHead = (title, icon = '') =>
    `<header class="modal-head">${icon}<h2 id="modal-title">${esc(title)}</h2><button type="button" class="iconbtn sm" data-act="modal-close" aria-label="Close">${ic('x')}</button></header>`;
  const modalFoot = (label, danger) =>
    `<footer class="modal-foot"><button type="button" class="btn" data-act="modal-close">Cancel</button><button type="submit" class="btn ${danger ? 'danger solid' : 'primary'}">${esc(label)}</button></footer>`;
  const modalErr = (m) => (m.error ? `<p class="form-error" role="alert">${esc(m.error)}</p>` : '');

  const MODALS = {
    item(m) {
      const d = m.d;
      const course = Store.get('courses', m.courseId);
      const isFolder = d.kind === 'folder';
      const title = `${m.id ? 'Edit' : 'Add'} ${KIND[d.kind].short}`;
      const folders = course ? folderOptions(course, m.id) : [];
      const fields = isFolder
        ? `<fieldset class="field colors"><legend>Folder color</legend><div class="swatches">${Object.entries(FOLDER_COLORS)
            .map(
              ([k, hex]) => `<label class="swatch" title="${k}"><input type="radio" name="f-color" id="f-color-${k}" value="${k}" data-bind="color" data-rerender${k === d.color ? ' checked' : ''}><span style="background:${hex}"></span><span class="sr-only">${k}</span></label>`
            )
            .join('')}</div></fieldset>`
        : `<div class="field-row">
            <label class="field" for="f-cat"><span>Grade type</span><select id="f-cat" data-bind="cat">${CATS.map((c) => opt(c.key, `${c.label} grade`, d.cat)).join('')}</select></label>
            <label class="field" for="f-mp"><span>Marking period</span><select id="f-mp" data-bind="mp">${MPS.map((n) => opt(String(n), `MP ${n}`, d.mp)).join('')}${opt('0', 'No grading period', d.mp)}</select></label>
            <label class="field narrow" for="f-points"><span>Points</span><input id="f-points" type="number" min="1" step="any" inputmode="decimal" data-bind="points" value="${esc(d.points)}"></label>
          </div>
          <div class="field-row">
            <label class="field" for="f-date"><span>Due date</span><input id="f-date" type="date" data-bind="dueDate" value="${esc(d.dueDate)}"></label>
            <label class="field" for="f-time"><span>Due time</span><input id="f-time" type="time" data-bind="dueTime" value="${esc(d.dueTime)}"></label>
          </div>
          ${d.kind === 'link' ? `<label class="field" for="f-url"><span>Link to the test</span><input id="f-url" type="url" inputmode="url" autocomplete="off" data-bind="url" value="${esc(d.url)}" placeholder="https://"></label>` : ''}`;
      return `<form data-form="item" data-scope="modal" novalidate>
        ${modalHead(title, `<span class="modal-ic">${kindIcon(d.kind, d.color)}</span>`)}
        <div class="modal-body">
          ${isFolder ? '' : `<label class="field" for="f-kind"><span>Type</span><select id="f-kind" data-bind="kind" data-rerender>${['paper', 'test', 'link'].map((k) => opt(k, KIND[k].label, d.kind)).join('')}</select><small>${esc(KIND[d.kind].help)}</small></label>`}
          <label class="field" for="f-title"><span>${isFolder ? 'Folder name' : 'Title'}</span><input id="f-title" data-bind="title" value="${esc(d.title)}" maxlength="140" autocomplete="off" placeholder="${isFolder ? 'Module 1: Inventors at Work' : d.kind === 'test' ? 'Central Idea' : d.kind === 'link' ? 'Selection Quiz: Winds of Hope' : 'M1 Informational Writing'}"></label>
          ${fields}
          <label class="field" for="f-parent"><span>Put it in</span><select id="f-parent" data-bind="parentId">${opt('', 'Top of the course', d.parentId)}${folders.map((f) => opt(f.id, f.label, d.parentId)).join('')}</select></label>
          <label class="field" for="f-desc"><span>Description <em>(optional)</em></span><textarea id="f-desc" rows="3" data-bind="description">${esc(d.description)}</textarea></label>
          ${modalErr(m)}
        </div>
        ${modalFoot(m.id ? 'Save' : 'Create')}
      </form>`;
    },
    course(m) {
      const d = m.d;
      const t = me().teacher;
      return `<form data-form="course" data-scope="modal" novalidate>
        ${modalHead('Add a course', `<span class="modal-ic tint">${ic('materials')}</span>`)}
        <div class="modal-body">
          <div class="field-row">
            <label class="field grow" for="c-name"><span>Course name</span><input id="c-name" data-bind="name" value="${esc(d.name)}" placeholder="Science Grade 5" autocomplete="off"></label>
            <label class="field narrow" for="c-sec"><span>Section</span><input id="c-sec" data-bind="section" value="${esc(d.section)}" placeholder="Sec 052" autocomplete="off"></label>
          </div>
          <label class="field" for="c-list"><span>Class list</span><select id="c-list" data-bind="listId">${(t.classLists || [])
            .map((l) => opt(l.id, `${l.name} (${plural(l.studentIds.length, 'student')})`, d.listId))
            .join('')}</select></label>
          <label class="check" for="c-vis"><input type="checkbox" id="c-vis" data-bind="visible"${d.visible ? ' checked' : ''}> Students can see this course</label>
          ${coverPicker(d.image, 'c-img', 'modal', 'modal-blank')}
          ${modalErr(m)}
        </div>
        ${modalFoot('Add course')}
      </form>`;
    },
    classlist(m) {
      const d = m.d;
      return `<form data-form="classlist" data-scope="modal" novalidate>
        ${modalHead(m.id ? 'Edit class list' : 'New class list', `<span class="modal-ic tint">${ic('users')}</span>`)}
        <div class="modal-body">
          <label class="field" for="cl-name"><span>Class list name</span><input id="cl-name" data-bind="name" value="${esc(d.name)}" placeholder="Homeroom 052" autocomplete="off"></label>
          <label class="field" for="cl-text"><span>Students <em>(one per line)</em></span><textarea id="cl-text" rows="12" data-bind="text" data-count="cl-count" placeholder="Jordan Lee&#10;Maya Patel&#10;Chris Walker">${esc(d.text)}</textarea>
            <small>Keep each name spelled the same so it stays matched to that student's grades.</small></label>
          <p class="count" id="cl-count">${plural(parseNames(d.text).length, 'student')}</p>
          ${modalErr(m)}
        </div>
        ${modalFoot(m.id ? 'Save list' : 'Add list')}
      </form>`;
    },
    confirm(m) {
      return `<form data-form="confirm" novalidate>
        ${modalHead(m.title)}
        <div class="modal-body"><p>${esc(m.body)}</p></div>
        ${modalFoot(m.ok, m.danger)}
      </form>`;
    },
    info(m) {
      return `<form data-form="info" novalidate>
        ${modalHead(m.title)}
        <div class="modal-body"><p>${esc(m.body)}</p></div>
        <footer class="modal-foot"><button type="submit" class="btn primary">OK</button></footer>
      </form>`;
    },
  };

  function renderModal() {
    const root = $('#modal-root');
    if (!root) return;
    if (!S.modal) {
      root.innerHTML = '';
      document.documentElement.classList.remove('has-modal');
      return;
    }
    const keep = captureFocus(root);
    const small = S.modal.type === 'confirm' || S.modal.type === 'info';
    swapHtml(root, `<div class="backdrop"><div class="modal${small ? ' modal-sm' : ''}" role="dialog" aria-modal="true" aria-labelledby="modal-title">${MODALS[S.modal.type](S.modal)}</div></div>`);
    document.documentElement.classList.add('has-modal');
    restoreFocus(keep);
  }

  function openModal(m) {
    closePop();
    S.modal = m;
    renderModal();
    requestAnimationFrame(() => {
      const el = $('#modal-root .modal-body input:not(.sr-only):not([type=radio]), #modal-root .modal-body select, #modal-root .modal-body textarea, #modal-root .modal-foot .btn:last-child');
      if (el) el.focus();
    });
  }

  function closeModal() {
    S.modal = null;
    renderModal();
  }

  function modalError(msg, id) {
    S.modal.error = msg;
    renderModal();
    if (id) focusId(id);
  }

  function confirmBox(opts) {
    openModal({ type: 'confirm', ...opts });
  }

  // ---------- Actions ----------

  function openItemModal(courseId, kind, itemId, parentId) {
    const course = Store.get('courses', courseId);
    if (!course) return;
    const it = itemId ? findItem(course, itemId) : null;
    const due = it && it.due ? it.due.split('T') : [nextFriday(), '23:59'];
    openModal({
      type: 'item',
      courseId,
      id: it ? it.id : null,
      error: '',
      d: {
        kind: it ? it.kind : kind,
        title: it ? it.title : '',
        description: (it && it.description) || '',
        color: (it && it.color) || 'blue',
        cat: (it && it.cat) || 'minor',
        mp: String(it ? it.mp ?? 1 : currentMp()),
        points: String(it ? it.points ?? 100 : 100),
        dueDate: due[0] || '',
        dueTime: due[1] || '23:59',
        url: (it && it.url) || '',
        parentId: it ? it.parentId || '' : parentId || '',
      },
    });
  }

  function commitGradeInput(input) {
    const { course: cid, aid, sid } = input.dataset;
    const course = Store.get('courses', cid);
    const a = course && findItem(course, aid);
    if (!a) return;
    const cur = entryOf(cid, aid, sid);
    const raw = input.value.trim().toLowerCase();
    if (raw === displayValue(cur).toLowerCase()) return;
    let next;
    if (raw === '') next = null;
    else if (raw === 'abs' || raw === 'absent') next = { t: 'a' };
    else if (raw === 'ex' || raw === 'exempt') next = { t: 'x' };
    else {
      const n = Number(raw.replace(/%$/, ''));
      if (!Number.isFinite(n) || n < 0) {
        toast('Type a score, ABS for absent, or EX for exempt.', 'error');
        input.value = displayValue(cur);
        return;
      }
      next = { t: 'g', s: round2(n) };
    }
    if (!cur && !next) return;
    if (cur && next && cur.t === next.t && (next.t !== 'g' || cur.s === next.s)) return;
    setEntry(cid, aid, sid, next, 't');
    input.value = displayValue(entryOf(cid, aid, sid));
  }

  function moveGradeFocus(input, dir) {
    const all = $$(`input[data-grade][data-aid="${input.dataset.aid}"]`);
    const next = all[all.indexOf(input) + dir];
    if (next) {
      next.focus();
      next.select();
    }
  }

  const ACTIONS = {
    nav(el) {
      const d = el.dataset;
      const route = { name: d.to };
      if (d.course) route.courseId = d.course;
      if (d.folder) route.folderId = d.folder;
      if (d.item) route.itemId = d.item;
      if (d.to === 'teacher-login') {
        S.ui.loginTeacherId = null;
        S.ui.loginPass = '';
        S.ui.loginError = '';
      }
      go(route);
    },
    pop(el) {
      togglePop(el);
    },
    logout,
    'start-create'() {
      S.wizard = newWizard();
      go({ name: 'create' });
      focusId('w-name');
    },
    'pick-teacher'(el) {
      const t = Store.get('teachers', el.dataset.id);
      if (!t) return;
      if (!t.pass) {
        S.session = { role: 'teacher', teacherId: t.id };
        go({ name: 'courses' });
        return;
      }
      const same = S.ui.loginTeacherId === t.id;
      S.ui.loginTeacherId = same ? null : t.id;
      S.ui.loginPass = '';
      S.ui.loginError = '';
      render();
      if (!same) focusId('login-pass');
    },
    'pick-student-teacher'(el) {
      S.ui.studentTeacherId = el.dataset.id;
      S.ui.studentQ = '';
      render();
      window.scrollTo(0, 0);
    },
    'student-back'() {
      S.ui.studentTeacherId = null;
      render();
    },
    'login-student'(el) {
      const tid = S.ui.studentTeacherId;
      if (!tid) return;
      S.session = { role: 'student', teacherId: tid, studentId: el.dataset.id };
      S.ui.studentTeacherId = null;
      S.ui.open = {};
      const ctx = me();
      go({ name: 'courses' });
      if (ctx) toast(`Hi, ${ctx.student.name}!`);
    },
    'wiz-back'() {
      S.wizard.error = '';
      S.wizard.step = Math.max(1, S.wizard.step - 1);
      render();
      window.scrollTo(0, 0);
    },
    'wiz-add-list'() {
      const w = S.wizard;
      w.lists.push({ id: uid(), name: '', text: '' });
      render();
      focusId(`wl-name-${w.lists.length - 1}`);
    },
    'wiz-remove-list'(el) {
      const w = S.wizard;
      const i = Number(el.dataset.index);
      const [gone] = w.lists.splice(i, 1);
      for (const c of w.courses) if (c.listId === gone.id) c.listId = w.lists[0].id;
      render();
    },
    'wiz-toggle-subject'(el) {
      const w = S.wizard;
      const s = el.dataset.subject;
      const i = w.courses.findIndex((c) => c.key === s);
      if (i >= 0) w.courses.splice(i, 1);
      else w.courses.push(newPick(w, s, s));
      render();
    },
    'wiz-add-custom'() {
      const w = S.wizard;
      const name = w.custom.trim();
      if (!name) {
        focusId('w-custom');
        return;
      }
      w.courses.push(newPick(w, `custom-${uid()}`, name));
      w.custom = '';
      render();
      focusId('w-custom');
    },
    'wiz-remove-course'(el) {
      S.wizard.courses.splice(Number(el.dataset.index), 1);
      render();
    },
    'wiz-blank'(el) {
      S.wizard.courses[Number(el.dataset.index)].image = null;
      render();
    },
    'modal-close'() {
      closeModal();
    },
    'modal-blank'() {
      S.modal.d.image = null;
      renderModal();
    },
    'settings-blank'() {
      S.ui.settings.image = null;
      render();
    },
    'add-course'() {
      const t = me().teacher;
      openModal({
        type: 'course',
        error: '',
        d: { name: '', section: '', listId: (t.classLists[0] || {}).id || '', visible: true, image: null },
      });
    },
    'add-item'(el) {
      const r = S.route;
      openItemModal(r.courseId, el.dataset.kind, null, r.name === 'course' ? r.folderId || '' : '');
    },
    'edit-item'(el) {
      openItemModal(S.route.courseId, null, el.dataset.id);
    },
    'delete-item'(el) {
      const course = Store.get('courses', S.route.courseId);
      const it = course && findItem(course, el.dataset.id);
      if (!it) return;
      const ids = it.kind === 'folder' ? [it.id, ...descendants(course, it.id)] : [it.id];
      const inside = ids.length - 1;
      confirmBox({
        title: `Delete “${it.title}”?`,
        body:
          it.kind === 'folder'
            ? inside
              ? `This also deletes the ${plural(inside, 'thing')} inside it, and any grades for those assignments.`
              : 'This folder is empty.'
            : 'Its grades will be removed from the gradebook too.',
        ok: 'Delete',
        danger: true,
        onOk() {
          const c = clone(Store.get('courses', course.id));
          if (!c) return;
          const kill = new Set(ids);
          c.items = c.items.filter((i) => !kill.has(i.id));
          Store.put('courses', c.id, c);
          const r = S.route;
          if ((r.name === 'assignment' && kill.has(r.itemId)) || (r.name === 'course' && kill.has(r.folderId))) {
            go({ name: 'course', courseId: c.id, folderId: it.parentId && !kill.has(it.parentId) ? it.parentId : undefined });
          }
          toast('Deleted');
        },
      });
    },
    'clear-filter'() {
      S.ui.filter = { type: 'all', q: '' };
      render();
    },
    mark(el) {
      const { course: cid, aid, sid, mark } = el.dataset;
      const cur = entryOf(cid, aid, sid);
      if (mark === 'clear') {
        if (cur) setEntry(cid, aid, sid, null, 't');
      } else if (cur && cur.t === mark) {
        setEntry(cid, aid, sid, null, 't');
      } else {
        setEntry(cid, aid, sid, { t: mark }, 't');
      }
    },
    'toggle-open'(el) {
      const key = el.dataset.key;
      S.ui.open[key] = el.getAttribute('aria-expanded') !== 'true';
      render();
    },
    'report-tab'(el) {
      S.ui.reportTab = el.dataset.tab;
      render();
    },
    'delete-course'() {
      const c = Store.get('courses', S.route.courseId);
      if (!c) return;
      confirmBox({
        title: `Delete ${courseTitle(c)}?`,
        body: 'This deletes the course, all of its folders and assignments, and every grade in its gradebook. You cannot undo this.',
        ok: 'Delete course',
        danger: true,
        onOk() {
          Store.remove('courses', c.id);
          Store.remove('grades', c.id);
          if (c.imageId) Store.remove('images', c.imageId);
          go({ name: 'courses' });
          toast('Course deleted');
        },
      });
    },
    'new-classlist'() {
      openModal({ type: 'classlist', id: null, error: '', d: { name: '', text: '' } });
    },
    'edit-classlist'(el) {
      const t = me().teacher;
      const l = (t.classLists || []).find((x) => x.id === el.dataset.id);
      if (!l) return;
      const names = l.studentIds.map((id) => studentName(t, id)).filter(Boolean);
      openModal({ type: 'classlist', id: l.id, error: '', d: { name: l.name, text: names.join('\n') } });
    },
    'delete-classlist'(el) {
      const ctx = me();
      const l = (ctx.teacher.classLists || []).find((x) => x.id === el.dataset.id);
      if (!l) return;
      const used = coursesFor(ctx).filter((c) => c.classListId === l.id);
      if (used.length) {
        openModal({
          type: 'info',
          title: 'This class list is still in use',
          body: `First pick a different class list in the settings for ${listNames(used.map(courseTitle))}.`,
        });
        return;
      }
      if (ctx.teacher.classLists.length === 1) {
        openModal({ type: 'info', title: 'Keep at least one class list', body: 'Your courses need a class list. Edit this one instead of deleting it.' });
        return;
      }
      confirmBox({
        title: `Delete ${l.name}?`,
        body: 'Students on this list stay on any other class lists they are on.',
        ok: 'Delete',
        danger: true,
        onOk() {
          const t = clone(me().teacher);
          t.classLists = t.classLists.filter((x) => x.id !== l.id);
          Store.put('teachers', t.id, t);
          toast('Class list deleted');
        },
      });
    },
  };

  // ---------- Forms ----------

  const FORMS = {
    'teacher-login'() {
      const t = Store.get('teachers', S.ui.loginTeacherId);
      if (!t) return;
      const pass = ($('#login-pass') || {}).value || '';
      if (t.pass && hashPass(t.id, pass) !== t.pass) {
        S.ui.loginError = 'That password does not match. Try again.';
        S.ui.loginPass = '';
        render();
        focusId('login-pass');
        return;
      }
      S.ui.loginPass = '';
      S.ui.loginError = '';
      S.ui.loginTeacherId = null;
      S.session = { role: 'teacher', teacherId: t.id };
      go({ name: 'courses' });
    },
    wizard() {
      const w = S.wizard;
      w.error = '';
      if (w.step === 1) {
        if (!w.name.trim()) {
          w.error = 'Type your name so your students can find your file.';
          render();
          focusId('w-name');
          return;
        }
        w.step = 2;
        render();
        window.scrollTo(0, 0);
        focusId('wl-name-0');
        return;
      }
      if (w.step === 2) {
        for (let i = 0; i < w.lists.length; i++) {
          const l = w.lists[i];
          if (!parseNames(l.text).length) {
            w.error = w.lists.length > 1
              ? `Paste at least one student into ${l.name.trim() || `class list ${i + 1}`}, or remove that list.`
              : 'Paste in at least one student name, one per line.';
            render();
            focusId(`wl-text-${i}`);
            return;
          }
        }
        const ids = new Set(w.lists.map((l) => l.id));
        for (const c of w.courses) if (!ids.has(c.listId)) c.listId = w.lists[0].id;
        w.step = 3;
        render();
        window.scrollTo(0, 0);
        return;
      }
      const blank = w.courses.findIndex((c) => !c.name.trim());
      if (blank >= 0) {
        w.error = 'Every course needs a name.';
        render();
        focusId(`wc-name-${blank}`);
        return;
      }
      finishWizard();
    },
    item() {
      const m = S.modal;
      const d = m.d;
      const course = clone(Store.get('courses', m.courseId));
      if (!course) {
        closeModal();
        return;
      }
      const title = d.title.trim();
      if (!title) {
        modalError(d.kind === 'folder' ? 'Give the folder a name.' : 'Give it a title.', 'f-title');
        return;
      }
      const it = m.id ? findItem(course, m.id) : { id: uid(), createdAt: now() };
      if (!it) {
        closeModal();
        return;
      }
      it.kind = d.kind;
      it.title = title;
      it.description = d.description.trim();
      it.parentId = d.parentId || null;
      if (d.kind === 'folder') {
        it.color = d.color;
      } else {
        const pts = Number(d.points);
        if (!(pts > 0)) {
          modalError('Points has to be a number bigger than 0.', 'f-points');
          return;
        }
        if (!d.dueDate) {
          modalError('Pick a due date.', 'f-date');
          return;
        }
        it.cat = d.cat;
        it.mp = Number(d.mp);
        it.points = round2(pts);
        it.due = `${d.dueDate}T${d.dueTime || '23:59'}`;
        if (d.kind === 'link') {
          let url = d.url.trim();
          if (!url) {
            modalError('Paste the link to the test.', 'f-url');
            return;
          }
          if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
          try {
            new URL(url);
          } catch (_) {
            modalError('That link does not look right. It should start with https://', 'f-url');
            return;
          }
          it.url = url;
        } else {
          delete it.url;
        }
      }
      if (!m.id) course.items.push(it);
      Store.put('courses', course.id, course);
      closeModal();
      toast(m.id ? 'Saved' : `${KIND[d.kind].short} added`);
    },
    course() {
      const m = S.modal;
      const d = m.d;
      const t = me().teacher;
      if (!d.name.trim()) {
        modalError('Give the course a name, like Science Grade 5.', 'c-name');
        return;
      }
      if (!(t.classLists || []).some((l) => l.id === d.listId)) {
        modalError('Pick a class list for this course.', 'c-list');
        return;
      }
      const id = createCourse(t.id, d);
      closeModal();
      go({ name: 'course', courseId: id });
      toast('Course added');
    },
    classlist() {
      const m = S.modal;
      const name = m.d.name.trim();
      const names = parseNames(m.d.text);
      if (!name) {
        modalError('Give the class list a name, like Homeroom 052.', 'cl-name');
        return;
      }
      if (!names.length) {
        modalError('Paste at least one student name, one per line.', 'cl-text');
        return;
      }
      saveClassList(me().teacher, m.id, name, names);
      closeModal();
      toast(m.id ? 'Class list saved' : 'Class list added');
    },
    confirm() {
      const fn = S.modal.onOk;
      closeModal();
      if (fn) fn();
    },
    info() {
      closeModal();
    },
    settings() {
      const d = S.ui.settings;
      const c = clone(Store.get('courses', S.route.courseId));
      if (!c) return;
      d.error = '';
      if (!d.name.trim()) {
        d.error = 'The course needs a name.';
        render();
        focusId('s-name');
        return;
      }
      const weights = {};
      for (const cat of CATS) {
        const n = Number(d.weights[cat.key]);
        if (!Number.isFinite(n) || n < 0 || n > 100) {
          d.error = `${cat.label} weight has to be a number from 0 to 100.`;
          render();
          focusId(`s-w-${cat.key}`);
          return;
        }
        weights[cat.key] = n;
      }
      c.name = d.name.trim();
      c.section = d.section.trim();
      c.classListId = d.listId;
      c.visible = !!d.visible;
      c.weights = weights;
      if (d.image !== undefined) {
        if (c.imageId) Store.remove('images', c.imageId);
        c.imageId = null;
        if (d.image) {
          c.imageId = uid();
          Store.put('images', c.imageId, { teacherId: c.teacherId, data: d.image });
        }
      }
      Store.put('courses', c.id, c);
      initSettings(c.id);
      render();
      toast('Course saved');
    },
    'student-grade'() {
      const ctx = me();
      const course = Store.get('courses', S.route.courseId);
      const a = course && findItem(course, S.route.itemId);
      if (!ctx || !a) return;
      const raw = String(S.ui.myScore || '').trim().replace(/%$/, '');
      const n = Number(raw);
      const max = Number(a.points) || 0;
      if (raw === '' || !Number.isFinite(n)) {
        S.ui.myScoreError = 'Type the score you got, like 18 or 95.';
        render();
        focusId('my-score');
        return;
      }
      if (n < 0 || n > max) {
        S.ui.myScoreError = `Your score has to be from 0 to ${fmtNum(max)}.`;
        render();
        focusId('my-score');
        return;
      }
      S.ui.myScoreError = '';
      const pct = (n / (max || 1)) * 100;
      confirmBox({
        title: 'Submit your grade?',
        body: `You are turning in ${fmtNum(n)} out of ${fmtNum(max)} (${letterFor(pct)}, ${fmtPct(pct)}). After you submit, only your teacher can change it.`,
        ok: 'Submit grade',
        onOk() {
          setEntry(course.id, a.id, ctx.student.id, { t: 'g', s: round2(n) }, 's');
          S.ui.myScore = '';
          render();
          toast('Grade saved to your teacher’s gradebook');
        },
      });
    },
  };

  // ---------- Events ----------

  function scopeRoot(scope) {
    if (scope === 'wizard') return S.wizard;
    if (scope === 'modal') return S.modal && S.modal.d;
    if (scope === 'settings') return S.ui.settings;
    return null;
  }

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    const inPop = !!e.target.closest('#pop-root');
    if (S.pop && !inPop && !(el && el.dataset.act === 'pop')) closePop();
    if (!el || el.disabled) return;
    const fn = ACTIONS[el.dataset.act];
    if (!fn) return;
    e.preventDefault();
    fn(el, e);
    if (inPop && el.dataset.act !== 'pop') closePop();
  });

  document.addEventListener('input', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.dataset.bind) {
      const scopeEl = t.closest('[data-scope]');
      const root = scopeRoot(scopeEl && scopeEl.dataset.scope);
      if (!root) return;
      setPath(root, t.dataset.bind, t.type === 'checkbox' ? t.checked : t.value);
      if (t.dataset.count) {
        const out = document.getElementById(t.dataset.count);
        if (out) out.textContent = plural(parseNames(t.value).length, 'student');
      }
      if (t.hasAttribute('data-rerender')) {
        if (scopeEl.dataset.scope === 'modal') renderModal();
        else render();
      }
      return;
    }
    if (t.dataset.ui) {
      setPath(S.ui, t.dataset.ui, t.value);
      if (t.hasAttribute('data-live')) scheduleRender();
    }
  });

  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (swapping || !(t instanceof HTMLInputElement) || !t.isConnected) return;
    if (t.dataset.grade !== undefined) {
      commitGradeInput(t);
      return;
    }
    if (t.type === 'file' && t.dataset.file) {
      const file = t.files && t.files[0];
      const kind = t.dataset.file;
      const index = Number(t.dataset.index);
      t.value = '';
      if (!file) return;
      try {
        const url = await readImage(file);
        if (kind === 'wizard' && S.wizard && S.wizard.courses[index]) {
          S.wizard.courses[index].image = url;
          render();
        } else if (kind === 'modal' && S.modal) {
          S.modal.d.image = url;
          renderModal();
        } else if (kind === 'settings' && S.ui.settings) {
          S.ui.settings.image = url;
          render();
        }
      } catch (err) {
        toast(err.message || 'That picture could not be used.', 'error');
      }
    }
  });

  document.addEventListener('submit', (e) => {
    const f = e.target.closest('form[data-form]');
    if (!f) return;
    e.preventDefault();
    const fn = FORMS[f.dataset.form];
    if (fn) fn(f);
  });

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (e.key === 'Escape') {
      if (S.pop) {
        closePop();
        return;
      }
      if (S.modal) closeModal();
      return;
    }
    if (t instanceof HTMLInputElement && t.dataset.grade !== undefined) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        commitGradeInput(t);
        moveGradeFocus(t, e.key === 'ArrowUp' ? -1 : 1);
      }
      return;
    }
    // On the course step, Enter should not create the account by accident.
    if (e.key === 'Enter' && t instanceof HTMLInputElement && S.wizard && S.wizard.step === 3 && t.closest('[data-scope="wizard"]')) {
      e.preventDefault();
      if (t.id === 'w-custom') ACTIONS['wiz-add-custom']();
    }
  });

  window.addEventListener('resize', closePop);
  window.addEventListener(
    'scroll',
    (e) => {
      if (!S.pop) return;
      const root = $('#pop-root');
      if (root && e.target instanceof Node && root.contains(e.target)) return;
      closePop();
    },
    true
  );

  // ---------- Start ----------

  async function boot() {
    render();
    await Store.init();
    Store.subscribe(scheduleRender);
    const saved = loadSession();
    if (saved && saved.session) {
      S.session = saved.session;
      S.route = saved.route && saved.route.name ? saved.route : { name: 'courses' };
      if (!me() || ['home', 'teacher-login', 'student-login', 'create'].includes(S.route.name)) {
        S.route = { name: 'courses' };
      }
      if (!me()) {
        S.session = null;
        S.route = { name: 'home' };
      }
    }
    if (S.route.name === 'settings') initSettings(S.route.courseId);
    S.booting = false;
    render();
  }

  boot();
})();
