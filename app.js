/* 심쿵영어 문법 학습 - 공통 + 학생 화면 */
'use strict';

const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STAGES = [['concept', '개념 확인'], ['basic', '기본'], ['mid', '중급'], ['adv', '심화'], ['writing', '서술형 쓰기'], ['exam', '내신대비']];
const STAGE_NAME = Object.fromEntries(STAGES);
const ERR_MSG = {
  not_logged_in: '로그인이 풀렸어요. 다시 로그인해 주세요.',
  no_assignment: '배정되지 않은 단원이에요.',
  no_question: '아직 공개되지 않은 문제예요.',
  empty_answer: '답을 먼저 적어 주세요.',
  retry_limit: '이 문제는 다시 풀 수 있는 횟수를 모두 썼어요.',
  waiting_teacher: '원장님이 확인하는 중이에요. 잠시만 기다려 주세요.',
  already_correct: '이미 맞힌 문제예요.',
  solve_first: '먼저 한 번 풀어 본 뒤에 해설을 볼 수 있어요.',
  forbidden: '권한이 없어요.',
  bad_score: '점수가 문제 배점을 넘었어요.'
};
function errText(e) {
  const m = (e && e.message) || String(e);
  for (const k in ERR_MSG) if (m.includes(k)) return ERR_MSG[k];
  if (/Failed to fetch|NetworkError|network/i.test(m)) return '인터넷 연결을 확인해 주세요. (답안은 아직 저장되지 않았어요)';
  return '문제가 생겼어요: ' + m;
}
/* 서버 함수 호출 (AI 피드백 등). 실패 원인을 알아보기 쉬운 문장으로 바꿔요. */
async function invokeFn(name, body) {
  if (!S.sb.functions) throw new Error('서버 함수를 쓸 수 없어요.');
  const { data, error } = await S.sb.functions.invoke(name, { body });
  if (error) {
    let msg = error.message || '';
    try { if (error.context && error.context.json) { const j = await error.context.json(); if (j && j.error) msg = j.error; } } catch (e) { /* 그대로 */ }
    if (/Failed to send|Failed to fetch|not found|404/i.test(msg)) msg = 'AI 서버 함수가 아직 설치되지 않았어요. 설치 안내서의 "2단계"를 먼저 해 주세요.';
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data || {};
}
function toast(msg, ms = 2600) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
function uuid() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
}
function fmtDT(s) { if (!s) return '-'; const d = new Date(s); return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; }
function dayKey(s) { const d = new Date(s); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function pct(a, b) { return b > 0 ? Math.round(a / b * 100) : null; }
function cfgOf(asg) {
  const s = asg.settings || {};
  return { per_stage: s.per_stage ?? 5, pass_pct: s.pass_pct ?? 80, max_retries: s.max_retries ?? 2, stage_counts: s.stage_counts || {} };
}
function stageCount(asg, stage) { const c = cfgOf(asg); return c.stage_counts[stage] ?? c.per_stage; }

const S = { sb: null, user: null, profile: null };
const app = () => $('#app');

function shell(inner, extraTop = '') {
  const p = S.profile;
  const nm = p ? String(p.name || '') : '';
  const who = nm ? (p.role === 'teacher' && !/원장/.test(nm) ? nm + ' 원장님' : nm) : '';
  app().innerHTML = `
  <header class="topbar noprint">
    <div class="brand"><span class="logo"><svg viewBox="0 0 24 24" width="20" height="20" fill="#fff"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 2.6 5 5.9 5c2 0 3.4 1.1 4.1 2.4C10.700 6.100 12.100 5 14.100 5c3.300 0 5 3.400 3.500 6.800C19.500 16.400 12 21 12 21z" transform="translate(0 -.5)"/></svg></span><div class="bt"><b>스텔라의 심쿵영어</b><small>문법 학습</small></div></div>
    <div class="tright">${extraTop}<span class="who">${esc(who)}</span>
      <button class="btn ghost small" id="btnPw">비밀번호</button>
      <button class="btn ghost small" id="btnOut">로그아웃</button></div>
  </header>
  <div class="wrap" id="main">${inner}</div>`;
  $('#btnOut').onclick = async () => { await S.sb.auth.signOut(); location.reload(); };
  $('#btnPw').onclick = changePw;
}
async function changePw() {
  const pw = prompt('새 비밀번호를 입력하세요 (6자 이상)');
  if (!pw) return;
  if (pw.length < 6) { toast('6자 이상으로 해주세요'); return; }
  const { error } = await S.sb.auth.updateUser({ password: pw });
  toast(error ? '변경하지 못했어요: ' + error.message : '비밀번호를 바꿨어요');
}

/* ---------- 시작 / 로그인 ---------- */
async function boot() {
  const c = window.APP_CONFIG || {};
  if (!c.SUPABASE_URL || c.SUPABASE_URL.includes('YOUR-PROJECT') || !c.SUPABASE_ANON_KEY || c.SUPABASE_ANON_KEY.includes('YOUR-ANON')) {
    app().innerHTML = `<div class="wrap"><div class="card"><h1>아직 서버가 연결되지 않았어요</h1>
      <p>설치 안내서의 3단계(Supabase 주소와 키 넣기)를 먼저 해 주세요. <code>config.js</code> 파일에 값을 넣으면 이 화면 대신 로그인 화면이 나와요.</p></div></div>`;
    return;
  }
  S.sb = window.supabase.createClient(c.SUPABASE_URL, c.SUPABASE_ANON_KEY);
  const { data } = await S.sb.auth.getSession();
  if (data && data.session) return afterLogin(data.session.user);
  loginView();
}
function loginView(msg = '') {
  app().innerHTML = `<div class="wrap" style="max-width:420px;padding-top:8vh">
    <div class="card">
      <h1 style="color:var(--coral-deep)">스텔라의 심쿵영어</h1>
      <p class="muted">문법 학습에 로그인하세요.</p>
      ${msg ? `<div class="result bad">${esc(msg)}</div>` : ''}
      <form id="lf">
        <label for="em">이메일(아이디)</label><input id="em" type="email" autocomplete="username" required>
        <label for="pw">비밀번호</label><input id="pw" type="password" autocomplete="current-password" required>
        <div style="margin-top:14px"><button class="btn" style="width:100%" type="submit">로그인</button></div>
      </form>
      <p class="tiny" style="margin-top:12px">로그인이 안 되면 원장님께 말씀해 주세요.</p>
    </div></div>`;
  $('#lf').onsubmit = async e => {
    e.preventDefault();
    const { data, error } = await S.sb.auth.signInWithPassword({ email: $('#em').value.trim(), password: $('#pw').value });
    if (error) return loginView('이메일 또는 비밀번호가 맞지 않아요.');
    afterLogin(data.user);
  };
}
async function afterLogin(user) {
  S.user = user;
  const { data, error } = await S.sb.from('profiles').select('*').eq('id', user.id).single();
  if (error || !data) { loginView('계정 정보를 불러오지 못했어요. 원장님께 말씀해 주세요.'); return; }
  S.profile = data;
  if (data.role === 'teacher') return teacherStart();
  studentStart();
}

/* ---------- 학생: 데이터 ---------- */
const ST = { asg: [], concepts: [], questions: [], attempts: [], decks: [], videos: [], lecIds: {} };
const NAESIN_RE = /(동아|천재|비상|YBM|와이비엠|능률|지학|미래엔|금성|대교|두산|좋은책|교과서)/;
const isNaesin = a => NAESIN_RE.test((a.units && a.units.school_book) || '');

async function loadStudent() {
  const u = S.user.id;
  const [a, c, q, t] = await Promise.all([
    S.sb.from('assignments').select('*, units(*)').eq('student_id', u).order('created_at'),
    S.sb.from('concepts').select('*').order('ord'),
    S.sb.from('questions').select('id,unit_id,concept_tag,stage,qtype,ord,prompt,ko,choices,hint,points').order('ord'),
    S.sb.from('attempts').select('*').eq('student_id', u).order('submitted_at')
  ]);
  const err = a.error || c.error || q.error || t.error;
  if (err) throw err;
  ST.asg = (a.data || []).filter(x => x.units && x.units.status === 'published');
  // 현재 회차의 풀이만 진행 상황에 사용해요 (지난 회차 기록은 서버에 그대로 보존돼요)
  const cr = Object.fromEntries(ST.asg.map(x => [x.id, x.current_round || 1]));
  ST.concepts = c.data || []; ST.questions = q.data || [];
  ST.allAttempts = t.data || [];
  try { const dk = await S.sb.from('lesson_decks').select('id,deck_key,unit_id,ord,title,paths').order('ord'); ST.decks = dk.error ? [] : (dk.data || []); } catch (e) { ST.decks = []; }
  try { const uv = await S.sb.from('unit_videos').select('id,unit_id,yt_id,title,len_sec,chapters,ord,school_book,lesson,no').order('ord'); ST.videos = uv.error ? [] : (uv.data || []); } catch (e) { ST.videos = []; }
  try { const lv = await S.sb.from('lec_videos').select('id,yt_id'); ST.lecIds = Object.fromEntries(((lv && lv.data) || []).map(x => [x.yt_id, x.id])); } catch (e) { ST.lecIds = {}; }
  ST.attempts = ST.allAttempts.filter(x => (x.round || 1) === (cr[x.assignment_id] || 1));
}
/* ---------- 학습 시간 재기 (화면을 보고 만지는 동안만. 3분 이상 가만히 있거나 다른 화면을 보면 그 시간은 빼요) ---------- */
const AT = { acc: 0, last: 0, on: false, IDLE: 180000, bound: false,
  tick() { const n = Date.now(); if (this.on) { const d = n - this.last; if (d <= this.IDLE) this.acc += d; } this.last = n; },
  start() {
    this.acc = 0; this.last = Date.now(); this.on = !document.hidden;
    if (this.bound) return; this.bound = true;
    const act = () => { if (document.hidden) return; if (!this.on) { this.on = true; this.last = Date.now(); } else this.tick(); };
    ['keydown', 'pointerdown', 'touchstart', 'scroll', 'input'].forEach(ev => window.addEventListener(ev, act, { passive: true }));
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.tick(); this.on = false; } else { this.on = true; this.last = Date.now(); } });
  },
  stop() { this.tick(); return Math.round(this.acc / 1000); }
};
function stageQs(asg, stage) {
  return ST.questions.filter(q => q.unit_id === asg.unit_id && q.stage === stage).sort((a, b) => a.ord - b.ord).slice(0, stageCount(asg, stage));
}
function lastAttempt(qid) {
  let best = null;
  for (const a of ST.attempts) if (a.question_id === qid && (!best || a.attempt_no > best.attempt_no)) best = a;
  return best;
}
function qState(q, asg) {
  const a = lastAttempt(q.id);
  if (!a) return 'todo';
  if (a.status === 'needs_review') return 'waiting';
  if (a.is_correct) return 'correct';
  return a.attempt_no >= 1 + cfgOf(asg).max_retries ? 'failed' : 'retry';
}
function stageSummary(asg, stage) {
  const qs = stageQs(asg, stage);
  let got = 0, max = 0, done = 0, waiting = 0;
  for (const q of qs) {
    const s = qState(q, asg), a = lastAttempt(q.id);
    max += Number(q.points);
    if (s !== 'todo' && s !== 'retry') done++;
    if (s === 'waiting') waiting++;
    if (a && a.status === 'graded') got += Number(a.score || 0);
  }
  const finished = qs.length > 0 && done === qs.length;
  const p = pct(got, max);
  const passed = finished && waiting === 0 && p !== null && p >= cfgOf(asg).pass_pct;
  return { total: qs.length, done, waiting, got, max, pct: p, finished, passed };
}
function stageUnlocked(asg, stage) {
  const i = STAGES.findIndex(s => s[0] === stage);
  for (let j = 0; j < i; j++) {
    const qs = stageQs(asg, STAGES[j][0]);
    if (qs.length && !stageSummary(asg, STAGES[j][0]).finished) return false;
  }
  return true;
}

