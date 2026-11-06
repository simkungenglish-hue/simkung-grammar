/* 심쿵영어 문법 학습 - 원장님 화면 (학생 상세 · 리포트 · 문항 관리 · 설정) */
'use strict';

/* ---------- 학생 목록 / 상세 ---------- */
function tabStudents() {
  T.view = null;
  $('#tb').innerHTML = `<div class="card"><h2>학생</h2>${T.students.map(s => `<div class="stage" style="margin-bottom:8px"><div><b>${esc(s.name)}</b> <span class="tiny">${esc(s.grade)}</span><div>${progressChips(s.id)}</div></div>
    <button class="btn small" data-s="${s.id}">상세 · 리포트</button></div>`).join('') || '<p class="muted">학생이 없어요.</p>'}</div>`;
  document.querySelectorAll('[data-s]').forEach(b => b.onclick = () => studentDetail(b.dataset.s));
}
function helpLabel(h) { return { none: '없음', hint: '힌트', explanation: '해설' }[h] || h; }
function statusLabel(a) { return a.status === 'needs_review' ? '<span class="badge warn">대기</span>' : a.is_correct ? '<span class="badge ok">정답</span>' : '<span class="badge bad">오답</span>'; }
function studentDetail(sid) {
  T.view = sid;
  const s = T.sById[sid], at = (T.byStu.get(sid) || []).slice(0, 150);
  const stageRows = T.asg.filter(a => a.student_id === sid).map(a => {
    const u = T.uById[a.unit_id];
    return `<tr><td>${esc(u ? unitLabel(u) : '?')}</td>${STAGES.map(([k]) => {
      const sm = tStage(a, k);
      if (!sm.total) return '<td class="muted">-</td>';
      if (!sm.started) return '<td class="muted">시작 전</td>';
      return `<td>${sm.finished ? (sm.waiting ? '<span class="badge warn">대기</span>' : sm.passed ? '<span class="badge ok">통과</span>' : '<span class="badge bad">미통과</span>') : '진행'} ${sm.done}/${sm.total}${sm.pct !== null ? ` · ${sm.pct}%` : ''}</td>`;
    }).join('')}</tr>`;
  }).join('');
  const notes = T.notes.filter(n => n.student_id === sid);
  const allAt = T.byStu.get(sid) || [];
  const roundRows = T.asg.filter(a => a.student_id === sid).map(a => {
    const u = T.uById[a.unit_id], mine = allAt.filter(x => x.assignment_id === a.id), cr = a.current_round || 1, out = [];
    for (let r = 1; r <= cr; r++) {
      const rs = mine.filter(x => (x.round || 1) === r);
      const byQ = new Map(); rs.slice().sort((x, y) => x.attempt_no - y.attempt_no).forEach(x => { if (!byQ.has(x.question_id)) byQ.set(x.question_id, []); byQ.get(x.question_id).push(x); });
      const g = [...byQ.values()].filter(arr => arr[0].status === 'graded');
      const f = g.filter(arr => arr[0].is_correct).length, l = g.filter(arr => { const z = arr[arr.length - 1]; return z.status === 'graded' && z.is_correct; }).length;
      const days = new Set(rs.map(x => dayKey(x.submitted_at))).size;
      out.push(`<tr><td>${esc(u ? unitLabel(u) : '?')}</td><td>${r}회차${r === cr ? ' <span class="badge ok">현재</span>' : ''}</td><td>${rs.length ? byQ.size + '문제 · 제출 ' + rs.length + '회' : '<span class="muted">풀이 없음</span>'}</td>
        <td>${g.length >= MIN_OVERALL ? pct(f, g.length) + '%' : (rs.length ? '<span class="muted">평가 자료 부족</span>' : '-')}</td><td>${g.length >= MIN_OVERALL ? pct(l, g.length) + '%' : '-'}</td>
        <td>${rs.length ? timeCell(rs) : '-'}</td><td>${rs.length ? days + '일' : '-'}</td></tr>`);
    }
    return out.join('');
  }).join('');
  const tAll = timeSum(allAt), perDay = new Map();
  const hm = d => new Date(d).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  allAt.forEach(x => {
    const d = dayKey(x.submitted_at), u = (T.qById[x.question_id] || {}).unit_id || '', k = u + '|' + (x.round || 1);
    if (!perDay.has(d)) perDay.set(d, new Map());
    const m = perDay.get(d); if (!m.has(k)) m.set(k, []); m.get(k).push(x);
  });
  const dayRows = [...perDay].sort((x, y) => y[0].localeCompare(x[0])).slice(0, 30).map(([d, m]) => {
    const all = [...m.values()].flat(), tt = timeSum(all), times = all.map(x => new Date(x.submitted_at).getTime());
    const head = `<tr style="background:#f4f4f4"><td><b>${esc(d)}</b></td><td colspan="2"><b>하루 합계</b></td><td><b>${all.length}회</b></td><td>${hm(Math.min(...times))} ~ ${hm(Math.max(...times))}</td><td><b>${tt.n ? fmtDur(tt.sec) : '<span class="muted">기록 없음</span>'}</b></td></tr>`;
    const body = [...m].map(([k, arr]) => { const [u, r] = k.split('|'), ts = arr.map(x => new Date(x.submitted_at).getTime());
      return `<tr><td></td><td>${esc(unitLabel(T.uById[u]) || '?')}</td><td>${r}회차</td><td>${arr.length}회</td><td>${hm(Math.min(...ts))} ~ ${hm(Math.max(...ts))}</td><td>${timeCell(arr)}</td></tr>`; }).join('');
    return head + body;
  }).join('');
  $('#tb').innerHTML = `<p><a href="#" id="bk">← 학생 목록</a></p><div class="card"><div class="row between"><h2 style="margin:0">${esc(s.name)} <span class="tiny">${esc(s.grade)}</span></h2>
    <div class="row"><button class="btn" id="rep">성장 리포트 만들기</button><button class="btn" id="wn">오답노트 만들기</button><button class="btn ghost" id="csv">풀이 기록 CSV</button></div></div></div>
    <div class="card"><h3>단원·단계 진행</h3><div class="tablewrap"><table><thead><tr><th>단원</th>${STAGES.map(x => `<th>${x[1]}</th>`).join('')}</tr></thead><tbody>${stageRows || '<tr><td colspan="7" class="muted">배정 없음</td></tr>'}</tbody></table></div></div>
    <div class="card"><h3>회차별 결과 <span class="tiny">(다시 학습할 때마다 새 회차로 쌓이고, 이전 기록은 그대로 보존돼요)</span></h3>
    <div class="tablewrap"><table><thead><tr><th>단원</th><th>회차</th><th>푼 양</th><th>처음 정답률</th><th>최종 정답률</th><th>학습 시간</th><th>공부한 날</th></tr></thead><tbody>${roundRows || '<tr><td colspan="7" class="muted">배정 없음</td></tr>'}</tbody></table></div>
    <p class="tiny">정답률은 채점이 끝난 문제가 ${MIN_OVERALL}개 이상일 때만 보여요. 새 회차는 과제 배정 탭의 “다시 학습시키기”로 시작해요.</p></div>
    <div class="card"><h3>학습 시간</h3>${tAll.n ? `<p>전체 <b>${fmtDur(tAll.sec)}</b> <span class="tiny">(시간이 측정된 풀이 ${tAll.n}건 기준${tAll.n < tAll.total ? ', 측정 전 기록 ' + (tAll.total - tAll.n) + '건 제외' : ''})</span></p>
    <div class="tablewrap"><table><thead><tr><th>날짜</th><th>단원</th><th>회차</th><th>제출</th><th>제출 시각(처음~마지막)</th><th>학습 시간</th></tr></thead><tbody>${dayRows}</tbody></table></div><p class="tiny">날짜별로 하루 합계와 단원·회차별 내역을 보여요. 최근 30일까지 표시해요. 3분 이상 조작이 없거나 다른 화면을 본 시간은 빼고, 문제당 최대 30분까지만 세요.</p>` : '<p class="muted">아직 측정된 학습 시간이 없어요. 학생이 이 기능이 적용된 뒤 문제를 풀면 기록돼요.</p>'}</div>
    <div class="card"><h3>이름·학년 수정</h3><div class="row"><input type="text" id="pn" value="${esc(s.name)}" style="max-width:220px"><input type="text" id="pg" value="${esc(s.grade)}" style="max-width:120px" placeholder="학년"><button class="btn small" id="ps">저장</button></div></div>
    <div class="card"><h3>메모 (원장님만 볼 수 있어요)</h3><textarea id="nb" placeholder="상담 내용, 특이사항 등"></textarea>
    <div class="row" style="margin:8px 0"><button class="btn small" id="ns">메모 저장</button></div>
    ${notes.map(n => `<div class="tiny" style="border-top:1px solid var(--line);padding:6px 0">${fmtDT(n.created_at)} · ${esc(n.body)}</div>`).join('')}</div>
    <div class="card"><h3>최근 풀이 기록 (최대 150건)</h3><div class="tablewrap"><table><thead><tr><th>시각</th><th>단계</th><th>문제</th><th>학생 답</th><th>결과</th><th>점수</th><th>도움</th><th>시간</th><th></th></tr></thead><tbody>
    ${at.map(a => { const q = T.qById[a.question_id] || {}; return `<tr><td>${fmtDT(a.submitted_at)}</td><td>${STAGE_NAME[a.stage] || a.stage}<div class="tiny">${(a.round || 1) > 1 ? a.round + '회차 · ' : ''}${a.attempt_no}번째</div></td><td>${esc(q.prompt)}</td><td>${esc(a.answer)}</td><td>${statusLabel(a)}</td><td>${a.score ?? '-'}/${a.max_score}${a.graded_by === 'teacher' ? '<div class="tiny">원장님</div>' : ''}</td><td>${helpLabel(a.help_used)}</td><td>${a.time_spent_sec != null ? fmtDur(a.time_spent_sec) : '<span class="muted">-</span>'}</td><td><button class="btn small ghost" data-g="${a.id}">수정</button></td></tr>`; }).join('') || '<tr><td colspan="9" class="muted">아직 풀이 기록이 없어요</td></tr>'}</tbody></table></div></div>`;
  $('#bk').onclick = e => { e.preventDefault(); tabStudents(); };
  $('#rep').onclick = () => reportView(sid);
  $('#wn').onclick = () => wrongView(sid);
  $('#csv').onclick = () => exportCsv(T.attempts.filter(a => a.student_id === sid), `풀이기록_${s.name}.csv`);
  $('#ps').onclick = async () => {
    const name = $('#pn').value.trim(); if (!name) return toast('이름을 입력해 주세요');
    const { error } = await S.sb.from('profiles').update({ name, grade: $('#pg').value.trim() }).eq('id', sid);
    if (error) return toast(errText(error));
    toast('저장했어요'); await loadTeacher(); studentDetail(sid);
  };
  $('#ns').onclick = async () => {
    const body = $('#nb').value.trim(); if (!body) return;
    const { error } = await S.sb.from('teacher_notes').insert({ student_id: sid, kind: 'memo', body });
    if (error) return toast(errText(error));
    await loadTeacher(); studentDetail(sid);
  };
  document.querySelectorAll('[data-g]').forEach(b => b.onclick = async () => { if (!Object.keys(T.keys).length) await loadKeys(); gradeModal(b.dataset.g); });
}

