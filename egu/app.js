'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const SK='egu1-v1';
let DATA=null, ST={name:'',days:{},wrong:{},slow:false,streak:{last:'',n:0}};
try{const s=JSON.parse(localStorage.getItem(SK)||'null');if(s)ST=Object.assign(ST,s)}catch(e){}
const save=()=>{try{localStorage.setItem(SK,JSON.stringify(ST))}catch(e){}};
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]]}return a};
const sample=(a,n)=>shuffle(a).slice(0,n);
const POSL=['명사','동사','형용사','부사','전치사','대명사'];
const POSS={명사:'명',동사:'동',형용사:'형',부사:'부',전치사:'전',대명사:'대'};
const posTag=p=>`<span class="pos ${esc(p)}">${esc(POSS[p]||p)}</span>`;
const short=k=>{const s=k.split(/[,;]/)[0].trim();return s.length>=2?s:k};

/* ---------- 소리 ---------- */
const AU=new Audio(); AU.preload='auto';
function say(item,opts){ // item: {a, text}
  return new Promise(res=>{
    if(!item||!item.a){res();return}
    AU.pause(); AU.onended=()=>res(); AU.onerror=()=>{fallbackTTS(item.text,res)};
    AU.src='audio/'+item.a+'.mp3'; AU.playbackRate=ST.slow?0.75:1;
    const p=AU.play(); if(p&&p.catch)p.catch(()=>fallbackTTS(item.text,res));
  });
}
function fallbackTTS(text,done){
  try{
    const u=new SpeechSynthesisUtterance(text);u.lang='en-US';u.rate=ST.slow?0.7:0.9;
    const v=speechSynthesis.getVoices().find(v=>/en[-_]US/i.test(v.lang)&&/(natural|google|samantha|aria|jenny)/i.test(v.name));if(v)u.voice=v;
    u.onend=()=>done&&done();u.onerror=()=>done&&done();speechSynthesis.speak(u);
  }catch(e){done&&done()}
}
const wItem=w=>({a:w.a,text:w.word});
const spkBtn=(id,cls='')=>`<button class="spk ${cls}" data-say="${id}" aria-label="듣기">🔊</button>`;
let SAYREG={};
function reg(item){const id='s'+Object.keys(SAYREG).length;SAYREG[id]=item;return id}
document.addEventListener('click',e=>{const b=e.target.closest('[data-say]');if(b){e.preventDefault();say(SAYREG[b.dataset.say])}},true);

