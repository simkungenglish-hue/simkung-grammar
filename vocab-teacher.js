/* 심쿵영어 어휘 학습 - 원장님 화면: 어휘 탭 (현황 · 배정 · 단어장 · 시험지 인쇄) */
'use strict';

const VT = { sub: 'now', books: [], units: [], items: [], asg: [], ustat: [], ov: null, bookId: null, unitId: null, loaded: false, ok: true };
const V_LEVELS = [['C', '초3'], ['D', '초4'], ['E', '초5'], ['F', '초6'], ['G', '중1'], ['H', '중2'], ['I', '중3'], ['J', '중3 심화']];
const V_LEVEL_GRADE = Object.fromEntries(V_LEVELS);
const V_DEFAULT = { pass_pct: 90, first_letter: false, units_per_day: 1, review_cap: 40, speak: true, prev_review: true, prev_n: 10 };

async function loadVT() {
  const sb = S.sb;
  const b = await sb.from('vocab_books').select('*').order('level').order('title');
  if (b.error) { VT.ok = false; VT.err = b.error; return; }
  VT.ok = true;
  const [un, it, as, us, ov] = await Promise.all([
    vFetchAll(() => sb.from('vocab_units').select('*').order('book_id').order('ord').order('id')),
    vFetchAll(() => sb.from('vocab_items').select('*').order('unit_id').order('ord').order('id')),
    vFetchAll(() => sb.from('vocab_assignments').select('*').order('created_at').order('id')),
    vFetchAll(() => sb.from('vocab_unit_status').select('*').order('student_id').order('unit_id')),
    sb.rpc('vocab_teacher_overview')
  ]);
  VT.books = b.data || []; VT.units = un; VT.items = it; VT.asg = as; VT.ustat = us;
  VT.ov = ov.error ? { students: [], weak: [] } : ov.data;
  VT.loaded = true; VT.at = new Date();
  vtLive();
}
// 학생이 어휘를 풀면 현황 화면을 자동으로 새로 그려요 (실시간이 안 되면 새로고침 버튼으로)
function vtLive() {
  if (VT.ch || !S.sb.channel) return;
  try {
    VT.ch = S.sb.channel('vocab-live').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'vocab_answers' }, () => {
      clearTimeout(VT.lt);
      VT.lt = setTimeout(async () => {
        if (T.tab !== 'vocab' || VT.sub !== 'now' || document.querySelector('.modal-bg')) { VT.loaded = false; return; }
        try { await loadVT(); vtNow(); } catch (e) { /* 다음에 다시 */ }
      }, 1500);
    }).subscribe();
  } catch (e) { /* 실시간 없이도 동작해요 */ }
}
const vtBook = id => VT.books.find(b => b.id === id);
const vtUnits = bookId => VT.units.filter(u => u.book_id === bookId).sort((a, b) => a.ord - b.ord);
const vtItems = unitId => VT.items.filter(i => i.unit_id === unitId).sort((a, b) => a.ord - b.ord);
const vtBookItems = bookId => { const ids = new Set(vtUnits(bookId).map(u => u.id)); return VT.items.filter(i => ids.has(i.unit_id)); };
const V_SCHOOL_GRADES = ['중1', '중2', '중3'];
const vtLevelLabel = b => b.kind === 'school' ? `내신 ${[b.school_grade, b.publisher].filter(Boolean).join(' · ') || '교과어휘'}` : b.level ? `${b.level}${V_LEVEL_GRADE[b.level] ? ' · ' + V_LEVEL_GRADE[b.level] : ''}` : '레벨 미정';
const vtUnitWord = b => (b && b.kind === 'school') ? '과' : '유닛';
const vtDefaults = b => (b && b.kind === 'school') ? { ...V_DEFAULT, units_per_day: 0, sequential: false } : { ...V_DEFAULT, sequential: true };
function vtAsgUnits(a) { const c = { ...vtDefaults(vtBook(a.book_id)), ...(a.settings || {}) }; return vtUnits(a.book_id).filter(u => u.ord >= (a.start_ord || 1) && (!Array.isArray(c.only) || !c.only.length || c.only.includes(u.ord))); }

async function tabVocab() {
  const tb = $('#tb');
  if (!VT.loaded) { tb.innerHTML = '<p class="muted">어휘 자료를 불러오는 중…</p>'; await loadVT(); }
  if (!VT.ok) {
    tb.innerHTML = `<div class="card"><h2>어휘 기능을 켜려면 DB 업데이트가 필요해요</h2>
      <p>설치 안내서의 <b>11단계 업데이트</b>대로 Supabase SQL Editor에서 <code>schema11_vocab.sql</code> 을 한 번 실행해 주세요.</p>
      <p class="tiny">${esc(errText(VT.err))}</p></div>`;
    return;
  }
  const subs = [['now', '현황'], ['time', '학습 시간'], ['books', '단어장'], ['exam', '📝 시험'], ['wrong', '오답관리']].concat(typeof vtAI === 'function' ? [['ai', '🤖 AI 자동 만들기'], ['game', '게임·칭찬']] : []).concat([['print', '시험지 인쇄']]);
  tb.innerHTML = `<div class="vsubs noprint">${subs.map(([k, n]) => `<button class="seg ${VT.sub === k ? 'on' : ''}" data-vs="${k}">${n}</button>`).join('')}
    <button class="btn ghost small" id="vrl" style="margin-left:auto">새로고침</button></div><div id="vb"></div>`;
  document.querySelectorAll('[data-vs]').forEach(b => b.onclick = () => { VT.sub = b.dataset.vs; VT.bookId = VT.sub === 'books' ? VT.bookId : null; if (VT.sub === 'now') VT.loaded = false; tabVocab(); });
  $('#vrl').onclick = async () => { VT.loaded = false; await tabVocab(); };
  ({ now: vtNow, time: vtTime, exam: vtExam, wrong: vtWrong, assign: vtAssign, books: vtBooks, print: vtPrint, ai: typeof vtAI === 'function' ? vtAI : vtNow, game: typeof vtGame === 'function' ? vtGame : vtNow })[VT.sub]();
}

/* ---------- 현황 ---------- */
function vtNow() {
  const ov = VT.ov || { students: [], weak: [] };
  const by = new Map(ov.students.map(x => [x.student_id, x]));
  const asgStu = new Set(VT.asg.map(a => a.student_id));
  const rows = T.students.filter(s => asgStu.has(s.id)).map(s => ({ s, o: by.get(s.id) || {} }));
  const active = rows.filter(r => r.o.today_n > 0).length;
  const todayN = rows.reduce((n, r) => n + (r.o.today_n || 0), 0), todayOk = rows.reduce((n, r) => n + (r.o.today_ok || 0), 0);
  const weekN = rows.reduce((n, r) => n + (r.o.week_n || 0), 0), weekOk = rows.reduce((n, r) => n + (r.o.week_ok || 0), 0);
  const dueAll = rows.reduce((n, r) => n + (r.o.due || 0), 0);
  const accCls = v => v == null ? '' : v >= 85 ? 'ok' : v >= 65 ? 'mid' : 'low';
  const wAcc = weekN ? pct(weekOk, weekN) : null;
  const cards = rows.sort((a, b) => (b.o.today_n || 0) - (a.o.today_n || 0) || a.s.name.localeCompare(b.s.name, 'ko')).map(({ s, o }) => {
    const myAsg = VT.asg.filter(a => a.student_id === s.id);
    const books = myAsg.map(a => {
      const bk = vtBook(a.book_id); if (!bk) return '';
      const us = vtAsgUnits(a);
      const passed = us.filter(u => VT.ustat.some(x => x.student_id === s.id && x.unit_id === u.id && x.passed_at)).length;
      return `<div class="prow"><span>${esc(bk.title)}</span><div class="pbar"><i style="width:${pct(passed, us.length) || 0}%"></i></div><b>${passed}/${us.length}</b></div>`;
    }).join('');
    const acc7 = o.week_n ? pct(o.week_ok, o.week_n) : null;
    return `<article class="scard ${o.today_n ? 'on' : ''}" data-vstu="${s.id}" role="button" tabindex="0">
      <div class="sh"><div class="av">${esc(String(s.name).slice(0, 1))}</div><div class="sn"><b>${esc(s.name)}</b><span>${esc(s.grade)}</span></div>
        <span class="st ${o.today_n ? 'on' : ''}">${o.today_n ? '오늘 학습함' : '오늘 학습 없음'}</span></div>
      <div class="sm">
        <div><small>오늘 푼 문제</small><b>${o.today_n || 0}<em>개</em></b></div>
        <div><small>밀린 복습</small><b class="${(o.due || 0) > 40 ? 'low' : (o.due || 0) > 15 ? 'mid' : ''}">${o.due || 0}<em>개</em></b></div>
        <div><small>7일 정답률</small><b class="${accCls(acc7)}">${acc7 == null ? '-' : acc7 + '<em>%</em>'}</b></div>
      </div>
      <div class="sprog">${books || '<span class="tiny">배정된 단어장이 없어요</span>'}</div>
      <div class="sf"><span>외운 단어 ${o.learned || 0} · 완전 암기 ${o.mastered || 0} · 7일 중 ${o.days7 || 0}일 학습</span><span>${o.last_at ? '마지막 ' + fmtDT(o.last_at) : '기록 없음'}</span></div>
    </article>`;
  }).join('');
  const weak = (ov.weak || []).map(w => `<span class="wchip" title="${w.students}명이 ${w.wrong}번 틀림"><b>${esc(w.word)}</b> ${esc(w.meaning)} <em>${w.wrong}</em></span>`).join('');
  const d = new Date();
  $('#vb').innerHTML = `
    <section class="hero"><div><small>${d.getMonth() + 1}월 ${d.getDate()}일 · 어휘</small><h1>어휘 현황</h1>
      <p>${active ? `오늘 ${active}명이 단어 ${todayN}개를 풀었어요.` : '오늘은 아직 어휘를 공부한 학생이 없어요.'}${dueAll ? ` 밀린 복습이 모두 ${dueAll}개예요.` : ''}</p></div>
      <div class="upd">마지막 새로고침<br><b>${fmtDT(VT.at)}</b></div></section>
    <section class="kpis">
      <div class="kpi"><small>오늘 푼 단어</small><b>${todayN}<em>개</em></b><span>${active}명 학습 · 정답 ${todayN ? pct(todayOk, todayN) : 0}%</span></div>
      <div class="kpi"><small>7일 정답률</small><b class="${accCls(wAcc)}">${wAcc == null ? '-' : wAcc + '<em>%</em>'}</b><span>${weekN}문제 기준</span></div>
      <div class="kpi ${dueAll > 100 ? 'alert' : ''}"><small>밀린 복습</small><b>${dueAll}<em>개</em></b><span>오늘까지 다시 봐야 할 단어</span></div>
      <div class="kpi"><small>배정 학생</small><b>${rows.length}<em>명</em></b><span>오늘 미학습 ${rows.length - active}명</span></div>
    </section>
    <section class="sgrid">${cards || `<div class="card">아직 단어장을 배정한 학생이 없어요. <b>배정</b>에서 학생에게 단어장을 배정해 주세요.</div>`}</section>`;
  document.querySelectorAll('[data-vstu]').forEach(el => el.onclick = () => vtStudent(el.dataset.vstu));
}

