-- ============================================================
-- 스텔라의 심쿵영어 · 13단계: 어휘 게임 · 철자 사다리 · AI 자동 단어장
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요. (schema11_vocab.sql 다음)
-- 여러 번 실행해도 안전해요. 지금까지의 학습 기록은 그대로예요.
-- ============================================================

-- ---------- 1. 단어에 철자·연상 칸 추가 ----------
alter table public.vocab_items add column if not exists syllables text not null default '';      -- 소리 덩어리: beau·ti·ful
alter table public.vocab_items add column if not exists tricky text[] not null default '{}';      -- 헷갈리는 글자: {k} (knife), {ea}
alter table public.vocab_items add column if not exists spell_note text not null default '';     -- 철자 요령: k는 소리가 안 나요
alter table public.vocab_items add column if not exists mnemonic text not null default '';       -- 연상: 소리·그림으로 외우는 한 줄
alter table public.vocab_items add column if not exists derivs jsonb not null default '[]'::jsonb; -- 파생어 [{"w":"decision","pos":"n.","ko":"결정"}]
alter table public.vocab_items add column if not exists root_note text not null default '';      -- 어근·접사: de(아래로)+cide(자르다)
-- AI가 만들고 검수한 기록 (원장님만 봐요)
create table if not exists public.vocab_book_ai_log (
  book_id uuid primary key references public.vocab_books(id) on delete cascade,
  log jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.vocab_book_ai_log enable row level security;
drop policy if exists p_vbal_all on public.vocab_book_ai_log;
create policy p_vbal_all on public.vocab_book_ai_log for all using (public.is_teacher()) with check (public.is_teacher());
grant select, insert, update, delete on public.vocab_book_ai_log to authenticated;

-- ---------- 2. 게임 프로필 · 기록 ----------
create table if not exists public.vocab_game_profile (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  theme text check (theme in ('pet','monster')),            -- 초등: 펫 키우기 / 몬스터 배틀
  pet text not null default 'dog',
  pet_name text not null default '',
  mode_override text check (mode_override in ('kid','teen')), -- 원장님이 정하면 학년보다 먼저 적용
  updated_at timestamptz not null default now()
);

create table if not exists public.vocab_game_log (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null unique,
  student_id uuid not null references public.profiles(id) on delete cascade,
  item_id uuid not null references public.vocab_items(id) on delete cascade,
  game text not null,
  run_id uuid,
  answer text not null,
  expected text not null default '',
  is_correct boolean not null,
  xp int not null default 0,
  day date not null,
  submitted_at timestamptz not null default now()
);
create index if not exists vocab_game_log_stu_idx on public.vocab_game_log (student_id, day);
create index if not exists vocab_game_log_run_idx on public.vocab_game_log (run_id);

create table if not exists public.vocab_game_runs (
  run_id uuid primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  game text not null,
  score int not null default 0,
  total int not null default 0,
  ms int not null default 0,
  won boolean not null default false,
  at timestamptz not null default now()
);
create index if not exists vocab_game_runs_stu_idx on public.vocab_game_runs (student_id, game);

alter table public.vocab_game_profile enable row level security;
alter table public.vocab_game_log     enable row level security;
alter table public.vocab_game_runs    enable row level security;
do $$ declare t text; begin
  foreach t in array array['vocab_game_profile','vocab_game_log','vocab_game_runs'] loop
    execute format('drop policy if exists p_%s_sel on public.%I', t, t);
    execute format('create policy p_%s_sel on public.%I for select using (student_id = auth.uid() or public.is_teacher())', t, t);
    execute format('drop policy if exists p_%s_del on public.%I', t, t);
    execute format('create policy p_%s_del on public.%I for delete using (public.is_teacher())', t, t);
  end loop;
end $$;
grant select, delete on public.vocab_game_profile, public.vocab_game_log, public.vocab_game_runs to authenticated;
revoke insert, update on public.vocab_game_profile, public.vocab_game_log, public.vocab_game_runs from authenticated;

insert into public.app_settings (key, value) values ('vocab_game', '{"league": false, "daily_xp_cap": 400}'::jsonb)
on conflict (key) do nothing;

-- ---------- 3. 공통 함수 ----------
-- 게임 하나의 점수 무게: 스스로 떠올려 쓰는 게임일수록 커요. 고르기는 작아요.
create or replace function public.vocab_game_weight(g text) returns int language sql immutable as $$
  select case g when 'balloon' then 1 when 'tiles' then 2 when 'fade' then 3 when 'lcwc' then 4 when 'battle' then 4
                when 'chain' then 4 when 'timeattack' then 3 when 'dictation' then 5 when 'boss' then 5 else 0 end;
$$;
create or replace function public.vocab_game_mode(p_student uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select mode_override from public.vocab_game_profile where student_id = p_student),
                  case when (select grade from public.profiles where id = p_student) like '초%' then 'kid' else 'teen' end);
