/* 심쿵영어 어휘 게임 - 학생 화면
   원칙: 점수(경험치)는 스스로 떠올려 맞힌 것에서만 나와요. 채점·경험치는 모두 서버가 해요.
   초등(kid): 펫 키우기 / 몬스터 배틀 중 골라요.  중등(teen): 레벨·주간 도전·내 기록 (원장님이 켜면 순위)
   오늘 복습을 끝내야 게임이 열려요. */
'use strict';

const GS = { ok: false, st: null };
const G_PETS = { dog: '🐶', cat: '🐱', rabbit: '🐰', panda: '🐼', fox: '🦊', penguin: '🐧', hamster: '🐹', chick: '🐥' };
const G_PET_KO = { dog: '강아지', cat: '고양이', rabbit: '토끼', panda: '판다', fox: '여우', penguin: '펭귄', hamster: '햄스터', chick: '병아리' };
const G_MONSTERS = ['👾', '🐙', '🦖', '🤖', '🦑', '🐲', '👽', '🦂', '🐊', '🦈', '🐉', '🦕'];
const G_GAMES = {
  balloon:    { ic: '🎈', n: '풍선 터뜨리기', d: '소리를 듣고 맞는 단어 풍선을 터뜨려요', kid: 1 },
  tiles:      { ic: '🧩', n: '글자 퍼즐', d: '섞인 글자 조각으로 단어를 완성해요', kid: 1 },
  fade:       { ic: '👻', n: '사라지는 글자', d: '글자가 하나씩 사라져요. 끝까지 써 봐요', kid: 1, teen: 1 },
  lcwc:       { ic: '👀', n: '보고·가리고·쓰기', d: '3초 보고, 가린 뒤 직접 써요', kid: 1, teen: 1 },
  dictation:  { ic: '🎧', n: '받아쓰기', d: '소리만 듣고 철자를 써요', kid: 1, teen: 1 },
  battle:     { ic: '⚔️', n: '몬스터 배틀', d: '철자를 쓰면 공격! 몬스터를 물리쳐요', kid: 1, min: 5 },
  timeattack: { ic: '⏱️', n: '스펠링 타임어택', d: '60초 동안 몇 개나 쓸 수 있을까요?', teen: 1, min: 5 },
  chain:      { ic: '🔗', n: '파생어 사슬', d: 'decide → decision 처럼 바꿔 써요', teen: 1 },
  boss:       { ic: '👹', n: '오답 보스전', d: '자주 틀린 단어만 모였어요. 보스를 쓰러뜨려요', teen: 1, min: 5 }
};

/* ---------- 데이터 ---------- */
async function loadGame() {
  try {
    const { data, error } = await S.sb.rpc('vocab_game_state');
    if (error) { GS.ok = false; return; }          // 13단계 DB를 아직 설치하지 않았으면 게임 칸을 숨겨요
    GS.ok = true; GS.st = data;
  } catch (e) { GS.ok = false; }
}
function gLevel(xp) { let n = 1; while (25 * (n + 1) * n <= xp) n++; return { lv: n, from: 25 * n * (n - 1), to: 25 * (n + 1) * n }; }
function gMode() { return GS.st && GS.st.mode === 'kid' ? 'kid' : 'teen'; }
function gRevToday() { const t = kstToday(), r = VS.rlog.find(x => x.day === t); return r ? r.n : 0; }
function gOpen() { return vLearned() + VS.srs.length > 0 && (vDue().length === 0 || gRevToday() >= 30); }
function gPool() {
  const byId = new Map(VS.items.map(i => [i.id, i]));
  const learned = VS.srs.map(r => ({ r, it: byId.get(r.item_id) })).filter(x => x.it);
  // 기억이 약한 단어(상자 낮음·틀린 적 있음)가 먼저 나와요
  return learned.sort((a, b) => (a.r.box - b.r.box) || ((b.r.wrong_n || 0) - (a.r.wrong_n || 0)) || (Math.random() - .5)).map(x => x.it);
}
function gWrongPool() {
  const byId = new Map(VS.items.map(i => [i.id, i]));
  return VS.srs.filter(r => (r.wrong_n || 0) > 0 || (r.lapses || 0) > 0 || r.box <= 1).map(r => byId.get(r.item_id)).filter(Boolean);
}
function gTodayPick() { const keys = Object.keys(G_GAMES).filter(k => G_GAMES[k][gMode()]); const d = Math.floor(Date.parse(kstToday()) / 864e5); return keys[d % keys.length]; }

