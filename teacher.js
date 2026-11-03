/* 심쿵영어 문법 학습 - 원장님 화면 */
'use strict';

const T = { students: [], asg: [], units: [], questions: [], attempts: [], notes: [], keys: {}, tab: 'today', ch: null, live: false, timer: null, poll: null, lastLoad: null };
// 단원 이름 앞에 교재·학년을 붙여 보여 줘요 (예: 동아(윤정미) 중3 · 5과 문법…)
function unitLabel(u) { return u ? (u.school_book ? u.school_book + ' · ' : '') + u.title : ''; }
const MIN_OVERALL = 5, MIN_STAGE = 3, MIN_TAG = 2;   // 이보다 적으면 "평가 자료 부족"
const TAB_ICON = {"today": "<rect x=\"3\" y=\"3\" width=\"7\" height=\"9\" rx=\"1.5\"/><rect x=\"14\" y=\"3\" width=\"7\" height=\"5\" rx=\"1.5\"/><rect x=\"14\" y=\"12\" width=\"7\" height=\"9\" rx=\"1.5\"/><rect x=\"3\" y=\"16\" width=\"7\" height=\"5\" rx=\"1.5\"/>", "review": "<path d=\"M9 12l2 2 4-4\"/><circle cx=\"12\" cy=\"12\" r=\"9\"/>", "assign": "<rect x=\"5\" y=\"4\" width=\"14\" height=\"17\" rx=\"2\"/><path d=\"M9 4h6v3H9zM9 12h6M9 16h4\"/>", "students": "<path d=\"M4 20V10M10 20V4M16 20v-7M22 20H2\"/>", "questions": "<path d=\"M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2zM4 19a2 2 0 012-2h13\"/>", "accounts": "<circle cx=\"9\" cy=\"8\" r=\"3.5\"/><path d=\"M2.5 20c0-3.600 2.900-6 6.500-6s6.500 2.400 6.500 6M16 4.500a3.500 3.500 0 010 7M18 14c2.200.6 3.500 2.600 3.500 6\"/>", "ai": "<path d=\"M12 3l1.800 5.200L19 10l-5.200 1.800L12 17l-1.800-5.200L5 10l5.200-1.800zM19 16l.8 2.200L22 19l-2.200.8L19 22l-.8-2.200L16 19l2.200-.8z\"/>", "settings": "<circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.400 15a1.700 1.700 0 00.3 1.800l.1.1a2 2 0 11-2.800 2.800l-.1-.1a1.700 1.700 0 00-1.800-.3 1.700 1.700 0 00-1 1.500V21a2 2 0 11-4 0v-.1a1.700 1.700 0 00-1.100-1.500 1.700 1.700 0 00-1.800.3l-.1.1a2 2 0 11-2.800-2.800l.1-.1a1.700 1.700 0 00.3-1.800 1.700 1.700 0 00-1.500-1H3a2 2 0 110-4h.1a1.700 1.700 0 001.500-1.100 1.700 1.700 0 00-.3-1.800l-.1-.1a2 2 0 112.800-2.800l.1.100a1.700 1.700 0 001.800.3H9a1.700 1.700 0 001-1.500V3a2 2 0 114 0v.1a1.700 1.700 0 001 1.500 1.700 1.700 0 001.800-.3l.1-.1a2 2 0 112.800 2.800l-.1.1a1.700 1.700 0 00-.3 1.800V9a1.700 1.700 0 001.500 1H21a2 2 0 110 4h-.1a1.700 1.700 0 00-1.500 1z\"/>"};
const tabIcon = k => `<svg class="ti" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${TAB_ICON[k] || ''}</svg>`;
const TABS = [['today', '오늘 현황'], ['review', '채점 대기'], ['assign', '과제 배정'], ['students', '학생·리포트'], ['questions', '문항 관리'], ['accounts', '학생 관리'], ['ai', 'AI 사용·설정'], ['settings', '설정·내보내기']];

async function loadTeacher() {
  const sb = S.sb;
  const [st, as, un, qs, at, nt, cv, kd, ac, bs] = await Promise.all([
    sb.from('profiles').select('*').eq('role', 'student').order('name'),
    sb.from('assignments').select('*').order('created_at'),
    sb.from('units').select('*').order('code'),
    (async () => { // 서버가 한 번에 1000행까지만 주므로 나눠서 모두 불러와요
      let all = [], from = 0;
      for (;;) {
        const r = await sb.from('questions').select('*').order('unit_id').order('stage').order('ord').range(from, from + 999);
        if (r.error) return r;
        all = all.concat(r.data); if (r.data.length < 1000) break; from += 1000;
      }
      return { data: all, error: null };
    })(),
    sb.from('attempts').select('*').order('submitted_at', { ascending: false }).range(0, 4999),
    sb.from('teacher_notes').select('*').order('created_at', { ascending: false }),
    sb.from('book_covers').select('*'),
    sb.from('app_settings').select('value').eq('key', 'book_kinds').maybeSingle(),
    sb.from('app_settings').select('value').eq('key', 'ai_config').maybeSingle(),
    sb.from('app_settings').select('value').eq('key', 'book_students').maybeSingle()
  ]);
  const err = st.error || as.error || un.error || qs.error || at.error || nt.error;
  if (err) throw err;
  T.students = st.data; T.asg = as.data; T.units = un.data; T.questions = qs.data; T.attempts = at.data; T.notes = nt.data;
  T.covers = Object.fromEntries(((cv && cv.data) || []).map(r => [r.school_book, r.cover]));   // 표 없으면 빈 값
  T.bookStu = (bs && bs.data && bs.data.value) || {};   // 교재별로 원장님이 넣어 둔 학생
  T.kinds = (kd && kd.data && kd.data.value) || {};   // 교재별 분류(내신대비/일반교재)
  T.autoFinal = !!(ac && ac.data && ac.data.value && ac.data.value.enabled && ac.data.value.auto_final);
  T.lastLoad = new Date();
  indexT();
}
function indexT() {
  T.qById = Object.fromEntries(T.questions.map(q => [q.id, q]));
  T.uById = Object.fromEntries(T.units.map(u => [u.id, u]));
  T.sById = Object.fromEntries(T.students.map(s => [s.id, s]));
  T.last = new Map(); T.byStu = new Map();
  for (const a of T.attempts) {
    const k = a.student_id + '|' + a.question_id + '|' + (a.round || 1), p = T.last.get(k);
    if (!p || a.attempt_no > p.attempt_no) T.last.set(k, a);
    if (!T.byStu.has(a.student_id)) T.byStu.set(a.student_id, []);
    T.byStu.get(a.student_id).push(a);
  }
}
async function loadKeys() {
  const { data, error } = await S.sb.from('question_keys').select('*');
  if (error) throw error;
  T.keys = Object.fromEntries(data.map(k => [k.question_id, k]));
}
function tStageQs(asg, stage) { return stageQsCore(T.questions, asg, stage); }
function tStage(asg, stage) {
  const cfg = cfgOf(asg), qs = tStageQs(asg, stage);
  let got = 0, max = 0, done = 0, waiting = 0, started = 0;
  for (const q of qs) {
    const a = T.last.get(asg.student_id + '|' + q.id + '|' + (asg.current_round || 1));
    max += Number(q.points);
    if (!a) continue;
    started++;
    if (a.status === 'needs_review') { waiting++; done++; continue; }
    if (a.is_correct || a.attempt_no >= 1 + cfg.max_retries) done++;
    got += Number(a.score || 0);
  }
  const finished = qs.length > 0 && done === qs.length;
  const p = pct(got, max);
  return { total: qs.length, done, waiting, started, pct: p, finished, passed: finished && !waiting && p !== null && p >= cfg.pass_pct, approved: qs.filter(q => q.review_status === 'approved').length };
}
// 학습 시간 (초) 합계. 시간이 기록된 풀이만 더해요 (기록 전 풀이는 '측정 안 됨')
function timeSum(list) { let sec = 0, n = 0; for (const a of list) if (a.time_spent_sec != null) { sec += a.time_spent_sec; n++; } return { sec, n, total: list.length }; }
function fmtDur(sec) {
  if (sec == null) return '-';
  if (sec < 60) return sec + '초';
  const m = Math.floor(sec / 60); if (m < 60) return m + '분 ' + (sec % 60) + '초';
  return Math.floor(m / 60) + '시간 ' + (m % 60) + '분';
}
function timeCell(list) { const t = timeSum(list); return t.n ? fmtDur(t.sec) + (t.n < t.total ? `<div class="tiny">(${t.total}건 중 ${t.n}건 측정)</div>` : '') : '<span class="muted">기록 없음</span>'; }
function roundBadge(a) { return (a.current_round || 1) > 1 ? ` <span class="badge">${a.current_round}회차</span>` : ''; }
function progressChips(sid) {
  return T.asg.filter(a => a.student_id === sid).map(a => {
    const u = T.uById[a.unit_id]; if (!u) return '';
    let cur = null, fail = false;
    for (const [k, n] of STAGES) {
      const sm = tStage(a, k); if (!sm.total) continue;
      if (sm.finished && !sm.passed && !sm.waiting) fail = true;
      if (!sm.finished && !cur) cur = { n, sm };
    }
    const label = cur ? `${cur.n} ${cur.sm.done}/${cur.sm.total}` : '모든 단계 완료';
    return `<span class="chip">${esc(u.lesson || u.code)}${u.title && u.title !== (u.lesson || u.code) ? ' ' + esc(u.title) : ''}${(a.current_round || 1) > 1 ? ' ' + a.current_round + '회차' : ''} · ${esc(label)}${fail ? ' ⚠' : ''}</span>`;
  }).join('') || '<span class="muted">배정 없음</span>';
}

