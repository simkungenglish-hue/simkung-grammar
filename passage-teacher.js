/* 심쿵영어 중등 내신대비 · 본문 - 원장님 화면 (현황 · 배정 · 본문 만들기/검수 · 인쇄) */
'use strict';

const PT = { sub: 'now', ok: true, loaded: false, passages: [], sents: [], asg: [], prog: [], ov: null, edit: null };
const PT_ROLES = ['S', 'V', 'O', 'IO', 'DO', 'C', 'OC', 'M', 'X'];

async function loadPT() {
  const sb = S.sb;
  const p = await sb.from('passages').select('*').order('school_grade').order('lesson').order('title');
  if (p.error) { PT.ok = false; PT.err = p.error; return; }
  PT.ok = true;
  const [s, a, g, ov] = await Promise.all([
    vFetchAll(() => sb.from('passage_sentences').select('*').order('passage_id').order('ord').order('id')),
    vFetchAll(() => sb.from('passage_assignments').select('*').order('created_at').order('id')),
    vFetchAll(() => sb.from('passage_progress').select('student_id,passage_id,step,score,total').order('student_id').order('passage_id').order('step')),
    sb.rpc('passage_teacher_overview')
  ]);
  PT.passages = p.data || []; PT.sents = s; PT.asg = a; PT.prog = g; PT.ov = ov.error ? { students: [], weak: [] } : ov.data;
  PT.loaded = true; PT.at = new Date();
}
const ptPas = id => PT.passages.find(p => p.id === id);
const ptSents = pid => PT.sents.filter(s => s.passage_id === pid).sort((a, b) => a.ord - b.ord);
// 서버의 passage_steps 와 같은 규칙으로 단계 수를 세요
function ptStepCount(pid, tr) {
  let b = ptSents(pid); if (tr === 'basic' && b.some(s => s.key)) b = b.filter(s => s.key);
  const has = f => b.some(f);
  return [b.length > 0, has(s => s.chunks.length), has(s => s.pattern >= 1 && s.pattern <= (tr === 'basic' ? 3 : 5) && s.chunks.length), b.length > 0,
    has(s => s.blanks.length), b.length > 0, tr !== 'basic' && has(s => s.alt)].filter(Boolean).length;
}
const ptLabel = p => [p.school_grade, p.publisher, p.lesson].filter(Boolean).join(' · ');

