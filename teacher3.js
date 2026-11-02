/* 심쿵영어 문법 학습 - 원장님: AI 사용·설정 탭 */
'use strict';

const AI_MODELS = [['claude-haiku-5-5', 'Haiku 5.5 (저렴·추천)'], ['claude-sonnet-5-5', 'Sonnet 5.5 (정교·약 20배 비쌈)']];
const AI_DEFAULT = { enabled: false, model: 'claude-haiku-5-5', daily_per_student: 5, daily_provisional_per_student: 40, auto_final: false, exam_model: 'claude-sonnet-5-5', gen_model: 'claude-sonnet-5-5', monthly_budget_usd: 3 };
const KRW_PER_USD = 1400;   // 화면에 보여 주는 원화는 이 환율로 계산한 '대략의 금액'이에요

function kstDate(s) { return new Date(new Date(s).getTime() + 9 * 3600 * 1000).toISOString().slice(0, 10); }
function kstMonthStartISO() {
  const k = new Date(Date.now() + 9 * 3600 * 1000);
  return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), 1) - 9 * 3600 * 1000).toISOString();
}
const usd = n => '$' + Number(n || 0).toFixed(4);
const won = n => Math.round(Number(n || 0) * KRW_PER_USD).toLocaleString('ko-KR') + '원';

