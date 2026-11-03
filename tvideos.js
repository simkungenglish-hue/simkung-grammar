/* 심쿵문법 - 선생님 화면 「영상 강의」 탭: 교재·단원별 유튜브 영상 보기/추가/삭제 + 학생 시청 현황 */
'use strict';
(function () {
  try {
    TAB_ICON.videos = '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m10 9.5 5 2.5-5 2.5z"/>';
    const qi = TABS.findIndex(t => t[0] === 'questions');
    if (!TABS.some(t => t[0] === 'videos')) TABS.splice(qi >= 0 ? qi + 1 : TABS.length, 0, ['videos', '영상 강의']);
  } catch (e) { /* 탭 등록 실패 시 기존 화면은 그대로 */ }
})();

const TV = { book: null, vids: [], lec: {}, prog: [] };
const tvLen = s => { s = Math.round(s || 0); return s ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : ''; };
const tvYtId = s => { s = String(s || '').trim(); const m = s.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([\w-]{11})/); return m ? m[1] : (/^[\w-]{11}$/.test(s) ? s : ''); };
const tvGradeIdx = b => { const m = String(b || '').match(/(초|중|고)\s?(\d)/); return m ? ({ 초: 0, 중: 10, 고: 20 }[m[1]] + Number(m[2])) : 99; };

async function tvLoad() {
  const [v, l, p] = await Promise.all([
    S.sb.from('unit_videos').select('*').order('ord'),
    S.sb.from('lec_videos').select('id,yt_id'),
    S.sb.from('lec_progress').select('student_id,video_id,watched_sec,completed,updated_at')
  ]);
  if (v.error) throw v.error;
  TV.vids = v.data || [];
  TV.lec = Object.fromEntries(((l && l.data) || []).map(x => [x.yt_id, x.id]));
  TV.prog = (p && p.data) || [];
}
function tvStats(yt) {
  const lid = TV.lec[yt]; if (!lid) return null;
  const rows = TV.prog.filter(r => r.video_id === lid && (r.watched_sec > 0 || r.completed));
  return { n: rows.length, done: rows.filter(r => r.completed).length, rows };
}