/* ---------- 학생: 화면 ---------- */
async function studentStart() {
  shell('<p class="muted">불러오는 중…</p>');
  try { await loadStudent(); } catch (e) { return shell(`<div class="result bad">${esc(errText(e))}</div>`); }
  studentHome();
}
function asgCard(a) {
  const stages = STAGES.map(([k]) => stageSummary(a, k)).filter(x => x.total);
  const done = stages.reduce((s, x) => s + x.done, 0), tot = stages.reduce((s, x) => s + x.total, 0);
  return `<div class="card"><div class="row between"><div><h2 style="margin:0">${esc(a.units.title)}${(a.current_round || 1) > 1 ? ` <span class="badge">${a.current_round}회차</span>` : ''}</h2>
    <div class="muted">${esc(a.units.school_book)} ${esc(a.units.lesson)}${a.due_date ? ' · 마감 ' + esc(a.due_date) : ''}</div></div>
    <button class="btn" data-u="${a.id}">${done ? '이어서 하기' : '시작하기'}</button></div>
    <div class="progress" style="margin-top:10px"><i style="width:${pct(done, tot) || 0}%"></i></div>
    <div class="tiny">${done}/${tot} 문제 완료</div></div>`;
}
function bindHome() {
  document.querySelectorAll('[data-u]').forEach(b => b.onclick = () => unitView(b.dataset.u));
  document.querySelectorAll('[data-deck]').forEach(b => b.onclick = () => deckView(b.dataset.deck, 0, b.dataset.back || 'home'));
  bindVid();
  const lo = document.getElementById('libOpen'); if (lo) lo.onclick = () => libView();
}
function studentHome() {
  const nae = ST.asg.filter(isNaesin), gen = ST.asg.filter(a => !isNaesin(a));
  const hub = nae.length ? `<div class="card soft"><div class="row between"><div><h2 style="margin:0">📘 중등 내신</h2><div class="muted">교과서로 시험 준비를 해요.</div></div><button class="btn" id="nh">열기</button></div></div>` : '';
  shell(`<h1>오늘의 공부</h1>${hub}${libCard()}${gen.map(asgCard).join('') || (nae.length ? '' : '<div class="card">아직 배정된 단원이 없어요. 원장님께 물어보세요.</div>')}
    <div class="card"><div class="row between"><div><h3 style="margin:0">오답노트</h3><div class="muted">틀린 문제를 다시 확인해요.</div></div><button class="btn ghost" id="wr">열기</button></div></div>`);
  bindHome();
  if ($('#nh')) $('#nh').onclick = () => naesinHub();
  $('#wr').onclick = () => wrongNote();
}
/* ---------- 중등 내신 5칸 ---------- */
const NKIND = { dialog: ['💬', '대화문', '대화문 단어 · 대화문 학습'], grammar: ['✏️', '문법', '문법 ① · ② 개념 수업'], reading: ['📖', '본문', '본문 단어 · 본문 학습'], mock: ['🎯', '동형모고', '난이도 있는 실전'], hit: ['🔥', '적중모고', '예상문제 풀기'] };
const kindOf = a => { const c = (a.units && a.units.code) || '', m = /-(dialog|reading)(-voca)?$/.exec(c) || /-(mock|hit)$/.exec(c); return m ? m[1] : 'grammar'; };
const SLOT_ORD = ['dialog-voca', 'dialog', 'reading-voca', 'reading', 'grammar1', 'grammar2', 'grammar', 'mock', 'hit', 'exam'];
const slotIdx = a => { const c = (a.units && a.units.code) || '', m = /-(dialog-voca|reading-voca|dialog|reading|grammar1|grammar2|grammar|mock|hit|exam)$/.exec(c); return m ? SLOT_ORD.indexOf(m[1]) : 99; };
function naesinHub() {
  const nae = ST.asg.filter(isNaesin);
  const cell = k => { const n = nae.filter(a => kindOf(a) === k).length, v = NKIND[k]; return `<button class="ncell ${n ? '' : 'off'}" ${n ? `data-nk="${k}"` : 'disabled'}><span class="ni">${v[0]}</span><b>${v[1]}</b><span class="tiny">${n ? `${n}단원 · ${v[2]}` : '준비 중'}</span></button>`; };
  shell(`<p><a href="#" id="back">← 처음으로</a></p><h1>📘 중등 내신</h1>
    <div class="ngrid">${['dialog', 'grammar', 'reading', 'mock', 'hit'].map(cell).join('')}</div>
    <p class="tiny" style="margin-top:12px">준비가 끝나는 칸부터 차례로 열려요.</p>`);
  $('#back').onclick = e => { e.preventDefault(); studentHome(); };
  document.querySelectorAll('[data-nk]').forEach(b => b.onclick = () => naesinKind(b.dataset.nk));
}
function naesinKind(k) {
  const nae = ST.asg.filter(a => isNaesin(a) && kindOf(a) === k).sort((x, y) => (parseInt(x.units && x.units.lesson) || 99) - (parseInt(y.units && y.units.lesson) || 99) || slotIdx(x) - slotIdx(y));
  const cards = nae.map(a => {
    const dk = ST.decks.filter(d => d.unit_id === a.unit_id);
    const slides = dk.length ? `<div class="card soft" style="margin:8px 0 0"><div class="tiny"><b>🎞️ 개념 수업</b> — 선생님 수업 화면으로 먼저 이해해요</div>${dk.map(d => `<button class="btn small ghost" style="margin:6px 6px 0 0" data-deck="${d.id}" data-back="gr">${esc(d.title.replace(/^\d과 /, ''))}</button>`).join('')}</div>` : '';
    return asgCard(a).replace(/<\/div>$/, '') + vidBox(a.unit_id, 'gr', true) + slides + '</div>';
  }).join('');
  const v = NKIND[k];
  shell(`<p><a href="#" id="back">← 내신 5칸</a></p><h1>${v[0]} ${v[1]}</h1>${cards || '<div class="card">배정된 단원이 없어요.</div>'}`);
  $('#back').onclick = e => { e.preventDefault(); naesinHub(); };
  bindHome();
}
const naesinGrammar = () => naesinKind('grammar');
/* ---------- 영상 강의 (유튜브) ---------- */
const fmtLen = s => { s = Math.round(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
const tsec = t => { const p = String(t).split(':').map(Number); return p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + (p[1] || 0); };
(function () { if (document.getElementById('vcard-css')) return; const st = document.createElement('style'); st.id = 'vcard-css'; st.textContent = `
.vgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:12px;margin-top:10px}
.vcard{display:flex;flex-direction:column;border:1px solid #f0e2d8;border-radius:14px;overflow:hidden;background:#fff;text-align:left;padding:0;cursor:pointer;transition:transform .15s, box-shadow .15s;font:inherit;color:inherit;width:100%}
.vcard:hover{transform:translateY(-2px);box-shadow:0 8px 22px rgba(60,39,48,.12)}
.vthumb{position:relative;display:block;width:100%;aspect-ratio:16/9;background:linear-gradient(135deg,#fff3dc,#ffe3e9);overflow:hidden;border:0;padding:0;cursor:pointer}
.vthumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.vthumb .vfb{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;padding:10px;text-align:center;font-weight:800;color:#3c2730;font-size:15px;line-height:1.3}
.vthumb .vplay{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:46px;height:46px;border-radius:50%;background:rgba(0,0,0,.55);color:#fff;display:flex;align-items:center;justify-content:center;font-size:18px;opacity:.9}
.vthumb .vlen{position:absolute;right:6px;bottom:6px;background:rgba(0,0,0,.78);color:#fff;font-size:12px;font-weight:700;padding:2px 6px;border-radius:5px}
.vbody{padding:9px 11px 11px;display:flex;flex-direction:column;gap:6px}
.vbody b{font-size:14px;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
@media (max-width:600px){.vgrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.vbody b{font-size:13px}.vthumb .vplay{width:38px;height:38px;font-size:15px}}
`; document.head.appendChild(st); })();
function vThumb(v) { return `<span class="vfb">${esc(v.title)}</span><img src="https://i.ytimg.com/vi/${esc(v.yt_id)}/mqdefault.jpg" alt="" loading="lazy" onload="if(this.naturalWidth<=120)this.remove()" onerror="this.remove()"><span class="vplay">▶</span>${v.len_sec ? `<span class="vlen">${fmtLen(v.len_sec)}</span>` : ''}`; }
function vCard(v, back, label) { return `<button class="vcard" data-vid="${v.id}" data-back="${esc(back)}"><span class="vthumb">${vThumb(v)}</span><span class="vbody"><b>${esc(label || v.title)}</b></span></button>`; }
function vidBox(unitId, back, compact) {
  const vs = (ST.videos || []).filter(v => v.unit_id === unitId);
  if (!vs.length) return '';
  const btns = `<div class="vgrid">${vs.map(v => vCard(v, back)).join('')}</div>`;
  return compact
    ? `<div class="card soft" style="margin:8px 0 0"><div class="tiny"><b>🎬 영상 강의</b> — 스텔라쌤 영상으로 먼저 개념을 잡아요</div>${btns}</div>`
    : `<div class="card soft"><h3>🎬 영상 강의</h3><p class="muted">스텔라쌤 영상으로 개념을 먼저 잡고, 문제로 확인해요.</p>${btns}</div>`;
}
function myLib() {
  const g = String((S.profile && S.profile.grade) || '').trim(); if (!g) return [];
  const seen = new Set();
  return (ST.videos || []).filter(v => v.school_book && v.school_book.trim().endsWith(g))
    .sort((a, b) => String(a.school_book).localeCompare(String(b.school_book), 'ko') || (a.lesson || 0) - (b.lesson || 0) || (a.no || 0) - (b.no || 0))
    .filter(v => { const k = v.yt_id; if (seen.has(k)) return false; seen.add(k); return true; });
}
function libCard() {
  const vs = myLib(); if (!vs.length) return '';
  const books = [...new Set(vs.map(v => v.school_book))];
  return `<div class="card soft"><div class="row between"><div><h2 style="margin:0">🎬 영상 강의실</h2><div class="muted">${esc(books.join(' · '))} 교과서 문법 영상 ${vs.length}개</div></div><button class="btn" id="libOpen">열기</button></div></div>`;
}
function libView() {
  const vs = myLib();
  const books = [...new Set(vs.map(v => v.school_book))];
  const body = books.map(b => {
    const bv = vs.filter(v => v.school_book === b);
    const ls = [...new Set(bv.map(v => v.lesson))];
    return `<h2 style="margin:18px 0 8px">${esc(b)}</h2>` + ls.map(l => `<div class="card" style="padding:12px 14px;margin-bottom:8px"><b>${l === 99 ? '외부지문' : (l ? (/천일문/.test(b) ? 'Ch.' + l : l + '과') : '기타')}</b><div class="vgrid">${bv.filter(v => v.lesson === l).map(v => vCard(v, 'lib', String(v.title).replace(/^\d+과 /, ''))).join('')}</div></div>`).join('');
  }).join('');
  shell(`<p><a href="#" id="back">← 처음으로</a></p><h1>🎬 영상 강의실</h1><p class="muted">교과서 과별 문법 영상이에요. 개념을 영상으로 먼저 잡고, 배정된 단원 문제로 확인해요.</p>${body || '<div class="card">아직 내 학년 영상이 없어요.</div>'}`);
  $('#back').onclick = e => { e.preventDefault(); studentHome(); };
  bindVid();
}
function bindVid() { document.querySelectorAll('[data-vid]').forEach(b => b.onclick = () => videoView(b.dataset.vid, b.dataset.back || 'home')); }
const VID = { player: null, timer: null, acc: 0, last: null, lecId: null, viewSent: false };
function loadYT() {
  if (window.YT && window.YT.Player) return Promise.resolve();
  return new Promise(res => { const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { if (prev) try { prev(); } catch (e) {} res(); }; if (!document.getElementById('ytapi')) { const s = document.createElement('script'); s.id = 'ytapi'; s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); } });
}
async function vidFlush(done) {
  if (!VID.lecId) return;
  const add = Math.min(60, Math.floor(VID.acc)); VID.acc -= add;
  const pos = VID.player && VID.player.getCurrentTime ? Math.floor(VID.player.getCurrentTime()) : null;
  if (add <= 0 && !done && VID.viewSent) return;
  try { await S.sb.rpc('lec_log', { p_video: VID.lecId, p_add: add, p_pos: pos, p_done: null, p_memo: null, p_view: !VID.viewSent }); VID.viewSent = true; } catch (e) { /* 기록은 실패해도 영상은 계속 봐요 */ }
}
function vidStop() { clearInterval(VID.timer); VID.timer = null; vidFlush(); if (VID.player && VID.player.destroy) { try { VID.player.destroy(); } catch (e) {} } VID.player = null; }
async function videoView(vid, back) {
  const v = (ST.videos || []).find(x => x.id === vid); if (!v) return studentHome();
  vidStop();
  VID.acc = 0; VID.last = null; VID.viewSent = false; VID.lecId = (ST.lecIds || {})[v.yt_id] || null;
  const ch = (v.chapters || []).map(([t, x]) => `<button class="btn small ghost" style="margin:4px 6px 0 0;text-align:left" data-sk="${tsec(t)}"><b style="color:#274c8f">${esc(t)}</b> ${esc(x)}${/퀴즈/.test(x) ? ' ✍️' : ''}</button>`).join('');
  shell(`<p><a href="#" id="back">← 돌아가기</a></p><div class="card" style="padding:10px">
    <b style="font-size:16px">🎬 ${esc(v.title)}</b>
    <div style="position:relative;width:100%;aspect-ratio:16/9;margin-top:10px;border-radius:12px;overflow:hidden;background:#000"><div id="ytbox" style="position:absolute;inset:0"></div></div>
    <p class="tiny" style="margin-top:8px">처음엔 끝까지 쭉 보고, 퀴즈가 나오면 멈추고 먼저 풀어 보세요. 마지막 '한눈에 정리'는 노트에 옮겨 적어요.</p>
    ${ch ? `<h3 style="margin-top:12px">▶ 바로가기</h3><div>${ch}</div>` : ''}
    <p style="margin-top:12px"><a class="btn small ghost" href="https://www.youtube.com/watch?v=${esc(v.yt_id)}" target="_blank" rel="noopener">유튜브 앱에서 보기</a></p></div>`);
  const home = () => { vidStop(); back === 'lib' ? libView() : back === 'gr' ? naesinGrammar() : /^u/.test(back) ? unitView(back.slice(1)) : studentHome(); };
  $('#back').onclick = e => { e.preventDefault(); home(); };
  await loadYT();
  if (!document.getElementById('ytbox')) return;
  VID.player = new YT.Player('ytbox', { width: '100%', height: '100%', videoId: v.yt_id, playerVars: { rel: 0, playsinline: 1, modestbranding: 1 },
    events: { onStateChange: e => { if (e.data === 2 || e.data === 0) vidFlush(e.data === 0); } } });
  document.querySelectorAll('[data-sk]').forEach(b => b.onclick = () => { if (VID.player && VID.player.seekTo) { VID.player.seekTo(+b.dataset.sk, true); VID.player.playVideo(); VID.last = +b.dataset.sk; window.scrollTo({ top: 0, behavior: 'smooth' }); } });
  VID.timer = setInterval(() => {
    if (!document.getElementById('ytbox') && !document.querySelector('iframe[id="ytbox"]')) { vidStop(); return; }
    const p = VID.player; if (!p || !p.getPlayerState) return;
    const st = p.getPlayerState(), pos = p.getCurrentTime ? p.getCurrentTime() : 0;
    if (st === 1) { if (VID.last != null) { const dt = pos - VID.last; if (dt > 0 && dt < 4) VID.acc += dt; } if (!VID.viewSent) vidFlush(); if (VID.acc >= 15) vidFlush(); }
    VID.last = pos;
  }, 1000);
}
document.addEventListener('visibilitychange', () => { if (document.hidden) vidFlush(); });
/* ---------- 개념 수업(슬라이드) 보기 ---------- */
const DECK = { urls: {} };
async function deckView(deckId, i, back) {
  const d = ST.decks.find(x => x.id === deckId); if (!d) return studentHome();
  if (!DECK.urls[deckId]) {
    shell('<p class="muted">수업 화면을 불러오는 중…</p>');
    const r = await S.sb.storage.from('lesson-slides').createSignedUrls(d.paths, 3600);
    if (r.error) { shell(`<div class="result bad">수업 화면을 불러오지 못했어요. 잠시 뒤 다시 해 주세요.</div><p><a href="#" id="back">← 돌아가기</a></p>`); $('#back').onclick = e => { e.preventDefault(); studentHome(); }; return; }
    DECK.urls[deckId] = (r.data || []).map(x => x.signedUrl);
  }
  const urls = DECK.urls[deckId], n = urls.length;
  i = Math.max(0, Math.min(n - 1, i));
  shell(`<p><a href="#" id="back">← 돌아가기</a></p><div class="card" style="padding:10px"><div class="row between"><b style="font-size:15px">${esc(d.title)}</b><span class="tiny">${i + 1} / ${n}</span></div>
    <div class="progress" style="margin:8px 0"><i style="width:${(i + 1) / n * 100}%"></i></div>
    <img src="${esc(urls[i])}" alt="수업 화면 ${i + 1}" style="width:100%;border-radius:10px;border:1px solid #eadfd8;display:block">
    <div class="row between" style="margin-top:12px"><button class="btn ghost" id="dp" ${i === 0 ? 'disabled' : ''}>이전</button>${i < n - 1 ? '<button class="btn" id="dn">다음</button>' : '<button class="btn" id="dd">수업 끝! 돌아가기</button>'}</div>
    <p class="tiny" style="margin-top:8px">← → 키로도 넘길 수 있어요. 소리 내어 읽으면서 보면 더 잘 외워져요.</p></div>`);
  const go = j => deckView(deckId, j, back), home = () => (back === 'gr' ? naesinGrammar() : /^u/.test(back) ? unitView(back.slice(1)) : studentHome());
  $('#back').onclick = e => { e.preventDefault(); home(); };
  $('#dp').onclick = () => go(i - 1);
  if ($('#dn')) $('#dn').onclick = () => go(i + 1);
  if ($('#dd')) $('#dd').onclick = home;
  [i - 1, i + 1].forEach(j => { if (urls[j]) { const im = new Image(); im.src = urls[j]; } });
  window.onkeydown = e => { if (!document.body.contains($('#dp'))) { window.onkeydown = null; return; } if (e.key === 'ArrowRight' && i < n - 1) go(i + 1); if (e.key === 'ArrowLeft' && i > 0) go(i - 1); };
}
function unitView(asgId) {
  const a = ST.asg.find(x => x.id === asgId); if (!a) return studentHome();
  const cs = ST.concepts.filter(c => c.unit_id === a.unit_id);
  const rows = STAGES.map(([k, n]) => {
    const qs = stageQs(a, k); if (!qs.length) return '';
    const sm = stageSummary(a, k), open = stageUnlocked(a, k);
    let badge = '<span class="badge gray">시작 전</span>';
    if (sm.finished) badge = sm.waiting ? '<span class="badge warn">원장님 확인 중</span>' : sm.passed ? `<span class="badge ok">통과 ${sm.pct}%</span>` : `<span class="badge bad">${sm.pct}% · 오답 복습 필요</span>`;
    else if (sm.done) badge = `<span class="badge">진행 중 ${sm.done}/${sm.total}</span>`;
    return `<div class="stage ${open ? '' : 'locked'}"><div><b>${n}</b> <span class="tiny">${qs.length}문제</span><div style="margin-top:4px">${badge}</div></div>
      <button class="btn small ${sm.finished ? 'ghost' : ''}" data-s="${k}" ${open ? '' : 'disabled'}>${open ? (sm.finished ? '다시 보기' : sm.done ? '이어서' : '시작') : '잠김'}</button></div>`;
  }).join('');
  shell(`<p><a href="#" id="back">← 처음으로</a></p><h1>${esc(a.units.title)}${(a.current_round || 1) > 1 ? ` <span class="badge">${a.current_round}회차</span>` : ''}</h1>
    ${vidBox(a.unit_id, 'u' + asgId, false)}${ST.decks.some(d => d.unit_id === a.unit_id) ? `<div class="card soft"><h3>🎞️ 개념 수업</h3><p class="muted">선생님 수업 화면으로 먼저 이해해요.</p>${ST.decks.filter(d => d.unit_id === a.unit_id).map(d => `<button class="btn small ghost" style="margin:4px 6px 0 0" data-deck="${d.id}">${esc(d.title.replace(/^\d과 /, ''))}</button>`).join('')}</div>` : ''}
    <div class="card soft"><h3>① 먼저 개념을 읽어요</h3><p class="muted">개념 화면 ${cs.length}장이에요. 하나씩 천천히 읽고 문제로 넘어가요.</p><button class="btn" id="cv">개념 보기</button></div>
    <div class="card"><h3>② 단계별 문제</h3><div class="stage-list">${rows || '<p class="muted">아직 공개된 문제가 없어요. 원장님 검수 후에 나타나요.</p>'}</div>
    <p class="tiny" style="margin-top:10px">단계마다 ${cfgOf(a).pass_pct}% 이상 맞히면 통과예요. 틀리면 힌트와 해설을 보고 다시 풀 수 있어요.</p></div>`);
  $('#back').onclick = e => { e.preventDefault(); studentHome(); };
  $('#cv').onclick = () => conceptView(asgId, 0);
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => startStage(asgId, b.dataset.s));
  document.querySelectorAll('[data-deck]').forEach(b => b.onclick = () => deckView(b.dataset.deck, 0, 'u' + asgId));
  bindVid();
}
function conceptView(asgId, i) {
  const a = ST.asg.find(x => x.id === asgId);
  const cs = ST.concepts.filter(c => c.unit_id === a.unit_id).sort((x, y) => x.ord - y.ord);
  if (!cs.length) return unitView(asgId);
  i = Math.max(0, Math.min(cs.length - 1, i));
  const c = cs[i], b = c.body || {};
  const steps = (b.steps || []).map(s => `<div class="concept-step">${esc(s)}</div>`).join('');
  const ex = (b.examples || []).map(e => `<div class="ex"><b>${esc(e.en)}</b>${esc(e.ko)}</div>`).join('');
  const cmp = (b.compare || []).map(x => `<div class="cmp"><div class="w">✗ ${esc(x.wrong)}</div><div class="r">✓ ${esc(x.right)}</div></div><p class="muted">${esc(x.note)}</p>`).join('');
  shell(`<p><a href="#" id="back">← 단원으로</a></p>
    <div class="card"><div class="tiny">개념 ${i + 1} / ${cs.length}</div><h2>${esc(c.title)}</h2>
    <p><b>${esc(b.summary || '')}</b></p>${steps}
    ${ex ? '<h3 style="margin-top:14px">예문</h3>' + ex : ''}${cmp ? '<h3 style="margin-top:14px">헷갈리는 부분</h3>' + cmp : ''}
    ${b.tip ? `<div class="tip">💡 ${esc(b.tip)}</div>` : ''}
    <div class="row between" style="margin-top:16px"><button class="btn ghost" id="pv" ${i === 0 ? 'disabled' : ''}>이전</button>
    ${i < cs.length - 1 ? '<button class="btn" id="nx">다음 개념</button>' : '<button class="btn" id="go">문제 풀러 가기</button>'}</div></div>`);
  $('#back').onclick = e => { e.preventDefault(); unitView(asgId); };
  $('#pv').onclick = () => conceptView(asgId, i - 1);
  if ($('#nx')) $('#nx').onclick = () => conceptView(asgId, i + 1);
  if ($('#go')) $('#go').onclick = () => unitView(asgId);
}

