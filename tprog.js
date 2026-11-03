/* 심쿵문법 - 원장님: 단원을 누르면 학생이 어디까지 했는지 자세히 보기 */
'use strict';
(function () {
  if (document.getElementById('tp2-css')) return;
  const st = document.createElement('style'); st.id = 'tp2-css';
  st.textContent = `
.prow[data-pa]{cursor:pointer;border-radius:10px;padding:6px 8px;margin:0 -8px;transition:background .12s}
.prow[data-pa]:hover{background:#eef2ff}
.prow[data-pa] .ph b::after{content:' ›';color:#94a3b8;font-weight:700}
.modal:has(.pg){width:min(900px,94vw)!important;max-width:min(900px,94vw)!important;box-sizing:border-box;max-height:92vh;overflow:auto}
.pg{width:100%;box-sizing:border-box}
.pg .stg{box-sizing:border-box}
.pg .hd{display:flex;justify-content:space-between;gap:10px;align-items:flex-start;margin-bottom:12px}
.pg .hd h2{margin:0;font-size:1.15rem}.pg .hd small{color:#64748b}
.pg .sum{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
.pg .sum div{background:#f5f7ff;border:1px solid #e0e7ff;border-radius:12px;padding:8px 10px}
.pg .sum small{display:block;color:#64748b;font-size:.74rem}.pg .sum b{font-size:1.05rem}
.pg .stg{border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;margin-bottom:8px}
.pg .stg.cur{border:2px solid #6366f1;background:#fafbff}
.pg .stg .t{display:flex;justify-content:space-between;align-items:center;gap:8px;font-size:.9rem}
.pg .stg .t b{font-weight:800}.pg .stg .t .r{font-size:.8rem;font-weight:700;color:#64748b;white-space:nowrap}
.pg .tag{font-size:.7rem;font-weight:800;padding:2px 7px;border-radius:999px;margin-left:6px}
.pg .tag.now{background:#4f46e5;color:#fff}.pg .tag.ok{background:#ecfdf5;color:#059669}.pg .tag.no{background:#fef2f2;color:#dc2626}.pg .tag.wait{background:#fff7ed;color:#c2410c}.pg .tag.todo{background:#f1f5f9;color:#94a3b8}
.pg .qs{display:flex;flex-wrap:wrap;gap:5px;margin-top:8px}
.pg .qb{width:30px;height:30px;border-radius:8px;border:1px solid #e2e8f0;background:#fff;font-size:.78rem;font-weight:800;cursor:pointer;color:#94a3b8;padding:0}
.pg .qb.o{background:#ecfdf5;border-color:#a7f3d0;color:#059669}.pg .qb.x{background:#fef2f2;border-color:#fecaca;color:#dc2626}
.pg .qb.w{background:#fff7ed;border-color:#fed7aa;color:#c2410c}.pg .qb.p{background:#eef2ff;border-color:#c7d2fe;color:#4338ca}
.pg .qb.sel{outline:2px solid #4f46e5;outline-offset:1px}
.pg .qd{margin-top:8px;background:#f8fafc;border-radius:10px;padding:10px 12px;font-size:.86rem;line-height:1.55}
.pg .qd .my{color:#dc2626}.pg .qd .ok{color:#059669;font-weight:800}.pg .qd .hist{color:#64748b;font-size:.78rem}
.pg .lg{display:flex;gap:10px;flex-wrap:wrap;font-size:.74rem;color:#64748b;margin:4px 0 10px}
.pg .lg i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:3px;vertical-align:-1px}
.pg .rounds{font-size:.8rem;color:#64748b;margin-top:10px}
@media (max-width:640px){.pg .sum{grid-template-columns:repeat(2,1fr)}}
`;
  document.head.appendChild(st);
})();