/* ---------- 철자 보이기: 소리 덩어리 + 헷갈리는 글자 색칠 ---------- */
function gSylOk(it) { return !!it.syllables && letters(it.syllables).toLowerCase() === letters(it.word).toLowerCase(); }
function gSyl(it) {
  const s = gSylOk(it) ? it.syllables : it.word, tr = (it.tricky || []).map(t => String(t).toLowerCase()).filter(Boolean);
  const chars = [...s], pos = []; let lw = '';
  chars.forEach((c, i) => { if (/[a-z]/i.test(c)) { pos.push(i); lw += c.toLowerCase(); } });
  const mark = new Set();
  for (const t of tr) { const k = lw.indexOf(t); if (k >= 0) for (let j = k; j < k + t.length; j++) mark.add(pos[j]); }
  return chars.map((c, i) => c === '·' ? '<i class="gdot">·</i>' : mark.has(i) ? `<b class="gtr">${esc(c)}</b>` : esc(c)).join('');
}
function gSpellBox(it, full) {
  const parts = [];
  if ((gSylOk(it) && it.syllables.includes('·')) || (it.tricky || []).length) parts.push(`<div class="gsyl">${gSyl(it)}</div>`);
  if (it.spell_note) parts.push(`<div class="gnote">✏️ ${esc(it.spell_note)}</div>`);
  if (full && it.mnemonic) parts.push(`<div class="gmn">💡 ${esc(it.mnemonic)}</div>`);
  if (full && it.root_note) parts.push(`<div class="gnote">🌱 ${esc(it.root_note)}</div>`);
  if (full && Array.isArray(it.derivs) && it.derivs.length) parts.push(`<div class="gder">${it.derivs.map(d => `<span><b>${esc(d.w)}</b> ${esc(d.pos || '')} ${esc(d.ko || '')}</span>`).join('')}</div>`);
  return parts.length ? `<div class="gspell">${parts.join('')}</div>` : '';
}
// 틀린 글자 표시: 정답 철자에서 내가 빠뜨리거나 다르게 쓴 글자를 빨갛게 보여요
function gDiff(ans, word) {
  const a = [...String(ans || '').toLowerCase()], w = [...String(word || '')], wl = w.map(c => c.toLowerCase());
  const n = a.length, m = w.length, L = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === wl[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const keep = new Set(); let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === wl[j]) { keep.add(j); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
  const html = w.map((c, k) => c === ' ' ? ' ' : keep.has(k) ? esc(c) : `<b class="gx">${esc(c)}</b>`).join('');
  return `<div class="gdiff"><span class="tiny">빨간 글자를 다시 봐요</span><div>${html}</div></div>`;
}

/* ---------- 홈에 들어가는 부분 ---------- */
function gHomeChip() {
  if (!GS.ok || !GS.st) return '';
  const L = gLevel(GS.st.xp || 0);
  if (gMode() === 'kid' && GS.st.theme === 'pet') return `<span class="vchip">${G_PETS[GS.st.pet] || '🐶'} Lv.${L.lv}</span>`;
  if (gMode() === 'kid' && GS.st.theme === 'monster') return `<span class="vchip">⚔️ Lv.${L.lv}</span>`;
  return `<span class="vchip">${gMode() === 'kid' ? '🎮' : '🏅'} Lv.${L.lv}</span>`;
}
function gPetFace(st, open) {
  const L = gLevel(st.xp || 0), pet = G_PETS[st.pet] || '🐶';
  const acc = L.lv >= 10 ? '👑' : L.lv >= 6 ? '🎓' : L.lv >= 3 ? '🎀' : '';
  const miss = st.last_day ? Math.round((Date.parse(kstToday()) - Date.parse(st.last_day)) / 864e5) : 0;
  const mood = open ? ['😋', '배불러요! 오늘 복습 고마워요'] : miss >= 2 ? ['😴', '많이 기다렸어요… 복습하면 일어나요'] : ['🥺', '배고파요… 오늘 복습을 하면 밥을 먹어요'];
  const scale = 1 + Math.min(L.lv, 12) * 0.06;
  return `<div class="gpet"><div class="gpet-ic" style="font-size:${(3.2 * scale).toFixed(2)}rem">${pet}${acc ? `<span class="gacc">${acc}</span>` : ''}</div>
    <div class="gbub">${mood[0]} ${esc(mood[1])}</div></div>`;
}
function gXpBar(st) {
  const L = gLevel(st.xp || 0), p = Math.round(((st.xp || 0) - L.from) / (L.to - L.from) * 100);
  return `<div class="gxp"><div class="row between"><b>Lv.${L.lv}</b><span class="tiny">${(st.xp || 0) - L.from} / ${L.to - L.from} XP · 오늘 +${st.today_xp || 0}</span></div><div class="progress"><i style="width:${p}%"></i></div></div>`;
}
function gHomePanel() {
  if (!GS.ok || !GS.st) return '';
  const st = GS.st, open = gOpen(), due = vDue().length, kid = gMode() === 'kid';
  let top = '';
  if (kid && !st.theme) {
    top = `<div class="gpick"><h3 style="margin:0 0 6px">나만의 게임을 골라요!</h3>
      <div class="row vtwo"><button class="btn big ghost" data-gtheme="pet">🐶 펫 키우기<br><span class="tiny">단어를 맞히면 펫이 자라요</span></button>
      <button class="btn big ghost" data-gtheme="monster">⚔️ 몬스터 배틀<br><span class="tiny">철자로 몬스터를 물리쳐요</span></button></div></div>`;
  } else if (kid && st.theme === 'pet') {
    top = `<div class="row between"><h3 style="margin:0">${esc(st.pet_name || G_PET_KO[st.pet] || '내 펫')}</h3><button class="btn ghost small" data-gtheme="change">바꾸기</button></div>${gPetFace(st, open)}${gXpBar(st)}`;
  } else if (kid) {
    const w = st.wins || 0;
    top = `<div class="row between"><h3 style="margin:0">몬스터 도감 <span class="tiny">${w}마리 물리침</span></h3><button class="btn ghost small" data-gtheme="change">바꾸기</button></div>
      <div class="gdex">${G_MONSTERS.map((mo, i) => `<span class="${i < w ? 'got' : ''}">${i < w ? mo : '❔'}</span>`).join('')}</div>${gXpBar(st)}`;
  } else {
    const up = (st.week_xp || 0) - (st.last_week_xp || 0);
    top = `${gXpBar(st)}<div class="gweek"><div><small>이번 주</small><b>${st.week_xp || 0} XP</b></div><div><small>지난주의 나</small><b>${st.last_week_xp || 0} XP</b></div>
      <div><small>${up >= 0 ? '앞서는 중' : '따라잡기'}</small><b class="${up >= 0 ? 'vgreen' : 'vred'}">${up >= 0 ? '+' : ''}${up}</b></div>
      <div><small>타임어택 최고</small><b>${(st.best && st.best.timeattack) || 0}개</b></div></div>
      ${st.league ? '<button class="btn ghost small" id="glg" style="margin-top:8px">🏆 이번 주 순위 보기</button>' : ''}`;
  }
  const lock = !(vLearned() + VS.srs.length) ? '유닛 테스트를 한 번 보면 게임이 열려요.' : !open ? `오늘 복습을 먼저 끝내면 게임이 열려요 (${due}개 남음)` : '';
  const today = gTodayPick();
  const games = Object.entries(G_GAMES).filter(([, g]) => g[kid ? 'kid' : 'teen']).map(([k, g]) =>
    `<button class="ggame ${k === today ? 'today' : ''}" data-game="${k}" ${lock || (kid && !st.theme) ? 'disabled' : ''}><span class="gic">${g.ic}</span><b>${g.n}</b><span class="tiny">${g.d}</span>${k === today ? '<span class="badge">오늘의 게임</span>' : ''}</button>`).join('');
  return `<div class="card gpanel" id="gpanel">${top}
    ${lock ? `<div class="result warn" style="margin:10px 0 0">🔒 ${lock}</div>` : ''}
    <div class="ggrid">${games}</div>
    <p class="tiny" style="margin:8px 0 0">경험치는 스스로 떠올려 맞혔을 때만 올라요. 직접 쓰는 게임일수록 더 많이 받아요. (같은 단어는 하루 한 번)</p></div>`;
}
function gBindHome() {
  document.querySelectorAll('[data-gtheme]').forEach(b => b.onclick = () => gSetup(b.dataset.gtheme === 'change' ? null : b.dataset.gtheme));
  document.querySelectorAll('[data-game]').forEach(b => b.onclick = () => gStart(b.dataset.game));
  if ($('#glg')) $('#glg').onclick = () => gLeague();
}
async function gRefreshPanel() {
  await loadGame();
  const el = $('#gpanel'); if (!el) return;
  el.outerHTML = gHomePanel(); gBindHome();
}

/* ---------- 초등: 테마·펫 고르기 ---------- */
function gSetup(theme) {
  const st = GS.st || {};
  let th = theme || st.theme || 'pet', pet = st.pet || 'dog';
  const draw = () => {
    shell(`<p><a href="#" id="back">← 어휘 홈</a></p><h1>나만의 게임 고르기</h1>
      <div class="card"><div class="row vtwo"><button class="btn big ${th === 'pet' ? '' : 'ghost'}" data-th="pet">🐶 펫 키우기</button><button class="btn big ${th === 'monster' ? '' : 'ghost'}" data-th="monster">⚔️ 몬스터 배틀</button></div>
      ${th === 'pet' ? `<h3 style="margin-top:14px">어떤 친구를 키울까요?</h3><div class="gpets">${Object.entries(G_PETS).map(([k, e]) => `<button class="gpetbtn ${k === pet ? 'on' : ''}" data-pet="${k}">${e}<span>${G_PET_KO[k]}</span></button>`).join('')}</div>
        <label style="margin-top:10px">이름 지어 주기 (12자까지)</label><input type="text" id="gpn" maxlength="12" value="${esc(st.pet_name || '')}" placeholder="예: 뭉치">`
      : '<p class="muted" style="margin-top:12px">철자를 직접 쓰면 큰 공격! 몬스터를 물리칠 때마다 도감이 채워져요.</p>'}
      <button class="btn" id="gok" style="width:100%;margin-top:14px">이걸로 할래요</button></div>`);
    $('#back').onclick = e => { e.preventDefault(); vocabHome(); };
    document.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { th = b.dataset.th; draw(); });
    document.querySelectorAll('[data-pet]').forEach(b => b.onclick = () => { pet = b.dataset.pet; const n = $('#gpn') ? $('#gpn').value : ''; draw(); if ($('#gpn')) $('#gpn').value = n; });
    $('#gok').onclick = async () => {
      const btn = $('#gok'); btn.disabled = true;
      try {
        const { error } = await S.sb.rpc('vocab_game_setup', { p_theme: th, p_pet: pet, p_name: $('#gpn') ? $('#gpn').value.trim() : '' });
        if (error) throw error;
        await loadGame(); toast(th === 'pet' ? '반가워요! 함께 단어를 외워요 🐾' : '모험을 시작해요! ⚔️'); vocabHome();
      } catch (e) { btn.disabled = false; toast(errText(e), 4000); }
    };
  };
  draw();
}