/* 학생 한 명 자세히 보기 + A4 리포트 */
async function vtStudent(sid) {
  const s = T.sById[sid]; if (!s) return;
  const o = (VT.ov.students || []).find(x => x.student_id === sid) || {};
  const m = modal('<p class="muted">불러오는 중…</p>');
  const [weak, srs, rec, tm] = await Promise.all([S.sb.rpc('vocab_student_weak', { p_student: sid, p_days: 60 }), vFetchAll(() => S.sb.from('vocab_srs').select('box,due_on,item_id').eq('student_id', sid).order('item_id')),
    S.sb.from('vocab_progress').select('unit_id,step,score,total,time_sec,done_at').eq('student_id', sid).order('done_at', { ascending: false }).limit(14),
    S.sb.rpc('vocab_time_overview', { p_days: 30 })]);
  const tmine = (tm.data || []).filter(r => r.student_id === sid), tsum = from => tmine.filter(r => r.day >= from).reduce((n, r) => n + r.sec, 0);
  const tinfo = tm.error ? null : { t0: tsum(kstToday()), t7: tsum(addDays(kstToday(), -6)), t30: tsum(addDays(kstToday(), -29)) };
  const stepName = { look: '보고 듣기', memorize: '외우기', check: '뜻 고르기', write: '철자 쓰기', match: '짝 맞추기', test: '유닛 테스트', prev: '앞 복습', pos: '품사', sent: '문장 빈칸' };
  const recent = (rec.data || []).map(r => { const u = VT.units.find(x => x.id === r.unit_id), b = u && vtBook(u.book_id); return `<tr><td class="tiny">${fmtDT(r.done_at)}</td><td>${esc(b ? b.title : '')} <b>${esc(u ? (u.title || u.ord) : '')}</b></td><td>${esc(stepName[r.step] || r.step)}</td><td>${r.total ? r.score + '/' + r.total : '-'}</td><td class="tiny">${vtDur(r.time_sec)}</td></tr>`; }).join('');
  const boxes = [1, 2, 3, 4, 5, 6].map(b => srs.filter(r => r.box === b).length), tot = srs.length || 1;
  const boxName = ['1일', '3일', '7일', '14일', '30일', '완전 암기'];
  const myAsg = VT.asg.filter(a => a.student_id === sid);
  const books = myAsg.map(a => {
    const bk = vtBook(a.book_id); if (!bk) return '';
    const chips = vtAsgUnits(a).map(u => {
      const st = VT.ustat.find(x => x.student_id === sid && x.unit_id === u.id);
      const cls = st && st.passed_at ? 'ok' : st ? 'now' : 'lock';
      return `<button class="uchip ${cls}" data-reset="${u.id}" title="${st ? `최고 ${st.best_pct}% · 테스트 ${st.tests}번` : '시작 전'}">${st && st.passed_at ? '✓' : ''}<span>${u.ord}</span>${st ? `<small>${st.best_pct}%</small>` : ''}</button>`;
    }).join('');
    return `<div class="vt-bk"><b>${esc(bk.title)}</b> <span class="tiny">${esc(vtLevelLabel(bk))}</span><div class="uchips">${chips}</div></div>`;
  }).join('');
  const wl = (weak.data || []).map(w => `<tr><td><b>${esc(w.word)}</b></td><td>${esc(w.meaning)}</td><td>${w.wrong}/${w.total}</td><td>${w.box ? boxName[w.box - 1] : '-'}</td></tr>`).join('');
  m.querySelector('.modal').innerHTML = `<div class="row between"><h2 style="margin:0">${esc(s.name)} <span class="tiny">${esc(s.grade)}</span></h2><button class="btn ghost small" id="x">닫기</button></div>
    <div class="vstats" style="margin:12px 0">
      <div class="vstat"><b>${o.learned || 0}</b><span>외운 단어</span></div><div class="vstat"><b>${o.mastered || 0}</b><span>완전 암기</span></div>
      <div class="vstat"><b>${o.due || 0}</b><span>밀린 복습</span></div><div class="vstat"><b>${o.units_passed || 0}</b><span>통과 유닛</span></div></div>
    ${tinfo ? `<div class="vstats" style="margin:0 0 12px"><div class="vstat"><b>${vtDur(tinfo.t0)}</b><span>오늘 학습 시간</span></div><div class="vstat"><b>${vtDur(tinfo.t7)}</b><span>최근 7일</span></div><div class="vstat"><b>${vtDur(tinfo.t30)}</b><span>최근 30일</span></div></div>` : ''}
    <h3>복습 상자 (기억 단계)</h3>
    <div class="boxbar">${boxes.map((n, i) => n ? `<i class="b${i + 1}" style="flex:${n}" title="${boxName[i]} 상자 ${n}개">${n}</i>` : '').join('') || '<span class="tiny">아직 테스트한 단어가 없어요</span>'}</div>
    <div class="tiny">${boxName.map((n, i) => `<span class="lg b${i + 1}"></span>${n}`).join(' ')}</div>
    <h3 style="margin-top:14px">유닛 진행</h3>${books || '<p class="tiny">배정된 단어장이 없어요.</p>'}
    <p class="tiny">유닛 번호를 누르면 그 유닛을 처음부터 다시 학습시킬 수 있어요. (지난 답안 기록은 남아요)</p>
    <h3 style="margin-top:14px">최근 학습 내용</h3>
    ${recent ? `<div class="tablewrap"><table><thead><tr><th>시각</th><th>교재 · 유닛</th><th>단계</th><th>점수</th><th>시간</th></tr></thead><tbody>${recent}</tbody></table></div>` : '<p class="tiny">아직 학습 기록이 없어요.</p>'}
    <h3 style="margin-top:14px">자주 틀린 단어 (60일)</h3>
    ${wl ? `<div class="tablewrap"><table><thead><tr><th>단어</th><th>뜻</th><th>틀림/전체</th><th>지금 상자</th></tr></thead><tbody>${wl}</tbody></table></div>` : '<p class="tiny">틀린 단어가 없어요.</p>'}
    <div class="row" style="margin-top:12px"><button class="btn" id="rp">A4 어휘 리포트 인쇄</button><button class="btn ghost" id="wp">틀린 단어 시험지</button><button class="btn ghost" id="wd">받아쓰기 시험지</button></div>`;
  m.querySelector('#x').onclick = () => m.remove();
  m.querySelectorAll('[data-reset]').forEach(b => b.onclick = async () => {
    const u = VT.units.find(x => x.id === b.dataset.reset);
    if (!confirm(`${s.name} 학생의 ${u.title || 'Unit ' + u.ord}을(를) 처음부터 다시 학습시킬까요?`)) return;
    const { error } = await S.sb.rpc('vocab_reset_unit', { p_student: sid, p_unit: u.id });
    if (error) return toast(errText(error));
    VT.ustat = VT.ustat.filter(x => !(x.student_id === sid && x.unit_id === u.id));
    toast('다시 학습하도록 바꿨어요'); m.remove(); vtStudent(sid);
  });
  m.querySelector('#rp').onclick = () => vtReportPrint(s, o, boxes, boxName, myAsg, weak.data || [], tinfo, rec.data || []);
  m.querySelector('#wp').onclick = () => {
    const ids = new Set((weak.data || []).map(w => w.item_id)); const its = VT.items.filter(i => ids.has(i.id));
    if (!its.length) return toast('틀린 단어가 없어요');
    vtPrintSheet({ title: `${s.name} · 틀린 단어 다시 쓰기`, items: its, kind: 'mix', key: true, name: s.name });
  };
  m.querySelector('#wd').onclick = () => {
    const ids = new Set((weak.data || []).map(w => w.item_id)); const its = VT.items.filter(i => ids.has(i.id));
    if (!its.length) return toast('틀린 단어가 없어요');
    vtPrintSheet({ title: `${s.name} · 받아쓰기`, items: its, kind: 'dict', key: true, name: s.name });
  };
}
function vtReportPrint(s, o, boxes, boxName, myAsg, weak, tinfo, rec) {
  const books = myAsg.map(a => {
    const bk = vtBook(a.book_id); if (!bk) return '';
    const us = vtAsgUnits(a);
    const cells = us.map(u => { const st = VT.ustat.find(x => x.student_id === s.id && x.unit_id === u.id); return `<td class="${st && st.passed_at ? 'p' : ''}">${u.ord}<br><small>${st ? st.best_pct + '%' : ''}</small></td>`; });
    const rowsH = []; for (let k = 0; k < cells.length; k += 10) rowsH.push(`<tr>${cells.slice(k, k + 10).join('')}</tr>`);
    return `<h3>${esc(bk.title)} <small>${esc(vtLevelLabel(bk))}</small></h3><table class="ug">${rowsH.join('')}</table>`;
  }).join('');
  const tot = boxes.reduce((a, b) => a + b, 0) || 1;
  const acc7 = o.week_n ? pct(o.week_ok, o.week_n) : null;
  const html = `<div class="rp-h"><div><b>스텔라의 심쿵영어</b> · 어휘 학습 리포트</div><div>${new Date().toLocaleDateString('ko-KR')}</div></div>
    <h1>${esc(s.name)} <small>${esc(s.grade)}</small></h1>
    <table class="kv4"><tr><td><small>외운 단어</small><b>${o.learned || 0}</b></td><td><small>완전 암기</small><b>${o.mastered || 0}</b></td><td><small>통과 유닛</small><b>${o.units_passed || 0}</b></td><td><small>최근 7일</small><b>${o.days7 || 0}일 학습</b></td><td><small>7일 정답률</small><b>${acc7 == null ? '-' : acc7 + '%'}</b></td>${tinfo ? `<td><small>학습 시간 7일 / 30일</small><b>${vtDur(tinfo.t7)} / ${vtDur(tinfo.t30)}</b></td>` : ''}</tr></table>
    <h3>기억 단계별 단어 수</h3>
    <div class="bars">${boxes.map((n, i) => `<div><span>${boxName[i]}</span><i style="width:${n / tot * 100}%"></i><b>${n}</b></div>`).join('')}</div>
    <p class="note">틀린 단어는 1일 뒤, 맞힌 단어는 3일 → 7일 → 14일 → 30일 간격으로 다시 확인해요. '완전 암기'는 30일 뒤에도 기억한 단어예요.</p>
    ${books}
    ${(rec || []).length ? `<h3>최근 학습 내용</h3><table class="wt"><tr><th>날짜</th><th>유닛</th><th>단계</th><th>점수</th></tr>${rec.slice(0, 10).map(r => { const u = VT.units.find(x => x.id === r.unit_id); const nm = { look: '보고 듣기', memorize: '외우기', check: '뜻 고르기', write: '철자 쓰기', match: '짝 맞추기', test: '유닛 테스트', prev: '앞 복습', pos: '품사', sent: '문장 빈칸' }; return `<tr><td>${fmtDT(r.done_at)}</td><td>${esc(u ? (u.title || u.ord) : '')}</td><td>${nm[r.step] || r.step}</td><td>${r.total ? r.score + '/' + r.total : '-'}</td></tr>`; }).join('')}</table>` : ''}
    <h3>다시 확인할 단어</h3>
    ${weak.length ? `<table class="wt"><tr><th>단어</th><th>뜻</th><th>틀림</th></tr>${weak.slice(0, 20).map(w => `<tr><td>${esc(w.word)}</td><td>${esc(w.meaning)}</td><td>${w.wrong}</td></tr>`).join('')}</table>` : '<p>최근 틀린 단어가 없어요. 아주 잘하고 있어요!</p>'}
    <div class="cm"><b>원장님 한마디</b><div class="lines"></div></div>`;
  vtOpenPrint('어휘 리포트 - ' + s.name, html, `
    .rp-h{display:flex;justify-content:space-between;font-size:10pt;border-bottom:1.5px solid #d4544b;padding-bottom:4px;color:#555}
    h1{font-size:18pt;margin:8px 0}h1 small{font-size:11pt;color:#666}h3{font-size:11.5pt;margin:12px 0 5px;border-left:3px solid #d4544b;padding-left:6px}h3 small{color:#777;font-weight:400}
    .kv4{width:100%;border-collapse:collapse}.kv4 td{border:1px solid #ccc;padding:6px;text-align:center}.kv4 small{display:block;color:#666;font-size:8.5pt}.kv4 b{font-size:13pt}
    .bars div{display:flex;align-items:center;gap:6px;font-size:9.5pt;margin:2px 0}.bars span{width:60px}.bars i{display:block;height:9px;border:1px solid #d4544b;min-width:1px}.bars b{font-weight:600}
    .ug{border-collapse:collapse;width:100%;table-layout:fixed}.ug td{border:1px solid #ccc;text-align:center;font-size:9pt;padding:3px}.ug td.p{font-weight:700;border-color:#d4544b}.ug small{color:#555}
    .wt{border-collapse:collapse;width:100%;font-size:9.5pt}.wt td,.wt th{border:1px solid #ccc;padding:3px 6px;text-align:left}
    .note{font-size:8.5pt;color:#666}.cm{margin-top:12px;border:1px solid #ccc;padding:6px}.lines{height:60px;background:repeating-linear-gradient(#fff 0 19px,#ddd 19px 20px)}`);
}

