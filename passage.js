/* 심쿵영어 중등 내신대비 · 본문 학습 (문장 성분 · 1~5형식 표시) - 학생 화면
   단계: 듣고 읽기 → 성분 찾기 → 형식 고르기 → 순서 배열 → 빈칸 → 영작 → (바꿔 쓰기)
   수준: 기초(basic) · 기본(normal) · 심화(adv) */
'use strict';

const P_STEPS = [
  ['read', '듣고 읽기', '성분 색을 켜고 끄며 본문을 읽어요', '📖'],
  ['role', '성분 찾기', '덩어리마다 S·V·O·C·M을 붙여요', '🏷️'],
  ['pattern', '형식 고르기', '이 문장은 몇 형식일까요?', '🔍'],
  ['order', '순서 배열', '해석을 보고 문장을 맞춰요', '🧩'],
  ['blank', '빈칸 채우기', '핵심 자리를 정확히 써요', '✏️'],
  ['write', '영작', '우리말을 보고 문장을 써요', '📝'],
  ['convert', '바꿔 쓰기', '4형식→3형식처럼 바꿔 써요', '🔁']
];
const P_STEP_NAME = Object.fromEntries(P_STEPS.map(s => [s[0], s[1]]));
const P_TRACK = { basic: '🌱 기초', normal: '🌿 기본', adv: '🌳 심화' };
const P_ROLE_NAME = { S: '주어', V: '동사', O: '목적어', IO: '간접목적어', DO: '직접목적어', C: '보어', OC: '목적격보어', M: '수식어', X: '기타', '-': '나머지' };
const P_ROLE_LABEL = { S: 'S', V: 'V', O: 'O', IO: 'I.O', DO: 'D.O', C: 'C', OC: 'O.C', M: 'M', X: '·', '-': '·' };
const P_FORMULA = { 1: 'S + V', 2: 'S + V + C', 3: 'S + V + O', 4: 'S + V + I.O + D.O', 5: 'S + V + O + O.C' };
const P_PALETTE = { basic: ['S', 'V', '-'], normal: ['S', 'V', 'O', 'C', 'M'], adv: ['S', 'V', 'O', 'IO', 'DO', 'C', 'OC', 'M'] };
const PS = { ok: false, asg: [], passages: [], sents: [], prog: [], srs: [] };

function pRoleFor(r, track) {
  if (track === 'basic') return r === 'S' || r === 'V' ? r : '-';
  if (track === 'normal') return r === 'IO' || r === 'DO' ? 'O' : r === 'OC' ? 'C' : (r === 'M' || r === 'X') ? 'M' : r;
  return r === 'X' ? 'M' : r;
}
function pChunkHtml(chunks, opt = {}) {
  // opt: {track, show (색 보이기), roles (학생이 붙인 이름표), result (정답 비교), ko}
  return `<div class="pchunks">${chunks.map((c, i) => {
    const r = opt.track ? pRoleFor(c.r, opt.track) : c.r;
    const mine = opt.roles ? opt.roles[i] : null;
    const shown = opt.show ? r : mine;
    const cls = shown && P_ROLE_LABEL[shown] && shown !== '-' ? 'r-' + shown : '';
    const bad = opt.result && mine != null && pRoleFor(mine, opt.track) !== r ? 'bad' : '';
    return `<span class="pc ${cls} ${bad} ${opt.pick != null && opt.pick === i ? 'pick' : ''} ${c.r === 'M' && opt.show ? 'm' : ''}" data-ci="${i}"><b class="pt">${shown ? esc(P_ROLE_LABEL[shown] || shown) : '?'}</b><span class="tx">${esc(c.t)}</span>${opt.ko && c.ko ? `<small>${esc(c.ko)}</small>` : ''}</span>`;
  }).join('')}</div>`;
}