/* ---------- 말하기(음성 인식) ---------- */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const norm=s=>s.toLowerCase().replace(/[‘’]/g,"'").replace(/\[[^\]]*\]/g,'').replace(/[^a-z0-9' ]/g,' ').replace(/\s+/g,' ').trim();
function lev(a,b){const m=a.length,n=b.length,d=Array.from({length:m+1},(_, i)=>[i,...Array(n).fill(0)]);for(let j=1;j<=n;j++)d[0][j]=j;for(let i=1;i<=m;i++)for(let j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a[i-1]===b[j-1]?0:1));return d[m][n]}
function simil(a,b){a=norm(a);b=norm(b);if(!a||!b)return 0;const w1=a.split(' '),w2=b.split(' ');
  if(w1.length===1&&w2.length===1)return 1-lev(a,b)/Math.max(a.length,b.length);
  // 단어 단위 정렬 점수
  let hit=0;const used=new Set();for(const w of w1){let best=-1,bs=0;w2.forEach((x,i)=>{if(used.has(i))return;const s=1-lev(w,x)/Math.max(w.length,x.length);if(s>bs){bs=s;best=i}});if(best>=0&&bs>=0.7){hit++;used.add(best)}}
  return hit/Math.max(w1.length,w2.length)}
function listen(target){
  return new Promise(res=>{
    if(!SR){res({unsupported:true});return}
    const r=new SR();r.lang='en-US';r.maxAlternatives=5;r.interimResults=false;let done=false;
    const fin=v=>{if(!done){done=true;try{r.stop()}catch(e){}res(v)}};
    r.onresult=ev=>{const alts=[...ev.results[0]].map(x=>x.transcript);let best=0,bt=alts[0]||'';alts.forEach(t=>{const s=simil(t,target);if(s>best){best=s;bt=t}});fin({heard:bt,score:best})};
    r.onerror=ev=>fin({error:ev.error||'error'});
    r.onnomatch=()=>fin({heard:'',score:0});
    r.onend=()=>fin({heard:'',score:0});
    try{r.start()}catch(e){fin({error:'start'})}
    setTimeout(()=>fin({heard:'',score:0,timeout:true}),9000);
  });
}

/* ---------- 데이터 ---------- */
const days=()=>DATA.days;
const dayOf=n=>DATA.days.find(d=>d.day===n);
const allWords=()=>DATA.days.flatMap(d=>d.words.map(w=>({...w,day:d.day})));
const wkey=w=>w.day+'|'+w.word;
function variants(w){w=w.toLowerCase();const out=new Set([w]);const m=w.match(/\((\w+)\)/);if(m){out.add(w.replace(/\(\w+\)/,''));out.add(w.replace(/\((\w+)\)/,'$1'))}
  if(w.includes('/'))w.split('/').forEach(x=>out.add(x.trim()));return [...out]}
const todayStr=()=>new Date().toISOString().slice(0,10);
function touchStreak(){const t=todayStr();if(ST.streak.last===t)return;const y=new Date(Date.now()-864e5).toISOString().slice(0,10);ST.streak.n=ST.streak.last===y?ST.streak.n+1:1;ST.streak.last=t;save()}
function dayInfo(n){return ST.days[n]||(ST.days[n]={modes:{}})}
function stars(n){return Object.values(dayInfo(n).modes).filter(v=>v>=0.7).length}
const MODES=[
 ['learn','📖','단어 익히기','카드를 넘기며 소리·뜻·품사 보기'],
 ['listen','🎧','듣고 뜻 고르기','소리를 듣고 알맞은 뜻 고르기'],
 ['say','🗣️','따라 말하기','듣고 따라 말하면 AI가 들어요'],
 ['pos','🏷️','품사 맞히기','이 뜻은 명사? 동사? 형용사?'],
 ['phrase','🧩','어구 익히기','품사가 어떻게 결합하는지 보고 말하기'],
 ['blank','✍️','문장 빈칸','문장에 알맞은 단어 고르기'],
 ['sent','💬','문장 따라 말하기','문장을 듣고 또박또박 말하기'],
 ['spell','⌨️','듣고 쓰기','소리를 듣고 철자 쓰기']
];

/* ---------- 화면 ---------- */
function shell(inner,title,back){
  $('#app').innerHTML=`<div class="top">${back?`<button class="btn ghost sm" id="back">←</button>`:''}<div class="t">${title||'심쿵영어 · 영단어&품사 1권'}</div><button class="btn ghost sm" id="slow">${ST.slow?'🐢 천천히':'🐇 보통'}</button></div>${inner}`;
  SAYREG={};
  const b=$('#back');if(b)b.onclick=back;
  $('#slow').onclick=()=>{ST.slow=!ST.slow;save();$('#slow').textContent=ST.slow?'🐢 천천히':'🐇 보통'};
  window.scrollTo(0,0);
}
function home(){
  if(!ST.name){return welcome()}
  const done=days().filter(d=>stars(d.day)>=3).length;
  const next=days().find(d=>stars(d.day)<3)||days()[0];
  const nw=Object.keys(ST.wrong).length;
  shell(`<div class="hero"><h1>${esc(ST.name)}, 안녕! 💗</h1><div class="sub">🔥 연속 ${ST.streak.n||0}일 · 완료한 Day ${done}/55</div>
  <div class="prog"><i style="width:${done/55*100}%"></i></div>
  <button class="btn big" id="go">오늘은 Day ${next.day} · ${esc(next.topic)}</button></div>
  ${nw?`<button class="mode" id="rev"><span class="ic">🔁</span><div><b>틀린 단어 다시 보기</b><span>${nw}개 · 들으면서 다시 도전</span></div></button>`:''}
  <h2 style="margin-top:14px">Day 고르기</h2>
  <div class="grid">${days().map(d=>{const s=stars(d.day);return `<div class="day ${s>=3?'done':''} ${d.day===next.day?'cur':''}" data-d="${d.day}">${d.day}<small>${s?'★'.repeat(Math.min(s,5)):'&nbsp;'}</small></div>`}).join('')}</div>
  <p class="small center" style="margin-top:16px">★ 3개 이상 모으면 그 Day 완료! · 진도는 이 기기에 저장돼요</p>
  <p class="center"><button class="btn ghost sm" id="rename">이름 바꾸기</button></p>`);
  $('#go').onclick=()=>dayScreen(next.day);
  document.querySelectorAll('.day').forEach(el=>el.onclick=()=>dayScreen(+el.dataset.d));
  const r=$('#rev');if(r)r.onclick=reviewWrong;
  $('#rename').onclick=()=>{ST.name='';save();home()};
}
function welcome(){
  shell(`<div class="hero"><h1>심쿵영어 단어 💗</h1><div class="sub">EGU 영단어&품사 1권 · 55일 · 단어 1,100개<br>듣고, 말하고, 문장으로 써먹어요!</div></div>
  <div class="card"><b>이름이 뭐예요?</b><input class="ans" id="nm" placeholder="이름" maxlength="10" style="font-size:20px"><button class="btn big" id="ok" style="margin-top:12px">시작하기</button></div>`);
  $('#ok').onclick=()=>{const v=$('#nm').value.trim();if(v){ST.name=v;save();home()}};
}
function dayScreen(n){
  const d=dayOf(n),info=dayInfo(n);
  shell(`<div class="hero"><h2>Day ${n} · ${esc(d.topic)}</h2><div class="sub">단어 ${d.words.length}개 · 어구 ${d.phrases.length}개 · 문장 ${d.sentences.length}개</div></div>
  ${MODES.map(m=>{const sc=info.modes[m[0]];return `<button class="mode" data-m="${m[0]}"><span class="ic">${m[1]}</span><div><b>${m[2]} ${sc>=0.7?'✅':sc!=null?'🔸':''}</b><span>${m[3]}</span></div></button>`}).join('')}`,`Day ${n}`,home);
  document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>runMode(b.dataset.m,n));
}
function runMode(m,n){
  const d=dayOf(n);
  const fin=(score,total)=>finish(n,m,score,total);
  ({learn,listen:listenQ,say:sayQ,pos:posQ,phrase:phraseQ,blank:blankQ,sent:sentQ,spell:spellQ})[m](d,n,fin);
}
function finish(n,m,score,total,custom){
  const r=total?score/total:1;
  if(n){const i=dayInfo(n);i.modes[m]=Math.max(i.modes[m]||0,r)}
  touchStreak();save();
  const face=r>=0.9?'🎉':r>=0.7?'😊':'💪';
  shell(`<div class="card res"><div class="big">${face}</div><h2>${total?`${score} / ${total}`:'끝!'}</h2>
  <div>${r>=0.9?'완벽해요! 심쿵!':r>=0.7?'잘했어요!':'한 번 더 하면 더 잘할 수 있어요'}</div>
  <p class="small">${n&&stars(n)>=3?`⭐ Day ${n} 완료!`:'다른 활동도 해 볼까요?'}</p>
  <button class="btn big" id="again">다시 하기</button><button class="btn ghost big" id="home" style="margin-top:8px">${n?`Day ${n} 메뉴`:'처음으로'}</button></div>`);
  $('#again').onclick=()=>custom?custom():runMode(m,n);
  $('#home').onclick=()=>n?dayScreen(n):home();
}