/* ---------- 배정 ---------- */
function vtAssign() {
  const pub = VT.books.filter(b => b.status === 'published');
  const sel = VT.asgBook && pub.some(b => b.id === VT.asgBook) ? VT.asgBook : (pub[0] && pub[0].id);
  const rows = VT.asg.map(a => {
    const s = T.sById[a.student_id], bk = vtBook(a.book_id); if (!s || !bk) return '';
    const c = { ...vtDefaults(bk), ...(a.settings || {}) };
    const range = Array.isArray(c.only) && c.only.length ? c.only.join(', ') + vtUnitWord(bk) : `${a.start_ord || 1}${vtUnitWord(bk)}부터`;
    return `<tr><td><b>${esc(s.name)}</b> <span class="tiny">${esc(s.grade)}</span></td><td>${esc(bk.title)} <span class="tiny">${esc(vtLevelLabel(bk))}</span></td>
      <td>${esc(range)}${c.sequential ? '' : ' <span class="tiny">(한꺼번에)</span>'}</td><td>${c.pass_pct}%</td><td>${c.units_per_day || '제한 없음'}</td><td>${c.first_letter ? '켬' : '-'}</td>
      <td><button class="btn ghost small" data-ea="${a.id}">설정</button> <button class="btn ghost small" data-da="${a.id}">해제</button></td></tr>`;
  }).join('');
  $('#vb').innerHTML = `<div class="card"><h2>단어장 배정하기</h2>
    ${pub.length ? `<label>단어장</label><select id="abk">${pub.map(b => `<option value="${b.id}" ${b.id === sel ? 'selected' : ''}>${esc(b.title)} (${esc(vtLevelLabel(b))} · ${vtUnits(b.id).length}유닛)</option>`).join('')}</select>
    <label style="margin-top:10px">학생 고르기</label><div class="picks" id="apk">${T.students.map(s => `<label class="pick"><input type="checkbox" value="${s.id}"> ${esc(s.name)} <span class="tiny">${esc(s.grade)}</span></label>`).join('')}</div>
    <div id="aset">${vtSettingsForm(vtDefaults(vtBook(sel)), 1, vtBook(sel))}</div>
    <button class="btn" id="asave" style="margin-top:12px">배정하기</button>
    <p class="tiny">이미 배정된 학생은 설정만 바뀌고 학습 기록은 그대로예요.</p>`
    : '<p>공개된 단어장이 없어요. <b>단어장</b>에서 단어장을 만들고 <b>학생에게 공개</b>를 눌러 주세요.</p>'}</div>
    <div class="card"><h2>배정 현황</h2>${rows ? `<div class="tablewrap"><table><thead><tr><th>학생</th><th>단어장</th><th>범위</th><th>통과 기준</th><th>하루 새 유닛</th><th>첫 글자 힌트</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">아직 배정이 없어요.</p>'}</div>`;
  vtBindSteps($('#vb'));
  if ($('#abk')) $('#abk').onchange = e => { VT.asgBook = e.target.value; const bk = vtBook(e.target.value); $('#aset').innerHTML = vtSettingsForm(vtDefaults(bk), 1, bk); vtBindSteps($('#aset')); };
  if ($('#asave')) $('#asave').onclick = async () => {
    const book = $('#abk').value, ids = [...document.querySelectorAll('#apk input:checked')].map(i => i.value);
    if (!ids.length) return toast('학생을 골라 주세요');
    const { settings, start } = vtReadSettings($('#vb'));
    const { error } = await S.sb.from('vocab_assignments').upsert(ids.map(id => ({ student_id: id, book_id: book, settings, start_ord: start })), { onConflict: 'student_id,book_id' });
    if (error) return toast(errText(error));
    toast(`${ids.length}명에게 배정했어요`); VT.loaded = false; VT.asgBook = book; tabVocab();
  };
  document.querySelectorAll('[data-da]').forEach(b => b.onclick = async () => {
    if (!confirm('이 배정을 해제할까요? 학생 화면에서 이 단어장이 사라져요. (학습 기록은 남아요)')) return;
    const { error } = await S.sb.from('vocab_assignments').delete().eq('id', b.dataset.da);
    if (error) return toast(errText(error));
    VT.asg = VT.asg.filter(a => a.id !== b.dataset.da); vtAssign();
  });
  document.querySelectorAll('[data-ea]').forEach(b => b.onclick = () => {
    const a = VT.asg.find(x => x.id === b.dataset.ea), s = T.sById[a.student_id];
    const bk = vtBook(a.book_id);
    const m = modal(`<h2>${esc(s.name)} · ${esc(bk.title)}</h2>${vtSettingsForm({ ...vtDefaults(bk), ...(a.settings || {}) }, a.start_ord || 1, bk)}
      <div class="row" style="margin-top:12px"><button class="btn" id="sv">저장</button><button class="btn ghost" id="cx">취소</button></div>`);
    vtBindSteps(m);
    m.querySelector('#cx').onclick = () => m.remove();
    m.querySelector('#sv').onclick = async () => {
      const { settings, start } = vtReadSettings(m);
      const { error } = await S.sb.from('vocab_assignments').update({ settings, start_ord: start }).eq('id', a.id);
      if (error) return toast(errText(error));
      a.settings = settings; a.start_ord = start; m.remove(); toast('저장했어요'); vtAssign();
    };
  });
}
const VT_STEP_OPTS = [['look', '👀 보고 듣기'], ['memorize', '🧠 외우기'], ['check', '✅ 뜻 고르기'], ['write', '✏️ 철자 쓰기'], ['match', '🧩 짝 맞추기'], ['pos', '🏷️ 품사 맞추기'], ['sent', '📝 문장 빈칸']];
const VT_PRESETS = { basic: ['look', 'memorize', 'check', 'write', 'match'], std: ['look', 'check', 'write', 'match'], adv: ['check', 'write', 'sent'], quick: ['look', 'check', 'write'] };
// 속성 15분: 단계만이 아니라 설정도 같이 바꿔요 (첫 글자 힌트·앞 복습 5단어·통과 80%)
const VT_PRESET_SET = { quick: { first_letter: true, prev_review: true, prev_n: 5, pass_pct: 80 } };
function vtBindSteps(root) {
  root.querySelectorAll('[data-preset]').forEach(b => b.onclick = () => root.querySelectorAll('[data-step]').forEach(i => { i.checked = VT_PRESETS[b.dataset.preset].includes(i.value); }) || Object.entries(VT_PRESET_SET[b.dataset.preset] || {}).forEach(([k, v]) => { const el = root.querySelector(`[data-k="${k}"]`); if (el) { if (el.type === 'checkbox') el.checked = v; else el.value = v; } }));
}
function vtSettingsForm(c, start, bk) {
  const school = !!(bk && bk.kind === 'school'), only = Array.isArray(c.only) ? c.only : [], stepsOn = Array.isArray(c.steps) && c.steps.length ? c.steps : ['look', 'memorize', 'check', 'write', 'match'];
  const scope = school && bk ? `<div style="grid-column:1/-1"><label>열어 줄 과 (시험 범위) <span class="tiny">고르지 않으면 모든 과가 열려요</span></label>
      <div class="uchips">${vtUnits(bk.id).map(u => `<label class="uchip pickable"><input type="checkbox" data-only value="${u.ord}" ${only.includes(u.ord) ? 'checked' : ''}><span>${u.ord}</span><small>${esc((u.title || '').replace(/^Lesson\s*\d+\s*[·.:-]?\s*/i, '').slice(0, 6))}</small></label>`).join('')}</div></div>` : '';
  return `<div class="setgrid vset">${scope}
    <div><label>통과 기준 (%)</label><input type="number" data-k="pass_pct" min="50" max="100" value="${c.pass_pct}"></div>
    <div><label>하루 새 ${school ? '과' : '유닛'} 수</label><input type="number" data-k="units_per_day" min="0" max="10" value="${c.units_per_day}"><div class="tiny">0 = 제한 없음. 1~2개를 권해요(나눠 외울수록 오래 기억해요)</div></div>
    <div><label>한 번에 복습할 최대 단어 수</label><input type="number" data-k="review_cap" min="10" max="200" value="${c.review_cap}"></div>
    <div><label>시작 ${school ? '과' : '유닛'} 번호</label><input type="number" data-k="start" min="1" value="${start}"></div>
    <div><label class="pick"><input type="checkbox" data-k="first_letter" ${c.first_letter ? 'checked' : ''}> 철자 쓰기에 첫 글자 힌트</label><div class="tiny">초등 저학년·처음 시작하는 학생에게 권해요</div></div>
    <div><label class="pick"><input type="checkbox" data-k="speak" ${c.speak ? 'checked' : ''}> 따라 말하기 버튼 보이기</label></div>
    <div><label class="pick"><input type="checkbox" data-k="prev_review" ${c.prev_review !== false ? 'checked' : ''}> 새 ${school ? '과' : '유닛'} 전에 앞 ${school ? '과' : '유닛'} 가볍게 복습</label><div class="tiny">1 학습 → 2 시작 전 1 복습 → 2 학습 → 3 시작 전 2 복습…</div></div>
    <div><label>앞 복습 단어 수</label><input type="number" data-k="prev_n" min="3" max="30" value="${c.prev_n ?? 10}"></div>
    <div style="grid-column:1/-1"><label>학습 단계 고르기 <span class="tiny">학생 수준에 맞게 고르세요. 유닛 테스트는 늘 마지막에 있고, 통과하면 게임이 열려요</span></label>
      <div class="row" style="gap:6px;flex-wrap:wrap;margin:4px 0"><button type="button" class="btn small ghost" data-preset="basic">기초 (천천히)</button><button type="button" class="btn small ghost" data-preset="std">표준</button><button type="button" class="btn small ghost" data-preset="adv">심화 (빠르게)</button><button type="button" class="btn small" data-preset="quick">⚡ 속성 15분 (노베·초저)</button></div>
      <div class="uchips" id="vtsteps">${VT_STEP_OPTS.map(([k, n]) => `<label class="uchip pickable wide"><input type="checkbox" data-step value="${k}" ${stepsOn.includes(k) ? 'checked' : ''}><span>${n}</span></label>`).join('')}<span class="uchip wide on"><span>🏁 유닛 테스트 (통과 ${c.pass_pct}%)</span></span></div></div>
    <div><label class="pick"><input type="checkbox" data-k="sequential" ${c.sequential ? 'checked' : ''}> ${school ? '과' : '유닛'}을 순서대로 열기</label><div class="tiny">${school ? '내신 대비는 꺼 두면 시험 범위 과를 바로 공부해요' : '앞 유닛을 통과해야 다음 유닛이 열려요'}</div></div></div>`;
}
function vtReadSettings(root) {
  const g = k => root.querySelector(`[data-k="${k}"]`);
  const num = (k, d, lo, hi) => { const v = parseInt(g(k).value, 10); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); };
  return {
    settings: { pass_pct: num('pass_pct', 90, 50, 100), units_per_day: num('units_per_day', 1, 0, 10), review_cap: num('review_cap', 40, 10, 200), first_letter: g('first_letter').checked, speak: g('speak').checked,
      prev_review: g('prev_review').checked, prev_n: num('prev_n', 10, 3, 30),
      steps: [...root.querySelectorAll('[data-step]:checked')].map(i => i.value),
      sequential: g('sequential').checked, only: [...root.querySelectorAll('[data-only]:checked')].map(i => +i.value).sort((x, y) => x - y) },
    start: num('start', 1, 1, 999)
  };
}

