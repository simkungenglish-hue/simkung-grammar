-- ============================================================
-- 스텔라의 심쿵영어 · 12단계: 중등 내신대비 · 본문 학습 (문장 성분 · 1~5형식 표시)
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요. 여러 번 실행해도 안전해요.
-- (11단계 schema11_vocab.sql 을 먼저 실행해 주세요. vocab_norm 함수를 같이 써요)
-- ============================================================

-- ---------- 1. 본문 · 문장 ----------
create table if not exists public.passages (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  school_grade text not null default '',   -- 중1 / 중2 / 중3
  publisher text not null default '',      -- 교과서 출판사(저자)
  lesson text not null default '',         -- 예: Lesson 5
  note text not null default '',
  status text not null default 'draft' check (status in ('draft','published')),
  created_at timestamptz not null default now()
);

-- chunks: [{"t":"My grandmother","r":"S","ko":"할머니가"}, ...]  r = S V O IO DO C OC M X
-- pattern: 큰 뼈대(주절)의 형식 1~5, 0이면 형식 문제에서 빼요
create table if not exists public.passage_sentences (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.passages(id) on delete cascade,
  ord int not null,
  en text not null,
  ko text not null default '',
  pattern int not null default 0 check (pattern between 0 and 5),
  chunks jsonb not null default '[]'::jsonb,
  points jsonb not null default '[]'::jsonb,   -- [{"t":"which","note":"관계대명사 - 앞의 festival 설명"}]
  blanks text[] not null default '{}',         -- 빈칸으로 낼 단어·표현 (문장 안에 그대로 있는 글자)
  alt text not null default '',                -- 바꿔 쓴 문장 (예: 4형식 → 3형식)
  alt_note text not null default '',           -- 바꿔 쓰기 지시 (예: 3형식으로 바꿔 쓰세요)
  key boolean not null default true,           -- 기초 학생에게도 내는 핵심 문장
  unique (passage_id, ord)
);

-- ---------- 2. 배정 · 기록 ----------
create table if not exists public.passage_assignments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  passage_id uuid not null references public.passages(id) on delete cascade,
  track text not null default 'normal' check (track in ('basic','normal','adv')),   -- 기초 / 기본 / 심화
  due_date date,
  created_at timestamptz not null default now(),
  unique (student_id, passage_id)
);

create table if not exists public.passage_progress (
  student_id uuid not null references public.profiles(id) on delete cascade,
  passage_id uuid not null references public.passages(id) on delete cascade,
  step text not null check (step in ('read','role','pattern','order','blank','write','convert')),
  score int, total int,
  tries int not null default 1,
  time_sec int not null default 0,
  done_at timestamptz not null default now(),
  primary key (student_id, passage_id, step)
);

create table if not exists public.passage_answers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,
  student_id uuid not null references public.profiles(id) on delete cascade,
  passage_id uuid not null references public.passages(id) on delete cascade,
  sentence_id uuid not null references public.passage_sentences(id) on delete cascade,
  step text not null check (step in ('role','pattern','order','blank','write','convert')),
  review boolean not null default false,
  run_id uuid,
  answer text not null,
  is_correct boolean not null,
  pattern int not null default 0,          -- 그 문장의 형식 (형식별 정답률용)
  submitted_at timestamptz not null default now()
);
create index if not exists passage_answers_stu_idx on public.passage_answers (student_id, submitted_at desc);
create index if not exists passage_answers_run_idx on public.passage_answers (run_id);

-- 문장 복습 상자 (1→1일, 2→3일, 3→7일, 4→14일, 5→30일, 6→완성)
create table if not exists public.passage_srs (
  student_id uuid not null references public.profiles(id) on delete cascade,
  sentence_id uuid not null references public.passage_sentences(id) on delete cascade,
  box int not null default 1 check (box between 1 and 6),
  due_on date not null,
  correct_n int not null default 0,
  wrong_n int not null default 0,
  last_on date,
  primary key (student_id, sentence_id)
);

-- ---------- 3. 권한 ----------
alter table public.passages            enable row level security;
alter table public.passage_sentences   enable row level security;
alter table public.passage_assignments enable row level security;
alter table public.passage_progress    enable row level security;
alter table public.passage_answers     enable row level security;
alter table public.passage_srs         enable row level security;

create or replace function public.passage_open(p_passage uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.passage_assignments a join public.passages p on p.id = a.passage_id
                 where a.passage_id = p_passage and a.student_id = auth.uid() and p.status = 'published');
$$;

drop policy if exists p_ps_sel on public.passages;
create policy p_ps_sel on public.passages for select using (public.is_teacher() or public.passage_open(id));
drop policy if exists p_ps_all on public.passages;
create policy p_ps_all on public.passages for all using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists p_pss_sel on public.passage_sentences;
create policy p_pss_sel on public.passage_sentences for select using (public.is_teacher() or public.passage_open(passage_id));
drop policy if exists p_pss_all on public.passage_sentences;
create policy p_pss_all on public.passage_sentences for all using (public.is_teacher()) with check (public.is_teacher());
drop policy if exists p_pa_sel on public.passage_assignments;
create policy p_pa_sel on public.passage_assignments for select using (student_id = auth.uid() or public.is_teacher());
drop policy if exists p_pa_all on public.passage_assignments;
create policy p_pa_all on public.passage_assignments for all using (public.is_teacher()) with check (public.is_teacher());
do $$ declare t text; begin
  foreach t in array array['passage_progress','passage_answers','passage_srs'] loop
    execute format('drop policy if exists p_%s_sel on public.%I', t, t);
    execute format('create policy p_%s_sel on public.%I for select using (student_id = auth.uid() or public.is_teacher())', t, t);
    execute format('drop policy if exists p_%s_del on public.%I', t, t);
    execute format('create policy p_%s_del on public.%I for delete using (public.is_teacher())', t, t);
  end loop;