/* ---- 1 단어 익히기 ---- */
function learn(d,n,fin){
  let i=0;const W=d.words;
  const show=()=>{const w=W[i];const id=reg(wItem(w));
    shell(`<div class="prog"><i style="width:${(i+1)/W.length*100}%"></i></div><div class="small center">${i+1} / ${W.length}</div>
    <div class="card center"><div class="word">${esc(w.word)}</div>${spkBtn(id)}
    <div style="margin-top:10px">${w.meanings.map(m=>`<div class="mean">${posTag(m.pos)} ${esc(m.ko)}</div>`).join('')}</div>
    ${w.forms?`<div class="forms">과거-과거분사 · ${esc(w.forms)}</div>`:''}</div>
    <div class="row"><button class="btn ghost" id="pv" style="flex:1" ${i?'':'disabled'}>이전</button><button class="btn" id="nx" style="flex:2">${i<W.length-1?'다음':'끝내기'}</button></div>`,`Day ${n} · 단어 익히기`,()=>dayScreen(n));
    $('#pv').onclick=()=>{i--;show()};$('#nx').onclick=()=>{if(i<W.length-1){i++;show()}else fin(1,1)};
    say(wItem(w));};
  show();
}

/* ---- 공통 퀴즈 엔진 ---- */
function runQuiz(title,n,m,qs,fin){
  let i=0,score=0,locked=false;
  const render=()=>{const q=qs[i];locked=false;
    shell(`<div class="prog"><i style="width:${i/qs.length*100}%"></i></div><div class="small center">${i+1} / ${qs.length}</div><div id="q"></div>`,title,()=>n?dayScreen(n):home());
    q.render($('#q'),(ok,detail)=>{if(locked)return;locked=true;if(ok)score++;else q.onWrong&&q.onWrong();
      const nb=document.createElement('button');nb.className='btn big';nb.style.marginTop='12px';nb.textContent=i<qs.length-1?'다음':'결과 보기';
      nb.onclick=()=>{i++;if(i<qs.length)render();else fin(score,qs.length)};$('#q').appendChild(nb);nb.scrollIntoView({block:'nearest'})});
  };
  render();
}
const markWrong=w=>{ST.wrong[wkey(w)]=(ST.wrong[wkey(w)]||0)+1;save()};
const clearWrong=w=>{const k=wkey(w);if(ST.wrong[k]){ST.wrong[k]--;if(ST.wrong[k]<=0)delete ST.wrong[k];save()}};