/* ---------- 단어장 ---------- */
function vtBooks() {
  if (VT.bookId && vtBook(VT.bookId)) return vtBookEdit(VT.bookId);
  const card = b => {
    const us = vtUnits(b.id), n = vtBookItems(b.id).length, stu = VT.asg.filter(a => a.book_id === b.id).length;
    return `<button class="bcard" data-bk="${b.id}"><b>${esc(b.title)}</b><span>${b.kind === 'school' && b.publisher ? esc(b.publisher) + ' · ' : ''}${us.length}${vtUnitWord(b)} · ${n}단어${stu ? ` · ${stu}명 배정` : ''}</span>${b.status === 'published' ? '<span class="badge ok">학생에게 공개</span>' : '<span class="badge warn">검수 중(비공개)</span>'}</button>`;
  };
  const byLv = {}, bySc = {};
  for (const b of VT.books) {
    if (b.kind === 'school') (bySc[b.school_grade || '-'] = bySc[b.school_grade || '-'] || []).push(b);
    else (byLv[b.level || '-'] = byLv[b.level || '-'] || []).push(b);
  }
  const lvG = V_LEVELS.map(l => l[0]).concat(['-']).filter(l => byLv[l]).map(l => `<div class="vt-lv"><h3>${l === '-' ? '레벨 미정' : `레벨 ${l} <span class="tiny">${V_LEVEL_GRADE[l]}</span>`}</h3><div class="bgrid">${byLv[l].map(card).join('')}</div></div>`).join('');
  const scG = V_SCHOOL_GRADES.concat(['-']).filter(g => bySc[g]).map(g => `<div class="vt-lv"><h3>${g === '-' ? '학년 미정' : g}</h3><div class="bgrid">${bySc[g].map(card).join('')}</div></div>`).join('');
  const groups = `<div class="vt-track"><h2><span class="vkind level">레벨 어휘</span> C~J · 초3~중3</h2>${lvG || '<p class="muted">아직 레벨 단어장이 없어요.</p>'}</div>
    <div class="vt-track"><h2><span class="vkind school">내신</span> 교과어휘 · 중1 · 중2 · 중3</h2>${scG || '<p class="muted">아직 내신 교과어휘가 없어요. 교과서·자습서의 과별 단어 목록(PDF·엑셀)을 올리면 과별로 만들어져요.</p>'}</div>`;
  $('#vb').innerHTML = `<div class="card"><div class="row between"><div><h2 style="margin:0">단어장</h2><div class="muted">엑셀·CSV·PDF를 올리면 유닛별 단어장이 만들어져요. 검수한 뒤 공개하면 학생이 볼 수 있어요.</div></div>
      <div class="row"><button class="btn" id="imp">+ 파일로 새 단어장</button><button class="btn ghost" id="tpl">엑셀 양식 받기</button>${typeof vtImportEgu === 'function' && !VT.books.some(b => /EGU/i.test(b.title)) ? '<button class="btn ghost" id="egu">📗 EGU 1권 넣기</button>' : ''}</div></div></div>
    ${groups}`;
  $('#imp').onclick = () => vtImport();
  if ($('#egu')) $('#egu').onclick = () => vtImportEgu();
  $('#tpl').onclick = () => vtTemplate();
  document.querySelectorAll('[data-bk]').forEach(b => b.onclick = () => { VT.bookId = b.dataset.bk; VT.unitId = null; vtBookEdit(b.dataset.bk); });
}
function vtGradeSelect(id, v) { return `<select id="${id}"><option value="">학년 선택</option>${V_SCHOOL_GRADES.map(g => `<option ${v === g ? 'selected' : ''}>${g}</option>`).join('')}</select>`; }
function vtLevelSelect(id, v) { return `<select id="${id}"><option value="">레벨 선택</option>${V_LEVELS.map(([l, g]) => `<option value="${l}" ${v === l ? 'selected' : ''}>${l} (${g})</option>`).join('')}</select>`; }

