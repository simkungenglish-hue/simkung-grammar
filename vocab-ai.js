/* 심쿵영어 어휘 - 원장님 화면 추가: AI 자동 단어장 · 게임/칭찬 · 철자 약점 · 받아쓰기 시험지
   AI 흐름: ① 자료(글·PDF·사진)나 요청에서 단어 뽑기 → ② 철자·연상·예문 만들기 → ③ 다른 AI가 처음 보는 눈으로 검수 → ④ 규칙 검사 → 저장·공개·배정 */
'use strict';

const VA = { busy: false, log: [] };
const VA_BATCH = 12;

/* ---------- 파일 읽기: 글이 있는 PDF는 글로, 스캔 PDF·사진은 사진으로 ---------- */
function vaResize(img, max = 1600) {
  const s = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}
function vaImageFile(file) {
  return new Promise((ok, no) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => { try { ok({ media_type: 'image/jpeg', data: vaResize(img) }); } catch (e) { no(e); } finally { URL.revokeObjectURL(url); } };
    img.onerror = () => { URL.revokeObjectURL(url); no(new Error(file.name + ': 이 사진 형식은 읽을 수 없어요. JPG·PNG로 올려 주세요.')); };
    img.src = url;
  });
}
async function vaPdf(file, from, to) {
  const r = await pdfText(file, from, to);
  const pages = Math.max(1, Math.min(r.pages, to || r.pages) - Math.max(1, from || 1) + 1);
  if (r.text.replace(/\s/g, '').length >= 40 * pages) return { text: r.text, images: [] };
  // 글자가 거의 없으면 스캔 PDF예요: 쪽을 사진으로 바꿔서 AI가 직접 읽어요 (12쪽까지)
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const a = Math.max(1, from || 1), b = Math.min(doc.numPages, to || doc.numPages, a + 11), images = [];
  for (let i = a; i <= b; i++) {
    const pg = await doc.getPage(i), vp = pg.getViewport({ scale: 1 });
    const sc = Math.min(2, 1600 / Math.max(vp.width, vp.height)), v2 = pg.getViewport({ scale: sc });
    const c = document.createElement('canvas'); c.width = Math.round(v2.width); c.height = Math.round(v2.height);
    await pg.render({ canvasContext: c.getContext('2d'), viewport: v2 }).promise;
    images.push({ media_type: 'image/jpeg', data: c.toDataURL('image/jpeg', 0.82).split(',')[1] });
  }
  return { text: '', images };
}