/* ---- 2 듣고 뜻 고르기 ---- */
function mkListen(w,pool){
  const m=w.meanings[0], right=short(m.ko), bad=new Set(w.meanings.map(x=>short(x.ko)));
  const dis=[];for(const x of shuffle(pool)){if(x.word===w.word)continue;const k=short(x.meanings[0].ko);if(!bad.has(k)&&!dis.includes(k))dis.push(k);if(dis.length>=3)break}
  const opts=shuffle([right,...dis]);
  return {render(el,done){const id=reg(wItem(w));
    el.innerHTML=`<div class="card center"><div class="small">소리를 듣고 뜻을 고르세요</div><div style="margin:10px 0">${spkBtn(id,'')}</div><div class="opts">${opts.map(o=>`<button class="opt">${esc(o)}</button>`).join('')}</div></div>`;
    el.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{const ok=b.textContent===right;b.classList.add(ok?'ok':'bad');
      if(!ok)el.querySelectorAll('.opt').forEach(x=>{if(x.textContent===right)x.classList.add('ok')});
      el.querySelector('.card').insertAdjacentHTML('beforeend',`<div class="fb ${ok?'ok':'bad'}">${esc(w.word)} · ${w.meanings.map(m=>posTag(m.pos)+esc(short(m.ko))).join(' ')}</div>`);
      el.querySelectorAll('.opt').forEach(x=>x.disabled=true);ok?clearWrong(w):markWrong(w);done(ok)});
    setTimeout(()=>say(wItem(w)),250)}, onWrong(){}};
}
function listenQ(d,n,fin){const pool=allWords();runQuiz(`Day ${n} · 듣고 뜻 고르기`,n,'listen',shuffle(d.words).map(w=>mkListen({...w,day:d.day},pool)),fin)}
function reviewWrong(){
  const ks=Object.keys(ST.wrong);const aw=allWords();const ws=ks.map(k=>aw.find(w=>wkey(w)===k)).filter(Boolean);
  if(!ws.length)return home();
  const go=()=>runQuiz('틀린 단어 다시 보기',0,'rev',sample(ws,Math.min(15,ws.length)).map(w=>mkListen(w,aw)),(s,t)=>finish(0,'rev',s,t,go));go();
}