function vtBookEdit(bookId) {
  const b = vtBook(bookId), us = vtUnits(bookId);
  const u = VT.unitId && us.find(x => x.id === VT.unitId) || us[0];
  const items = u ? vtItems(u.id) : [];
  const row = (it, k) => `<tr data-it="${it ? it.id : 'new' + k}">
    <td class="tiny">${it ? it.ord : '+'}</td>
    <td><input type="text" data-f="word" value="${esc(it ? it.word : '')}" placeholder="영어"></td><td><input type="text" data-f="meaning" value="${esc(it ? it.meaning : '')}" placeholder="뜻"></td>
    <td><input type="text" data-f="phrase" value="${esc(it ? it.phrase : '')}" placeholder="2단어 표현"></td><td><input type="text" data-f="phrase_ko" value="${esc(it ? it.phrase_ko : '')}" placeholder="표현 뜻"></td>
    <td><input type="text" data-f="example" value="${esc(it ? it.example : '')}" placeholder="예문"></td><td><input type="text" data-f="example_ko" value="${esc(it ? it.example_ko : '')}" placeholder="예문 해석"></td>
    <td>${it ? `<button class="btn ghost small" data-del="${it.id}" title="삭제">✕</button>` : ''}</td></tr>`;
  $('#vb').innerHTML = `<p><a href="#" id="bk">← 단어장 목록</a></p>
    <div class="card"><div class="row between"><h2 style="margin:0">${esc(b.title)}</h2>${b.status === 'published' ? '<span class="badge ok">학생에게 공개 중</span>' : '<span class="badge warn">검수 중(비공개)</span>'}</div>
      <div class="setgrid" style="margin-top:10px"><div><label>단어장 이름</label><input type="text" id="bt" value="${esc(b.title)}"></div>
        ${b.kind === 'school' ? `<div><label>학년</label>${vtGradeSelect('bsg', b.school_grade)}</div><div><label>교과서 (출판사·저자)</label><input type="text" id="bpb" value="${esc(b.publisher)}" placeholder="예: 동아(윤정미)"></div>`
        : `<div><label>레벨</label>${vtLevelSelect('bl', b.level)}</div><div><label>대상 학년 (메모)</label><input type="text" id="bg" value="${esc(b.grade_band)}" placeholder="예: 초5~6"></div>`}</div>
      <div class="row" style="margin-top:10px"><button class="btn ghost" id="binfo">정보 저장</button>
        ${b.status === 'published' ? '<button class="btn ghost" id="bpub">비공개로 돌리기</button>' : '<button class="btn" id="bpub">학생에게 공개</button>'}
        <button class="btn ghost" id="bprint">이 단어장 시험지</button><button class="btn ghost" id="bdel" style="margin-left:auto">단어장 삭제</button></div></div>
    <div class="card"><div class="row between"><h3 style="margin:0">${vtUnitWord(b)}</h3><button class="btn ghost small" id="uadd">+ ${vtUnitWord(b)} 추가</button></div>
      <div class="uchips" style="margin-top:8px">${us.map(x => `<button class="uchip ${u && x.id === u.id ? 'now' : 'ok'}" data-un="${x.id}"><span>${x.ord}</span><small>${vtItems(x.id).length}</small></button>`).join('')}</div></div>
    ${u ? `<div class="card"><div class="row between"><div class="row"><h3 style="margin:0">${b.kind === 'school' ? 'Lesson' : '유닛'} ${u.ord}</h3><input type="text" id="ut" value="${esc(u.title)}" placeholder="이름" style="max-width:260px"></div>
        <div class="row"><button class="btn ghost small" id="udel">${vtUnitWord(b)} 삭제</button></div></div>
      <div class="tablewrap vedit"><table><thead><tr><th>#</th><th>영어</th><th>뜻</th><th>2단어 표현</th><th>표현 뜻</th><th>예문</th><th>예문 해석</th><th></th></tr></thead>
      <tbody>${items.map(it => row(it)).join('')}${[0, 1, 2].map(k => row(null, k)).join('')}</tbody></table></div>
      <div class="row" style="margin-top:10px"><button class="btn" id="usave">이 유닛 저장</button><span class="tiny">빈 줄에 쓰면 새 단어가 추가돼요. 다른 철자도 정답으로 하려면 영어 칸에 <code>color / colour</code> 처럼 / 로 나눠 쓰세요.</span></div></div>` : ''}`;
  $('#bk').onclick = e => { e.preventDefault(); VT.bookId = null; vtBooks(); };
  $('#binfo').onclick = async () => {
    const up = b.kind === 'school' ? { title: $('#bt').value.trim() || b.title, school_grade: $('#bsg').value, publisher: $('#bpb').value.trim() }
      : { title: $('#bt').value.trim() || b.title, level: $('#bl').value, grade_band: $('#bg').value.trim() };
    const { error } = await S.sb.from('vocab_books').update(up).eq('id', b.id); if (error) return toast(errText(error));
    Object.assign(b, up); toast('저장했어요'); vtBookEdit(bookId);
  };
  $('#bpub').onclick = async () => {
    const to = b.status === 'published' ? 'draft' : 'published';
    if (to === 'published' && !vtBookItems(b.id).length) return toast('단어가 없는 단어장은 공개할 수 없어요');
    if (to === 'draft' && !confirm('비공개로 돌리면 배정된 학생 화면에서 잠시 사라져요. 계속할까요?')) return;
    const { error } = await S.sb.from('vocab_books').update({ status: to }).eq('id', b.id); if (error) return toast(errText(error));
    b.status = to; toast(to === 'published' ? '학생에게 공개했어요' : '비공개로 돌렸어요'); vtBookEdit(bookId);
  };
  $('#bprint').onclick = () => { VT.sub = 'print'; VT.printBook = b.id; tabVocab(); };
  $('#bdel').onclick = async () => {
    if (!confirm(`「${b.title}」 단어장을 지울까요? 이 단어장의 유닛·단어와 학생 학습 기록이 모두 지워지고 되돌릴 수 없어요.`)) return;
    if (prompt('정말 지우려면 단어장 이름을 그대로 입력하세요') !== b.title) return toast('이름이 달라서 지우지 않았어요');
    const { error } = await S.sb.from('vocab_books').delete().eq('id', b.id); if (error) return toast(errText(error));
    VT.loaded = false; VT.bookId = null; toast('지웠어요'); tabVocab();
  };
  $('#uadd').onclick = async () => {
    const ord = (us.reduce((m, x) => Math.max(m, x.ord), 0)) + 1;
    const { data, error } = await S.sb.from('vocab_units').insert({ book_id: b.id, ord, title: (b.kind === 'school' ? 'Lesson ' : 'Unit ') + ord }).select().single(); if (error) return toast(errText(error));
    VT.units.push(data); VT.unitId = data.id; vtBookEdit(bookId);
  };
  document.querySelectorAll('[data-un]').forEach(x => x.onclick = () => { VT.unitId = x.dataset.un; vtBookEdit(bookId); });
  if (!u) return;
  $('#udel').onclick = async () => {
    if (!confirm(`유닛 ${u.ord}과 그 안의 단어 ${items.length}개를 지울까요? 학생 기록도 함께 지워져요.`)) return;
    const { error } = await S.sb.from('vocab_units').delete().eq('id', u.id); if (error) return toast(errText(error));
    VT.units = VT.units.filter(x => x.id !== u.id); VT.items = VT.items.filter(i => i.unit_id !== u.id); VT.unitId = null; vtBookEdit(bookId);
  };
  document.querySelectorAll('[data-del]').forEach(x => x.onclick = async () => {
    const it = VT.items.find(i => i.id === x.dataset.del);
    if (!confirm(`「${it.word}」을(를) 지울까요?`)) return;
    const { error } = await S.sb.from('vocab_items').delete().eq('id', it.id); if (error) return toast(errText(error));
    VT.items = VT.items.filter(i => i.id !== it.id); vtBookEdit(bookId);
  });
  $('#usave').onclick = async () => {
    const btn = $('#usave'); btn.disabled = true;
    try {
      const title = $('#ut').value.trim();
      if (title !== u.title) { const { error } = await S.sb.from('vocab_units').update({ title }).eq('id', u.id); if (error) throw error; u.title = title; }
      let ord = items.reduce((m, x) => Math.max(m, x.ord), 0);
      for (const tr of document.querySelectorAll('.vedit tbody tr')) {
        const v = {}; tr.querySelectorAll('[data-f]').forEach(i => v[i.dataset.f] = i.value.replace(/[\u00a0\u200b]/g, ' ').replace(/\s+/g, ' ').trim());
        const { word, alts } = vtSplitAlts(v.word);
        const rec = { word, meaning: v.meaning, phrase: v.phrase, phrase_ko: v.phrase_ko, example: v.example, example_ko: v.example_ko, alt_answers: alts };
        const id = tr.dataset.it;
        // 철자를 고치면 예전 철자로 만든 음절·헷갈리는 글자·철자 요령은 지워요 (틀린 철자를 연습하지 않게)
        const old = id.startsWith('new') ? null : VT.items.find(i => i.id === id);
        if (old && 'syllables' in old && word && old.word !== word) Object.assign(rec, { syllables: '', tricky: [], spell_note: '' });
        if (id.startsWith('new')) {
          if (!word || !v.meaning) continue;
          const { data, error } = await S.sb.from('vocab_items').insert({ ...rec, unit_id: u.id, ord: ++ord }).select().single(); if (error) throw error;
          VT.items.push(data);
        } else {
          const it = VT.items.find(i => i.id === id);
          if (!word || !v.meaning) { toast('영어와 뜻은 비울 수 없어요 (지우려면 ✕)'); continue; }
          const same = ['word', 'meaning', 'phrase', 'phrase_ko', 'example', 'example_ko'].every(k => it[k] === rec[k]) && (it.alt_answers || []).join('|') === alts.join('|');
          if (same) continue;
          const { error } = await S.sb.from('vocab_items').update(rec).eq('id', id); if (error) throw error;
          Object.assign(it, rec);
        }
      }
      toast('저장했어요'); vtBookEdit(bookId);
    } catch (e) { btn.disabled = false; toast(errText(e), 4000); }
  };
  // 편집 칸에서 다른 철자를 보이게: word 칸에 "color / colour"
  document.querySelectorAll('.vedit tbody tr').forEach(tr => {
    const it = VT.items.find(i => i.id === tr.dataset.it);
    if (it && (it.alt_answers || []).length) tr.querySelector('[data-f="word"]').value = [it.word, ...it.alt_answers].join(' / ');
  });
  if (typeof vtAiBookTools === 'function' && 'syllables' in (items[0] || { syllables: '' })) vtAiBookTools(b, u, items);
}
function vtSplitAlts(s) { const p = String(s || '').split(/\s+\/\s+/).map(x => x.trim()).filter(Boolean); return { word: p[0] || '', alts: p.slice(1) }; }

