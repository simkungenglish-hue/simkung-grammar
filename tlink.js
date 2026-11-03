/* 심쿵문법 - 원장님: 학교/학원 교재 챕터에 맞춰 천일문 그래머·WRITING 단원을 한 번에 배정 */
'use strict';
(function () {
  if (document.getElementById('tl-css')) return;
  const st = document.createElement('style'); st.id = 'tl-css';
  st.textContent = `
.tl-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;background:linear-gradient(135deg,#eef2ff,#f5f7ff);border:1px solid #c7d2fe;border-radius:16px;padding:12px 16px;margin-bottom:14px}
.tl-bar b{font-size:1rem}.tl-bar small{color:#64748b;display:block;margin-top:2px}
.modal:has(.tl){width:min(980px,96vw)!important;max-width:min(980px,96vw)!important;max-height:92vh;overflow:auto;box-sizing:border-box}
.tl .hd{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px}
.tl .hd h2{margin:0;font-size:1.15rem}.tl .hd small{color:#64748b}
.tl .row2{display:grid;grid-template-columns:260px 1fr;gap:14px}
@media(max-width:760px){.tl .row2{grid-template-columns:1fr}}
.tl .chs{display:flex;flex-direction:column;gap:6px;max-height:62vh;overflow:auto;padding-right:4px}
.tl .ch{display:flex;justify-content:space-between;align-items:center;gap:6px;text-align:left;border:1px solid #e2e8f0;background:#fff;border-radius:12px;padding:9px 11px;cursor:pointer;font:inherit;color:inherit}
.tl .ch.on{border:2px solid #4f46e5;background:#f5f7ff}
.tl .ch .n{font-weight:800;color:#4338ca;margin-right:6px}.tl .ch .g{font-size:.7rem;font-weight:800;color:#c2410c;background:#fff7ed;border-radius:999px;padding:2px 7px;white-space:nowrap}
.tl .box{border:1px solid #e2e8f0;border-radius:14px;padding:12px 14px;margin-bottom:10px;background:#fff}
.tl .box h3{margin:0 0 8px;font-size:.95rem}
.tl .u{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed #eef2f6;font-size:.9rem}
.tl .u:last-child{border-bottom:0}.tl .u .tag{font-size:.7rem;font-weight:800;padding:2px 7px;border-radius:999px}
.tl .tag.g{background:#eef2ff;color:#4338ca}.tl .tag.w{background:#ecfdf5;color:#059669}.tl .tag.x{background:#fff7ed;color:#c2410c}
.tl .u .vid{font-size:.75rem;color:#64748b;margin-left:auto;white-space:nowrap}
.tl .gap{background:#fff7ed;border:1px solid #fed7aa;border-radius:12px;padding:10px 12px;font-size:.88rem;color:#7c2d12}
.tl .st{display:flex;flex-wrap:wrap;gap:6px}
.tl .st label{display:flex;align-items:center;gap:5px;border:1px solid #e2e8f0;border-radius:999px;padding:5px 11px;font-size:.88rem;cursor:pointer;background:#fff}
.tl .st label.has{border-color:#a7f3d0;background:#ecfdf5}
.tl .foot{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px}
`;
  document.head.appendChild(st);
})();

const TL = { links: null, book: null, ch: null };
async function tlLoad() {
  if (TL.links) return TL.links;
  const { data, error } = await S.sb.from('book_links').select('*').order('book').order('ch');
  if (error) { toast(errText(error)); return []; }
  TL.links = data || []; return TL.links;
}

/* 과제 배정 화면 맨 위에 「교재 연계 배정」 띠를 붙여요 */
(function () {
  const _ta = tabAssign;
  tabAssign = function () {
    const r = _ta.apply(this, arguments);
    try {
      const tb = $('#tb');
      if (tb && !tb.querySelector('.tl-bar')) {
        const d = document.createElement('div'); d.className = 'tl-bar';
        d.innerHTML = `<div><b>📗 교재 연계 배정</b><small>학생이 쓰는 교재(예: 해커스 중학영문법 1학년) 챕터를 고르면 같은 내용의 천일문 그래머 + WRITING 단원을 한 번에 배정해요.</small></div><button class="btn" id="tlopen">교재 챕터로 배정하기</button>`;
        tb.prepend(d);
        d.querySelector('#tlopen').onclick = () => linkModal();
      }
    } catch (e) { }
    return r;
  };
})();