end $$;

create table if not exists public.passage_step_runs (
  run_id uuid primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now()
);
alter table public.passage_step_runs enable row level security;

-- ---------- 4. 단계 규칙 (화면도 이 함수 결과를 그대로 써요) ----------
-- 기초: 핵심 문장만(없으면 전부), 형식은 1~3형식만, 바꿔 쓰기 없음
create or replace function public.passage_steps(p_passage uuid, p_track text)
returns table (step text, ord int, n int) language sql stable security definer set search_path = public as $$
  with base as (
    select s.* from public.passage_sentences s where s.passage_id = p_passage
      and (p_track <> 'basic' or s.key or not exists (select 1 from public.passage_sentences k where k.passage_id = p_passage and k.key))
  ), c as (
    select 'read' as step, 1 as ord, count(*)::int as n from base
    union all select 'role', 2, count(*) filter (where jsonb_array_length(chunks) > 0)::int from base
    union all select 'pattern', 3, count(*) filter (where pattern between 1 and case when p_track = 'basic' then 3 else 5 end and jsonb_array_length(chunks) > 0)::int from base
    union all select 'order', 4, count(*)::int from base
    union all select 'blank', 5, count(*) filter (where cardinality(blanks) > 0)::int from base
    union all select 'write', 6, count(*)::int from base
    union all select 'convert', 7, case when p_track = 'basic' then 0 else count(*) filter (where alt <> '')::int end from base
  ) select step, ord, n from c where n > 0 order by ord;
$$;
create or replace function public.passage_sentence_in_step(p_sentence uuid, p_step text, p_track text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.passage_sentences s where s.id = p_sentence
    and (p_track <> 'basic' or s.key or not exists (select 1 from public.passage_sentences k where k.passage_id = s.passage_id and k.key))
    and case p_step when 'role' then jsonb_array_length(s.chunks) > 0
                    when 'pattern' then s.pattern between 1 and case when p_track = 'basic' then 3 else 5 end and jsonb_array_length(s.chunks) > 0
                    when 'blank' then cardinality(s.blanks) > 0
                    when 'convert' then p_track <> 'basic' and s.alt <> ''
                    else true end);
$$;
-- 학생: 내게 배정된 본문마다 할 단계 목록
create or replace function public.passage_my_steps()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(a.passage_id, (select coalesce(jsonb_agg(jsonb_build_object('step', x.step, 'n', x.n) order by x.ord), '[]'::jsonb) from public.passage_steps(a.passage_id, a.track) x)), '{}'::jsonb)
    from public.passage_assignments a where a.student_id = auth.uid();
$$;

-- ---------- 5. 채점 ----------
-- 문장 비교: 대소문자·끝 문장부호·쉼표·따옴표 차이는 봐 줘요 (철자·단어 순서는 정확해야 해요)
create or replace function public.passage_norm(t text) returns text language sql immutable as $$
  select btrim(regexp_replace(regexp_replace(public.vocab_norm(t), '[,;:"]', '', 'g'), '\s+', ' ', 'g'));
$$;

-- 성분 이름표를 수준에 맞게 줄여요: 기초는 S·V만, 기본은 S V O C M, 심화는 IO DO OC 까지
create or replace function public.passage_role_for(p_role text, p_track text) returns text language sql immutable as $$
  select case
    when p_track = 'basic' then case when p_role in ('S','V') then p_role else '-' end
    when p_track = 'normal' then case when p_role in ('IO','DO') then 'O' when p_role = 'OC' then 'C' when p_role in ('M','X') then 'M' else p_role end
    else case when p_role = 'X' then 'M' else p_role end end;
$$;