/* ---------- 시작 · 껍데기 ---------- */
async function teacherStart() {
  shell('<p class="muted">불러오는 중…</p>');
  try { await loadTeacher(); } catch (e) { return shell(`<div class="result bad">${esc(errText(e))}</div>`); }
  drawTeacher();
  subscribeRealtime();
}
function drawTeacher() {
  shell(`<div class="tshell"><nav class="side noprint">${TABS.map(([k, n]) => `<button class="tab ${T.tab === k ? 'on' : ''}" data-t="${k}">${tabIcon(k)}<span class="tn">${n}</span>${k === 'review' ? reviewBadge() : ''}</button>`).join('')}</nav><div id="tb" class="tmain"></div></div>`,
    `<span class="live noprint"><i class="dot ${T.live ? 'on' : 'off'}" id="liveDot"></i><span id="liveTxt">${T.live ? '실시간 연결' : '연결 안 됨 · 30초마다 갱신'}</span></span>`);
  const w = $('#main'); if (w) w.classList.add('wide');
  document.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { T.tab = b.dataset.t; drawTeacher(); });
  renderTab();
}
function reviewBadge() { const n = T.attempts.filter(a => a.status === 'needs_review').length; return n ? ` <span class="badge bad">${n}</span>` : ''; }
function renderTab() {
  const f = { today: tabToday, review: tabReview, assign: tabAssign, students: tabStudents, questions: tabQuestions, videos: (typeof tabVideos === 'function' ? tabVideos : tabToday), accounts: tabAccounts, ai: tabAI, settings: tabSettings }[T.tab];
  Promise.resolve(f()).catch(e => { $('#tb').innerHTML = `<div class="result bad">${esc(errText(e))}</div>`; });
}
function setLive(on) {
  T.live = on;
  const d = $('#liveDot'), t = $('#liveTxt');
  if (d) d.className = 'dot ' + (on ? 'on' : 'off');
  if (t) t.textContent = on ? '실시간 연결' : '연결 안 됨 · 30초마다 갱신';
}
function subscribeRealtime() {
  if (T.ch) return;
  T.ch = S.sb.channel('attempts-live')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'attempts' }, p => { try { if (p && (p.eventType === 'INSERT' || (p.eventType === 'UPDATE' && p.new && p.new.appeal_at))) alertOnReview(p.new); } catch (e) { /* 알림 실패는 무시 */ } refreshSoon(); })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'assignments' }, () => refreshSoon())
    .subscribe(status => setLive(status === 'SUBSCRIBED'));
  T.poll = setInterval(refreshSoon, 30000);   // 실시간이 끊겨도 30초마다 새로 읽어요
}
function refreshSoon() {
  clearTimeout(T.timer);
  T.timer = setTimeout(async () => {
    if (document.querySelector('.modal-bg') || ['assign', 'questions', 'videos', 'accounts', 'ai', 'settings'].includes(T.tab)) return;
    if (T.tab === 'students' && T.view) return;          // 리포트·상세를 보는 중이면 방해하지 않아요
    if (document.activeElement && ['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName)) return;
    try { await loadTeacher(); drawTeacher(); } catch (e) { /* 다음 번에 다시 시도 */ }
  }, 600);
}
function modal(html) {
  const bg = document.createElement('div'); bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal">${html}</div>`;
  bg.addEventListener('mousedown', e => { if (e.target === bg) bg.remove(); });
  document.body.appendChild(bg); return bg;
}

/* ---------- 오늘 현황 ---------- */
function progressRows(sid) {
  const rows = T.asg.filter(a => a.student_id === sid).map(a => {
    const u = T.uById[a.unit_id]; if (!u) return '';
    let cur = null, fail = false;
    for (const [k, n] of STAGES) {
      const sm = tStage(a, k); if (!sm.total) continue;
      if (sm.finished && !sm.passed && !sm.waiting) fail = true;
      if (!sm.finished && !cur) cur = { n, sm };
    }
    const done = !cur, p = cur ? Math.round(cur.sm.done / cur.sm.total * 100) : 100;
    const title = esc(u.lesson || u.code) + ((a.current_round || 1) > 1 ? ` · ${a.current_round}회차` : '');
    const nm = u.title && u.title !== (u.lesson || u.code) ? `<em class="uname">${esc(u.title)}</em>` : '';
    return `<div class="prow"><div class="ph"><div class="phl"><b>${title}</b>${nm}</div><span class="${done ? 'ok' : ''}">${done ? '모든 단계 완료' : esc(cur.n) + ' ' + cur.sm.done + '/' + cur.sm.total}${fail ? ' <i class="wn">⚠ 기준 미달</i>' : ''}</span></div><div class="pbar"><i class="${done ? 'ok' : ''}" style="width:${p}%"></i></div></div>`;
  }).join('');
  return rows || '<div class="prow none">배정된 단원이 없어요</div>';
}
function tabToday() {
  const today = dayKey(new Date());
  const f = T.todayFilter || 'all';
  const info = T.students.map(s => {
    const at = T.byStu.get(s.id) || [];
    const td = at.filter(a => dayKey(a.submitted_at) === today);
    const g = td.filter(a => a.status === 'graded');
    const pend = at.filter(a => a.status === 'needs_review').length;
    return { s, at, td, g, pend, last: at[0], acc: g.length ? pct(g.filter(a => a.is_correct).length, g.length) : null };
  });
  const subTotal = info.reduce((n, i) => n + i.td.length, 0);
  const gAll = info.reduce((n, i) => n + i.g.length, 0), cAll = info.reduce((n, i) => n + i.g.filter(a => a.is_correct).length, 0);
  const accAll = gAll ? pct(cAll, gAll) : null;
  const pendAll = T.attempts.filter(a => a.status === 'needs_review').length;
  const active = info.filter(i => i.td.length).length;
  const wd = '일월화수목금토'[new Date().getDay()], d = new Date();
  const list = info.filter(i => f === 'on' ? i.td.length : f === 'off' ? !i.td.length : f === 'pend' ? i.pend : true)
    .sort((a, b) => (b.td.length - a.td.length) || a.s.name.localeCompare(b.s.name, 'ko'));
  const accCls = v => v == null ? '' : v >= 80 ? 'ok' : v >= 60 ? 'mid' : 'low';
  const cards = list.map(i => `<article class="scard ${i.td.length ? 'on' : ''}">
      <div class="sh"><div class="av">${esc(String(i.s.name).slice(0, 1))}</div>
        <div class="sn"><b>${esc(i.s.name)}</b><span>${esc(i.s.grade)}</span></div>
        <span class="st ${i.td.length ? 'on' : ''}">${i.td.length ? '오늘 학습함' : '오늘 학습 없음'}</span></div>
      <div class="sm">
        <div><small>오늘 제출</small><b>${i.td.length}<em>회</em></b></div>
        <div><small>학습 시간</small><b class="t">${i.td.length ? timeCell(i.td) : '-'}</b></div>
        <div><small>정답률</small><b class="${accCls(i.acc)}">${i.acc == null ? '-' : i.acc + '<em>%</em>'}</b></div>
      </div>
      <div class="sprog">${progressRows(i.s.id)}</div>
      <div class="sf"><span>마지막 제출 ${i.last ? fmtDT(i.last.submitted_at) : '없음'}</span>${i.pend ? `<span class="badge bad">채점 대기 ${i.pend}</span>` : ''}</div>
    </article>`).join('');
  const seg = (k, n, c) => `<button class="seg ${f === k ? 'on' : ''}" data-f="${k}">${n}<em>${c}</em></button>`;
  $('#tb').innerHTML = `
    <section class="hero"><div><small>${d.getMonth() + 1}월 ${d.getDate()}일 ${wd}요일</small><h1>오늘 현황</h1>
      <p>${active ? `오늘 ${active}명이 ${subTotal}번 제출했어요.` : '오늘은 아직 제출한 학생이 없어요.'}${pendAll ? ` 채점이 필요한 답안이 ${pendAll}건 있어요.` : ''}</p></div>
      <div class="upd">마지막 새로고침<br><b>${fmtDT(T.lastLoad)}</b></div></section>
    <section class="kpis">
      <div class="kpi"><small>오늘 제출</small><b>${subTotal}<em>회</em></b><span>${active}명 학습</span></div>
      <div class="kpi"><small>오늘 평균 정답률</small><b class="${accCls(accAll)}">${accAll == null ? '-' : accAll + '<em>%</em>'}</b><span>채점 완료 ${gAll}문항 기준</span></div>
      <div class="kpi ${pendAll ? 'alert' : ''}"><small>채점 대기</small><b>${pendAll}<em>건</em></b><span>${pendAll ? '확인이 필요해요' : '모두 처리했어요'}</span></div>
      <div class="kpi"><small>전체 학생</small><b>${T.students.length}<em>명</em></b><span>오늘 미학습 ${T.students.length - active}명</span></div>
    </section>
    <div class="segs">${seg('all', '전체', info.length)}${seg('on', '오늘 학습', active)}${seg('off', '미학습', info.length - active)}${seg('pend', '채점 대기', info.filter(i => i.pend).length)}</div>
    <section class="sgrid">${cards || '<div class="card muted">조건에 맞는 학생이 없어요.</div>'}</section>
    <details class="note"><summary>표시 기준 안내</summary><p>학습 시간은 학생이 문제 화면을 보며 실제로 풀이한 시간이에요. 3분 이상 아무 조작이 없거나 다른 화면을 본 시간은 빼고, 문제당 최대 30분까지만 세요. 이 기능을 적용하기 전의 풀이는 시간이 기록되지 않아요. 정답률은 오늘 제출 중 채점이 끝난 답안 기준이고, ⚠는 기준 점수에 못 미친 단계가 있다는 뜻이에요.</p></details>`;
  document.querySelectorAll('[data-f]').forEach(b => b.onclick = () => { T.todayFilter = b.dataset.f; tabToday(); });
}

/* ---------- 채점 대기 ---------- */
async function tabReview() {
  if (!Object.keys(T.keys).length) await loadKeys();
  const list = T.attempts.filter(a => a.status === 'needs_review').sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
  $('#tb').innerHTML = `<div class="card"><h2>채점 대기 (${list.length})</h2>
    <p class="muted">철자가 의심되거나 정답과 다르게 쓴 서술형 답안이에요. 점수와 한마디를 남기면 학생 화면에 바로 반영돼요.</p></div>` +
    (list.map(reviewCard).join('') || '<div class="card">확인할 답안이 없어요 👍</div>');
  document.querySelectorAll('[data-g]').forEach(b => b.onclick = () => gradeModal(b.dataset.g));
}
function reviewCard(a) {
  const q = T.qById[a.question_id] || {}, k = T.keys[a.question_id] || {}, s = T.sById[a.student_id] || {};
  return `<div class="card"><div class="row between"><div class="tiny">${a.appeal_at ? '🙋 <b>이의제기</b> · ' : ''}${esc(s.name)} · ${esc(unitLabel(T.uById[q.unit_id]))} · ${STAGE_NAME[q.stage] || ''} · ${a.attempt_no}번째 시도 · ${fmtDT(a.submitted_at)}</div>
    <button class="btn small" data-g="${a.id}">채점하기</button></div>
    <div class="q-prompt" style="margin-top:6px">${esc(q.prompt)}</div>${q.ko ? `<div class="q-ko">${esc(q.ko)}</div>` : ''}
    <p>학생 답: <b>${esc(a.answer)}</b></p>${a.ai_at ? `<p class="tiny">🤖 AI 임시 채점${a.ai_demo ? '(시연용)' : ''}: ${a.ai_score == null ? '점수 없음' : esc(a.ai_score) + '점'} — 학생에게 임시로 보여 준 상태예요. 채점하기에서 확정해 주세요.</p>` : ''}<p class="tiny">자동 판정 메모: ${esc(a.feedback)} · 인정 답안: ${(k.answers || []).map(esc).join(' / ')}</p></div>`;
}
function gradeModal(attemptId) {
  const a = T.attempts.find(x => x.id === attemptId); if (!a) return;
  const q = T.qById[a.question_id] || {}, k = T.keys[a.question_id] || {}, s = T.sById[a.student_id] || {};
  const max = Number(a.max_score);
  const m = modal(`<h2>채점 · ${esc(s.name)}</h2>
    <div class="q-prompt">${esc(q.prompt)}</div>${q.ko ? `<div class="q-ko">${esc(q.ko)}</div>` : ''}
    <p>학생 답: <b>${esc(a.answer)}</b></p>
    <p class="tiny">인정 답안: ${(k.answers || []).map(esc).join(' / ')}${k.rubric ? '<br>채점 기준: ' + esc(k.rubric) : ''}</p>
    <p class="tiny">현재: ${a.status === 'graded' ? `${a.score}/${max}점 (${a.graded_by === 'teacher' ? '원장님 채점' : '자동 채점'})` : '채점 대기'} · 도움: ${{ none: '없음', hint: '힌트', explanation: '해설' }[a.help_used]}</p>
    <div id="aisg" style="margin:8px 0"><button class="btn small ghost" id="gai" type="button">🤖 AI 채점 제안 받기</button>
      <span class="tiny">문제·정답·학생 답만 AI에게 보내요. 점수는 제안일 뿐, 최종 점수는 원장님이 정해요.</span></div>
    <div class="row" style="margin:8px 0"><button class="btn small ghost" data-q="${max}">정답 (${max})</button><button class="btn small ghost" data-q="${max / 2}">부분 점수 (${max / 2})</button><button class="btn small ghost" data-q="0">오답 (0)</button></div>
    <label>점수 (0 ~ ${max})</label><input type="number" id="gs" min="0" max="${max}" step="0.5" value="${a.score ?? ''}">
    <label>학생에게 보이는 한마디</label><textarea id="gf">${a.status === 'graded' ? esc(a.feedback) : ''}</textarea>
    <label>틀린 유형 (쉼표로 구분, 예: 철자, 시제)</label><input type="text" id="ge" value="${esc((a.error_types || []).join(', '))}">
    <div class="row" style="margin-top:14px"><button class="btn" id="gsave">저장</button><button class="btn ghost" id="gcancel">닫기</button></div>`);
  m.querySelectorAll('[data-q]').forEach(b => b.onclick = () => { $('#gs').value = b.dataset.q; });
  $('#gcancel').onclick = () => m.remove();
  $('#gai').onclick = async () => {
    const btn = $('#gai'); btn.disabled = true; btn.textContent = 'AI가 살펴보는 중…';
    try {
      const r = await invokeFn('ai-feedback', { action: 'suggest', attempt_id: a.id });
      if (!r.ok) { $('#aisg').innerHTML = `<div class="tiny">${esc(r.message || 'AI 제안을 받지 못했어요.')} 직접 채점해 주세요.</div>`; return; }
      const f = r.feedback || {};
      if (f.score != null) $('#gs').value = f.score;
      if (f.feedback) $('#gf').value = f.feedback;
      if (f.error_types && f.error_types.length) $('#ge').value = f.error_types.join(', ');
      $('#aisg').innerHTML = `<div class="aibox"><div class="tiny"><b>🤖 AI 제안</b> ${r.demo ? '<span class="badge warn">시연용</span> ' : ''}${f.score != null ? '아래 칸에 채워 두었어요. 확인하고 고쳐서 저장하세요.' : ''}</div>
        ${f.score != null ? `<p>제안 점수: <b>${esc(f.score)}</b> / ${max}점</p>` : ''}<p>${esc(f.reason || '')}</p></div>`;
    } catch (e) { $('#aisg').innerHTML = `<div class="tiny">${esc(errText(e))} 직접 채점해 주세요.</div>`; }
  };
  if (a.ai_at && !a.ai_demo) $('#gai').click();   // 학생에게 이미 보여 준 AI 임시 결과는 비용 없이 바로 불러와요
  $('#gsave').onclick = async () => {
    const sc = parseFloat($('#gs').value);
    if (isNaN(sc) || sc < 0 || sc > max) return toast('점수를 0 ~ ' + max + ' 사이로 넣어주세요');
    const errs = $('#ge').value.split(',').map(x => x.trim()).filter(Boolean);
    const { error } = await S.sb.rpc('teacher_grade', { p_attempt: a.id, p_score: sc, p_correct: sc >= max, p_feedback: $('#gf').value.trim(), p_errors: errs });
    if (error) return toast(errText(error), 4000);
    m.remove(); toast('저장했어요'); await loadTeacher(); drawTeacher();
  };
}


/* ---------- 교재 책장 (표지 → 단원) ---------- */
const BK_COL = ['#e8566c', '#14a37f', '#f08a24', '#7b5cd6', '#0f9bb5', '#c2477f'];
function bookCoverHtml(b) {
  const c = (T.covers || {})[b];
  if (c) return `<img alt="${esc(b)} 표지" src="${esc(c)}">`;
  let h = 0; for (const ch of b) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `<div class="bkph" style="background:${BK_COL[h % BK_COL.length]}"><span>${esc(b)}</span></div>`;
}
function resizeCover(file) {
  return new Promise((res, rej) => {
    const im = new Image(), url = URL.createObjectURL(file);
    im.onload = () => { const w = 240, h = Math.round(im.height * w / im.width), c = document.createElement('canvas'); c.width = w; c.height = h;
      c.getContext('2d').drawImage(im, 0, 0, w, h); URL.revokeObjectURL(url); res(c.toDataURL('image/jpeg', 0.82)); };
    im.onerror = () => rej(new Error('사진을 읽을 수 없어요'));
    im.src = url;
  });
}
async function saveCover(book, file) {
  const cover = await resizeCover(file);
  const { error } = await S.sb.from('book_covers').upsert({ school_book: book, cover, updated_at: new Date().toISOString() });
  if (error) throw error;
}
function bookRegModal(after) {
  const md = modal(`<h2>교재 등록</h2>
    <div class="grid2"><div><label>출판사·교재 (예: 쎄듀 천일문 그래머)</label><input type="text" id="brp"></div>
    <div><label>학년</label><select id="brg">${gradeOpts('')}</select></div></div>
    <label>표지 사진 (선택)</label><input type="file" id="brc" accept="image/*">
    <label>단원 목록 — 한 줄에 단원 하나</label>
    <textarea id="bru" rows="9" placeholder="예)\n1-1|be동사의 긍정문\n1-2|be동사의 부정문과 의문문\n(앞의 '1-1|'은 과 번호이고, 생략하고 단원 이름만 써도 돼요)"></textarea>
    <p class="tiny">단원 이름만 등록돼요. 개념·문제는 문항 관리에서 따로 만들고, 교재 본문은 넣지 않아요.</p>
    <div class="row" style="margin-top:14px"><button class="btn" id="brs">등록하기</button><button class="btn ghost" id="brx">닫기</button></div>`);
  $('#brx').onclick = () => md.remove();
  $('#brs').onclick = async () => {
    const pub = $('#brp').value.trim(), name = bookJoin(pub, $('#brg').value);
    const lines = $('#bru').value.split('\n').map(x => x.trim()).filter(Boolean);
    if (!pub || !lines.length) return toast('교재 이름과 단원을 입력해 주세요');
    const stamp = Date.now().toString(36);
    const rows = lines.map((l, i) => { const k = l.indexOf('|'), les = k >= 0 ? l.slice(0, k).trim() : '', title = (k >= 0 ? l.slice(k + 1) : l).trim();
      return { code: `B${stamp}-${String(i + 1).padStart(3, '0')}`, title, lesson: les, school_book: name, status: 'published' }; }).filter(r => r.title);
    $('#brs').disabled = true;
    try {
      const { error } = await S.sb.from('units').insert(rows); if (error) throw error;
      const f = $('#brc').files[0]; if (f) await saveCover(name, f);
      md.remove(); toast(`${rows.length}개 단원을 등록했어요`); await loadTeacher(); (after || tabAssign)();
    } catch (e) { $('#brs').disabled = false; toast(errText(e), 4000); }
  };
}

/* ---------- 과제 배정 ---------- */
function gradeRank(g) { const m = String(g || '').match(/(초|중|고)\s*(\d)/); return m ? { 초: 0, 중: 10, 고: 20 }[m[1]] + +m[2] : 99; }
function bookRank(b) { const m = String(b || '').match(/(초|중|고)\s*\d/); return gradeRank(m ? m[0] : ''); }
function unitSort(a, b) { return (parseInt(a.lesson) || 0) - (parseInt(b.lesson) || 0) || String(a.code).localeCompare(String(b.code)); }
const SLOTS = [['dialog-voca', '대화문 단어'], ['dialog', '대화문 학습'], ['reading-voca', '본문 단어'], ['reading', '본문 학습'], ['grammar1', '문법 ①'], ['grammar2', '문법 ②'], ['mock', '동형모고'], ['hit', '적중모고'], ['exam', '기출문제']];
function slotOf(u) { const c = String(u.code || ''); const m = /-(dialog-voca|reading-voca|dialog|reading|grammar1|grammar2|mock|hit|exam)$/.exec(c);
  if (m) return m[1]; if (/-A$/.test(c)) return 'grammar1'; if (/-B$/.test(c)) return 'grammar2'; if (/-grammar$/.test(c)) return 'grammar0'; return null; }
// 내신 교재: 과(단원) 안에서 9칸(대화문 단어·학습 / 본문 단어·학습 / 문법①② / 동형·적중모고 / 기출)으로 보여요
function lessonGrid(list, approvedN) {
  const g = new Map(); list.forEach(u => { const k = u.lesson || '기타'; if (!g.has(k)) g.set(k, []); g.get(k).push(u); });
  const keys = [...g.keys()].sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999) || a.localeCompare(b, 'ko'));
  return keys.map(k => { const us = g.get(k), by = {}, extra = [];
    us.forEach(u => { const sl = slotOf(u); if (sl && !by[sl]) by[sl] = u; else extra.push(u); });
    if (by.grammar0 && (by.grammar1 || by.grammar2)) delete by.grammar0;   // 예전 통합본은 목록에서 숨겨요(이미 배정한 학생의 기록은 그대로)
    const numeric = /^\d+/.test(k);
    const chip = (u, label) => { const n = approvedN(u);
      return `<label class="pick slot ${n ? '' : 'off'}" title="${esc(u.title)}"><input type="checkbox" name="au" value="${u.id}"><span>${esc(label)}</span><i class="tiny" data-st>${n ? '공개 ' + n : '승인 필요'}</i></label>`; };
    const cells = SLOTS.map(([sl, nm]) => by[sl] ? chip(by[sl], nm) : (numeric ? `<span class="pick slot off empty"><span>${nm}</span><i class="tiny">준비 중</i></span>` : '')).join('')
      + (by.grammar0 ? chip(by.grammar0, '문법(통합)') : '')
      + extra.map(u => chip(u, u.title)).join('');
    return `<div class="pgrp lgrp"><div class="pgh"><b>${esc(k)}</b><button class="btn small ghost" data-allbtn type="button">이 단원 전체 선택</button></div><div class="slotgrid">${cells}</div></div>`; }).join('');
}
const T_NAESIN_RE = /(동아|천재|비상|YBM|와이비엠|능률|지학|미래엔|금성|대교|두산|좋은책|교과서)/;
function bookKind(b) { const k = (T.kinds || {})[b]; return k === 'naesin' || k === 'general' ? k : (T_NAESIN_RE.test(b) ? 'naesin' : 'general'); }
async function setBookStudents(b, ids) {
  const v = { ...(T.bookStu || {}), [b]: ids };
  const { error } = await S.sb.from('app_settings').upsert({ key: 'book_students', value: v });
  if (error) throw error; T.bookStu = v;
}
async function setBookKind(b, kind) {
  const v = { ...(T.kinds || {}), [b]: kind };
  const { error } = await S.sb.from('app_settings').upsert({ key: 'book_kinds', value: v });
  if (error) throw error; T.kinds = v;
}
function tabAssign() {
  let mode = 'general'; try { mode = localStorage.getItem('asgMode') === 'naesin' ? 'naesin' : 'general'; } catch (e) {}
  const MODE_NAME = { general: '일반 교재 학습', naesin: '내신 대비' };
  const approvedN = u => T.questions.filter(q => q.unit_id === u.id && q.review_status === 'approved').length;
  // 현황: 학생별로 묶어서 보여요
  const byStu = new Map();
  const kindOfAsg = a => { const u = T.uById[a.unit_id]; return bookKind(u && u.school_book || '교재 미정'); };
  const otherN = T.asg.filter(a => kindOfAsg(a) !== mode).length;
  T.asg.filter(a => kindOfAsg(a) === mode).forEach(a => { if (!byStu.has(a.student_id)) byStu.set(a.student_id, []); byStu.get(a.student_id).push(a); });
  const statusHtml = [...byStu].map(([sid, list]) => {
    const s = T.sById[sid];
    return `<details class="asg" open><summary><b>${esc(s ? s.name : '?')}</b> <span class="tiny">${esc(s && s.grade || '')} · 배정 ${list.length}개</span></summary>
      <div class="tablewrap"><table><tbody>${list.map(a => { const u = T.uById[a.unit_id], c = cfgOf(a);
        return `<tr><td>${esc(u ? unitLabel(u) : '?')}${roundBadge(a)}</td><td class="tiny" style="white-space:nowrap">마감 ${esc(a.due_date || '-')}</td>
          <td class="tiny">${stageLabel(a)}<br>단계 ${c.per_stage}문항 · 통과 ${c.pass_pct}% · 재시도 ${c.max_retries}회</td>
          <td style="text-align:right;white-space:nowrap"><button class="btn small ghost" data-stg="${a.id}">단계 바꾸기</button> <button class="btn small" data-round="${a.id}">다시 학습시키기 (${(a.current_round || 1) + 1}회차)</button> <button class="btn small ghost" data-del="${a.id}">삭제</button></td></tr>`; }).join('')}</tbody></table></div></details>`;
  }).join('') || `<p class="muted">${MODE_NAME[mode]} 과제가 아직 없어요</p>`;
  // 학생: 학년별로 묶기
  const gs = new Map();
  T.students.forEach(s => { const g = s.grade || '학년 미정'; if (!gs.has(g)) gs.set(g, []); gs.get(g).push(s); });
  const stuHtml = [...gs].sort((x, y) => gradeRank(x[0]) - gradeRank(y[0]) || x[0].localeCompare(y[0])).map(([g, list]) => `<div class="pgrp"><div class="pgh"><b>${esc(g)}</b><button class="btn small ghost" data-allbtn type="button">전체 선택</button></div>
    <div class="picks">${list.map(s => `<label class="pick"><input type="checkbox" name="as" value="${s.id}"><span>${esc(s.name)}</span></label>`).join('')}</div></div>`).join('') || '<p class="muted">학생이 없어요</p>';
  // 단원: 교재 책장(표지) → 누르면 단원
  const bk = new Map();
  T.units.forEach(u => { const k = u.school_book || '교재 미정'; if (!bk.has(k)) bk.set(k, []); bk.get(k).push(u); });
  Object.keys(T.covers || {}).forEach(k => { if (!bk.has(k)) bk.set(k, []); });
  const books = [...bk.keys()].filter(b => bookKind(b) === mode).sort((x, y) => bookRank(x) - bookRank(y) || x.localeCompare(y, 'ko'));
  const unitHtml = `<div class="bkshelf">${books.map((b, i) => `<button type="button" class="bkc" data-sh="${i}"><div class="bki">${bookCoverHtml(b)}</div><div class="bkn">${esc(b)}</div><div class="tiny">단원 ${bk.get(b).length}개<b class="bkcnt" data-cnt="${i}"></b></div></button>`).join('')}</div>` +
    books.map((b, i) => { const list = bk.get(b).slice().sort(unitSort); return `<div class="pgrp upanel" data-pn="${i}" hidden><div class="pgh"><b>${esc(b)}</b><span><label class="btn small ghost" style="cursor:pointer">표지 바꾸기<input type="file" accept="image/*" hidden data-cv="${i}"></label> <button class="btn small ghost" data-kind="${i}" type="button">${mode === 'naesin' ? '일반 교재로 옮기기' : '내신 대비로 옮기기'}</button> <button class="btn small ghost" data-allbtn type="button">전체 선택</button></span></div>
      ${mode === 'naesin' ? lessonGrid(list, approvedN) : `<div class="picks col">${list.map(u => { const n = approvedN(u);
        return `<label class="pick wide ${n ? '' : 'off'}"><input type="checkbox" name="au" value="${u.id}"><span>${u.lesson ? esc(u.lesson) + ' · ' : ''}${esc(u.title)}</span><i class="tiny">${n ? '공개 ' + n : '공개 0 · 승인 필요'}</i></label>`; }).join('') || '<p class="muted">단원이 없어요</p>'}</div>`}</div>`; }).join('') +
    (books.length ? '<p class="tiny">교재 표지를 누르면 단원이 나와요.</p>' : `<p class="muted">${MODE_NAME[mode]}에 등록된 교재가 없어요. 위의 "+ 교재 등록"으로 추가하거나, 다른 쪽 교재의 "분류 바꾸기"로 옮길 수 있어요.</p>`);
  const cntMode = k => T.units.filter(u => bookKind(u.school_book || '교재 미정') === k).length;
  $('#tb').innerHTML = `<div class="card"><h2>과제 배정</h2>
    <div class="modebar"><button type="button" class="mbtn ${mode === 'general' ? 'on' : ''}" data-mode="general">📘 일반 교재 학습 <em>단원 ${cntMode('general')}</em></button><button type="button" class="mbtn ${mode === 'naesin' ? 'on' : ''}" data-mode="naesin">📝 내신 대비 <em>단원 ${cntMode('naesin')}</em></button></div>
    <p class="tiny" style="margin:2px 0 10px">${mode === 'naesin' ? '학교 교과서(내신) 범위로 준비하는 과제예요.' : '천일문 같은 일반 문법 교재로 차근차근 학습하는 과제예요.'}</p>
    <div class="asgrid"><div><h3>① 학생 고르기</h3>${stuHtml}</div>
    <div><h3>② 교재·단원 고르기 <button class="btn small ghost" id="bkreg" type="button">+ 교재 등록</button></h3>${unitHtml}</div>
    <div><h3>③ 설정</h3><div class="setgrid">
      <div><label>마감일 (선택)</label><input type="date" id="ad"></div>
      <div><label>단계별 문항 수</label><input type="number" id="ap" min="1" max="20" value="5"></div>
      <div><label>통과 기준 (%)</label><input type="number" id="ac" min="1" max="100" value="80"></div>
      <div><label>다시 풀기 횟수</label><input type="number" id="ar" min="0" max="10" value="2"></div>
      <div><label>내신대비 문항 수</label><input type="number" id="ae" min="1" max="20" value="8"></div></div>
      <div style="margin-top:10px"><label>학습할 단계 <span class="tiny">(아이 실력에 맞게 골라요)</span></label>${stagePickHtml('ast', null)}</div>
      <div class="sumbar"><span id="asum">학생과 단원을 골라 주세요</span><button class="btn" id="asave">배정하기</button></div>
      <p class="tiny">이미 배정된 조합을 다시 배정하면 마감일·설정이 새 값으로 바뀌고, 풀이 기록은 그대로 남아요. 공개 문항이 0개인 단원은 문항 관리에서 먼저 승인해야 학생에게 보여요.</p></div></div></div>
    <div class="card"><h3>${MODE_NAME[mode]} 배정 현황 <span class="tiny">(학생별${otherN ? ` · 다른 쪽 ${otherN}건은 위 탭에서 보여요` : ''})</span></h3>${statusHtml}</div>`;
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { try { localStorage.setItem('asgMode', b.dataset.mode); } catch (e) {} tabAssign(); });
  document.querySelectorAll('[data-kind]').forEach(b => b.onclick = async () => { const bk2 = books[+b.dataset.kind]; const to = mode === 'naesin' ? 'general' : 'naesin';
    if (!confirm(`"${bk2}"를 ${MODE_NAME[to]} 쪽으로 옮길까요?`)) return;
    try { await setBookKind(bk2, to); toast(`${MODE_NAME[to]}으로 옮겼어요`); tabAssign(); } catch (e) { toast(errText(e), 4000); } });
  const had = new Set(T.asg.map(a => a.student_id + '|' + a.unit_id));
  const upSlots = () => { if (mode !== 'naesin') return; const sel = [...document.querySelectorAll('[name=as]:checked')].map(x => x.value);
    document.querySelectorAll('[name=au]').forEach(inp => { const lab = inp.closest('.slot'); if (!lab) return; const st = lab.querySelector('[data-st]');
      const n = sel.filter(sid => had.has(sid + '|' + inp.value)).length, full = sel.length > 0 && n === sel.length;
      if (full) inp.checked = false; inp.disabled = full; lab.classList.toggle('done', full);
      if (st) { if (!lab.dataset.base) lab.dataset.base = st.textContent; st.textContent = full ? '배정됨 ✓' : n ? `${n}/${sel.length}명 배정됨` : lab.dataset.base; } }); };
  const upSum = () => { upSlots();
    const sel = [...document.querySelectorAll('[name=as]:checked')].map(x => x.value), us = [...document.querySelectorAll('[name=au]:checked')].map(x => x.value);
    const skip = mode === 'naesin' ? sel.flatMap(a => us.map(u => a + '|' + u)).filter(k => had.has(k)).length : 0;
    $('#asum').innerHTML = sel.length && us.length ? `학생 <b>${sel.length}명</b> × 단원 <b>${us.length}개</b> = <b>${sel.length * us.length - skip}건</b> 배정${skip ? ` <span class="tiny">(이미 배정된 ${skip}건 제외)</span>` : ''}` : '학생과 단원을 골라 주세요';
    document.querySelectorAll('[data-pn]').forEach(p => { const n = p.querySelectorAll('[name=au]:checked').length, e = document.querySelector(`[data-cnt="${p.dataset.pn}"]`); if (e) e.textContent = n ? ` · ${n}개 선택` : ''; }); };
  document.querySelectorAll('[name=as],[name=au]').forEach(x => x.onchange = upSum);
  document.querySelectorAll('[data-sh]').forEach(c => c.onclick = () => { const i = c.dataset.sh;
    document.querySelectorAll('[data-pn]').forEach(p => p.hidden = p.dataset.pn !== i);
    document.querySelectorAll('[data-sh]').forEach(x => x.classList.toggle('on', x === c)); });
  document.querySelectorAll('[data-cv]').forEach(inp => inp.onchange = async () => { const f = inp.files[0]; if (!f) return;
    try { await saveCover(books[+inp.dataset.cv], f); toast('표지를 바꿨어요'); await loadTeacher(); tabAssign(); } catch (e) { toast(errText(e), 4000); } });
  $('#bkreg').onclick = () => bookRegModal(tabAssign);
  document.querySelectorAll('[data-allbtn]').forEach(b => b.onclick = () => {
    const boxes = [...b.closest('.pgrp').querySelectorAll('input[type=checkbox]')].filter(x => !x.disabled), all = boxes.every(x => x.checked);
    boxes.forEach(x => x.checked = !all); b.textContent = all ? '전체 선택' : '전체 해제'; upSum(); });
  $('#asave').onclick = async () => {
    const sids = [...document.querySelectorAll('[name=as]:checked')].map(x => x.value);
    const uids = [...document.querySelectorAll('[name=au]:checked')].map(x => x.value);
    if (!sids.length || !uids.length) return toast('학생과 단원을 하나 이상 골라 주세요');
    const num = (id, d) => { const v = parseInt($(id).value, 10); return isNaN(v) ? d : v; };
    const pickedSt = stagePicked('ast');
    if (!pickedSt.length) return toast('학습할 단계를 하나 이상 골라 주세요');
    const mk = u => { const sc = { exam: /-hit$/.test((T.uById[u] || {}).code || '') ? 200 : num('#ae', 8) }; STAGES.forEach(([k]) => { if (!pickedSt.includes(k)) sc[k] = 0; }); return { per_stage: num('#ap', 5), pass_pct: num('#ac', 80), max_retries: num('#ar', 2), stage_counts: sc }; };
    const rows = []; let skipped = 0;
    for (const s of sids) for (const u of uids) { if (mode === 'naesin' && had.has(s + '|' + u)) { skipped++; continue; } rows.push({ student_id: s, unit_id: u, due_date: $('#ad').value || null, settings: mk(u) }); }
    if (!rows.length) return toast('이미 모두 배정되어 있어요');
    const { error } = await S.sb.from('assignments').upsert(rows, { onConflict: 'student_id,unit_id' });
    if (error) return toast(errText(error), 4000);
    toast(`${rows.length}건 배정했어요${skipped ? ` (이미 배정된 ${skipped}건 제외)` : ''}`); await loadTeacher(); tabAssign();
  };
  document.querySelectorAll('[data-round]').forEach(b => b.onclick = () => relearnModal(b.dataset.round));
  document.querySelectorAll('[data-stg]').forEach(b => b.onclick = () => stageModal(b.dataset.stg));
  document.querySelectorAll('[data-del]').forEach(b => b.onclick = async () => {
    if (!confirm('이 배정을 삭제할까요?\n이 학생의 이 단원 풀이 기록도 함께 지워져요.')) return;
    if (!confirm('정말 삭제할까요? 되돌릴 수 없어요.')) return;
    const { error } = await S.sb.from('assignments').delete().eq('id', b.dataset.del);
    if (error) return toast(errText(error));
    await loadTeacher(); drawTeacher();
  });
  naesinMatrix(approvedN, mode);
}

