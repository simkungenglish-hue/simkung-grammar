/* 심쿵영어 어휘 학습 - 학생 화면 추가 기능 (14단계)
   앞 유닛 복습 · 품사 맞추기 · 문장 빈칸 · 범위 시험 · 오답노트 */
'use strict';

const VX = { cur: null };

/* ---------- 앞 유닛 복습: 1복습 → 2학습, 2복습 → 3학습 ---------- */
function vPrevReview(unitId) {
  const pu = vPrevUnit(unitId), a = vAsgOfUnit(unitId);
  if (!pu || !a) return vRunStep(unitId, vFirstStep(unitId));
  const cfg = vCfg(a), items = vItems(pu.id);
  const n = Math.max(3, Math.min(cfg.prev_n || 10, items.length));
  // 이 학생이 앞에서 틀렸고 아직 약한 단어(복습 상자 1~2칸)를 먼저 넣어요. 오답이 없으면 앞 유닛에서 무작위로 뽑아요.
  const weakOf = it => { const r = VS.srs.find(x => x.item_id === it.id); return !!r && (r.wrong_n || 0) > 0 && r.box <= 2; };
  const ul = vUnitList(a), ui = ul.findIndex(u => u.id === unitId);
  const earlier = []; for (let k = ui - 1; k >= 0; k--) if (ul[k].id !== pu.id) earlier.push(...vItems(ul[k].id));
  const picked = [], seen = new Set();
  const add = arr => { for (const it of arr) { if (picked.length >= n) break; if (!seen.has(it.id)) { seen.add(it.id); picked.push(it); } } };
  add(shuffle(items.filter(weakOf)));      // 1) 바로 앞 유닛의 오답
  add(shuffle(earlier.filter(weakOf)));    // 2) 그 전 유닛들의 오답
  add(shuffle(items));                     // 3) 나머지는 앞 유닛에서 무작위
  const pick = shuffle(picked);
  const list = pick.map((it, k) => ({ it, dir: k % 2 ? 'en' : 'ko', mode: 'choice' }));
  AT.start();
  const runId = uuid();
  vQuiz({ unitId: null, backUnit: unitId, title: `🔁 앞 복습 · ${vUnitName(pu)}`, step: 'review', list, items, runId, requeue: false,
    onEnd: async res => {
      const ok = [...res.values()].filter(r => r.ok).length;
      if (!(await vStepDone(unitId, 'prev', ok, pick.length))) return;
      const wrong = [...res.values()].filter(r => !r.ok);
      shell(`<div class="card vend"><div class="vend-ic">🔁</div><h2>앞 복습 끝!</h2>
        <p class="clock big">${ok} / ${pick.length}</p><p class="muted">앞에서 배운 단어 중 맞힌 개수</p>
        ${wrong.length ? `<div class="wlist"><div class="tiny">다시 확인할 단어 (내일 복습에도 나와요)</div>${wrong.map(w => `<div class="wrow"><b>${esc(w.it.word)}</b> ${vSpk(w.it.word)}<span>${esc(w.it.meaning)}</span></div>`).join('')}</div>` : '<p>모두 기억하고 있어요! 👏</p>'}
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="go">${esc(vUnitName(vUnit(unitId)))} 학습 시작</button><button class="btn ghost" id="uh">유닛으로</button></div></div>`);
      vBindSpk();
      $('#go').onclick = () => vRunStep(unitId, vFirstStep(unitId));
      $('#uh').onclick = () => vUnitHome(unitId);
    } });
}