async function tabAI() {
  const [cf, us] = await Promise.all([
    S.sb.from('app_settings').select('value').eq('key', 'ai_config').maybeSingle(),
    S.sb.from('ai_usage').select('*').order('created_at', { ascending: false }).range(0, 4999)
  ]);
  const schemaMissing = !!us.error;
  const cfg = Object.assign({}, AI_DEFAULT, (cf.data && cf.data.value) || {});
  const rows = schemaMissing ? [] : us.data.filter(r => r.created_at >= kstMonthStartISO());

  // 서버 함수 설치 여부와 AI 키 연결 여부 (키 자체는 알 수 없고 '있다/없다'만 알려 줘요)
  let conn = { state: 'nofn' };
  if (!schemaMissing) {
    try { const st = await invokeFn('ai-feedback', { action: 'status' }); conn = { state: st.key_set ? 'live' : 'demo' }; }
    catch (e) { conn = { state: 'nofn' }; }
  }
  const connHtml = schemaMissing
    ? '<span class="badge bad">DB 추가 설치 전</span> 설치 안내서 "2단계"의 1번(schema2.sql)을 먼저 실행해 주세요.'
    : conn.state === 'live' ? '<span class="badge ok">실제 AI 연결됨</span> 서버에 AI 키가 들어 있어요.'
    : conn.state === 'demo' ? '<span class="badge warn">시연용</span> 서버 함수는 설치됐고 AI 키는 아직 없어요. 학생 화면에는 "시연용" 표시와 예시 문구가 나와요.'
    : '<span class="badge bad">서버 함수 설치 전</span> 설치 안내서 "2단계"의 2번(ai-feedback 함수)을 해 주세요.';

  // 이번 달 집계 (기록된 사용량만 사용)
  const ok = rows.filter(r => r.status === 'ok'), demo = rows.filter(r => r.status === 'demo'), er = rows.filter(r => r.status === 'error');
  const sum = (a, k) => a.reduce((s, r) => s + Number(r[k] || 0), 0);
  const cost = sum(ok, 'cost_usd'), tin = sum(ok, 'input_tokens'), tout = sum(ok, 'output_tokens');
  const today = kstDate(new Date());
  const per = new Map();
  for (const r of rows.filter(r => r.status !== 'error')) {
    const key = r.student_id || 'teacher';
    if (!per.has(key)) per.set(key, { n: 0, today: 0, cost: 0 });
    const p = per.get(key); p.n++; if (kstDate(r.created_at) === today) p.today++; p.cost += Number(r.cost_usd || 0);
  }
  const nameOf = id => id === 'teacher' ? '원장님 (채점 제안·문제 만들기)' : (T.sById[id] ? T.sById[id].name : '(삭제된 학생)');
  const perRows = [...per.entries()].map(([id, p]) => `<tr><td>${esc(nameOf(id))}</td><td>${p.today}회</td><td>${p.n}회</td><td>${usd(p.cost)} <span class="tiny">(약 ${won(p.cost)})</span></td></tr>`).join('');
  const budget = Number(cfg.monthly_budget_usd) || 0;
  const pctUsed = budget > 0 ? Math.min(100, Math.round(cost / budget * 100)) : 0;

  $('#tb').innerHTML = `<div class="card"><h2>AI 연결 상태</h2><p>${connHtml}</p>
    <p class="tiny">AI에게는 <b>문제 · 정답/해설 · 학생이 쓴 답</b>만 보내요. 학생 이름·연락처·계정 정보는 보내지 않아요. AI 키는 서버 안에만 있고 학생 화면에는 나오지 않아요.</p></div>
    <div class="card"><h2>AI 설정</h2>
    <label style="font-weight:400"><input type="checkbox" id="aen" ${cfg.enabled ? 'checked' : ''}> AI 도우미 켜기 (학생이 틀린 문제에서 "왜 틀렸는지" 물어볼 수 있고, 서술형 채점 제안도 쓸 수 있고, 애매한 서술형은 AI가 임시 채점해 학생에게 바로 보여 줘요)</label>
    <label style="font-weight:400;margin-top:8px"><input type="checkbox" id="aaf" ${cfg.auto_final ? 'checked' : ''}> <b>서술형은 AI가 바로 최종 채점</b> (학생이 원장님을 기다리지 않아요. 학생이 "채점이 이상해요"를 누르면 그때만 원장님께 알림이 와요)</label>
    <div class="grid2" style="margin-top:8px">
      <div><label>모델</label><select id="amo">${AI_MODELS.map(([v, n]) => `<option value="${v}" ${cfg.model === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div><label>학생 1명당 하루 횟수 한도</label><input type="number" id="adl" min="0" max="50" value="${esc(cfg.daily_per_student)}"></div>
      <div><label>학생 1명당 하루 AI 임시 채점 한도</label><input type="number" id="apd" min="0" max="100" value="${esc(cfg.daily_provisional_per_student)}"></div>
      <div><label>문제 만들기(PDF) 모델</label><select id="agm">${AI_MODELS.map(([v, n]) => `<option value="${v}" ${cfg.gen_model === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      <div><label>이번 달 전체 예산 (달러)</label><input type="number" id="abu" min="0" step="0.5" value="${esc(cfg.monthly_budget_usd)}"></div></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="asv">저장</button></div>
    <p class="tiny">한도나 예산을 넘으면 AI는 멈추고, 학생은 해설 보기·다시 풀기로 계속 공부할 수 있어요. 서술형 답안은 AI와 상관없이 항상 저장돼요. 이미 받은 설명은 다시 불러와도 횟수·비용이 늘지 않아요.</p></div>
    <div class="card"><h2>이번 달 사용량</h2>
    ${schemaMissing ? '<p class="muted">DB 추가를 설치하면 여기에 사용량이 보여요.</p>' : `
    <div class="kv"><div>실제 AI 호출</div><div><b>${ok.length}회</b></div>
      <div>시연용 호출</div><div>${demo.length}회 <span class="tiny">(비용 없음)</span></div>
      <div>실패한 호출</div><div>${er.length}회 <span class="tiny">(답안은 정상 저장돼 있어요)</span></div>
      <div>토큰</div><div>입력 ${tin.toLocaleString('ko-KR')} · 출력 ${tout.toLocaleString('ko-KR')}</div>
      <div>누적 비용</div><div><b>${usd(cost)}</b> (약 ${won(cost)}) / 예산 ${usd(budget)}</div></div>
    <div class="progress" style="margin:8px 0"><i style="width:${pctUsed}%"></i></div>
    <div class="tablewrap"><table><thead><tr><th>이름</th><th>오늘</th><th>이번 달</th><th>비용</th></tr></thead><tbody>${perRows || '<tr><td colspan="4" class="muted">아직 사용 기록이 없어요</td></tr>'}</tbody></table></div>`}
    <p class="tiny" style="margin-top:10px">※ 측정 기준: 서버가 AI를 부를 때마다 기록한 토큰 수 × 모델 단가(Anthropic 공개 가격표)예요. 달 구분은 한국 시간 기준이에요. 원화는 1달러 = ${KRW_PER_USD.toLocaleString('ko-KR')}원으로 계산한 대략의 금액이라, 실제 청구액(세금·환율 포함)은 Anthropic 콘솔의 Usage·Billing 화면에서 확인하세요.</p></div>`;

  $('#asv').onclick = async () => {
    const v = {
      enabled: $('#aen').checked, model: $('#amo').value,
      daily_per_student: Math.max(0, parseInt($('#adl').value, 10) || 0),
      gen_model: $('#agm').value, auto_final: $('#aaf').checked, exam_model: (cfg.exam_model || 'claude-sonnet-5-5'),
      daily_provisional_per_student: Math.max(0, parseInt($('#apd').value, 10) || 0),
      monthly_budget_usd: Math.max(0, parseFloat($('#abu').value) || 0)
    };
    const { error } = await S.sb.from('app_settings').upsert({ key: 'ai_config', value: v });
    toast(error ? errText(error) : '저장했어요');
  };
}