/* ---------- 🤖 AI 자동 만들기 화면 ---------- */
function vtAI() {
  const guess = (lv, sg) => T.students.filter(s => (lv && V_LEVEL_GRADE[lv] && s.grade && V_LEVEL_GRADE[lv].startsWith(s.grade)) || (sg && s.grade === sg)).map(s => s.id);
  $('#vb').innerHTML = `<div class="card"><h2 style="margin:0 0 4px">🤖 AI 자동 단어장</h2>
    <p class="muted">자료를 올리거나 원하는 단어장을 말로 적으면, AI가 단어를 뽑고 <b>음절·헷갈리는 글자·연상·예문·파생어</b>까지 만든 뒤 <b>다른 AI가 한 번 더 검수</b>해서 바로 학습으로 열어 줘요.</p>
    <label>어떤 단어장을 만들까요?</label>
    <textarea id="vareq" rows="3" placeholder="예) 초5 수준, 학교생활·친구 주제 단어 30개&#10;예) 올린 중2 본문에서 시험에 나올 단어·숙어만&#10;예) 올린 단어장 PDF 그대로 (Day별로)"></textarea>
    <label style="margin-top:10px">자료 올리기 <span class="tiny">PDF · 사진(JPG·PNG, 교재 쪽을 찍은 것도 돼요) · 텍스트 — 여러 개 가능</span></label>
    <input type="file" id="vaf" multiple accept=".pdf,.txt,image/*">
    <div class="row" style="margin-top:6px"><span class="tiny">PDF 쪽 범위</span><input type="number" id="vapa" min="1" value="1" style="width:80px"> ~ <input type="number" id="vapb" min="1" placeholder="끝" style="width:80px"></div>
    <div id="vafl" class="tiny" style="margin-top:4px"></div>
    <div class="picks" style="margin:12px 0 6px"><label class="pick"><input type="radio" name="vak" value="level" checked> 레벨 어휘 (C~J)</label><label class="pick"><input type="radio" name="vak" value="school"> 내신 교과어휘 (중1·2·3)</label></div>
    <div class="setgrid">
      <div class="k-level"><label>레벨</label>${vtLevelSelect('valv', 'E')}</div>
      <div class="k-school" style="display:none"><label>학년</label>${vtGradeSelect('vasg', '')}</div>
      <div class="k-school" style="display:none"><label>교과서 (출판사·저자)</label><input type="text" id="vapub" placeholder="예: 동아(윤정미)"></div>
      <div class="k-school" style="display:none"><label>과</label><input type="text" id="valsn" placeholder="예: Lesson 3"></div>
      <div><label>한 유닛 단어 수</label><input type="number" id="vasz" min="5" max="40" value="15"></div>
      <div><label>최대 단어 수</label><input type="number" id="vamx" min="5" max="200" value="60"></div>
      <div><label>단어장 이름 <span class="tiny">비우면 AI가 지어요</span></label><input type="text" id="vatt"></div></div>
    <div style="margin-top:10px"><label class="pick"><input type="checkbox" id="vapub2" checked> 검수가 끝나면 바로 학생에게 공개</label></div>
    <label style="margin-top:6px">배정할 학생 <span class="tiny">학년이 맞는 학생을 미리 골라 뒀어요</span></label>
    <div class="picks" id="vastu">${T.students.map(s => `<label class="pick"><input type="checkbox" value="${s.id}"> ${esc(s.name)} <span class="tiny">${esc(s.grade)}</span></label>`).join('')}</div>
    <button class="btn" id="vago" style="margin-top:12px;width:100%">🤖 AI로 만들기</button>
    <p class="tiny">교재의 단어 목록을 쓰려면 그 쪽을 꼭 올려 주세요. 자료 없이 특정 교재 단어를 요청하면 AI가 지어내지 않고 자료를 달라고 해요.</p></div>
    <div id="vaprog"></div>`;
  const kindOf = () => (document.querySelector('[name=vak]:checked') || {}).value || 'level';
  const pre = () => {
    const ids = new Set(guess(kindOf() === 'level' ? $('#valv').value : '', kindOf() === 'school' ? $('#vasg').value : ''));
    document.querySelectorAll('#vastu input').forEach(i => { i.checked = ids.has(i.value); });
    $('#vasz').value = kindOf() === 'level' && ['C', 'D', 'E', 'F'].includes($('#valv').value) ? 15 : 20;
  };
  document.querySelectorAll('[name=vak]').forEach(r => r.onchange = () => {
    const sc = kindOf() === 'school';
    document.querySelectorAll('.k-school').forEach(x => x.style.display = sc ? '' : 'none'); document.querySelectorAll('.k-level').forEach(x => x.style.display = sc ? 'none' : '');
    pre();
  });
  $('#valv').onchange = pre; $('#vasg').onchange = pre; pre();
  $('#vaf').onchange = () => { const fs = [...$('#vaf').files]; $('#vafl').textContent = fs.length ? fs.map(f => f.name).join(', ') : ''; };
  $('#vago').onclick = () => vaRun();
}