/* ---------- 품사 맞추기 · 문장 빈칸 ---------- */
function vExtra(unitId, kind, items) {
  const pool = (items || vItems(unitId)).filter(it => kind === 'pos' ? (it.pos_list || []).length : (it.sent_blank && it.sent_answer));
  if (!pool.length) return toast('이 유닛에는 아직 이 연습이 없어요');
  const list = shuffle(pool), runId = uuid(), wrong = [];
  let i = 0, ok = 0, out = null, sel = null, busy = false, cid = null;
  const draw = () => {
    if (i >= list.length) return fin();
    const it = list[i];
    let body;
    if (kind === 'pos') {
      body = `<div class="fc-word sm">${esc(it.word)} ${vSpk(it.word)}</div><div class="tiny">이 단어의 품사를 골라요 (뜻이 여러 개면 하나만 골라도 돼요)</div>
        <div class="posgrid">${V_POS.map(p => {
          let cls = ''; if (out) { if (it.pos_list.includes(p)) cls = 'right'; else if (p === sel) cls = 'wrong'; }
          return `<button class="choice ${cls}" data-c="${p}" ${out ? 'disabled' : ''}>${p}</button>`;
        }).join('')}</div>`;
    } else {
      body = `<div class="fc-mean big sentq">${esc(it.sent_blank)}</div><div class="tiny">${esc(it.example_ko)}</div>
        <div class="tiny">힌트: ${esc(it.meaning)} · 빈칸에는 단어 기본형을 써요</div>
        <input type="text" id="ans" class="vin" placeholder="빈칸에 들어갈 영어" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" ${out ? 'disabled' : ''}>`;
    }
    if (out) {
      body += out.is_correct ? `<div class="result ok"><b>정답! 👏</b> ${kind === 'pos' ? `${esc(it.word)} = ${esc(it.pos_list.join('·'))}` : `${esc(it.example)}`} ${vSpk(kind === 'pos' ? it.word : it.example)}</div>`
        : `<div class="result bad"><b>정답: ${esc(kind === 'pos' ? it.pos_list.join(' 또는 ') : it.sent_answer)}</b>${kind === 'sent' ? `<div>${esc(it.example)} ${vSpk(it.example)}</div>` : ''}</div>`;
    }
    const btn = out ? `<button class="btn" id="nx" style="width:100%">${i < list.length - 1 ? '다음' : '마치기'}</button>` : kind === 'sent' ? '<button class="btn" id="go" style="width:100%">확인</button>' : '';
    shell(`<p><a href="#" id="back">← 유닛으로</a></p>
      <div class="row between"><b>${V_ICON[kind]} ${esc(V_STEP_NAME[kind])}</b><span class="tiny">${i} / ${list.length}</span></div>
      <div class="progress" style="margin:8px 0 14px"><i style="width:${i / list.length * 100}%"></i></div>
      <div class="card vq">${body}</div>${btn}`);
    vBack(unitId); vBindSpk();
    document.querySelectorAll('.choice').forEach(b => b.onclick = () => submit(b.dataset.c));
    const inp = $('#ans');
    if (inp) { inp.focus(); inp.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); submit(inp.value); } }; }
    if ($('#go')) $('#go').onclick = () => submit(inp.value);
    if ($('#nx')) $('#nx').onclick = () => { i++; out = null; sel = null; draw(); };
    if (out && out.is_correct && kind === 'sent') TTS.say(it.example);
  };
  const submit = async ans => {
    if (busy || out) return;
    if (!String(ans || '').trim()) return toast('답을 먼저 적어 주세요');
    busy = true; sel = ans; if (!cid) cid = uuid();
    try {
      const { data, error } = await S.sb.rpc('vocab_extra_submit', { p_client: cid, p_item: list[i].id, p_kind: kind, p_answer: ans, p_run: runId });
      if (error) throw error;
      out = data; cid = null; busy = false;
      if (data.is_correct) ok++; else wrong.push(list[i]);
      VS.days.add(kstToday()); draw();
    } catch (e) { busy = false; toast(errText(e), 4000); }
  };
  const fin = async () => {
    const done = await vStepDone(unitId, kind, ok, list.length);
    if (!done) return;
    const sl = vStepList(vAsgOfUnit(unitId)), si = sl.findIndex(x => x[0] === kind), nextK = si >= 0 && sl[si + 1] ? sl[si + 1][0] : null;
    shell(`<div class="card vend"><div class="vend-ic">${V_ICON[kind]}</div><h2>${esc(V_STEP_NAME[kind])} 끝!</h2>
      <p class="clock big">${ok} / ${list.length}</p><p class="muted">맞힌 문제</p>
      ${wrong.length ? `<div class="wlist"><div class="tiny">틀린 문제</div>${wrong.map(w => `<div class="wrow"><b>${esc(w.word)}</b><span>${esc(kind === 'pos' ? w.pos_list.join('·') : w.sent_answer)}</span></div>`).join('')}</div>` : ''}
      <div class="row" style="justify-content:center;margin-top:12px">${nextK ? '<button class="btn" id="nx2">다음 단계로</button>' : ''}<button class="btn ${nextK ? 'ghost' : ''}" id="uh">유닛으로</button></div></div>`);
    if ($('#nx2')) $('#nx2').onclick = () => vStartStep(unitId, nextK);
    $('#uh').onclick = () => vUnitHome(unitId);
  };
  AT.start(); draw();
}

