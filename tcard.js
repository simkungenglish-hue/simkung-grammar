/* 심쿵문법 - 원장님 「오늘 현황」 학생 카드: 단원 순서 정리, 교재 표시, 수정·삭제 버튼 */
'use strict';
(function () {
  if (document.getElementById('tc-css')) return;
  const st = document.createElement('style'); st.id = 'tc-css';
  st.textContent = `
.prow .bk{display:inline-block;font-size:.66rem;font-weight:800;padding:1px 6px;border-radius:6px;margin-right:5px;vertical-align:1px;background:#f1f5f9;color:#475569}
.prow .bk.g{background:#eef2ff;color:#4338ca}.prow .bk.w{background:#ecfdf5;color:#047857}.prow .bk.x{background:#fff7ed;color:#c2410c}.prow .bk.n{background:#fdf2f8;color:#be185d}
.prow .phl>b{white-space:nowrap;flex-shrink:0}
.prow .phl{min-width:0}
.prow .pact{display:flex;justify-content:flex-end;align-items:center;gap:5px;margin-top:4px}
.prow .pact button{font:inherit;font-size:.74rem;font-weight:700;border:1px solid #e2e8f0;background:#fff;color:#475569;border-radius:7px;padding:1px 8px;cursor:pointer;line-height:1.6}
.prow .pact button:hover{border-color:#a5b4fc;color:#4338ca;background:#f5f7ff}
.prow .pact button.del:hover{border-color:#fecaca;color:#dc2626;background:#fef2f2}
.modal:has(.ae){width:min(560px,94vw)!important;max-width:min(560px,94vw)!important}
.ae h3{margin:0 0 2px}.ae .sub{color:#64748b;font-size:.85rem;margin-bottom:12px}
.ae .f{margin:10px 0}.ae .f>b{display:block;font-size:.85rem;margin-bottom:5px}
.ae .two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.ae input[type=number],.ae input[type=date]{width:100%;box-sizing:border-box}
.ae .foot{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;margin-top:14px;border-top:1px dashed #e2e8f0;padding-top:12px}
`;
  document.head.appendChild(st);
})();

function tcBook(u) {
  const b = String(u.school_book || '');
  if (/그래머/.test(b)) return ['g', '그래머', 1];
  if (/WRITING/i.test(b)) return ['w', 'WRITING', 2];
  if (/보충/.test(b)) return ['x', '보충', 3];
  if (/동아|천재|미래엔|능률|비상|YBM|지학|금성|교과서|중\d/.test(b)) return ['n', b.replace(/\s*중\d.*$/, '').replace(/\(.*?\)/g, '').trim() || '내신', 0];
  return ['', b || '기타', 4];
}
function tcNums(s) { return (String(s).match(/\d+/g) || []).map(Number); }
function tcCmp(a, b) {
  const ua = T.uById[a.unit_id] || {}, ub = T.uById[b.unit_id] || {};
  const ka = tcBook(ua), kb = tcBook(ub);
  if (ka[2] !== kb[2]) return ka[2] - kb[2];
  if ((ua.school_book || '') !== (ub.school_book || '')) return String(ua.school_book).localeCompare(String(ub.school_book), 'ko');
  const na = tcNums(ua.lesson || ua.code), nb = tcNums(ub.lesson || ub.code);
  for (let i = 0; i < Math.max(na.length, nb.length); i++) { const x = na[i] ?? -1, y = nb[i] ?? -1; if (x !== y) return x - y; }
  return String(ua.code || '').localeCompare(String(ub.code || ''));
}