function vaLog(msg, cls) {
  VA.log.push({ msg, cls });
  const el = $('#vaprog'); if (!el) return;
  el.innerHTML = `<div class="card"><h3 style="margin:0 0 6px">진행 상황</h3><div class="valog">${VA.log.map(l => `<div class="${l.cls || ''}">${esc(l.msg)}</div>`).join('')}</div></div>`;
}
async function vaCall(body, tries = 2) {
  let last;
  for (let k = 0; k < tries; k++) {
    try { const r = await invokeFn('ai-feedback', body); if (r.ok || r.need_source) return r; last = new Error(r.message || 'AI 오류'); if (['no_key', 'budget', 'bad_model', 'empty', 'long'].includes(r.code)) break; }
    catch (e) { last = e; }
  }
  throw last;
}
// 자료에서 그 단어가 나온 문장을 찾아 예문 재료로 줘요 (내신 본문 문장을 예문으로 쓰기 위해)
function vaContext(source, items) {
  if (!source) return '';
  const sents = source.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/);
  const out = [];
  for (const it of items) {
    const key = it.word.toLowerCase().split(' ').sort((a, b) => b.length - a.length)[0].replace(/[^a-z'\-]/g, '');
    const stem = key.length > 4 ? key.slice(0, -2) : key;
    const hit = sents.filter(s => s.toLowerCase().includes(stem) && /[a-z]/i.test(s) && s.length < 260).slice(0, 2);
    if (hit.length) out.push(`${it.word}: ${hit.join(' / ')}`);
  }
  return out.join('\n').slice(0, 6000);
}
async function vaRun() {
  if (VA.busy) return;
  const req = $('#vareq').value.trim(), files = [...$('#vaf').files];
  if (!req && !files.length) return toast('자료를 올리거나 어떤 단어장을 만들지 적어 주세요');
  const kind = (document.querySelector('[name=vak]:checked') || {}).value || 'level';
  const tgt = kind === 'school' ? { kind, grade: $('#vasg').value, publisher: $('#vapub').value.trim(), lesson: $('#valsn').value.trim() } : { kind, level: $('#valv').value };
  if (kind === 'school' && !tgt.grade) return toast('학년을 골라 주세요');
  if (kind === 'level' && !tgt.level) return toast('레벨을 골라 주세요');
  const unitSize = +$('#vasz').value || 15, maxWords = Math.max(5, Math.min(200, +$('#vamx').value || 60));
  const publish = $('#vapub2').checked, stu = [...document.querySelectorAll('#vastu input:checked')].map(i => i.value), title0 = $('#vatt').value.trim();
  VA.busy = true; VA.log = []; $('#vago').disabled = true;
  let cost = 0;
  try {
    // AI 비용을 쓰기 전에 저장할 곳(13단계 DB)이 있는지 먼저 확인해요
    const chk = await S.sb.from('vocab_book_ai_log').select('book_id').limit(1);
    if (chk.error) { vaLog('13단계 DB 업데이트(schema13_vocab_game.sql)를 먼저 실행해 주세요.', 'bad'); return; }
    // 0) 자료 읽기
    let text = '', images = [];
    for (const f of files) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      vaLog(`📄 ${f.name} 읽는 중…`);
      if (ext === 'pdf') { const r = await vaPdf(f, +$('#vapa').value || 1, +$('#vapb').value || 0); text += '\n' + r.text; images.push(...r.images); if (r.images.length) vaLog(`   스캔 PDF라 ${r.images.length}쪽을 사진으로 읽어요`); }
      else if (/^image\//.test(f.type)) images.push(await vaImageFile(f));
      else text += '\n' + await f.text();
    }
    text = text.trim();
    if (images.length > 12) { vaLog(`사진이 많아 앞 12장만 읽어요 (나머지는 다음에 따로 올려 주세요)`, 'warn'); images = images.slice(0, 12); }
    // 1) 단어 뽑기 (글은 25,000자씩, 사진은 4장씩 나눠서)
    vaLog('① 단어 뽑는 중…');
    const parts = [];
    const chunks = text ? text.match(/[\s\S]{1,25000}/g) : [];
    for (const c of chunks) parts.push({ source: c, images: [] });
    for (let k = 0; k < images.length; k += 4) parts.push({ source: '', images: images.slice(k, k + 4) });
    if (!parts.length) parts.push({ source: '', images: [] });
    const units = []; const seen = new Set(); let title = '', n = 0;
    for (const p of parts) {
      if (n >= maxWords) break;
      const r = await vaCall({ action: 'vocab_plan', request: req, ...tgt, unit_size: unitSize, max_words: maxWords - n, ...p });
      if (r.need_source) { vaLog('⚠️ ' + r.message, 'bad'); toast(r.message, 6000); return; }
      cost += r.cost_usd || 0; title = title || r.title;
      for (const u of r.units) {
        const its = u.items.filter(x => { const k = vNorm(x.word) + '|' + x.meaning; if (seen.has(k)) return false; seen.add(k); return true; });
        if (its.length) { units.push({ title: u.title, items: its }); n += its.length; }
      }
      (r.dropped || []).forEach(d => vaLog(`   뺀 단어: ${d.word} (${d.reason})`, 'warn'));
    }
    if (!n) { vaLog('단어를 찾지 못했어요. 자료나 요청을 확인해 주세요.', 'bad'); return; }
    vaLog(`   → ${units.length}개 유닛 · 단어 ${n}개`);
    // 2~3) 묶음마다 만들기 → 검수
    const all = units.flatMap((u, ui) => u.items.map(it => ({ ...it, _u: ui }))).map((x, k) => ({ ...x, ref: String(k) }));
    const done = new Array(all.length).fill(null), drop = [], fixes = [];
    let unverified = 0;
    for (let k = 0; k < all.length; k += VA_BATCH) {
      const b = all.slice(k, k + VA_BATCH), no = `${k / VA_BATCH + 1}/${Math.ceil(all.length / VA_BATCH)}`;
      vaLog(`② 철자·연상·예문 만들기 ${no}…`);
      let en;
      const send = b.map(({ _u, ...x }) => x);
      try { en = await vaCall({ action: 'vocab_enrich', ...tgt, items: send, context: vaContext(text, b) }); cost += en.cost_usd || 0; }
      catch (e) { vaLog(`   이 묶음은 만들지 못했어요(${errText(e)}). 단어·뜻만 넣어요.`, 'warn'); en = { items: send }; }
      const eByRef = new Map(en.items.map(x => [x.ref, x]));
      vaLog(`③ AI 검수 ${no}…`);
      try {
        const v = await vaCall({ action: 'vocab_verify', ...tgt, items: en.items });
        cost += v.cost_usd || 0;
        const vmap = new Map(v.items.map(x => [x.ref, x]));
        b.forEach((x, i) => { const y = vmap.get(x.ref); if (y) done[k + i] = { ...y, _u: x._u }; });
        v.dropped.forEach(d => { drop.push(d); vaLog(`   검수에서 뺀 단어: ${d.word} — ${d.reason}`, 'warn'); });
        v.log.forEach(l => fixes.push(l));
        if (v.fixed) vaLog(`   고친 곳 ${v.fixed}개`);
      } catch (e) {
        unverified += b.length;
        vaLog(`   검수를 받지 못했어요(${errText(e)}). 이 묶음은 확인이 필요해요.`, 'bad');
        b.forEach((x, i) => { const y = eByRef.get(x.ref); done[k + i] = { ...(y || x), _u: x._u, _unchecked: true }; });
      }
    }
    // 4) 저장 · 공개 · 배정
    const outUnits = units.map((u, ui) => ({ title: u.title, items: done.filter(x => x && x._u === ui).map(({ _u, _unchecked, notes, id, ref, ...rest }) => rest) })).filter(u => u.items.length);
    const words = outUnits.reduce((s, u) => s + u.items.length, 0);
    if (!words) { vaLog('저장할 단어가 남지 않았어요.', 'bad'); return; }
    const pub = publish && !unverified;
    const lvGrade = kind === 'level' ? (V_LEVEL_GRADE[tgt.level] || '') : tgt.grade;
    const meta = { title: title0 || title || (kind === 'school' ? `${tgt.grade} ${tgt.publisher} ${tgt.lesson} 교과어휘`.replace(/\s+/g, ' ').trim() : `심쿵 어휘 ${tgt.level} · AI`),
      kind, level: tgt.level || '', grade_band: lvGrade, school_grade: tgt.grade || '', publisher: tgt.publisher || '', status: pub ? 'published' : 'draft',
      note: req.slice(0, 300), ai_log: { at: new Date().toISOString(), request: req.slice(0, 300), files: files.map(f => f.name).slice(0, 10), words, fixed: fixes.length, fixes: fixes.slice(0, 60), dropped: drop.slice(0, 60), unverified, cost_usd: Math.round(cost * 1000) / 1000 } };
    vaLog('④ 저장하는 중…');
    const { data: bookId, error } = await S.sb.rpc('vocab_save_book', { p_meta: meta, p_units: outUnits });
    if (error) throw error;
    if (stu.length && pub) {
      const bk = { kind }; const st = vtDefaults(bk);
      const { error: e2 } = await S.sb.from('vocab_assignments').upsert(stu.map(id => ({ student_id: id, book_id: bookId, settings: st, start_ord: 1 })), { onConflict: 'student_id,book_id' });
      if (e2) throw e2;
    }
    vaLog(`✅ 완료! 「${meta.title}」 ${outUnits.length}유닛 · ${words}단어 · 검수에서 고친 곳 ${fixes.length}개 · 뺀 단어 ${drop.length}개 · AI 비용 약 $${cost.toFixed(3)}`, 'ok');
    if (!pub) vaLog(publish ? '검수가 끝나지 않은 묶음이 있어서 비공개로 저장했어요. 단어장 화면에서 "AI로 다시 검수"를 눌러 주세요.' : '비공개로 저장했어요. 단어장에서 확인 후 공개해 주세요.', 'warn');
    else if (stu.length) vaLog(`${stu.length}명에게 배정했어요. 학생 화면에 바로 나와요.`, 'ok');
    const el = $('#vaprog'); if (el) el.insertAdjacentHTML('beforeend', `<button class="btn" id="vaopen" style="width:100%">만든 단어장 열기</button>`);
    VT.loaded = false;
    const ob = $('#vaopen'); if (ob) ob.onclick = async () => { VT.sub = 'books'; VT.bookId = bookId; VT.unitId = null; await tabVocab(); };
  } catch (e) { vaLog('문제가 생겼어요: ' + errText(e), 'bad'); toast(errText(e), 6000); }
  finally { VA.busy = false; const b = $('#vago'); if (b) b.disabled = false; }
}

/* ---------- 단어장 화면: 철자·연상 고치기 + AI로 채우기/다시 검수 ---------- */
function vaDerivText(d) { return (Array.isArray(d) ? d : []).map(x => [x.w, x.pos, x.ko].filter(Boolean).join(' ')).join('; '); }
// "look after v. 돌보다; decision n. 결정" → 영어 낱말들 / 품사 / 뜻
function vaParseDeriv(s) {
  return String(s || '').split(';').map(x => x.trim()).filter(Boolean).map(x => {
    const t = x.split(/\s+/), w = [], rest = []; let pos = '';
    for (const tok of t) {
      if (!rest.length && !pos && /^(n|v|adj|adv|prep|conj|pron|phr)\.?$/i.test(tok) && w.length) { pos = tok.replace(/\.?$/, '.').toLowerCase(); continue; }
      if (!rest.length && /^[A-Za-z][A-Za-z\-']*$/.test(tok) && !pos) w.push(tok); else rest.push(tok);
    }
    return { w: w.join(' '), pos, ko: rest.join(' ') };
  }).filter(d => d.w).slice(0, 5);
}
function vtAiBookTools(b, u, items) {
  const vb = $('#vb'); if (!vb || !u) return;
  const lack = vtBookItems(b.id).filter(i => !i.syllables && !i.mnemonic).length;
  const log = '<div class="tiny" id="vailog" style="margin-top:6px"></div>';
  S.sb.from('vocab_book_ai_log').select('log').eq('book_id', b.id).maybeSingle().then(({ data }) => {
    const L = data && data.log, el = $('#vailog'); if (!L || !L.at || !el) return;
    el.innerHTML = `AI가 만든 단어장 · ${esc(new Date(L.at).toLocaleDateString('ko-KR'))} · 검수에서 고친 곳 ${Number(L.fixed) || 0}개 · 뺀 단어 ${(L.dropped || []).length}개${Number(L.unverified) ? ` · <b class="vred">검수 안 된 단어 ${Number(L.unverified)}개</b>` : ''}${(L.dropped || []).length ? `<div>뺀 단어: ${L.dropped.map(d => esc(d.word) + '(' + esc(d.reason) + ')').join(', ')}</div>` : ''}`;
  });
  vb.insertAdjacentHTML('beforeend', `<div class="card"><div class="row between"><h3 style="margin:0">철자·연상 (게임·철자 익히기에 쓰여요)</h3>
      <div class="row"><button class="btn ghost small" id="vaenu">🤖 이 유닛 AI로 채우고 검수</button><button class="btn ghost small" id="vaenb">🤖 단어장 전체 (${lack}개 비어 있음)</button></div></div>${log}
    <div class="tablewrap vedit2"><table><thead><tr><th>영어</th><th>음절 (beau·ti·ful)</th><th>헷갈리는 글자</th><th>철자 요령</th><th>연상</th><th>파생어 (단어 품사 뜻; …)</th><th>어근</th></tr></thead>
    <tbody>${items.map(it => `<tr data-id="${it.id}"><td><b>${esc(it.word)}</b></td><td><input type="text" data-g="syllables" value="${esc(it.syllables || '')}"></td>
      <td><input type="text" data-g="tricky" value="${esc((it.tricky || []).join(', '))}" style="width:70px"></td><td><input type="text" data-g="spell_note" value="${esc(it.spell_note || '')}"></td>
      <td><input type="text" data-g="mnemonic" value="${esc(it.mnemonic || '')}"></td><td><input type="text" data-g="derivs" value="${esc(vaDerivText(it.derivs))}"></td><td><input type="text" data-g="root_note" value="${esc(it.root_note || '')}"></td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:8px"><button class="btn" id="vasv">철자·연상 저장</button><span class="tiny">음절은 가운뎃점(·)으로 나눠요. 점을 빼면 철자와 같아야 해요.</span></div><div id="vaprog"></div></div>`);
  $('#vasv').onclick = async () => {
    let bad = null;
    const all = [...document.querySelectorAll('.vedit2 tbody tr')].map(tr => {
      const g = k => tr.querySelector(`[data-g="${k}"]`).value.replace(/[ ​]/g, ' ').trim();
      const it = VT.items.find(i => i.id === tr.dataset.id);
      let syl = g('syllables').replace(/[•・‧∙]/g, '·');
      if (syl && syl.toLowerCase().replace(/[^a-z]/g, '') !== it.word.toLowerCase().replace(/[^a-z]/g, '')) bad = bad || it.word;
      const row = { id: it.id }, put = (k, v, oldV) => { if (JSON.stringify(v) !== JSON.stringify(oldV)) row[k] = v; };
      put('syllables', syl, it.syllables || '');
      put('tricky', g('tricky').split(/[,\s]+/).map(x => x.toLowerCase()).filter(x => x && it.word.toLowerCase().includes(x)).slice(0, 2), it.tricky || []);
      put('spell_note', g('spell_note'), it.spell_note || ''); put('mnemonic', g('mnemonic'), it.mnemonic || ''); put('root_note', g('root_note'), it.root_note || '');
      if (g('derivs') !== vaDerivText(it.derivs)) row.derivs = vaParseDeriv(g('derivs'));   // 파생어 칸을 고친 단어만 다시 읽어요
      return row;
    });
    const rows = all.filter(r => Object.keys(r).length > 1);
    if (!bad && !rows.length) return toast('바뀐 곳이 없어요');
    if (bad) return toast(`「${bad}」 음절이 철자와 달라요. 가운뎃점(·)을 빼면 철자와 같아야 해요.`, 4500);
    const { error } = await S.sb.rpc('vocab_enrich_save', { p_items: rows });
    if (error) return toast(errText(error));
    rows.forEach(r => Object.assign(VT.items.find(i => i.id === r.id), r)); toast('저장했어요');
  };
  const run = async list => {
    if (VA.busy) return; if (!list.length) return toast('채울 단어가 없어요');
    const tgt = b.kind === 'school' ? { kind: 'school', grade: b.school_grade } : { kind: 'level', level: b.level };
    VA.busy = true; VA.log = []; let saved = 0, fixed = 0; const warn = [];
    try {
      for (let k = 0; k < list.length; k += VA_BATCH) {
        const bt = list.slice(k, k + VA_BATCH).map(i => ({ id: i.id, ref: i.id, word: i.word, meaning: i.meaning, pos: i.pos }));
        vaLog(`만들고 검수하는 중 ${k / VA_BATCH + 1}/${Math.ceil(list.length / VA_BATCH)}…`);
        const en = await vaCall({ action: 'vocab_enrich', ...tgt, items: bt });
        const v = await vaCall({ action: 'vocab_verify', ...tgt, items: en.items });
        const skipped = bt.length - en.items.length;
        if (skipped > 0) vaLog(`   ${skipped}개는 철자 형식(숫자 등) 때문에 건너뛰었어요`, 'warn');
        fixed += v.fixed || 0;
        v.dropped.forEach(d => warn.push(d));
        // 원장님이 이미 넣은 칸은 그대로 두고, 비어 있는 칸만 AI 결과로 채워요
        const empty = v => v == null || v === '' || (Array.isArray(v) && !v.length);
        const rows = v.items.filter(x => x.id && x.ref === x.id && bt.some(z => z.id === x.id)).map(x => {
          const cur = VT.items.find(i => i.id === x.id) || {}, row = { id: x.id };
          for (const k of ['syllables', 'tricky', 'spell_note', 'mnemonic', 'derivs', 'root_note']) if (empty(cur[k]) && !empty(x[k])) row[k] = x[k];
          for (const k of ['phrase', 'phrase_ko', 'example', 'example_ko']) if (!empty(x[k])) row[k] = x[k];   // 짝이 둘 다 빈 경우에만 서버가 채워요
          return row;
        }).filter(r => Object.keys(r).length > 1);
        const { data, error } = await S.sb.rpc('vocab_enrich_save', { p_items: rows }); if (error) throw error;
        saved += data || 0;
      }
      vaLog(`✅ ${saved}개 단어를 채웠어요 · 검수에서 고친 곳 ${fixed}개. (이미 있던 표현·예문은 그대로 뒀어요)`, 'ok');
      warn.forEach(d => vaLog(`⚠️ 확인이 필요한 단어: ${d.word} — ${d.reason} (지우지 않았어요)`, 'warn'));
      VT.loaded = false; await loadVT(); VT.sub = 'books'; vtBookEdit(b.id);
      if (warn.length) toast(`확인이 필요한 단어가 ${warn.length}개 있어요: ${warn.map(d => d.word).join(', ')}`, 8000);
      else toast(`${saved}개 단어를 채웠어요`, 4000);
    } catch (e) { vaLog('문제가 생겼어요: ' + errText(e), 'bad'); toast(errText(e), 6000); }
    finally { VA.busy = false; }
  };
  $('#vaenu').onclick = () => run(items);
  $('#vaenb').onclick = () => run(vtBookItems(b.id).filter(i => !i.syllables && !i.mnemonic));
}

/* ---------- 철자 실수 유형 나누기 ---------- */
const VA_SPELL = ['묵음', '겹자음', 'ie·ei', '끝 e', '어미', '모음', '순서 바뀜', '글자 빠뜨림', '기타'];
function vaSpellType(word, ans) {
  const w = String(word || '').toLowerCase().trim(), a = String(ans || '').toLowerCase().replace(/[’]/g, "'").trim().replace(/\s*[.!?]+$/, '');
  if (!a || a === w) return null;
  for (const p of ['kn', 'wr', 'mb', 'gh', 'bt', 'mn', 'stle', 'wh', 'ps', 'lk', 'ght']) if (w.includes(p) && !a.includes(p)) return '묵음';
  const dbl = /([bcdfgklmnprstz])\1/;
  if (dbl.test(w) !== dbl.test(a) || (dbl.test(w) && w.replace(/([a-z])\1/g, '$1') === a.replace(/([a-z])\1/g, '$1'))) return '겹자음';
  if ((w.includes('ie') && a.includes('ei')) || (w.includes('ei') && a.includes('ie'))) return 'ie·ei';
  if (w.endsWith('e') && a === w.slice(0, -1)) return '끝 e';
  const ends = [['tion', 'sion'], ['ance', 'ence'], ['able', 'ible'], ['er', 'or'], ['or', 'ar'], ['ant', 'ent'], ['ful', 'full'], ['ly', 'ley']];
  for (const [x, y] of ends) if ((w.endsWith(x) && a.endsWith(y)) || (w.endsWith(y) && a.endsWith(x))) return '어미';
  const cons = s => s.replace(/[aeiouy]/g, '');
  if (cons(w) === cons(a)) return '모음';
  if (w.length === a.length && [...w].sort().join('') === [...a].sort().join('')) return '순서 바뀜';
  if (a.length < w.length && w.length - a.length <= 2) { let i = 0; for (const c of w) if (c === a[i]) i++; if (i === a.length) return '글자 빠뜨림'; }
  return '기타';
}

/* ---------- 🎮 게임·칭찬 화면 ---------- */
async function vtGame() {
  $('#vb').innerHTML = '<p class="muted">불러오는 중…</p>';
  const [g, sp] = await Promise.all([S.sb.rpc('vocab_game_teacher'), S.sb.rpc('vocab_spell_errors', { p_student: null, p_days: 30 })]);
  if (g.error) { $('#vb').innerHTML = `<div class="card"><h2>게임 기능을 켜려면 DB 업데이트가 필요해요</h2><p>설치 안내서대로 <code>schema13_vocab_game.sql</code> 을 한 번 실행해 주세요.</p><p class="tiny">${esc(errText(g.error))}</p></div>`; return; }
  const d = g.data, cfg = d.config || {}, rows = (d.students || []).map(x => ({ ...x, s: T.sById[x.student_id] })).filter(x => x.s);
  const errs = (sp.data || []);
  const types = {}, byStu = {};
  for (const e of errs) { const t = vaSpellType(e.word, e.answer); if (!t) continue; types[t] = (types[t] || 0) + 1; (byStu[e.student_id] = byStu[e.student_id] || {})[t] = (byStu[e.student_id][t] || 0) + 1; }
  const acc = (ok, n) => n >= 10 ? Math.round(ok / n * 100) : null;
  const steady = rows.filter(r => r.days7 >= 3).sort((a, b) => b.days7 - a.days7 || b.xp7 - a.xp7).slice(0, 3);
  const grow = rows.map(r => ({ ...r, up: acc(r.ok7, r.n7) != null && acc(r.ok_prev7, r.n_prev7) != null ? acc(r.ok7, r.n7) - acc(r.ok_prev7, r.n_prev7) : null, upx: r.xp7 - r.xp_prev7 }))
    .filter(r => (r.up != null && r.up > 0) || r.upx > 0).sort((a, b) => (b.up ?? -999) - (a.up ?? -999) || b.upx - a.upx).slice(0, 3);
  const medal = ['🥇', '🥈', '🥉'];
  const tChips = VA_SPELL.filter(t => types[t]).map(t => `<span class="wchip"><b>${t}</b> <em>${types[t]}</em></span>`).join('');
  const modeSel = r => `<select data-mode="${r.student_id}"><option value="" ${!r.mode_override ? 'selected' : ''}>자동 (${r.s.grade && r.s.grade.startsWith('초') ? '초등' : '중등'})</option><option value="kid" ${r.mode_override === 'kid' ? 'selected' : ''}>초등 화면</option><option value="teen" ${r.mode_override === 'teen' ? 'selected' : ''}>중등 화면</option></select>`;
  const theme = r => r.mode === 'kid' ? (r.theme === 'pet' ? `${G_PETS[r.pet] || '🐶'} ${esc(r.pet_name || '펫')}` : r.theme === 'monster' ? '⚔️ 몬스터' : '<span class="tiny">아직 안 고름</span>') : '🏅 레벨';
  const rbr = await S.sb.from('readbeat_runs').select('student_id,level_id,unit,score,combo,stage,at').order('at', { ascending: false }).limit(12);
  const rbRows = (rbr.data || []).map(r => `<tr><td>${esc((T.sById[r.student_id] || {}).name || '-')}</td><td>${esc(r.level_id)} · Unit ${r.unit}</td><td>${r.score.toLocaleString()}</td><td>${r.combo}</td><td class="tiny">${fmtDT(r.at)}</td></tr>`).join('');
  $('#vb').innerHTML = `
    <div class="card"><div class="row between"><div><h2 style="margin:0">🎵 READ &amp; BEAT</h2><p class="tiny" style="margin:4px 0 0">교실 TV·PC에서 수업용으로 열어요. 학생은 게임 칸에서 혼자 해요. (수업용 시연은 기록하지 않아요)</p></div><button class="btn" id="rbt">수업용으로 열기</button></div>${rbRows ? `<div class="tablewrap" style="margin-top:8px"><table><thead><tr><th>학생</th><th>곡</th><th>점수</th><th>최고 콤보</th><th>시각</th></tr></thead><tbody>${rbRows}</tbody></table></div>` : ''}</div>
    <div class="card"><h2 style="margin:0 0 8px">이번 주 칭찬 <span class="tiny">최근 7일 기준 · 칭찬 스티커판에 그대로 쓰세요</span></h2>
      <div class="setgrid"><div><h3>🌱 꾸준상 <span class="tiny">공부한 날이 많은 학생</span></h3>${steady.length ? steady.map((r, i) => `<div>${medal[i]} <b>${esc(r.s.name)}</b> <span class="tiny">${r.days7}일 학습 · ${r.xp7} XP</span></div>`).join('') : '<p class="tiny">3일 이상 공부한 학생이 아직 없어요.</p>'}</div>
      <div><h3>🚀 성장상 <span class="tiny">지난주보다 철자 정답률·경험치가 오른 학생</span></h3>${grow.length ? grow.map((r, i) => `<div>${medal[i]} <b>${esc(r.s.name)}</b> <span class="tiny">${r.up != null ? `정답률 +${r.up}%p` : ''}${r.up != null && r.upx > 0 ? ' · ' : ''}${r.upx > 0 ? `경험치 +${r.upx}` : ''}</span></div>`).join('') : '<p class="tiny">비교할 기록이 아직 부족해요.</p>'}</div></div></div>
    <div class="card"><h2 style="margin:0 0 8px">철자 약점 <span class="tiny">최근 30일 틀린 철자 ${errs.length}개</span></h2>
      ${tChips ? `<div class="wchips">${tChips}</div><p class="tiny" style="margin-top:6px">묵음(knife의 k)·겹자음(happy의 pp)·ie/ei·끝 e(make)·어미(-tion/-sion)·모음 헷갈림 순으로 나눴어요. 많은 유형부터 수업 5분 받아쓰기로 짚어 주세요.</p>` : '<p class="tiny">아직 틀린 철자 기록이 없어요.</p>'}</div>
    <div class="card"><div class="row between"><h2 style="margin:0">학생별 게임·철자</h2>
      <div class="row"><label class="pick"><input type="checkbox" id="vglg" ${cfg.league ? 'checked' : ''}> 중등 이번 주 순위 보이기</label>
      <span class="tiny">하루 게임 경험치 상한</span><input type="number" id="vgcap" min="50" max="2000" value="${cfg.daily_xp_cap || 400}" style="width:90px"><button class="btn ghost small" id="vgsv">저장</button></div></div>
      <p class="tiny">순위를 꺼 두면 중등은 '지난주의 나'와 경쟁해요. 켜도 다른 학생 이름은 가운데 글자를 가려서 보여요. 초등은 순위가 없어요.</p>
      <div class="tablewrap"><table><thead><tr><th>학생</th><th>화면</th><th>테마</th><th>레벨</th><th>7일 경험치</th><th>7일 학습일</th><th>7일 철자 정답률</th><th>많이 틀리는 유형</th><th></th></tr></thead><tbody>
      ${rows.map(r => { const L = gLevel(r.xp || 0), a7 = acc(r.ok7, r.n7), top = Object.entries(byStu[r.student_id] || {}).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([t, n]) => `${t} ${n}`).join(', ');
        return `<tr><td><b>${esc(r.s.name)}</b> <span class="tiny">${esc(r.s.grade)}</span></td><td>${modeSel(r)}</td><td>${theme(r)}</td><td>Lv.${L.lv} <span class="tiny">${r.xp} XP</span></td><td>${r.xp7}</td><td>${r.days7}일</td><td>${a7 == null ? '-' : a7 + '%'}</td><td class="tiny">${esc(top || '-')}</td>
        <td><button class="btn ghost small" data-dict="${r.student_id}">받아쓰기 시험지</button></td></tr>`; }).join('') || '<tr><td colspan="9" class="muted">단어장을 배정한 학생이 없어요.</td></tr>'}</tbody></table></div></div>`;
  if ($('#rbt')) $('#rbt').onclick = () => rbOpen('teacher');
  $('#vgsv').onclick = async () => {
    const { error } = await S.sb.rpc('vocab_game_config_set', { p: { league: $('#vglg').checked, daily_xp_cap: +$('#vgcap').value || 400 } });
    if (error) return toast(errText(error)); toast('저장했어요');
  };
  document.querySelectorAll('[data-mode]').forEach(s => s.onchange = async () => {
    const { error } = await S.sb.rpc('vocab_game_set_mode', { p_student: s.dataset.mode, p_mode: s.value || null });
    if (error) return toast(errText(error)); toast('화면 모드를 바꿨어요');
  });
  document.querySelectorAll('[data-dict]').forEach(b => b.onclick = () => vaDictSheet(b.dataset.dict, errs));
}
// 학생별 받아쓰기 시험지: 최근에 틀린 철자 → 원장님이 불러 주고 학생이 써요
async function vaDictSheet(sid, errs) {
  const s = T.sById[sid]; if (!s) return;
  const ids = [...new Set(errs.filter(e => e.student_id === sid).map(e => e.item_id))];
  let its = VT.items.filter(i => ids.includes(i.id));
  if (its.length < 10) {
    const { data } = await S.sb.rpc('vocab_student_weak', { p_student: sid, p_days: 60 });
    const more = new Set((data || []).map(w => w.item_id));
    its = its.concat(VT.items.filter(i => more.has(i.id) && !ids.includes(i.id)));
  }
  its = its.slice(0, 30);
  if (!its.length) return toast('틀린 철자가 없어요. 잘하고 있어요!');
  vtPrintSheet({ title: `${s.name} · 받아쓰기 (틀린 철자 다시 쓰기)`, items: its, kind: 'dict', key: true, name: s.name });
}