/* ---------- 학생: 문제 풀이 ---------- */
let P = null;
function startStage(asgId, stage) {
  const a = ST.asg.find(x => x.id === asgId);
  const qs = stageQs(a, stage);
  let idx = qs.findIndex(q => ['todo', 'retry'].includes(qState(q, a)));
  P = { asgId, stage, qs, idx: idx < 0 ? 0 : idx, sel: '', hintShown: false, hintUsed: false, result: null, expl: null, cid: null, busy: false, review: idx < 0 };
  renderQ();
}
function renderQ() {
  const a = ST.asg.find(x => x.id === P.asgId), q = P.qs[P.idx];
  const cfg = cfgOf(a), last = lastAttempt(q.id);
  const st = qState(q, a);
  const tries = last ? last.attempt_no : 0;
  const left = Math.max(0, 1 + cfg.max_retries - tries);
  if (P.tKey !== q.id + '|' + tries) { P.tKey = q.id + '|' + tries; AT.start(); }
  let body = `<div class="q-prompt">${esc(q.prompt)}</div>${q.ko ? `<div class="q-ko">${esc(q.ko)}</div>` : ''}`;
  const locked = P.result || P.review || st === 'correct' || st === 'waiting' || st === 'failed';
  if (q.qtype === 'mc') {
    body += (q.choices || []).map(c => `<button class="choice ${P.sel === c ? 'sel' : ''}" data-c="${esc(c)}" ${locked ? 'disabled' : ''}>${esc(c)}</button>`).join('');
  } else {
    body += `<input type="text" id="ans" value="${esc(P.sel)}" placeholder="${q.qtype === 'write' ? '영어 문장을 써 보세요' : '정답을 입력하세요'}" autocomplete="off" autocapitalize="off" spellcheck="false" ${locked ? 'disabled' : ''}>`;
  }
  if (P.hintShown && q.hint) body += `<div class="hintbox">💡 힌트: ${esc(q.hint)}</div>`;
  if (P.result) body += resultBox(P.result);
  if (P.expl) body += explBox(P.expl);
  if (P.review && !P.result) {
    body += last ? `<div class="result ${last.status === 'needs_review' ? 'warn' : last.is_correct ? 'ok' : 'bad'}">내 답: ${esc(last.answer)}<br>${esc(last.feedback || '')}${appealBtn(last)}</div>` : '';
  }
  // 틀린 답안이면 AI 도우미 자리 (AI가 꺼져 있으면 아무것도 보이지 않아요)
  const wrongRec = P.result ? (P.result.status === 'graded' && !P.result.is_correct ? P.result : null)
    : (P.review && last && last.status === 'graded' && !last.is_correct ? last : null);
  const aiOk = q.qtype !== 'mc';     // 객관식은 기존 방식(정답·해설)만, AI는 서술형·단답형에만
  if (wrongRec && aiOk) body += '<div id="aibox"></div>';
  const pendRec = P.result ? (P.result.status === 'needs_review' ? P.result : null)
    : (P.review && last && last.status === 'needs_review' ? last : null);
  if (pendRec) body += '<div id="aiprov"></div>';
  body += `<div class="row" style="margin-top:12px">${actions(q, st, left)}</div>`;
  shell(`<p><a href="#" id="back">← 단원으로</a></p><div class="card">
    <div class="row between"><b>${esc(a.units.title)} · ${STAGE_NAME[P.stage]}</b><span class="tiny">${P.idx + 1} / ${P.qs.length}</span></div>
    <div class="progress" style="margin:8px 0 14px"><i style="width:${(P.idx + (P.result ? 1 : 0)) / P.qs.length * 100}%"></i></div>
    ${body}</div>`);
  $('#back').onclick = e => { e.preventDefault(); unitView(P.asgId); };
  document.querySelectorAll('.choice').forEach(b => b.onclick = () => { P.sel = b.dataset.c; renderQ(); });
  const inp = $('#ans');
  if (inp) { inp.oninput = () => { P.sel = inp.value; }; inp.onkeydown = e => { if (e.key === 'Enter') doSubmit(); }; if (!locked) inp.focus(); }
  bindActions();
  if (wrongRec && aiOk) aiInit($('#aibox'), wrongRec.id);
  if (pendRec) aiProvInit($('#aiprov'), pendRec.id);
}