/* progressRows(학생 카드의 단원 줄)를 감싸서: 순서 정렬 + 교재 표시 + 수정/삭제 버튼 */
(function () {
  const _pr = progressRows;
  progressRows = function (sid) {
    const html = _pr(sid);
    const parts = html.split(/(?=<div class="prow" data-pa=")/);
    const head = parts[0].startsWith('<div class="prow" data-pa="') ? '' : parts.shift();
    if (!parts.length) return html;
    const rows = parts.map(h => { const id = (h.match(/data-pa="([^"]+)"/) || [])[1]; return { id, h, a: T.asg.find(x => x.id === id) }; });
    rows.sort((r1, r2) => (r1.a && r2.a) ? tcCmp(r1.a, r2.a) : 0);
    return head + rows.map(r => {
      if (!r.a) return r.h;
      const u = T.uById[r.a.unit_id] || {}, k = tcBook(u);
      let h = r.h.replace('<div class="phl"><b>', `<div class="phl"><b><span class="bk ${k[0]}">${esc(k[1])}</span>`);
      const due = r.a.due_date ? `<span class="tiny muted" style="margin-right:auto">마감 ${esc(r.a.due_date)}</span>` : '';
      const act = `<div class="pact">${due}<button data-aedit="${r.a.id}">✏️ 배정 수정</button><button class="del" data-adel="${r.a.id}">🗑 삭제</button></div>`;
      const end = h.lastIndexOf('</div>');
      return h.slice(0, end) + act + h.slice(end);
    }).join('');
  };
})();

async function tcRefresh() { await loadTeacher(); drawTeacher(); }

async function asgDelete(aid) {
  const a = T.asg.find(x => x.id === aid); if (!a) return;
  const s = T.sById[a.student_id] || {}, u = T.uById[a.unit_id] || {};
  const n = T.attempts.filter(x => x.assignment_id === a.id).length;
  if (!confirm(`${s.name} 학생의 「${u.lesson || ''} ${u.title}」 배정을 삭제할까요?` + (n ? `\n\n이 단원에서 푼 기록 ${n}건도 함께 지워져요.` : '\n\n아직 푼 기록은 없어요.'))) return;
  if (n && !confirm('푼 기록까지 지워져요. 정말 삭제할까요? 되돌릴 수 없어요.')) return;
  const { error } = await S.sb.from('assignments').delete().eq('id', a.id);
  if (error) return toast(errText(error), 4000);
  toast('배정을 삭제했어요'); await tcRefresh();
}

function asgEdit(aid) {
  const a = T.asg.find(x => x.id === aid); if (!a) return;
  const s = T.sById[a.student_id] || {}, u = T.uById[a.unit_id] || {}, c = cfgOf(a);
  const focus = Array.isArray((a.settings || {}).focus_qids) && (a.settings || {}).focus_round === (a.current_round || 1);
  const bg = modal(`<div class="ae"><h3>배정 수정</h3><div class="sub">${esc(s.name || '')} · ${esc(u.school_book || '')} ${esc(u.lesson || '')} ${esc(u.title || '')}${(a.current_round || 1) > 1 ? ` · ${a.current_round}회차` : ''}</div>
    ${focus ? `<div class="tiny" style="background:#eef2ff;border-radius:8px;padding:6px 9px;color:#4338ca">지금은 '틀린 문제만 재학습' 중이에요. 단계를 바꾸면 전체 문제로 돌아가요.</div>` : ''}
    <div class="f"><b>학습할 단계</b>${stagePickHtml('aest', stagesOf(a))}</div>
    <div class="two"><div class="f"><b>마감일</b><input type="date" id="aedue" value="${esc(a.due_date || '')}"></div>
      <div class="f"><b>통과 기준(%)</b><input type="number" id="aepass" min="0" max="100" value="${c.pass_pct}"></div></div>
    <div class="two"><div class="f"><b>재도전 횟수</b><input type="number" id="aeretry" min="0" max="5" value="${c.max_retries}"></div>
      <div class="f"><b>단계별 문제 수</b><input type="number" id="aeper" min="1" max="20" value="${c.per_stage}"></div></div>
    <div class="foot"><span class="row" style="gap:6px"><button class="btn small ghost" id="aerl">🔁 다시 학습시키기</button><button class="btn small ghost" id="aedel" style="color:#dc2626">🗑 삭제</button></span>
      <span class="row" style="gap:6px"><button class="btn small ghost" id="aex">취소</button><button class="btn small" id="aeok">저장</button></span></div></div>`);
  const q = sel => bg.querySelector(sel);
  q('#aex').onclick = () => bg.remove();
  q('#aedel').onclick = () => { bg.remove(); asgDelete(a.id); };
  q('#aerl').onclick = () => { bg.remove(); T._tcBack = true; relearnModal(a.id); };
  q('#aeok').onclick = async () => {
    const picked = stagePicked('aest'); if (!picked.length) return toast('단계를 하나 이상 골라 주세요');
    const num = (id, d, lo, hi) => { const v = parseInt(q(id).value, 10); return isNaN(v) ? d : Math.max(lo, Math.min(hi, v)); };
    const settings = Object.assign({}, a.settings || {}, { pass_pct: num('#aepass', c.pass_pct, 0, 100), max_retries: num('#aeretry', c.max_retries, 0, 5), per_stage: num('#aeper', c.per_stage, 1, 20) });
    const before = stagesOf(a).join(','), after = STAGES.map(([k]) => k).filter(k => picked.includes(k)).join(',');
    if (before !== after) { settings.stage_counts = stageCountsFor(a, picked); delete settings.focus_qids; delete settings.focus_round; }
    const { error } = await S.sb.from('assignments').update({ settings, due_date: q('#aedue').value || null }).eq('id', a.id);
    if (error) return toast(errText(error), 4000);
    bg.remove(); toast('배정을 수정했어요'); await tcRefresh();
  };
}

/* 다시 학습시키기를 오늘 현황에서 열었으면 저장 뒤 오늘 현황으로 돌아와요 */
(function () {
  const _ta = tabAssign;
  tabAssign = function () { if (T.tab && T.tab !== 'assign') { T._tcBack = false; return renderTab(); } return _ta.apply(this, arguments); };
})();

document.addEventListener('click', e => {
  const ed = e.target.closest('[data-aedit]'), del = e.target.closest('[data-adel]');
  if (!ed && !del) return;
  e.preventDefault(); e.stopPropagation();
  if (ed) asgEdit(ed.dataset.aedit); else asgDelete(del.dataset.adel);
}, true);
