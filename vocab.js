/* 심쿵영어 어휘 학습 - 학생 화면
   흐름: 오늘의 복습(간격 복습) → 유닛 6단계(보고 듣기 → 외우기 → 뜻 고르기 → 철자 쓰기 → 짝 맞추기 → 유닛 테스트) */
'use strict';

const V_STEPS = [
  ['look', '보고 듣기', '단어·표현·예문을 보고 발음을 들어요'],
  ['memorize', '외우기', '알아요 / 헷갈려요로 스스로 확인해요'],
  ['check', '뜻 고르기', '영어↔뜻을 골라요'],
  ['write', '철자 쓰기', '뜻을 보고 영어로 써요'],
  ['match', '짝 맞추기', '시간 안에 짝을 찾아요'],
  ['test', '유닛 테스트', '통과하면 다음 유닛이 열려요']
];
const V_STEP_NAME = Object.fromEntries(V_STEPS.map(s => [s[0], s[1]]));
const V_ICON = { look: '👀', memorize: '🧠', check: '✅', write: '✏️', match: '🧩', test: '🏁' };
const VS = { ok: false, asg: [], books: [], units: [], items: [], prog: [], ustat: [], srs: [], rlog: [], days: new Set() };

function kstToday() { return new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10); }
function kstDay(s) { return new Date(new Date(s).getTime() + 9 * 3600e3).toISOString().slice(0, 10); }
function addDays(d, n) { const t = new Date(d + 'T00:00:00Z'); t.setUTCDate(t.getUTCDate() + n); return t.toISOString().slice(0, 10); }
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; }
function vNorm(t) { return String(t || '').toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').trim().replace(/\s*[.!?]+$/, '').replace(/\s+/g, ' ').trim(); }
// 레벨 어휘는 유닛이 순서대로 열리고, 내신 교과어휘는 원장님이 고른 과(시험 범위)가 한꺼번에 열려요.
function vCfg(a) {
  const s = (a && a.settings) || {};
  const bk = a && typeof vBook === 'function' ? vBook(a.book_id) : null, school = !!(bk && bk.kind === 'school');
  return { pass_pct: s.pass_pct ?? 90, first_letter: !!s.first_letter, units_per_day: s.units_per_day ?? (school ? 0 : 1), review_cap: s.review_cap ?? 40, speak: s.speak !== false,
    sequential: s.sequential ?? !school, only: Array.isArray(s.only) && s.only.length ? s.only.map(Number) : null };
}
function vBookLabel(bk) {
  if (!bk) return '';
  if (bk.kind === 'school') return `<span class="vkind school">내신</span>${esc([bk.school_grade, bk.publisher].filter(Boolean).join(' · '))}`;
  return `<span class="vkind level">레벨 ${esc(bk.level || '-')}</span>${esc(bk.grade_band || '')}`;
}
function vUnitName(u) { if (!u) return ''; const bk = vBook(u.book_id); return u.title || ((bk && bk.kind === 'school' ? 'Lesson ' : 'Unit ') + u.ord); }

/* ---------- 발음 (기기에 있는 영어 음성으로 읽어 줘요. 인터넷 비용 없음) ---------- */
const TTS = {
  voice: null,
  pick() {
    if (!('speechSynthesis' in window)) return null;
    const vs = speechSynthesis.getVoices();
    this.voice = vs.find(v => /en[-_]US/i.test(v.lang) && /Samantha|Google|Natural|Jenny|Aria/i.test(v.name)) || vs.find(v => /en[-_]US/i.test(v.lang)) || vs.find(v => /^en/i.test(v.lang)) || null;
    return this.voice;
  },
  say(text, rate = 0.9) {
    if (!('speechSynthesis' in window) || !text) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US'; u.rate = rate; if (this.voice || this.pick()) u.voice = this.voice;
      speechSynthesis.speak(u);
    } catch (e) { /* 소리가 안 나도 학습은 계속돼요 */ }
  }
};
if ('speechSynthesis' in window) speechSynthesis.onvoiceschanged = () => TTS.pick();
const SR = window.SpeechRecognition || window.webkitSpeechRecognition || null;

/* ---------- 데이터 ---------- */
async function vFetchAll(build) {
  const out = []; let from = 0;
  for (;;) {
    const { data, error } = await build().range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
    from += 1000;
  }
}
async function loadVocab() {
  const u = S.user.id, sb = S.sb;
  try {
    const a = await sb.from('vocab_assignments').select('*').eq('student_id', u).order('created_at');
    if (a.error) { VS.ok = false; return; }           // 어휘 DB(schema11) 설치 전이면 어휘 칸을 숨겨요
    VS.asg = a.data || [];
    VS.ok = true;
    if (!VS.asg.length) { VS.books = []; VS.units = []; VS.items = []; return; }
    const since = new Date(Date.now() - 70 * 864e5).toISOString();
    const [b, un, it, pr, us, sr, rl, an] = await Promise.all([
      sb.from('vocab_books').select('*'),
      vFetchAll(() => sb.from('vocab_units').select('*').order('book_id').order('ord').order('id')),
      vFetchAll(() => sb.from('vocab_items').select('*').order('unit_id').order('ord').order('id')),
      vFetchAll(() => sb.from('vocab_progress').select('*').eq('student_id', u).order('unit_id').order('step')),
      vFetchAll(() => sb.from('vocab_unit_status').select('*').eq('student_id', u).order('unit_id')),
      vFetchAll(() => sb.from('vocab_srs').select('*').eq('student_id', u).order('item_id')),
      sb.from('vocab_review_log').select('*').eq('student_id', u),
      vFetchAll(() => sb.from('vocab_answers').select('submitted_at,id').eq('student_id', u).gte('submitted_at', since).order('submitted_at').order('id'))
    ]);
    if (b.error) throw b.error;
    VS.books = b.data || []; VS.units = un; VS.items = it; VS.prog = pr; VS.ustat = us; VS.srs = sr; VS.rlog = rl.data || [];
    VS.days = new Set(an.map(x => kstDay(x.submitted_at)).concat(VS.rlog.map(r => r.day)));
    VS.asg = VS.asg.filter(x => VS.books.some(bk => bk.id === x.book_id));
    if (typeof loadGame === 'function') await loadGame();
  } catch (e) { VS.ok = false; VS.err = e; }
}
const vBook = id => VS.books.find(b => b.id === id);
const vUnit = id => VS.units.find(u => u.id === id);
const vItems = unitId => VS.items.filter(i => i.unit_id === unitId).sort((a, b) => a.ord - b.ord);
const vUnits = bookId => VS.units.filter(u => u.book_id === bookId).sort((a, b) => a.ord - b.ord);
const vProg = (unitId, step) => VS.prog.find(p => p.unit_id === unitId && p.step === step);
const vStat = unitId => VS.ustat.find(s => s.unit_id === unitId);
const vAsgOfUnit = unitId => { const u = vUnit(unitId); return u && VS.asg.find(a => a.book_id === u.book_id); };