/* ---------- 성장 리포트 (저장된 기록으로만 계산 → 그림·표로 보여 주고, 인쇄/PDF/공유 링크로 내보내요) ---------- */
function buildSnap(sid, days = 0, rnd = 0) {
  const s = T.sById[sid];
  const since = days ? Date.now() - days * 86400000 : 0;
  const mine = T.byStu.get(sid) || [];
  const allRounds = [...new Set(mine.map(a => a.round || 1))].sort((x, y) => x - y);
  const at = mine.filter(a => new Date(a.submitted_at).getTime() >= since && (!rnd || (a.round || 1) === rnd)).sort((a, b) => new Date(a.submitted_at) - new Date(b.submitted_at));
  const byQ = new Map();
  for (const a of at) { const k = a.question_id + '|' + (a.round || 1); if (!byQ.has(k)) byQ.set(k, []); byQ.get(k).push(a); }   // 같은 문제도 회차마다 따로 계산
  const qList = [...byQ.entries()].map(([k, arr]) => ({ q: T.qById[k.split('|')[0]] || {}, arr, first: arr[0], fin: arr[arr.length - 1] }));
  const graded = qList.filter(x => x.first.status === 'graded');         // 첫 시도 채점이 끝난 문제
  const enough = graded.length >= MIN_OVERALL;
  const firstOk = graded.filter(x => x.first.is_correct).length;
  const ok = qList.filter(x => x.fin.status === 'graded' && x.fin.is_correct);
  const own1 = ok.filter(x => x.arr.length === 1 && x.fin.help_used === 'none').length;
  const ownRetry = ok.filter(x => x.arr.length > 1 && x.arr.every(a => a.help_used === 'none')).length;
  const unsolved = qList.filter(x => x.fin.status === 'graded' && !x.fin.is_correct).length;
  const tm = timeSum(at);
  /* 학습한 내용: 단원별 푼 문제 수·처음 정답률·학습한 날 */
  const uMap = new Map();
  for (const x of qList) {
    const u = T.uById[x.first.unit_id || x.q.unit_id]; if (!u) continue;
    const o = uMap.get(u.id) || { u, n: 0, g: 0, f: 0, ds: new Set() };
    o.n++; if (x.first.status === 'graded') { o.g++; if (x.first.is_correct) o.f++; }
    x.arr.forEach(a => o.ds.add(dayKey(a.submitted_at))); uMap.set(u.id, o);
  }
  const unitShort = u => { const t = String(u.title || '').replace(/^\s*\d+과\s*/, '').trim(); return ((u.lesson ? u.lesson + ' ' : '') + t).trim() || String(u.title || ''); };
  const units = [...uMap.values()].sort((a, b) => (parseInt(a.u.lesson) || 0) - (parseInt(b.u.lesson) || 0) || String(a.u.code).localeCompare(String(b.u.code))).map(o => {
    const ds = [...o.ds].sort(); return { book: o.u.school_book || '심쿵문법', name: unitShort(o.u), n: o.n, pct: o.g >= MIN_TAG ? pct(o.f, o.g) : null, first: ds[0] || '', last: ds[ds.length - 1] || '' };
  });
  const bad = /[\\/:*?"<>|]/g;
  let fileName = s.name + ' 성장 리포트';
  if (units.length) {
    const books = [...new Set(units.map(u => u.book))];
    const bookPart = books[0] + (books.length > 1 ? ' 외' : '');
    const unitPart = units.length <= 3 ? units.map(u => u.name).join(', ') : units[0].name + ' 외 ' + (units.length - 1) + '개';
    fileName = s.name + ' . ' + bookPart + '：' + unitPart;
  }
  const stages = STAGES.map(([k, n]) => {
    const g = graded.filter(x => x.q.stage === k);
    if (!g.length) return { name: n, n: 0, status: 'none' };
    if (g.length < MIN_STAGE) return { name: n, n: g.length, status: 'few' };
    return { name: n, n: g.length, status: 'ok', first: pct(g.filter(x => x.first.is_correct).length, g.length), final: pct(g.filter(x => x.fin.status === 'graded' && x.fin.is_correct).length, g.length) };
  });
  const tg = {};
  for (const x of graded) { const t = x.q.concept_tag || '?'; (tg[t] = tg[t] || { n: 0, f: 0, u: (T.uById[x.q.unit_id] || {}).lesson }); tg[t].n++; if (x.first.is_correct) tg[t].f++; }
  const tags = Object.entries(tg).map(([t, v]) => ({ tag: t, unit: v.u || '', n: v.n, pct: v.n < MIN_TAG ? null : pct(v.f, v.n) }))
    .sort((a, b) => (a.pct == null) - (b.pct == null) || (a.pct ?? 0) - (b.pct ?? 0)).slice(0, 12);
  const errs = {};
  for (const a of at) for (const e of a.error_types || []) errs[e] = (errs[e] || 0) + 1;
  const rounds = allRounds.length > 1 ? allRounds.filter(r => !rnd || r === rnd).map(r => {
    const rs = mine.filter(a => new Date(a.submitted_at).getTime() >= since && (a.round || 1) === r);
    const m = new Map(); rs.slice().sort((x, y) => x.attempt_no - y.attempt_no).forEach(a => { if (!m.has(a.question_id)) m.set(a.question_id, []); m.get(a.question_id).push(a); });
    const g = [...m.values()].filter(arr => arr[0].status === 'graded'), f = g.filter(arr => arr[0].is_correct).length, t = timeSum(rs);
    return { r, n: g.length, pct: g.length >= MIN_OVERALL ? pct(f, g.length) : null, sec: t.sec, tn: t.n };
  }) : [];
  const perDay = new Map();
  at.forEach(a => { const d = dayKey(a.submitted_at); if (!perDay.has(d)) perDay.set(d, { sec: 0, n: 0, sub: 0 }); const o = perDay.get(d); o.sub++; if (a.time_spent_sec != null) { o.sec += a.time_spent_sec; o.n++; } });
  const daily = [...perDay].sort((x, y) => x[0].localeCompare(y[0])).slice(-14).map(([d, o]) => ({ d, sec: o.n ? o.sec : null, sub: o.sub }));
  return {
    v: 1, name: s.name, grade: s.grade || '', units, file: fileName.replace(bad, ' ').replace(/\s+/g, ' ').trim(), made: new Date().toLocaleDateString('ko-KR'),
    range: (days ? `최근 ${days}일` : '전체 기간') + (rnd ? ` · ${rnd}회차만` : (allRounds.length > 1 ? ' · 모든 회차 합산' : '')),
    summary: { solved: qList.length, submissions: at.length, days: new Set(at.map(a => dayKey(a.submitted_at))).size, enough, first_pct: enough ? pct(firstOk, graded.length) : null, first_ok: firstOk, first_n: graded.length,
      pending: at.filter(a => a.status === 'needs_review').length, time_sec: tm.sec, time_n: tm.n, time_total: tm.total },
    how: enough ? { own1, retry: ownRetry, helped: ok.length - own1 - ownRetry, unsolved } : null,
    stages, tags, errors: Object.entries(errs).sort((a, b) => b[1] - a[1]).slice(0, 6), rounds, daily,
    comment: '', min: { overall: MIN_OVERALL, stage: MIN_STAGE, tag: MIN_TAG }, _rounds: allRounds
  };
}
// AI에게는 숫자 요약만 보내요 (학생 이름·연락처·답안 내용은 보내지 않아요)
function aiStats(d) {
  const t = d.tags.filter(x => x.pct != null);
  return { range: d.range, enough: d.summary.enough, solved: d.summary.solved, submissions: d.summary.submissions, days: d.summary.days, first_pct: d.summary.first_pct, first_n: d.summary.first_n,
    time_sec: d.summary.time_n ? d.summary.time_sec : null, how: d.how,
    stages: d.stages.filter(x => x.status === 'ok').map(x => ({ name: x.name, n: x.n, first: x.first, final: x.final })),
    weak: t.slice().sort((a, b) => a.pct - b.pct).slice(0, 5).map(x => ({ tag: x.tag, pct: x.pct, n: x.n })),
    strong: t.filter(x => x.pct >= 80).sort((a, b) => b.pct - a.pct).slice(0, 3).map(x => ({ tag: x.tag, pct: x.pct, n: x.n })),
    errors: d.errors, rounds: d.rounds.map(x => ({ r: x.r, pct: x.pct, n: x.n })),
    units: (d.units || []).slice(0, 8).map(u => ({ name: u.book + ' ' + u.name, n: u.n, pct: u.pct })) };
}
function shareUrl(tok) { return location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '') + 'report.html?t=' + tok; }
async function copyText(txt, inp) {
  try { await navigator.clipboard.writeText(txt); toast('복사했어요'); }
  catch (e) { if (inp) { inp.select(); try { document.execCommand('copy'); toast('복사했어요'); return; } catch (e2) { /* 아래 안내 */ } } toast('길게 눌러 직접 복사해 주세요'); }
}
function reportView(sid, days = 0, rnd = 0) {
  T.view = sid; T.rcmt = T.rcmt || {};
  const s = T.sById[sid], snap = buildSnap(sid, days, rnd);
  const cur = () => { snap.comment = (T.rcmt[sid] || {}).text || ''; return snap; };
  cur();
  $('#tb').innerHTML = `<div class="noprint"><p><a href="#" id="bk">← 학생 상세</a></p>
    <div class="card"><div class="row"><label style="margin:0">기간</label><select id="rg" style="width:auto"><option value="0">전체</option><option value="7">최근 7일</option><option value="30">최근 30일</option></select>
    <label style="margin:0">회차</label><select id="rr" style="width:auto"><option value="0">전체 합산</option>${snap._rounds.map(r => `<option value="${r}">${r}회차</option>`).join('')}</select>
    <button class="btn" id="pr">인쇄 / PDF로 저장</button><button class="btn" id="shb">공유 링크 만들기</button></div>
    <p class="tiny">인쇄 창에서 대상을 “PDF로 저장”으로 고르면 A4 규격 PDF가 돼요. 공유 링크는 지금 보이는 리포트를 그대로 담아 학부모님께 보낼 수 있어요(로그인 없이 열려요).</p>
    <div class="row" style="margin-top:8px"><label style="margin:0">선생님 코멘트</label><button class="btn small" id="aib" type="button">AI로 다시 쓰기</button><span class="tiny" id="aitag">${(T.rcmt[sid] || {}).tag || ''}</span></div>
    <textarea id="cmt" placeholder="학부모님께 전하고 싶은 말을 적어 보세요. AI가 자동으로 써 줘요. 읽어 보고 고쳐도 돼요.">${esc((T.rcmt[sid] || {}).text || '')}</textarea>
    <div id="shr" style="margin-top:8px"><div id="shnewbox"></div><div id="shlist"></div></div></div></div>
    ${RPT.render(cur())}`;
  $('#rg').value = String(days); $('#rr').value = String(rnd);
  $('#rg').onchange = () => reportView(sid, +$('#rg').value, +$('#rr').value);
  $('#rr').onchange = () => reportView(sid, +$('#rg').value, +$('#rr').value);
  $('#bk').onclick = e => { e.preventDefault(); studentDetail(sid); };
  $('#pr').onclick = () => {                          // PDF로 저장할 때 파일 이름이 "학생이름 . 교재：단원"이 되게 문서 제목을 잠깐 바꿔요
    const old = document.title; document.title = snap.file || old;
    const back = () => { document.title = old; window.removeEventListener('afterprint', back); };
    window.addEventListener('afterprint', back); window.print(); setTimeout(back, 60000);
  };
  $('#cmt').oninput = () => { const v = $('#cmt').value.trim(); T.rcmt[sid] = { text: $('#cmt').value, tag: (T.rcmt[sid] || {}).tag || '', key: (T.rcmt[sid] || {}).key, edited: true };
    $('#cmtP').innerHTML = RPT.commentHtml(v); };
  const aiKey = sid + '|' + days + '|' + rnd;
  const runAi = async (auto) => {
    const b = $('#aib'); if (!b || b.disabled) return; b.disabled = true; b.textContent = 'AI가 쓰는 중…';
    $('#aitag').textContent = auto ? 'AI가 코멘트를 쓰는 중이에요…' : '';
    try {
      const r = await invokeFn('ai-feedback', { action: 'report_comment', stats: aiStats(snap) });
      if (!r.ok) { if (!auto) toast(r.message || 'AI 코멘트를 받지 못했어요', 4500); $('#aitag').textContent = auto ? (r.message || 'AI 코멘트를 받지 못했어요. 직접 적거나 “다시 쓰기”를 눌러 주세요.') : ''; }
      else if (T.view === sid && $('#cmt')) {
        const txt = String(r.text || '').replace(/\{이름\}/g, s.name);
        $('#cmt').value = txt;
        T.rcmt[sid] = { text: txt, key: aiKey, edited: false, tag: r.demo ? '시연용 자동 초안 (AI 미연결) — 직접 읽고 고쳐 주세요' : 'AI가 리포트를 보고 쓴 코멘트예요 — 읽어 보고 필요하면 고쳐 주세요' };
        $('#aitag').textContent = T.rcmt[sid].tag;
        $('#cmtP').innerHTML = RPT.commentHtml(txt.trim());
      }
    } catch (e) { if (!auto) toast(errText(e), 4500); if ($('#aitag')) $('#aitag').textContent = auto ? 'AI 코멘트를 받지 못했어요. 직접 적거나 “다시 쓰기”를 눌러 주세요.' : ''; }
    const bb = $('#aib'); if (bb) { bb.disabled = false; bb.textContent = '다시 쓰기'; }
  };
  $('#aib').onclick = () => runAi(false);
  /* 리포트를 열면 AI 코멘트를 자동으로 써 줘요 (이미 직접 고친 글이 있으면 그대로 둬요) */
  { const cr = T.rcmt[sid]; if (snap.summary.enough && (!cr || (!cr.edited && cr.key !== aiKey))) runAi(true); }
  const drawShares = async () => {
    const box = $('#shlist'); if (!box) return;
    const { data } = await S.sb.from('report_shares').select('id,token,created_at,expires_at,revoked,views').eq('student_id', sid).order('created_at', { ascending: false });
    const now = Date.now();
    box.innerHTML = (data || []).length ? `<div class="tiny"><b>만든 공유 링크</b></div>` + data.slice(0, 8).map(x => {
      const live = !x.revoked && new Date(x.expires_at).getTime() > now;
      return `<div class="row between" style="border-top:1px solid var(--line);padding:4px 0"><span class="tiny">${fmtDT(x.created_at)} 생성 · ${new Date(x.expires_at).toLocaleDateString('ko-KR')}까지 · 조회 ${x.views}회 · ${x.revoked ? '해제됨' : live ? '사용 중' : '기간 만료'}</span>
        <span>${live ? `<button class="btn small ghost" data-cp="${x.token}" type="button">링크 복사</button> <button class="btn small ghost" data-rv="${x.id}" type="button">해제</button>` : ''}</span></div>`; }).join('') : '';
    box.querySelectorAll('[data-cp]').forEach(b => b.onclick = () => copyText(shareUrl(b.dataset.cp)));
    box.querySelectorAll('[data-rv]').forEach(b => b.onclick = async () => {
      if (!confirm('이 링크를 해제할까요? 해제하면 받은 분이 더 이상 열 수 없어요.')) return;
      const { error } = await S.sb.from('report_shares').update({ revoked: true }).eq('id', b.dataset.rv);
      if (error) return toast(errText(error)); toast('해제했어요'); drawShares();
    });
  };
  $('#shb').onclick = async () => {
    const days_ = await new Promise(res => {
      const m = modal(`<h2>공유 링크 만들기</h2><p class="muted">지금 화면의 리포트(이름·학년·성적·코멘트 포함)가 그대로 담겨요. 링크를 아는 사람은 누구나 볼 수 있으니 학부모님께만 보내 주세요.</p>
        <label>링크 사용 기간</label><select id="shd"><option value="7">7일</option><option value="30" selected>30일</option><option value="90">90일</option></select>
        <div class="row" style="margin-top:12px"><button class="btn" id="shok">링크 만들기</button><button class="btn ghost" id="shno">취소</button></div>`);
      m.querySelector('#shok').onclick = () => { const v = +m.querySelector('#shd').value; m.remove(); res(v); };
      m.querySelector('#shno').onclick = () => { m.remove(); res(0); };
    });
    if (!days_) return;
    const { data, error } = await S.sb.rpc('create_report_share', { p_student: sid, p_snapshot: cur(), p_days: days_ });
    if (error) return toast(errText(error), 4500);
    const url = shareUrl(data);
    $('#shnewbox').innerHTML = (`<div class="result ok" id="shnew"><b>링크가 만들어졌어요</b> <span class="tiny">(${days_}일 동안 열려요)</span>
      <div class="row" style="margin-top:6px"><input type="text" id="shu" readonly value="${esc(url)}" style="flex:1;min-width:220px"><button class="btn small" id="shc" type="button">복사</button></div></div>`);
    $('#shc').onclick = () => copyText(url, $('#shu'));
    $('#shu').onfocus = () => $('#shu').select();
    await drawShares();
  };
  drawShares().catch(() => { });
}