$$;
-- 오늘 복습해야 할 단어 수 (공개·배정된 단어장만)
create or replace function public.vocab_due_count(p_student uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from public.vocab_srs s
    join public.vocab_items i on i.id = s.item_id join public.vocab_units u on u.id = i.unit_id
    join public.vocab_books b on b.id = u.book_id and b.status = 'published'
    join public.vocab_assignments a on a.book_id = b.id and a.student_id = s.student_id
   where s.student_id = p_student and s.due_on <= public.vocab_kst_today();
$$;
-- 게임이 열리는 조건: 오늘 복습을 다 했거나, 오늘 30개 이상 복습했어요. 외운 단어가 있어야 해요.
create or replace function public.vocab_games_open(p_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.vocab_srs where student_id = p_student)
     and (public.vocab_due_count(p_student) = 0
          or coalesce((select n from public.vocab_review_log where student_id = p_student and day = public.vocab_kst_today()), 0) >= 30);
$$;
-- 경험치: 스스로 떠올려 맞힌 것만 세요. (같은 날 같은 단어·같은 단계는 한 번만)
create or replace function public.vocab_xp(p_student uuid, p_from date default null, p_to date default null)
returns int language sql stable security definer set search_path = public as $$
  with ans as (
    select distinct item_id, step, dir, (submitted_at at time zone 'Asia/Seoul')::date as d
      from public.vocab_answers where student_id = p_student and is_correct
  ), f as (select * from ans where (p_from is null or d >= p_from) and (p_to is null or d <= p_to))
  select (coalesce((select sum(case when step in ('write','test','review') and dir = 'en' then 3 else 1 end) from f), 0)
        + coalesce((select sum(xp) from public.vocab_game_log where student_id = p_student
                     and (p_from is null or day >= p_from) and (p_to is null or day <= p_to)), 0)
        + 10 * (select count(*) from public.vocab_unit_status where student_id = p_student and passed_at is not null
                 and (p_from is null or (passed_at at time zone 'Asia/Seoul')::date >= p_from)
                 and (p_to is null or (passed_at at time zone 'Asia/Seoul')::date <= p_to)))::int;
$$;
create or replace function public.vocab_mask_name(n text) returns text language sql immutable as $$
  select case when char_length(coalesce(n,'')) <= 1 then coalesce(n,'')
              when char_length(n) = 2 then left(n,1) || '*'
              else left(n,1) || repeat('*', char_length(n) - 2) || right(n,1) end;
$$;

-- ---------- 4. 학생 함수 ----------
-- 게임 답 하나: 채점은 서버가 해요. 경험치는 하루에 단어·게임마다 처음 맞혔을 때만 받아요.
create or replace function public.vocab_game_submit(
  p_client uuid, p_item uuid, p_game text, p_answer text, p_run uuid default null, p_deriv int default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid(); it public.vocab_items%rowtype; today date := public.vocab_kst_today();
  a text := public.vocab_norm(p_answer); target text; ok boolean; gain int := 0; cap int; got_today int; prev public.vocab_game_log%rowtype;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if public.vocab_game_weight(p_game) = 0 then raise exception 'bad_step'; end if;
  if char_length(coalesce(p_answer,'')) > 200 then raise exception 'bad_answer'; end if;
  perform pg_advisory_xact_lock(hashtext('vgame:' || me::text));   -- 같은 학생의 동시 제출을 한 줄로 세워요
  select * into prev from public.vocab_game_log where client_id = p_client and student_id = me;
  if found then return jsonb_build_object('is_correct', prev.is_correct, 'xp', prev.xp, 'expected', prev.expected, 'dup', true); end if;
  select * into it from public.vocab_items where id = p_item;
  if not found or not public.vocab_unit_open(it.unit_id) then raise exception 'no_assignment'; end if;
  if not exists (select 1 from public.vocab_srs where student_id = me and item_id = it.id)
     and not exists (select 1 from public.vocab_progress where student_id = me and unit_id = it.unit_id) then raise exception 'not_learned'; end if;
  if not public.vocab_games_open(me) then raise exception 'review_first'; end if;
  if a = '' then raise exception 'empty_answer'; end if;
  if p_game = 'chain' then
    if p_deriv is null or p_deriv < 0 or p_deriv >= jsonb_array_length(it.derivs) then raise exception 'bad_answer'; end if;
    target := it.derivs -> p_deriv ->> 'w';
    if coalesce(target, '') = '' then raise exception 'bad_answer'; end if;
    ok := public.vocab_norm(target) = a;
  else
    target := it.word;
    ok := public.vocab_norm(it.word) = a or exists (select 1 from unnest(it.alt_answers) x where public.vocab_norm(x) = a);
  end if;
  -- 경험치는 그날 그 게임에서 처음 답한 것이 정답일 때만 (틀려서 정답을 본 뒤 다시 맞힌 것은 연습이에요)
  if ok and not exists (select 1 from public.vocab_game_log where student_id = me and item_id = it.id and game = p_game and day = today) then
    select coalesce(((value->>'daily_xp_cap')::int), 400) into cap from public.app_settings where key = 'vocab_game';
    select coalesce(sum(xp), 0) into got_today from public.vocab_game_log where student_id = me and day = today;
    gain := greatest(0, least(public.vocab_game_weight(p_game), coalesce(cap, 400) - got_today));
  end if;
  insert into public.vocab_game_log (client_id, student_id, item_id, game, run_id, answer, expected, is_correct, xp, day)
  values (p_client, me, it.id, p_game, p_run, left(p_answer, 200), coalesce(target, ''), ok, gain, today);
  return jsonb_build_object('is_correct', ok, 'xp', gain, 'expected', coalesce(target, ''));
end $$;

-- 게임 한 판 마치기: 점수는 저장된 답으로 서버가 세요. 같은 판은 한 번만 기록돼요.
create or replace function public.vocab_game_finish(p_run uuid, p_game text, p_ms int default 0)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); sc int; tot int; cnt int; best int; r public.vocab_game_runs%rowtype; w boolean;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if public.vocab_game_weight(p_game) = 0 then raise exception 'bad_step'; end if;
  select * into r from public.vocab_game_runs where run_id = p_run;
  if found then
    if r.student_id <> me then raise exception 'forbidden'; end if;
    raise exception 'dup_run';
  end if;
  if p_game = 'timeattack' then
    -- 60초 게임: 첫 답부터 65초 안의 답만, 최대 120개까지 세요
    select least(count(*) filter (where is_correct), 120), count(*) into sc, tot from public.vocab_game_log l
     where run_id = p_run and student_id = me and game = p_game
       and submitted_at <= (select min(submitted_at) from public.vocab_game_log where run_id = p_run and student_id = me) + interval '65 seconds';
    cnt := 0;
  else
    -- 다른 게임: 맞힌 단어 수(같은 단어를 여러 번 맞혀도 하나), 전체는 낸 답 수
    select count(distinct item_id) filter (where is_correct), count(*) into sc, tot from public.vocab_game_log
     where run_id = p_run and student_id = me and game = p_game;
    cnt := sc;
  end if;
  if tot = 0 then return jsonb_build_object('ok', false, 'score', 0, 'total', 0); end if;
  select coalesce(max(score), 0) into best from public.vocab_game_runs where student_id = me and game = p_game;
  -- 이긴 판: 서로 다른 단어 5개 이상을 맞히고, 낸 답의 70% 이상이 정답
  w := p_game <> 'timeattack' and cnt >= 5 and (select count(*) filter (where is_correct) from public.vocab_game_log where run_id = p_run and student_id = me and game = p_game) * 10 >= tot * 7;
  insert into public.vocab_game_runs (run_id, student_id, game, score, total, ms, won)
  values (p_run, me, p_game, sc, tot, least(greatest(coalesce(p_ms, 0), 0), 600000), w);
  return jsonb_build_object('ok', true, 'score', sc, 'total', tot, 'won', w, 'best', greatest(best, sc), 'record', sc > best);
end $$;

-- 내 게임 상태 (홈 화면용)
create or replace function public.vocab_game_state()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); today date := public.vocab_kst_today(); wk date; pr public.vocab_game_profile%rowtype; last_d date; rev_n int;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  wk := date_trunc('week', today::timestamp)::date;
  select * into pr from public.vocab_game_profile where student_id = me;
  select max(d) into last_d from (
    select day as d from public.vocab_review_log where student_id = me
    union all select max((submitted_at at time zone 'Asia/Seoul')::date) from public.vocab_answers where student_id = me
    union all select max(day) from public.vocab_game_log where student_id = me) x;
  select coalesce(n, 0) into rev_n from public.vocab_review_log where student_id = me and day = today;
  return jsonb_build_object(
    'mode', public.vocab_game_mode(me), 'theme', pr.theme, 'pet', coalesce(pr.pet, 'dog'), 'pet_name', coalesce(pr.pet_name, ''),
    'xp', public.vocab_xp(me), 'today_xp', public.vocab_xp(me, today, today),
    'week_xp', public.vocab_xp(me, wk, today), 'last_week_xp', public.vocab_xp(me, wk - 7, wk - 1),
    'due', public.vocab_due_count(me), 'review_today', coalesce(rev_n, 0),
    'open', public.vocab_games_open(me), 'learned', (select count(*) from public.vocab_srs where student_id = me),
    'last_day', last_d, 'today', today,
    'wins', (select count(*) from public.vocab_game_runs where student_id = me and won and game in ('battle','boss')),
    'best', coalesce((select jsonb_object_agg(game, b) from (select game, max(score) b from public.vocab_game_runs where student_id = me group by game) z), '{}'::jsonb),
    'league', coalesce((select (value->>'league')::boolean from public.app_settings where key = 'vocab_game'), false));