/* ---------- 데이터 ---------- */
async function loadPassage() {
  const u = S.user.id, sb = S.sb;
  try {
    const a = await sb.from('passage_assignments').select('*').eq('student_id', u).order('created_at');
    if (a.error) { PS.ok = false; return; }
    PS.ok = true; PS.asg = a.data || [];
    if (!PS.asg.length) return;
    const [p, s, pr, sr, ms] = await Promise.all([
      sb.from('passages').select('*'),
      vFetchAll(() => sb.from('passage_sentences').select('*').order('passage_id').order('ord').order('id')),
      vFetchAll(() => sb.from('passage_progress').select('*').eq('student_id', u).order('passage_id').order('step')),
      vFetchAll(() => sb.from('passage_srs').select('*').eq('student_id', u).order('sentence_id')),
      sb.rpc('passage_my_steps')
    ]);
    if (p.error) throw p.error;
    PS.passages = p.data || []; PS.sents = s; PS.prog = pr; PS.srs = sr; PS.steps = ms.error ? {} : (ms.data || {});
    PS.asg = PS.asg.filter(x => PS.passages.some(y => y.id === x.passage_id));
  } catch (e) { PS.ok = false; PS.err = e; }
}
const pPas = id => PS.passages.find(p => p.id === id);
const pAsg = pid => PS.asg.find(a => a.passage_id === pid);
const pTrack = pid => (pAsg(pid) || {}).track || 'normal';
const pProg = (pid, step) => PS.prog.find(x => x.passage_id === pid && x.step === step);
function pSents(pid, step) {
  const tr = pTrack(pid);
  let list = PS.sents.filter(s => s.passage_id === pid).sort((a, b) => a.ord - b.ord);
  if (tr === 'basic') { const k = list.filter(s => s.key); if (k.length) list = k; }
  if (step === 'pattern') list = list.filter(s => s.pattern >= 1 && s.pattern <= (tr === 'basic' ? 3 : 5) && (s.chunks || []).length > 0);
  if (step === 'role') list = list.filter(s => (s.chunks || []).length > 0);
  if (step === 'blank') list = list.filter(s => (s.blanks || []).length);
  if (step === 'convert') list = tr === 'basic' ? [] : list.filter(s => s.alt);
  return list;
}
function pStepsFor(pid) {
  const tr = pTrack(pid), srv = PS.steps && PS.steps[pid];
  if (Array.isArray(srv) && srv.length) return P_STEPS.filter(([k]) => srv.some(x => x.step === k));
  return P_STEPS.filter(([k]) => {
    if (k === 'read') return true;
    if (k === 'convert' && tr === 'basic') return false;
    return pSents(pid, k).length > 0;
  });
}
function pStepOpen(pid, step) {
  const st = pStepsFor(pid), i = st.findIndex(s => s[0] === step);
  return i <= 0 || !!pProg(pid, st[i - 1][0]);
}
function pDue() {
  const t = kstToday(), ids = new Set(PS.sents.map(s => s.id));
  return PS.srs.filter(r => r.due_on <= t && ids.has(r.sentence_id)).sort((a, b) => a.due_on.localeCompare(b.due_on) || a.box - b.box);
}

/* ---------- 학생 홈 카드 ---------- */
function passageHomeCard() {
  if (!PS.ok || !PS.asg.length) return '';
  const due = pDue().length;
  const next = PS.asg.map(a => ({ a, st: pStepsFor(a.passage_id).find(([k]) => !pProg(a.passage_id, k)) })).find(x => x.st);
  return `<div class="card vhome phome" id="pgo" role="button" tabindex="0">
    <div class="vh-l"><div class="vh-ic pic">📘</div><div><h2 style="margin:0">중등 내신대비 · 본문</h2>
      <div class="muted">${due ? `문장 복습 <b class="vred">${due}개</b> · ` : ''}${next ? `다음: ${esc(pPas(next.a.passage_id).title)} · ${P_STEP_NAME[next.st[0]]}` : '배정된 본문을 모두 끝냈어요 🎉'}</div></div></div>
    <div class="vh-r"><button class="btn">${due ? '복습부터' : '공부하기'}</button></div></div>`;
}
function bindPassageHome() { const el = $('#pgo'); if (el) el.onclick = () => passageHome(); }