/* ---------- 학생: AI 임시 채점 (원장님 확인 전 임시 결과) ---------- */
function aiProvCard(r) {
  const sc = r.score == null ? '' : `<p><b>AI 임시 점수: ${esc(r.score)}점</b> <span class="tiny">(확정 아님)</span></p>`;
  return `<div class="aibox"><div class="tiny"><b>🤖 AI 임시 채점</b> <span class="badge warn">${r.demo ? '시연용' : '임시'}</span> 원장님이 최종 확인해요</div>
    ${sc}<p>${esc(r.feedback)}</p>
    <div class="tiny">이 결과는 임시예요. 원장님이 확인하면 최종 점수가 정해지고, 그때까지 정식 기록에는 들어가지 않아요.</div></div>`;
}
// 채점 대기 답안에 AI 임시 결과를 붙여 줘요. AI가 꺼져 있거나 실패해도 답안은 그대로 저장돼 있고 원장님이 확인해요.
function appealBtn(r) {
  if (!r || r.graded_by !== 'ai' || r.appeal_at || r.status !== 'graded') return '';
  return `<div style="margin-top:8px"><button class="btn small ghost" data-ap="${esc(r.id)}">채점이 이상해요 (원장님께 다시 확인 부탁)</button></div>`;
}
function bindAppeal() {
  document.querySelectorAll('[data-ap]').forEach(b => b.onclick = async () => {
    b.disabled = true;
    try {
      const { error } = await S.sb.rpc('appeal_attempt', { p_attempt: b.dataset.ap, p_note: '' });
      if (error) throw error;
      const now = new Date().toISOString();
      [ST.attempts, ST.allAttempts].forEach(arr => arr.forEach(x => { if (x.id === b.dataset.ap) Object.assign(x, { status: 'needs_review', appeal_at: now, graded_by: 'auto' }); }));
      if (P && P.result && P.result.id === b.dataset.ap) P.result = { ...P.result, status: 'needs_review', appeal_at: now, graded_by: 'auto' };
      toast('원장님께 전달했어요');
      renderQ();
    } catch (e) { b.disabled = false; toast(errText(e), 4000); }
  });
}
// AI가 확정한 채점 결과를 화면·기록에 반영해요
async function applyFinal(attId, res) {
  const patch = { status: 'graded', graded_by: 'ai', score: res.score, max_score: res.max_score, is_correct: !!res.is_correct, feedback: res.feedback || '', error_types: res.error_types || [] };
  [ST.attempts, ST.allAttempts].forEach(arr => arr.forEach(x => { if (x.id === attId) Object.assign(x, patch); }));
  if (!P || !P.result || P.result.id !== attId || !P.qs) return;
  P.result = { ...P.result, ...patch };
  const q = P.qs[P.idx], a = ST.asg.find(x => x.id === P.asgId);
  if (q && a && !patch.is_correct && 1 + cfgOf(a).max_retries - P.result.attempt_no <= 0) { try { P.expl = await getExpl(q); } catch (e) { /* 해설은 버튼으로도 볼 수 있어요 */ } }
  renderQ();
}
// 채점 대기 답안: AI가 바로 최종 채점해요(설정이 켜져 있을 때). 꺼져 있으면 예전처럼 AI 임시 결과 + 원장님 확인이에요.
async function aiProvInit(box, attId) {
  if (!box || !attId) return;
  try {
    const own = await S.sb.from('attempts').select('ai_score,ai_feedback,ai_errors,ai_demo,ai_at,appeal_at').eq('id', attId).maybeSingle();
    if (own.error || !document.body.contains(box)) return;       // schema3 설치 전이면 조용히 건너뛰어요
    const d = own.data;
    if (d && d.appeal_at) { box.innerHTML = '<div class="tiny">이의제기를 원장님께 전달했어요. 확인이 끝나면 결과가 바뀌어요.</div>'; return; }
    if (d && d.ai_at) { box.innerHTML = aiProvCard({ score: d.ai_score, feedback: d.ai_feedback, demo: d.ai_demo }); return; }
    box.innerHTML = '<div class="tiny">🤖 AI 선생님이 채점하는 중이에요… (몇 초 걸려요)</div>';
    let g = null;
    try { g = await invokeFn('ai-grade', { attempt_id: attId }); } catch (e) { g = null; }
    if (g && g.ok && g.final) { await applyFinal(attId, g.result); return; }
    if (g && g.ok === false && g.code && g.code !== 'manual') { if (document.body.contains(box)) box.innerHTML = `<div class="tiny">${esc(g.message || '원장님이 확인해 줄 거예요.')}</div>`; return; }
    const { data: qt, error } = await S.sb.rpc('ai_quota');
    if (error || !qt || !qt.enabled || !document.body.contains(box)) { if (document.body.contains(box)) box.innerHTML = ''; return; }
    const r = await invokeFn('ai-feedback', { action: 'provisional', attempt_id: attId });
    if (!document.body.contains(box)) return;
    box.innerHTML = r.ok ? aiProvCard(r.result) : `<div class="tiny">${esc(r.message || '')}</div>`;
  } catch (e) { if (document.body.contains(box)) box.innerHTML = '<div class="tiny">AI 채점을 받지 못했어요. 답안은 저장됐고 원장님이 확인해 줄 거예요.</div>'; }
}