function vStreak() {
  let d = kstToday(), n = 0;
  if (!VS.days.has(d)) d = addDays(d, -1);
  while (VS.days.has(d)) { n++; d = addDays(d, -1); }
  return n;
}
function vStars() {
  const steps = VS.prog.length, passed = VS.ustat.filter(s => s.passed_at).length, rev = VS.rlog.length;
  return steps + passed * 2 + rev;
}
function vDue() {
  const t = kstToday(), ids = new Set(VS.items.map(i => i.id));
  return VS.srs.filter(r => r.due_on <= t && ids.has(r.item_id)).sort((a, b) => a.due_on.localeCompare(b.due_on) || a.box - b.box);
}
function vMastered() { return VS.srs.filter(r => r.box >= 6).length; }
function vLearned() { return VS.srs.filter(r => r.box >= 2).length; }

// 유닛 열림 규칙: 시작 유닛부터 순서대로, 앞 유닛을 통과해야 열려요. 하루에 새로 통과할 유닛 수를 정해 두면 그 다음 유닛은 내일 열려요.
function vUnitList(a) { const cfg = vCfg(a); return vUnits(a.book_id).filter(u => u.ord >= (a.start_ord || 1) && (!cfg.only || cfg.only.includes(u.ord))); }
function vUnitState(a, unit) {
  const cfg = vCfg(a), list = vUnitList(a);
  const i = list.findIndex(u => u.id === unit.id);
  if (i < 0) return 'hidden';
  const st = vStat(unit.id);
  if (st && st.passed_at) return 'passed';
  const started = VS.prog.some(p => p.unit_id === unit.id);
  if (!cfg.sequential) return started ? 'doing' : 'open';
  if (i > 0) { const prev = vStat(list[i - 1].id); if (!prev || !prev.passed_at) return 'locked'; }
  if (!started && cfg.units_per_day > 0) {
    const today = kstToday();
    const n = VS.ustat.filter(s => s.passed_at && kstDay(s.passed_at) === today && list.some(u => u.id === s.unit_id)).length;
    if (n >= cfg.units_per_day) return 'tomorrow';
  }
  return started ? 'doing' : 'open';
}
function vNextUnit(a) {
  for (const u of vUnitList(a)) { const s = vUnitState(a, u); if (s === 'doing' || s === 'open' || s === 'tomorrow') return { u, s }; }
  return null;
}
function vStepOpen(unitId, step) {
  const i = V_STEPS.findIndex(s => s[0] === step);
  if (i <= 0) return true;
  if (step === 'test') return !!vProg(unitId, 'match') || !!vProg(unitId, 'test');
  return !!vProg(unitId, V_STEPS[i - 1][0]);
}

/* ---------- 홈에 들어가는 어휘 카드 ---------- */
function vocabHomeCard() {
  if (!VS.ok || !VS.asg.length) return '';
  const due = vDue().length;
  const nxs = VS.asg.map(a => vNextUnit(a)).filter(Boolean), nx = nxs.find(x => x.s !== 'tomorrow') || nxs[0];
  const nxt = nx ? (nx.s === 'tomorrow' ? '오늘 새 유닛은 끝! 내일 다음 유닛이 열려요' : `다음: ${esc(vUnitName(nx.u))}`) : '단어장을 모두 끝냈어요 🎉';
  return `<div class="card vhome" id="vgo" role="button" tabindex="0">
    <div class="vh-l"><div class="vh-ic">Aa</div><div><h2 style="margin:0">어휘</h2><div class="muted">${due ? `오늘 복습 <b class="vred">${due}개</b> · ` : ''}${nxt}</div></div></div>
    <div class="vh-r">${typeof gHomeChip === 'function' ? gHomeChip() : ''}<span class="vchip">🔥 ${vStreak()}일</span><span class="vchip">⭐ ${vStars()}</span><button class="btn">${due ? '복습부터' : '학습하기'}</button></div></div>`;
}
function bindVocabHome() { const el = $('#vgo'); if (el) el.onclick = () => vocabHome(); }