function passageHome() {
  const due = pDue();
  const cards = PS.asg.map(a => {
    const p = pPas(a.passage_id), st = pStepsFor(p.id), done = st.filter(([k]) => pProg(p.id, k)).length;
    const nx = st.find(([k]) => !pProg(p.id, k));
    return `<div class="card"><div class="row between"><div><h2 style="margin:0">${esc(p.title)}</h2>
      <div class="muted">${esc([p.school_grade, p.publisher, p.lesson].filter(Boolean).join(' · '))} · ${P_TRACK[a.track] || ''}</div></div>
      <button class="btn" data-pas="${p.id}">${nx ? (done ? '이어서' : '시작') : '다시 보기'}</button></div>
      <div class="progress" style="margin:10px 0"><i style="width:${pct(done, st.length) || 0}%"></i></div>
      <div class="pstepchips">${st.map(([k, n, , ic]) => `<span class="${pProg(p.id, k) ? 'ok' : ''}">${ic} ${n}</span>`).join('')}</div></div>`;
  }).join('');
  shell(`<p><a href="#" id="back">← 처음으로</a></p><h1>중등 내신대비 · 본문</h1>
    <div class="card vgoal"><div class="row between"><div><h3 style="margin:0">🔁 문장 복습</h3><div class="muted">${due.length ? `오늘 다시 볼 문장 <b class="vred">${due.length}개</b>` : '오늘 복습할 문장이 없어요'}</div></div>
      ${due.length ? '<button class="btn" id="rev">복습 시작</button>' : ''}</div></div>
    <div class="card"><div class="row between"><div><h3 style="margin:0">🎯 형식 집중 연습</h3><div class="muted">배정된 본문 문장으로 형식을 골라 연습해요</div></div></div>
      <div class="row" style="margin-top:8px">${[1, 2, 3, 4, 5].map(n => `<button class="btn ghost small" data-drill="${n}">${n}형식</button>`).join('')}<button class="btn ghost small" data-drill="0">골고루</button></div></div>
    ${cards}
    <p class="tiny"><button class="linkbtn" id="cc">문장 성분 · 형식 개념 다시 보기</button></p>`);
  $('#back').onclick = e => { e.preventDefault(); studentHome(); };
  if ($('#rev')) $('#rev').onclick = () => pReview();
  $('#cc').onclick = () => pConcepts(null, 0);
  document.querySelectorAll('[data-pas]').forEach(b => b.onclick = () => passageView(b.dataset.pas));
  document.querySelectorAll('[data-drill]').forEach(b => b.onclick = () => pDrill(+b.dataset.drill));
}
function passageView(pid) {
  const p = pPas(pid); if (!p) return passageHome();
  const st = pStepsFor(pid);
  const rows = st.map(([k, n, d, ic]) => {
    const pr = pProg(pid, k), open = pStepOpen(pid, k);
    return `<div class="vstep ${open ? '' : 'locked'} ${pr ? 'done' : ''}"><div class="vs-ic">${ic}</div><div class="vs-t"><b>${n}</b><div class="tiny">${d}</div>${pr ? `<span class="badge ok">✓${pr.total ? ` ${pr.score}/${pr.total}` : ''}</span>` : ''}</div>
      <button class="btn small ${pr ? 'ghost' : ''}" data-pst="${k}" ${open ? '' : 'disabled'}>${open ? (pr ? '다시' : '시작') : '🔒'}</button></div>`;
  }).join('');
  shell(`<p><a href="#" id="back">← 본문 목록</a></p><h1>${esc(p.title)}</h1>
    <div class="muted" style="margin-bottom:10px">${esc([p.school_grade, p.publisher, p.lesson].filter(Boolean).join(' · '))} · ${P_TRACK[pTrack(pid)]}</div>
    <div class="card soft"><div class="row between"><div><b>먼저 형식 개념을 확인해요</b><div class="tiny">이 본문에 나온 문장으로 S·V·O·C·M과 1~5형식을 봐요</div></div><button class="btn small" id="cc">개념 보기</button></div></div>
    <div class="card"><div class="vsteps">${rows}</div></div>`);
  $('#back').onclick = e => { e.preventDefault(); passageHome(); };
  $('#cc').onclick = () => pConcepts(pid, 0);
  document.querySelectorAll('[data-pst]').forEach(b => b.onclick = () => pStart(pid, b.dataset.pst));
}

/* ---------- 형식 개념 카드 (이 본문 문장을 예문으로) ---------- */
const P_CONCEPTS = [
  { t: '문장 성분 기호', f: 'S · V · O · C · M', d: ['S 주어: ~은/는/이/가', 'V 동사: ~하다/~이다 (조동사·not·시제 표현도 함께)', 'O 목적어: ~을/를 (I.O ~에게 / D.O ~을)', 'C 보어: 주어·목적어를 보충 설명 (O.C 목적격보어)', 'M 수식어: 빼도 문장이 되는 부분 — 괄호로 묶어요'], n: 0 },
  { t: '1형식', f: P_FORMULA[1], d: ['동사만으로 뜻이 끝나요', 'There is/are 문장도 1형식', '뒤에 붙는 장소·시간 말은 수식어(M)'], n: 1 },
  { t: '2형식', f: P_FORMULA[2], d: ['주어 = 보어', 'be, become, get / look, sound, smell, taste, feel', '감각동사 뒤 보어는 형용사 (look happy ○, happily ✗)', 'look like + 명사도 2형식'], n: 2 },
  { t: '3형식', f: P_FORMULA[3], d: ['동사 뒤 목적어 하나', '주어 ≠ 목적어', 'to부정사·동명사·that절도 목적어가 될 수 있어요'], n: 3 },
  { t: '4형식', f: P_FORMULA[4], d: ['~에게(I.O) ~을(D.O)', '3형식으로: D.O + to/for/of + I.O', 'to: give send show tell / for: make buy cook / of: ask'], n: 4 },
  { t: '5형식', f: P_FORMULA[5], d: ['목적어 = 목적격보어', 'make/keep/find + O + 형용사', 'want/ask/tell + O + to부정사', 'make/have/let + O + 동사원형 · see/hear + O + 동사원형/-ing'], n: 5 }
];
function pConcepts(pid, i) {
  const c = P_CONCEPTS[i];
  const pool = (pid ? PS.sents.filter(s => s.passage_id === pid) : PS.sents);
  const ex = c.n ? pool.filter(s => s.pattern === c.n).slice(0, 2) : pool.filter(s => (s.chunks || []).length > 2).slice(0, 1);
  shell(`<p><a href="#" id="back">← 돌아가기</a></p>
    <div class="card pconcept"><div class="tiny">${i + 1} / ${P_CONCEPTS.length}</div><h2>${esc(c.t)}</h2><div class="pformula">${esc(c.f)}</div>
      ${c.d.map(x => `<div class="concept-step">${esc(x)}</div>`).join('')}
      ${ex.length ? `<h3 style="margin-top:14px">${pid ? '이 본문에서' : '배운 본문에서'}</h3>${ex.map(s => `${pChunkHtml(s.chunks, { show: true, ko: true })}<div class="tiny" style="margin:2px 0 10px">${esc(s.ko)}</div>`).join('')}` : ''}
      <div class="row between" style="margin-top:14px"><button class="btn ghost" id="pv" ${i === 0 ? 'disabled' : ''}>이전</button>
      <button class="btn" id="nx">${i < P_CONCEPTS.length - 1 ? '다음' : '다 봤어요'}</button></div></div>`);
  $('#back').onclick = e => { e.preventDefault(); pid ? passageView(pid) : passageHome(); };
  $('#pv').onclick = () => pConcepts(pid, i - 1);
  $('#nx').onclick = () => i < P_CONCEPTS.length - 1 ? pConcepts(pid, i + 1) : (pid ? passageView(pid) : passageHome());
}