/* ---- 3 따라 말하기 (단어) ---- */
function mkSay(item,target,ko,big){
  return {render(el,done){const id=reg(item);
    el.innerHTML=`<div class="card center"><div class="${big?'word':'word sm'}">${esc(target)}</div>${ko?`<div class="mean">${ko}</div>`:''}<div>${spkBtn(id)}</div>
    <div class="small" style="margin:10px 0 6px">①소리를 듣고 ②마이크를 눌러 따라 말해요</div>
    <button class="spk mic" id="mic">🎤</button><div id="res"></div><div style="margin-top:10px"><button class="btn ghost sm" id="skip">${SR?'건너뛰기':'말했어요!'}</button></div></div>`;
    let tries=0;
    const mic=el.querySelector('#mic'),res=el.querySelector('#res');
    mic.onclick=async()=>{
      if(!SR){res.innerHTML='<div class="fb bad">이 브라우저는 말하기 인식이 안 돼요. 크롬이나 사파리로 열어 주세요.</div>';return}
      AU.pause();mic.classList.add('on');res.innerHTML='<div class="small">듣고 있어요… 말해 보세요!</div>';
      const r=await listen(target);mic.classList.remove('on');tries++;
      if(r.error){res.innerHTML=`<div class="fb bad">${r.error==='not-allowed'||r.error==='service-not-allowed'?'마이크 사용을 허용해 주세요 🎤':'다시 한 번 해 볼까요?'}</div>`;return}
      const ok=r.score>=(target.includes(' ')?0.75:0.8);
      res.innerHTML=r.heard?`<div class="fb ${ok?'ok':'bad'}">${ok?'👏 좋아요!':'🙂 조금만 더!'}<br><span class="small">들린 말: ${esc(r.heard)}</span></div>`:`<div class="fb bad">잘 안 들렸어요. 다시!</div>`;
      if(ok)done(true);else if(tries>=3){res.insertAdjacentHTML('beforeend','<div class="small">괜찮아요, 다음에 또 해요</div>');done(false)}
    };
    el.querySelector('#skip').onclick=()=>done(!SR||false);
    setTimeout(()=>say(item),250)}};
}
function sayQ(d,n,fin){runQuiz(`Day ${n} · 따라 말하기`,n,'say',d.words.map(w=>mkSay(wItem(w),w.word.replace(/\(.*?\)/g,''),w.meanings.map(m=>posTag(m.pos)+esc(short(m.ko))).join(' '),true)),fin)}

/* ---- 4 품사 맞히기 ---- */
function posQ(d,n,fin){
  const items=d.words.flatMap(w=>w.meanings.map(m=>({w,m})));
  const qs=shuffle(items).slice(0,20).map(({w,m})=>({render(el,done){const id=reg(wItem(w));
    el.innerHTML=`<div class="card center"><div class="small">이 단어는 무슨 품사일까요?</div><div class="word sm">${esc(w.word)}</div>${spkBtn(id,'sm')}<div class="mean">“${esc(short(m.ko))}”</div>
    <div class="posopts">${['명사','동사','형용사','부사'].map(p=>`<button class="opt" data-p="${p}">${p}</button>`).join('')}</div></div>`;
    el.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{const ok=b.dataset.p===m.pos;b.classList.add(ok?'ok':'bad');
      el.querySelectorAll('.opt').forEach(x=>{if(x.dataset.p===m.pos)x.classList.add('ok');x.disabled=true});
      el.querySelector('.card').insertAdjacentHTML('beforeend',`<div class="fb ${ok?'ok':'bad'}">${esc(w.word)}(${esc(m.pos)}) = ${esc(m.ko)}</div>`);ok?0:markWrong({...w,day:d.day});done(ok)})}}));
  runQuiz(`Day ${n} · 품사 맞히기`,n,'pos',qs,fin);
}

/* ---- 5 어구 익히기 ---- */
function phraseQ(d,n,fin){
  if(!d.phrases.length)return fin(1,1);
  const qs=d.phrases.map(p=>mkSay({a:p.a,text:p.en},p.en,`${esc(p.ko)}<div class="small" style="margin-top:4px">${p.pos.map(x=>posTag(x)).join(' + ')}</div>`,false));
  runQuiz(`Day ${n} · 어구 익히기`,n,'phrase',qs,fin);
}