async function tabVideos() {
  const tb = $('#tb'); tb.innerHTML = '<p class="muted">영상 목록을 불러오는 중…</p>';
  await tvLoad();
  const books = [...new Set(T.units.map(u => u.school_book).concat(TV.vids.map(v => v.school_book)).filter(Boolean))].sort((a, b) => tvGradeIdx(a) - tvGradeIdx(b) || a.localeCompare(b, 'ko'));
  const vidCount = b => new Set(TV.vids.filter(v => v.school_book === b).map(v => v.yt_id)).size;
  if (!TV.book || !books.includes(TV.book)) TV.book = books.slice().sort((a, b) => vidCount(b) - vidCount(a))[0] || books[0];
  const units = T.units.filter(u => u.school_book === TV.book)
    .sort((a, b) => (parseInt(a.lesson) || 999) - (parseInt(b.lesson) || 999) || String(a.code).localeCompare(String(b.code)));
  const total = TV.vids.length;
  const tvLen2 = s => tvLen(s);
  const isCh = /천일문/.test(TV.book);
  const chapterRows = () => {
    const vs = TV.vids.filter(v => v.school_book === TV.book && v.unit_id);
    const byYt = new Map(); vs.forEach(v => { if (!byYt.has(v.yt_id)) byYt.set(v.yt_id, []); byYt.get(v.yt_id).push(v); });
    const groups = [...byYt.values()].map(arr => ({ v: arr[0], arr })).sort((a, b) => (a.v.lesson || 0) - (b.v.lesson || 0) || (a.v.no || 0) - (b.v.no || 0));
    const used = new Set();
    const html = groups.map(g => {
      const us = g.arr.map(v => ({ v, u: T.units.find(x => x.id === v.unit_id) })).filter(x => x.u).sort((a, b) => String(a.u.lesson).localeCompare(String(b.u.lesson), undefined, { numeric: true }));
      us.forEach(x => used.add(x.u.id));
      const urows = us.map(({ v, u }) => `<div class="row between" style="align-items:center;gap:8px;padding:8px 10px;border:1px solid #e2e8f0;border-radius:10px;margin-top:6px;background:#fff">
        <div><span class="badge gray">${esc(u.lesson || '')}</span> <b>${esc(u.title)}</b></div>
        <div class="row" style="gap:6px">${v.start_sec != null ? `<button class="btn small ghost" data-tvp="${v.id}" data-at="${v.start_sec}">▶ 이 부분 (${tvLen2(v.start_sec)})</button>` : ''}${v.start_sec == null && v.serse_sec != null ? `<button class="btn small ghost" data-tvp="${v.id}" data-at="${v.serse_sec}">✍️ 서술형 (${tvLen2(v.serse_sec)})</button>` : ''}</div></div>`).join('');
      return `<div class="card" style="padding:14px 16px;margin-bottom:12px;border:2px solid #c7d2fe;background:linear-gradient(180deg,#f5f7ff,#fff)">
        <h3 style="margin:0 0 8px">${esc(g.v.title)}</h3>
        <div class="vgrid" style="grid-template-columns:minmax(0,360px)">${tvChip(g.v)}</div>
        ${g.v.serse_sec != null ? `<button class="btn small" style="margin-top:8px" data-tvp="${g.v.id}" data-at="${g.v.serse_sec}">✍️ 서술형 풀이 보기 (${tvLen2(g.v.serse_sec)})</button>` : ''}
        <div style="margin-top:6px">${urows}</div></div>`;
    }).join('');
    const restUnits = units.filter(u => !used.has(u.id));
    return { html, restUnits };
  };
  const chap = isCh ? chapterRows() : null;
  const rows = (chap ? chap.html : '') + (chap ? chap.restUnits : units).map(u => {
    const vs = TV.vids.filter(v => v.unit_id === u.id).sort((a, b) => a.ord - b.ord);
    const chips = vs.length ? `<div class="vgrid">${vs.map(tvChip).join('')}</div>` : '';
    return `<div class="card" style="padding:14px 16px;margin-bottom:10px">
      <div class="row between" style="align-items:center;gap:8px"><div><span class="badge gray">${esc(u.lesson || '')}</span> <b>${esc(u.title)}</b></div>
      <button class="btn small" data-tva="${u.id}">+ 영상 넣기</button></div>
      ${chips || '<p class="tiny" style="margin-top:6px">아직 영상이 없어요.</p>'}</div>`;
  }).join('');
  tb.innerHTML = `<section class="hero"><div><small>교재·단원별 유튜브 강의</small><h1>영상 강의</h1></div></section>
    <div class="card soft"><p class="muted" style="margin:0">여기서 넣은 영상은 학생 화면의 해당 단원에 <b>🎬 영상 강의</b> 버튼으로 나와요. 학생에게는 그 단원이 <b>배정</b>되어 있어야 보여요. 지금 연결된 영상은 모두 <b>${total}개</b>예요.</p></div>
    <div class="row" style="gap:8px;flex-wrap:wrap;margin:12px 0">${books.map(b => `<button class="btn small ${b === TV.book ? '' : 'ghost'}" data-tvb="${esc(b)}">${esc(b)}${vidCount(b) ? ` · 🎬${vidCount(b)}` : ''}</button>`).join('')}</div>
    ${tvLibSection()}${rows || ''}`;
  tb.querySelectorAll('[data-tvb]').forEach(b => b.onclick = () => { TV.book = b.dataset.tvb; tabVideos(); });
  tb.querySelectorAll('[data-tvp]').forEach(b => b.onclick = () => tvPreview(b.dataset.tvp, b.dataset.at != null ? +b.dataset.at : null));
  tb.querySelectorAll('[data-tvd]').forEach(b => b.onclick = () => tvDelete(b.dataset.tvd));
  tb.querySelectorAll('[data-tva]').forEach(b => b.onclick = () => tvAdd(b.dataset.tva));
  tb.querySelectorAll('[data-tvlib]').forEach(b => b.onclick = () => tvAddLib());
}