/* ---------- 단계 시작 · 마치기 ---------- */
function pStart(pid, step) {
  AT.start();
  if (step === 'read') return pRead(pid, 0, true);
  const list = pSents(pid, step);
  if (!list.length) return toast('이 단계에 낼 문장이 없어요');
  pQuiz({ pid, step, list: (step === 'role' || step === 'read') ? list : shuffle(list), requeue: true, onEnd: res => pStepEnd(pid, step, res) });
}
async function pStepEnd(pid, step, res) {
  try {
    const { data, error } = await S.sb.rpc('passage_step_done', { p_passage: pid, p_step: step, p_run: res ? res.runId : null, p_time_sec: AT.stop() });
    if (error) throw error;
    const pr = pProg(pid, step);
    if (pr) { pr.score = data.score; pr.total = data.total; pr.tries++; } else PS.prog.push({ passage_id: pid, step, score: data.score, total: data.total, tries: 1 });
    const st = pStepsFor(pid), i = st.findIndex(s => s[0] === step), nx = st[i + 1];
    const wrong = res ? [...res.map.values()].filter(r => !r.ok) : [];
    shell(`<div class="card vend"><div class="vend-ic">${(P_STEPS.find(s => s[0] === step) || [])[3] || '✅'}</div><h2>${P_STEP_NAME[step]} 끝!</h2>
      ${data.total ? `<p class="clock big">${data.score} / ${data.total}</p><p class="muted">한 번에 맞힌 문장</p>` : '<p>본문을 끝까지 읽었어요.</p>'}
      ${wrong.length ? `<p class="tiny">틀린 문장 ${wrong.length}개는 내일 문장 복습에 다시 나와요.</p>` : ''}
      <div class="row" style="justify-content:center;margin-top:12px">${nx ? `<button class="btn" id="nx">다음: ${P_STEP_NAME[nx[0]]}</button>` : '<button class="btn" id="nx">본문 목록으로</button>'}<button class="btn ghost" id="pv">단계 목록</button></div></div>`);
    $('#nx').onclick = () => nx ? pStart(pid, nx[0]) : passageHome();
    $('#pv').onclick = () => passageView(pid);
  } catch (e) { toast(errText(e), 4000); passageView(pid); }
}

/* ① 듣고 읽기: 성분 색 켜기·끄기, 덩어리 해석, 형식 표시 */
function pRead(pid, i, color) {
  const list = PS.sents.filter(s => s.passage_id === pid).sort((a, b) => a.ord - b.ord), s = list[i], tr = pTrack(pid);
  shell(`<p><a href="#" id="back">← 단계 목록</a></p>
    <div class="row between"><b>📖 듣고 읽기</b><span class="tiny">${i + 1} / ${list.length}</span></div>
    <div class="progress" style="margin:8px 0 14px"><i style="width:${(i + 1) / list.length * 100}%"></i></div>
    <div class="card pread">
      <div class="row between"><label class="pick small"><input type="checkbox" id="col" ${color ? 'checked' : ''}> 성분 색 보기</label>${s.pattern ? `<span class="pbadge">${s.pattern}형식 · ${P_FORMULA[s.pattern]}</span>` : ''}</div>
      ${color && s.chunks.length ? pChunkHtml(s.chunks, { show: true, ko: true, track: tr === 'basic' ? 'basic' : null }) : `<div class="pplain">${esc(s.en)}</div>`}
      <div class="row" style="margin-top:8px">${vSpk(s.en, 0.85)}<button class="btn ghost small" id="ko">해석 보기</button></div>
      <div id="kot" class="pko" hidden>${esc(s.ko)}</div>
      ${(s.points || []).length ? `<div class="ppoints">${s.points.map(x => `<div>📌 <b>${esc(x.t)}</b> ${esc(x.note)}</div>`).join('')}</div>` : ''}
    </div>
    <div class="row between"><button class="btn ghost" id="pv" ${i === 0 ? 'disabled' : ''}>이전</button><button class="btn" id="nx">${i < list.length - 1 ? '다음 문장' : '다 읽었어요'}</button></div>
    <p class="tiny">${tr === 'basic' ? '먼저 주어(S)와 동사(V)를 찾아 소리 내어 읽어 보세요.' : '수식어(M)를 빼고 뼈대만 읽어 보면 형식이 보여요.'}</p>`);
  $('#back').onclick = e => { e.preventDefault(); if ('speechSynthesis' in window) speechSynthesis.cancel(); passageView(pid); };
  vBindSpk();
  $('#col').onchange = e => pRead(pid, i, e.target.checked);
  $('#ko').onclick = () => { $('#kot').hidden = !$('#kot').hidden; };
  $('#pv').onclick = () => pRead(pid, i - 1, color);
  $('#nx').onclick = e => { if (i < list.length - 1) return pRead(pid, i + 1, color); e.target.disabled = true; pStepEnd(pid, 'read', null); };
}