create or replace function public.passage_submit(
  p_client uuid, p_sentence uuid, p_step text, p_answer text, p_review boolean default false, p_run uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); s public.passage_sentences%rowtype; trk text; ok boolean := false; expected text := '';
  r public.passage_srs%rowtype; today date := public.vocab_kst_today(); prev public.passage_answers%rowtype;
  arr jsonb; i int; n int; bi int; nb int;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if p_step not in ('role','pattern','order','blank','write','convert') then raise exception 'bad_step'; end if;
  select * into prev from public.passage_answers where client_id = p_client and student_id = me;
  if found then return jsonb_build_object('is_correct', prev.is_correct, 'dup', true); end if;
  select * into s from public.passage_sentences where id = p_sentence;
  if not found or not public.passage_open(s.passage_id) then raise exception 'no_assignment'; end if;
  select track into trk from public.passage_assignments where student_id = me and passage_id = s.passage_id;
  if coalesce(btrim(p_answer), '') = '' then raise exception 'empty_answer'; end if;
  if length(p_answer) > 2000 then raise exception 'bad_answer'; end if;

  if p_step = 'role' then
    -- 답: ["S","V","-","O"] 처럼 덩어리마다 이름표
    begin arr := p_answer::jsonb; exception when others then raise exception 'bad_answer'; end;
    n := jsonb_array_length(s.chunks);
    if n = 0 or jsonb_typeof(arr) <> 'array' or jsonb_array_length(arr) <> n then raise exception 'bad_answer'; end if;
    if exists (select 1 from jsonb_array_elements(arr) e where jsonb_typeof(e) <> 'string') then raise exception 'bad_answer'; end if;
    ok := true;
    for i in 0 .. n - 1 loop
      expected := expected || case when i > 0 then ' ' else '' end || public.passage_role_for(s.chunks->i->>'r', trk);
      if public.passage_role_for(s.chunks->i->>'r', trk) <> public.passage_role_for(coalesce(arr->>i, '-'), trk) then ok := false; end if;
    end loop;
  elsif p_step = 'pattern' then
    if s.pattern = 0 then raise exception 'no_pattern'; end if;
    ok := btrim(p_answer) = s.pattern::text; expected := s.pattern::text;
  elsif p_step in ('order','write') then
    ok := public.passage_norm(p_answer) = public.passage_norm(s.en); expected := s.en;
  elsif p_step = 'convert' then
    if s.alt = '' then raise exception 'no_convert'; end if;
    ok := public.passage_norm(p_answer) = public.passage_norm(s.alt); expected := s.alt;
  elsif p_step = 'blank' then
    -- 답: {"i":0,"a":"started"}
    begin arr := p_answer::jsonb; exception when others then raise exception 'bad_answer'; end;
    bi := coalesce((arr->>'i')::int, -1);
    if bi < 0 or bi >= coalesce(array_length(s.blanks, 1), 0) then raise exception 'bad_answer'; end if;
    expected := s.blanks[bi + 1];
    ok := public.passage_norm(arr->>'a') = public.passage_norm(expected);
  end if;

  insert into public.passage_answers (client_id, student_id, passage_id, sentence_id, step, review, run_id, answer, is_correct, pattern)
  values (p_client, me, s.passage_id, s.id, p_step, coalesce(p_review,false), p_run, left(p_answer, 600), ok, s.pattern);

  -- 문장 복습 상자: 틀리면 내일 다시, 복습에서 맞히면 간격이 늘어나요. 하루에 한 번만 움직여요.
  select * into r from public.passage_srs where student_id = me and sentence_id = s.id for update;
  if not ok then
    if not found then
      insert into public.passage_srs (student_id, sentence_id, box, due_on, wrong_n, last_on) values (me, s.id, 1, today + 1, 1, today) returning * into r;
    elsif r.last_on is distinct from today or r.box > 1 then
      update public.passage_srs set box = 1, due_on = today + 1, wrong_n = wrong_n + 1, last_on = today where student_id = me and sentence_id = s.id returning * into r;
    end if;
  elsif coalesce(p_review,false) and found and r.due_on <= today and r.last_on is distinct from today then
    nb := least(r.box + 1, 6);
    update public.passage_srs set box = nb, due_on = today + public.vocab_gap(nb), correct_n = correct_n + 1, last_on = today
      where student_id = me and sentence_id = s.id returning * into r;
  end if;
  -- 정답 문장은 학습 묶음(run) 안에서 답을 낸 뒤에만 보여 줘요
  return jsonb_build_object('is_correct', ok, 'expected', case when p_run is null then '' else expected end, 'box', r.box, 'due_on', r.due_on);
end $$;

-- 단계 마치기: 앞 단계를 마쳐야 해요. 점수는 서버에 저장된 이번 묶음 답(문장마다 첫 답)으로 세요.
create or replace function public.passage_step_done(p_passage uuid, p_step text, p_run uuid default null, p_time_sec int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); prev text; got int := null; tot int := null; trk text; need int;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if p_step not in ('read','role','pattern','order','blank','write','convert') then raise exception 'bad_step'; end if;
  if not public.passage_open(p_passage) then raise exception 'no_assignment'; end if;
  select track into trk from public.passage_assignments where student_id = me and passage_id = p_passage;
  need := (select x.n from public.passage_steps(p_passage, trk) x where x.step = p_step);
  if need is null then raise exception 'bad_step'; end if;
  -- 바로 앞의 '할 단계'를 마쳐야 해요 (문장이 없어 빠진 단계는 건너뛰어요)
  prev := (select x.step from public.passage_steps(p_passage, trk) x
            where x.ord < (select y.ord from public.passage_steps(p_passage, trk) y where y.step = p_step) order by x.ord desc limit 1);
  if prev is not null and not exists (select 1 from public.passage_progress where student_id = me and passage_id = p_passage and step = prev) then
    raise exception 'step_locked';
  end if;
  if p_step <> 'read' then
    if p_run is null then raise exception 'bad_answer'; end if;
    select count(*), count(*) filter (where is_correct) into tot, got from (
      select distinct on (a.sentence_id) a.sentence_id, a.is_correct from public.passage_answers a
       where a.run_id = p_run and a.student_id = me and a.passage_id = p_passage and a.step = p_step and not a.review
         and public.passage_sentence_in_step(a.sentence_id, p_step, trk)
       order by a.sentence_id, a.submitted_at) x;
    if tot < need then raise exception 'incomplete'; end if;
    insert into public.passage_step_runs (run_id, student_id) values (p_run, me) on conflict do nothing;
    if not found then raise exception 'dup_run'; end if;
  end if;
  insert into public.passage_progress (student_id, passage_id, step, score, total, time_sec)
  values (me, p_passage, p_step, got, tot, least(greatest(coalesce(p_time_sec,0),0), case when p_step = 'read' then 1200 else 3600 end))
  on conflict (student_id, passage_id, step) do update set
    score = excluded.score, total = excluded.total, tries = passage_progress.tries + 1,
    time_sec = passage_progress.time_sec + excluded.time_sec, done_at = now();
  return jsonb_build_object('ok', true, 'score', got, 'total', tot);
end $$;