/* ---------- 중등: 이번 주 순위 (원장님이 켰을 때만) ---------- */
async function gLeague() {
  shell('<p class="muted">불러오는 중…</p>');
  try {
    const { data, error } = await S.sb.rpc('vocab_league'); if (error) throw error;
    const rows = (data && data.rows) || [];
    shell(`<p><a href="#" id="back">← 어휘 홈</a></p><h1>🏆 이번 주 순위</h1>
      <div class="card">${!data.enabled ? '<p>지금은 순위를 보지 않아요. 지난주의 나와 경쟁해 봐요!</p>' : rows.length ? `<ol class="glg">${rows.map((r, i) => `<li class="${r.me ? 'me' : ''}"><span>${i + 1}</span><b>${esc(r.name)}${r.me ? ' (나)' : ''}</b><em>${r.xp} XP</em></li>`).join('')}</ol>` : '<p>아직 기록이 없어요.</p>'}
      <p class="tiny">월요일마다 모두 0에서 다시 시작해요. 스스로 쓴 철자가 가장 큰 점수예요.</p></div>`);
    $('#back').onclick = e => { e.preventDefault(); vocabHome(); };
  } catch (e) { toast(errText(e), 4000); vocabHome(); }
}

/* ---------- 게임 공통 ---------- */
async function gSend(it, game, answer, runId, deriv) {
  const { data, error } = await S.sb.rpc('vocab_game_submit', { p_client: uuid(), p_item: it.id, p_game: game, p_answer: answer, p_run: runId, p_deriv: deriv ?? null });
  if (error) throw error;
  if (GS.st && data) { GS.st.xp = (GS.st.xp || 0) + (data.xp || 0); GS.st.today_xp = (GS.st.today_xp || 0) + (data.xp || 0); GS.st.week_xp = (GS.st.week_xp || 0) + (data.xp || 0); }
  VS.days.add(kstToday());
  return data;
}
function gChoices(it, pool) {
  const seen = new Set([vNorm(it.word)]), out = [];
  for (const x of shuffle(pool.concat(VS.items))) { const k = vNorm(x.word); if (!seen.has(k) && vNorm(x.meaning) !== vNorm(it.meaning)) { seen.add(k); out.push(x.word); } if (out.length >= 3) break; }
  return shuffle([it.word, ...out]);
}
function gTop(game, i, n, extra) {
  const g = G_GAMES[game];
  return `<p><a href="#" id="back">← 어휘 홈</a></p><div class="row between"><b>${g.ic} ${g.n}</b><span class="tiny">${extra || `${i} / ${n}`}</span></div>
    <div class="progress" style="margin:8px 0 14px"><i style="width:${n ? Math.min(100, i / n * 100) : 0}%"></i></div>`;
}
function gBack() { const b = $('#back'); if (b) b.onclick = e => { e.preventDefault(); clearInterval(GS.timer); clearTimeout(GS.tm); if ('speechSynthesis' in window) speechSynthesis.cancel(); vocabHome(); }; }
function gTypeBox(ph) { return `<input type="text" id="gin" class="vin" placeholder="${ph || '영어로 입력'}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">`; }
function gBindType(fn) {
  const inp = $('#gin'); if (!inp) return;
  inp.focus();
  inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); fn(inp.value); } };
  if ($('#ggo')) $('#ggo').onclick = () => fn(inp.value);
}
function gStart(game) {
  const g = G_GAMES[game]; if (!g) return;
  if (!gOpen()) return toast('오늘 복습을 먼저 끝내요!', 3000);
  let pool = gPool();
  if (game === 'chain') pool = pool.filter(it => Array.isArray(it.derivs) && it.derivs.some(d => d && d.w));
  if (game === 'boss') { const w = gWrongPool(); pool = w.length >= 5 ? w : w.concat(gPool().filter(x => !w.includes(x))); }
  if (game === 'tiles') pool = pool.filter(it => letters(it.word).length <= 14);
  if (!pool.length) return toast(game === 'chain' ? '아직 파생어가 있는 단어를 외우지 않았어요' : '게임할 단어가 없어요', 3500);
  if (g.min && pool.length < g.min) return toast(`외운 단어가 ${g.min}개 이상이면 열려요`, 3500);
  AT.start();
  const runId = uuid();
  const n = gMode() === 'kid' ? 10 : 12;
  const list = pool.slice(0, Math.max(n, 5)).slice(0, n);
  ({ balloon: gBalloon, tiles: gTiles, fade: gFade, lcwc: gLcwc, dictation: gDict, battle: gBattle, boss: gBattle, timeattack: gTimeAttack, chain: gChain })[game](game, shuffle(list), runId, pool);
}
function letters(w) { return String(w || '').replace(/[^A-Za-z]/g, ''); }
async function gEnd(game, runId, res, extra) {
  GS.ended = GS.ended || new Set();
  if (GS.ended.has(runId)) return;
  GS.ended.add(runId);
  clearInterval(GS.timer); clearTimeout(GS.tm);
  const ms = AT.stop() * 1000;
  let fin = null;
  try { const { data, error } = await S.sb.rpc('vocab_game_finish', { p_run: runId, p_game: game, p_ms: ms }); if (!error) fin = data; } catch (e) { /* 답은 이미 저장됐어요 */ }
  const ok = res.filter(r => r.ok).length, xp = res.reduce((s, r) => s + (r.xp || 0), 0);
  const kid = gMode() === 'kid', st = GS.st || {};
  const face = kid && st.theme === 'pet' ? `<div class="gpet-ic" style="font-size:3.6rem">${G_PETS[st.pet] || '🐶'}</div><p>${xp ? `냠냠! 경험치 +${xp} 맛있어요` : '같이 연습해서 좋아요!'}</p>` : `<div class="vend-ic">${G_GAMES[game].ic}</div>`;
  const wrong = res.filter(r => !r.ok);
  shell(`<div class="card vend">${face}<h2>${extra && extra.title ? esc(extra.title) : '게임 끝!'}</h2>
    <p class="clock big">${ok} / ${res.length}</p><p class="muted">맞힌 문제 · 경험치 +${xp}${fin && fin.record ? ' · 🏆 내 최고 기록!' : ''}</p>
    ${wrong.length ? `<div class="wlist"><div class="tiny">다시 볼 단어</div>${[...new Map(wrong.map(w => [w.it.id, w])).values()].map(w => `<div class="wrow"><b>${esc(w.target || w.it.word)}</b> ${vSpk(w.target || w.it.word)}<span>${esc(w.it.meaning)}</span><span class="tiny">내 답: ${esc(w.ans)}</span></div>`).join('')}</div>` : '<p>모두 맞혔어요! 👏</p>'}
    <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="again">한 판 더</button><button class="btn ghost" id="home">어휘 홈으로</button></div></div>`);
  vBindSpk();
  $('#again').onclick = () => gStart(game); $('#home').onclick = () => vocabHome();
  loadGame();
}
// 문제 하나 처리: 서버 채점 → 결과 보여 주기 → 다음
async function gJudge(ctx, it, game, ans, deriv) {
  if (ctx.busy) return null;
  if (!String(ans || '').trim()) { toast('답을 먼저 적어 주세요'); return null; }
  ctx.busy = true;
  try {
    const r = await gSend(it, game, ans, ctx.runId, deriv);
    ctx.res.push({ it, ok: r.is_correct, ans, xp: r.xp || 0, target: r.expected });
    if (r.is_correct) TTS.say(r.expected || it.word, 1);
    return r;
  } catch (e) { toast(errText(e), 4000); return null; } finally { ctx.busy = false; }
}
function gFeedback(r, it, ans, target) {
  return r.is_correct ? `<div class="result ok"><b>정답! ${r.xp ? `+${r.xp} XP` : ''}</b> ${esc(target || it.word)} = ${esc(it.meaning)}</div>`
    : `<div class="result bad"><b>정답: ${esc(target || it.word)}</b> ${vSpk(target || it.word)}${gDiff(ans, target || it.word)}${it.spell_note ? `<div class="tiny">✏️ ${esc(it.spell_note)}</div>` : ''}</div>`;
}
// 순서대로 문제를 내는 게임들이 같이 써요. 틀린 단어는 끝에 한 번 더 나와요.
function gSeq(game, list, runId, ask) {
  const ctx = { runId, res: [], q: list.map(it => ({ it })), i: 0, busy: false, total: list.length };
  const step = () => {
    if (ctx.i >= ctx.q.length) return gEnd(game, runId, ctx.res);
    const x = ctx.q[ctx.i];
    ask(ctx, x, async (ans, deriv, target) => {
      const r = await gJudge(ctx, x.it, game, ans, deriv); if (!r) return false;
      if (!r.is_correct && !x.again) ctx.q.push({ ...x, again: true });
      return r;
    }, () => { ctx.i++; step(); });
  };
  step();
}
function gNextBtn(next) { const b = $('#gnx'); if (b) { b.focus(); b.onclick = next; } }