/* 단원 줄에 클릭 표시를 붙여요 (기존 progressRows를 감싸요) */
(function () {
  const _pr = progressRows;
  progressRows = function (sid) {
    const html = _pr(sid);
    const list = T.asg.filter(a => a.student_id === sid && T.uById[a.unit_id]);
    let i = 0;
    return html.replace(/<div class="prow">/g, () => { const a = list[i++]; return a ? `<div class="prow" data-pa="${a.id}" title="눌러서 자세히 보기">` : '<div class="prow">'; });
  };
})();

function tpQState(a, q) {
  const cfg = cfgOf(a), rd = a.current_round || 1;
  const all = T.attempts.filter(x => x.assignment_id === a.id && x.question_id === q.id && (x.round || 1) === rd).sort((x, y) => x.attempt_no - y.attempt_no);
  const l = all[all.length - 1];
  if (!l) return { c: '', k: '안 풂', all };
  if (l.status === 'needs_review') return { c: 'w', k: '채점 대기', all, l };
  if (l.is_correct) return { c: 'o', k: all.length > 1 ? `${all.length}번 만에 정답` : '한 번에 정답', all, l };
  if (l.attempt_no >= 1 + cfg.max_retries) return { c: 'x', k: '최종 오답', all, l };
  return { c: 'p', k: `틀림 · 다시 풀 수 있음 (${l.attempt_no}/${1 + cfg.max_retries})`, all, l };
}