-- 원장님: 학생별 본문 진행 + 형식별 정답률 + 자주 틀린 문장
create or replace function public.passage_teacher_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare today date := public.vocab_kst_today();
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  return jsonb_build_object(
    'students', coalesce((select jsonb_agg(x) from (
      select p.id as student_id,
        (select count(*) from passage_srs s where s.student_id = p.id and s.due_on <= today) as due,
        (select count(*) from passage_answers a where a.student_id = p.id and (a.submitted_at at time zone 'Asia/Seoul')::date = today) as today_n,
        (select count(*) filter (where is_correct) from passage_answers a where a.student_id = p.id and (a.submitted_at at time zone 'Asia/Seoul')::date = today) as today_ok,
        (select max(submitted_at) from passage_answers a where a.student_id = p.id) as last_at,
        (select jsonb_object_agg(pt, jsonb_build_array(ok, n)) from (
           select a.pattern as pt, count(*) filter (where a.is_correct) as ok, count(*) as n from passage_answers a
            where a.student_id = p.id and a.step in ('role','pattern') and a.pattern between 1 and 5 and not a.review
            group by a.pattern) z) as by_pattern
      from profiles p where p.role = 'student' order by p.name) x), '[]'::jsonb),
    'weak', coalesce((select jsonb_agg(w) from (
      select s.id as sentence_id, s.passage_id, s.en, s.pattern, count(*) as wrong, count(distinct a.student_id) as students
        from passage_answers a join passage_sentences s on s.id = a.sentence_id
       where not a.is_correct and a.submitted_at > now() - interval '30 days'
       group by s.id, s.passage_id, s.en, s.pattern order by count(*) desc limit 15) w), '[]'::jsonb));
end $$;

create or replace function public.passage_save(p_id uuid, p_meta jsonb, p_sents jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid := p_id; it jsonb; k int := 0; sid uuid; keep uuid[] := '{}';
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_sents) <> 'array' or jsonb_array_length(p_sents) = 0 then raise exception '문장이 없어요'; end if;
  if pid is null then
    insert into public.passages (title, school_grade, publisher, lesson, status)
    values (left(coalesce(nullif(btrim(p_meta->>'title'), ''), '새 본문'), 120), coalesce(p_meta->>'school_grade',''), left(coalesce(p_meta->>'publisher',''), 60), left(coalesce(p_meta->>'lesson',''), 40), 'draft')
    returning id into pid;
  else
    update public.passages set title = left(coalesce(nullif(btrim(p_meta->>'title'), ''), title), 120), school_grade = coalesce(p_meta->>'school_grade', school_grade),
      publisher = left(coalesce(p_meta->>'publisher', publisher), 60), lesson = left(coalesce(p_meta->>'lesson', lesson), 40) where id = pid;
    if not found then raise exception '본문을 찾지 못했어요'; end if;
  end if;
  for it in select * from jsonb_array_elements(p_sents) loop
    if coalesce(btrim(it->>'en'), '') = '' then raise exception '빈 문장이 있어요'; end if;
    if nullif(it->>'id', '') is not null then keep := keep || (it->>'id')::uuid; end if;
  end loop;
  delete from public.passage_sentences where passage_id = pid and not (id = any(keep));
  update public.passage_sentences set ord = ord + 100000 where passage_id = pid;
  for it in select * from jsonb_array_elements(p_sents) loop
    k := k + 1; sid := nullif(it->>'id', '')::uuid;
    if sid is not null then
      update public.passage_sentences set ord = k, en = left(it->>'en', 400), ko = left(coalesce(it->>'ko',''), 400), pattern = coalesce((it->>'pattern')::int, 0),
        chunks = coalesce(it->'chunks', '[]'::jsonb), points = coalesce(it->'points', '[]'::jsonb),
        blanks = coalesce((select array_agg(x) from jsonb_array_elements_text(it->'blanks') x), '{}'), alt = left(coalesce(it->>'alt',''), 400),
        alt_note = left(coalesce(it->>'alt_note',''), 80), key = coalesce((it->>'key')::boolean, true)
       where id = sid and passage_id = pid;
      if not found then raise exception '다른 본문의 문장이 섞여 있어요'; end if;
    else
      insert into public.passage_sentences (passage_id, ord, en, ko, pattern, chunks, points, blanks, alt, alt_note, key)
      values (pid, k, left(it->>'en', 400), left(coalesce(it->>'ko',''), 400), coalesce((it->>'pattern')::int, 0), coalesce(it->'chunks', '[]'::jsonb), coalesce(it->'points', '[]'::jsonb),
        coalesce((select array_agg(x) from jsonb_array_elements_text(it->'blanks') x), '{}'), left(coalesce(it->>'alt',''), 400), left(coalesce(it->>'alt_note',''), 80), coalesce((it->>'key')::boolean, true));
    end if;
  end loop;
  return pid;
end $$;