/* ---------- 학생: AI 도우미 (틀린 이유 설명) ---------- */
function aiCard(c, demo) {
  return `<div class="aibox"><div class="tiny"><b>🤖 AI 도우미</b>${demo ? ' <span class="badge warn">시연용</span> 실제 AI가 연결되기 전이라 예시 문구예요' : ''}</div>
    <p>${esc(c.diagnosis)}</p>${c.tip ? `<p><b>다음엔</b> ${esc(c.tip)}</p>` : ''}
    <div class="tiny">AI 설명은 참고용이에요. 헷갈리면 선생님께 물어보세요.</div></div>`;
}
// known: 이미 받아 둔 설명(없으면 서버에서 확인). AI가 꺼져 있거나 2단계가 설치 전이면 조용히 아무것도 보여 주지 않아요.
async function aiInit(box, attId, known) {
  if (!box || !attId) return;
  try {
    let fb = known;
    if (fb === undefined) {
      const r = await S.sb.from('ai_feedback').select('content,demo').eq('attempt_id', attId).eq('kind', 'student_help').maybeSingle();
      fb = r.error ? null : r.data;
    }
    if (!document.body.contains(box)) return;
    if (fb) { box.innerHTML = aiCard(fb.content, fb.demo); return; }
    const { data: qt, error } = await S.sb.rpc('ai_quota');
    if (error || !qt || !qt.enabled || !document.body.contains(box)) return;
    if (!(qt.left > 0)) { box.innerHTML = '<div class="tiny">오늘 AI 도우미 횟수를 모두 썼어요. 해설 보기는 계속 쓸 수 있어요.</div>'; return; }
    box.innerHTML = `<button class="btn ghost small" data-ai>🤖 AI에게 왜 틀렸는지 물어보기 (오늘 ${qt.left}번 남음)</button>
      <div class="tiny">AI에게는 문제와 내 답만 보내요. 이름이나 개인정보는 쓰지 마세요.</div>`;
    const btn = box.querySelector('[data-ai]');
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'AI가 살펴보는 중…';
      try {
        const r = await invokeFn('ai-feedback', { action: 'help', attempt_id: attId });
        if (!document.body.contains(box)) return;
        box.innerHTML = r.ok ? aiCard(r.feedback, r.demo) : `<div class="tiny">${esc(r.message || 'AI 설명을 받지 못했어요.')}</div>`;
      } catch (e) {
        if (document.body.contains(box)) box.innerHTML = `<div class="tiny">${esc(errText(e))} 답안은 그대로 저장돼 있어요.</div>`;
      }
    };
  } catch (e) { /* AI 기능이 없어도 문제 풀이에는 영향이 없어요 */ }
}
function actions(q, st, left) {
  const out = [];
  const canAnswer = !P.result && !P.review && (st === 'todo' || st === 'retry');
  if (canAnswer) {
    out.push('<button class="btn" id="bSub">제출</button>');
    if (q.hint && !P.hintShown) out.push('<button class="btn ghost" id="bHint">힌트 보기</button>');
  }
  if (P.result && !P.result.is_correct && P.result.status !== 'needs_review') {
    if (left > 0) out.push(`<button class="btn" id="bRetry">다시 풀기 (${left}번 남음)</button>`);
    if (q.hint && !P.hintShown) out.push('<button class="btn ghost" id="bHint2">힌트 보기</button>');
  }
  if (P.result && !P.expl) out.push('<button class="btn ghost" id="bExp">해설 보기</button>');
  if (P.review && !P.expl && lastAttempt(q.id)) out.push('<button class="btn ghost" id="bExp">해설 보기</button>');
  if (P.review && (st === 'retry') && left > 0) out.push(`<button class="btn" id="bRetry2">다시 풀기 (${left}번 남음)</button>`);
  const hasNext = P.idx < P.qs.length - 1;
  if (P.result || P.review) out.push(`<button class="btn ${P.result && !P.result.is_correct && left > 0 ? 'ghost' : ''}" id="bNext">${hasNext ? '다음 문제' : '이 단계 마치기'}</button>`);
  else if (st === 'correct' || st === 'waiting' || st === 'failed') out.push(`<button class="btn" id="bNext">${hasNext ? '다음 문제' : '이 단계 마치기'}</button>`);
  return out.join('');
}
function bindActions() {
  const q = P.qs[P.idx];
  const on = (id, f) => { const el = $('#' + id); if (el) el.onclick = f; };
  on('bSub', doSubmit);
  const hint = () => { P.hintShown = true; P.hintUsed = true; renderQ(); };
  on('bHint', hint); on('bHint2', hint);
  const retry = () => { P.result = null; P.expl = null; P.sel = ''; P.review = false; renderQ(); };
  on('bRetry', retry); on('bRetry2', retry);
  on('bExp', async () => {
    try { P.expl = await getExpl(q); P.hintUsed = P.hintUsed; renderQ(); } catch (e) { toast(errText(e)); }
  });
  on('bNext', nextQ);
  bindAppeal();
}
async function getExpl(q) {
  const { data, error } = await S.sb.rpc('get_explanation', { p_assignment: P.asgId, p_question: q.id });
  if (error) throw error;
  // 서버가 해설 열람을 기록했으므로 화면 쪽 기록도 갱신
  const a = lastAttempt(q.id); if (a) a.explanation_viewed = true;
  return data;
}
function resultBox(r) {
  if (r.status === 'needs_review') return `<div class="result warn"><b>${r.appeal_at ? '원장님이 다시 확인하는 중' : '채점 중'}</b><br>${esc(r.appeal_at ? '이의제기를 전달했어요. 확인이 끝나면 결과가 바뀌어요.' : (r.feedback || '답안을 저장했어요.'))}</div>`;
  const ai = r.graded_by === 'ai' ? ' <span class="tiny">🤖 AI 채점</span>' : '';
  if (r.is_correct) return `<div class="result ok"><b>정답이에요! 👏</b> (${r.score}/${r.max_score}점)${ai}<br>${esc(r.feedback || '')}${appealBtn(r)}</div>`;
  const part = r.score > 0 ? ` (${r.score}/${r.max_score}점)` : '';
  return `<div class="result bad"><b>아쉬워요</b>${part}${ai}<br>${esc(r.feedback || '')}${appealBtn(r)}</div>`;
}
function explBox(e) {
  const wn = e.wrong_notes && P.sel && e.wrong_notes[P.sel] ? `<p><b>내가 고른 답이 아닌 이유</b><br>${esc(e.wrong_notes[P.sel])}</p>` : '';
  return `<div class="explain"><b>정답: ${esc(e.correct_answer)}</b>${(e.all_answers || []).length > 1 ? `<div class="tiny">다른 정답: ${(e.all_answers || []).slice(1).map(esc).join(' / ')}</div>` : ''}
    <p style="margin-top:6px">${esc(e.explanation)}</p>${wn}</div>`;
}
async function doSubmit() {
  if (P.busy) return;
  const a = ST.asg.find(x => x.id === P.asgId), q = P.qs[P.idx];
  const ans = (P.sel || '').trim();
  if (!ans) return toast('답을 먼저 적어 주세요');
  P.busy = true; const btn = $('#bSub'); if (btn) { btn.disabled = true; btn.textContent = '저장 중…'; }
  if (!P.cid) P.cid = uuid();      // 네트워크가 끊겨 다시 눌러도 같은 번호라 중복 저장되지 않아요
  try {
    const { data, error } = await S.sb.rpc('submit_answer', { p_client_id: P.cid, p_assignment: a.id, p_question: q.id, p_answer: ans, p_hint: P.hintUsed, p_time_sec: AT.stop() });
    if (error) throw error;
    const rec = { ...data, question_id: q.id, answer: ans, assignment_id: a.id, stage: q.stage, explanation_viewed: false, round: a.current_round || 1 };
    ST.attempts = ST.attempts.filter(x => x.id !== rec.id).concat(rec);
    P.result = data; P.cid = null; P.hintUsed = false; P.expl = null; P.busy = false;
    const left = 1 + cfgOf(a).max_retries - data.attempt_no;
    renderQ();
    if (!data.is_correct && data.status !== 'needs_review' && left <= 0) {
      try { P.expl = await getExpl(q); renderQ(); } catch (e) { /* 해설은 버튼으로도 볼 수 있어요 */ }
    }
  } catch (e) {
    P.busy = false;
    if (btn) { btn.disabled = false; btn.textContent = '제출'; }
    const m = (e && e.message) || '';
    if (/retry_limit|waiting_teacher|already_correct/.test(m)) { await loadStudent().catch(() => { }); }
    toast(errText(e), 4200);
  }
}
function nextQ() {
  const a = ST.asg.find(x => x.id === P.asgId);
  const reset = () => { P.sel = ''; P.hintShown = false; P.hintUsed = false; P.result = null; P.expl = null; P.cid = null; };
  for (let j = P.idx + 1; j < P.qs.length; j++) {
    if (P.review || ['todo', 'retry'].includes(qState(P.qs[j], a))) { P.idx = j; reset(); return renderQ(); }
  }
  // 이 단계에서 아직 안 푼 문제가 앞쪽에 남았는지 확인
  const k = P.review ? -1 : P.qs.findIndex(q => ['todo', 'retry'].includes(qState(q, a)));
  if (k >= 0) { P.idx = k; reset(); return renderQ(); }
  stageDone();
}
function stageDone() {
  const a = ST.asg.find(x => x.id === P.asgId), sm = stageSummary(a, P.stage);
  let msg;
  if (sm.waiting) msg = `<div class="result warn"><b>원장님 확인을 기다리는 문제가 ${sm.waiting}개 있어요.</b><br>확인이 끝나면 결과가 바뀔 수 있어요. 다음 단계는 열려 있어요.</div>`;
  else if (sm.passed) msg = `<div class="result ok"><b>통과했어요! 🎉</b> ${sm.pct}% (기준 ${cfgOf(a).pass_pct}%)</div>`;
  else msg = `<div class="result bad"><b>${sm.pct}%예요. 기준(${cfgOf(a).pass_pct}%)에 조금 모자라요.</b><br>오답노트에서 해설을 다시 읽어 보세요. 원장님께도 알려져요.</div>`;
  shell(`<div class="card"><h2>${STAGE_NAME[P.stage]} 끝!</h2>${msg}
    <div class="row"><button class="btn" id="u">단원으로</button><button class="btn ghost" id="w">오답노트 보기</button></div></div>`);
  $('#u').onclick = () => unitView(P.asgId);
  $('#w').onclick = () => wrongNote(P.asgId);
}