/* ---------- 범위 시험 (원장님이 내 준 시험) ---------- */
async function vExamBox() {
  const el = $('#vexams'); if (!el) return;
  try {
    const { data, error } = await S.sb.rpc('vocab_exam_list');
    if (error || !data || !data.length || !$('#vexams')) return;
    const modeName = { choice_en: '뜻 보고 영어 고르기', choice_ko: '영어 보고 뜻 고르기', spell: '철자 쓰기', mix: '섞어서' };
    $('#vexams').innerHTML = '<h2 class="sect">📝 시험</h2>' + data.map(e => {
      const left = e.max_attempts - e.attempts;
      const st = e.passed ? `<span class="badge ok">✓ 통과 ${e.best_pct}%</span>` : e.attempts ? `<span class="badge bad">${e.last_pct}% · 통과 기준 ${e.pass_pct}%</span>` : '<span class="badge gray">아직 안 봤어요</span>';
      return `<div class="card"><div class="row between"><div><h3 style="margin:0">${esc(e.title)}</h3>
        <div class="muted">${e.n}문제 · ${esc(modeName[e.mode] || '')} · 통과 ${e.pass_pct}%${e.note ? ' · ' + esc(e.note) : ''}</div><div style="margin-top:4px">${st} <span class="tiny">남은 기회 ${Math.max(left, 0)}번</span></div></div>
        ${left > 0 ? `<button class="btn" data-exam="${e.id}">${e.attempts ? '다시 보기' : '시험 보기'}</button>` : '<span class="badge gray">완료</span>'}</div></div>`;
    }).join('');
    document.querySelectorAll('[data-exam]').forEach(b => b.onclick = () => vExamRun(data.find(x => x.id === b.dataset.exam)));
  } catch (e) { /* 시험 기능(14단계) 설치 전이면 아무것도 보이지 않아요 */ }
}
async function vExamRun(e) {
  try {
    const { data, error } = await S.sb.rpc('vocab_exam_get', { p_exam: e.id });
    if (error) throw error;
    VX.cur = data.exam;
    const base = data.exam.audio_base || '';
    const its = data.items.map(x => ({ ...x, audio_base: base })), pool = data.pool.map(x => ({ ...x, audio_base: base }));
    vBuildAudio(its.concat(pool));
    const mode = data.exam.mode;
    const list = shuffle(its).map((it, k) => {
      if (mode === 'choice_en') return { it, dir: 'en', mode: 'choice' };
      if (mode === 'choice_ko') return { it, dir: 'ko', mode: 'choice' };
      if (mode === 'spell') return { it, dir: 'en', mode: 'type' };
      return k % 3 === 2 ? { it, dir: 'ko', mode: 'choice' } : { it, dir: 'en', mode: 'type' };
    });
    const runId = uuid();
    AT.start();
    vQuiz({ unitId: null, step: 'exam', title: '📝 ' + data.exam.title, list, items: its.concat(pool), runId, requeue: false, hint: false,
      onEnd: async res => {
        try {
          const { data: r, error: er } = await S.sb.rpc('vocab_exam_finish', { p_exam: e.id, p_run: runId, p_time_sec: AT.stop() });
          if (er) throw er;
          const wrong = [...res.values()].filter(x => !x.ok);
          shell(`<div class="card vend"><div class="vend-ic">${r.passed ? '🎉' : '💪'}</div><h2>${r.passed ? '시험 통과!' : '조금만 더!'}</h2>
            <p class="clock big">${r.pct}%</p><p class="muted">${r.score} / ${r.total}문제 정답 · 통과 기준 ${r.pass_pct}%</p>
            ${wrong.length ? `<div class="wlist"><div class="tiny">틀린 단어 (내일 복습에 나와요)</div>${wrong.map(w => `<div class="wrow"><b>${esc(w.it.word)}</b> ${vSpk(w.it.word)}<span>${esc(w.it.meaning)}</span><span class="tiny">내 답: ${esc(w.ans)}</span></div>`).join('')}</div>` : '<p>하나도 안 틀렸어요! 👏</p>'}
            <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="home">어휘 홈으로</button></div></div>`);
          vBindSpk();
          $('#home').onclick = async () => { await loadVocab(); vocabHome(); };
        } catch (er) { toast(errText(er), 4000); vocabHome(); }
      } });
  } catch (er) {
    const m = String(er && (er.message || er)).includes('no_attempts_left') ? '시험 기회를 모두 썼어요' : errText(er);
    toast(m, 4000);
  }
}

