// ---------------------------------------------------------------------------
// ai.js — client for the server-side Claude proxy (/api/npc/*), with offline
// fallback lines so the game still runs without an API key.
// ---------------------------------------------------------------------------
'use strict';
window.HSS = window.HSS || {};

HSS.AI = (() => {
  let aiEnabled = true;
  const histories = new Map(); // npcId -> [{fromPlayer, text}]

  fetch('/api/health').then(r => r.json()).then(j => { aiEnabled = j.aiEnabled; }).catch(() => { aiEnabled = false; });

  function historyFor(id) {
    if (!histories.has(id)) histories.set(id, []);
    return histories.get(id);
  }

  function profilePayload(npc) {
    const p = npc.profile;
    if (p.kind === 'student') {
      return {
        id: p.id, kind: 'student', name: p.name, year: p.year, form: p.form, age: p.age,
        sen: p.sen, homeLife: p.homeLife, behaviour: p.behaviour, stats: p.stats,
      };
    }
    return { id: p.id, kind: 'staff', name: p.name, role: p.role, department: p.department, personality: p.personality };
  }

  function context() {
    const G = HSS.game;
    return {
      playerName: G.playerName,
      playerRole: G.playerStaff ? G.playerStaff.role : 'staff',
      location: G.currentRoom ? G.currentRoom.label : 'outside on the school grounds',
      time: HSS.fmtTime(G.clockMin),
      period: HSS.periodAt(G.clockMin).name,
      recentEvents: G.recentEvents.slice(-4),
    };
  }

  const FALLBACKS = {
    student: ["Sorry, what?", "Erm… okay.", "*shrugs* If you say so.", "Wait, is this about homework?", "Miss the bus again, I swear—sorry, yeah?"],
    staff: ["Right, noted — catch me at break if it's urgent.", "Mm, let me think about that one.", "Good shout. I'll follow it up.", "Busy one today, isn't it?"],
  };
  const fb = (npc) => {
    const pool = FALLBACKS[npc.profile.kind === 'student' ? 'student' : 'staff'];
    return pool[Math.floor(Math.random() * pool.length)];
  };

  async function talkTo(npc, playerMessage, { record = true } = {}) {
    const hist = historyFor(npc.id);
    let text;
    try {
      if (!aiEnabled) throw new Error('offline');
      const r = await fetch('/api/npc/dialogue', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npc: profilePayload(npc), playerMessage, history: hist, context: context() }),
      });
      if (!r.ok) throw new Error(`http ${r.status}`);
      text = (await r.json()).text || fb(npc);
    } catch { text = fb(npc); }
    if (record) {
      hist.push({ fromPlayer: true, text: playerMessage }, { fromPlayer: false, text });
      if (hist.length > 24) hist.splice(0, hist.length - 24);
    }
    return text;
  }

  async function talkToGroup(npcs, playerMessage) {
    try {
      if (!aiEnabled) throw new Error('offline');
      const r = await fetch('/api/npc/group', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ npcs: npcs.map(profilePayload), playerMessage, context: context() }),
      });
      if (!r.ok) throw new Error(`http ${r.status}`);
      const { replies } = await r.json();
      if (replies && replies.length) return replies;
      throw new Error('empty');
    } catch {
      // offline: 1-2 random members mumble something
      const sample = npcs.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(2, npcs.length));
      return sample.map(n => ({ id: n.id, text: fb(n), mood: 'neutral' }));
    }
  }

  // Player performed a physical action near NPCs / walked away mid-chat.
  const reactToAction = (npc, actionLabel) => talkTo(npc, `[ACTION] ${HSS.game.playerName} ${actionLabel}`);
  const reactToEvent = (npc, eventLabel) => talkTo(npc, `[EVENT] ${eventLabel}`);

  return { talkTo, talkToGroup, reactToAction, reactToEvent, historyFor, get enabled() { return aiEnabled; } };
})();
