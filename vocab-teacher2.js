/* 심쿵영어 어휘 학습 - 원장님 화면 추가 기능 (14단계)
   학습 시간 · 범위 시험 · 오답관리 · EGU 교재 가져오기 */
'use strict';

const vtMin = sec => Math.round((sec || 0) / 60);
const vtDur = sec => { const m = vtMin(sec); return m <= 0 ? (sec > 0 ? '1분 미만' : '-') : m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };
const vtNeed14 = e => `<div class="card"><h2>이 기능을 켜려면 14단계 DB 업데이트가 필요해요</h2>
  <p>설치 안내서의 <b>14단계</b>대로 Supabase SQL Editor에서 <code>schema14_egu_exam.sql</code> 을 한 번 실행해 주세요.</p><p class="tiny">${esc(errText(e))}</p></div>`;
const vtAsgStudents = () => T.students.filter(s => VT.asg.some(a => a.student_id === s.id));

/* ---------- 학습 시간 ---------- */
async function vtTime() {
  $('#vb').innerHTML = '<p class="muted">학습 시간을 불러오는 중…</p>';
  try { const r = await S.sb.rpc('vocab_time_overview', { p_days: 60 }); if (r.error) throw r.error; VT.time = r.data || []; }
  catch (e) { $('#vb').innerHTML = vtNeed14(e); return; }
  const today = kstToday(), d7 = addDays(today, -6), d30 = addDays(today, -29);
  const days14 = Array.from({ length: 14 }, (_, k) => addDays(today, k - 13));
  const rows = vtAsgStudents().map(s => {
    const mine = VT.time.filter(r => r.student_id === s.id);
    const sum = from => mine.filter(r => r.day >= from).reduce((n, r) => n + r.sec, 0);
    const byDay = Object.fromEntries(days14.map(d => [d, mine.filter(r => r.day === d).reduce((n, r) => n + r.sec, 0)]));
    const books = new Map();
    mine.filter(r => r.day >= d7).forEach(r => { const k = r.book_id || '-'; books.set(k, (books.get(k) || 0) + r.sec); });
    const last = mine.length ? mine.map(r => r.day).sort().pop() : null;
    return { s, t0: sum(today), t7: sum(d7), t30: sum(d30), byDay, books, last, days7: new Set(mine.filter(r => r.day >= d7 && r.sec > 0).map(r => r.day)).size };
  }).sort((a, b) => b.t7 - a.t7 || a.s.name.localeCompare(b.s.name, 'ko'));
  const active = rows.filter(r => r.t0 > 0).length, tot0 = rows.reduce((n, r) => n + r.t0, 0), tot7 = rows.reduce((n, r) => n + r.t7, 0);
  const max = Math.max(60 * 20, ...rows.flatMap(r => Object.values(r.byDay)));
  const bk = id => id === '-' ? '복습·기타' : (vtBook(id) || { title: '삭제된 교재' }).title;
  $('#vb').innerHTML = `
    <section class="kpis">
      <div class="kpi"><small>오늘 학습 시간 (전체)</small><b>${vtMin(tot0)}<em>분</em></b><span>${active}명 학습</span></div>
      <div class="kpi"><small>최근 7일 (전체)</small><b>${Math.round(vtMin(tot7) / 60 * 10) / 10}<em>시간</em></b><span>학생 평균 ${rows.length ? vtMin(tot7 / rows.length) : 0}분</span></div>
      <div class="kpi"><small>배정 학생</small><b>${rows.length}<em>명</em></b><span>오늘 미학습 ${rows.length - active}명</span></div>
    </section>
    <div class="card"><h3 style="margin:0 0 8px">학생별 학습 시간</h3>
    ${rows.length ? `<div class="tablewrap"><table><thead><tr><th>학생</th><th>오늘</th><th>7일</th><th>30일</th><th>최근 14일 (막대 = 하루)</th><th>7일 교재별</th><th>마지막</th></tr></thead><tbody>
      ${rows.map(r => `<tr class="clk" data-vstu="${r.s.id}"><td><b>${esc(r.s.name)}</b> <span class="tiny">${esc(r.s.grade)}</span></td>
        <td>${vtDur(r.t0)}</td><td><b>${vtDur(r.t7)}</b><div class="tiny">${r.days7}일 학습</div></td><td>${vtDur(r.t30)}</td>
        <td><div class="tbar">${days14.map(d => `<i title="${d.slice(5)} · ${vtDur(r.byDay[d])}" style="height:${Math.max(r.byDay[d] ? 3 : 1, r.byDay[d] / max * 28)}px;${r.byDay[d] ? '' : 'opacity:.25;background:#aaa'}"></i>`).join('')}</div></td>
        <td class="tiny">${[...r.books].sort((a, b) => b[1] - a[1]).map(([id, sec]) => `${esc(bk(id))} ${vtDur(sec)}`).join('<br>') || '-'}</td>
        <td class="tiny">${r.last ? r.last.slice(5) : '기록 없음'}</td></tr>`).join('')}</tbody></table></div>
      <p class="tiny" style="margin-top:8px">화면을 켜 두고 실제로 푼 시간이 쌓여요(한 단계 최대 60분). 학생 이름을 누르면 자세한 현황이 나와요.</p>`
      : '<p class="muted">아직 단어장을 배정한 학생이 없어요.</p>'}</div>`;
  document.querySelectorAll('[data-vstu]').forEach(el => el.onclick = () => vtStudent(el.dataset.vstu));
}