function tvChip(v) {
  const st = tvStats(v.yt_id);
  return `<div class="vcard" style="cursor:default"><button class="vthumb" data-tvp="${v.id}" title="미리보기">${typeof vThumb === 'function' ? vThumb(v) : ''}</button>
    <div class="vbody"><b>${esc(v.title)}</b>
    ${st ? `<span class="badge ${st.n ? 'ok' : 'gray'}" style="align-self:flex-start">본 학생 ${st.n}명 · 완료 ${st.done}명</span>` : ''}
    <div class="row" style="gap:6px"><button class="btn small ghost" data-tvp="${v.id}">미리보기</button><button class="btn small ghost" data-tvd="${v.id}">빼기</button></div></div></div>`;
}
function tvLibSection() {
  const lv = TV.vids.filter(v => !v.unit_id && v.school_book === TV.book).sort((a, b) => (a.lesson || 0) - (b.lesson || 0) || (a.no || 0) - (b.no || 0));
  const ls = [...new Set(lv.map(v => v.lesson))];
  const inner = ls.map(l => `<div style="margin-top:10px"><span class="badge gray">${l === 99 ? '외부지문' : (l ? (/천일문/.test(TV.book) ? 'Ch.' + l : l + '과') : '기타')}</span><div class="vgrid">${lv.filter(v => v.lesson === l).map(tvChip).join('')}</div></div>`).join('');
  return `<div class="card" style="padding:14px 16px;margin-bottom:14px;border:2px solid #c7d2fe">
    <div class="row between" style="align-items:center;gap:8px"><div><b>📚 ${esc(TV.book)} 영상 강의실</b><div class="tiny">이 교재·학년 학생 화면의 「🎬 영상 강의실」에 과별로 보여요. (단원 문제와 연결되지 않은 영상)</div></div>
    <button class="btn small" data-tvlib="1">+ 영상 넣기</button></div>
    ${inner || '<p class="tiny" style="margin-top:6px">단원과 따로 넣은 영상이 없어요. 단원에 넣은 영상도 학생 영상 강의실에 함께 보여요.</p>'}</div>`;
}
function tvAddLib() {
  const bg = modal(`<h3 style="margin-top:0">+ 영상 강의실에 넣기</h3><p class="tiny">${esc(TV.book)} · 이 학년 학생 모두에게 과별로 보여요</p>
    <label class="tiny">유튜브 주소</label><input id="tvu" placeholder="https://youtu.be/…" style="width:100%">
    <div class="row" style="gap:8px;margin-top:8px"><div style="flex:1"><label class="tiny">과 (숫자)</label><input id="tvls" placeholder="1" style="width:100%"></div><div style="flex:1"><label class="tiny">순서 (① = 1, ② = 2)</label><input id="tvno" placeholder="1" style="width:100%"></div></div>
    <label class="tiny" style="display:block;margin-top:8px">영상 이름</label><input id="tvt" placeholder="예: 1과 문법① be동사" style="width:100%">
    <label class="tiny" style="display:block;margin-top:8px">길이 (예: 13:29, 몰라도 돼요)</label><input id="tvl" placeholder="13:29" style="width:100%">
    <label class="tiny" style="display:block;margin-top:8px">바로가기 (한 줄에 하나씩 "00:36 개념", 없어도 돼요)</label><textarea id="tvc" rows="4" style="width:100%"></textarea>
    <div class="row between" style="margin-top:12px"><button class="btn small ghost" id="tvcx">취소</button><button class="btn small" id="tvok">넣기</button></div>`);
  bg.querySelector('#tvcx').onclick = () => bg.remove();
  bg.querySelector('#tvok').onclick = async () => {
    const yt = tvYtId(bg.querySelector('#tvu').value), title = bg.querySelector('#tvt').value.trim();
    const lesson = parseInt(bg.querySelector('#tvls').value) || null, no = parseInt(bg.querySelector('#tvno').value) || 1;
    if (!yt) return toast('유튜브 주소를 확인해 주세요'); if (!title) return toast('영상 이름을 넣어 주세요'); if (!lesson) return toast('몇 과인지 숫자로 넣어 주세요');
    const lt = bg.querySelector('#tvl').value.trim(); let len = null;
    if (lt) { const p = lt.split(':').map(Number); len = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : null; }
    const chapters = bg.querySelector('#tvc').value.split('\n').map(l => l.trim().match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/)).filter(Boolean).map(m => [m[1], m[2]]);
    const { error } = await S.sb.from('unit_videos').insert({ unit_id: null, school_book: TV.book, lesson, no, yt_id: yt, title, len_sec: len, chapters, ord: no });
    if (error) return toast('넣지 못했어요: ' + (/duplicate|unique/i.test(error.message) ? '이미 들어 있는 영상이에요' : error.message));
    bg.remove(); toast('영상 강의실에 넣었어요 ♥'); tabVideos();
  };
}