async function linkModal(preBook, preCh) {
  const links = await tlLoad();
  if (!links.length) return toast('연계표가 아직 없어요');
  const books = [...new Set(links.map(l => l.book))];
  TL.book = preBook || TL.book || books[0];
  const chs = links.filter(l => l.book === TL.book);
  TL.ch = preCh || (chs.find(c => c.ch === TL.ch) ? TL.ch : chs[0].ch);
  const byCode = {}; T.units.forEach(u => byCode[u.code] = u);
  const L = chs.find(c => c.ch === TL.ch);
  const unitsG = L.grammar_codes.map(c => byCode[c]).filter(Boolean), unitsW = L.writing_codes.map(c => byCode[c]).filter(Boolean), unitsX = (L.extra_codes || []).map(c => byCode[c]).filter(Boolean);
  const all = [...unitsG, ...unitsW, ...unitsX];
  const studs = T.students.slice().sort((a, b) => (a.grade === '중1' ? 0 : 1) - (b.grade === '중1' ? 0 : 1) || a.name.localeCompare(b.name, 'ko'));
  const hasAll = s => all.every(u => T.asg.some(a => a.student_id === s.id && a.unit_id === u.id));
  const hasSome = s => all.filter(u => T.asg.some(a => a.student_id === s.id && a.unit_id === u.id)).length;
  const uRow = (u, k) => `<label class="u"><input type="checkbox" name="tlu" value="${u.id}" checked><span class="tag ${k}">${k === 'g' ? '그래머' : k === 'w' ? 'WRITING' : '보충'}</span><span><b>${esc(u.lesson || u.code)}</b> ${esc(u.title)}</span><span class="vid">${esc(u.code)}</span></label>`;
  const html = `<div class="tl">
    <div class="hd"><div><small>교재 연계 배정</small><h2>${esc(TL.book)}</h2></div><button class="btn ghost small" id="tlx">닫기</button></div>
    ${books.length > 1 ? `<div style="margin-bottom:10px"><select id="tlbook">${books.map(b => `<option ${b === TL.book ? 'selected' : ''}>${esc(b)}</option>`).join('')}</select></div>` : ''}
    <div class="row2">
      <div class="chs">${chs.map(c => `<button class="ch ${c.ch === TL.ch ? 'on' : ''}" data-tlch="${c.ch}"><span><span class="n">Ch.${c.ch}</span>${esc(c.ch_title)}</span>${(c.extra_codes || []).length ? '<span class="g">보충 ' + c.extra_codes.length + '</span>' : ''}</button>`).join('')}</div>
      <div>
        <div class="box"><h3>Ch.${L.ch} ${esc(L.ch_title)} · 같은 내용 단원 ${all.length}개</h3>${unitsG.map(u => uRow(u, 'g')).join('')}${unitsW.map(u => uRow(u, 'w')).join('')}${unitsX.map(u => uRow(u, 'x')).join('')}
          <div class="tiny muted" style="margin-top:6px">순서: 그래머(개념·문제) → WRITING(영작) → 보충(해커스에만 있는 내용). 천일문 단원은 연결된 영상도 함께 보여요. 보충 단원은 영상 없이 개념 카드와 문제로 공부해요.</div></div>
        ${L.gap ? `<div class="gap"><b>⚠ 해커스에만 있는 내용</b><br>${esc(L.gap)}<br><span style="font-size:.8rem">${unitsX.length ? '천일문 중1에는 없어서 보충 단원으로 만들어 두었어요. 위 목록의 「보충」 단원으로 함께 배정돼요.' : '천일문 중1 단원에는 없어서, 교재 수업이나 프린트로 따로 다뤄 주세요.'}</span></div>` : '<div class="gap" style="background:#ecfdf5;border-color:#a7f3d0;color:#065f46">✓ 이 챕터 내용은 천일문 단원에 모두 들어 있어요.</div>'}
        <div class="box" style="margin-top:10px"><h3>배정할 학생</h3><div class="st">${studs.map(s => `<label class="${hasAll(s) ? 'has' : ''}"><input type="checkbox" name="tls" value="${s.id}" ${hasAll(s) ? 'disabled' : ''}>${esc(s.name)} <span class="tiny muted">${esc(s.grade || '')}${hasAll(s) ? ' · 배정됨' : hasSome(s) ? ` · ${hasSome(s)}개 배정됨` : ''}</span></label>`).join('')}</div></div>
        <div class="foot"><span class="tiny muted">이미 배정된 단원은 건너뛰고, 기존 풀이 기록과 설정은 그대로 둬요. 기본 설정: 단계별 5문제 · 통과 80% · 재도전 2번 · 내신 8문제</span>
          <span class="row" style="gap:6px"><label class="tiny"><input type="date" id="tldue"> 마감일(선택)</label><button class="btn" id="tlgo">배정하기</button></span></div>
      </div>
    </div></div>`;
  document.querySelectorAll('.modal-bg').forEach(m => { if (m.querySelector('.tl')) m.remove(); });
  const bg = modal(html);
  bg.querySelector('#tlx').onclick = () => bg.remove();
  bg.querySelectorAll('[data-tlch]').forEach(b => b.onclick = () => { bg.remove(); linkModal(TL.book, +b.dataset.tlch); });
  const sel = bg.querySelector('#tlbook'); if (sel) sel.onchange = () => { bg.remove(); TL.ch = null; linkModal(sel.value); };
  bg.querySelector('#tlgo').onclick = async () => {
    const sids = [...bg.querySelectorAll('[name=tls]:checked')].map(x => x.value);
    const uids = [...bg.querySelectorAll('[name=tlu]:checked')].map(x => x.value);
    if (!sids.length || !uids.length) return toast('학생과 단원을 골라 주세요');
    const due = bg.querySelector('#tldue').value || null;
    const rows = []; let skip = 0;
    for (const s of sids) for (const u of uids) {
      if (T.asg.some(a => a.student_id === s && a.unit_id === u)) { skip++; continue; }
      rows.push({ student_id: s, unit_id: u, due_date: due, settings: { per_stage: 5, pass_pct: 80, max_retries: 2, stage_counts: { exam: 8 } } });
    }
    if (!rows.length) return toast('이미 모두 배정되어 있어요');
    const { error } = await S.sb.from('assignments').insert(rows);
    if (error) return toast(errText(error), 4000);
    toast(`${rows.length}건 배정했어요${skip ? ` (이미 배정된 ${skip}건 제외)` : ''}`);
    bg.remove(); await loadTeacher(); drawTeacher();
  };
}