/* ---------- 어휘 홈 ---------- */
function vocabHome() {
  const due = vDue(), streak = vStreak();
  const goalRev = due.length === 0, today = kstToday();
  const passedToday = VS.ustat.filter(s => s.passed_at && kstDay(s.passed_at) === today).length;
  const bookCard = a => {
    const bk = vBook(a.book_id), us = vUnitList(a);
    const passed = us.filter(u => vUnitState(a, u) === 'passed').length;
    const chips = us.map(u => {
      const s = vUnitState(a, u), st = vStat(u.id);
      const cls = { passed: 'ok', doing: 'now', open: 'now', locked: 'lock', tomorrow: 'lock' }[s] || 'lock';
      const tip = s === 'passed' ? `통과 ${st.best_pct}%` : s === 'tomorrow' ? '내일 열려요' : s === 'locked' ? '앞 유닛을 먼저 통과해요' : '열림';
      return `<button class="uchip ${cls}" data-unit="${u.id}" title="${esc(vUnitName(u) + ' · ' + tip)}" ${cls === 'lock' ? 'disabled' : ''}>${s === 'passed' ? '✓' : s === 'locked' || s === 'tomorrow' ? '🔒' : ''}<span>${u.ord}</span></button>`;
    }).join('');
    const nx = vNextUnit(a), sch = bk.kind === 'school';
    return `<div class="card"><div class="row between"><div><h2 style="margin:0">${esc(bk.title)}</h2>
      <div class="muted">${vBookLabel(bk)} · ${us.length}${sch ? '과' : '유닛'} 중 ${passed} 통과</div></div>
      ${nx && nx.s !== 'tomorrow' ? `<button class="btn" data-unit="${nx.u.id}">${nx.s === 'doing' ? '이어서' : '시작'} · ${esc(vUnitName(nx.u))}</button>` : nx ? '<span class="badge gray">내일 열려요</span>' : '<span class="badge ok">완주!</span>'}</div>
      <div class="progress" style="margin:10px 0"><i style="width:${pct(passed, us.length) || 0}%"></i></div>
      <div class="uchips">${chips}</div>${sch ? '<div class="tiny" style="margin-top:6px">시험 범위 과는 순서 상관없이 바로 공부할 수 있어요.</div>' : ''}</div>`;
  };
  const lv = VS.asg.filter(a => (vBook(a.book_id) || {}).kind !== 'school'), sc = VS.asg.filter(a => (vBook(a.book_id) || {}).kind === 'school');
  const books = (lv.length && sc.length ? '<h2 class="sect">레벨 어휘</h2>' : '') + lv.map(bookCard).join('') + (sc.length ? '<h2 class="sect">📘 내신 대비 교과어휘</h2>' + sc.map(bookCard).join('') : '');
  shell(`<p><a href="#" id="back">← 처음으로</a></p>
    <div class="vstats">
      <div class="vstat"><b>🔥 ${streak}일</b><span>연속 학습</span></div>
      <div class="vstat"><b>⭐ ${vStars()}</b><span>모은 별</span></div>
      <div class="vstat"><b>${vLearned()}</b><span>외운 단어</span></div>
      <div class="vstat"><b>${vMastered()}</b><span>완전 암기</span></div>
    </div>
    <div class="card vgoal"><h3 style="margin:0 0 8px">오늘의 목표</h3>
      <div class="goal ${goalRev ? 'done' : ''}"><span>${goalRev ? '✓' : '○'}</span> 복습 다 하기 ${due.length ? `<b class="vred">(${due.length}개 남음)</b>` : ''}</div>
      <div class="goal ${passedToday ? 'done' : ''}"><span>${passedToday ? '✓' : '○'}</span> 새 유닛 통과하기</div>
      ${due.length ? `<button class="btn" id="rev" style="margin-top:10px;width:100%">🔁 오늘의 복습 시작 (${Math.min(due.length, Math.max(...VS.asg.map(a => vCfg(a).review_cap)))}개)</button>` : '<div class="tiny" style="margin-top:6px">오늘 복습할 단어가 없어요. 새 유닛을 공부해요!</div>'}
    </div>${typeof gHomePanel === 'function' ? gHomePanel() : ''}${books}
    <p class="tiny">틀린 단어는 1일 → 3일 → 7일 → 14일 → 30일 뒤에 다시 나와요. 오래 기억에 남도록 도와줘요.</p>`);
  $('#back').onclick = e => { e.preventDefault(); studentHome(); };
  if ($('#rev')) $('#rev').onclick = () => vReviewStart();
  document.querySelectorAll('[data-unit]').forEach(b => b.onclick = () => vUnitHome(b.dataset.unit));
  if (typeof gBindHome === 'function') { gBindHome(); gRefreshPanel(); }
}