/* ---------- 학생: 오답노트 ---------- */
function wrongNote(asgId) {
  const items = [];
  for (const a of ST.asg) {
    if (asgId && a.id !== asgId) continue;
    for (const [k] of STAGES) for (const q of stageQs(a, k)) {
      const l = lastAttempt(q.id);
      if (l && l.status === 'graded' && !l.is_correct) items.push({ a, q, l });
    }
  }
  shell(`<p><a href="#" id="back">← 돌아가기</a></p><h1>오답노트</h1>
    ${items.length ? items.map((x, i) => `<div class="card"><div class="tiny">${esc(x.a.units.title)} · ${STAGE_NAME[x.q.stage]} · ${esc(x.q.concept_tag)}</div>
      <div class="q-prompt">${esc(x.q.prompt)}</div>${x.q.ko ? `<div class="q-ko">${esc(x.q.ko)}</div>` : ''}
      <p>내 답: <b>${esc(x.l.answer)}</b></p><p class="muted">${esc(x.l.feedback || '')}</p>
      <div id="ex${i}"></div><div id="ai${i}"></div><button class="btn ghost small" data-i="${i}">해설 보기</button></div>`).join('') : '<div class="card">틀린 문제가 없어요. 잘했어요! 👏</div>'}`);
  $('#back').onclick = e => { e.preventDefault(); asgId ? unitView(asgId) : studentHome(); };
  if (items.length) {
    // 이미 받은 AI 설명을 한 번에 읽어 와서 각 카드에 붙여요 (AI가 꺼져 있으면 아무것도 안 보여요)
    S.sb.from('ai_feedback').select('attempt_id,content,demo').eq('kind', 'student_help').then(r => {
      const m = new Map((r && r.data || []).map(f => [f.attempt_id, f]));
      items.forEach((x, i) => { if (x.q.qtype !== 'mc') aiInit($('#ai' + i), x.l.id, m.get(x.l.id) || null); });
    }, () => { });
  }
  document.querySelectorAll('[data-i]').forEach(b => b.onclick = async () => {
    const x = items[+b.dataset.i];
    try {
      const { data, error } = await S.sb.rpc('get_explanation', { p_assignment: x.a.id, p_question: x.q.id });
      if (error) throw error;
      x.l.explanation_viewed = true;
      P = { sel: x.l.answer }; $('#ex' + b.dataset.i).innerHTML = explBox(data); b.remove();
    } catch (e) { toast(errText(e)); }
  });
}

window.addEventListener('DOMContentLoaded', boot);