function progressDetail(asgId) {
  const a = T.asg.find(x => x.id === asgId); if (!a) return;
  const s = T.sById[a.student_id] || {}, u = T.uById[a.unit_id] || {}, cfg = cfgOf(a), rd = a.current_round || 1;
  const mine = T.attempts.filter(x => x.assignment_id === a.id && (x.round || 1) === rd);
  const lastAt = mine.slice().sort((x, y) => new Date(y.submitted_at) - new Date(x.submitted_at))[0];
  const firstAt = mine.slice().sort((x, y) => new Date(x.submitted_at) - new Date(y.submitted_at))[0];
  const tsum = timeSum(mine);
  let curFound = false, totQ = 0, doneQ = 0;
  const stages = [];
  for (const [k, n] of STAGES) {
    const qs = tStageQs(a, k); if (!qs.length) continue;
    const sm = tStage(a, k); totQ += sm.total; doneQ += sm.done;
    const isCur = !sm.finished && !curFound; if (isCur) curFound = true;
    const states = qs.map(q => ({ q, ...tpQState(a, q) }));
    stages.push({ k, n, sm, isCur, states });
  }
  const g = mine.filter(x => x.status === 'graded'), acc = g.length ? pct(g.filter(x => x.is_correct).length, g.length) : null;
  const curSt = stages.find(x => x.isCur);
  const where = !mine.length ? '아직 시작 전이에요' : curSt ? `지금 <b>${esc(curSt.n)}</b> 단계 ${curSt.sm.done}/${curSt.sm.total}문제까지 했어요` : '<b>모든 단계를 끝냈어요</b>';
  const tagOf = x => x.isCur ? (x.sm.started ? '<span class="tag now">지금 하는 중</span>' : '<span class="tag now">다음 차례</span>')
    : x.sm.finished ? (x.sm.waiting ? '<span class="tag wait">채점 대기</span>' : x.sm.passed ? '<span class="tag ok">통과</span>' : '<span class="tag no">기준 미달</span>') : '<span class="tag todo">아직</span>';
  const rounds = (typeof T.rounds !== 'undefined' && T.rounds) ? '' : '';
  const html = `<div class="pg">
    <div class="hd"><div><small>${esc(s.name || '')} · ${esc(u.school_book || '')} ${esc(u.lesson || u.code || '')}${rd > 1 ? ` · ${rd}회차` : ''}</small><h2>${esc(u.title || '')}</h2><div style="margin-top:4px">${where}</div></div><button class="btn ghost small" id="pgx">닫기</button></div>
    <div class="sum">
      <div><small>푼 문제</small><b>${doneQ} / ${totQ}</b></div>
      <div><small>정답률</small><b>${acc == null ? '-' : acc + '%'}</b></div>
      <div><small>학습 시간</small><b>${tsum.n ? fmtDur(tsum.sec) : '-'}</b></div>
      <div><small>마지막 풀이</small><b style="font-size:.86rem">${lastAt ? fmtDT(lastAt.submitted_at) : '-'}</b></div>
    </div>
    <div class="lg"><span><i style="background:#a7f3d0"></i>정답</span><span><i style="background:#fecaca"></i>최종 오답</span><span><i style="background:#c7d2fe"></i>틀림(재도전 가능)</span><span><i style="background:#fed7aa"></i>채점 대기</span><span><i style="background:#e2e8f0"></i>안 풂</span><span>· 통과 기준 ${cfg.pass_pct}% · 재도전 ${cfg.max_retries}번</span></div>
    ${stages.map(x => `<div class="stg ${x.isCur ? 'cur' : ''}"><div class="t"><span><b>${esc(x.n)}</b>${tagOf(x)}</span><span class="r">${x.sm.done}/${x.sm.total}문제${x.sm.started ? ` · 점수 ${x.sm.pct == null ? '-' : x.sm.pct + '%'}` : ''}</span></div>
      <div class="qs">${x.states.map((q, i) => `<button class="qb ${q.c}" data-qq="${x.k}|${i}" title="${esc(q.k)}">${i + 1}</button>`).join('')}</div><div class="qd" data-qd="${x.k}" hidden></div></div>`).join('')}
    <div class="rounds">${firstAt ? `이 회차 시작 ${fmtDT(firstAt.submitted_at)}` : ''}${a.due_date ? ` · 마감 ${esc(a.due_date)}` : ''} · 번호를 누르면 학생이 쓴 답을 볼 수 있어요.</div>
  </div>`;
  const bg = modal(html);
  bg.querySelector('#pgx').onclick = () => bg.remove();
  bg.querySelectorAll('[data-qq]').forEach(b => b.onclick = async () => {
    const [k, i] = b.dataset.qq.split('|'); const stg = stages.find(x => x.k === k); const q = stg.states[+i];
    const box = bg.querySelector(`[data-qd="${k}"]`);
    if (b.classList.contains('sel')) { b.classList.remove('sel'); box.hidden = true; return; }
    bg.querySelectorAll(`[data-qq^="${k}|"]`).forEach(x => x.classList.remove('sel')); b.classList.add('sel');
    if (!Object.keys(T.keys || {}).length && typeof loadKeys === 'function') { try { await loadKeys(); } catch (e) { } }
    const key = (T.keys || {})[q.q.id] || {}, ans = (key.answers || [])[0] || '';
    box.hidden = false;
    box.innerHTML = `<div><b>${+i + 1}번</b> · ${esc(q.k)}</div><div style="white-space:pre-line;margin:4px 0">${esc(q.q.prompt)}</div>${q.q.ko ? `<div style="color:#64748b">${esc(q.q.ko)}</div>` : ''}
      ${Array.isArray(q.q.choices) && q.q.choices.length ? `<div style="color:#475569">${q.q.choices.map((c, j) => '①②③④⑤⑥'[j] + ' ' + esc(c)).join('　')}</div>` : ''}
      ${q.all.length ? q.all.map(t => `<div class="hist">${t.attempt_no}번째 · ${fmtDT(t.submitted_at)} · <span class="${t.is_correct ? 'ok' : 'my'}">${esc(t.answer || '')}</span> ${t.status === 'needs_review' ? '(채점 대기)' : t.is_correct ? '✓' : '✗'}${t.feedback ? ` · ${esc(t.feedback)}` : ''}</div>`).join('') : '<div class="hist">아직 풀지 않았어요.</div>'}
      ${ans ? `<div style="margin-top:4px">정답: <span class="ok">${esc(ans)}</span></div>` : ''}`;
  });
}
document.addEventListener('click', e => { const r = e.target.closest('.prow[data-pa]'); if (r) { e.preventDefault(); progressDetail(r.dataset.pa); } });