/* ---------- 문제 진행기 (성분·형식·배열·빈칸·영작·바꿔 쓰기 공통) ---------- */
function pQuiz(opt) {
  // opt: {pid?, step (또는 x.step), list:[sentence], requeue, review, title, onEnd}
  const Q = { requeue: !!opt.requeue, list: opt.list.map(s => ({ s, step: opt.stepOf ? opt.stepOf(s) : opt.step })), i: 0, map: new Map(), out: null, busy: false, cid: null, done: 0, total: opt.list.length, runId: uuid() };
  const draw = () => {
    if (Q.i >= Q.list.length) return opt.onEnd({ map: Q.map, runId: Q.runId });
    const x = Q.list[Q.i], s = x.s, tr = pTrack(s.passage_id);
    if (!x.st) x.st = pPrep(x, tr);
    const top = `<p><a href="#" id="back">← ${opt.pid ? '단계 목록' : '본문 목록'}</a></p>
      <div class="row between"><b>${opt.title || ((P_STEPS.find(q => q[0] === x.step) || [])[3] + ' ' + P_STEP_NAME[x.step])}</b><span class="tiny">${Q.done} / ${Q.total}</span></div>
      <div class="progress" style="margin:8px 0 14px"><i style="width:${Q.done / Q.total * 100}%"></i></div>`;
    shell(top + `<div class="card pq">${pBody(x, tr, Q.out)}</div><div id="pqbtn">${pButtons(x, Q)}</div>`);
    $('#back').onclick = e => { e.preventDefault(); opt.pid ? passageView(opt.pid) : passageHome(); };
    vBindSpk();
    pBind(x, tr, Q, submit, draw);
    if ($('#nx')) $('#nx').onclick = e => { e.target.disabled = true; next(); };
  };
  const submit = async ans => {
    if (Q.busy || Q.out) return;
    const x = Q.list[Q.i];
    Q.busy = true; if (!Q.cid) Q.cid = uuid();
    try {
      const { data, error } = await S.sb.rpc('passage_submit', { p_client: Q.cid, p_sentence: x.s.id, p_step: x.step, p_answer: ans, p_review: !!opt.review, p_run: Q.runId });
      if (error) throw error;
      Q.out = data; Q.cid = null; Q.busy = false; x.ans = ans;
      if (!Q.map.has(x.s.id + x.step)) Q.map.set(x.s.id + x.step, { s: x.s, ok: data.is_correct });
      if (data.is_correct || !opt.requeue || x.again) Q.done++;
      const r = PS.srs.find(z => z.sentence_id === x.s.id);
      if (data.box) { if (r) { r.box = data.box; r.due_on = data.due_on; } else PS.srs.push({ sentence_id: x.s.id, box: data.box, due_on: data.due_on }); }
      draw();
      if (data.is_correct && x.step !== 'role' && x.step !== 'pattern') TTS.say(x.step === 'convert' ? x.s.alt : x.s.en, 0.95);
    } catch (e) { Q.busy = false; toast(errText(e), 4000); }
  };
  const next = () => {
    const x = Q.list[Q.i];
    if (Q.out && !Q.out.is_correct && opt.requeue && !x.again) Q.list.push({ s: x.s, step: x.step, again: true });
    Q.i++; Q.out = null; draw();
  };
  draw();
}
// 문제마다 준비물 (섞은 덩어리·보기 등)
function pPrep(x, tr) {
  const s = x.s, words = s.en.replace(/[.!?]+$/, '').split(/\s+/);
  const st = { roles: (s.chunks || []).map(() => null), pick: 0, built: [] };
  if (x.step === 'order') {
    let tiles = tr === 'basic' && s.chunks.length > 1 ? s.chunks.map(c => c.t) : words.slice();
    if (tr === 'adv') { const others = PS.sents.filter(o => o.passage_id === s.passage_id && o.id !== s.id).flatMap(o => o.en.replace(/[.!?]+$/, '').split(/\s+/)).filter(w => !words.includes(w)); if (others.length) tiles.push(others[Math.random() * others.length | 0]); }
    st.tiles = shuffle(tiles.map((t, k) => ({ t, k })));
  }
  if (x.step === 'blank') {
    st.bi = Math.random() * s.blanks.length | 0;
    const ans = s.blanks[st.bi];
    if (tr === 'basic') {
      const pool = [...new Set(PS.sents.filter(o => o.passage_id === s.passage_id).flatMap(o => o.blanks || []).filter(b => vNorm(b) !== vNorm(ans)))];
      let ds = shuffle(pool).slice(0, 2);
      if (ds.length < 2) { const ws = [...new Set(PS.sents.filter(o => o.passage_id === s.passage_id).flatMap(o => o.en.replace(/[.,!?;:"]/g, '').split(/\s+/)).filter(w => w.length > 2 && vNorm(w) !== vNorm(ans)))]; ds = ds.concat(shuffle(ws).slice(0, 2 - ds.length)); }
      st.choices = shuffle([ans, ...ds]);
    }
  }
  if (x.step === 'write' && tr === 'normal') st.bank = shuffle(words.map(w => w.replace(/[,;:"]/g, '')));
  return st;
}
// 빈칸 말을 낱말 단위로 찾아요 (on 이 upon 안에서 잡히지 않게)
function pFindWord(en, w) {
  if (!w) return -1;
  const re = new RegExp('(^|[^A-Za-z\'])(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')(?![A-Za-z\'])');
  const m = re.exec(en); return m ? m.index + m[1].length : -1;
}
function pBlanked(s, bi) {
  const ans = s.blanks[bi], k = pFindWord(s.en, ans);
  if (k < 0) return esc(s.en);
  return esc(s.en.slice(0, k)) + '<span class="pblank">' + '&nbsp;'.repeat(Math.max(6, ans.length)) + '</span>' + esc(s.en.slice(k + ans.length));
}
function pBody(x, tr, out) {
  const s = x.s, st = x.st;
  const res = out ? (out.is_correct ? `<div class="result ok"><b>정답! 👏</b></div>` : `<div class="result bad"><b>아쉬워요</b>${pExplain(x, tr, out)}</div>`) : '';
  if (x.step === 'role') {
    const pal = P_PALETTE[tr];
    return `<div class="tiny">덩어리를 누르고 아래에서 성분을 고르세요${tr === 'basic' ? ' (주어 S, 동사 V만 찾으면 돼요)' : ''}</div>
      ${pChunkHtml(s.chunks, { roles: st.roles, pick: out ? null : st.pick, result: !!out, track: tr })}
      ${out ? (out.is_correct ? '' : `<div class="tiny" style="margin-top:6px">정답</div>${pChunkHtml(s.chunks, { show: true, track: tr })}`) : `<div class="ppal">${pal.map(r => `<button class="pp r-${r}" data-role="${r}">${esc(P_ROLE_LABEL[r])}<small>${P_ROLE_NAME[r]}</small></button>`).join('')}</div>`}
      <div class="pko">${esc(s.ko)}</div>${res}`;
  }
  if (x.step === 'pattern') {
    const max = tr === 'basic' ? 3 : 5;
    const sent = tr === 'basic' ? pChunkHtml(s.chunks, { show: true, track: 'basic' }) : `<div class="pplain">${esc(s.en)}</div>`;
    return `<div class="tiny">이 문장은 몇 형식일까요?${tr !== 'adv' ? ' 수식어를 빼고 뼈대를 보세요' : ''}</div>${sent}<div class="pko">${esc(s.ko)}</div>
      <div class="pforms">${Array.from({ length: max }, (_, k) => k + 1).map(n => `<button class="choice ${out ? (n === s.pattern ? 'right' : (String(n) === x.ans ? 'wrong' : '')) : ''}" data-pat="${n}" ${out ? 'disabled' : ''}><b>${n}형식</b> <span class="tiny">${P_FORMULA[n]}</span></button>`).join('')}</div>
      ${out && !out.is_correct ? pChunkHtml(s.chunks, { show: true, track: tr }) : ''}${res}`;
  }
  if (x.step === 'order') {
    return `<div class="tiny">우리말에 맞게 순서대로 눌러요</div><div class="pko big">${esc(s.ko)}</div>
      <div class="pbuilt">${st.built.map(k => `<button class="ptile on" data-un="${k}" ${out ? 'disabled' : ''}>${esc((st.tiles.find(t => t.k === k) || {}).t || '')}</button>`).join('') || '<span class="tiny">여기에 문장이 만들어져요</span>'}</div>
      <div class="ptiles">${st.tiles.map(t => `<button class="ptile" data-tk="${t.k}" ${st.built.includes(t.k) || out ? 'disabled' : ''}>${esc(t.t)}</button>`).join('')}</div>${res}`;
  }
  if (x.step === 'blank') {
    const ans = s.blanks[st.bi];
    const inp = tr === 'basic' ? st.choices.map(c => `<button class="choice ${out ? (vNorm(c) === vNorm(ans) ? 'right' : (x.ans && JSON.parse(x.ans).a === c ? 'wrong' : '')) : ''}" data-bc="${esc(c)}" ${out ? 'disabled' : ''}>${esc(c)}</button>`).join('')
      : `${tr === 'normal' ? `<div class="vmask">${esc(vHintMask(ans))}</div>` : ''}<input type="text" id="ans" class="vin" placeholder="빈칸에 들어갈 말" autocomplete="off" autocapitalize="off" spellcheck="false" ${out ? 'disabled' : ''}>`;
    return `<div class="tiny">빈칸에 알맞은 말을 ${tr === 'basic' ? '고르세요' : '쓰세요'}</div><div class="pplain">${pBlanked(s, st.bi)}</div><div class="pko">${esc(s.ko)}</div>${inp}${res}`;
  }
  if (x.step === 'write' || x.step === 'convert') {
    const conv = x.step === 'convert';
    const help = conv ? `<div class="pplain">${esc(s.en)}</div><div class="pbadge">${esc(s.alt_note || '다른 형식으로 바꿔 쓰세요')}</div>`
      : `<div class="pko big">${esc(s.ko)}</div>` + (tr === 'basic' ? `<div class="vmask sm">${esc(s.en.replace(/[.!?]+$/, '').split(/\s+/).map(w => w[0] + '_'.repeat(Math.max(0, w.replace(/[^A-Za-z']/g, '').length - 1))).join(' '))}</div><div class="tiny">첫 글자를 보고 문장 전체를 써요</div>`
        : tr === 'normal' ? `<div class="pbank">${st.bank.map(w => `<span>${esc(w)}</span>`).join('')}</div><div class="tiny">위 단어를 모두 써서 문장을 완성해요</div>` : '<div class="tiny">힌트 없이 문장 전체를 써요</div>');
    return `${help}<textarea id="ans" class="pin" rows="2" placeholder="영어 문장을 쓰세요" autocapitalize="off" spellcheck="false" ${out ? 'disabled' : ''}>${esc(x.ans || '')}</textarea>${res}`;
  }
  return '';
}
function pExplain(x, tr, out) {
  const s = x.s;
  let h = '';
  if (x.step === 'pattern') h = `<div>정답: <b>${s.pattern}형식</b> (${P_FORMULA[s.pattern]})</div>`;
  else if (x.step === 'blank') h = `<div>정답: <b>${esc(out.expected || s.blanks[x.st.bi])}</b></div>`;
  else if (x.step === 'role') h = `<div class="tiny">${tr === 'basic' ? '동사(V)를 먼저 찾고, 그 동작을 하는 주인공이 주어(S)예요.' : '먼저 동사(V)에 밑줄! 동사 뒤에 무엇이 오는지 보세요.'}</div>`;
  else { const ex = out.expected || (x.step === 'convert' ? s.alt : s.en); h = `<div>정답: <b>${esc(ex)}</b> ${vSpk(ex, 0.9)}</div>`; }
  const pt = (s.points || [])[0];
  return h + (pt ? `<div class="tiny">📌 ${esc(pt.t)} — ${esc(pt.note)}</div>` : '') + (x.again ? '' : '<div class="tiny">이 문장은 마지막에 한 번 더 나와요.</div>');
}
function pButtons(x, Q) {
  if (Q.out) {
    const willAgain = Q.requeue && !Q.out.is_correct && !x.again;
    const last = Q.i >= Q.list.length - 1 && !willAgain;
    return `<button class="btn" id="nx" style="width:100%">${last ? '마치기' : '다음'}</button>`;
  }
  if (x.step === 'pattern' || (x.step === 'blank' && pTrack(x.s.passage_id) === 'basic')) return '';
  if (x.step === 'order') return `<div class="row"><button class="btn ghost" id="undo">하나 지우기</button><button class="btn" id="go" style="flex:1">확인</button></div>`;
  return '<button class="btn" id="go" style="width:100%">확인</button>';
}
function pBind(x, tr, Q, submit, draw) {
  const st = x.st;
  if (x.step === 'role' && !Q.out) {
    document.querySelectorAll('.pc').forEach(el => el.onclick = () => { st.pick = +el.dataset.ci; draw(); });
    document.querySelectorAll('[data-role]').forEach(b => b.onclick = () => {
      st.roles[st.pick] = b.dataset.role;
      const nxt = st.roles.findIndex(r => r == null);
      st.pick = nxt >= 0 ? nxt : st.pick;
      draw();
    });
    const go = $('#go'); if (go) go.onclick = () => {
      if (st.roles.some(r => r == null)) { if (tr !== 'basic') return toast('모든 덩어리에 성분을 붙여 주세요'); st.roles = st.roles.map(r => r || '-'); }
      submit(JSON.stringify(st.roles));
    };
  }
  if (x.step === 'pattern') document.querySelectorAll('[data-pat]').forEach(b => b.onclick = () => { x.ans = b.dataset.pat; submit(b.dataset.pat); });
  if (x.step === 'order' && !Q.out) {
    document.querySelectorAll('[data-tk]').forEach(b => b.onclick = () => { st.built.push(+b.dataset.tk); draw(); });
    document.querySelectorAll('[data-un]').forEach(b => b.onclick = () => { st.built = st.built.filter(k => k !== +b.dataset.un); draw(); });
    $('#undo').onclick = () => { st.built.pop(); draw(); };
    $('#go').onclick = () => {
      if (!st.built.length) return toast('단어를 눌러 문장을 만들어 주세요');
      const sent = st.built.map(k => st.tiles.find(t => t.k === k).t).join(' ');
      submit(sent);
    };
  }
  if (x.step === 'blank' && !Q.out) {
    const send = a => { if (!String(a || '').trim()) return toast('답을 먼저 적어 주세요'); x.ans = JSON.stringify({ i: st.bi, a }); submit(x.ans); };
    document.querySelectorAll('[data-bc]').forEach(b => b.onclick = () => send(b.dataset.bc));
    const inp = $('#ans'); if (inp) { inp.focus(); inp.onkeydown = e => { if (e.key === 'Enter') send(inp.value); }; $('#go').onclick = () => send(inp.value); }
  }
  if ((x.step === 'write' || x.step === 'convert') && !Q.out) {
    const inp = $('#ans'); inp.focus();
    inp.oninput = () => { x.ans = inp.value; };
    inp.onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#go').click(); } };
    $('#go').onclick = () => { if (!inp.value.trim()) return toast('문장을 먼저 써 주세요'); submit(inp.value); };
  }
}

/* ---------- 문장 복습 · 형식 집중 연습 ---------- */
function pReview() {
  const byId = new Map(PS.sents.map(s => [s.id, s]));
  const list = pDue().slice(0, 30).map(r => byId.get(r.sentence_id)).filter(Boolean);
  if (!list.length) return passageHome();
  AT.start();
  // 수준별 복습 방식: 기초는 배열, 기본은 빈칸(없으면 배열), 심화는 영작
  const stepOf = s => { const tr = pTrack(s.passage_id); return tr === 'adv' ? 'write' : tr === 'normal' && (s.blanks || []).length ? 'blank' : 'order'; };
  pQuiz({ list: shuffle(list), stepOf, review: true, requeue: true, title: '🔁 문장 복습', onEnd: res => {
    const n = res.map.size, ok = [...res.map.values()].filter(r => r.ok).length, left = pDue().length;
    shell(`<div class="card vend"><div class="vend-ic">🔁</div><h2>문장 복습 끝!</h2><p class="clock big">${ok} / ${n}</p><p class="muted">한 번에 맞힌 문장</p>
      <p class="tiny">맞힌 문장은 더 긴 간격 뒤에, 틀린 문장은 내일 다시 나와요.</p>
      <div class="row" style="justify-content:center">${left ? `<button class="btn" id="more">남은 복습 ${left}개</button>` : ''}<button class="btn ${left ? 'ghost' : ''}" id="home">본문 목록으로</button></div></div>`);
    if ($('#more')) $('#more').onclick = () => pReview();
    $('#home').onclick = () => passageHome();
  } });
}
function pDrill(n) {
  let pool = PS.sents.filter(s => s.pattern >= 1 && (s.chunks || []).length && (pTrack(s.passage_id) !== 'basic' || s.pattern <= 3));
  if (n) pool = pool.filter(s => s.pattern === n);
  if (!pool.length) return toast(n ? `배정된 본문에 ${n}형식 문장이 없어요` : '연습할 문장이 없어요');
  const list = shuffle(pool).slice(0, 10);
  AT.start();
  let k = 0;
  pQuiz({ list, stepOf: () => (k++ % 2 ? 'pattern' : 'role'), requeue: true, title: `🎯 ${n ? n + '형식' : '골고루'} 집중 연습`, onEnd: res => {
    const total = res.map.size, ok = [...res.map.values()].filter(r => r.ok).length;
    shell(`<div class="card vend"><div class="vend-ic">🎯</div><h2>집중 연습 끝!</h2><p class="clock big">${ok} / ${total}</p>
      <div class="row" style="justify-content:center"><button class="btn" id="again">한 번 더</button><button class="btn ghost" id="home">본문 목록으로</button></div></div>`);
    $('#again').onclick = () => pDrill(n); $('#home').onclick = () => passageHome();
  } });
}