/* ---------- CSV ---------- */
function csvCell(v) {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;          // 엑셀 수식으로 실행되지 않게 막아요
  return '"' + s.replace(/"/g, '""') + '"';
}
async function exportCsv(list, name) {
  if (!Object.keys(T.keys).length) { try { await loadKeys(); } catch (e) { toast(errText(e)); return; } }
  const head = ['제출시각', '학생', '단원', '회차', '단계', '개념', '문제', '시도', '풀이시간(초)', '학생답', '결과', '점수', '만점', '채점자', '도움', '해설열람', '오류유형', '피드백', '정답', '해설'];
  const lines = [head.map(csvCell).join(',')];
  for (const a of list) {
    const q = T.qById[a.question_id] || {}, s = T.sById[a.student_id] || {}, u = T.uById[q.unit_id] || {};
    lines.push([a.submitted_at, s.name, unitLabel(u), a.round || 1, STAGE_NAME[a.stage] || a.stage, q.concept_tag, q.prompt, a.attempt_no, a.time_spent_sec ?? '', a.answer,
      a.status === 'needs_review' ? '대기' : a.is_correct ? '정답' : '오답', a.score, a.max_score, a.graded_by === 'teacher' ? '원장님' : '자동',
      helpLabel(a.help_used), a.explanation_viewed ? 'Y' : 'N', (a.error_types || []).join('/'), a.feedback, ((T.keys[a.question_id] || {}).answers || []).join(' / '), (T.keys[a.question_id] || {}).explanation].map(csvCell).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob), el = document.createElement('a');
  el.href = url; el.download = name; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- 문항 관리 ---------- */
const GRADES = ['초1', '초2', '초3', '초4', '초5', '초6', '중1', '중2', '중3', '고1', '고2', '고3'];
const gradeOpts = sel => `<option value="">학년 선택</option>` + GRADES.map(g => `<option ${g === sel ? 'selected' : ''}>${g}</option>`).join('');
// 출판사 + 학년을 "출판사 학년" 한 줄로 합쳐요 (이미 학년이 붙어 있으면 그대로)
function bookJoin(pub, grade) { pub = String(pub || '').trim(); return /(초|중|고)\s*\d\s*$/.test(pub) || !grade ? pub : `${pub} ${grade}`; }
let QU = null, QB = null, QS = null;   // 선택한 단원 · 교재(출판사+학년) · 문제 유형
const QTYPE = { mc: '객관식', fill: '빈칸', write: '서술형' };
function splitBook(b) { const m = String(b || '').match(/^(.*\S)\s+(\S+)$/); return m ? { pub: m[1], grade: m[2] } : { pub: b || '교재 미정', grade: '' }; }
function qStat(list) { const n = list.length, pend = list.filter(q => q.review_status === 'pending').length; return { n, pend, ok: n - pend }; }
function statBadge(st) { return st.pend ? `<span class="badge warn">검수 대기 ${st.pend}</span>` : `<span class="badge ok">전부 공개</span>`; }
async function tabQuestions() {
  if (!Object.keys(T.keys).length) await loadKeys();
  if (QU && !T.uById[QU]) QU = null;
  if (QU) QB = T.uById[QU].school_book || '교재 미정';           // 새 단원을 만들면 그 단원으로 바로 이동
  if (!QU) QS = null;
  const bookOf = u => u.school_book || '교재 미정';
  const unitsOf = b => T.units.filter(u => bookOf(u) === b);
  const view = QS ? 'stage' : QU ? 'unit' : QB ? 'book' : 'root';
  const u = QU ? T.uById[QU] : null;
  const crumbs = [`<a href="#" data-go="root">문항 관리</a>`];
  if (QB) { const sb = splitBook(QB); crumbs.push(`<a href="#" data-go="book">${esc(sb.pub)} ${esc(sb.grade)}</a>`); }
  if (u) crumbs.push(`<a href="#" data-go="unit">${esc(u.title)}</a>`);
  if (QS) crumbs.push(`<b>${esc(STAGE_NAME[QS] || QS)}</b>`);
  let body = '';
  if (view === 'root') {
    const books = [...new Set(T.units.map(bookOf))].sort((x, y) => bookRank(x) - bookRank(y) || x.localeCompare(y));
    const pubs = new Map();
    books.forEach(b => { const sb = splitBook(b); if (!pubs.has(sb.pub)) pubs.set(sb.pub, []); pubs.get(sb.pub).push([b, sb.grade]); });
    body = [...pubs].map(([pub, list]) => `<h3 style="margin-top:14px">${esc(pub)}</h3><div class="grid2">${list.sort((x, y) => gradeRank(x[1]) - gradeRank(y[1]) || x[1].localeCompare(y[1])).map(([b, g]) => {
      const us = unitsOf(b), ids = new Set(us.map(x => x.id)), st = qStat(T.questions.filter(q => ids.has(q.unit_id)));
      return `<div class="qcard" data-book="${esc(b)}"><div class="qt">${esc(g || pub)}</div><div class="tiny">단원 ${us.length}개 · 문제 ${st.n}개</div><div style="margin-top:6px">${statBadge(st)}</div></div>`;
    }).join('')}</div>`).join('') || '<p class="muted">아직 단원이 없어요.</p>';
  } else if (view === 'book') {
    const us = unitsOf(QB).sort((x, y) => (parseInt(x.lesson) || 0) - (parseInt(y.lesson) || 0) || String(x.code).localeCompare(String(y.code)));
    body = `<div class="grid2">${us.map(x => { const st = qStat(T.questions.filter(q => q.unit_id === x.id));
      return `<div class="qcard" data-unit="${x.id}"><div class="qt">${esc(x.title)}</div><div class="tiny">문제 ${st.n}개</div><div style="margin-top:6px">${statBadge(st)}</div></div>`; }).join('')}</div>`;
  } else if (view === 'unit') {
    const qs = T.questions.filter(q => q.unit_id === QU), st = qStat(qs);
    body = `<div class="row" style="margin-bottom:10px"><button class="btn small ghost" id="ued">단원 정보 수정</button>
      <button class="btn small" id="apAll" ${st.pend ? '' : 'disabled'}>이 단원 대기 문항 모두 승인 (${st.pend})</button></div>
      <p class="muted">문제 유형을 눌러 보세요.</p>
      <div class="grid2">${STAGES.map(([k, n]) => { const L = qs.filter(q => q.stage === k); if (!L.length) return ''; const s2 = qStat(L);
        const types = ['mc', 'fill', 'write'].map(t => { const c = L.filter(q => q.qtype === t).length; return c ? `${QTYPE[t]} ${c}` : ''; }).filter(Boolean).join(' · ');
        return `<div class="qcard" data-stage="${k}"><div class="qt">${n}</div><div class="tiny">${L.length}문제 · ${types}</div><div style="margin-top:6px">${statBadge(s2)}</div></div>`; }).join('')}</div>`;
  } else {
    const L = T.questions.filter(q => q.unit_id === QU && q.stage === QS).sort((a, b) => a.ord - b.ord), st = qStat(L);
    body = `<div class="row" style="margin-bottom:10px"><button class="btn small" id="apAll" ${st.pend ? '' : 'disabled'}>이 유형 대기 문항 모두 승인 (${st.pend})</button></div>` +
      L.map(q => `<div class="stage" style="margin-bottom:6px"><div><span class="tiny">${q.ord}번 · ${QTYPE[q.qtype]} · ${esc(q.concept_tag)}</span><div>${esc(q.prompt)}</div></div>
        <div class="row" style="flex-wrap:nowrap"><span class="badge ${q.review_status === 'approved' ? 'ok' : 'warn'}">${q.review_status === 'approved' ? '공개' : '검수 대기'}</span>
        <button class="btn small ghost" data-e="${q.id}">보기·수정</button>
        <button class="btn small ${q.review_status === 'approved' ? 'ghost' : ''}" data-a="${q.id}">${q.review_status === 'approved' ? '비공개' : '승인'}</button></div></div>`).join('');
  }
  $('#tb').innerHTML = `<div class="card"><div class="row between"><h2 style="margin:0">문항 관리</h2><button class="btn small" id="gnew">PDF로 새 단원 만들기</button></div>
    <div class="notice" style="margin-top:10px">처음 들어 있는 문제는 모두 <b>검수 대기</b> 상태예요. 원장님이 읽어 보고 <b>승인</b>한 문제만 학생에게 보여요. 고친 문제는 이후 학생 풀이부터 반영되고, 이미 푼 기록은 그대로 보존돼요.</div>
    <div class="crumbs">${crumbs.join(' <span class="muted">›</span> ')}</div></div><div class="card">${body}</div>`;
  document.querySelectorAll('[data-go]').forEach(a => a.onclick = e => { e.preventDefault(); const g = a.dataset.go;
    if (g === 'root') { QB = QU = QS = null; } else if (g === 'book') { QU = QS = null; } else if (g === 'unit') { QS = null; }
    tabQuestions(); });
  document.querySelectorAll('[data-book]').forEach(d => d.onclick = () => { QB = d.dataset.book; QU = QS = null; tabQuestions(); });
  document.querySelectorAll('[data-unit]').forEach(d => d.onclick = () => { QU = d.dataset.unit; QS = null; tabQuestions(); });
  document.querySelectorAll('[data-stage]').forEach(d => d.onclick = () => { QS = d.dataset.stage; tabQuestions(); });
  $('#gnew').onclick = genModal;
  if ($('#ued')) $('#ued').onclick = () => {
    if (!u) return;
    const md = modal(`<h2>단원 정보 수정</h2>
      <label>출판사·교재 (예: 동아(윤정미))</label><input type="text" id="ub" value="${esc(splitBook(u.school_book).pub)}">
      <label>학년</label><select id="ug">${gradeOpts(splitBook(u.school_book).grade)}</select>
      <label>과 (예: 5과)</label><input type="text" id="ul" value="${esc(u.lesson)}">
      <label>단원 이름</label><input type="text" id="ut" value="${esc(u.title)}">
      <p class="tiny">학생 화면에도 이 이름이 보여요. 이미 푼 기록에는 영향이 없어요.</p>
      <div class="row" style="margin-top:14px"><button class="btn" id="usv">저장</button><button class="btn ghost" id="ucl">닫기</button></div>`);
    $('#ucl').onclick = () => md.remove();
    $('#usv').onclick = async () => {
      const v = { school_book: bookJoin($('#ub').value, $('#ug').value), lesson: $('#ul').value.trim(), title: $('#ut').value.trim() };
      if (!v.title) return toast('단원 이름을 입력해 주세요');
      const { error } = await S.sb.from('units').update(v).eq('id', QU);
      if (error) return toast(errText(error), 4000);
      md.remove(); toast('저장했어요'); await loadTeacher(); tabQuestions();
    };
  };
  if ($('#apAll')) $('#apAll').onclick = async () => {
    const list = T.questions.filter(q => q.unit_id === QU && (!QS || q.stage === QS) && q.review_status === 'pending');
    if (!confirm(`${list.length}개 문제를 모두 승인할까요? 승인 전에 내용을 확인하셨나요?`)) return;
    let qb = S.sb.from('questions').update({ review_status: 'approved' }).eq('unit_id', QU).eq('review_status', 'pending');
    if (QS) qb = qb.eq('stage', QS);
    const { error } = await qb;
    if (error) return toast(errText(error));
    await loadTeacher(); tabQuestions();
  };
  document.querySelectorAll('[data-a]').forEach(b => b.onclick = async () => {
    const q = T.qById[b.dataset.a], to = q.review_status === 'approved' ? 'pending' : 'approved';
    const { error } = await S.sb.from('questions').update({ review_status: to }).eq('id', q.id);
    if (error) return toast(errText(error));
    await loadTeacher(); tabQuestions();
  });
  document.querySelectorAll('[data-e]').forEach(b => b.onclick = () => editQuestion(b.dataset.e));
}
function editQuestion(id) {
  const q = T.qById[id], k = T.keys[id] || { answers: [], explanation: '', wrong_notes: {} };
  const m = modal(`<h2>${STAGE_NAME[q.stage]} ${q.ord}번 (${{ mc: '객관식', fill: '빈칸', write: '서술형' }[q.qtype]})</h2>
    <label>문제</label><textarea id="eq">${esc(q.prompt)}</textarea>
    <label>우리말 뜻·조건</label><input type="text" id="ek" value="${esc(q.ko)}">
    ${q.qtype === 'mc' ? `<label>보기 (한 줄에 하나)</label><textarea id="ec">${esc((q.choices || []).join('\n'))}</textarea>` : ''}
    <label>정답 (한 줄에 하나 · 여러 개면 모두 정답으로 인정)</label><textarea id="ea">${esc((k.answers || []).join('\n'))}</textarea>
    <label>힌트</label><input type="text" id="eh" value="${esc(q.hint)}">
    <label>해설</label><textarea id="ex">${esc(k.explanation)}</textarea>
    <label>배점</label><input type="number" id="ep" min="0.5" step="0.5" value="${q.points}">
    <p class="tiny">보기별 오답 설명(wrong_notes)은 여기서 바꾸지 않고 그대로 유지돼요.</p>
    <div class="row" style="margin-top:12px"><button class="btn" id="esv">저장</button><button class="btn ghost" id="ecl">닫기</button></div>`);
  $('#ecl').onclick = () => m.remove();
  $('#esv').onclick = async () => {
    const lines = id => $(id).value.split('\n').map(x => x.trim()).filter(Boolean);
    const answers = lines('#ea');
    if (!$('#eq').value.trim() || !answers.length) return toast('문제와 정답을 입력해 주세요');
    const upd = { prompt: $('#eq').value.trim(), ko: $('#ek').value.trim(), hint: $('#eh').value.trim(), points: parseFloat($('#ep').value) || q.points, version: q.version + 1 };
    if (q.qtype === 'mc') {
      const ch = lines('#ec');
      if (ch.length < 2 || !answers.every(a => ch.includes(a))) return toast('정답이 보기 중에 있어야 해요');
      upd.choices = ch;
    }
    const r1 = await S.sb.from('questions').update(upd).eq('id', id);
    const r2 = await S.sb.from('question_keys').update({ answers, explanation: $('#ex').value.trim() }).eq('question_id', id);
    if (r1.error || r2.error) return toast(errText(r1.error || r2.error), 4000);
    m.remove(); toast('저장했어요'); await loadTeacher(); await loadKeys(); tabQuestions();
  };
}

/* ---------- 교재 PDF로 새 단원 만들기 (AI) ---------- */
const GEN_PARTS_UI = [['concepts', '개념 화면'], ['concept', '개념 확인 문제'], ['basic', '기본 문제'], ['mid', '중급 문제'], ['adv', '고급 문제'], ['writing', '서술형 문제'], ['exam', '실전 문제']];
const GEN_PRICE = { 'claude-haiku-5-5': [0.10, 0.50], 'claude-sonnet-5-5': [2.00, 10.00] };
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((ok, no) => {
    const sc = document.createElement('script');
    sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    sc.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; ok(window.pdfjsLib); } catch (e) { no(e); } };
    sc.onerror = () => no(new Error('PDF 읽기 도구를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.'));
    document.head.appendChild(sc);
  });
}
async function pdfText(file, from, to) {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const a = Math.max(1, from || 1), b = Math.min(doc.numPages, to || doc.numPages);
  let out = '';
  for (let i = a; i <= b; i++) {
    const pg = await doc.getPage(i); const tc = await pg.getTextContent();
    let line = '', y = null, px = null;       // 글자가 낱개로 쪼개진 PDF도 읽히도록, 간격이 넓을 때만 띄어 써요
    for (const it of tc.items) {
      const ny = it.transform ? Math.round(it.transform[5]) : 0, nx = it.transform ? it.transform[4] : 0;
      if (y !== null && Math.abs(ny - y) > 3) { out += line.trim() + '\n'; line = ''; px = null; }
      else if (px !== null && nx - px > (it.height || 10) * 0.3 && !/^\s/.test(it.str) && !/\s$/.test(line)) line += ' ';
      line += it.str;
      if (it.hasEOL) { out += line.trim() + '\n'; line = ''; px = null; } else px = nx + (it.width || 0);
      y = ny;
    }
    out += line.trim() + '\n\n';
  }
  return { text: out.replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim(), pages: doc.numPages };
}
function genEstimate(chars, model) {
  const pr = GEN_PRICE[model] || GEN_PRICE['claude-sonnet-5-5'];
  const inTok = Math.ceil(Math.min(chars, 30000) / 2) + 1500;
  const usd = (7 * inTok * pr[0] + 7 * 2500 * pr[1]) / 1e6;
  return usd;
}
async function genModal() {
  let st = { key_set: false, gen_model: 'claude-sonnet-5-5' };
  try { st = await invokeFn('ai-feedback', { action: 'status' }); } catch (e) { st = null; }
  const warn = !st ? '<div class="notice">서버 함수(ai-feedback)가 아직 최신이 아니에요. 설치 안내서 "5단계 업데이트"를 먼저 해 주세요.</div>'
    : (!st.key_set ? '<div class="notice">AI 키가 아직 연결되지 않아서 문제는 만들 수 없어요. 연결하면 바로 쓸 수 있어요. (설치 안내서 2단계 E)</div>' : '');
  const m = modal(`<h2>PDF로 새 단원 만들기</h2>${warn}
    <p class="tiny">교재 PDF의 한 과(쪽 범위)를 고르면, 지금 단원처럼 <b>개념 화면 + 6단계 문제(정답·해설·힌트 포함)</b>를 AI가 만들어요. 만든 문제는 모두 <b>검수 대기</b>로 들어가고, 원장님이 읽어 보고 승인해야 학생에게 보여요.</p>
    <label>교재 PDF (글자가 들어 있는 PDF)</label><input type="file" id="gf" accept="application/pdf,.pdf">
    <div class="grid2"><div><label>읽을 쪽 (시작)</label><input type="number" id="gp1" min="1" value="1"></div><div><label>읽을 쪽 (끝)</label><input type="number" id="gp2" min="1" placeholder="끝까지"></div></div>
    <div class="row" style="margin:6px 0"><button class="btn small ghost" id="gread" type="button">PDF 글자 읽기</button><span class="tiny" id="gmsg"></span></div>
    <label>교재 본문 (PDF에서 읽은 글이에요. 고치거나 직접 붙여넣어도 돼요)</label>
    <textarea id="gsrc" style="min-height:140px" placeholder="여기에 교재 본문이 들어와요"></textarea>
    <div class="tiny" id="gcnt"></div>
    <div class="grid2"><div><label>출판사·교재</label><input type="text" id="gb" placeholder="예: 동아(윤정미)"></div><div><label>학년</label><select id="gg">${gradeOpts('')}</select></div><div><label>과</label><input type="text" id="gl" placeholder="예: 9과"></div></div>
    <label>단원 이름</label><input type="text" id="gt" placeholder="예: 9과 문법: 관계대명사 which">
    <div id="gprog" style="margin:8px 0"></div>
    <div class="row" style="margin-top:12px"><button class="btn" id="ggo">문제 만들기 시작</button><button class="btn ghost" id="gcl">닫기</button></div>`);
  const model = (st && st.gen_model) || 'claude-sonnet-5-5';
  const upd = () => {
    const n = $('#gsrc').value.length;
    const usd = genEstimate(n, model);
    $('#gcnt').textContent = n ? `본문 ${n.toLocaleString('ko-KR')}자${n > 30000 ? ' (30,000자까지만 사용해요. 쪽 범위를 줄여 주세요)' : ''} · 예상 비용(추정) 약 ${Math.round(usd * 1400).toLocaleString('ko-KR')}원 · 실제 비용은 AI 사용·설정 탭에서 확인해요` : '';
  };
  $('#gsrc').oninput = upd;
  $('#gcl').onclick = () => m.remove();
  $('#gread').onclick = async () => {
    const f = $('#gf').files[0]; if (!f) return toast('PDF 파일을 먼저 골라 주세요');
    $('#gmsg').textContent = '읽는 중…';
    try {
      const r = await pdfText(f, parseInt($('#gp1').value, 10) || 1, parseInt($('#gp2').value, 10) || 0);
      if (r.text.replace(/\s/g, '').length < 200) { $('#gmsg').textContent = '글자를 거의 못 읽었어요. 사진을 묶은 스캔 PDF일 수 있어요(이 기능은 글자가 있는 PDF만 읽어요).'; return; }
      $('#gsrc').value = r.text; $('#gmsg').textContent = `전체 ${r.pages}쪽 중 선택한 쪽을 읽었어요`; upd();
    } catch (e) { $('#gmsg').textContent = '읽지 못했어요: ' + ((e && e.message) || e); }
  };
  let unitId = '', next = 0, running = false;
  const draw = (failIdx, msg) => {
    $('#gprog').innerHTML = GEN_PARTS_UI.map(([k, n], i) => `<div class="tiny">${i < next ? '✅' : i === failIdx ? '⚠️' : (running && i === next ? '⏳' : '·')} ${n}${i === failIdx && msg ? ' — ' + esc(msg) : ''}</div>`).join('');
  };
  $('#ggo').onclick = async () => {
    if (running) return;
    const src = $('#gsrc').value.trim(), title = $('#gt').value.trim();
    if (src.length < 200) return toast('교재 본문을 먼저 넣어 주세요 (200자 이상)');
    if (!title) return toast('단원 이름을 입력해 주세요');
    if (next === 0 && !confirm('AI가 문제를 만들면 AI 사용료가 들어요. 시작할까요?')) return;
    running = true; $('#ggo').disabled = true; $('#ggo').textContent = '만드는 중…';
    while (next < GEN_PARTS_UI.length) {
      draw(-1); let r;
      try { r = await invokeFn('ai-feedback', { action: 'gen_part', part: GEN_PARTS_UI[next][0], unit_id: unitId, source: src, book: bookJoin($('#gb').value, $('#gg') && $('#gg').value), lesson: $('#gl').value.trim(), title }); }
      catch (e) { r = { ok: false, message: errText(e) }; }
      if (r.unit_id) unitId = r.unit_id;
      if (!r.ok) { running = false; draw(next, r.message); $('#ggo').disabled = false; $('#ggo').textContent = '이 단계부터 다시 시도'; return; }
      next++;
    }
    running = false; draw(-1);
    toast('문제를 만들었어요. 검수 후 승인해 주세요', 5000);
    m.remove(); await loadTeacher(); QU = unitId; tabQuestions();
  };
}