/* ---------- 유닛 홈 (6단계) ---------- */
function vUnitHome(unitId) {
  const u = vUnit(unitId), a = vAsgOfUnit(unitId); if (!u || !a) return vocabHome();
  const items = vItems(unitId), st = vStat(unitId);
  const rows = V_STEPS.map(([k, n, d]) => {
    const p = vProg(unitId, k), open = vStepOpen(unitId, k);
    let badge = '';
    if (p) badge = k === 'test' ? (st && st.passed_at ? `<span class="badge ok">통과 ${st.best_pct}%</span>` : `<span class="badge bad">${st ? st.last_pct : 0}% · 다시 도전</span>`)
      : k === 'match' && p.best_ms ? `<span class="badge ok">✓ 최고 ${(p.best_ms / 1000).toFixed(1)}초</span>`
      : `<span class="badge ok">✓${p.total ? ` ${p.score}/${p.total}` : ''}</span>`;
    return `<div class="vstep ${open ? '' : 'locked'} ${p ? 'done' : ''}"><div class="vs-ic">${V_ICON[k]}</div><div class="vs-t"><b>${n}</b><div class="tiny">${d}</div>${badge}</div>
      <button class="btn small ${p ? 'ghost' : ''}" data-step="${k}" ${open ? '' : 'disabled'}>${open ? (p ? '다시' : '시작') : '🔒'}</button></div>`;
  }).join('');
  shell(`<p><a href="#" id="back">← 어휘 홈</a></p>
    <h1>${esc(vUnitName(u))} <span class="tiny">${items.length}개</span></h1>
    <div class="card"><div class="vsteps">${rows}</div>
    <p class="tiny" style="margin-top:10px">테스트에서 ${vCfg(a).pass_pct}% 이상 맞히면 통과예요.</p></div>`);
  $('#back').onclick = e => { e.preventDefault(); vocabHome(); };
  document.querySelectorAll('[data-step]').forEach(b => b.onclick = () => vStartStep(unitId, b.dataset.step));
}
function vStartStep(unitId, step) {
  const items = vItems(unitId);
  if (!items.length) return toast('아직 단어가 없어요');
  AT.start();
  ({ look: vLook, memorize: vMemo, check: vCheck, write: vWrite, match: vMatch, test: vTest })[step](unitId, items);
}
async function vStepDone(unitId, step, score, total, bestMs) {
  try {
    const { error } = await S.sb.rpc('vocab_step_done', { p_unit: unitId, p_step: step, p_score: score, p_total: total, p_time_sec: AT.stop(), p_best_ms: bestMs ?? null });
    if (error) throw error;
    const p = vProg(unitId, step);
    if (p) { p.score = score; p.total = total; p.tries++; if (bestMs != null) p.best_ms = p.best_ms == null ? bestMs : Math.min(p.best_ms, bestMs); }
    else VS.prog.push({ unit_id: unitId, step, score, total, tries: 1, best_ms: bestMs ?? null, done_at: new Date().toISOString() });
    VS.days.add(kstToday());
    return true;
  } catch (e) { toast(errText(e), 4000); return false; }
}
function vTop(unitId, title, i, n) {
  const u = vUnit(unitId);
  return `<p><a href="#" id="back">← ${u ? esc(vUnitName(u)) : '어휘 홈'}</a></p>
    <div class="row between"><b>${V_ICON[title] || ''} ${esc(V_STEP_NAME[title] || title)}</b><span class="tiny">${i} / ${n}</span></div>
    <div class="progress" style="margin:8px 0 14px"><i style="width:${n ? i / n * 100 : 0}%"></i></div>`;
}
function vBack(unitId) { const b = $('#back'); if (b) b.onclick = e => { e.preventDefault(); if ('speechSynthesis' in window) speechSynthesis.cancel(); unitId ? vUnitHome(unitId) : vocabHome(); }; }
function vSpk(text, rate) { return `<button class="spk" data-say="${esc(text)}" ${rate ? `data-rate="${rate}"` : ''} aria-label="발음 듣기">🔊</button>`; }
function vBindSpk() { document.querySelectorAll('[data-say]').forEach(b => b.onclick = e => { e.stopPropagation(); TTS.say(b.dataset.say, +(b.dataset.rate || 0.9)); }); }
function vStepEnd(unitId, step, html) {
  shell(`<div class="card vend"><div class="vend-ic">${V_ICON[step]}</div><h2>${V_STEP_NAME[step]} 끝!</h2>${html}
    <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="nx">다음 단계로</button><button class="btn ghost" id="uh">유닛으로</button></div></div>`);
  const i = V_STEPS.findIndex(s => s[0] === step), next = V_STEPS[i + 1];
  $('#nx').onclick = () => next ? vStartStep(unitId, next[0]) : vUnitHome(unitId);
  if (!next) $('#nx').textContent = '유닛으로';
  $('#uh').onclick = () => vUnitHome(unitId);
}

/* ① 보고 듣기 */
function vLook(unitId, items, i = 0) {
  const it = items[i], a = vAsgOfUnit(unitId), cfg = vCfg(a);
  shell(`${vTop(unitId, 'look', i + 1, items.length)}
    <div class="card fcard">
      <div class="fc-word">${esc(it.word)} ${vSpk(it.word)}</div>
      ${it.pos ? `<div class="fc-pos">${esc(it.pos)}</div>` : ''}
      <div class="fc-mean">${esc(it.meaning)}</div>
      ${typeof gSpellBox === 'function' ? gSpellBox(it, true) : ''}
      ${it.phrase ? `<div class="fc-box"><div class="tiny">함께 외우는 표현</div><b>${esc(it.phrase)}</b> ${vSpk(it.phrase)}<div>${esc(it.phrase_ko)}</div></div>` : ''}
      ${it.example ? `<div class="fc-box ex2"><div class="tiny">예문</div>${esc(it.example)} ${vSpk(it.example, 0.85)}<div class="muted">${esc(it.example_ko)}</div></div>` : ''}
      ${cfg.speak && SR ? '<button class="btn ghost small" id="mic">🎤 따라 말하기</button><div id="micr" class="tiny"></div>' : ''}
    </div>
    <div class="row between"><button class="btn ghost" id="pv" ${i === 0 ? 'disabled' : ''}>이전</button><button class="btn" id="nx">${i < items.length - 1 ? '다음' : '다 봤어요'}</button></div>`);
  vBack(unitId); vBindSpk();
  setTimeout(() => TTS.say(it.word), 250);
  $('#pv').onclick = () => vLook(unitId, items, i - 1);
  $('#nx').onclick = async () => {
    if (i < items.length - 1) return vLook(unitId, items, i + 1);
    if (await vStepDone(unitId, 'look', items.length, items.length)) vStepEnd(unitId, 'look', `<p>단어 ${items.length}개를 모두 봤어요. 이제 외워 볼까요?</p>`);
  };
  const mic = $('#mic');
  if (mic) mic.onclick = () => {
    const r = new SR(); r.lang = 'en-US'; r.interimResults = false; r.maxAlternatives = 3;
    mic.disabled = true; mic.textContent = '🎤 듣는 중…';
    r.onresult = ev => {
      const alts = Array.from(ev.results[0]).map(x => vNorm(x.transcript));
      const okk = alts.some(t => t === vNorm(it.word) || t.includes(vNorm(it.word)));
      $('#micr').innerHTML = okk ? '<span class="vgreen">👏 정확해요!</span>' : `들린 말: “${esc(alts[0] || '')}” · 다시 해 볼까요?`;
    };
    r.onerror = () => { $('#micr').textContent = '마이크를 쓸 수 없어요. 소리 내어 따라 읽기만 해도 좋아요.'; };
    r.onend = () => { mic.disabled = false; mic.textContent = '🎤 따라 말하기'; };
    try { r.start(); } catch (e) { mic.disabled = false; }
  };
}