end $$;

-- 초등 테마·펫 고르기
create or replace function public.vocab_game_setup(p_theme text, p_pet text default 'dog', p_name text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if p_theme not in ('pet','monster') then raise exception 'bad_answer'; end if;
  if coalesce(p_pet,'dog') not in ('dog','cat','rabbit','panda','fox','penguin','hamster','chick') then raise exception 'bad_answer'; end if;
  insert into public.vocab_game_profile (student_id, theme, pet, pet_name, updated_at)
  values (me, p_theme, coalesce(p_pet,'dog'), left(btrim(regexp_replace(coalesce(p_name,''), '[<>]', '', 'g')), 12), now())
  on conflict (student_id) do update set theme = excluded.theme, pet = excluded.pet, pet_name = excluded.pet_name, updated_at = now();
  return jsonb_build_object('ok', true);
end $$;

-- 중등 이번 주 순위: 원장님이 켰을 때만, 이름 가운데는 가려요. 경험치는 이번 주 것만 (누구나 다시 시작해요)
create or replace function public.vocab_league()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid := auth.uid(); today date := public.vocab_kst_today(); wk date; on_ boolean;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  select coalesce((value->>'league')::boolean, false) into on_ from public.app_settings where key = 'vocab_game';
  if not coalesce(on_, false) or (not public.is_teacher() and public.vocab_game_mode(me) <> 'teen') then
    return jsonb_build_object('enabled', false);
  end if;
  wk := date_trunc('week', today::timestamp)::date;
  return jsonb_build_object('enabled', true, 'rows', coalesce((select jsonb_agg(x order by x.xp desc, x.name) from (
    select case when p.id = me or public.is_teacher() then p.name else public.vocab_mask_name(p.name) end as name,
           p.id = me as me, public.vocab_xp(p.id, wk, today) as xp
      from public.profiles p
     where p.role = 'student' and public.vocab_game_mode(p.id) = 'teen'
       and exists (select 1 from public.vocab_assignments a where a.student_id = p.id)) x), '[]'::jsonb));
end $$;

-- ---------- 5. 원장님 함수 ----------
create or replace function public.vocab_game_config_set(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  v := jsonb_build_object('league', coalesce((p->>'league')::boolean, false),
                          'daily_xp_cap', least(greatest(coalesce((p->>'daily_xp_cap')::int, 400), 50), 2000));
  insert into public.app_settings (key, value) values ('vocab_game', v)
  on conflict (key) do update set value = excluded.value;
  return v;
end $$;

create or replace function public.vocab_game_set_mode(p_student uuid, p_mode text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  if p_mode is not null and p_mode not in ('kid','teen') then raise exception 'bad_answer'; end if;
  insert into public.vocab_game_profile (student_id, mode_override) values (p_student, p_mode)
  on conflict (student_id) do update set mode_override = excluded.mode_override, updated_at = now();
  return jsonb_build_object('ok', true, 'mode', public.vocab_game_mode(p_student));
end $$;

-- 학생별 게임·꾸준함·성장 (이번 주 vs 지난주)
create or replace function public.vocab_game_teacher()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare today date := public.vocab_kst_today();
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  return jsonb_build_object('today', today,
    'config', coalesce((select value from public.app_settings where key = 'vocab_game'), '{}'::jsonb),
    'students', coalesce((select jsonb_agg(x) from (
    select p.id as student_id, public.vocab_game_mode(p.id) as mode, g.theme, g.pet, g.pet_name, g.mode_override,
      public.vocab_xp(p.id) as xp, public.vocab_xp(p.id, today - 6, today) as xp7, public.vocab_xp(p.id, today - 13, today - 7) as xp_prev7,
      (select count(distinct d) from (select (submitted_at at time zone 'Asia/Seoul')::date d from vocab_answers where student_id = p.id
          union all select day from vocab_game_log where student_id = p.id) z where d between today - 6 and today) as days7,
      (select count(distinct d) from (select (submitted_at at time zone 'Asia/Seoul')::date d from vocab_answers where student_id = p.id
          union all select day from vocab_game_log where student_id = p.id) z where d between today - 13 and today - 7) as days_prev7,
      (select count(*) from vocab_answers a where a.student_id = p.id and a.dir = 'en' and a.step in ('write','test','review') and (a.submitted_at at time zone 'Asia/Seoul')::date between today - 6 and today) as n7,
      (select count(*) filter (where is_correct) from vocab_answers a where a.student_id = p.id and a.dir = 'en' and a.step in ('write','test','review') and (a.submitted_at at time zone 'Asia/Seoul')::date between today - 6 and today) as ok7,
      (select count(*) from vocab_answers a where a.student_id = p.id and a.dir = 'en' and a.step in ('write','test','review') and (a.submitted_at at time zone 'Asia/Seoul')::date between today - 13 and today - 7) as n_prev7,
      (select count(*) filter (where is_correct) from vocab_answers a where a.student_id = p.id and a.dir = 'en' and a.step in ('write','test','review') and (a.submitted_at at time zone 'Asia/Seoul')::date between today - 13 and today - 7) as ok_prev7,
      (select count(*) from vocab_game_runs r where r.student_id = p.id and r.at > now() - interval '7 days') as runs7,
      (select max(score) from vocab_game_runs r where r.student_id = p.id and r.game = 'timeattack') as best_ta
    from profiles p left join vocab_game_profile g on g.student_id = p.id
    where p.role = 'student' and exists (select 1 from vocab_assignments a where a.student_id = p.id)
    order by p.name) x), '[]'::jsonb));
end $$;

-- 틀린 철자 모음 (영어로 쓴 답만). 화면에서 묵음·겹자음 같은 유형으로 나눠요.
create or replace function public.vocab_spell_errors(p_student uuid default null, p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  return coalesce((select jsonb_agg(x) from (
    select * from (
      select a.student_id, a.item_id, i.word, a.answer, a.submitted_at as at from public.vocab_answers a join public.vocab_items i on i.id = a.item_id
       where not a.is_correct and a.dir = 'en' and a.step in ('write','test','review')
         and a.submitted_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
         and (p_student is null or a.student_id = p_student)
      union all
      select l.student_id, l.item_id, l.expected as word, l.answer, l.submitted_at from public.vocab_game_log l
       where not l.is_correct and l.game in ('tiles','fade','lcwc','dictation','battle','timeattack','boss')
         and l.submitted_at > now() - make_interval(days => least(greatest(p_days, 1), 365))
         and (p_student is null or l.student_id = p_student)) u
    order by at desc limit 3000) x), '[]'::jsonb);
end $$;

-- AI가 만든 단어장 저장 (한 번에, 중간에 문제가 생기면 아무것도 저장되지 않아요)
create or replace function public.vocab_save_book(p_meta jsonb, p_units jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare bk uuid; u jsonb; it jsonb; uid uuid; uo int := 0; io int; n int := 0; kind_ text;
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  if jsonb_typeof(p_units) <> 'array' or jsonb_array_length(p_units) = 0 then raise exception '유닛이 비었어요'; end if;
  kind_ := case when p_meta->>'kind' = 'school' then 'school' else 'level' end;
  insert into public.vocab_books (title, kind, level, grade_band, school_grade, publisher, note, status)
  values (left(coalesce(nullif(btrim(p_meta->>'title'), ''), 'AI 단어장'), 120), kind_,
          left(coalesce(p_meta->>'level', ''), 4), left(coalesce(p_meta->>'grade_band', ''), 20),
          left(coalesce(p_meta->>'school_grade', ''), 10), left(coalesce(p_meta->>'publisher', ''), 60),
          left(coalesce(p_meta->>'note', ''), 500), case when p_meta->>'status' = 'published' then 'published' else 'draft' end)
  returning id into bk;
  if jsonb_typeof(p_meta->'ai_log') = 'object' then
    insert into public.vocab_book_ai_log (book_id, log) values (bk, p_meta->'ai_log');
  end if;
  for u in select * from jsonb_array_elements(p_units) loop
    uo := uo + 1; io := 0;
    insert into public.vocab_units (book_id, ord, title) values (bk, uo, left(coalesce(u->>'title', ''), 120)) returning id into uid;
    for it in select * from jsonb_array_elements(coalesce(u->'items', '[]'::jsonb)) loop
      if coalesce(btrim(it->>'word'), '') = '' or coalesce(btrim(it->>'meaning'), '') = '' then raise exception '영어나 뜻이 빈 단어가 있어요'; end if;
      io := io + 1; n := n + 1;
      if n > 3000 then raise exception '단어가 너무 많아요 (3000개까지)'; end if;
      insert into public.vocab_items (unit_id, ord, word, meaning, pos, phrase, phrase_ko, example, example_ko, alt_answers,
                                      syllables, tricky, spell_note, mnemonic, derivs, root_note)
      values (uid, io, left(btrim(it->>'word'), 80), left(btrim(it->>'meaning'), 120), left(coalesce(it->>'pos', ''), 12),
              left(coalesce(it->>'phrase', ''), 80), left(coalesce(it->>'phrase_ko', ''), 80),
              left(coalesce(it->>'example', ''), 300), left(coalesce(it->>'example_ko', ''), 300),
              coalesce((select array_agg(left(x, 80)) from jsonb_array_elements_text(case when jsonb_typeof(it->'alt_answers') = 'array' then it->'alt_answers' else '[]'::jsonb end) x where x is not null and btrim(x) <> ''), '{}'),
              left(coalesce(it->>'syllables', ''), 120),
              coalesce((select array_agg(left(x, 12)) from jsonb_array_elements_text(case when jsonb_typeof(it->'tricky') = 'array' then it->'tricky' else '[]'::jsonb end) x where x is not null and btrim(x) <> ''), '{}'),
              left(coalesce(it->>'spell_note', ''), 160), left(coalesce(it->>'mnemonic', ''), 200),
              case when jsonb_typeof(it->'derivs') = 'array' then it->'derivs' else '[]'::jsonb end,
              left(coalesce(it->>'root_note', ''), 160));
    end loop;
    if io = 0 then raise exception '단어가 없는 유닛이 있어요'; end if;
  end loop;
  return bk;
end $$;

-- 이미 있는 단어에 철자·연상·파생어 채우기 (주어진 칸만 바꿔요)
create or replace function public.vocab_enrich_save(p_items jsonb)
returns int language plpgsql security definer set search_path = public as $$
declare it jsonb; n int := 0;
begin
  if not public.is_teacher() then raise exception 'forbidden'; end if;
  for it in select * from jsonb_array_elements(coalesce(p_items, '[]'::jsonb)) loop
    update public.vocab_items set
      syllables = case when it ? 'syllables' then left(coalesce(it->>'syllables', ''), 120) else syllables end,
      tricky = case when jsonb_typeof(it->'tricky') = 'array' then coalesce((select array_agg(left(x, 12)) from jsonb_array_elements_text(it->'tricky') x where x is not null and btrim(x) <> ''), '{}') else tricky end,
      spell_note = case when it ? 'spell_note' then left(coalesce(it->>'spell_note', ''), 160) else spell_note end,
      mnemonic = case when it ? 'mnemonic' then left(coalesce(it->>'mnemonic', ''), 200) else mnemonic end,
      derivs = case when jsonb_typeof(it->'derivs') = 'array' then it->'derivs' else derivs end,
      root_note = case when it ? 'root_note' then left(coalesce(it->>'root_note', ''), 160) else root_note end,
      phrase = case when phrase = '' and phrase_ko = '' and coalesce(it->>'phrase', '') <> '' and coalesce(it->>'phrase_ko', '') <> '' then left(it->>'phrase', 80) else phrase end,
      phrase_ko = case when phrase = '' and phrase_ko = '' and coalesce(it->>'phrase', '') <> '' and coalesce(it->>'phrase_ko', '') <> '' then left(it->>'phrase_ko', 80) else phrase_ko end,
      example = case when example = '' and example_ko = '' and coalesce(it->>'example', '') <> '' and coalesce(it->>'example_ko', '') <> '' then left(it->>'example', 300) else example end,
      example_ko = case when example = '' and example_ko = '' and coalesce(it->>'example', '') <> '' and coalesce(it->>'example_ko', '') <> '' then left(it->>'example_ko', 300) else example_ko end
    where id = (it->>'id')::uuid;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;

do $$ declare f text; begin
  foreach f in array array[
    'vocab_game_submit(uuid,uuid,text,text,uuid,int)', 'vocab_game_finish(uuid,text,int)', 'vocab_game_state()',
    'vocab_game_setup(text,text,text)', 'vocab_league()', 'vocab_game_config_set(jsonb)', 'vocab_game_set_mode(uuid,text)',
    'vocab_game_teacher()', 'vocab_spell_errors(uuid,int)', 'vocab_save_book(jsonb,jsonb)', 'vocab_enrich_save(jsonb)'] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
  -- 내부 계산용 함수는 다른 학생 정보를 볼 수 없게 직접 부르지 못하게 해요
  foreach f in array array['vocab_xp(uuid,date,date)', 'vocab_due_count(uuid)', 'vocab_games_open(uuid)', 'vocab_game_mode(uuid)'] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;