-- 원장님: 본문 하나를 처음부터 다시 학습시키기 (답안 기록은 남겨요)
create or replace function public.passage_reset(p_student uuid, p_passage uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  delete from public.passage_progress where student_id = p_student and passage_id = p_passage;
  return jsonb_build_object('ok', true);
end $$;

do $$ declare f text; begin
  foreach f in array array['passage_open(uuid)', 'passage_submit(uuid,uuid,text,text,boolean,uuid)', 'passage_step_done(uuid,text,uuid,int)',
                           'passage_steps(uuid,text)', 'passage_sentence_in_step(uuid,text,text)', 'passage_my_steps()', 'passage_save(uuid,jsonb,jsonb)',
                           'passage_teacher_overview()', 'passage_reset(uuid,uuid)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
grant select, insert, update, delete on public.passages, public.passage_sentences, public.passage_assignments to authenticated;
grant select, delete on public.passage_progress, public.passage_answers, public.passage_srs to authenticated;

do $$ begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin alter publication supabase_realtime add table public.passage_answers; exception when others then null; end;
  end if;
end $$;

-- ============================================================
-- 문법 칸: "문장의 형식 (1~5형식)" 단원 (이미 있으면 건너뛰어요)
-- ============================================================
-- 심쿵영어 문법앱 · "문장의 형식 (1~5형식)" 단원 (12단계와 함께 실행). 이미 있으면 건너뛰어요.
-- 문제는 '검수 대기'로 들어가요. 원장님이 문항 관리에서 읽어 보고 승인하면 학생에게 보여요.
do $$ declare u uuid; begin
  if exists (select 1 from public.units where code = 'SK-PATTERNS') then raise notice '이미 있는 단원이에요'; return; end if;
  insert into public.units (code, title, school_book, lesson, status) values ('SK-PATTERNS', '문장의 형식 (1~5형식)', '심쿵문법 중등', '공통', 'published') returning id into u;
  perform public.ai_save_part(u, 'concepts', '[{"tag": "문장 성분", "title": "문장 성분: S · V · O · C · M", "body": {"summary": "영어 문장은 주어(S)와 동사(V)가 뼈대예요. 동사 뒤에 무엇이 오는지에 따라 문장의 형식이 정해져요.", "steps": ["① S 주어: 문장의 주인공 (~은/는/이/가)", "② V 동사: 주어의 동작·상태 (~하다/~이다)", "③ O 목적어: 동사의 대상 (~을/를), C 보어: 주어나 목적어를 보충 설명", "④ M 수식어: 빼도 문장이 되는 부분 (시간·장소·방법 등)"], "examples": [{"en": "Minji reads books in the library.", "ko": "민지는(S) 읽는다(V) 책을(O) / 도서관에서(M)"}, {"en": "The soup smells good.", "ko": "그 수프는(S) 냄새가 난다(V) 좋은(C)"}], "compare": [{"wrong": "in the library 를 목적어로 본다", "right": "in the library 는 수식어(M)", "note": "전치사로 시작하는 말은 대부분 수식어예요. 빼도 문장이 완성돼요."}], "tip": "형식을 찾을 땐 먼저 수식어(M)를 괄호로 묶어 지우고, 남은 뼈대만 봐요."}}, {"tag": "1형식·2형식", "title": "1형식 S+V · 2형식 S+V+C", "body": {"summary": "1형식은 동사만으로 뜻이 끝나요. 2형식은 동사 뒤에 주어를 설명하는 보어(C)가 꼭 와요. 주어 = 보어 관계예요.", "steps": ["① 1형식: The baby sleeps. (+ 수식어는 더 붙어도 1형식)", "② 2형식 동사: be, become, get / look, sound, smell, taste, feel", "③ 감각동사 뒤 보어는 형용사! (부사 ✗)", "④ look like + 명사 = 2형식 (like her mom 이 보어)"], "examples": [{"en": "The birds sing in the morning.", "ko": "새들이 아침에 노래한다. (1형식)"}, {"en": "My brother became a doctor.", "ko": "우리 형은 의사가 되었다. (2형식, my brother = a doctor)"}, {"en": "You look tired today.", "ko": "너 오늘 피곤해 보여. (2형식)"}], "compare": [{"wrong": "This cake tastes sweetly.", "right": "This cake tastes sweet.", "note": "감각동사(taste) 뒤에는 형용사 보어가 와요."}], "tip": "동사 뒤 말이 주어와 ''='' 관계면 2형식이에요."}}, {"tag": "3형식", "title": "3형식 S+V+O", "body": {"summary": "3형식은 동사 뒤에 ''~을/를''에 해당하는 목적어가 하나 와요.", "steps": ["① 목적어 자리에는 명사·대명사·to부정사·동명사·that절이 올 수 있어요", "② 주어 ≠ 목적어 (같은 사람이 아니에요)", "③ 목적어 뒤의 전치사구는 수식어(M)"], "examples": [{"en": "We planted some trees.", "ko": "우리는 나무를 몇 그루 심었다."}, {"en": "She decided to join the club.", "ko": "그녀는 동아리에 가입하기로 결심했다. (to join the club = 목적어)"}], "compare": [{"wrong": "He became a teacher. → 3형식", "right": "He became a teacher. → 2형식", "note": "he = a teacher 이므로 보어예요. 목적어는 주어와 같은 사람이 아니에요."}], "tip": "''~을/를''로 해석되고 주어와 다른 대상이면 목적어예요."}}, {"tag": "4형식", "title": "4형식 S+V+IO+DO (수여동사)", "body": {"summary": "4형식은 ''~에게(I.O) ~을(D.O)'' 두 목적어가 와요. give, send, show, tell, make, buy, ask 같은 수여동사가 쓰여요.", "steps": ["① 순서: 받는 사람(I.O) → 주는 것(D.O)", "② 3형식으로 바꾸면 D.O + 전치사 + I.O", "③ to: give, send, show, tell, teach, write", "④ for: make, buy, cook, get, find / of: ask"], "examples": [{"en": "Dad bought me a new bike.", "ko": "아빠가 나에게 새 자전거를 사 주셨다. → Dad bought a new bike for me."}, {"en": "She showed us her photos.", "ko": "그녀는 우리에게 사진을 보여 주었다. → She showed her photos to us."}], "compare": [{"wrong": "He made a kite to me.", "right": "He made a kite for me.", "note": "make는 3형식으로 바꿀 때 for를 써요."}], "tip": "4형식 → 3형식 전환은 내신 서술형 단골이에요. 동사별 전치사(to/for/of)를 꼭 외워요."}}, {"tag": "5형식", "title": "5형식 S+V+O+O.C", "body": {"summary": "5형식은 목적어 뒤에 목적어를 설명하는 목적격보어(O.C)가 와요. 목적어 = 목적격보어 관계예요.", "steps": ["① make/keep/find + O + 형용사·명사 (The news made me sad.)", "② want/ask/tell/allow + O + to부정사", "③ 사역동사 make/have/let + O + 동사원형", "④ 지각동사 see/hear/watch + O + 동사원형/-ing"], "examples": [{"en": "Exercise keeps you healthy.", "ko": "운동은 너를 건강하게 유지해 준다. (you = healthy)"}, {"en": "My mom let me go to the concert.", "ko": "엄마는 내가 콘서트에 가게 해 주셨다."}], "compare": [{"wrong": "He made a cake. / He made me happy. 둘 다 5형식", "right": "He made a cake.(3형식) / He made me happy.(5형식)", "note": "목적어 뒤에 목적어를 설명하는 말이 있어야 5형식이에요."}, {"wrong": "I want you go home.", "right": "I want you to go home.", "note": "want의 목적격보어는 to부정사예요."}], "tip": "목적어 뒤의 말이 ''목적어가 ~하다/~이다''로 해석되면 5형식이에요."}}]'::jsonb);
  perform public.ai_save_part(u, 'concept', '[{"concept_tag": "문장 성분", "qtype": "mc", "prompt": "다음 문장에서 주어(S)는? \n\"The little boy ran to his mother.\"", "ko": "", "choices": ["The little boy", "ran", "to his mother", "his mother"], "answers": ["The little boy"], "hint": "누가 달렸는지 찾아봐요.", "explanation": "달린 사람은 The little boy 예요. to his mother 는 수식어(M)예요.", "wrong_notes": {}}, {"concept_tag": "문장 성분", "qtype": "mc", "prompt": "밑줄 친 부분의 성분은? \n\"She sings beautifully.\" → beautifully", "ko": "", "choices": ["S", "V", "O", "M"], "answers": ["M"], "hint": "빼도 문장이 될까요?", "explanation": "beautifully 는 노래하는 방법을 꾸미는 부사라 수식어(M)예요. She sings. 만으로 문장이 돼요.", "wrong_notes": {}}, {"concept_tag": "1형식·2형식", "qtype": "mc", "prompt": "\"My sister is a nurse.\" 는 몇 형식일까요?", "ko": "", "choices": ["1형식", "2형식", "3형식", "4형식", "5형식"], "answers": ["2형식"], "hint": "my sister 와 a nurse 의 관계를 생각해 봐요.", "explanation": "my sister = a nurse 이므로 a nurse 는 보어(C)예요. S+V+C 2형식이에요.", "wrong_notes": {}}, {"concept_tag": "3형식", "qtype": "mc", "prompt": "\"Tom likes pizza.\" 는 몇 형식일까요?", "ko": "", "choices": ["1형식", "2형식", "3형식", "4형식", "5형식"], "answers": ["3형식"], "hint": "''~을/를''로 해석되는 말이 있나요?", "explanation": "pizza 는 좋아하는 대상, 목적어예요. S+V+O 3형식이에요.", "wrong_notes": {}}, {"concept_tag": "4형식", "qtype": "mc", "prompt": "\"I gave my friend a present.\" 에서 간접목적어(I.O)는?", "ko": "", "choices": ["I", "gave", "my friend", "a present"], "answers": ["my friend"], "hint": "''~에게''에 해당하는 말이에요.", "explanation": "받는 사람 my friend 가 간접목적어, a present 가 직접목적어예요.", "wrong_notes": {}}]'::jsonb);
  perform public.ai_save_part(u, 'basic', '[{"concept_tag": "1형식·2형식", "qtype": "mc", "prompt": "\"The sun rises in the east.\" 는 몇 형식일까요?", "ko": "", "choices": ["1형식", "2형식", "3형식", "4형식", "5형식"], "answers": ["1형식"], "hint": "in the east 를 괄호로 묶어 보세요.", "explanation": "in the east 는 수식어예요. The sun rises. 만 남으니 1형식이에요.", "wrong_notes": {}}, {"concept_tag": "1형식·2형식", "qtype": "mc", "prompt": "빈칸에 알맞은 말은? \"This blanket feels ___.\"", "ko": "", "choices": ["soft", "softly", "softness", "to soften"], "answers": ["soft"], "hint": "feel 은 감각동사예요.", "explanation": "감각동사 feel 뒤에는 형용사 보어 soft 가 와요.", "wrong_notes": {}}, {"concept_tag": "4형식", "qtype": "fill", "prompt": "4형식 → 3형식: She sent me a letter. = She sent a letter ___ me.", "ko": "빈칸에 알맞은 전치사를 쓰세요.", "answers": ["to"], "hint": "send 는 to / for / of 중 무엇과 쓰일까요?", "explanation": "send 는 3형식으로 바꿀 때 to 를 써요."}, {"concept_tag": "4형식", "qtype": "fill", "prompt": "4형식 → 3형식: My uncle bought us ice cream. = My uncle bought ice cream ___ us.", "ko": "빈칸에 알맞은 전치사를 쓰세요.", "answers": ["for"], "hint": "buy 는 ''~을 위해'' 사 주는 거예요.", "explanation": "buy 는 3형식으로 바꿀 때 for 를 써요."}, {"concept_tag": "5형식", "qtype": "mc", "prompt": "\"The movie made me sad.\" 는 몇 형식일까요?", "ko": "", "choices": ["1형식", "2형식", "3형식", "4형식", "5형식"], "answers": ["5형식"], "hint": "me 와 sad 의 관계를 생각해 봐요.", "explanation": "me = sad (내가 슬프다) 관계예요. 목적어 + 목적격보어, 5형식이에요.", "wrong_notes": {}}]'::jsonb);
  perform public.ai_save_part(u, 'mid', '[{"concept_tag": "1형식·2형식", "qtype": "mc", "prompt": "어법상 틀린 문장은?", "ko": "", "choices": ["You look happy today.", "The music sounds great.", "This milk smells badly.", "She became a singer."], "answers": ["This milk smells badly."], "hint": "감각동사 뒤 보어 자리를 보세요.", "explanation": "smell 뒤에는 형용사 bad 가 와야 해요. badly 는 부사라 보어가 될 수 없어요.", "wrong_notes": {"You look happy today.": "look + 형용사 happy, 맞는 문장이에요.", "The music sounds great.": "sound + 형용사 great, 맞는 문장이에요.", "She became a singer.": "become + 명사 보어, 맞는 문장이에요."}}, {"concept_tag": "3형식", "qtype": "mc", "prompt": "형식이 나머지와 다른 하나는?", "ko": "", "choices": ["He made a cake.", "She wrote a letter.", "They made him captain.", "I found my key."], "answers": ["They made him captain."], "hint": "목적어 뒤에 목적어를 설명하는 말이 있나요?", "explanation": "him = captain 관계라 5형식이에요. 나머지는 모두 3형식이에요.", "wrong_notes": {}}, {"concept_tag": "4형식", "qtype": "mc", "prompt": "4형식을 3형식으로 바꿀 때 of 를 쓰는 동사는?", "ko": "", "choices": ["give", "make", "ask", "show"], "answers": ["ask"], "hint": "질문을 ''~에게서'' 묻는 동사예요.", "explanation": "ask 는 ask a question of him 처럼 of 를 써요.", "wrong_notes": {"give": "give 는 to 를 써요.", "make": "make 는 for 를 써요.", "show": "show 는 to 를 써요."}}, {"concept_tag": "5형식", "qtype": "fill", "prompt": "빈칸에 알맞은 말을 쓰세요. \"My teacher told us ___ quiet.\" (be)", "ko": "( ) 안의 단어를 알맞은 형태로 쓰세요.", "answers": ["to be"], "hint": "tell + 목적어 + ___", "explanation": "tell 의 목적격보어는 to부정사예요."}, {"concept_tag": "5형식", "qtype": "fill", "prompt": "빈칸에 알맞은 말을 쓰세요. \"Mom made me ___ my room.\" (clean)", "ko": "( ) 안의 단어를 알맞은 형태로 쓰세요.", "answers": ["clean"], "hint": "make 가 ''시키다''라는 뜻일 때를 떠올려요.", "explanation": "사역동사 make 의 목적격보어는 동사원형이에요."}]'::jsonb);
  perform public.ai_save_part(u, 'adv', '[{"concept_tag": "1형식·2형식", "qtype": "mc", "prompt": "\"There are many books on the shelf.\" 는 몇 형식일까요?", "ko": "", "choices": ["1형식", "2형식", "3형식", "4형식", "5형식"], "answers": ["1형식"], "hint": "There 는 주어가 아니에요.", "explanation": "There is/are 문장은 1형식이에요. 주어는 many books, on the shelf 는 수식어예요.", "wrong_notes": {}}, {"concept_tag": "1형식·2형식", "qtype": "mc", "prompt": "\"She looks like her father.\" 는 몇 형식일까요?", "ko": "", "choices": ["1형식", "2형식", "3형식", "4형식", "5형식"], "answers": ["2형식"], "hint": "look 은 감각동사예요.", "explanation": "look like + 명사는 2형식으로 봐요. like her father 가 보어예요.", "wrong_notes": {}}, {"concept_tag": "5형식", "qtype": "mc", "prompt": "어법상 바른 문장은?", "ko": "", "choices": ["I heard someone to call my name.", "She let me using her phone.", "I saw him cross the street.", "He wants me go there."], "answers": ["I saw him cross the street."], "hint": "지각동사·사역동사·want 의 목적격보어 형태를 떠올려요.", "explanation": "지각동사 see 는 목적격보어로 동사원형(cross)이나 -ing 를 써요.", "wrong_notes": {"I heard someone to call my name.": "hear 는 동사원형/-ing 를 써요 (call / calling).", "She let me using her phone.": "let 은 동사원형을 써요 (use).", "He wants me go there.": "want 는 to부정사를 써요 (to go)."}}, {"concept_tag": "4형식", "qtype": "mc", "prompt": "두 문장의 뜻이 같도록 할 때 빈칸에 들어갈 말이 나머지와 다른 것은?", "ko": "", "choices": ["She told the story ___ us.", "He showed the map ___ me.", "Dad cooked dinner ___ us.", "I lent my pen ___ him."], "answers": ["Dad cooked dinner ___ us."], "hint": "동사마다 쓰는 전치사가 달라요.", "explanation": "cook 은 for, 나머지 tell·show·lend 는 to 를 써요.", "wrong_notes": {}}, {"concept_tag": "3형식", "qtype": "mc", "prompt": "밑줄 친 that절의 성분은? \"I think that he is honest.\" → that he is honest", "ko": "", "choices": ["S", "O", "C", "M"], "answers": ["O"], "hint": "무엇을 생각하는지 찾아봐요.", "explanation": "생각하는 내용, 즉 think 의 목적어예요. 이 문장은 3형식이에요.", "wrong_notes": {}}]'::jsonb);
  perform public.ai_save_part(u, 'writing', '[{"concept_tag": "4형식", "qtype": "write", "prompt": "다음 문장을 3형식으로 바꿔 쓰세요.", "ko": "My grandmother made me a sweater.", "answers": ["My grandmother made a sweater for me."], "hint": "make 는 3형식에서 for 를 써요.", "explanation": "D.O(a sweater) + for + I.O(me) 순서로 써요.", "rubric": "for 를 쓰고 직접목적어 → for me 순서면 정답"}, {"concept_tag": "4형식", "qtype": "write", "prompt": "다음 문장을 4형식으로 바꿔 쓰세요.", "ko": "Jisu showed her drawing to the class.", "answers": ["Jisu showed the class her drawing."], "hint": "받는 사람을 동사 바로 뒤로 옮겨요.", "explanation": "4형식은 S + V + I.O + D.O 순서예요.", "rubric": "the class 가 동사 뒤, her drawing 이 마지막이면 정답"}, {"concept_tag": "5형식", "qtype": "write", "prompt": "주어진 단어를 배열해 문장을 완성하세요. (우리말: 그 소식은 우리를 행복하게 만들었다.)", "ko": "the news / happy / us / made", "answers": ["The news made us happy."], "hint": "make + 목적어 + 형용사", "explanation": "5형식: S(The news) + V(made) + O(us) + O.C(happy)", "rubric": "어순이 정확하면 정답"}, {"concept_tag": "5형식", "qtype": "write", "prompt": "주어진 단어를 활용해 영작하세요. (우리말: 선생님은 우리에게 일찍 오라고 말씀하셨다.) [tell, come, early]", "ko": "조건: tell 을 과거형으로, 5형식으로 쓸 것", "answers": ["The teacher told us to come early.", "Our teacher told us to come early.", "My teacher told us to come early."], "hint": "tell + 목적어 + to부정사", "explanation": "tell 의 목적격보어는 to부정사예요.", "rubric": "told us to come early 가 들어가면 정답"}, {"concept_tag": "1형식·2형식", "qtype": "write", "prompt": "틀린 곳을 고쳐 문장 전체를 다시 쓰세요.", "ko": "The flowers smell sweetly.", "answers": ["The flowers smell sweet."], "hint": "감각동사 뒤 보어 자리를 보세요.", "explanation": "smell 뒤에는 형용사 sweet 를 써요.", "rubric": "sweetly → sweet 로 고치면 정답"}]'::jsonb);
  perform public.ai_save_part(u, 'exam', '[{"concept_tag": "문장 성분", "qtype": "mc", "prompt": "밑줄 친 부분의 성분이 나머지와 다른 하나는?", "ko": "", "choices": ["I met him (at the park).", "She lives (in Busan).", "He is (a pilot).", "We swam (in the river)."], "answers": ["He is (a pilot)."], "hint": "괄호 부분을 빼도 문장이 될까요?", "explanation": "a pilot 은 보어(C)예요. 나머지 괄호는 모두 수식어(M)예요.", "wrong_notes": {}}, {"concept_tag": "1형식·2형식", "qtype": "mc", "prompt": "빈칸에 들어갈 수 없는 말은? \"The plan sounds ___.\"", "ko": "", "choices": ["interesting", "great", "perfectly", "good"], "answers": ["perfectly"], "hint": "sound 는 감각동사예요.", "explanation": "감각동사 뒤에는 형용사가 와요. perfectly 는 부사라 쓸 수 없어요.", "wrong_notes": {}}, {"concept_tag": "4형식", "qtype": "mc", "prompt": "두 문장의 뜻이 같도록 빈칸에 알맞은 말은? \"Can I ask you a favor?\" = \"Can I ask a favor ___ you?\"", "ko": "", "choices": ["to", "for", "of", "with"], "answers": ["of"], "hint": "ask 는 특별한 전치사를 써요.", "explanation": "ask 는 3형식에서 of 를 써요.", "wrong_notes": {}}, {"concept_tag": "5형식", "qtype": "mc", "prompt": "어법상 틀린 것은?", "ko": "", "choices": ["The coach made us run fast.", "I want you to be happy.", "She kept the door open.", "They asked me join them."], "answers": ["They asked me join them."], "hint": "ask + 목적어 + ___", "explanation": "ask 의 목적격보어는 to부정사예요. → asked me to join them", "wrong_notes": {}}, {"concept_tag": "3형식", "qtype": "mc", "prompt": "다음 중 3형식 문장은?", "ko": "", "choices": ["He arrived late.", "She looks young.", "I enjoy reading books.", "They called him Max."], "answers": ["I enjoy reading books."], "hint": "목적어가 하나만 있는 문장이에요.", "explanation": "reading books 는 enjoy 의 목적어(동명사)예요. 3형식이에요.", "wrong_notes": {}}, {"concept_tag": "5형식", "qtype": "mc", "prompt": "\"We call our dog Coco.\" 의 형식과 같은 것은?", "ko": "", "choices": ["I sent him an email.", "She found the book easy.", "He runs every morning.", "The room is clean."], "answers": ["She found the book easy."], "hint": "목적어 = 목적격보어 관계를 찾아요.", "explanation": "our dog = Coco, the book = easy. 둘 다 5형식이에요.", "wrong_notes": {}}, {"concept_tag": "4형식", "qtype": "fill", "prompt": "4형식 → 3형식: Please pass me the salt. = Please pass the salt ___ me.", "ko": "빈칸에 알맞은 전치사를 쓰세요.", "answers": ["to"], "hint": "pass 는 건네주는 동사예요.", "explanation": "pass 는 give 처럼 to 를 써요."}, {"concept_tag": "5형식", "qtype": "fill", "prompt": "빈칸에 알맞은 말을 쓰세요. \"I heard the baby ___.\" (cry) — 동사원형으로", "ko": "( ) 안의 단어를 지시에 맞게 쓰세요.", "answers": ["cry"], "hint": "지각동사 hear + 목적어 + ?", "explanation": "지각동사 hear 의 목적격보어로 동사원형 cry 를 써요. (crying 도 가능하지만 이 문제는 동사원형)"}]'::jsonb);
end $$;