/* ---------- 범위 시험 ---------- */
const VT_EXAM_MODES = { choice_en: '뜻 보고 영어 고르기', choice_ko: '영어 보고 뜻 고르기', spell: '철자 쓰기', mix: '섞어서 (고르기 + 쓰기)' };
const VT_EXAM_PRINT = { choice_en: 'en', choice_ko: 'ko', spell: 'en', mix: 'mix' };
async function vtExamLoad() {
  const sb = S.sb;
  const [e, s, r] = await Promise.all([
    sb.from('vocab_exams').select('*').order('created_at', { ascending: false }),
    vFetchAll(() => sb.from('vocab_exam_students').select('*').order('exam_id').order('student_id')),
    vFetchAll(() => sb.from('vocab_exam_results').select('*').order('taken_at').order('id'))]);
  if (e.error) throw e.error;
  VT.ex = Object.assign(VT.ex || { f: {} }, { exams: e.data || [], stu: s, res: r });
}
const vtUnitLabel = (b, u) => (u && u.title ? String(u.title).split('·')[0].trim() : (b && b.kind === 'school' ? 'Lesson ' : 'Unit ') + (u ? u.ord : ''));
async function vtExam() {
  $('#vb').innerHTML = '<p class="muted">시험 자료를 불러오는 중…</p>';
  try { await vtExamLoad(); } catch (e) { $('#vb').innerHTML = vtNeed14(e); return; }
  vtExamDraw();
}
function vtExamDraw() {
  const X = VT.ex, f = X.f, books = VT.books.filter(b => vtUnits(b.id).length);
  if (!books.length) { $('#vb').innerHTML = '<div class="card muted">먼저 단어장을 만들어 주세요.</div>'; return; }
  if (!f.book || !vtBook(f.book)) {
    f.book = books[0].id; f.n = 30; f.mode = 'mix'; f.pass = 80; f.tries = 1; f.title = '';
    f.studs = new Set(VT.asg.filter(a => a.book_id === f.book).map(a => a.student_id));
  }
  const bk = vtBook(f.book), us = vtUnits(f.book);
  if (!f.from || !us.some(u => u.ord === f.from)) f.from = us[0].ord;
  if (!f.to || !us.some(u => u.ord === f.to) || f.to < f.from) f.to = us[Math.min(us.length - 1, 4)].ord < f.from ? f.from : us[Math.min(us.length - 1, 4)].ord;
  const range = us.filter(u => u.ord >= f.from && u.ord <= f.to).flatMap(u => vtItems(u.id));
  const opt = v => us.map(u => `<option value="${u.ord}" ${u.ord === v ? 'selected' : ''}>${esc(vtUnitLabel(bk, u))}${u.title && String(u.title).includes('·') ? ' · ' + esc(String(u.title).split('·').slice(1).join('·').trim().slice(0, 10)) : ''}</option>`).join('');
  const nameOf = id => (T.sById[id] || {}).name || '?';
  const cards = X.exams.map(e => {
    const eb = vtBook(e.book_id), sts = X.stu.filter(s => s.exam_id === e.id).map(s => s.student_id);
    const chips = sts.map(id => {
      const rs = X.res.filter(r => r.exam_id === e.id && r.student_id === id);
      const best = rs.length ? Math.max(...rs.map(r => r.pct)) : null, pass = rs.some(r => r.passed);
      return `<span class="wchip ${pass ? 'okc' : ''}"><b>${esc(nameOf(id))}</b> ${best == null ? '미응시' : best + '%' + (pass ? ' ✓' : '')}</span>`;
    }).join('');
    return `<div class="card"><div class="row between"><div><h3 style="margin:0">${esc(e.title)} ${e.open ? '' : '<span class="badge gray">닫힘</span>'}</h3>
      <div class="tiny">${eb ? esc(eb.title) + ' · ' : ''}${esc(e.range_note || '')} · ${e.item_ids.length}문제 · ${esc(VT_EXAM_MODES[e.mode])} · 통과 ${e.pass_pct}% · 기회 ${e.max_attempts}번 · ${fmtDT(e.created_at)}</div></div>
      <div class="row"><button class="btn small" data-xd="${e.id}">결과 보기</button><button class="btn small ghost" data-xp="${e.id}">시험지 인쇄</button>
      <button class="btn small ghost" data-xo="${e.id}">${e.open ? '닫기' : '열기'}</button><button class="btn small ghost" data-xx="${e.id}">삭제</button></div></div>
      <div class="wchips" style="margin-top:8px">${chips || '<span class="tiny">배정된 학생이 없어요</span>'}</div></div>`;
  }).join('');
  $('#vb').innerHTML = `<div class="card"><h2 style="margin:0 0 4px">📝 범위 시험 출제</h2>
    <div class="muted">원하는 교재와 범위를 정해 문제를 뽑으면, 고른 학생의 어휘 화면에 시험이 나타나요. 채점은 서버가 하고 틀린 단어는 자동으로 오답관리에 들어가요.</div>
    <div class="setgrid" style="margin-top:10px">
      <div><label>교재</label><select id="xb">${books.map(b => `<option value="${b.id}" ${b.id === f.book ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select></div>
      <div><label>시작</label><select id="xf">${opt(f.from)}</select></div>
      <div><label>끝</label><select id="xt">${opt(f.to)}</select></div>
      <div><label>문제 수</label><input type="number" id="xn" min="5" max="200" value="${f.n}"><div class="tiny">범위 안 단어 ${range.length}개에서 무작위로 뽑아요</div></div>
      <div><label>문제 유형</label><select id="xm">${Object.entries(VT_EXAM_MODES).map(([k, v]) => `<option value="${k}" ${k === f.mode ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <div><label>통과 기준 (%)</label><input type="number" id="xp" min="1" max="100" value="${f.pass}"></div>
      <div><label>응시 기회 (번)</label><input type="number" id="xr" min="1" max="20" value="${f.tries}"></div>
      <div><label>시험 이름 (비우면 자동)</label><input type="text" id="xtl" value="${esc(f.title)}" placeholder="${esc(bk.title)} ${esc(vtUnitLabel(bk, us.find(u => u.ord === f.from)))}~${esc(vtUnitLabel(bk, us.find(u => u.ord === f.to)))} 시험"></div></div>
    <label style="margin-top:10px">응시 학생 <button class="btn ghost small" id="xall" type="button">이 교재 배정 학생 전체</button></label>
    <div class="picks" id="xs">${T.students.map(s => `<label class="pick"><input type="checkbox" value="${s.id}" ${f.studs.has(s.id) ? 'checked' : ''}> ${esc(s.name)} <span class="tiny">${esc(s.grade)}</span></label>`).join('')}</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="xgo">시험 출제하기</button><button class="btn ghost" id="xpr">종이 시험지만 인쇄</button></div></div>
    <h2 class="sect">출제한 시험</h2>${cards || '<div class="card muted">아직 출제한 시험이 없어요.</div>'}`;
  const keep = () => {
    f.n = +$('#xn').value || 30; f.mode = $('#xm').value; f.pass = +$('#xp').value || 80; f.tries = +$('#xr').value || 1; f.title = $('#xtl').value.trim();
    f.studs = new Set([...document.querySelectorAll('#xs input:checked')].map(i => i.value));
  };
  $('#xb').onchange = e => { keep(); f.book = e.target.value; f.from = f.to = null; f.studs = new Set(VT.asg.filter(a => a.book_id === f.book).map(a => a.student_id)); vtExamDraw(); };
  $('#xf').onchange = e => { keep(); f.from = +e.target.value; if (f.to < f.from) f.to = f.from; vtExamDraw(); };
  $('#xt').onchange = e => { keep(); f.to = +e.target.value; if (f.to < f.from) f.from = f.to; vtExamDraw(); };
  $('#xall').onclick = () => { keep(); f.studs = new Set(VT.asg.filter(a => a.book_id === f.book).map(a => a.student_id)); vtExamDraw(); };
  const pickItems = () => { keep(); const its = shuffle(range).slice(0, Math.max(1, Math.min(f.n, range.length))); return its; };
  const label = () => { const a = vtUnitLabel(bk, us.find(u => u.ord === f.from)), b = vtUnitLabel(bk, us.find(u => u.ord === f.to)); return a === b ? a : `${a} ~ ${b}`; };
  $('#xpr').onclick = () => {
    const its = pickItems(); if (!its.length) return toast('범위 안에 단어가 없어요');
    vtPrintSheet({ title: f.title || `${bk.title} · ${label()} 시험`, items: its, kind: VT_EXAM_PRINT[f.mode], key: true });
  };
  $('#xgo').onclick = async () => {
    const its = pickItems(); if (!its.length) return toast('범위 안에 단어가 없어요');
    if (!f.studs.size) return toast('응시할 학생을 골라 주세요');
    $('#xgo').disabled = true;
    try {
      const ex = await S.sb.from('vocab_exams').insert({ book_id: f.book, title: f.title || `${bk.title} ${label()} 시험`, range_note: label(), item_ids: its.map(i => i.id),
        mode: f.mode, pass_pct: Math.max(1, Math.min(100, f.pass)), max_attempts: Math.max(1, Math.min(20, f.tries)) }).select().single();
      if (ex.error) throw ex.error;
      const st = await S.sb.from('vocab_exam_students').insert([...f.studs].map(id => ({ exam_id: ex.data.id, student_id: id })));
      if (st.error) { await S.sb.from('vocab_exams').delete().eq('id', ex.data.id); throw st.error; }
      toast(`${f.studs.size}명에게 시험 ${its.length}문제를 냈어요`); f.title = '';
      await vtExamLoad(); vtExamDraw();
    } catch (e) { toast(errText(e), 5000); $('#xgo').disabled = false; }
  };
  document.querySelectorAll('[data-xd]').forEach(b => b.onclick = () => vtExamDetail(b.dataset.xd));
  document.querySelectorAll('[data-xp]').forEach(b => b.onclick = () => {
    const e = X.exams.find(x => x.id === b.dataset.xp), ids = new Set(e.item_ids), its = e.item_ids.map(id => VT.items.find(i => i.id === id)).filter(Boolean);
    if (!its.length) return toast('단어를 찾을 수 없어요');
    vtPrintSheet({ title: e.title, items: its, kind: VT_EXAM_PRINT[e.mode], key: true });
  });
  document.querySelectorAll('[data-xo]').forEach(b => b.onclick = async () => {
    const e = X.exams.find(x => x.id === b.dataset.xo);
    const { error } = await S.sb.from('vocab_exams').update({ open: !e.open }).eq('id', e.id);
    if (error) return toast(errText(error)); e.open = !e.open; vtExamDraw();
  });
  document.querySelectorAll('[data-xx]').forEach(b => b.onclick = async () => {
    const e = X.exams.find(x => x.id === b.dataset.xx);
    if (!confirm(`'${e.title}' 시험을 삭제할까요? 학생들의 시험 결과도 함께 사라져요. (틀린 단어 기록은 남아요)`)) return;
    const { error } = await S.sb.from('vocab_exams').delete().eq('id', e.id);
    if (error) return toast(errText(error)); await vtExamLoad(); vtExamDraw();
  });
}
async function vtExamDetail(id) {
  const X = VT.ex, e = X.exams.find(x => x.id === id); if (!e) return;
  const m = modal('<p class="muted">불러오는 중…</p>');
  const sts = X.stu.filter(s => s.exam_id === id).map(s => s.student_id), res = X.res.filter(r => r.exam_id === id);
  let ans = [];
  try { const runs = res.map(r => r.run_id); if (runs.length) ans = await vFetchAll(() => S.sb.from('vocab_answers').select('id,item_id,is_correct,run_id,submitted_at').in('run_id', runs).eq('step', 'exam').order('submitted_at').order('id')); } catch (er) { /* 문항 분석만 빠져요 */ }
  const first = new Map(); ans.forEach(a => { const k = a.run_id + a.item_id; if (!first.has(k)) first.set(k, a); });
  const per = new Map();
  for (const a of first.values()) { const p = per.get(a.item_id) || { n: 0, bad: 0 }; p.n++; if (!a.is_correct) p.bad++; per.set(a.item_id, p); }
  const hard = [...per.entries()].filter(([, p]) => p.bad).sort((a, b) => b[1].bad / b[1].n - a[1].bad / a[1].n || b[1].bad - a[1].bad).slice(0, 20);
  const rowsH = sts.map(sid => {
    const rs = res.filter(r => r.student_id === sid).sort((a, b) => new Date(a.taken_at) - new Date(b.taken_at)), last = rs[rs.length - 1], best = rs.length ? Math.max(...rs.map(r => r.pct)) : null;
    return `<tr><td><b>${esc((T.sById[sid] || {}).name || '?')}</b></td><td>${rs.length}/${e.max_attempts}</td><td>${best == null ? '-' : best + '%'}</td>
      <td>${last ? `${last.score}/${last.total} · ${last.pct}%` : '-'}</td><td>${last ? (last.passed ? '<span class="badge ok">통과</span>' : '<span class="badge bad">미통과</span>') : '<span class="badge gray">미응시</span>'}</td>
      <td>${last ? vtDur(last.time_sec) : '-'}</td><td>${last ? fmtDT(last.taken_at) : '-'}</td><td>${rs.length ? `<button class="btn ghost small" data-rs="${sid}">다시 보게 하기</button>` : ''}</td></tr>`;
  }).join('');
  m.querySelector('.modal').innerHTML = `<div class="row between"><h2 style="margin:0">${esc(e.title)}</h2><button class="btn ghost small" id="x">닫기</button></div>
    <div class="tiny">${e.item_ids.length}문제 · 통과 ${e.pass_pct}% · ${esc(VT_EXAM_MODES[e.mode])}</div>
    <div class="tablewrap" style="margin-top:10px"><table><thead><tr><th>학생</th><th>응시</th><th>최고</th><th>최근 점수</th><th>결과</th><th>걸린 시간</th><th>응시일</th><th></th></tr></thead><tbody>${rowsH || '<tr><td colspan="8" class="muted">배정된 학생이 없어요</td></tr>'}</tbody></table></div>
    <h3 style="margin-top:14px">많이 틀린 문제</h3>
    ${hard.length ? `<div class="tablewrap"><table><thead><tr><th>단어</th><th>뜻</th><th>틀린 학생</th></tr></thead><tbody>${hard.map(([iid, p]) => { const it = VT.items.find(i => i.id === iid) || {}; return `<tr><td><b>${esc(it.word || '')}</b></td><td>${esc(it.meaning || '')}</td><td>${p.bad}/${p.n}명 (${Math.round(p.bad / p.n * 100)}%)</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="tiny">아직 틀린 문제가 없거나 응시한 학생이 없어요.</p>'}`;
  m.querySelector('#x').onclick = () => m.remove();
  m.querySelectorAll('[data-rs]').forEach(b => b.onclick = async () => {
    if (!confirm('이 학생의 시험 결과를 지우고 다시 볼 수 있게 할까요?')) return;
    const { error } = await S.sb.rpc('vocab_exam_reset', { p_exam: id, p_student: b.dataset.rs });
    if (error) return toast(errText(error));
    X.res = X.res.filter(r => !(r.exam_id === id && r.student_id === b.dataset.rs)); toast('다시 볼 수 있어요'); m.remove(); vtExamDetail(id);
  });
}

/* ---------- 오답관리 ---------- */
async function vtWrong() {
  const W = VT.wr = Object.assign({ sid: '', days: 90, open: true, sel: new Set(), rows: [] }, VT.wr || {});
  $('#vb').innerHTML = '<p class="muted">틀린 단어를 모으는 중…</p>';
  try { const r = await S.sb.rpc('vocab_wrong_manage', { p_student: W.sid || null, p_days: W.days }); if (r.error) throw r.error; W.rows = r.data || []; }
  catch (e) { $('#vb').innerHTML = vtNeed14(e); return; }
  vtWrongDraw();
}
function vtWrongDraw() {
  const W = VT.wr, key = r => r.student_id + '|' + r.item_id;
  const resolved = r => r.last_ok && (r.box || 0) >= 3;
  const rows = W.rows.filter(r => !W.open || !resolved(r));
  const stus = vtAsgStudents(), boxName = ['1일', '3일', '7일', '14일', '30일', '완전'];
  const nResolved = W.rows.filter(resolved).length;
  $('#vb').innerHTML = `<div class="card"><div class="row between"><div><h2 style="margin:0">오답관리</h2>
      <div class="muted">학생이 틀린 단어를 모아 보고, 다시 외우게 하거나 재시험·시험지로 만들어요. <b>해결</b>은 마지막에 맞혔고 복습 상자가 3단계 이상인 단어예요.</div></div></div>
    <div class="setgrid" style="margin-top:10px">
      <div><label>학생</label><select id="ws"><option value="">전체 학생</option>${stus.map(s => `<option value="${s.id}" ${W.sid === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
      <div><label>기간</label><select id="wd">${[30, 90, 180].map(d => `<option value="${d}" ${W.days === d ? 'selected' : ''}>최근 ${d}일</option>`).join('')}</select></div>
      <div><label class="pick"><input type="checkbox" id="wo" ${W.open ? 'checked' : ''}> 아직 해결 못 한 단어만</label><div class="tiny">해결한 단어 ${nResolved}개 숨김</div></div></div>
    <div class="row" style="margin:10px 0"><button class="btn" id="wq">오늘 복습에 다시 넣기</button><button class="btn ghost" id="wx">재시험 출제</button><button class="btn ghost" id="wp">시험지 인쇄</button>
      <span class="tiny" id="wsel">${W.sel.size ? W.sel.size + '개 선택' : '체크하지 않으면 보이는 단어 전체'}</span></div>
    ${rows.length ? `<div class="tablewrap"><table><thead><tr><th><input type="checkbox" id="wall"></th>${W.sid ? '' : '<th>학생</th>'}<th>단어</th><th>뜻</th><th>교재 · 유닛</th><th>틀림/전체</th><th>마지막 오답</th><th>복습 상자</th><th>상태</th></tr></thead><tbody>
      ${rows.map(r => { const bk = vtBook(r.book_id); return `<tr><td><input type="checkbox" data-wk="${key(r)}" ${W.sel.has(key(r)) ? 'checked' : ''}></td>${W.sid ? '' : `<td>${esc((T.sById[r.student_id] || {}).name || '?')}</td>`}
        <td><b>${esc(r.word)}</b></td><td>${esc(r.meaning)}</td><td class="tiny">${bk ? esc(bk.title) + ' · ' : ''}${r.unit_ord}</td><td>${r.wrong}/${r.total}</td><td class="tiny">${r.last_wrong ? fmtDT(r.last_wrong) : '-'}</td>
        <td>${r.box ? boxName[r.box - 1] : '-'}</td><td>${resolved(r) ? '<span class="badge ok">해결</span>' : '<span class="badge bad">미해결</span>'}</td></tr>`; }).join('')}</tbody></table></div>`
      : '<p class="muted">조건에 맞는 틀린 단어가 없어요. 👏</p>'}</div>`;
  $('#ws').onchange = e => { W.sid = e.target.value; W.sel.clear(); vtWrong(); };
  $('#wd').onchange = e => { W.days = +e.target.value; W.sel.clear(); vtWrong(); };
  $('#wo').onchange = e => { W.open = e.target.checked; vtWrongDraw(); };
  if ($('#wall')) $('#wall').onchange = e => { document.querySelectorAll('[data-wk]').forEach(c => { c.checked = e.target.checked; e.target.checked ? W.sel.add(c.dataset.wk) : W.sel.delete(c.dataset.wk); }); $('#wsel').textContent = W.sel.size ? W.sel.size + '개 선택' : '체크하지 않으면 보이는 단어 전체'; };
  document.querySelectorAll('[data-wk]').forEach(c => c.onchange = () => { c.checked ? W.sel.add(c.dataset.wk) : W.sel.delete(c.dataset.wk); $('#wsel').textContent = W.sel.size ? W.sel.size + '개 선택' : '체크하지 않으면 보이는 단어 전체'; });
  const chosen = () => W.sel.size ? rows.filter(r => W.sel.has(key(r))) : rows;
  $('#wq').onclick = async () => {
    const ch = chosen(); if (!ch.length) return toast('단어가 없어요');
    const by = new Map(); ch.forEach(r => by.set(r.student_id, (by.get(r.student_id) || []).concat(r.item_id)));
    try { for (const [sid, ids] of by) { const { error } = await S.sb.rpc('vocab_wrong_requeue', { p_student: sid, p_items: ids }); if (error) throw error; } toast(`${ch.length}개를 오늘 복습에 넣었어요`); }
    catch (e) { toast(errText(e), 4000); }
  };
  $('#wp').onclick = () => {
    const ch = chosen(), ids = [...new Set(ch.map(r => r.item_id))], its = ids.map(id => VT.items.find(i => i.id === id)).filter(Boolean);
    if (!its.length) return toast('단어가 없어요');
    const one = W.sid ? (T.sById[W.sid] || {}).name : '';
    vtPrintSheet({ title: `${one ? one + ' · ' : ''}틀린 단어 다시 쓰기`, items: shuffle(its), kind: 'mix', key: true, name: one });
  };
  $('#wx').onclick = async () => {
    const ch = chosen(); if (!ch.length) return toast('단어가 없어요');
    const ids = [...new Set(ch.map(r => r.item_id))], sids = [...new Set(ch.map(r => r.student_id))];
    const books = [...new Set(ch.map(r => r.book_id))], one = sids.length === 1 ? (T.sById[sids[0]] || {}).name : '';
    const title = `${one ? one + ' ' : ''}오답 재시험 (${ids.length}문제)`;
    if (!confirm(`${title}\n응시 학생 ${sids.length}명에게 낼까요?`)) return;
    try {
      const ex = await S.sb.from('vocab_exams').insert({ book_id: books.length === 1 ? books[0] : null, title, range_note: '오답 모음', item_ids: shuffle(ids), mode: 'mix', pass_pct: 80, max_attempts: 2 }).select().single();
      if (ex.error) throw ex.error;
      const st = await S.sb.from('vocab_exam_students').insert(sids.map(id => ({ exam_id: ex.data.id, student_id: id })));
      if (st.error) { await S.sb.from('vocab_exams').delete().eq('id', ex.data.id); throw st.error; }
      toast('재시험을 냈어요. 시험 탭에서 결과를 볼 수 있어요', 4000);
    } catch (e) { toast(errText(e), 5000); }
  };
}

/* ---------- EGU 영단어&품사 1권 가져오기 ---------- */
async function vtImportEgu() {
  if (VT.books.some(b => /EGU/i.test(b.title)) && !confirm('EGU 단어장이 이미 있어요. 하나 더 만들까요?')) return;
  const m = modal('<h2>EGU 영단어&품사 1권 가져오기</h2><div class="progress" style="margin:10px 0"><i id="pg" style="width:2%"></i></div><p class="tiny" id="pt">교재 파일을 읽는 중…</p>');
  const say = (p, t) => { m.querySelector('#pg').style.width = p + '%'; m.querySelector('#pt').textContent = t; };
  let bookId = null;
  try {
    const res = await fetch('egu/vocab_import.json?v=' + Date.now());
    if (!res.ok) throw new Error('교재 파일을 찾을 수 없어요');
    const data = await res.json();
    const bk = await S.sb.from('vocab_books').insert({ ...data.book, status: 'published' }).select().single();
    if (bk.error) throw bk.error;
    bookId = bk.data.id; say(10, '유닛을 만드는 중…');
    const ur = await S.sb.from('vocab_units').insert(data.units.map(u => ({ book_id: bookId, ord: u.ord, title: u.title }))).select();
    if (ur.error) throw ur.error;
    const uid = new Map(ur.data.map(u => [u.ord, u.id]));
    const rows = [];
    data.units.forEach(u => u.items.forEach((it, k) => rows.push({ unit_id: uid.get(u.ord), ord: k + 1, word: it.word, meaning: it.meaning, pos: it.pos, pos_list: it.pos_list, forms: it.forms,
      phrase: it.phrase, phrase_ko: it.phrase_ko, example: it.example, example_ko: it.example_ko, sent_blank: it.sent_blank, sent_answer: it.sent_answer,
      audio_word: it.audio_word, audio_phrase: it.audio_phrase, audio_example: it.audio_example })));
    for (let k = 0; k < rows.length; k += 200) {
      const { error } = await S.sb.from('vocab_items').insert(rows.slice(k, k + 200)); if (error) throw error;
      say(10 + Math.round((k + 200) / rows.length * 88), `단어 ${Math.min(k + 200, rows.length)} / ${rows.length}개 저장 중…`);
    }
    say(100, '완료!'); VT.loaded = false; m.remove();
    toast('EGU 1권을 넣었어요. 배정 탭에서 학생에게 배정해 주세요', 5000); tabVocab();
  } catch (e) {
    if (bookId) await S.sb.from('vocab_books').delete().eq('id', bookId);
    m.remove(); toast('가져오기에 실패했어요: ' + errText(e), 6000);
  }
}
