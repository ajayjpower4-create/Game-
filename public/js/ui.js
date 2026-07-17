// ---------------------------------------------------------------------------
// ui.js — DOM UI: speech bubbles, toasts, dialogue (T), action menu (G),
// teacher computer, administrator panel, cutscenes.
// ---------------------------------------------------------------------------
'use strict';
window.HSS = window.HSS || {};

HSS.UI = (() => {
  const $ = (id) => document.getElementById(id);
  const bubbleLayer = $('bubbleLayer');
  const bubbles = [];   // {el, anchor(), until}
  const handIcons = new Map(); // npcId -> el

  // ---------- generic panel handling ----------
  const PANEL_IDS = ['dialogueBox', 'actionMenu', 'teacherPC', 'adminPanel'];
  function openPanel(id) {
    PANEL_IDS.forEach(p => $(p).classList.add('hidden'));
    $(id).classList.remove('hidden');
    document.exitPointerLock?.();
  }
  function closePanels() { PANEL_IDS.forEach(p => $(p).classList.add('hidden')); }
  const anyPanelOpen = () => PANEL_IDS.some(p => !$(p).classList.contains('hidden'));
  document.querySelectorAll('.closeX').forEach(b => b.addEventListener('click', () => $(b.dataset.close).classList.add('hidden')));

  // tab switching within panels
  document.querySelectorAll('.tabRow').forEach(row => {
    row.addEventListener('click', (e) => {
      const btn = e.target.closest('.tabBtn'); if (!btn) return;
      row.querySelectorAll('.tabBtn').forEach(b => b.classList.toggle('active', b === btn));
      const panel = row.parentElement;
      panel.querySelectorAll('.tabPage').forEach(pg => pg.classList.add('hidden'));
      panel.querySelector(`#${btn.dataset.tab}`).classList.remove('hidden');
    });
  });

  // ---------- toasts ----------
  function toast(msg, cls = '') {
    const el = document.createElement('div');
    el.className = `toast ${cls}`; el.textContent = msg;
    $('toastLog').appendChild(el);
    setTimeout(() => el.remove(), 6500);
  }

  // ---------- speech bubbles ----------
  function bubble(npc, text, { seconds = null, thinking = false } = {}) {
    // one bubble per NPC
    for (let i = bubbles.length - 1; i >= 0; i--) {
      if (bubbles[i].npcId === npc.id) { bubbles[i].el.remove(); bubbles.splice(i, 1); }
    }
    const el = document.createElement('div');
    el.className = `bubble${thinking ? ' thinking' : ''}`;
    el.innerHTML = `<span class="bName"></span>`;
    el.querySelector('.bName').textContent = npc.name;
    el.appendChild(document.createTextNode(text));
    bubbleLayer.appendChild(el);
    const dur = seconds ?? Math.min(12, 3 + text.length / 18);
    bubbles.push({ el, npcId: npc.id, anchor: () => npc.headPos(), until: performance.now() + dur * 1000 });
  }

  function setHandRaised(npc, up, onClick) {
    if (up && !handIcons.has(npc.id)) {
      const el = document.createElement('div');
      el.className = 'handIcon'; el.textContent = '✋'; el.title = `${npc.name} has their hand up`;
      el.addEventListener('click', () => onClick && onClick(npc));
      bubbleLayer.appendChild(el);
      handIcons.set(npc.id, el);
    } else if (!up && handIcons.has(npc.id)) {
      handIcons.get(npc.id).remove();
      handIcons.delete(npc.id);
    }
  }

  // called every frame by main.js with the camera/scene for projection
  function updateOverlays(scene, engine) {
    const now = performance.now();
    const cam = scene.activeCamera;
    if (!cam) return;
    const project = (v3) => BABYLON.Vector3.Project(
      v3, BABYLON.Matrix.Identity(), scene.getTransformMatrix(),
      cam.viewport.toGlobal(engine.getRenderWidth(), engine.getRenderHeight()));
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i];
      if (now > b.until) { b.el.remove(); bubbles.splice(i, 1); continue; }
      const p = project(b.anchor());
      const behind = p.z > 1 || p.z < 0;
      b.el.style.display = behind ? 'none' : 'block';
      if (!behind) { b.el.style.left = `${p.x}px`; b.el.style.top = `${p.y - 8}px`; }
    }
    for (const [npcId, el] of handIcons) {
      const npc = HSS.game.npcById(npcId);
      if (!npc) { el.remove(); handIcons.delete(npcId); continue; }
      const p = project(npc.headPos());
      const behind = p.z > 1 || p.z < 0;
      el.style.display = behind ? 'none' : 'block';
      if (!behind) { el.style.left = `${p.x + 18}px`; el.style.top = `${p.y - 4}px`; }
    }
  }

  // ---------- interact prompt ----------
  const promptEl = $('interactPrompt');
  function showPrompt(html) { promptEl.innerHTML = html; promptEl.classList.remove('hidden'); }
  function hidePrompt() { promptEl.classList.add('hidden'); }

  // ---------- dialogue (T) ----------
  let dlgTargets = [];    // [{label, npcs, key}]
  let dlgSelected = 0;
  function openDialogue(targets) {
    dlgTargets = targets; dlgSelected = 0;
    renderDlgTargets();
    $('dialogueHistory').innerHTML = '';
    openPanel('dialogueBox');
    setTimeout(() => $('dialogueInput').focus(), 50);
  }
  function renderDlgTargets() {
    const wrap = $('dialogueTargets'); wrap.innerHTML = '';
    dlgTargets.forEach((t, i) => {
      const c = document.createElement('div');
      c.className = `chip${i === dlgSelected ? ' sel' : ''}`;
      c.textContent = t.label;
      c.addEventListener('click', () => { dlgSelected = i; renderDlgTargets(); });
      wrap.appendChild(c);
    });
    $('dialogueTargetLabel').textContent = dlgTargets.length ? `Talking — select audience` : 'Nobody in range';
  }
  function logDlg(who, text) {
    const el = document.createElement('div');
    el.className = 'dh';
    const b = document.createElement('b'); b.textContent = who + ': ';
    el.appendChild(b); el.appendChild(document.createTextNode(text));
    $('dialogueHistory').appendChild(el);
    $('dialogueHistory').scrollTop = 1e6;
  }
  async function sendDialogue() {
    const input = $('dialogueInput');
    const msg = input.value.trim();
    if (!msg || !dlgTargets.length) return;
    input.value = '';
    const target = dlgTargets[dlgSelected];
    logDlg(HSS.game.playerName + ' (you)', msg);
    if (target.npcs.length === 1) {
      const npc = target.npcs[0];
      bubble(npc, '…', { thinking: true, seconds: 20 });
      const text = await HSS.AI.talkTo(npc, msg);
      bubble(npc, text);
      logDlg(npc.name, text);
      if (npc.handRaised) { npc.raiseHand(false); setHandRaised(npc, false); }
    } else {
      const replies = await HSS.AI.talkToGroup(target.npcs, msg);
      for (const r of replies) {
        const npc = target.npcs.find(n => String(n.id) === String(r.id));
        if (!npc) continue;
        bubble(npc, r.text);
        logDlg(npc.name, r.text);
        npc.mood = r.mood || 'neutral';
      }
      if (!replies.length) logDlg('—', 'The group stays quiet.');
    }
  }
  $('dialogueSend').addEventListener('click', sendDialogue);
  $('dialogueInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') sendDialogue(); e.stopPropagation(); });

  // ---------- action menu (G) ----------
  const ACTIONS = [
    ['wave', 'Wave 👋', 'waves at you'],
    ['clap', 'Clap for attention 👏', 'claps twice for attention'],
    ['point', 'Point at the board 👉', 'points at the whiteboard'],
    ['knock', 'Knock on the desk ✊', 'knocks firmly on the desk'],
    ['shh', 'Ask for silence 🤫', 'holds a finger up and waits for silence'],
    ['thumbs', 'Thumbs up 👍', 'gives an encouraging thumbs up'],
    ['stern', 'Stern look 😠', 'gives a long, stern look'],
    ['praise', 'Round of applause 🙌', 'starts a round of applause for the group'],
  ];
  function openActionMenu(onAction) {
    const list = $('actionList'); list.innerHTML = '';
    for (const [key, label, desc] of ACTIONS) {
      const b = document.createElement('button');
      b.className = 'actionBtn'; b.textContent = label;
      b.addEventListener('click', () => { closePanels(); onAction(key, desc); });
      list.appendChild(b);
    }
    openPanel('actionMenu');
  }

  // ---------- teacher PC ----------
  function openTeacherPC(room, cls) {
    openPanel('teacherPC');
    const page = $('pcAttendance');
    const G = HSS.game;
    page.innerHTML = '';
    const head = document.createElement('h3');
    head.textContent = cls ? `Register — ${cls.form} · ${cls.subject} · ${room.label}` : `No class scheduled in ${room.label} right now`;
    page.appendChild(head);
    if (!cls) return;
    const roster = cls.students;
    const reg = G.attendanceFor(cls.form);
    roster.forEach(st => {
      const row = document.createElement('div'); row.className = 'attRow';
      const nm = document.createElement('span'); nm.className = 'attName'; nm.textContent = st.name;
      if (st.sen) { const t = document.createElement('span'); t.className = 'senTag'; t.textContent = st.sen.startsWith('EHCP') ? 'EHCP' : 'SEN'; nm.appendChild(t); }
      const bP = document.createElement('button'); bP.textContent = 'Present';
      const bA = document.createElement('button'); bA.textContent = 'Absent';
      const paint = () => {
        bP.className = reg.marks[st.id] === 'P' ? 'on-p' : '';
        bA.className = reg.marks[st.id] === 'A' ? 'on-a' : '';
      };
      bP.addEventListener('click', () => { reg.marks[st.id] = 'P'; paint(); checkDone(); });
      bA.addEventListener('click', () => { reg.marks[st.id] = 'A'; paint(); checkDone(); });
      paint();
      row.append(nm, bP, bA);
      page.appendChild(row);
    });
    const allBtn = document.createElement('button');
    allBtn.className = 'bigBtn'; allBtn.textContent = 'Mark all present';
    allBtn.addEventListener('click', () => { roster.forEach(st => reg.marks[st.id] = reg.marks[st.id] || 'P'); openTeacherPC(room, cls); checkDone(); });
    page.appendChild(allBtn);
    function checkDone() {
      if (roster.every(st => reg.marks[st.id])) {
        if (!reg.submitted) {
          reg.submitted = true;
          toast(`✅ Attendance submitted for ${cls.form}.`);
          G.onAttendanceDone(cls.form);
        }
      }
    }
    // homework / quiz buttons wire to game callbacks
    $('hwAssign').onclick = () => {
      const title = $('hwTitle').value.trim() || 'Homework';
      closePanels();
      G.assignWork('homework', title, cls);
      $('hwTitle').value = ''; $('hwDesc').value = '';
    };
    $('quizAssign').onclick = () => {
      const title = $('quizTitle').value.trim() || 'Quiz';
      closePanels();
      G.assignWork('quiz', title, cls);
      $('quizTitle').value = ''; $('quizQs').value = '';
    };
  }

  // ---------- administrator panel ----------
  function openAdminPanel() {
    openPanel('adminPanel');
    const G = HSS.game;
    const res = $('adResults'), detail = $('adDetail');
    const search = $('adSearch');
    search.oninput = () => {
      const q = search.value.trim().toLowerCase();
      res.innerHTML = ''; detail.classList.add('hidden');
      if (q.length < 2) return;
      G.students.filter(s => s.name.toLowerCase().includes(q)).slice(0, 12).forEach(s => {
        const item = document.createElement('div'); item.className = 'roleItem';
        const a = document.createElement('span'); a.className = 'rName'; a.textContent = s.name;
        const b = document.createElement('span'); b.className = 'rRole'; b.textContent = `${s.form} · ${s.attendancePct}% att.`;
        item.append(a, b);
        item.addEventListener('click', () => showStudent(s));
        res.appendChild(item);
      });
    };
    function showStudent(s) {
      detail.classList.remove('hidden');
      detail.innerHTML = '';
      const h = document.createElement('h3'); h.textContent = `${s.name} — ${s.form}`;
      const meta = document.createElement('div'); meta.className = 'recordItem';
      meta.textContent = `Age ${s.age} · SEN: ${s.sen || 'none'} · Attendance ${s.attendancePct}% · Home: ${s.homeLife}`;
      detail.append(h, meta);
      const tbl = document.createElement('table');
      tbl.innerHTML = '<tr><th>Subject</th><th>Grade (1-9)</th></tr>';
      for (const sub of HSS.SUBJECTS) {
        const tr = document.createElement('tr');
        const td1 = document.createElement('td'); td1.textContent = sub;
        const td2 = document.createElement('td');
        const inp = document.createElement('input'); inp.className = 'gradeEdit'; inp.value = s.grades[sub];
        inp.addEventListener('change', () => {
          const v = Math.max(1, Math.min(9, parseInt(inp.value, 10) || s.grades[sub]));
          s.grades[sub] = v; inp.value = v;
          toast(`Grade updated: ${s.name} · ${sub} → ${v}`);
        });
        td2.appendChild(inp); tr.append(td1, td2); tbl.appendChild(tr);
      }
      detail.appendChild(tbl);
      const recHead = document.createElement('h3'); recHead.textContent = 'Records';
      detail.appendChild(recHead);
      s.records.forEach(r => {
        const el = document.createElement('div'); el.className = 'recordItem'; el.textContent = r;
        detail.appendChild(el);
      });
      const addInp = document.createElement('input'); addInp.type = 'text'; addInp.placeholder = 'Add a record note…';
      const addBtn = document.createElement('button'); addBtn.className = 'bigBtn'; addBtn.textContent = 'Add record';
      addBtn.addEventListener('click', () => {
        if (!addInp.value.trim()) return;
        s.records.push(`[${HSS.fmtTime(G.clockMin)}] ${addInp.value.trim()} — ${G.playerName}`);
        showStudent(s);
      });
      detail.append(addInp, addBtn);
    }

    // email staff
    const sel = $('emailStaff');
    if (!sel.dataset.filled) {
      sel.dataset.filled = '1';
      G.staffList.forEach(st => {
        const o = document.createElement('option'); o.value = st.id; o.textContent = `${st.name} — ${st.role}`;
        sel.appendChild(o);
      });
    }
    $('emailSend').onclick = async () => {
      const st = G.staffList.find(x => x.id === sel.value);
      if (!st) return;
      const subj = $('emailSubject').value.trim() || '(no subject)';
      const body = $('emailBody').value.trim();
      if (!body) return;
      $('emailReply').textContent = 'Sending…';
      const fakeNpc = { id: `mail-${st.id}`, name: st.name, profile: st };
      const reply = await HSS.AI.talkTo(fakeNpc, `[EMAIL from ${G.playerName}] Subject: ${subj}\n\n${body}\n\n(Reply as a short professional email.)`);
      $('emailReply').textContent = `↩ Reply from ${st.name}:\n${reply}`;
    };

    // contact parents
    const pRes = $('parentResults'), pSearch = $('parentSearch');
    let pStudent = null;
    pSearch.oninput = () => {
      const q = pSearch.value.trim().toLowerCase();
      pRes.innerHTML = '';
      if (q.length < 2) return;
      G.students.filter(s => s.name.toLowerCase().includes(q)).slice(0, 8).forEach(s => {
        const item = document.createElement('div'); item.className = 'roleItem';
        item.textContent = `${s.name} (${s.form})`;
        item.addEventListener('click', () => {
          pStudent = s;
          $('parentMsg').classList.remove('hidden'); $('parentSend').classList.remove('hidden');
          pRes.innerHTML = ''; pSearch.value = s.name;
        });
        pRes.appendChild(item);
      });
    };
    $('parentSend').onclick = async () => {
      if (!pStudent) return;
      const msg = $('parentMsg').value.trim(); if (!msg) return;
      $('parentReply').textContent = 'Calling home…';
      const parentNpc = {
        id: `parent-${pStudent.id}`, name: `Parent/carer of ${pStudent.name}`,
        profile: { id: `parent-${pStudent.id}`, kind: 'staff', name: `${pStudent.name.split(' ')[1]} family (parent/carer)`,
          role: `parent of ${pStudent.name}, Year ${pStudent.year}`,
          personality: `an ordinary London parent/carer; home situation: ${pStudent.homeLife}; responds like a real parent contacted by school` },
      };
      const reply = await HSS.AI.talkTo(parentNpc, `[PHONE CALL from school: ${G.playerName}, ${G.playerStaff.role}] ${msg}`);
      $('parentReply').textContent = `📞 ${parentNpc.name}: ${reply}`;
    };
  }

  // ---------- cutscene ----------
  function cutscene(text, seconds = 4) {
    $('cutsceneBars').classList.remove('hidden');
    $('cutsceneText').textContent = text;
    return new Promise(res => setTimeout(() => { $('cutsceneBars').classList.add('hidden'); res(); }, seconds * 1000));
  }

  return {
    toast, bubble, setHandRaised, updateOverlays, showPrompt, hidePrompt,
    openDialogue, openActionMenu, openTeacherPC, openAdminPanel, cutscene,
    openPanel, closePanels, anyPanelOpen, logDlg,
  };
})();