/* 🎈 풍선 터뜨리기: 소리 듣고 고르기 (고르기라 점수가 작아요) */
function gBalloon(game, list, runId, pool) {
  gSeq(game, list, runId, (ctx, x, judge, next) => {
    const it = x.it, ch = gChoices(it, pool);
    const paint = (r, picked) => {
      shell(`${gTop(game, ctx.i, ctx.q.length)}<div class="card vq gcenter"><button class="btn ghost big" id="gsay">🔊 다시 듣기</button>
        <div class="gballoons">${ch.map((c, k) => `<button class="gballoon b${k % 5} ${r ? (vNorm(c) === vNorm(it.word) ? 'right' : c === picked ? 'pop' : 'dim') : ''}" data-c="${esc(c)}" ${r ? 'disabled' : ''} style="animation-delay:${k * .25}s">${esc(c)}</button>`).join('')}</div>
        ${r ? gFeedback(r, it, picked) : ''}</div>${r ? '<button class="btn" id="gnx" style="width:100%">다음</button>' : ''}`);
      gBack(); vBindSpk();
      $('#gsay').onclick = () => TTS.say(it.word, .85);
      document.querySelectorAll('.gballoon').forEach(b => b.onclick = async () => { const rr = await judge(b.dataset.c); if (rr) paint(rr, b.dataset.c); });
      gNextBtn(next);
    };
    paint(null); setTimeout(() => TTS.say(it.word, .85), 300);
  });
}