/* ---------- 내 오답노트 ---------- */
async function vWrongNote() {
  let rows;
  try {
    const since = new Date(Date.now() - 60 * 864e5).toISOString();
    rows = await vFetchAll(() => S.sb.from('vocab_answers').select('id,item_id').eq('student_id', S.user.id).eq('is_correct', false)
      .in('step', ['write', 'test', 'review', 'exam', 'sent']).gte('submitted_at', since).order('submitted_at').order('id'));
  } catch (e) { return toast(errText(e)); }
  const cnt = new Map(); rows.forEach(r => cnt.set(r.item_id, (cnt.get(r.item_id) || 0) + 1));
  const byId = new Map(VS.items.map(i => [i.id, i]));
  const list = [...cnt.entries()].map(([id, n]) => ({ it: byId.get(id), n, box: (VS.srs.find(r => r.item_id === id) || {}).box || 0 }))
    .filter(x => x.it && x.box <= 3).sort((a, b) => b.n - a.n);
  if (!list.length) return toast('오답노트가 비었어요! 👏 틀린 단어를 모두 극복했어요', 3500);
  shell(`<p><a href="#" id="back">← 어휘 홈</a></p><h1>📒 내 오답노트 <span class="tiny">${list.length}개</span></h1>
    <div class="card"><div class="tiny">최근 60일 동안 틀렸고 아직 완전히 외우지 못한 단어예요. 많이 틀린 순서예요.</div>
    <div class="wlist">${list.slice(0, 40).map(x => `<div class="wrow"><b>${esc(x.it.word)}</b> ${vSpk(x.it.word)}<span>${esc(x.it.meaning)}</span><span class="tiny">${x.n}번 틀림</span></div>`).join('')}</div>
    <button class="btn" id="go" style="width:100%;margin-top:12px">틀린 단어 ${Math.min(list.length, 20)}개 다시 풀기</button></div>`);
  $('#back').onclick = e => { e.preventDefault(); vocabHome(); };
  vBindSpk();
  $('#go').onclick = () => {
    const pick = list.slice(0, 20).map(x => x.it);
    AT.start(); const runId = uuid();
    vQuiz({ unitId: null, step: 'review', title: '📒 오답노트', list: shuffle(pick).map(it => ({ it, dir: 'en', mode: 'type' })), items: VS.items, runId, requeue: true,
      onEnd: async res => {
        const n = res.size, ok = [...res.values()].filter(r => r.ok).length;
        try { await S.sb.rpc('vocab_review_done', { p_run: runId, p_time_sec: AT.stop() }); } catch (e) { /* 답안은 이미 저장됐어요 */ }
        shell(`<div class="card vend"><div class="vend-ic">📒</div><h2>오답노트 끝!</h2><p class="clock big">${ok} / ${n}</p><p class="muted">한 번에 맞힌 단어</p>
          <div class="row" style="justify-content:center;margin-top:12px"><button class="btn" id="home">어휘 홈으로</button></div></div>`);
        $('#home').onclick = async () => { await loadVocab(); vocabHome(); };
      } });
  };
}