/* ---------- 설정 · 내보내기 ---------- */
async function tabSettings() {
  const { data } = await S.sb.from('app_settings').select('*').eq('key', 'grading_rules').maybeSingle();
  const r = (data && data.value) || { case_deduct: 0.5, punct_deduct: 0.5, fragment_credit: 0.5 };
  if (r.fragment_credit == null) r.fragment_credit = 0.5;
  $('#tb').innerHTML = alertCardHtml() + `<div class="card"><h2>서술형 채점 규칙</h2>
    <p class="muted">정답과 글자는 같은데 대소문자·문장부호만 다르면 정답으로 인정하되, 아래 점수만큼 깎아요.</p>
    <div class="grid2"><div><label>대문자·소문자 실수 감점</label><input type="number" id="cd" min="0" step="0.5" value="${r.case_deduct}"></div>
    <div><label>문장부호 실수 감점</label><input type="number" id="pd" min="0" step="0.5" value="${r.punct_deduct}"></div>
    <div><label>고친 부분만 쓴 경우 점수 비율 (0~1)</label><input type="number" id="fc" min="0" max="1" step="0.1" value="${r.fragment_credit}"></div></div>
    <p class="tiny">"문장 전체를 쓰세요" 문제에서 고친 단어만 쓰면(예: tall) 이 비율만큼 부분 점수를 주고, 문장 전체로 다시 쓰게 해요. AI 비용 없이 바로 채점돼요.</p>
    <div class="row" style="margin-top:10px"><button class="btn" id="sv">저장</button></div></div>
    <div class="card"><h2>내보내기</h2><button class="btn ghost" id="ex">전체 풀이 기록 CSV (엑셀)</button>
    <p class="tiny">학생 이름과 답안이 들어 있으니 안전한 곳에만 보관하세요.</p></div>
    <div class="card"><h2>학원관리 앱으로 학습 현황 보내기</h2>
    <p class="muted">「심쿵영어 학원관리」 앱의 <b>심쿵문법 현황</b> 화면에서 불러올 수 있는 파일이에요. 학생 이름·학년·단원별 진행·정답률·학습 시간만 들어 있고, 정답·해설·학생 답안은 들어 있지 않아요.</p>
    <button class="btn ghost" id="exf">학원관리용 현황 파일(JSON) 내려받기</button></div>
    <div class="card"><h2>월별 풀이기록 자동 보관</h2>
    <p class="muted">매월 마지막 날 밤 9시에 학생별 풀이기록(위 CSV와 같은 열)이 자동으로 쌓여요. 「심쿵영어 학원관리」 자료실에서도 볼 수 있어요.</p>
    <div class="row"><button class="btn ghost" id="arcnow">이번 달 지금 보관하기</button><span class="tiny" id="arcmsg"></span></div>
    <div id="arclist" class="tiny" style="margin-top:8px">불러오는 중…</div>
    <h3 style="margin-top:14px">카톡 알림 (나와의 채팅으로 받기)</h3>
    <p class="tiny">설치안내서의 「학습 제출 알림」 장대로 만든 <b>알림 주소</b>(https://…supabase.co/functions/v1/notify-kakao?key=…)를 붙여넣으세요. 월별 보관이 끝날 때와, 학생이 단원을 끝까지 제출했을 때 카톡으로 알려 드려요. (Make 같은 별도 서비스는 필요 없어요)</p>
    <div class="row"><input id="arcwh" type="password" placeholder="알림 주소 (저장 후에는 가려져요)" style="flex:1;min-width:220px" autocomplete="off"><button class="btn" id="arcwhs">저장</button><button class="btn ghost" id="arcwht">알림 시험</button></div>
    <label class="row" style="margin-top:8px;gap:6px;align-items:center"><input type="checkbox" id="subon" checked> 학생이 단원을 끝까지 제출하면 카톡 알림 받기</label></div>
    <div class="card"><h2>학생 계정</h2><p class="muted">학생 계정 만들기·학년 수정·비밀번호는 위쪽 <b>학생 관리</b> 탭으로 옮겼어요.</p></div>`;
  alertCardInit();
  $('#sv').onclick = async () => {
    const v = { case_deduct: parseFloat($('#cd').value) || 0, punct_deduct: parseFloat($('#pd').value) || 0,
      fragment_credit: Math.min(1, Math.max(0, isNaN(parseFloat($('#fc').value)) ? 0.5 : parseFloat($('#fc').value))) };
    const { error } = await S.sb.from('app_settings').upsert({ key: 'grading_rules', value: v });
    toast(error ? errText(error) : '저장했어요');
  };
  $('#ex').onclick = () => exportCsv(T.attempts, '전체_풀이기록.csv');
  /* 월별 보관 */
  const arcNeed = e => /does not exist|schema cache|404/i.test((e && e.message) || '') ? 'DB 추가 설치(schema9.sql)가 아직이에요' : errText(e);
  async function arcLoad() {
    const { data, error } = await S.sb.rpc('archive_list');
    if (error) { $('#arclist').textContent = arcNeed(error); return; }
    $('#arclist').innerHTML = data.length ? data.map(a => `<div class="row" style="justify-content:space-between;padding:3px 0;border-bottom:1px solid #eee"><span>${esc(a.month)} · ${esc(a.student_name)} · ${a.attempt_count}건</span><button class="btn ghost" data-arc="${esc(a.id)}" data-nm="${esc(a.student_name)}_${esc(a.month)}">CSV</button></div>`).join('') : '아직 보관된 기록이 없어요. (이번 달 기록이 있으면 위 버튼으로 바로 만들 수 있어요)';
  }
  $('#arclist').onclick = async ev => {
    const b = ev.target.closest('[data-arc]'); if (!b) return;
    const { data, error } = await S.sb.from('monthly_archives').select('csv').eq('id', b.dataset.arc).single();
    if (error) return toast(errText(error));
    const url = URL.createObjectURL(new Blob([data.csv], { type: 'text/csv;charset=utf-8' })), el = document.createElement('a');
    el.href = url; el.download = `풀이기록_${b.dataset.nm}.csv`; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  $('#arcnow').onclick = async () => {
    const { data, error } = await S.sb.rpc('archive_month_now', { p_month: null });
    if (error) return toast(arcNeed(error), 4500);
    $('#arcmsg').textContent = `학생 ${data}명 보관했어요`; arcLoad();
  };
  $('#arcwhs').onclick = async () => {
    const { error } = await S.sb.rpc('archive_set_webhook', { p_url: $('#arcwh').value.trim() });
    toast(error ? arcNeed(error) : '저장했어요'); if (!error) $('#arcwh').value = '';
  };
  $('#arcwht').onclick = async () => {
    const { data, error } = await S.sb.rpc('submit_notify_test');
    toast(error ? arcNeed(error) : ({ sent: '시험 알림을 보냈어요. 카톡 「나와의 채팅」을 확인해 보세요', no_webhook: '알림 주소를 먼저 저장하세요', bad_url: 'https:// 로 시작하는 주소만 쓸 수 있어요', no_pg_net: 'Supabase에서 pg_net 확장을 켜 주세요', error: '신호를 보내지 못했어요. 주소를 확인하세요' }[data] || data), 5000);
  };
  S.sb.from('archive_notify').select('submit_on').eq('id', 1).maybeSingle().then(({ data }) => { if (data) $('#subon').checked = data.submit_on !== false; });
  $('#subon').onchange = async () => {
    const { error } = await S.sb.rpc('submit_notify_set', { p_on: $('#subon').checked });
    toast(error ? (/does not exist|schema cache|404/i.test(error.message || '') ? 'DB 추가 설치(schema10.sql)가 아직이에요' : errText(error)) : ($('#subon').checked ? '제출 알림을 켰어요' : '제출 알림을 껐어요'));
  };
  arcLoad();
  $('#exf').onclick = async () => {
    const { data, error } = await S.sb.rpc('grammar_progress_feed');
    if (error) return toast(/does not exist|schema cache|404/i.test(error.message || '') ? 'DB 추가 설치(schema8.sql)가 아직이에요' : errText(error), 4500);
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' }), url = URL.createObjectURL(blob), el = document.createElement('a');
    el.href = url; el.download = '심쿵문법_학습현황.json'; document.body.appendChild(el); el.click(); el.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('내려받았어요');
  };
}

/* ---------- 학생 관리 탭: 계정 만들기 · 학년/이름 수정 · 새 학년 올리기 ---------- */
function nextGrade(g) {
  const m = /^(초|중|고)\s*([1-6])$/.exec(String(g || '').trim());
  if (!m) return null;
  const n = +m[2];
  if (m[1] === '초') return n < 6 ? '초' + (n + 1) : '중1';
  if (m[1] === '중') return n < 3 ? '중' + (n + 1) : '고1';
  return n < 3 ? '고' + (n + 1) : null;      // 고3은 졸업이라 직접 정해요
}
function tabAccounts() {
  const rows = T.students.map(s => `<div class="stage" style="margin-bottom:6px;align-items:flex-start">
    <div><b>${esc(s.name || '(이름 없음)')}</b> <span class="badge">${esc(s.grade || '학년 없음')}</span>
      <div class="tiny">아이디: ${esc(s.login_id || '(아직 없음 · DB 업데이트 필요)')}</div></div>
    <div class="row" style="flex-wrap:wrap;justify-content:flex-end"><button class="btn small ghost" data-ed="${s.id}">정보 수정</button><button class="btn small ghost" data-rp="${s.id}">비밀번호 다시 정하기</button><button class="btn small ghost" data-dl="${s.id}">삭제</button></div></div>`).join('');
  $('#tb').innerHTML = `<div class="card"><h2>학생 계정 만들기</h2>
    <p class="muted">만든 비밀번호는 만들 때 한 번만 보여 주니 바로 학생에게 알려 주세요.</p>
    <div class="grid2"><div><label>이름</label><input type="text" id="cn" placeholder="예: 홍길동"></div>
    <div><label>학년</label><input type="text" id="cg" placeholder="예: 중3"></div>
    <div><label>로그인 아이디</label><input type="text" id="ce" placeholder="예: hong01 (또는 이메일)" autocapitalize="off"></div>
    <div><label>비밀번호 (6자 이상)</label><div class="row" style="flex-wrap:nowrap"><input type="text" id="cp" autocomplete="off"><button class="btn ghost small" id="cgen" type="button">자동 생성</button></div></div></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="cmk">학생 계정 만들기</button></div>
    <p class="tiny">아이디에 @가 없으면 뒤에 <b>@${ID_DOMAIN}</b>이 자동으로 붙어요. 학생은 로그인 화면에 붙은 전체 주소(예: hong01@${ID_DOMAIN})를 입력해야 해요.</p></div>
    <div class="card"><div class="row between"><h2>등록된 학생 (${T.students.length}명)</h2><button class="btn small" id="promo">새 학년으로 올리기</button></div>
    <p class="tiny">학년이 바뀌면 "정보 수정"에서 고치거나, 해가 바뀔 때 "새 학년으로 올리기"로 한꺼번에 올려요. 바뀐 학년은 날짜와 함께 기록돼 성장 리포트에 쓰여요.</p>
    ${rows || '<p class="muted">아직 학생이 없어요.</p>'}</div>`;
  bindAccounts();
  $('#promo').onclick = promoteModal;
  document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => editStudentModal(b.dataset.ed));
}
async function editStudentModal(id) {
  const s = T.sById[id];
  const h = await S.sb.from('student_grade_log').select('grade,school_year,changed_at').eq('student_id', id).order('changed_at');
  const hist = h.error ? '' : (h.data || []).map(r => `${esc(r.grade || '(빈칸)')} <span class="tiny">(${kstDate(r.changed_at)})</span>`).join(' → ');
  const m = modal(`<h2>학생 정보 수정</h2>
    <label>이름</label><input type="text" id="en" value="${esc(s.name)}">
    <label>학년</label><input type="text" id="eg" value="${esc(s.grade)}" placeholder="예: 중3">
    <p class="tiny">아이디: ${esc(s.login_id || '-')} (아이디는 바꿀 수 없어요)</p>
    ${hist ? `<p class="tiny"><b>학년 기록</b> ${hist}</p>` : ''}
    <div class="row" style="margin-top:14px"><button class="btn" id="esv">저장</button><button class="btn ghost" id="ecl">닫기</button></div>`);
  $('#ecl').onclick = () => m.remove();
  $('#esv').onclick = async () => {
    const name = $('#en').value.trim(), grade = $('#eg').value.trim();
    if (!name) return toast('이름을 입력해 주세요');
    const { error } = await S.sb.from('profiles').update({ name, grade }).eq('id', id);
    if (error) return toast(errText(error), 4000);
    m.remove(); toast('저장했어요'); await loadTeacher(); tabAccounts();
  };
}
function promoteModal() {
  if (!T.students.length) return toast('학생이 없어요');
  const rows = T.students.map(s => { const n = nextGrade(s.grade);
    return `<div class="row" style="flex-wrap:nowrap;margin:4px 0"><label style="flex:1;font-weight:400"><input type="checkbox" data-pc="${s.id}" ${n ? 'checked' : ''}> ${esc(s.name)} <span class="tiny">(${esc(s.grade || '-')})</span></label>
      <span>→</span><input type="text" data-pg="${s.id}" value="${esc(n || '')}" placeholder="직접 입력" style="width:90px"></div>`; }).join('');
  const m = modal(`<h2>새 학년으로 올리기</h2><p class="tiny">체크한 학생만 바뀌어요. 고3·학년 없음은 비워 두었으니 직접 적어 주세요. 저장 전에 학년을 확인하고 고칠 수 있어요.</p>${rows}
    <div class="row" style="margin-top:14px"><button class="btn" id="pgo">선택한 학생 올리기</button><button class="btn ghost" id="pcl">닫기</button></div>`);
  $('#pcl').onclick = () => m.remove();
  $('#pgo').onclick = async () => {
    const jobs = [...m.querySelectorAll('[data-pc]')].filter(c => c.checked).map(c => ({ id: c.dataset.pc, grade: m.querySelector(`[data-pg="${c.dataset.pc}"]`).value.trim() })).filter(j => j.grade);
    if (!jobs.length) return toast('올릴 학생과 학년을 확인해 주세요');
    if (!confirm(`${jobs.length}명의 학년을 바꿀까요?`)) return;
    let fail = 0;
    for (const j of jobs) { const { error } = await S.sb.from('profiles').update({ grade: j.grade }).eq('id', j.id); if (error) fail++; }
    m.remove(); toast(fail ? `${fail}명은 저장하지 못했어요` : '학년을 올렸어요'); await loadTeacher(); tabAccounts();
  };
}