/* ---- 6 문장 빈칸 ---- */
function blankQ(d,n,fin){
  if(!d.sentences.length)return fin(1,1);
  const pool=d.words.map(w=>w.word),aw=allWords();
  const qs=shuffle(d.sentences).map(s=>{
    const same=d.sentences.filter(x=>x.pos===s.pos&&x.answer!==s.answer).map(x=>x.answer);
    const other=d.words.filter(w=>w.word!==s.answer&&w.meanings.some(m=>m.pos===s.pos)).map(w=>w.word);
    let dis=[...new Set([...same,...other])];dis=sample(dis,3);
    if(dis.length<3){for(const w of shuffle(aw)){if(dis.length>=3)break;if(w.word!==s.answer&&!dis.includes(w.word)&&w.meanings.some(m=>m.pos===s.pos))dis.push(w.word)}}
    const opts=shuffle([s.answer,...dis]);
    return {render(el,done){const id=reg({a:s.a,text:s.en});
      const html=esc(s.blank).replace(/____/,'<span class="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>');
      el.innerHTML=`<div class="card center"><div class="small">빈칸에 알맞은 단어를 고르세요 (${posTag(s.pos)}이 들어가요)</div><div class="sent">${html}</div><div class="mean small">${esc(s.ko)}</div>
      <div class="opts">${opts.map(o=>`<button class="opt">${esc(o)}</button>`).join('')}</div></div>`;
      el.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{const ok=b.textContent===s.answer;b.classList.add(ok?'ok':'bad');
        el.querySelectorAll('.opt').forEach(x=>{if(x.textContent===s.answer)x.classList.add('ok');x.disabled=true});
        el.querySelector('.sent').innerHTML=esc(s.en).replace(esc(s.answer),`<span class="hl">${esc(s.answer)}</span>`);
        const fl=esc(s.en);el.querySelector('.card').insertAdjacentHTML('beforeend',`<div class="fb ${ok?'ok':'bad'}">${ok?'정답!':'정답은 '+esc(s.answer)}</div><div style="margin-top:8px">${spkBtn(id,'sm')}</div>`);
        say({a:s.a,text:s.en});done(ok)})}}});
  runQuiz(`Day ${n} · 문장 빈칸`,n,'blank',qs,fin);
}

/* ---- 7 문장 따라 말하기 ---- */
function sentQ(d,n,fin){
  if(!d.sentences.length)return fin(1,1);
  runQuiz(`Day ${n} · 문장 따라 말하기`,n,'sent',sample(d.sentences,Math.min(8,d.sentences.length)).map(s=>mkSay({a:s.a,text:s.en},s.en,`<span class="small">${esc(s.ko)}</span>`,false)),fin);
}

/* ---- 8 듣고 쓰기 ---- */
function spellQ(d,n,fin){
  const qs=shuffle(d.words).slice(0,15).map(w=>({render(el,done){const id=reg(wItem(w));
    el.innerHTML=`<div class="card center"><div class="small">소리를 듣고 철자를 써 보세요</div><div style="margin:8px 0">${spkBtn(id)}</div><div class="mean">${w.meanings.map(m=>posTag(m.pos)+esc(short(m.ko))).join(' ')}</div>
    <input class="ans" id="in" autocapitalize="off" autocomplete="off" autocorrect="off" spellcheck="false" placeholder="여기에 쓰기"><button class="btn big" id="ck" style="margin-top:10px">확인</button></div>`;
    const inp=el.querySelector('#in');
    const check=()=>{const v=inp.value.trim().toLowerCase().replace(/\s+/g,' ');if(!v)return;const ok=variants(w.word).includes(v);inp.disabled=true;el.querySelector('#ck').remove();
      el.querySelector('.card').insertAdjacentHTML('beforeend',`<div class="fb ${ok?'ok':'bad'}">${ok?'정답! 👏':'정답: <b>'+esc(w.word)+'</b>'}</div>`);ok?clearWrong({...w,day:d.day}):markWrong({...w,day:d.day});say(wItem(w));done(ok)};
    el.querySelector('#ck').onclick=check;inp.onkeydown=e=>{if(e.key==='Enter')check()};
    setTimeout(()=>{say(wItem(w));},250)}}));
  runQuiz(`Day ${n} · 듣고 쓰기`,n,'spell',qs,fin);
}

/* ---------- 시작 ---------- */
fetch('data.json').then(r=>r.json()).then(j=>{DATA=j;home()}).catch(()=>{$('#app').innerHTML='<p class="card">자료를 불러오지 못했어요. 인터넷을 확인해 주세요.</p>'});