/* ---------- 파일로 새 단어장 만들기 ---------- */
const V_COLS = {
  unit: /^(유닛|unit|day|단원|과|lesson|차시)/i, word: /^(단어|영어|영단어|word|english|표제어|어휘)/i, meaning: /^(뜻|의미|meaning|korean|한글|우리말)/i,
  pos: /^(품사|pos)/i, phrase_ko: /^(표현\s*뜻|표현뜻|표현\s*해석|phrase\s*(ko|meaning))/i, phrase: /^(표현|2단어|연상|phrase|collocation)/i,
  example_ko: /^(예문\s*(뜻|해석)|예문뜻|example\s*(ko|meaning))/i, example: /^(예문|example|sentence)/i
};
function vtParseRows(rows) {
  // rows: 2차원 배열. 첫 줄이 제목줄이면 그걸로 칸을 맞추고, 아니면 [영어, 뜻, 표현, 표현뜻, 예문, 예문뜻] 순서로 봐요.
  rows = rows.map(r => r.map(c => String(c ?? '').replace(/[\u00a0\u200b]/g, ' ').replace(/\s+/g, ' ').trim())).filter(r => r.some(Boolean));
  if (!rows.length) return [];
  let map = null; const h = rows[0];
  const found = {};
  h.forEach((c, i) => { for (const k of ['unit', 'word', 'meaning', 'pos', 'phrase_ko', 'phrase', 'example_ko', 'example']) if (!(k in found) && V_COLS[k].test(c)) { found[k] = i; break; } });
  if ('word' in found && 'meaning' in found) { map = found; rows = rows.slice(1); }
  else {
    const hasUnit = rows.filter(r => /^\d+$/.test(r[0]) || /^(unit|day)\s*\d+/i.test(r[0])).length > rows.length * 0.6 && rows[0].length >= 3;
    map = hasUnit ? { unit: 0, word: 1, meaning: 2, phrase: 3, phrase_ko: 4, example: 5, example_ko: 6 } : { word: 0, meaning: 1, phrase: 2, phrase_ko: 3, example: 4, example_ko: 5 };
  }
  const g = (r, k) => map[k] == null ? '' : (r[map[k]] || '');
  return rows.map(r => ({ unit: g(r, 'unit'), word: g(r, 'word'), meaning: g(r, 'meaning'), pos: g(r, 'pos'), phrase: g(r, 'phrase'), phrase_ko: g(r, 'phrase_ko'), example: g(r, 'example'), example_ko: g(r, 'example_ko') }))
    .filter(x => x.word && /[A-Za-z]/.test(x.word));
}
// PDF·붙여넣기 글: "Unit 3" / "Day 3" 줄은 유닛 구분, "영어 + 한글 뜻" 줄은 단어로 읽어요.
function vtParseText(txt) {
  const out = []; let unit = '';
  const lines = String(txt || '').split(/\r?\n/);
  const tabbed = lines.filter(l => l.includes('\t')).length > lines.length * 0.5;
  if (tabbed) return vtParseRows(lines.map(l => l.split('\t')));
  for (let l of lines) {
    l = l.replace(/ /g, ' ').trim(); if (!l) continue;
    const um = l.match(/^(?:unit|day|lesson|chapter)\s*0*(\d+)\b|^(\d+)\s*(?:과|일차|단원)\b/i);
    if (um && !/[가-힣]{2,}.*[가-힣]{2,}/.test(l.replace(/^(\d+)\s*(과|일차|단원)/, ''))) { unit = um[1] || um[2]; continue; }
    const m = l.match(/^(?:\d{1,4}[.)]?\s+)?([A-Za-z][A-Za-z'’\-]*(?:\s+[A-Za-z'’\-~.]+)*)\s*(?:\[[^\]]*\]\s*)?(?:(n|v|adj|adv|prep|conj|pron|int)\.\s*)?[:\-–]?\s*([~(（가-힣].*)$/);
    if (m) out.push({ unit, word: m[1].trim(), meaning: m[3].trim(), pos: m[2] ? m[2] + '.' : '', phrase: '', phrase_ko: '', example: '', example_ko: '' });
  }
  return out;
}
function vtLoadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((ok, no) => {
    const sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    sc.onload = () => ok(window.XLSX); sc.onerror = () => no(new Error('엑셀 읽기 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(sc);
  });
}
function vtToTsv(list) { const c = v => String(v || '').replace(/[\t\r\n]+/g, ' '); return ['유닛\t단어\t뜻\t품사\t표현\t표현뜻\t예문\t예문뜻'].concat(list.map(x => [x.unit, x.word, x.meaning, x.pos, x.phrase, x.phrase_ko, x.example, x.example_ko].map(c).join('\t'))).join('\n'); }
function vtImport() {
  const m = modal(`<h2>파일로 새 단어장 만들기</h2>
    <p class="muted">엑셀(.xlsx)·CSV·PDF·텍스트 파일을 고르거나, 아래 칸에 붙여넣으세요. 내신 교과어휘는 유닛 칸에 과 번호(1, 2, 3…)를 넣으면 과별로 나뉘어요. 첫 줄이 <b>유닛 · 단어 · 뜻 · 표현 · 표현뜻 · 예문 · 예문뜻</b> 이면 그대로 읽어요. (단어·뜻만 있어도 돼요)</p>
    <div class="picks" style="margin:4px 0 10px"><label class="pick"><input type="radio" name="nk" value="level" checked> 레벨 어휘 (C~J)</label><label class="pick"><input type="radio" name="nk" value="school"> 내신 교과어휘 (중1·2·3)</label></div>
    <input type="file" id="vf" accept=".xlsx,.xls,.csv,.tsv,.txt,.pdf">
    <div class="row" id="pdfr" style="display:none;margin-top:6px"><span class="tiny">PDF 쪽 범위</span><input type="number" id="pa" min="1" value="1" style="width:80px"> ~ <input type="number" id="pb" min="1" style="width:80px"><button class="btn ghost small" id="pread">PDF 글자 읽기</button></div>
    <label style="margin-top:10px">읽은 내용 (고쳐도 돼요 · 칸은 탭으로 나눠요)</label>
    <textarea id="vt" rows="9" placeholder="유닛	단어	뜻	표현	표현뜻	예문	예문뜻&#10;1	bright	밝은	bright star	밝은 별	The sun is bright.	해가 밝다."></textarea>
    <div class="setgrid" style="margin-top:10px">
      <div><label>단어장 이름</label><input type="text" id="nt" placeholder="예: 심쿵 어휘 E (초5)"></div>
      <div class="k-level"><label>레벨</label>${vtLevelSelect('nl', '')}</div>
      <div class="k-school" style="display:none"><label>학년</label>${vtGradeSelect('ng', '')}</div>
      <div class="k-school" style="display:none"><label>교과서 (출판사·저자)</label><input type="text" id="np" placeholder="예: 동아(윤정미)"></div>
      <div><label>유닛 칸이 없을 때 한 유닛 단어 수</label><input type="number" id="nz" min="5" max="60" value="20"><div class="tiny">초등 저학년 12~15개, 고학년·중등 20~24개를 권해요</div></div></div>
    <div id="vpv" style="margin-top:10px"></div>
    <div class="row" style="margin-top:12px"><button class="btn ghost" id="vchk">미리 보기</button><button class="btn" id="vmk" disabled>단어장 만들기 (비공개로 저장)</button><button class="btn ghost" id="vcx">취소</button></div>`);
  let file = null, parsed = [];
  const ta = m.querySelector('#vt');
  m.querySelector('#vcx').onclick = () => m.remove();
  m.querySelector('#nl').onchange = e => { const n = m.querySelector('#nz'); n.value = ['C', 'D'].includes(e.target.value) ? 15 : 20; };
  const kindOf = () => (m.querySelector('[name=nk]:checked') || {}).value || 'level';
  m.querySelectorAll('[name=nk]').forEach(r => r.onchange = () => {
    const sc = kindOf() === 'school';
    m.querySelectorAll('.k-school').forEach(x => x.style.display = sc ? '' : 'none'); m.querySelectorAll('.k-level').forEach(x => x.style.display = sc ? 'none' : '');
    m.querySelector('#nt').placeholder = sc ? '예: 중3 동아(윤정미) 교과어휘' : '예: 심쿵 어휘 E (초5)';
    preview();
  });
  m.querySelector('#vf').onchange = async e => {
    file = e.target.files[0]; if (!file) return;
    if (!m.querySelector('#nt').value) m.querySelector('#nt').value = file.name.replace(/\.[^.]+$/, '');
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    try {
      if (ext === 'pdf') { m.querySelector('#pdfr').style.display = 'flex'; ta.value = ''; toast('쪽 범위를 정하고 "PDF 글자 읽기"를 눌러 주세요'); return; }
      m.querySelector('#pdfr').style.display = 'none';
      if (ext === 'xlsx' || ext === 'xls') {
        const X = await vtLoadXlsx(); const wb = X.read(await file.arrayBuffer(), { type: 'array' });
        // 시트마다 따로 읽어요. 유닛 칸이 없고 시트가 여러 개면 시트 이름을 유닛 이름으로 써요.
        const multi = wb.SheetNames.length > 1;
        const list = wb.SheetNames.flatMap(sn => vtParseRows(X.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: '' })).map(x => ({ ...x, unit: x.unit || (multi ? sn : '') })));
        ta.value = vtToTsv(list);
      } else {
        const txt = await file.text();
        if (ext === 'csv') ta.value = vtToTsv(vtParseRows(vtCsv(txt)));
        else ta.value = vtToTsv(vtParseText(txt));
      }
      preview();
    } catch (err) { toast(errText(err), 4500); }
  };
  m.querySelector('#pread').onclick = async () => {
    if (!file) return;
    const b = m.querySelector('#pread'); b.disabled = true; b.textContent = '읽는 중…';
    try {
      const r = await pdfText(file, +m.querySelector('#pa').value || 1, +m.querySelector('#pb').value || 0);
      const list = vtParseText(r.text);
      if (!list.length) { ta.value = r.text.slice(0, 20000); toast('단어 줄을 자동으로 찾지 못했어요. 글을 고쳐서 "단어<탭>뜻" 형태로 만들어 주세요.', 6000); }
      else ta.value = vtToTsv(list);
      if (r.text.replace(/\s/g, '').length < 50) toast('글자를 거의 못 읽었어요. 스캔(사진) PDF는 읽을 수 없어요.', 6000);
      preview();
    } catch (err) { toast(errText(err), 4500); }
    b.disabled = false; b.textContent = 'PDF 글자 읽기';
  };
  const preview = () => {
    const txt = ta.value.trim();
    parsed = txt ? vtParseText(txt) : [];
    const size = Math.max(5, Math.min(60, +m.querySelector('#nz').value || 20));
    const units = vtGroupUnits(parsed, size, kindOf() === 'school');
    const noMean = parsed.filter(x => !x.meaning).length;
    const dup = parsed.length - new Set(parsed.map(x => vNorm(x.word))).size;
    m.querySelector('#vpv').innerHTML = parsed.length ? `<div class="result ok"><b>${units.length}${kindOf() === 'school' ? '과' : '유닛'} · 단어 ${parsed.length}개</b>${parsed.some(x => x.phrase) ? ` · 표현 ${parsed.filter(x => x.phrase).length}개` : ''}${parsed.some(x => x.example) ? ` · 예문 ${parsed.filter(x => x.example).length}개` : ''}</div>
      ${noMean ? `<div class="result bad">뜻이 비어 있는 단어가 ${noMean}개 있어요. 만들기 전에 채워 주세요.</div>` : ''}
      ${dup ? `<div class="result warn">같은 단어가 ${dup}번 겹쳐요. 뜻이 다른 다의어라면 그대로 두셔도 돼요. (같은 유닛 안의 같은 철자·같은 뜻은 어느 쪽으로 답해도 정답으로 처리돼요)</div>` : ''}
      <div class="tablewrap"><table><thead><tr><th>유닛</th><th>영어</th><th>뜻</th><th>표현</th><th>예문</th></tr></thead><tbody>${units.slice(0, 2).flatMap(u => u.items.slice(0, 5).map(x => `<tr><td>${esc(u.title)}</td><td>${esc(x.word)}</td><td>${esc(x.meaning)}</td><td>${esc(x.phrase)}</td><td class="tiny">${esc(x.example)}</td></tr>`)).join('')}</tbody></table></div>
      <div class="tiny">앞부분 일부만 보여요. 만든 뒤 단어장 화면에서 모두 고칠 수 있어요.</div>` : '<div class="result bad">읽은 단어가 없어요. 첫 줄 제목이나 "단어(탭)뜻" 형태를 확인해 주세요.</div>';
    m.querySelector('#vmk').disabled = !parsed.length || noMean > 0;
  };
  m.querySelector('#vchk').onclick = preview;
  m.querySelector('#vmk').onclick = async () => {
    const title = m.querySelector('#nt').value.trim(); if (!title) return toast('단어장 이름을 적어 주세요');
    const btn = m.querySelector('#vmk'); btn.disabled = true; btn.textContent = '만드는 중…';
    try {
      const size = Math.max(5, Math.min(60, +m.querySelector('#nz').value || 20));
      const school = kindOf() === 'school';
      const units = vtGroupUnits(parsed, size, school);
      const lv = m.querySelector('#nl').value;
      const rec = school ? { title, kind: 'school', school_grade: m.querySelector('#ng').value, publisher: m.querySelector('#np').value.trim(), grade_band: m.querySelector('#ng').value, status: 'draft' }
        : { title, kind: 'level', level: lv, grade_band: V_LEVEL_GRADE[lv] || '', status: 'draft' };
      const { data: bk, error: e1 } = await S.sb.from('vocab_books').insert(rec).select().single(); if (e1) throw e1;
      const { data: us, error: e2 } = await S.sb.from('vocab_units').insert(units.map((u, i) => ({ book_id: bk.id, ord: i + 1, title: u.title }))).select(); if (e2) throw e2;
      const uid = Object.fromEntries(us.map(u => [u.ord, u.id]));
      const rows = units.flatMap((u, i) => u.items.map((x, k) => { const sp = vtSplitAlts(x.word); return { unit_id: uid[i + 1], ord: k + 1, word: sp.word, alt_answers: sp.alts, meaning: x.meaning, pos: x.pos || '', phrase: x.phrase || '', phrase_ko: x.phrase_ko || '', example: x.example || '', example_ko: x.example_ko || '' }; }));
      for (let k = 0; k < rows.length; k += 400) { const { error } = await S.sb.from('vocab_items').insert(rows.slice(k, k + 400)); if (error) throw error; }
      m.remove(); toast(`단어장을 만들었어요 (${units.length}${school ? '과' : '유닛'} · ${rows.length}단어). 검수 후 공개해 주세요.`, 5000);
      VT.loaded = false; VT.sub = 'books'; VT.bookId = bk.id; VT.unitId = null; await tabVocab();
    } catch (err) { btn.disabled = false; btn.textContent = '단어장 만들기 (비공개로 저장)'; toast(errText(err), 5000); }
  };
}
function vtGroupUnits(list, size, school) {
  const hasUnit = list.some(x => x.unit), W = school ? 'Lesson ' : 'Unit ';
  if (hasUnit) {
    const order = [], map = new Map(); let cur = '';
    for (const x of list) { const k = x.unit || cur; cur = k; if (!map.has(k)) { map.set(k, []); order.push(k); } map.get(k).push(x); }
    return order.map(k => ({ title: /^\d+$/.test(k) ? W + k : k, items: map.get(k) }));
  }
  const out = []; for (let i = 0; i < list.length; i += size) out.push({ title: W + (out.length + 1), items: list.slice(i, i + size) });
  return out;
}
function vtCsv(txt) {
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (q) { if (c === '"' && txt[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && txt[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
async function vtTemplate() {
  try {
    const X = await vtLoadXlsx();
    const ws = X.utils.aoa_to_sheet([['유닛', '단어', '뜻', '표현', '표현뜻', '예문', '예문뜻'],
      [1, 'bright', '밝은, 똑똑한', 'bright star', '밝은 별', 'The stars are bright tonight.', '오늘 밤 별들이 밝다.'],
      [1, 'light', '밝은; 가벼운', 'light bag', '가벼운 가방', 'This bag is very light.', '이 가방은 아주 가볍다.'],
      [1, 'color / colour', '색', 'favorite color', '가장 좋아하는 색', 'What is your favorite color?', '네가 가장 좋아하는 색은 뭐니?'],
      [2, 'push', '밀다', 'push the door', '문을 밀다', 'Push the door to open it.', '문을 밀어서 열어라.']]);
    ws['!cols'] = [{ wch: 6 }, { wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 16 }, { wch: 34 }, { wch: 28 }];
    const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, '단어장'); X.writeFile(wb, '심쿵어휘_단어장_양식.xlsx');
  } catch (e) { toast(errText(e)); }
}

/* ---------- 시험지 인쇄 ---------- */
function vtPrint() {
  const books = VT.books.filter(b => vtUnits(b.id).length);
  if (!books.length) { $('#vb').innerHTML = '<div class="card muted">먼저 단어장을 만들어 주세요.</div>'; return; }
  const bid = VT.printBook && vtBook(VT.printBook) ? VT.printBook : books[0].id;
  const us = vtUnits(bid);
  $('#vb').innerHTML = `<div class="card"><h2>시험지 · 학습지 인쇄</h2>
    <div class="setgrid"><div><label>단어장</label><select id="pbk">${books.map(b => `<option value="${b.id}" ${b.id === bid ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select></div>
      <div><label>종류</label><select id="pk"><option value="en">뜻 보고 영어 쓰기</option><option value="ko">영어 보고 뜻 쓰기</option><option value="mix">섞어서 (반반)</option><option value="list">외우기용 단어 목록</option><option value="phrase">2단어 표현 빈칸 쓰기</option><option value="dict">받아쓰기 (원장님이 불러 줘요)</option></select></div>
      <div><label>문제 순서</label><select id="po"><option value="shuf">섞기</option><option value="ord">유닛 순서대로</option></select></div>
      <div><label class="pick"><input type="checkbox" id="pkey" checked> 정답지 함께 인쇄</label></div></div>
    <label style="margin-top:10px">${vtUnitWord(vtBook(bid))} 고르기</label><div class="uchips" id="pus">${us.map(u => `<label class="uchip pickable"><input type="checkbox" value="${u.id}"><span>${u.ord}</span><small>${vtItems(u.id).length}</small></label>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="pgo">인쇄 / PDF로 저장</button><span class="tiny">A4 · 여백 좁게 · 흑백 위주로 나와요. 인쇄 창에서 "PDF로 저장"을 고르면 PDF가 돼요.</span></div></div>`;
  $('#pbk').onchange = e => { VT.printBook = e.target.value; vtPrint(); };
  $('#pgo').onclick = () => {
    const ids = [...document.querySelectorAll('#pus input:checked')].map(i => i.value);
    if (!ids.length) return toast('유닛을 골라 주세요');
    let items = ids.flatMap(id => vtItems(id));
    const kind = $('#pk').value;
    if (kind === 'phrase') items = items.filter(i => i.phrase);
    if (!items.length) return toast(kind === 'phrase' ? '고른 유닛에 2단어 표현이 없어요' : '단어가 없어요');
    if ($('#po').value === 'shuf' && kind !== 'list') items = shuffle(items);
    const b = vtBook(bid), uo = ids.map(id => VT.units.find(u => u.id === id).ord).sort((a, c) => a - c);
    const W = b.kind === 'school' ? 'Lesson ' : 'Unit ';
    vtPrintSheet({ title: `${b.title} · ${uo.length > 2 ? `${W}${uo[0]}~${uo[uo.length - 1]}` : uo.map(o => W + o).join(', ')}`, items, kind, key: $('#pkey').checked });
  };
}
function vtPrintSheet({ title, items, kind, key, name }) {
  const kindName = { en: '뜻 보고 영어 쓰기', ko: '영어 보고 뜻 쓰기', mix: '영어 ↔ 뜻 쓰기', list: '외우기용 단어 목록', phrase: '2단어 표현 쓰기', dict: '받아쓰기' }[kind];
  const dirOf = (i) => kind === 'mix' ? (i % 2 ? 'ko' : 'en') : kind;
  const blankPhrase = it => { const re = new RegExp('\\b' + it.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i'); return re.test(it.phrase) ? it.phrase.replace(re, '_'.repeat(Math.max(6, it.word.length + 2))) : it.phrase + ' (' + '_'.repeat(8) + ')'; };
  const q = (it, i) => {
    const d = dirOf(i);
    if (kind === 'list') return `<div class="li"><span class="n">${i + 1}</span><b>${esc(it.word)}</b><span>${esc(it.meaning)}</span>${it.phrase ? `<i>${esc(it.phrase)} · ${esc(it.phrase_ko)}</i>` : ''}</div>`;
    if (kind === 'phrase') return `<div class="q"><span class="n">${i + 1}</span><span class="p">${esc(blankPhrase(it))}</span><span class="k">${esc(it.phrase_ko)}</span></div>`;
    if (kind === 'dict') return `<div class="q dq"><span class="n">${i + 1}</span><span class="line"></span><span class="k">(${esc(it.meaning)})</span></div>`;
    return `<div class="q"><span class="n">${i + 1}</span><span class="p">${esc(d === 'en' ? it.meaning : it.word)}</span><span class="line"></span></div>`;
  };
  const a = (it, i) => {
    const d = dirOf(i);
    return `<div class="a"><span class="n">${i + 1}</span>${esc(kind === 'phrase' || kind === 'dict' ? it.word : d === 'en' ? it.word + (it.alt_answers && it.alt_answers.length ? ' / ' + it.alt_answers.join(' / ') : '') : it.meaning)}</div>`;
  };
  const head = `<div class="hd"><div><b>스텔라의 심쿵영어</b> · ${esc(kindName)}</div><div>이름 <span class="nm">${name ? esc(name) : ''}</span> 날짜 <span class="dt"></span> 점수 <span class="sc"></span> / ${items.length}</div></div><h1>${esc(title)}</h1>`;
  const body = `${head}<div class="cols ${kind === 'list' ? 'list' : ''}">${items.map(q).join('')}</div>
    ${key && kind !== 'list' ? `<div class="pb"></div><div class="hd"><div><b>${kind === 'dict' ? '불러 줄 단어 · 정답' : '정답'}</b> · ${esc(title)}</div></div><div class="cols ans">${items.map(a).join('')}</div>` : ''}`;
  vtOpenPrint(title, body, `
    .hd{display:flex;justify-content:space-between;align-items:flex-end;font-size:9.5pt;border-bottom:1.5px solid #d4544b;padding-bottom:3px;gap:10px}
    .hd .nm,.hd .dt,.hd .sc{display:inline-block;min-width:70px;border-bottom:1px solid #999;margin-right:6px}
    h1{font-size:13pt;margin:6px 0 8px}
    .cols{column-count:2;column-gap:8mm;column-rule:1px solid #e5e5e5}
    .cols.ans{column-count:4;font-size:9.5pt}
    .q{display:flex;align-items:flex-end;gap:5px;break-inside:avoid;padding:5px 0 4px;border-bottom:1px dotted #ccc;font-size:10.5pt}
    .q .n,.a .n,.li .n{color:#d4544b;font-weight:700;min-width:20px;font-size:9pt}
    .q .p{flex:0 1 auto;max-width:60%}.q .k{color:#555;font-size:9pt;margin-left:auto}
    .q .line{flex:1;border-bottom:1px solid #777;min-width:30mm;height:14px}
    .a{break-inside:avoid;padding:1px 0}.a .n{margin-right:5px}
    .li{display:grid;grid-template-columns:20px 1fr 1fr;gap:4px;break-inside:avoid;padding:3px 0;border-bottom:1px dotted #ccc;font-size:10.5pt}.li i{grid-column:2/4;color:#555;font-size:9pt;font-style:normal}
    .q.dq .line{min-width:45mm}.q.dq .k{margin-left:6px;font-size:8.5pt;color:#888;max-width:35%}
    .pb{break-after:page}`);
}
function vtOpenPrint(title, body, css) {
  const w = window.open('', '_blank');
  if (!w) return toast('팝업이 막혀 있어요. 브라우저 주소창 옆에서 팝업을 허용해 주세요.', 5000);
  w.document.write(`<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page{size:A4;margin:9mm 10mm}*{box-sizing:border-box}body{font-family:'Pretendard','Malgun Gothic','Apple SD Gothic Neo','Noto Sans KR',sans-serif;color:#222;margin:0;font-size:10.5pt;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
    .bar{position:sticky;top:0;background:#fff;padding:8px;border-bottom:1px solid #ddd;text-align:right}.bar button{font:inherit;padding:6px 14px;border:1px solid #d4544b;background:#d4544b;color:#fff;border-radius:8px;cursor:pointer}
    .pg{max-width:190mm;margin:0 auto;padding:6mm 0}@media print{.bar{display:none}.pg{padding:0;max-width:none}}${css}</style></head>
    <body><div class="bar"><button onclick="print()">인쇄 / PDF로 저장</button></div><div class="pg">${body}</div></body></html>`);
  w.document.close();
  setTimeout(() => { try { w.focus(); w.print(); } catch (e) { /* 버튼으로 인쇄 */ } }, 400);
}