/* ② 외우기 — 헷갈린 카드는 알 때까지 다시 나와요 */
function vMemo(unitId, items, practice = false) {
  const M = { q: shuffle(items), known: new Set(), firstKnown: 0, seen: new Set(), flip: false, n: items.length };
  const draw = () => {
    if (!M.q.length) return finish();
    const it = M.q[0];
    shell(`${vTop(unitId, 'memorize', M.known.size, M.n)}
      <div class="card fcard tap" id="fc">
        <div class="fc-word">${esc(it.word)} ${vSpk(it.word)}</div>
        ${M.flip ? `<div class="fc-mean">${esc(it.meaning)}</div>${it.phrase ? `<div class="fc-box"><b>${esc(it.phrase)}</b><div>${esc(it.phrase_ko)}</div></div>` : ''}` : '<div class="fc-hint">뜻이 떠오르면 카드를 눌러 확인해요</div>'}
      </div>
      ${M.flip ? `<div class="row vtwo"><button class="btn ghost big" id="no">🤔 헷갈려요</button><button class="btn big" id="yes">😊 알아요</button></div>` : '<button class="btn big" id="show" style="width:100%">뜻 보기</button>'}`);
    vBack(unitId); vBindSpk();
    const flip = () => { if (!M.flip) { M.flip = true; draw(); } };
    $('#fc').onclick = flip; if ($('#show')) $('#show').onclick = flip;
    if ($('#yes')) $('#yes').onclick = () => { if (!M.seen.has(it.id)) M.firstKnown++; M.seen.add(it.id); M.known.add(it.id); M.q.shift(); M.flip = false; draw(); };
    if ($('#no')) $('#no').onclick = () => { M.seen.add(it.id); M.q.shift(); M.q.splice(Math.min(3, M.q.length), 0, it); M.flip = false; draw(); };
  };
  const finish = async () => {
    if (practice) {   // 테스트에서 틀린 단어만 다시 외운 경우: 기록은 바꾸지 않고 바로 재시험으로
      shell(`<div class="card vend"><div class="vend-ic">🧠</div><h2>틀린 단어 다시 외우기 끝!</h2><p>이제 다시 테스트해 볼까요?</p>
        <div class="row" style="justify-content:center"><button class="btn" id="again">다시 테스트</button><button class="btn ghost" id="uh">유닛으로</button></div></div>`);
      $('#again').onclick = () => vStartStep(unitId, 'test'); $('#uh').onclick = () => vUnitHome(unitId);
      return;
    }
    if (await vStepDone(unitId, 'memorize', M.firstKnown, M.n)) vStepEnd(unitId, 'memorize', `<p>처음부터 알았던 단어 <b>${M.firstKnown}</b> / ${M.n}개. 헷갈린 단어도 다 외웠어요!</p>`);
  };
  draw();
}

/* 문제 공통: 보기 만들기 (같은 유닛에서, 모자라면 같은 단어장에서) */
function vChoices(it, items, dir) {
  const key = dir === 'ko' ? 'meaning' : 'word', other = dir === 'ko' ? 'word' : 'meaning';
  const u = vUnit(it.unit_id);
  const same = x => vNorm(x[key]) === vNorm(it[key]) || vNorm(x[other]) === vNorm(it[other]);
  let pool = items.filter(x => x.id !== it.id && !same(x));
  if (pool.length < 3 && u) pool = pool.concat(VS.items.filter(x => x.id !== it.id && vUnit(x.unit_id) && vUnit(x.unit_id).book_id === u.book_id && !same(x) && !pool.includes(x)));
  const seen = new Set([vNorm(it[key])]), pick = [];
  for (const x of shuffle(pool)) { const k = vNorm(x[key]); if (!seen.has(k)) { seen.add(k); pick.push(x[key]); } if (pick.length >= 3) break; }
  return shuffle([it[key], ...pick]);
}
async function vSend(it, step, dir, answer, runId, cid) {
  const { data, error } = await S.sb.rpc('vocab_submit', { p_client: cid, p_item: it.id, p_step: step, p_dir: dir, p_answer: answer, p_run: runId || null });
  if (error) throw error;
  if ((step === 'test' || step === 'review') && data && data.box) {
    const r = VS.srs.find(x => x.item_id === it.id);
    if (r) { r.box = data.box; r.due_on = data.due_on; } else VS.srs.push({ item_id: it.id, box: data.box, due_on: data.due_on });
  }
  VS.days.add(kstToday());
  return data;
}
function vHintMask(word) { return String(word).split(' ').map(w => w ? w[0] + w.slice(1).replace(/[A-Za-z]/g, '_') : w).join(' '); }