/* 🧩 글자 퍼즐: 섞인 글자로 철자 만들기 */
function gTiles(game, list, runId) {
  gSeq(game, list, runId, (ctx, x, judge, next) => {
    const it = x.it, w = it.word, slots = [...w].map(c => /[A-Za-z]/.test(c) ? null : c);
    const decoy = gMode() === 'kid' ? 2 : 3, abc = 'aeioulnrstmdbcp';
    const tiles = shuffle([...letters(w).toLowerCase()].concat(Array.from({ length: decoy }, () => abc[Math.random() * abc.length | 0]))).map((c, k) => ({ c, k, used: false }));
    const picked = [];
    const built = () => { let p = 0; return slots.map(s => s !== null ? s : (picked[p] ? picked[p++].c : '_')).join(''); };
    const need = letters(w).length;
    const paint = r => {
      shell(`${gTop(game, ctx.i, ctx.q.length)}<div class="card vq gcenter"><div class="fc-mean big">${esc(it.meaning)}</div>${vSpk(w)}
        <div class="gslots">${[...built()].map(c => `<span class="${c === '_' ? 'e' : ''}">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</div>
        ${r ? gFeedback(r, it, built()) : `<div class="gtiles">${tiles.map(t => `<button class="gtile" data-k="${t.k}" ${t.used ? 'disabled' : ''}>${esc(t.c)}</button>`).join('')}</div>
        <div class="row" style="justify-content:center"><button class="btn ghost small" id="gbk">⌫ 지우기</button></div>`}</div>
        ${r ? '<button class="btn" id="gnx" style="width:100%">다음</button>' : ''}`);
      gBack(); vBindSpk(); gNextBtn(next);
      if (r) return;
      document.querySelectorAll('.gtile').forEach(b => b.onclick = async () => {
        const t = tiles.find(z => z.k === +b.dataset.k); if (!t || t.used || ctx.busy) return;
        t.used = true; picked.push(t); paint(null);
        if (picked.length === need) { const rr = await judge(built()); if (rr) paint(rr); else { picked.length = 0; tiles.forEach(z => z.used = false); paint(null); } }
      });
      $('#gbk').onclick = () => { const t = picked.pop(); if (t) { t.used = false; paint(null); } };
    };
    paint(null);
  });
}

/* 👻 사라지는 글자: 글자가 점점 사라지고, 마지막엔 뜻만 보고 써요 (마지막만 채점) */
function gMask(w, ratio) {
  const idx = [...w].map((c, i) => /[A-Za-z]/.test(c) ? i : -1).filter(i => i > 0);
  const hide = new Set(shuffle(idx).slice(0, Math.ceil(idx.length * ratio)));
  return [...w].map((c, i) => hide.has(i) ? '_' : c).join('');
}
function gFade(game, list, runId) {
  gSeq(game, list, runId, (ctx, x, judge, next) => {
    const it = x.it, stages = [gMask(it.word, .35), gMask(it.word, .7), null];
    let s = 0;
    const paint = (r, ans, localOk) => {
      const final = stages[s] === null;
      shell(`${gTop(game, ctx.i, ctx.q.length)}<div class="card vq gcenter"><div class="fc-mean big">${esc(it.meaning)}</div>
        <div class="gstage">${[0, 1, 2].map(k => `<i class="${k < s ? 'done' : k === s ? 'on' : ''}"></i>`).join('')}</div>
        <div class="vmask big">${final ? '?'.repeat(Math.min(letters(it.word).length, 14)).split('').join(' ') : esc(stages[s])}</div>
        ${r ? gFeedback(r, it, ans) : localOk === false ? `<div class="result bad">${gDiff(ans, it.word)}</div><button class="btn" id="gnx2" style="width:100%">다음 단계</button>` : `${gTypeBox(final ? '이제 다 사라졌어요! 전부 써 보세요' : '빈칸을 채워 단어 전체를 써요')}<button class="btn" id="ggo" style="width:100%">확인</button>`}</div>
        ${r ? '<button class="btn" id="gnx" style="width:100%">다음</button>' : ''}`);
      gBack(); vBindSpk(); gNextBtn(next);
      if ($('#gnx2')) { $('#gnx2').focus(); $('#gnx2').onclick = () => { s++; paint(); }; }
      if (r || localOk === false) return;
      gBindType(async v => {
        if (!String(v || '').trim()) return toast('답을 먼저 적어 주세요');
        if (!final) { if (vNorm(v) === vNorm(it.word)) { s++; paint(); } else paint(null, v, false); return; }
        const rr = await judge(v); if (rr) paint(rr, v);
      });
    };
    paint();
  });
}

/* 👀 보고·가리고·쓰기: 3초 보고 → 가리고 → 쓰기 → 확인 */
function gLcwc(game, list, runId) {
  gSeq(game, list, runId, (ctx, x, judge, next) => {
    const it = x.it;
    let left = 3;
    const look = () => {
      shell(`${gTop(game, ctx.i, ctx.q.length)}<div class="card vq gcenter"><div class="tiny">잘 보고 기억해요 · ${left}초</div><div class="fc-word">${esc(it.word)}</div>${gSpellBox(it)}<div class="fc-mean">${esc(it.meaning)}</div></div>`);
      gBack();
    };
    const write = (r, ans) => {
      shell(`${gTop(game, ctx.i, ctx.q.length)}<div class="card vq gcenter"><div class="tiny">가렸어요! 기억나는 대로 써요</div><div class="fc-mean big">${esc(it.meaning)}</div>
        ${r ? gFeedback(r, it, ans) : `${gTypeBox()}<button class="btn" id="ggo" style="width:100%">확인</button>`}</div>${r ? '<button class="btn" id="gnx" style="width:100%">다음</button>' : ''}`);
      gBack(); vBindSpk(); gNextBtn(next);
      if (!r) gBindType(async v => { const rr = await judge(v); if (rr) write(rr, v); });
    };
    look(); TTS.say(it.word, .9);
    clearInterval(GS.timer);
    GS.timer = setInterval(() => { left--; if (left <= 0) { clearInterval(GS.timer); write(); } else look(); }, 1000);
  });
}

/* 🎧 받아쓰기: 소리만 듣고 쓰기 */
function gDict(game, list, runId) {
  gSeq(game, list, runId, (ctx, x, judge, next) => {
    const it = x.it;
    const paint = (r, ans) => {
      shell(`${gTop(game, ctx.i, ctx.q.length)}<div class="card vq gcenter"><div class="row" style="justify-content:center"><button class="btn big" id="gsay">🔊 듣기</button><button class="btn ghost" id="gslow">🐢 천천히</button></div>
        ${r ? `<div class="fc-mean">${esc(it.meaning)}</div>${gFeedback(r, it, ans)}` : `${gTypeBox('들리는 대로 써요')}<button class="btn" id="ggo" style="width:100%">확인</button>`}</div>${r ? '<button class="btn" id="gnx" style="width:100%">다음</button>' : ''}`);
      gBack(); vBindSpk(); gNextBtn(next);
      $('#gsay').onclick = () => { TTS.say(it.word, .9); const i = $('#gin'); if (i) i.focus(); };
      $('#gslow').onclick = () => { TTS.say(it.word, .55); const i = $('#gin'); if (i) i.focus(); };
      if (!r) gBindType(async v => { const rr = await judge(v); if (rr) paint(rr, v); });
    };
    paint(); setTimeout(() => TTS.say(it.word, .9), 300);
  });
}

/* 🔗 파생어 사슬 (중등) */
function gChain(game, list, runId) {
  gSeq(game, list, runId, (ctx, x, judge, next) => {
    const it = x.it, ds = (it.derivs || []).map((d, k) => ({ ...d, k })).filter(d => d.w);
    const d = x.d || (x.d = ds[Math.random() * ds.length | 0]);
    const paint = (r, ans) => {
      shell(`${gTop(game, ctx.i, ctx.q.length)}<div class="card vq gcenter"><div class="fc-word sm">${esc(it.word)} <span class="tiny">${esc(it.pos || '')} ${esc(it.meaning)}</span></div>
        <div class="gchain">⬇︎</div><div class="fc-mean big">${esc(d.pos || '')} ${esc(d.ko || '')}</div>
        ${r ? gFeedback(r, it, ans, d.w) : `${gTypeBox('바뀐 단어를 써요')}<button class="btn" id="ggo" style="width:100%">확인</button>`}</div>${r ? '<button class="btn" id="gnx" style="width:100%">다음</button>' : ''}`);
      gBack(); vBindSpk(); gNextBtn(next);
      if (!r) gBindType(async v => { const rr = await judge(v, d.k); if (rr) paint(rr, v); });
    };
    paint();
  });
}

/* ⚔️ 몬스터 배틀 · 👹 오답 보스전: 철자를 쓰면 공격, 틀리면 하트가 줄어요 */
function gBattle(game, list, runId, pool) {
  const boss = game === 'boss', st = GS.st || {};
  const hits = Math.min(7, Math.max(5, list.length));
  const monster = boss ? '👹' : G_MONSTERS[Math.min(st.wins || 0, G_MONSTERS.length - 1)];
  const ctx = { runId, res: [], busy: false, hp: hits, hearts: 3, q: list.slice(), i: 0 };
  const draw = (r, ans, it) => {
    const done = ctx.hp <= 0 || ctx.hearts <= 0;
    const cur = it || ctx.q[ctx.i % ctx.q.length];
    shell(`${gTop(game, hits - ctx.hp, hits, `${'❤️'.repeat(ctx.hearts)}${'🤍'.repeat(3 - ctx.hearts)}`)}
      <div class="card vq gcenter"><div class="gmon ${r ? (r.is_correct ? 'hit' : 'atk') : ''}">${monster}</div>
        <div class="ghp"><i style="width:${ctx.hp / hits * 100}%"></i></div>
        <div class="fc-mean big">${esc(cur.meaning)}</div>
        ${r ? gFeedback(r, cur, ans) : `${gTypeBox('철자를 쓰면 공격!')}<button class="btn" id="ggo" style="width:100%">⚔️ 공격</button>`}</div>
      ${r ? `<button class="btn" id="gnx" style="width:100%">${done ? '결과 보기' : '다음'}</button>` : ''}`);
    gBack(); vBindSpk();
    gNextBtn(() => {
      if (ctx.hp <= 0) return gEnd(game, runId, ctx.res, { title: boss ? '보스를 쓰러뜨렸어요! 🎉' : '몬스터를 물리쳤어요! 🎉' });
      if (ctx.hearts <= 0) return gEnd(game, runId, ctx.res, { title: '아쉬워요! 다시 도전해요 💪' });
      draw();
    });
    if (r) return;
    gBindType(async v => {
      const rr = await gJudge(ctx, cur, game, v); if (!rr) return;
      if (rr.is_correct) ctx.hp--; else { ctx.hearts--; ctx.q.push(cur); }
      ctx.i++;
      draw(rr, v, cur);
    });
  };
  draw();
}

/* ⏱️ 스펠링 타임어택 (중등): 60초, 콤보 */
function gTimeAttack(game, list, runId, pool) {
  const ctx = { runId, res: [], busy: false, combo: 0, maxCombo: 0, t0: Date.now(), q: shuffle(pool.slice(0, 40)), i: 0, flash: '' };
  const LIM = 60000;
  const draw = () => {
    const it = ctx.q[ctx.i % ctx.q.length], left = Math.max(0, LIM - (Date.now() - ctx.t0));
    shell(`${gTop(game, LIM - left, LIM, `<b id="gclk">${Math.ceil(left / 1000)}초</b>`)}
      <div class="card vq gcenter"><div class="row between"><span class="badge">맞힘 ${ctx.res.filter(r => r.ok).length}</span><span class="badge ${ctx.combo >= 3 ? 'ok' : 'gray'}">🔥 콤보 ${ctx.combo}</span></div>
      <div class="fc-mean big">${esc(it.meaning)}</div>${gTypeBox()}<div id="gfl" class="tiny" style="min-height:1.6em">${ctx.flash}</div></div>`);
    gBack();
    gBindType(async v => {
      if (ctx.over || !String(v || '').trim()) return;
      const rr = await gJudge(ctx, it, game, v); if (!rr || ctx.over) return;
      if (rr.is_correct) { ctx.combo++; ctx.maxCombo = Math.max(ctx.maxCombo, ctx.combo); ctx.flash = `<span class="vgreen">✓ ${esc(it.word)}</span>`; }
      else { ctx.combo = 0; ctx.flash = `<span class="vred">✗ 정답: ${esc(rr.expected || it.word)}</span>`; }
      ctx.i++;
      if (Date.now() - ctx.t0 >= LIM) return finish();
      draw();
    });
  };
  const finish = () => { if (ctx.over) return; ctx.over = true; clearInterval(GS.timer); gEnd(game, runId, ctx.res, { title: `시간 끝! 최고 콤보 ${ctx.maxCombo}` }); };
  clearInterval(GS.timer);
  GS.timer = setInterval(() => {
    const el = $('#gclk'); if (!el) { clearInterval(GS.timer); return; }
    const left = LIM - (Date.now() - ctx.t0);
    if (left <= 0) { if (!ctx.busy) finish(); } else el.textContent = Math.ceil(left / 1000) + '초';
  }, 250);
  draw();
}

/* ---------- 유닛 '철자 쓰기' 앞에 하는 철자 익히기 (채점 없이 연습) ---------- */
function gSpellPrep(unitId, items, done) {
  const kid = gMode() === 'kid';
  const q = shuffle(items.slice()); let i = 0;
  const intro = () => {
    shell(`${vTop(unitId, 'write', 0, items.length)}<div class="card vq gcenter"><div class="vend-ic">🪜</div><h2>철자 익히기</h2>
      <p>${kid ? '소리 덩어리로 나눠 보고, 글자 조각으로 맞춰 본 다음' : '3초 보고 가린 뒤 써 보고 나서'} 진짜 철자 쓰기를 해요.</p>
      <p class="tiny">빨간 글자는 자주 틀리는 글자예요.</p></div>
      <div class="row vtwo"><button class="btn ghost" id="gskip">바로 철자 쓰기</button><button class="btn" id="ggo2">철자 익히기 시작</button></div>`);
    vBack(unitId);
    $('#gskip').onclick = done; $('#ggo2').onclick = one;
  };
  const one = () => {
    if (i >= q.length) return done();
    const it = q[i];
    // 1) 보기: 음절·헷갈리는 글자·연상
    shell(`${vTop(unitId, 'write', i, items.length)}<div class="card vq gcenter"><div class="fc-word">${gSyl(it)} ${vSpk(it.word)}</div><div class="fc-mean">${esc(it.meaning)}</div>
      ${gSpellBox({ ...it, syllables: '', tricky: [] }, true)}</div><button class="btn" id="gnx" style="width:100%">${kid ? '글자 조각으로 맞춰 보기' : '가리고 써 보기'}</button>`);
    vBack(unitId); vBindSpk(); TTS.say(it.word, .85);
    $('#gnx').onclick = kid ? () => tiles(it) : () => cover(it);
  };
  const after = (it, ok, ans) => {
    shell(`${vTop(unitId, 'write', i + 1, items.length)}<div class="card vq gcenter"><div class="fc-word">${esc(it.word)}</div>${ok ? '<div class="result ok"><b>좋아요! 👏</b></div>' : `<div class="result bad">${gDiff(ans, it.word)}</div>`}</div>
      <button class="btn" id="gnx" style="width:100%">${i + 1 < q.length ? '다음 단어' : '이제 철자 쓰기!'}</button>`);
    vBack(unitId); i++; gNextBtn(one);
  };
  const tiles = it => {
    const w = it.word, slots = [...w].map(c => /[A-Za-z]/.test(c) ? null : c);
    const tl = shuffle([...letters(w).toLowerCase()]).map((c, k) => ({ c, k, used: false })), picked = [];
    const built = () => { let p = 0; return slots.map(s => s !== null ? s : (picked[p] ? picked[p++].c : '_')).join(''); };
    const paint = () => {
      shell(`${vTop(unitId, 'write', i, items.length)}<div class="card vq gcenter"><div class="fc-mean big">${esc(it.meaning)}</div>
        <div class="gslots">${[...built()].map(c => `<span class="${c === '_' ? 'e' : ''}">${c === ' ' ? '&nbsp;' : esc(c)}</span>`).join('')}</div>
        <div class="gtiles">${tl.map(t => `<button class="gtile" data-k="${t.k}" ${t.used ? 'disabled' : ''}>${esc(t.c)}</button>`).join('')}</div>
        <div class="row" style="justify-content:center"><button class="btn ghost small" id="gbk">⌫ 지우기</button></div></div>`);
      vBack(unitId);
      document.querySelectorAll('.gtile').forEach(b => b.onclick = () => {
        const t = tl.find(z => z.k === +b.dataset.k); if (!t || t.used) return; t.used = true; picked.push(t);
        if (picked.length === tl.length) { const a = built(); after(it, vNorm(a) === vNorm(w), a); } else paint();
      });
      $('#gbk').onclick = () => { const t = picked.pop(); if (t) { t.used = false; paint(); } };
    };
    paint();
  };
  const cover = it => {
    shell(`${vTop(unitId, 'write', i, items.length)}<div class="card vq gcenter"><div class="tiny">가렸어요! 기억나는 대로 써요</div><div class="fc-mean big">${esc(it.meaning)}</div>${gTypeBox()}<button class="btn" id="ggo" style="width:100%">확인</button></div>`);
    vBack(unitId);
    gBindType(v => { if (!String(v || '').trim()) return toast('답을 먼저 적어 주세요'); after(it, vNorm(v) === vNorm(it.word), v); });
  };
  intro();
}
