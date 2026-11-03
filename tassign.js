/* 심쿵문법 - 원장님: 단계 고르기 · 재학습(전체/고른 단계/틀린 문제만) */
'use strict';
const STAGE_PRESETS = [['all', '전체', null], ['concept', '개념만', ['concept', 'basic']], ['core', '개념~중급', ['concept', 'basic', 'mid']], ['writing', '서술형만', ['writing']], ['exam', '내신대비만', ['exam']], ['hard', '심화·서술형·내신', ['adv', 'writing', 'exam']]];
function stagePickHtml(name, picked) {
  const on = k => !picked || picked.includes(k);
  return `<div class="picks" data-stgbox="${name}">${STAGES.map(([k, n]) => `<label class="pick"><input type="checkbox" name="${name}" value="${k}" ${on(k) ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
    <div class="row" style="gap:6px;margin-top:6px;flex-wrap:wrap">${STAGE_PRESETS.map(([k, n]) => `<button type="button" class="btn small ghost" data-preset="${name}|${k}">${n}</button>`).join('')}</div>`;
}
function stagePicked(name) { return [...document.querySelectorAll(`[name="${name}"]:checked`)].map(x => x.value); }
document.addEventListener('click', e => {
  const b = e.target.closest('[data-preset]'); if (!b) return;
  const [name, k] = b.dataset.preset.split('|'); const p = STAGE_PRESETS.find(x => x[0] === k); if (!p) return;
  document.querySelectorAll(`[name="${name}"]`).forEach(i => { i.checked = !p[2] || p[2].includes(i.value); });
});
function stagesOf(a) { const c = cfgOf(a); return STAGES.map(([k]) => k).filter(k => (c.stage_counts[k] ?? c.per_stage) > 0); }
function stageLabel(a) {
  const s = a.settings || {};
  if (Array.isArray(s.focus_qids) && s.focus_round === (a.current_round || 1)) return `<b style="color:#c2410c">틀린 문제만 재학습 (${s.focus_qids.length}문항)</b>`;
  const st = stagesOf(a);
  return st.length === STAGES.length ? '전체 단계' : '단계: ' + st.map(k => STAGE_NAME[k]).join('·');
}
function stageCountsFor(a, picked) {
  const c = cfgOf(a); const sc = Object.assign({}, c.stage_counts);
  STAGES.forEach(([k]) => { if (picked.includes(k)) { if (sc[k] === 0) delete sc[k]; } else sc[k] = 0; });
  return sc;
}
function stageModal(aid) {
  const a = T.asg.find(x => x.id === aid); if (!a) return;
  const s = T.sById[a.student_id], u = T.uById[a.unit_id];
  const bg = modal(`<h3 style="margin-top:0">단계 바꾸기</h3><p class="tiny">${esc(s ? s.name : '')} · ${esc(u ? u.title : '')}</p>${stagePickHtml('mst', stagesOf(a))}
    <p class="tiny" style="margin-top:8px">빠진 단계는 학생 화면에서 안 보여요. 지금까지 푼 기록은 그대로 남아요.</p>
    <div class="row between" style="margin-top:12px"><button class="btn small ghost" id="mx">취소</button><button class="btn small" id="mok">저장</button></div>`);
  bg.querySelector('#mx').onclick = () => bg.remove();
  bg.querySelector('#mok').onclick = async () => {
    const picked = stagePicked('mst'); if (!picked.length) return toast('단계를 하나 이상 골라 주세요');
    const settings = Object.assign({}, a.settings || {}, { stage_counts: stageCountsFor(a, picked) });
    delete settings.focus_qids; delete settings.focus_round;
    const { error } = await S.sb.from('assignments').update({ settings }).eq('id', a.id);
    if (error) return toast(errText(error), 4000);
    bg.remove(); toast('단계를 바꿨어요'); await loadTeacher(); tabAssign();
  };
}
function wrongQids(a) {
  const r = a.current_round || 1, last = new Map();
  T.attempts.filter(x => x.assignment_id === a.id && (x.round || 1) === r).forEach(x => { const p = last.get(x.question_id); if (!p || x.attempt_no > p.attempt_no) last.set(x.question_id, x); });
  return [...last.values()].filter(x => !x.is_correct && x.status !== 'needs_review').map(x => x.question_id);
}
function relearnModal(aid) {
  const a = T.asg.find(x => x.id === aid); if (!a) return;
  const s = T.sById[a.student_id], u = T.uById[a.unit_id], nx = (a.current_round || 1) + 1, wq = wrongQids(a);
  const bg = modal(`<h3 style="margin-top:0">다시 학습시키기 (${nx}회차)</h3><p class="tiny">${esc(s ? s.name : '')} · ${esc(u ? u.title : '')}</p>
    <label class="pick wide" style="margin-top:8px"><input type="radio" name="rl" value="all" checked><span><b>처음부터 전체 다시</b> · 지금 정한 단계 그대로</span></label>
    <label class="pick wide"><input type="radio" name="rl" value="stages"><span><b>고른 단계만 다시</b></span></label>
    <div id="rlst" style="margin:6px 0 6px 24px;opacity:.5;pointer-events:none">${stagePickHtml('rst', stagesOf(a))}</div>
    <label class="pick wide ${wq.length ? '' : 'off'}"><input type="radio" name="rl" value="wrong" ${wq.length ? '' : 'disabled'}><span><b>틀린 문제만 다시</b> · 이번 회차에 틀린 ${wq.length}문항</span></label>
    <p class="tiny" style="margin-top:8px">지금까지의 풀이 기록은 ${nx - 1}회차까지 그대로 보존돼요. 학생 화면은 고른 범위만 새로 시작해요.</p>
    <div class="row between" style="margin-top:12px"><button class="btn small ghost" id="rx">취소</button><button class="btn small" id="rok">${nx}회차 시작</button></div>`);
  bg.querySelectorAll('[name=rl]').forEach(r => r.onchange = () => {
    const box = bg.querySelector('#rlst'); const on = bg.querySelector('[name=rl]:checked').value === 'stages';
    box.style.opacity = on ? 1 : .5; box.style.pointerEvents = on ? 'auto' : 'none';
  });
  bg.querySelector('#rx').onclick = () => bg.remove();
  bg.querySelector('#rok').onclick = async () => {
    const mode = bg.querySelector('[name=rl]:checked').value;
    const settings = Object.assign({}, a.settings || {}); delete settings.focus_qids; delete settings.focus_round;
    if (mode === 'stages') { const p = stagePicked('rst'); if (!p.length) return toast('단계를 하나 이상 골라 주세요'); settings.stage_counts = stageCountsFor(a, p); }
    if (mode === 'wrong') { if (!wq.length) return toast('이번 회차에 틀린 문제가 없어요'); settings.focus_qids = wq; settings.focus_round = nx; }
    const b = bg.querySelector('#rok'); b.disabled = true;
    const up = await S.sb.from('assignments').update({ settings }).eq('id', a.id);
    if (up.error) { b.disabled = false; return toast(errText(up.error), 4000); }
    const { error } = await S.sb.rpc('start_new_round', { p_assignment: a.id });
    if (error) { b.disabled = false; return toast(errText(error), 4000); }
    bg.remove(); toast(`${nx}회차를 시작했어요${mode === 'wrong' ? ' (틀린 ' + wq.length + '문항)' : ''}`); await loadTeacher(); tabAssign();
  };
}