/* 문제 진행기: 뜻 고르기 · 철자 쓰기 · 테스트 · 복습이 함께 써요 */
function vQuiz(opt) {
  // opt: {unitId, step, list:[{it, dir, mode:'choice'|'type'}], requeue, hint, onEnd(results), title, back}
  const Q = { list: opt.list.slice(), i: 0, res: new Map(), sel: null, out: null, busy: false, cid: null, retype: false, total: opt.list.length, done: 0, runId: opt.runId };
  const items = opt.items || [];
  const draw = () => {
    if (Q.i >= Q.list.length) return opt.onEnd(Q.res);
    const x = Q.list[Q.i], it = x.it;
    const ask = x.dir === 'ko' ? `<div class="fc-word sm">${esc(it.word)} ${vSpk(it.word)}</div><div class="tiny">알맞은 뜻을 고르세요</div>`
      : `<div class="fc-mean big">${esc(it.meaning)}</div><div class="tiny">${x.mode === 'type' ? '영어로 써 보세요' : '알맞은 영어를 고르세요'}</div>`;
    let body = ask;
    if (x.mode === 'choice') {
      x.ch = x.ch || vChoices(it, items, x.dir);
      body += x.ch.map(c => {
        let cls = '';
        if (Q.out) { if (vNorm(c) === vNorm(x.dir === 'ko' ? it.meaning : it.word)) cls = 'right'; else if (c === Q.sel) cls = 'wrong'; }
        return `<button class="choice ${cls}" data-c="${esc(c)}" ${Q.out ? 'disabled' : ''}>${esc(c)}</button>`;
      }).join('');
    } else {
      const hint = opt.hint ? `<div class="vmask">${esc(vHintMask(it.word))}</div>` : '';
      body += `${hint}<input type="text" id="ans" class="vin" placeholder="${Q.retype ? '정답을 따라 써 보세요' : '영어로 입력'}" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ${Q.out && !Q.retype ? 'disabled' : ''}>`;
    }
    if (Q.out) {
      const right = x.dir === 'ko' ? it.meaning : it.word;
      body += Q.out.is_correct ? `<div class="result ok"><b>정답! 👏</b> ${esc(it.word)} = ${esc(it.meaning)}</div>`
        : `<div class="result bad"><b>정답: ${esc(right)}</b>${x.dir === 'en' ? ` ${vSpk(it.word)}` : ''}${x.mode === 'type' && x.dir === 'en' && typeof gDiff === 'function' ? gDiff(Q.sel, it.word) + (it.spell_note ? `<div class="tiny">✏️ ${esc(it.spell_note)}</div>` : '') : ''}${it.phrase ? `<div class="tiny">기억 표현: ${esc(it.phrase)} (${esc(it.phrase_ko)})</div>` : ''}${Q.retype ? '<div class="tiny">아래 칸에 정답을 한 번 따라 써 보세요.</div>' : ''}</div>`;
    }
    const willAgain = Q.out && !Q.out.is_correct && opt.requeue && !x.again;
    const btn = Q.out ? (Q.retype ? '' : `<button class="btn" id="nx" style="width:100%">${Q.i < Q.list.length - 1 || willAgain ? '다음' : '마치기'}</button>`)
      : x.mode === 'type' ? '<button class="btn" id="go" style="width:100%">확인</button>' : '';
    shell(`${opt.unitId ? vTop(opt.unitId, opt.step, Q.done, Q.total) : `<p><a href="#" id="back">← 어휘 홈</a></p><div class="row between"><b>🔁 오늘의 복습</b><span class="tiny">${Q.done} / ${Q.total}</span></div><div class="progress" style="margin:8px 0 14px"><i style="width:${Q.done / Q.total * 100}%"></i></div>`}
      <div class="card vq">${body}</div>${btn}`);
    vBack(opt.unitId); vBindSpk();
    document.querySelectorAll('.choice').forEach(b => b.onclick = () => submit(b.dataset.c));
    const inp = $('#ans');
    if (inp) {
      inp.focus();
      inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); Q.retype ? retype(inp.value) : submit(inp.value); } };
      if (Q.retype) inp.oninput = () => { if (vNorm(inp.value) === vNorm(it.word)) retype(inp.value); };
    }
    if ($('#go')) $('#go').onclick = () => submit(inp.value);
    if ($('#nx')) $('#nx').onclick = next;
    if (Q.out && Q.out.is_correct && x.dir === 'en') TTS.say(it.word);
  };
  const submit = async ans => {
    if (Q.busy || Q.out) return;
    const x = Q.list[Q.i];
    if (!String(ans || '').trim()) return toast('답을 먼저 적어 주세요');
    Q.busy = true; Q.sel = ans;
    if (!Q.cid) Q.cid = uuid();
    try {
      const r = await vSend(x.it, opt.step, x.dir, ans, Q.runId, Q.cid);
      Q.out = r; Q.cid = null; Q.busy = false;
      if (!Q.res.has(x.it.id)) Q.res.set(x.it.id, { it: x.it, ok: r.is_correct, ans });
      if (!r.is_correct && x.mode === 'type' && opt.step !== 'test') Q.retype = true;
      if (r.is_correct || !opt.requeue || x.again) Q.done++;
      draw();
    } catch (e) { Q.busy = false; toast(errText(e), 4000); }
  };
  const retype = v => { const x = Q.list[Q.i]; if (vNorm(v) === vNorm(x.it.word)) { Q.retype = false; toast(x.again ? '좋아요! 이제 기억해요' : '좋아요! 다음에 한 번 더 나와요'); next(); } else toast('정답과 똑같이 써 보세요'); };
  const next = () => {
    const x = Q.list[Q.i];
    if (Q.out && !Q.out.is_correct && opt.requeue && !x.again) Q.list.push({ ...x, again: true, ch: null });
    Q.i++; Q.out = null; Q.sel = null; Q.retype = false; draw();
  };
  draw();
}