// ───────── 내신 대비 배정: 한 화면 표(칸 × 학생) ─────────
function naesinMatrix(approvedN, mode) {
  const NAE = mode === 'naesin';
  const card = $('#tb').firstElementChild; if (!card) return;
  const books = [...new Set(T.units.map(u => u.school_book || '교재 미정'))].filter(b => bookKind(b) === mode).sort((x, y) => bookRank(x) - bookRank(y) || x.localeCompare(y, 'ko'));
  const M = (T.mx = T.mx || {})[mode] = (T.mx || {})[mode] || { book: null, lesson: null, sel: new Set(), all: false };
  if (!books.includes(M.book)) { M.book = null; M.lesson = null; }
  const membersOf = b => new Set([...((T.bookStu || {})[b] || []), ...T.asg.filter(a => { const u = T.uById[a.unit_id]; return u && (u.school_book || '교재 미정') === b; }).map(a => a.student_id)]);
  const had = new Set(T.asg.map(a => a.student_id + '|' + a.unit_id));
  const draw = () => {
    const mem = M.book ? membersOf(M.book) : new Set();
    const stu = T.students.filter(s => mem.has(s.id)).sort((a, b) => String(a.name).localeCompare(String(b.name), 'ko'));
    const others = T.students.filter(s => !mem.has(s.id)).sort((a, b) => gradeRank(a.grade) - gradeRank(b.grade) || String(a.name).localeCompare(String(b.name), 'ko'));
    const usedBy = sid => T.asg.some(a => a.student_id === sid && (((T.uById[a.unit_id] || {}).school_book) || '교재 미정') === M.book);
    const us = T.units.filter(u => (u.school_book || '교재 미정') === M.book);
    const g = new Map(); us.forEach(u => { const sl = slotOf(u); if (!sl || sl === 'grammar0') return; const k = u.lesson || '기타'; if (!g.has(k)) g.set(k, {}); if (!g.get(k)[sl]) g.get(k)[sl] = u; });
    const lessons = [...g.keys()].sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999) || a.localeCompare(b, 'ko'));
    if (!lessons.includes(M.lesson)) M.lesson = lessons[0];
    const cur = g.get(M.lesson) || {}, numeric = /^\d+/.test(M.lesson || '');
    const rows = SLOTS.filter(([sl]) => cur[sl] || numeric);
    const glist = us.slice().sort(unitSort);
    const selIn = k => NAE ? [...M.sel].filter(x => { const u = T.uById[x.split('|')[1]]; return u && (u.school_book || '교재 미정') === M.book && (u.lesson || '기타') === k; }).length : 0;
    const book$ = `<div class="bkshelf">${books.map(b => `<button type="button" class="bkc ${b === M.book ? 'on' : ''}" data-mb="${esc(b)}"><div class="bki">${bookCoverHtml(b)}</div><div class="bkn">${esc(b)}</div><div class="tiny">학생 ${membersOf(b).size}명</div></button>`).join('')}</div>`;
    const les$ = lessons.map(k => { const n = selIn(k); return `<button type="button" class="mxp ${k === M.lesson ? 'on' : ''}" data-ml="${esc(k)}">${esc(k)}${n ? ` <b class="mxn">${n}</b>` : ''}</button>`; }).join('');
    const head = stu.map(s => `<th><button type="button" class="mxh" data-cs="${s.id}" title="이 학생 이 단원 전부 선택">${esc(s.name)}</button>${usedBy(s.id) ? '' : `<button type="button" class="mxx" data-rm="${s.id}" title="이 교재에서 빼기">✕</button>`}</th>`).join('');
    const gbody = glist.map(u => { const n = approvedN(u);
      return `<tr><th class="mxl"><button type="button" class="mxh" data-ru="${u.id}" title="이 단원 전체 학생 선택">${u.lesson ? esc(u.lesson) + ' · ' : ''}${esc(u.title)}</button><span class="tiny">${n ? n + '문항' : '승인 필요'}</span></th>${stu.map(s => { const k = s.id + '|' + u.id;
        return had.has(k) ? '<td class="mxc done">✓ 배정됨</td>' : `<td class="mxc ${M.sel.has(k) ? 'on' : ''} ${n ? '' : 'off'}" data-k="${k}">${M.sel.has(k) ? '✔ 선택' : ''}</td>`; }).join('')}</tr>`; }).join('');
    const body = NAE ? rows.map(([sl, nm]) => { const u = cur[sl];
      if (!u) return `<tr class="mxe"><th class="mxl">${nm}</th>${stu.map(() => '<td class="mxc na">준비 중</td>').join('')}</tr>`;
      const n = approvedN(u);
      return `<tr><th class="mxl"><button type="button" class="mxh" data-ru="${u.id}" title="이 칸 전체 학생 선택">${nm}</button><span class="tiny">${n ? n + '문항' : '승인 필요'}</span></th>${stu.map(s => { const k = s.id + '|' + u.id;
        return had.has(k) ? '<td class="mxc done">✓ 배정됨</td>' : `<td class="mxc ${M.sel.has(k) ? 'on' : ''} ${n ? '' : 'off'}" data-k="${k}">${M.sel.has(k) ? '✔ 선택' : ''}</td>`; }).join('')}</tr>`; }).join('') : gbody;
    const addUi = M.book ? `<div class="row" style="gap:6px;margin:8px 0;flex-wrap:wrap"><b class="tiny">이 교재로 공부하는 학생</b><select id="mxadd" style="max-width:220px"><option value="">+ 학생 넣기…</option>${others.map(s => `<option value="${s.id}">${esc(s.name)} (${esc(s.grade || '학년 미정')})</option>`).join('')}</select><button type="button" class="btn small" id="mxaddb">넣기</button></div>` : '';
    $('#mxbody').innerHTML = `${book$}${M.book ? `${NAE ? `<div class="mxbar">${les$}</div>` : ''}${addUi}
      ${stu.length ? `<div class="${NAE ? 'tablewrap' : 'mxscroll'}"><table class="mxt"><thead><tr><th class="mxcorner"></th>${head}</tr></thead><tbody>${body}</tbody></table></div>` : '<p class="muted">아직 이 교재로 공부하는 학생이 없어요. 위에서 학생을 넣어 주세요.</p>'}` : '<p class="tiny">교재 표지를 누르면 배정표가 열려요.</p>'}`;
    const n = M.sel.size, per = {}; M.sel.forEach(k => { const u = T.uById[k.split('|')[1]]; const l = u ? (u.lesson || '기타') : '?'; per[l] = (per[l] || 0) + 1; });
    $('#mxsum').innerHTML = n ? `<b>${n}건</b> 선택 ${NAE ? `<span class="tiny">(${Object.entries(per).map(([l, c]) => l + ' ' + c).join(' · ')})</span>` : ''}` : '칸을 눌러 배정할 학생·내용을 골라 주세요';
    $('#asave').disabled = !n; $('#mxclr').hidden = !n;
    document.querySelectorAll('[data-mb]').forEach(b => b.onclick = () => { M.book = M.book === b.dataset.mb ? null : b.dataset.mb; M.lesson = null; draw(); });
    const ab = $('#mxaddb'); if (ab) ab.onclick = async () => { const id = $('#mxadd').value; if (!id) return toast('넣을 학생을 먼저 골라 주세요');
      try { await setBookStudents(M.book, [...new Set([...((T.bookStu || {})[M.book] || []), id])]); draw(); } catch (er) { toast(errText(er), 4000); } };
    document.querySelectorAll('[data-rm]').forEach(b => b.onclick = async () => { try { await setBookStudents(M.book, ((T.bookStu || {})[M.book] || []).filter(x => x !== b.dataset.rm)); [...M.sel].forEach(k => k.startsWith(b.dataset.rm + '|') && M.sel.delete(k)); draw(); } catch (er) { toast(errText(er), 4000); } });
    document.querySelectorAll('[data-ml]').forEach(b => b.onclick = () => { M.lesson = b.dataset.ml; draw(); });
    document.querySelectorAll('[data-k]').forEach(c => c.onclick = () => { const k = c.dataset.k; if (c.classList.contains('off')) return toast('공개 문항이 없는 단원이에요. 문항 관리에서 먼저 승인해 주세요'); M.sel.has(k) ? M.sel.delete(k) : M.sel.add(k); draw(); });
    const toggle = keys => { const all = keys.length && keys.every(k => M.sel.has(k)); keys.forEach(k => all ? M.sel.delete(k) : M.sel.add(k)); draw(); };
    const open = () => [...document.querySelectorAll('[data-k]:not(.off)')];
    document.querySelectorAll('[data-cs]').forEach(b => b.onclick = () => toggle(open().filter(c => c.dataset.k.startsWith(b.dataset.cs + '|')).map(c => c.dataset.k)));
    document.querySelectorAll('[data-ru]').forEach(b => b.onclick = () => toggle(open().filter(c => c.dataset.k.endsWith('|' + b.dataset.ru)).map(c => c.dataset.k)));
  };
  card.innerHTML = `<h2>과제 배정</h2>
    <div class="modebar"><button type="button" class="mbtn ${NAE ? '' : 'on'}" data-mode="general">📘 일반 교재 학습</button><button type="button" class="mbtn ${NAE ? 'on' : ''}" data-mode="naesin">📝 내신 대비</button></div>
    <p class="tiny" style="margin:2px 0 8px">${books.length ? '' : '등록된 교재가 없어요. 아래 "교재 관리"에서 교재를 등록하거나 분류를 옮겨 주세요.'}교재 표지를 눌러 표를 연 뒤, <b>칸을 눌러</b> 배정할 학생·내용을 고르세요. 학생 이름을 누르면 그 학생 전체, 왼쪽 이름을 누르면 그 ${NAE ? '칸' : '단원'} 전체가 선택돼요. <b>✓ 배정됨</b>은 이미 받은 거예요.</p>
    <div id="mxbody"></div>
    <div class="mxfoot"><span id="mxsum"></span><span class="row" style="gap:8px;flex-wrap:nowrap"><button class="btn small ghost" id="mxclr" type="button" hidden>선택 지우기</button><button class="btn" id="asave" disabled>배정하기</button></span></div>
    <details class="mxset"><summary>교재 관리 (등록 · 표지 · 분류 옮기기)</summary><div class="row" style="gap:8px;margin-top:8px"><button class="btn small ghost" id="mxreg" type="button">+ 교재 등록</button><label class="btn small ghost" style="cursor:pointer">표지 바꾸기<input type="file" accept="image/*" hidden id="mxcv"></label><button class="btn small ghost" id="mxkind" type="button">${NAE ? '일반 교재로 옮기기' : '내신 대비로 옮기기'}</button></div></details>
    <details class="mxset"><summary>설정 (마감일 · 문항 수 · 통과 기준)</summary><div class="setgrid">
      <div><label>마감일 (선택)</label><input type="date" id="ad"></div>
      <div><label>단계별 문항 수</label><input type="number" id="ap" min="1" max="20" value="5"></div>
      <div><label>통과 기준 (%)</label><input type="number" id="ac" min="1" max="100" value="80"></div>
      <div><label>다시 풀기 횟수</label><input type="number" id="ar" min="0" max="10" value="2"></div>
      <div><label>내신대비 문항 수</label><input type="number" id="ae" min="1" max="20" value="8"></div></div></details>
    <div class="mxset" style="padding:10px 12px;border:1px solid #e2e8f0;border-radius:12px;margin-top:8px"><b>학습할 단계</b> <span class="tiny">아이 실력에 맞게 골라요 (개념만 · 서술형만 · 내신대비만 등)</span>${stagePickHtml('ast', null)}</div>`;
  document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { try { localStorage.setItem('asgMode', b.dataset.mode); } catch (e) {} tabAssign(); });
  $('#mxreg').onclick = () => bookRegModal(tabAssign);
  $('#mxcv').onchange = async e => { const f = e.target.files[0]; if (!f || !M.book) return; try { await saveCover(M.book, f); toast('표지를 바꿨어요'); await loadTeacher(); tabAssign(); } catch (er) { toast(errText(er), 4000); } };
  $('#mxkind').onclick = async () => { if (!M.book) return toast('먼저 교재를 골라 주세요'); const to = NAE ? 'general' : 'naesin', nm = to === 'naesin' ? '내신 대비' : '일반 교재 학습';
    if (!confirm(`"${M.book}"를 ${nm} 쪽으로 옮길까요?`)) return; try { await setBookKind(M.book, to); toast(`${nm}으로 옮겼어요`); tabAssign(); } catch (er) { toast(errText(er), 4000); } };
  $('#mxclr').onclick = () => { M.sel.clear(); draw(); };
  $('#asave').onclick = async () => {
    const num = (id, d) => { const v = parseInt($(id).value, 10); return isNaN(v) ? d : v; };
    const pickedSt = stagePicked('ast');
    if (!pickedSt.length) return toast('학습할 단계를 하나 이상 골라 주세요');
    const mk = u => { const sc = { exam: /-hit$/.test((T.uById[u] || {}).code || '') ? 200 : num('#ae', 8) }; STAGES.forEach(([k]) => { if (!pickedSt.includes(k)) sc[k] = 0; }); return { per_stage: num('#ap', 5), pass_pct: num('#ac', 80), max_retries: num('#ar', 2), stage_counts: sc }; };
    const rows = [...M.sel].filter(k => !had.has(k)).map(k => { const [s, u] = k.split('|'); return { student_id: s, unit_id: u, due_date: $('#ad').value || null, settings: mk(u) }; });
    if (!rows.length) return toast('이미 모두 배정되어 있어요');
    $('#asave').disabled = true;
    const { error } = await S.sb.from('assignments').upsert(rows, { onConflict: 'student_id,unit_id' });
    if (error) { $('#asave').disabled = false; return toast(errText(error), 4000); }
    toast(`${rows.length}건 배정했어요`); M.sel.clear(); await loadTeacher(); tabAssign();
  };
  draw();
}