/* ---------- 표시 문법: [S My grandmother] [V made] [IO me] [DO a warm scarf]. | 해석 ---------- */
function ptInferPattern(roles) {
  const h = r => roles.includes(r);
  if (!h('V')) return 0;
  if (h('IO') && h('DO')) return 4;
  if (h('OC') && (h('O') || h('DO'))) return 5;
  if (h('O') || h('DO')) return 3;
  if (h('C')) return 2;
  return 1;
}
function ptToMarkup(s) {
  if (!(s.chunks || []).length) return s.en;
  // 원래 문장에 덩어리를 차례로 대괄호로 씌워 쉼표·따옴표를 지켜요
  let out = '', pos = 0;
  for (const c of s.chunks) {
    const k = s.en.indexOf(c.t, pos);
    if (k < 0) return s.chunks.map(z => `[${z.r} ${z.t}]`).join(' ') + ((s.en.match(/[.!?]+["']?$/) || [''])[0]);
    out += s.en.slice(pos, k) + `[${c.r} ${c.t}]`; pos = k + c.t.length;
  }
  return out + s.en.slice(pos);
}
function ptParseMarkup(text) {
  const t = String(text || '').replace(/ /g, ' ').trim();
  const re = /\[(S|V|O|IO|DO|C|OC|M|X)\s+([^\]]+)\]/gi;
  const chunks = []; let m, last = 0, stray = '';
  while ((m = re.exec(t))) { stray += t.slice(last, m.index); chunks.push({ t: m[2].trim(), r: m[1].toUpperCase(), ko: '' }); last = re.lastIndex; }
  const tail = t.slice(last).trim(); stray += tail;
  if (!chunks.length) return { en: t, chunks: [], pattern: 0 };
  const warn = stray.replace(/[\s.!?,;:"'“”‘’()-]/g, '') ? '괄호 밖에 글자가 있어요' : '';
  const en = t.replace(re, '$2').replace(/\s+([,.!?;:])/g, '$1').replace(/\s+/g, ' ').trim();
  return { en, chunks, pattern: ptInferPattern(chunks.map(c => c.r)), warn };
}
function ptSplitSentences(text) {
  return String(text || '').replace(/\r/g, '').split(/\n+/).flatMap(l => l.trim() ? l.trim().split(/(?<=[.!?]["']?)\s+(?=["'A-Z(])/) : []).map(x => x.trim()).filter(x => /[A-Za-z]/.test(x));
}
function ptCheck(s) {
  const out = [];
  if (s.pattern && s.chunks.length && typeof patternOkClient === 'function' && !patternOkClient(s.pattern, s.chunks.map(c => c.r))) out.push(`성분 구성이 ${s.pattern}형식과 맞지 않아요`);
  if (!s.chunks.length) out.push('성분 표시가 없어요');
  if (!s.ko) out.push('해석이 없어요');
  return out;
}
function patternOkClient(p, roles) {
  const h = r => roles.includes(r), obj = h('O') || h('IO') || h('DO');
  if (!h('V')) return false;
  return { 1: !obj && !h('C') && !h('OC'), 2: h('C') && !obj && !h('OC'), 3: h('O') && !h('IO') && !h('DO') && !h('C') && !h('OC'), 4: h('IO') && h('DO') && !h('OC'), 5: h('O') && h('OC') && !h('IO') }[p] ?? true;
}

async function tabPassage() {
  const tb = $('#tb');
  if (!PT.loaded) { tb.innerHTML = '<p class="muted">본문 자료를 불러오는 중…</p>'; await loadPT(); }
  if (!PT.ok) {
    tb.innerHTML = `<div class="card"><h2>본문 학습을 켜려면 DB 업데이트가 필요해요</h2><p>설치 안내서의 <b>12단계 업데이트</b>대로 <code>schema12_passage.sql</code> 을 실행해 주세요.</p><p class="tiny">${esc(errText(PT.err))}</p></div>`;
    return;
  }
  const subs = [['now', '현황'], ['assign', '배정'], ['list', '본문'], ['print', '인쇄']];
  tb.innerHTML = `<div class="vsubs noprint">${subs.map(([k, n]) => `<button class="seg ${PT.sub === k ? 'on' : ''}" data-ps="${k}">${n}</button>`).join('')}
    <button class="btn ghost small" id="prl" style="margin-left:auto">새로고침</button></div><div id="pb"></div>`;
  document.querySelectorAll('[data-ps]').forEach(b => b.onclick = () => { PT.sub = b.dataset.ps; if (PT.sub !== 'list') PT.edit = null; if (PT.sub === 'now') PT.loaded = false; tabPassage(); });
  $('#prl').onclick = async () => { PT.loaded = false; await tabPassage(); };
  ({ now: ptNow, assign: ptAssign, list: ptList, print: ptPrint })[PT.sub]();
}

/* ---------- 현황 ---------- */
function ptNow() {
  const ov = PT.ov || { students: [], weak: [] }, by = new Map(ov.students.map(x => [x.student_id, x]));
  const stu = T.students.filter(s => PT.asg.some(a => a.student_id === s.id));
  const cls = Array.from({ length: 5 }, (_, k) => k + 1).map(n => { let ok = 0, all = 0; for (const s of stu) { const b = ((by.get(s.id) || {}).by_pattern || {})[n]; if (b) { ok += b[0]; all += b[1]; } } return { n, ok, all }; });
  const bar = (n, ok, all) => `<div class="pfbar"><span>${n}형식</span><i><b class="${all && ok / all >= .8 ? 'ok' : ''}" style="width:${all ? ok / all * 100 : 0}%"></b></i><span>${all ? Math.round(ok / all * 100) + '%' : '-'}</span></div>`;
  const cards = stu.map(s => {
    const o = by.get(s.id) || {}, bp = o.by_pattern || {};
    const rows = PT.asg.filter(a => a.student_id === s.id).map(a => {
      const p = ptPas(a.passage_id); if (!p) return '';
      const done = PT.prog.filter(g => g.student_id === s.id && g.passage_id === p.id).length, all = ptStepCount(p.id, a.track);
      return `<div class="prow"><span>${esc(p.title)} <small class="tiny">${P_TRACK[a.track] || ''}</small></span><div class="pbar"><i style="width:${all ? Math.min(100, done / all * 100) : 0}%"></i></div><b>${done}/${all}</b></div>`;
    }).join('');
    return `<article class="scard ${o.today_n ? 'on' : ''}"><div class="sh"><div class="av">${esc(String(s.name).slice(0, 1))}</div><div class="sn"><b>${esc(s.name)}</b><span>${esc(s.grade)}</span></div>
      <span class="st ${o.today_n ? 'on' : ''}">${o.today_n ? `오늘 ${o.today_n}문제` : '오늘 학습 없음'}</span></div>
      <div class="sprog">${rows}</div>
      <div>${[1, 2, 3, 4, 5].map(n => bar(n, (bp[n] || [0, 0])[0], (bp[n] || [0, 0])[1])).join('')}</div>
      <div class="sf"><span>문장 복습 대기 ${o.due || 0}개</span><span>${o.last_at ? '마지막 ' + fmtDT(o.last_at) : '기록 없음'}</span></div></article>`;
  }).join('');
  const weak = (ov.weak || []).map(w => `<div class="psent"><div class="ph"><span>${esc(w.en)}</span><span class="badge bad">${w.wrong}번 · ${w.students}명</span></div><div class="tiny">${esc((ptPas(w.passage_id) || {}).title || '')}${w.pattern ? ` · ${w.pattern}형식` : ''}</div></div>`).join('');
  $('#pb').innerHTML = `<section class="hero"><div><small>중등 내신대비</small><h1>본문 · 형식 현황</h1><p>${stu.length ? `본문을 배정한 학생 ${stu.length}명의 형식별 정답률이에요.` : '아직 본문을 배정한 학생이 없어요.'}</p></div><div class="upd">마지막 새로고침<br><b>${fmtDT(PT.at)}</b></div></section>
    <div class="grid2"><div class="card"><h3 style="margin:0 0 8px">반 전체 형식별 정답률</h3>${cls.map(c => bar(c.n, c.ok, c.all)).join('')}<p class="tiny" style="margin-top:6px">성분 찾기·형식 고르기 답 기준 (복습 제외)</p></div>
      <div class="card"><h3 style="margin:0 0 8px">최근 30일 많이 틀린 문장</h3>${weak || '<p class="muted">아직 없어요.</p>'}</div></div>
    <section class="sgrid">${cards || '<div class="card">배정에서 학생에게 본문을 배정해 주세요.</div>'}</section>`;
}

/* ---------- 배정 ---------- */
function ptAssign() {
  const pub = PT.passages.filter(p => p.status === 'published');
  const rows = PT.asg.map(a => {
    const s = T.sById[a.student_id], p = ptPas(a.passage_id); if (!s || !p) return '';
    return `<tr><td><b>${esc(s.name)}</b> <span class="tiny">${esc(s.grade)}</span></td><td>${esc(p.title)} <span class="tiny">${esc(ptLabel(p))}</span></td>
      <td><select data-tr="${a.id}">${Object.entries(P_TRACK).map(([k, n]) => `<option value="${k}" ${a.track === k ? 'selected' : ''}>${n}</option>`).join('')}</select></td>
      <td><button class="btn ghost small" data-rs="${a.id}">처음부터</button> <button class="btn ghost small" data-da="${a.id}">해제</button></td></tr>`;
  }).join('');
  $('#pb').innerHTML = `<div class="card"><h2>본문 배정하기</h2>
    ${pub.length ? `<label>본문</label><select id="ppk">${pub.map(p => `<option value="${p.id}">${esc(p.title)} (${esc(ptLabel(p))} · ${ptSents(p.id).length}문장)</option>`).join('')}</select>
    <label style="margin-top:10px">학생 고르기</label><div class="picks" id="ppst">${T.students.map(s => `<label class="pick"><input type="checkbox" value="${s.id}"> ${esc(s.name)} <span class="tiny">${esc(s.grade)}</span></label>`).join('')}</div>
    <label style="margin-top:10px">수준</label><div class="picks">${Object.entries(P_TRACK).map(([k, n], i) => `<label class="pick"><input type="radio" name="ptr" value="${k}" ${k === 'normal' ? 'checked' : ''}> ${n}</label>`).join('')}</div>
    <div class="tiny" style="margin-top:4px">🌱 기초: 핵심 문장만 · S/V만 찾기 · 1~3형식 · 덩어리 배열 · 보기 빈칸 · 첫 글자 보고 쓰기<br>🌿 기본: 모든 문장 · S V O C M · 1~5형식 · 단어 배열 · 첫 글자 빈칸 · 단어 제시 영작 · 바꿔 쓰기<br>🌳 심화: I.O D.O O.C까지 · 함정 단어 섞인 배열 · 힌트 없는 빈칸·영작 · 바꿔 쓰기</div>
    <button class="btn" id="psave" style="margin-top:12px">배정하기</button><p class="tiny">이미 배정된 학생은 수준만 바뀌고 기록은 그대로예요.</p>`
    : '<p>공개된 본문이 없어요. <b>본문</b>에서 본문을 만들고 <b>학생에게 공개</b>를 눌러 주세요.</p>'}</div>
    <div class="card"><h2>배정 현황</h2>${rows ? `<div class="tablewrap"><table><thead><tr><th>학생</th><th>본문</th><th>수준</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : '<p class="muted">아직 배정이 없어요.</p>'}</div>`;
  if ($('#psave')) $('#psave').onclick = async () => {
    const ids = [...document.querySelectorAll('#ppst input:checked')].map(i => i.value);
    if (!ids.length) return toast('학생을 골라 주세요');
    const track = document.querySelector('[name=ptr]:checked').value, pid = $('#ppk').value;
    const { error } = await S.sb.from('passage_assignments').upsert(ids.map(id => ({ student_id: id, passage_id: pid, track })), { onConflict: 'student_id,passage_id' });
    if (error) return toast(errText(error));
    toast(`${ids.length}명에게 배정했어요`); PT.loaded = false; tabPassage();
  };
  document.querySelectorAll('[data-tr]').forEach(sel => sel.onchange = async () => {
    const { error } = await S.sb.from('passage_assignments').update({ track: sel.value }).eq('id', sel.dataset.tr);
    if (error) return toast(errText(error));
    PT.asg.find(a => a.id === sel.dataset.tr).track = sel.value; toast('수준을 바꿨어요');
  });
  document.querySelectorAll('[data-da]').forEach(b => b.onclick = async () => {
    if (!confirm('이 배정을 해제할까요? (학습 기록은 남아요)')) return;
    const { error } = await S.sb.from('passage_assignments').delete().eq('id', b.dataset.da); if (error) return toast(errText(error));
    PT.asg = PT.asg.filter(a => a.id !== b.dataset.da); ptAssign();
  });
  document.querySelectorAll('[data-rs]').forEach(b => b.onclick = async () => {
    const a = PT.asg.find(x => x.id === b.dataset.rs);
    if (!confirm('이 본문을 처음 단계부터 다시 학습시킬까요? (답안 기록은 남아요)')) return;
    const { error } = await S.sb.rpc('passage_reset', { p_student: a.student_id, p_passage: a.passage_id }); if (error) return toast(errText(error));
    PT.prog = PT.prog.filter(g => !(g.student_id === a.student_id && g.passage_id === a.passage_id)); toast('처음부터 다시 하도록 바꿨어요');
  });
}

/* ---------- 본문 목록 · 만들기 · 검수 ---------- */
function ptList() {
  if (PT.edit) return ptEditor();
  const groups = ['중1', '중2', '중3', ''].map(g => {
    const ps = PT.passages.filter(p => (p.school_grade || '') === g); if (!ps.length) return '';
    return `<div class="vt-lv"><h3>${g || '학년 미정'}</h3><div class="bgrid">${ps.map(p => `<button class="bcard" data-pe="${p.id}"><b>${esc(p.title)}</b><span>${esc(ptLabel(p))} · ${ptSents(p.id).length}문장 · ${PT.asg.filter(a => a.passage_id === p.id).length}명 배정</span>${p.status === 'published' ? '<span class="badge ok">학생에게 공개</span>' : '<span class="badge warn">검수 중(비공개)</span>'}</button>`).join('')}</div></div>`;
  }).join('');
  $('#pb').innerHTML = `<div class="card"><div class="row between"><div><h2 style="margin:0">교과서 본문</h2><div class="muted">본문을 붙여넣거나 PDF에서 읽은 뒤, AI 분석 또는 표시 문법으로 문장 성분·형식을 넣어요. 검수한 뒤 공개해요.</div></div>
    <button class="btn" id="pnew">+ 새 본문</button></div></div>${groups || '<div class="card muted">아직 본문이 없어요.</div>'}`;
  $('#pnew').onclick = () => ptNewModal();
  document.querySelectorAll('[data-pe]').forEach(b => b.onclick = () => { const p = ptPas(b.dataset.pe); PT.edit = { id: p.id, meta: { ...p }, sents: ptSents(p.id).map(s => ({ ...s, chunks: s.chunks || [], points: s.points || [], blanks: s.blanks || [] })) }; ptEditor(); });
}
function ptNewModal() {
  const m = modal(`<h2>새 본문 만들기</h2>
    <div class="setgrid"><div><label>본문 이름</label><input type="text" id="nt" placeholder="예: Lesson 5 Reading"></div><div><label>학년</label>${vtGradeSelect('ng', '')}</div>
      <div><label>교과서 (출판사·저자)</label><input type="text" id="np" placeholder="예: 동아(윤정미)"></div><div><label>과</label><input type="text" id="nl" placeholder="예: Lesson 5"></div></div>
    <div class="row" style="margin-top:8px"><input type="file" id="pf" accept=".pdf,.txt"><span class="tiny">PDF 쪽</span><input type="number" id="pa" min="1" value="1" style="width:70px"> ~ <input type="number" id="pz" min="1" style="width:70px"><button class="btn ghost small" id="pread">PDF 글자 읽기</button></div>
    <label style="margin-top:8px">본문 (영어 본문을 붙여넣거나, 표시 문법으로 한 줄에 한 문장씩)</label>
    <textarea id="pt" rows="9" placeholder="My grandmother made me a warm scarf. She looks like her mom. ...&#10;&#10;또는 표시 문법:&#10;[S My grandmother] [V made] [IO me] [DO a warm scarf]. | 할머니가 나에게 따뜻한 목도리를 만들어 주셨다."></textarea>
    <div class="tiny">표시 문법 기호: S V O IO DO C OC M X(접속사 등) · 줄 끝에 <code>| 해석</code> 을 붙이면 해석도 들어가요.</div>
    <div class="row" style="margin-top:12px"><button class="btn" id="pai">🤖 AI로 분석하기</button><button class="btn ghost" id="pmk">표시 문법으로 넣기</button><button class="btn ghost" id="pcx">취소</button></div>
    <div id="pmsg" class="tiny" style="margin-top:6px">AI 분석은 한 과 본문 기준 약 100~200원이에요(Sonnet). 결과는 저장 전에 고칠 수 있어요.</div>`);
  let file = null;
  m.querySelector('#pcx').onclick = () => m.remove();
  m.querySelector('#pf').onchange = async e => { file = e.target.files[0]; if (file && /\.txt$/i.test(file.name)) m.querySelector('#pt').value = await file.text(); };
  m.querySelector('#pread').onclick = async () => {
    if (!file) return toast('PDF 파일을 먼저 골라 주세요');
    try { const r = await pdfText(file, +m.querySelector('#pa').value || 1, +m.querySelector('#pz').value || 0); m.querySelector('#pt').value = r.text; if (r.text.replace(/\s/g, '').length < 50) toast('글자를 거의 못 읽었어요. 스캔 PDF는 읽을 수 없어요.', 5000); }
    catch (e) { toast(errText(e), 4500); }
  };
  const meta = () => ({ title: m.querySelector('#nt').value.trim(), school_grade: m.querySelector('#ng').value, publisher: m.querySelector('#np').value.trim(), lesson: m.querySelector('#nl').value.trim() });
  const open = sents => { const mt = meta(); if (!mt.title) mt.title = mt.lesson ? mt.lesson + ' 본문' : '새 본문'; PT.edit = { id: null, meta: mt, sents }; m.remove(); PT.sub = 'list'; tabPassage(); };
  m.querySelector('#pmk').onclick = () => {
    const lines = m.querySelector('#pt').value.split(/\n/).map(l => l.trim()).filter(Boolean);
    const marked = lines.some(l => /\[(S|V)\s/i.test(l));
    const sents = (marked ? lines : ptSplitSentences(lines.join('\n'))).map(l => {
      const [mk, ko = ''] = l.split(/\s+\|\s+/);
      const r = ptParseMarkup(mk);
      return { en: r.en, ko: ko.trim(), pattern: r.pattern, chunks: r.chunks, points: [], blanks: [], alt: '', alt_note: '', key: true, check: r.warn ? [r.warn] : [] };
    });
    if (!sents.length) return toast('문장이 없어요');
    open(sents);
  };
  m.querySelector('#pai').onclick = async () => {
    const text = m.querySelector('#pt').value.trim(); if (text.length < 20) return toast('본문을 먼저 넣어 주세요');
    const b = m.querySelector('#pai'); b.disabled = true; b.textContent = 'AI가 분석하는 중… (1~2분)';
    try {
      const mt = meta(), parts = [], all = ptSplitSentences(text);
      for (let k = 0; k < all.length; k += 18) parts.push(all.slice(k, k + 18).join(' '));
      if (!parts.length) parts.push(text);
      const got = [];
      for (let k = 0; k < parts.length; k++) {
        b.textContent = `AI가 분석하는 중… (${k + 1}/${parts.length})`;
        const r = await invokeFn('ai-feedback', { action: 'analyze_passage', text: parts[k], publisher: mt.publisher, grade: mt.school_grade, lesson: mt.lesson });
        if (!r.ok) {
          m.querySelector('#pmsg').innerHTML = `<span class="vred">${esc(r.message || 'AI 분석을 받지 못했어요.')}${got.length ? ` (앞부분 ${got.length}문장은 분석됐어요)` : ''}</span>`;
          b.disabled = false; b.textContent = '🤖 AI로 분석하기';
          if (got.length && confirm(`앞부분 ${got.length}문장만이라도 검수 화면으로 가져갈까요?`)) open(got);
          return;
        }
        got.push(...r.sentences.map(s => ({ ...s, blanks: (s.blanks || []).filter(w => pFindWord(s.en, w) >= 0) })));
      }
      toast(`${got.length}문장을 분석했어요. 검수해 주세요.`, 4000);
      open(got);
    } catch (e) { m.querySelector('#pmsg').innerHTML = `<span class="vred">${esc(errText(e))}</span>`; b.disabled = false; b.textContent = '🤖 AI로 분석하기'; }
  };
}
function ptEditor() {
  const E = PT.edit, mt = E.meta;
  const cards = E.sents.map((s, i) => {
    const chk = (s.check || []).concat(ptCheck(s)).filter((v, k, a) => a.indexOf(v) === k);
    return `<div class="psent ${chk.length ? 'warn' : ''}"><div class="ph"><span class="tiny">${i + 1}. ${s.pattern ? `<span class="pbadge">${s.pattern}형식</span>` : '<span class="badge gray">형식 제외</span>'} ${s.key ? '<span class="badge">핵심</span>' : ''}</span>
      <span><button class="btn ghost small" data-ed="${i}">고치기</button> <button class="btn ghost small" data-up="${i}" ${i ? '' : 'disabled'}>↑</button> <button class="btn ghost small" data-dl="${i}">✕</button></span></div>
      ${s.chunks.length ? pChunkHtml(s.chunks, { show: true }) : `<div class="pplain">${esc(s.en)}</div>`}
      <div class="tiny">${esc(s.ko)}</div>
      ${(s.blanks || []).length ? `<div class="tiny">빈칸: ${s.blanks.map(esc).join(', ')}</div>` : ''}${s.alt ? `<div class="tiny">바꿔 쓰기: ${esc(s.alt)}</div>` : ''}
      ${chk.length ? `<div class="tiny vred">⚠ ${chk.map(esc).join(' · ')}</div>` : ''}</div>`;
  }).join('');
  $('#pb').innerHTML = `<p><a href="#" id="pbk">← 본문 목록</a></p>
    <div class="card"><div class="row between"><h2 style="margin:0">${E.id ? '본문 고치기' : '새 본문 검수'}</h2>${E.id ? (mt.status === 'published' ? '<span class="badge ok">학생에게 공개 중</span>' : '<span class="badge warn">검수 중(비공개)</span>') : '<span class="badge warn">아직 저장 전</span>'}</div>
      <div class="setgrid" style="margin-top:8px"><div><label>본문 이름</label><input type="text" id="et" value="${esc(mt.title)}"></div><div><label>학년</label>${vtGradeSelect('eg', mt.school_grade)}</div>
        <div><label>교과서</label><input type="text" id="ep" value="${esc(mt.publisher)}"></div><div><label>과</label><input type="text" id="el" value="${esc(mt.lesson)}"></div></div>
      <div class="row" style="margin-top:10px"><button class="btn" id="esave">저장</button>${E.id ? `<button class="btn ${mt.status === 'published' ? 'ghost' : ''}" id="epub">${mt.status === 'published' ? '비공개로 돌리기' : '학생에게 공개'}</button><button class="btn ghost" id="edel" style="margin-left:auto">본문 삭제</button>` : ''}
        <button class="btn ghost small" id="eadd">+ 문장 추가</button></div>
      <p class="tiny">⚠ 표시가 있는 문장을 먼저 확인해 주세요. 형식은 교재마다 가르치는 기준이 다를 수 있어요(look like = 2형식으로 분석해요).</p></div>
    ${cards}`;
  $('#pbk').onclick = e => { e.preventDefault(); if (!E.id && !confirm('저장하지 않은 본문이에요. 나갈까요?')) return; PT.edit = null; ptList(); };
  document.querySelectorAll('[data-ed]').forEach(b => b.onclick = () => ptSentModal(+b.dataset.ed));
  document.querySelectorAll('[data-up]').forEach(b => b.onclick = () => { const i = +b.dataset.up; [E.sents[i - 1], E.sents[i]] = [E.sents[i], E.sents[i - 1]]; ptEditor(); });
  document.querySelectorAll('[data-dl]').forEach(b => b.onclick = () => { if (confirm('이 문장을 뺄까요? (저장해야 반영돼요)')) { E.sents.splice(+b.dataset.dl, 1); ptEditor(); } });
  $('#eadd').onclick = () => { E.sents.push({ en: '', ko: '', pattern: 0, chunks: [], points: [], blanks: [], alt: '', alt_note: '', key: true }); ptSentModal(E.sents.length - 1); };
  $('#esave').onclick = () => ptSave();
  if ($('#epub')) $('#epub').onclick = async () => {
    const to = mt.status === 'published' ? 'draft' : 'published';
    if (to === 'published' && !E.sents.length) return toast('문장이 없어요');
    const { error } = await S.sb.from('passages').update({ status: to }).eq('id', E.id); if (error) return toast(errText(error));
    mt.status = to; const p = ptPas(E.id); if (p) p.status = to; toast(to === 'published' ? '학생에게 공개했어요' : '비공개로 돌렸어요'); ptEditor();
  };
  if ($('#edel')) $('#edel').onclick = async () => {
    if (!confirm('이 본문과 학생 학습 기록을 모두 지울까요? 되돌릴 수 없어요.')) return;
    if (prompt('지우려면 본문 이름을 그대로 입력하세요') !== mt.title) return toast('이름이 달라서 지우지 않았어요');
    const { error } = await S.sb.from('passages').delete().eq('id', E.id); if (error) return toast(errText(error));
    PT.edit = null; PT.loaded = false; toast('지웠어요'); tabPassage();
  };
}
function ptSentModal(i) {
  const s = PT.edit.sents[i];
  const m = modal(`<h2>${i + 1}번 문장</h2>
    <label>성분 표시 (표시 문법)</label><textarea id="sm" class="pmark" rows="3">${esc(ptToMarkup(s))}</textarea>
    <div class="tiny">예: <code>[S My grandmother] [V made] [IO me] [DO a warm scarf].</code> · 수식어는 M, 접속사·감탄사는 X</div>
    <div id="spv"></div>
    <div class="setgrid"><div><label>형식</label><select id="spt"><option value="auto">성분에 맞게 자동</option>${[0, 1, 2, 3, 4, 5].map(n => `<option value="${n}" ${s.pattern === n ? 'selected' : ''}>${n ? n + '형식' : '형식 문제에서 빼기'}</option>`).join('')}</select></div>
      <div><label class="pick" style="margin-top:22px"><input type="checkbox" id="sk" ${s.key ? 'checked' : ''}> 핵심 문장 (기초 학생에게도 내요)</label></div></div>
    <label>해석</label><input type="text" id="sko" value="${esc(s.ko)}">
    <label>덩어리 해석 (덩어리 순서대로, / 로 나눠요)</label><input type="text" id="sck" value="${esc(s.chunks.map(c => c.ko || '').join(' / '))}">
    <label>빈칸으로 낼 말 (문장 안의 글자 그대로, 쉼표로 나눠요)</label><input type="text" id="sb" value="${esc((s.blanks || []).join(', '))}">
    <div class="setgrid"><div><label>바꿔 쓰기 문장</label><input type="text" id="sa" value="${esc(s.alt)}" placeholder="예: My grandmother made a warm scarf for me."></div><div><label>바꿔 쓰기 지시</label><input type="text" id="san" value="${esc(s.alt_note)}" placeholder="예: 3형식으로 바꿔 쓰세요"></div></div>
    <label>시험 포인트 (한 줄에 하나, "말: 설명")</label><textarea id="spo" rows="2">${esc((s.points || []).map(p => p.t + ': ' + p.note).join('\n'))}</textarea>
    <div class="row" style="margin-top:12px"><button class="btn" id="sok">적용</button><button class="btn ghost" id="scx">취소</button></div>`);
  const pv = () => { const r = ptParseMarkup(m.querySelector('#sm').value); m.querySelector('#spv').innerHTML = r.chunks.length ? pChunkHtml(r.chunks, { show: true }) + `<div class="tiny">자동 형식: ${r.pattern ? r.pattern + '형식' : '-'}${r.warn ? ' · ⚠ ' + r.warn : ''}</div>` : '<div class="tiny vred">[S ...] [V ...] 처럼 대괄호로 성분을 표시해 주세요</div>'; };
  m.querySelector('#sm').oninput = pv; pv();
  m.querySelector('#scx').onclick = () => { if (!s.en) PT.edit.sents.splice(i, 1); m.remove(); ptEditor(); };
  m.querySelector('#sok').onclick = () => {
    const r = ptParseMarkup(m.querySelector('#sm').value);
    if (!r.en.trim()) return toast('문장을 넣어 주세요');
    const kos = m.querySelector('#sck').value.split('/').map(x => x.trim());
    r.chunks.forEach((c, k) => c.ko = kos[k] || '');
    const pt = m.querySelector('#spt').value;
    const blanks = m.querySelector('#sb').value.split(',').map(x => x.trim()).filter(Boolean);
    const badB = blanks.filter(b => pFindWord(r.en, b) < 0);
    if (badB.length) return toast(`빈칸 "${badB[0]}" 이(가) 문장 안에 없어요`);
    Object.assign(s, { en: r.en, chunks: r.chunks, pattern: pt === 'auto' ? r.pattern : +pt, ko: m.querySelector('#sko').value.trim(), key: m.querySelector('#sk').checked, blanks,
      alt: m.querySelector('#sa').value.trim(), alt_note: m.querySelector('#san').value.trim(),
      points: m.querySelector('#spo').value.split('\n').map(l => { const k = l.indexOf(':'); return k > 0 ? { t: l.slice(0, k).trim(), note: l.slice(k + 1).trim() } : null; }).filter(Boolean), check: r.warn ? [r.warn] : [] });
    m.remove(); ptEditor();
  };
}
async function ptSave() {
  const E = PT.edit, btn = $('#esave'); btn.disabled = true; btn.textContent = '저장 중…';
  try {
    const mt = { title: $('#et').value.trim() || E.meta.title, school_grade: $('#eg').value, publisher: $('#ep').value.trim(), lesson: $('#el').value.trim() };
    E.sents = E.sents.filter(s => String(s.en || '').trim());
    if (!E.sents.length) throw new Error('문장이 없어요');
    if (E.id) {
      const cur = await S.sb.from('passage_sentences').select('id').eq('passage_id', E.id);
      if (cur.error) throw cur.error;
      const keep = new Set(E.sents.filter(s => s.id).map(s => s.id)), gone = (cur.data || []).filter(r => !keep.has(r.id));
      if (gone.length && !confirm(`문장 ${gone.length}개를 지워요. 그 문장의 학생 답안도 함께 지워져요. 계속할까요?`)) throw new Error('저장을 취소했어요');
    }
    // 본문과 문장을 한 번에 저장해요. 중간에 문제가 생기면 아무것도 바뀌지 않아요.
    const sents = E.sents.map(s => ({ id: s.id || null, en: s.en, ko: s.ko || '', pattern: s.pattern || 0, chunks: s.chunks || [], points: s.points || [], blanks: s.blanks || [], alt: s.alt || '', alt_note: s.alt_note || '', key: !!s.key }));
    const { data: pid, error } = await S.sb.rpc('passage_save', { p_id: E.id || null, p_meta: mt, p_sents: sents });
    if (error) throw error;
    E.id = pid;
    toast('저장했어요'); const keepEdit = { id: pid };
    PT.loaded = false; await loadPT();
    const p = ptPas(keepEdit.id); PT.edit = { id: p.id, meta: { ...p }, sents: ptSents(p.id).map(s => ({ ...s })) }; ptEditor();
  } catch (e) { btn.disabled = false; btn.textContent = '저장'; toast(errText(e), 4500); }
}

/* ---------- 인쇄 ---------- */
function ptPrint() {
  if (!PT.passages.length) { $('#pb').innerHTML = '<div class="card muted">먼저 본문을 만들어 주세요.</div>'; return; }
  $('#pb').innerHTML = `<div class="card"><h2>본문 학습지 · 시험지 인쇄</h2>
    <div class="setgrid"><div><label>본문</label><select id="qp">${PT.passages.map(p => `<option value="${p.id}">${esc(p.title)} (${esc(ptLabel(p))})</option>`).join('')}</select></div>
      <div><label>종류</label><select id="qk"><option value="role">성분 표시 · 형식 쓰기 연습지</option><option value="key">성분 · 형식 분석본 (정답지 겸 학습용)</option><option value="blank">빈칸 시험지</option><option value="write">영작 시험지 (우리말 → 영어)</option><option value="convert">바꿔 쓰기 시험지</option></select></div>
      <div><label class="pick" style="margin-top:22px"><input type="checkbox" id="qo"> 핵심 문장만</label></div><div><label class="pick" style="margin-top:22px"><input type="checkbox" id="qa" checked> 정답지 함께</label></div></div>
    <button class="btn" id="qgo" style="margin-top:12px">인쇄 / PDF로 저장</button><span class="tiny"> A4 · 흑백 위주 · 성분은 기호와 밑줄로 표시돼요</span></div>`;
  $('#qgo').onclick = () => {
    const p = ptPas($('#qp').value), kind = $('#qk').value;
    let ss = ptSents(p.id); if ($('#qo').checked) ss = ss.filter(s => s.key);
    if (kind === 'blank') ss = ss.filter(s => s.blanks.length && pFindWord(s.en, s.blanks[0]) >= 0); if (kind === 'convert') ss = ss.filter(s => s.alt);
    if (!ss.length) return toast('이 종류로 낼 문장이 없어요');
    const lab = r => P_ROLE_LABEL[r] || r;
    const chunkRow = s => `<div class="ck">${s.chunks.map(c => `<span class="c ${c.r === 'M' || c.r === 'X' ? 'm' : ''}"><i>${esc(lab(c.r))}</i>${esc(c.t)}</span>`).join(' ')}</div>`;
    const blankOf = s => { const b = s.blanks[0], k = pFindWord(s.en, b); if (k < 0) return esc(s.en); return esc(s.en.slice(0, k)) + '<u>' + '&nbsp;'.repeat(Math.max(10, b.length * 2)) + '</u>' + esc(s.en.slice(k + b.length)); };
    const kinds = { role: '성분 표시 · 형식 쓰기', key: '성분 · 형식 분석본', blank: '빈칸 채우기', write: '영작', convert: '바꿔 쓰기' };
    const q = (s, i) => {
      const n = `<span class="n">${i + 1}</span>`;
      if (kind === 'role') return `<div class="q">${n}<div class="b"><div class="en big">${esc(s.en)}</div><div class="mk"></div><div class="ln">( &nbsp;&nbsp; )형식 &nbsp; 해석: <span class="line"></span></div></div></div>`;
      if (kind === 'key') return `<div class="q">${n}<div class="b">${chunkRow(s)}<div class="ln">${s.pattern ? `<b>${s.pattern}형식</b> ${P_FORMULA[s.pattern]}` : ''} · ${esc(s.ko)}</div>${(s.points || []).map(pp => `<div class="pt">📌 ${esc(pp.t)} — ${esc(pp.note)}</div>`).join('')}${s.alt ? `<div class="pt">↔ ${esc(s.alt)}</div>` : ''}</div></div>`;
      if (kind === 'blank') return `<div class="q">${n}<div class="b"><div class="en">${blankOf(s)}</div><div class="ko">${esc(s.ko)}</div></div></div>`;
      if (kind === 'write') return `<div class="q">${n}<div class="b"><div class="ko2">${esc(s.ko)}</div><div class="wl"></div></div></div>`;
      return `<div class="q">${n}<div class="b"><div class="en">${esc(s.en)}</div><div class="ko">${esc(s.alt_note || '바꿔 쓰세요')}</div><div class="wl"></div></div></div>`;
    };
    const a = (s, i) => `<div class="a"><span class="n">${i + 1}</span>${kind === 'role' ? chunkRow(s) + `<div>${s.pattern ? s.pattern + '형식' : '-'} · ${esc(s.ko)}</div>` : kind === 'blank' ? esc(s.blanks[0]) : kind === 'convert' ? esc(s.alt) : esc(s.en)}</div>`;
    const head = `<div class="hd"><div><b>스텔라의 심쿵영어</b> · 내신대비 본문 · ${kinds[kind]}</div><div>이름 <span class="nm"></span> 날짜 <span class="nm"></span></div></div><h1>${esc(p.title)} <small>${esc(ptLabel(p))}</small></h1>
      ${kind === 'role' ? '<div class="lg">S 주어 · V 동사 · O 목적어(I.O 간접 · D.O 직접) · C 보어(O.C 목적격보어) · M 수식어는 ( ) 로 묶어요</div>' : ''}`;
    const body = head + `<div class="qs ${kind === 'blank' ? 'two' : ''}">${ss.map(q).join('')}</div>` + ($('#qa').checked && kind !== 'key' ? `<div class="pb"></div><div class="hd"><div><b>정답</b> · ${esc(p.title)} · ${kinds[kind]}</div></div><div class="qs ans">${ss.map(a).join('')}</div>` : '');
    vtOpenPrint(p.title + ' ' + kinds[kind], body, `
      .hd{display:flex;justify-content:space-between;font-size:9.5pt;border-bottom:1.5px solid #d4544b;padding-bottom:3px}.hd .nm{display:inline-block;min-width:70px;border-bottom:1px solid #999;margin-right:6px}
      h1{font-size:13pt;margin:6px 0 4px}h1 small{font-size:9.5pt;color:#666;font-weight:400}.lg{font-size:8.5pt;color:#555;margin-bottom:6px}
      .q{display:flex;gap:6px;break-inside:avoid;padding:6px 0;border-bottom:1px dotted #ccc}.q .b{flex:1}.n{color:#d4544b;font-weight:700;min-width:18px;font-size:9pt}
      .en{font-size:10.5pt}.en.big{font-size:11.5pt;line-height:2.1;letter-spacing:.01em}.mk{height:4px}.ko{font-size:9pt;color:#555}.ko2{font-size:10.5pt}
      .ln{font-size:9.5pt;margin-top:3px}.line{display:inline-block;width:70%;border-bottom:1px solid #888}
      .wl{height:30px;border-bottom:1px solid #888;margin-top:2px}
      .ck{display:flex;flex-wrap:wrap;gap:3px 6px;font-size:10.5pt}.ck .c{display:inline-flex;flex-direction:column;align-items:center;border-bottom:1.5px solid #333;padding:0 2px}
      .ck .c.m{border-bottom:1px dashed #999}.ck .c.m::before{content:'';}.ck .c i{font-style:normal;font-size:7.5pt;font-weight:700;color:#d4544b;line-height:1}
      .pt{font-size:8.5pt;color:#444}.qs.two{column-count:2;column-gap:7mm}.qs.ans .a{break-inside:avoid;padding:3px 0;border-bottom:1px dotted #ddd;font-size:9.5pt;display:flex;gap:6px}
      .pb{break-after:page}`);
  };
}