/* ③ 뜻 고르기 — 영어→뜻, 뜻→영어를 번갈아 */
function vCheck(unitId, items) {
  const list = shuffle(items).map((it, k) => ({ it, dir: k % 2 ? 'en' : 'ko', mode: 'choice' }));
  vQuiz({ unitId, step: 'check', list, items, requeue: true, onEnd: async res => {
    const ok = [...res.values()].filter(r => r.ok).length;
    if (await vStepDone(unitId, 'check', ok, items.length)) vStepEnd(unitId, 'check', `<p>한 번에 맞힌 문제 <b>${ok}</b> / ${items.length}개</p>`);
  } });
}
/* ④ 철자 쓰기 — 틀리면 정답을 따라 쓰고, 끝에 한 번 더 */
function vWrite(unitId, items, prepped) {
  if (!prepped && typeof gSpellPrep === 'function' && GS.ok) return gSpellPrep(unitId, items, () => vWrite(unitId, items, true));
  const a = vAsgOfUnit(unitId);
  const list = shuffle(items).map(it => ({ it, dir: 'en', mode: 'type' }));
  vQuiz({ unitId, step: 'write', list, items, requeue: true, hint: vCfg(a).first_letter, onEnd: async res => {
    const ok = [...res.values()].filter(r => r.ok).length;
    if (await vStepDone(unitId, 'write', ok, items.length)) vStepEnd(unitId, 'write', `<p>한 번에 맞힌 철자 <b>${ok}</b> / ${items.length}개</p>`);
  } });
}

/* ⑤ 짝 맞추기 게임 — 6쌍씩, 틀리면 1초 벌점 */
function vMatch(unitId, items) {
  const rounds = [];
  const clash = (r, it) => r.some(x => vNorm(x.word) === vNorm(it.word) || vNorm(x.meaning) === vNorm(it.meaning));
  for (const it of shuffle(items)) {   // 같은 뜻·같은 철자 단어는 서로 다른 라운드로 나눠요
    let r = rounds.find(x => x.length < 6 && !clash(x, it));
    if (!r) { r = []; rounds.push(r); }
    r.push(it);
  }
  if (rounds.length > 1 && rounds[rounds.length - 1].length < 3) {
    const last = rounds.pop();
    for (const it of last) { const r = rounds.find(x => !clash(x, it)); if (r) r.push(it); else rounds.push([it]); }
  }
  const G = { r: 0, t0: Date.now(), pen: 0, sel: null, gone: new Set(), timer: null, miss: 0 };
  const best = vProg(unitId, 'match');
  const drawRound = () => {
    const set = rounds[G.r];
    const left = shuffle(set.map(it => ({ id: it.id, t: it.word, side: 'en' }))), right = shuffle(set.map(it => ({ id: it.id, t: it.meaning, side: 'ko' })));
    G.cards = { left, right };
    paint();
  };
  const paint = () => {
    const card = c => `<button class="mtile ${G.gone.has(c.side + c.id) ? 'gone' : ''} ${G.sel && G.sel.side === c.side && G.sel.id === c.id ? 'sel' : ''}" data-id="${c.id}" data-side="${c.side}" ${G.gone.has(c.side + c.id) ? 'disabled' : ''}>${esc(c.t)}</button>`;
    shell(`${vTop(unitId, 'match', G.r, rounds.length)}
      <div class="row between"><span class="badge">라운드 ${G.r + 1}/${rounds.length}</span><b id="clock" class="clock">0.0초</b>${best && best.best_ms ? `<span class="tiny">내 최고 ${(best.best_ms / 1000).toFixed(1)}초</span>` : ''}</div>
      <div class="mgrid"><div class="mcol">${G.cards.left.map(card).join('')}</div><div class="mcol">${G.cards.right.map(card).join('')}</div></div>`);
    vBack(unitId);
    document.querySelectorAll('.mtile').forEach(b => b.onclick = () => tap(b));
  };
  const tap = b => {
    const c = { id: b.dataset.id, side: b.dataset.side };
    if (!G.sel || G.sel.side === c.side) { G.sel = c; if (c.side === 'en') { const it = items.find(x => x.id === c.id); TTS.say(it.word, 1); } return paint(); }
    if (G.sel.id === c.id) {
      G.gone.add('en' + c.id); G.gone.add('ko' + c.id); G.sel = null;
      if (rounds[G.r].every(it => G.gone.has('en' + it.id))) {
        G.r++;
        if (G.r >= rounds.length) return finish();
        return setTimeout(drawRound, 250);
      }
      return paint();
    }
    G.pen += 1000; G.miss++; G.sel = null;
    b.classList.add('shake'); setTimeout(paint, 300);
  };
  const tick = () => { const el = $('#clock'); if (!el) { clearInterval(G.timer); return; } el.textContent = ((Date.now() - G.t0 + G.pen) / 1000).toFixed(1) + '초'; };
  G.timer = setInterval(tick, 100);
  const finish = async () => {
    clearInterval(G.timer);
    const ms = Date.now() - G.t0 + G.pen;
    const rec = !best || !best.best_ms || ms < best.best_ms;
    if (await vStepDone(unitId, 'match', items.length, items.length, ms)) vStepEnd(unitId, 'match', `<p class="clock big">${(ms / 1000).toFixed(1)}초</p>${rec ? '<p><b class="vred">🏆 내 최고 기록!</b></p>' : `<p class="muted">최고 기록 ${(best.best_ms / 1000).toFixed(1)}초 · 다시 도전해 봐요</p>`}${G.miss ? `<p class="tiny">틀린 짝 ${G.miss}번 (번마다 1초 추가)</p>` : ''}`);
  };
  drawRound();
}