/* ---------- 학생 계정 관리 (서버의 manage-students 함수 사용) ---------- */
const ID_DOMAIN = 'simkung.kr';
function genPw() {
  const c = 'abcdefghijkmnpqrstuvwxyz23456789';       // 헷갈리는 글자(l, o, 0, 1 등)는 뺐어요
  let out = ''; const a = new Uint32Array(8); crypto.getRandomValues(a);
  for (const x of a) out += c[x % c.length];
  return out;
}
async function callManage(body) {
  const { data, error } = await S.sb.functions.invoke('manage-students', { body });
  if (error) {
    let msg = error.message || '';
    try { if (error.context && error.context.json) { const j = await error.context.json(); if (j && j.error) msg = j.error; } } catch (e) { /* 그대로 */ }
    if (/Failed to send|Failed to fetch|not found|404/i.test(msg)) msg = '서버 함수가 아직 설치되지 않았어요. 설치 안내서의 "학생 계정 기능 켜기"를 먼저 해 주세요.';
    throw new Error(msg);
  }
  if (data && data.error) throw new Error(data.error);
  return data;
}
function credModal(title, id, pw) {
  const m = modal(`<h2>${esc(title)}</h2><p>학생에게 아래 정보를 알려 주세요. 비밀번호는 지금만 볼 수 있어요.</p>
    <div class="kv"><div>아이디</div><div><b>${esc(id)}</b></div><div>비밀번호</div><div><b>${esc(pw)}</b></div></div>
    <div class="row" style="margin-top:14px"><button class="btn" id="cmc">닫기</button></div>`);
  $('#cmc').onclick = () => m.remove();
}
function bindAccounts() {
  $('#cgen').onclick = () => { $('#cp').value = genPw(); };
  $('#cmk').onclick = async () => {
    const name = $('#cn').value.trim(), grade = $('#cg').value.trim(); let id = $('#ce').value.trim(), pw = $('#cp').value;
    if (!name || !id) return toast('이름과 아이디를 입력해 주세요');
    if (!pw) { pw = genPw(); }
    if (!id.includes('@')) id = id.toLowerCase().replace(/\s+/g, '') + '@' + ID_DOMAIN;
    const btn = $('#cmk'); btn.disabled = true;
    try {
      await callManage({ action: 'create', name, grade, email: id, password: pw });
      credModal('학생 계정을 만들었어요', id, pw);
      await loadTeacher(); tabAccounts();
    } catch (e) { toast(e.message, 5000); btn.disabled = false; }
  };
  document.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => {
    const s = T.sById[b.dataset.rp];
    const m = modal(`<h2>비밀번호 다시 정하기 · ${esc(s.name)}</h2>
      <p>학생이 입력하기 쉬운 비밀번호를 직접 적어 주세요. (6자 이상) 기존 비밀번호는 못 쓰게 돼요.</p>
      <div class="row" style="flex-wrap:nowrap"><input type="text" id="rpw" autocomplete="off" placeholder="새 비밀번호 (6자 이상)" style="flex:1"><button class="btn ghost small" id="rgen" type="button">자동 생성</button></div>
      <div class="row" style="margin-top:14px"><button class="btn" id="rok">비밀번호 바꾸기</button><button class="btn ghost" id="rno">취소</button></div>`);
    $('#rpw').focus();
    $('#rgen').onclick = () => { $('#rpw').value = genPw(); };
    $('#rno').onclick = () => m.remove();
    $('#rok').onclick = async () => {
      const pw = $('#rpw').value.trim();
      if (pw.length < 6) return toast('비밀번호는 6자 이상으로 적어 주세요');
      const btn = $('#rok'); btn.disabled = true;
      try { await callManage({ action: 'reset', user_id: s.id, password: pw }); m.remove(); credModal('새 비밀번호예요 · ' + s.name, '(기존 아이디 그대로)', pw); }
      catch (e) { toast(e.message, 5000); btn.disabled = false; }
    };
  });
  document.querySelectorAll('[data-dl]').forEach(b => b.onclick = async () => {
    const s = T.sById[b.dataset.dl];
    if (!confirm(`${s.name} 학생 계정을 삭제할까요?\n이 학생의 풀이 기록·메모도 모두 지워지고 되돌릴 수 없어요.`)) return;
    if (!confirm('정말 삭제할까요? 먼저 풀이 기록 CSV를 내려받아 두는 걸 권해요.')) return;
    try { await callManage({ action: 'delete', user_id: s.id }); toast('삭제했어요'); await loadTeacher(); tabAccounts(); }
    catch (e) { toast(e.message, 5000); }
  });
}