function tvPreview(id, at) {
  const v = TV.vids.find(x => x.id === id); if (!v) return;
  const st = tvStats(v.yt_id);
  const who = st && st.rows.length ? st.rows.map(r => { const s = T.students.find(x => x.id === r.student_id); return `<span class="badge ${r.completed ? 'ok' : ''}" style="margin:2px">${esc(s ? s.name : '?')} ${r.completed ? '✓' : Math.round(r.watched_sec / 60) + '분'}</span>`; }).join('') : '<span class="tiny">아직 본 학생이 없어요.</span>';
  const ch = (v.chapters || []).map(([t, x]) => `<div class="tiny"><b>${esc(t)}</b> ${esc(x)}</div>`).join('');
  const bg = modal(`<h3 style="margin-top:0">🎬 ${esc(v.title)}</h3>
    <div style="position:relative;width:100%;aspect-ratio:16/9;border-radius:10px;overflow:hidden;background:#000"><iframe src="https://www.youtube.com/embed/${esc(v.yt_id)}?rel=0${at ? `&start=${Math.floor(at)}&autoplay=1` : ''}" style="position:absolute;inset:0;width:100%;height:100%;border:0" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>
    <p style="margin:10px 0 4px"><b>본 학생</b></p><div>${who}</div>
    ${ch ? `<p style="margin:10px 0 4px"><b>바로가기</b></p>${ch}` : ''}
    <div class="row between" style="margin-top:12px"><a class="btn small ghost" href="https://www.youtube.com/watch?v=${esc(v.yt_id)}" target="_blank" rel="noopener">유튜브에서 열기</a><button class="btn small" id="tvx">닫기</button></div>`);
  bg.querySelector('#tvx').onclick = () => bg.remove();
}

async function tvDelete(id) {
  const v = TV.vids.find(x => x.id === id); if (!v) return;
  if (!confirm(`「${v.title}」 영상을 이 단원에서 뺄까요?\n(유튜브 영상과 학생 시청 기록은 지워지지 않아요)`)) return;
  const { error } = await S.sb.from('unit_videos').delete().eq('id', id);
  if (error) return toast('빼지 못했어요: ' + error.message);
  toast('단원에서 영상을 뺐어요'); tabVideos();
}

function tvAdd(unitId) {
  const u = T.units.find(x => x.id === unitId); if (!u) return;
  const n = TV.vids.filter(v => v.unit_id === unitId).length;
  const bg = modal(`<h3 style="margin-top:0">+ 영상 넣기</h3><p class="tiny">${esc(u.school_book)} · ${esc(u.title)}</p>
    <label class="tiny">유튜브 주소</label><input id="tvu" placeholder="https://youtu.be/… 또는 https://www.youtube.com/watch?v=…" style="width:100%">
    <label class="tiny" style="display:block;margin-top:8px">영상 이름 (학생에게 보이는 이름)</label><input id="tvt" placeholder="예: 5과 문법① 분사" style="width:100%">
    <label class="tiny" style="display:block;margin-top:8px">길이 (예: 13:29, 몰라도 돼요)</label><input id="tvl" placeholder="13:29" style="width:100%">
    <label class="tiny" style="display:block;margin-top:8px">바로가기 (한 줄에 하나씩 "00:36 분사 개념", 없어도 돼요)</label><textarea id="tvc" rows="5" style="width:100%" placeholder="00:00 시작&#10;00:36 분사 개념"></textarea>
    <div class="row between" style="margin-top:12px"><button class="btn small ghost" id="tvcx">취소</button><button class="btn small" id="tvok">넣기</button></div>`);
  bg.querySelector('#tvcx').onclick = () => bg.remove();
  bg.querySelector('#tvok').onclick = async () => {
    const yt = tvYtId(bg.querySelector('#tvu').value), title = bg.querySelector('#tvt').value.trim();
    if (!yt) return toast('유튜브 주소를 확인해 주세요');
    if (!title) return toast('영상 이름을 넣어 주세요');
    const lt = bg.querySelector('#tvl').value.trim(); let len = null;
    if (lt) { const p = lt.split(':').map(Number); len = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p.length === 2 ? p[0] * 60 + p[1] : null; }
    const chapters = bg.querySelector('#tvc').value.split('\n').map(l => l.trim().match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s+(.+)$/)).filter(Boolean).map(m => [m[1], m[2]]);
    const { error } = await S.sb.from('unit_videos').upsert({ unit_id: unitId, yt_id: yt, title, len_sec: len, chapters, ord: n + 1, school_book: u.school_book, lesson: parseInt(u.lesson) || null, no: n + 1 }, { onConflict: 'unit_id,yt_id' });
    if (error) return toast('넣지 못했어요: ' + error.message);
    bg.remove(); toast('영상을 넣었어요 ♥'); tabVideos();
  };
}