/* ⑥ 유닛 테스트 — 단어마다 한 번만, 결과는 서버가 다시 계산해요 */
function vTest(unitId, items) {
  const a = vAsgOfUnit(unitId), cfg = vCfg(a), runId = uuid();
  const list = shuffle(items).map((it, k) => ({ it, dir: k % 3 === 2 ? 'ko' : 'en', mode: k % 3 === 2 ? 'choice' : 'type' }));
  vQuiz({ unitId, step: 'test', list, items, runId, requeue: false, hint: cfg.first_letter, onEnd: async res => {
    try {
      const { data, error } = await S.sb.rpc('vocab_finish_test', { p_unit: unitId, p_run: runId, p_time_sec: AT.stop() });
      if (error) throw error;
      let st = vStat(unitId);
      if (!st) { st = { unit_id: unitId, best_pct: 0, last_pct: 0, tests: 0, passed_at: null }; VS.ustat.push(st); }
      st.best_pct = Math.max(st.best_pct, data.pct); st.last_pct = data.pct; st.tests++; if (data.passed && !st.passed_at) st.passed_at = new Date().toISOString();
      const p = vProg(unitId, 'test'); if (p) { p.score = Math.max(p.score || 0, data.score); p.total = data.total; } else VS.prog.push({ unit_id: unitId, step: 'test', score: data.score, total: data.total });
      const wrong = [...res.values()].filter(r => !r.ok);
      shell(`<div class="card vend"><div class="vend-ic">${data.passed ? '🎉' : '💪'}</div>
        <h2>${data.passed ? '유닛 통과!' : '조금만 더!'}</h2>
        <p class="clock big">${data.pct}%</p><p class="muted">${data.score} / ${data.total}개 정답 · 통과 기준 ${data.pass_pct}%</p>
        ${data.first_pass ? '<p>⭐ 별 2개를 받았어요!</p>' : ''}
        ${wrong.length ? `<div class="wlist"><div class="tiny">틀린 단어 (내일 복습에 나와요)</div>${wrong.map(w => `<div class="wrow"><b>${esc(w.it.word)}</b> ${vSpk(w.it.word)}<span>${esc(w.it.meaning)}</span><span class="tiny">내 답: ${esc(w.ans)}</span></div>`).join('')}</div>` : ''}
        <div class="row" style="justify-content:center;margin-top:12px">
          ${data.passed ? '<button class="btn" id="home">어휘 홈으로</button>' : '<button class="btn" id="re">틀린 단어 다시 외우기</button><button class="btn ghost" id="again">다시 테스트</button>'}
          <button class="btn ghost" id="uh">유닛으로</button></div></div>`);
      vBindSpk();
      if ($('#home')) $('#home').onclick = () => vocabHome();
      if ($('#re')) $('#re').onclick = () => { AT.start(); vMemo(unitId, wrong.map(w => w.it), true); };
      if ($('#again')) $('#again').onclick = () => vStartStep(unitId, 'test');
      $('#uh').onclick = () => vUnitHome(unitId);
    } catch (e) { toast(errText(e), 4000); vUnitHome(unitId); }
  } });
}

/* ---------- 오늘의 복습 ---------- */
function vReviewStart() {
  const cfg = VS.asg.map(vCfg).reduce((m, c) => (c.review_cap > m.review_cap ? c : m), vCfg(VS.asg[0]));
  cfg.first_letter = VS.asg.some(a => vCfg(a).first_letter);
  const due = vDue().slice(0, cfg.review_cap);
  const byId = new Map(VS.items.map(i => [i.id, i]));
  const list = due.map(r => byId.get(r.item_id)).filter(Boolean).map(it => ({ it, dir: 'en', mode: 'type' }));
  if (!list.length) return vocabHome();
  AT.start();
  const runId = uuid();
  vQuiz({ unitId: null, step: 'review', list, items: VS.items, runId, requeue: true, hint: cfg.first_letter, onEnd: async res => {
    const n = res.size, ok = [...res.values()].filter(r => r.ok).length;
    try { await S.sb.rpc('vocab_review_done', { p_run: runId, p_time_sec: AT.stop() }); } catch (e) { /* 기록은 답안마다 이미 저장됐어요 */ }
    const t = kstToday(); const lg = VS.rlog.find(r => r.day === t);
    if (lg) { lg.sessions++; lg.n += n; lg.correct += ok; } else VS.rlog.push({ day: t, sessions: 1, n, correct: ok });
    VS.days.add(t);
    const left = vDue().length;
    if (typeof loadGame === 'function') loadGame();
    shell(`<div class="card vend"><div class="vend-ic">🔁</div><h2>복습 끝!</h2>
      <p class="clock big">${ok} / ${n}</p><p class="muted">한 번에 맞힌 단어</p>
      <p class="tiny">맞힌 단어는 더 긴 간격 뒤에, 틀린 단어는 내일 다시 나와요.</p>${!left && typeof gOpen === 'function' && GS.ok ? '<p><b class="vgreen">🎮 오늘 복습 완료! 게임이 열렸어요</b></p>' : ''}
      <div class="row" style="justify-content:center;margin-top:12px">${left ? `<button class="btn" id="more">남은 복습 ${left}개 더 하기</button>` : ''}<button class="btn ${left ? 'ghost' : ''}" id="home">어휘 홈으로</button></div></div>`);
    if ($('#more')) $('#more').onclick = () => vReviewStart();
    $('#home').onclick = () => vocabHome();
  } });
}