/* ---------- 학생별 오답노트 (정답·해설 포함, 인쇄용) ---------- */
async function wrongView(sid, unitId = '') {
  T.view = sid;
  if (!Object.keys(T.keys).length) await loadKeys();
  const s = T.sById[sid], at = T.byStu.get(sid) || [];
  const byQ = new Map();
  for (const a of at) { if (!byQ.has(a.question_id)) byQ.set(a.question_id, []); byQ.get(a.question_id).push(a); }
  const items = [];
  for (const [qid, arr0] of byQ) {
    const lr = Math.max(...arr0.map(a => a.round || 1)), arr = arr0.filter(a => (a.round || 1) === lr);   // 가장 최근 회차 기준
    arr.sort((x, y) => x.attempt_no - y.attempt_no);
    const fin = arr[arr.length - 1], q = T.qById[qid];
    if (!q || fin.status !== 'graded' || fin.is_correct) continue;
    if (unitId && q.unit_id !== unitId) continue;
    items.push({ q, arr, fin, k: T.keys[qid] || { answers: [], explanation: '', wrong_notes: {} } });
  }
  const order = Object.fromEntries(STAGES.map(([k], i) => [k, i]));
  items.sort((a, b) => (a.q.unit_id === b.q.unit_id ? 0 : String(a.q.unit_id).localeCompare(b.q.unit_id)) || order[a.q.stage] - order[b.q.stage] || a.q.ord - b.q.ord);
  const units = [...new Set(T.asg.filter(a => a.student_id === sid).map(a => a.unit_id))];
  const card = (x, i) => {
    const note = (x.k.wrong_notes || {})[x.fin.answer];
    return `<div style="break-inside:avoid;border-top:1px solid #bbb;padding:8px 0">
      <div class="tiny">${i + 1}. ${esc((T.uById[x.q.unit_id] || {}).lesson || '')} · ${STAGE_NAME[x.q.stage]} · ${esc(x.q.concept_tag)} · ${(x.fin.round || 1) > 1 ? (x.fin.round + '회차 · ') : ''}${x.arr.length}번 시도${x.arr.some(a => a.help_used !== 'none') ? ' · 도움 받음' : ''}</div>
      <div><b>${esc(x.q.prompt)}</b></div>${x.q.ko ? `<div class="muted">${esc(x.q.ko)}</div>` : ''}
      ${x.q.qtype === 'mc' ? `<div class="tiny">보기: ${(x.q.choices || []).map(esc).join(' / ')}</div>` : ''}
      <div>학생 답: <b>${x.arr.map(a => esc(a.answer)).join(' → ')}</b></div>
      <div>정답: <b>${(x.k.answers || []).map(esc).join(' / ')}</b></div>
      ${x.k.explanation ? `<div>해설: ${esc(x.k.explanation)}</div>` : ''}${note ? `<div class="muted">왜 틀렸나: ${esc(note)}</div>` : ''}</div>`;
  };
  $('#tb').innerHTML = `<div class="noprint"><p><a href="#" id="bk">← 학생 상세</a></p>
    <div class="card row"><label style="margin:0">단원</label><select id="wu" style="width:auto"><option value="">전체</option>${units.map(u => `<option value="${u}" ${u === unitId ? 'selected' : ''}>${esc(unitLabel(T.uById[u]))}</option>`).join('')}</select>
    <button class="btn" id="pr">인쇄 / PDF로 저장</button><span class="tiny">학생이 최종적으로 못 맞힌 문제만 모아요. 원장님이 보는 자료라 정답·해설이 들어 있어요.</span></div></div>
    <div class="report"><h1>${esc(s.name)} 오답노트</h1>
    <p class="muted">${new Date().toLocaleDateString('ko-KR')} · 최종 오답 ${items.length}문제 (문제별 가장 최근 회차 기준 · 채점 대기 중인 답안은 제외)</p>
    ${items.map(card).join('') || '<p>틀린 문제가 없어요.</p>'}</div>`;
  $('#bk').onclick = e => { e.preventDefault(); studentDetail(sid); };
  $('#wu').onchange = () => wrongView(sid, $('#wu').value);
  $('#pr').onclick = () => window.print();
}
