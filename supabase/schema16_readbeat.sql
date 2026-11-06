-- ============================================================
-- 스텔라의 심쿵영어 · 16단계: READ & BEAT (리딩 리듬게임) — 교재 본문은 로그인한 사람만 볼 수 있게 저장
-- Supabase 대시보드 > SQL Editor 에 통째로 붙여넣고 Run 하세요. 여러 번 실행해도 안전해요.
-- ============================================================

-- 곡(교재 본문)은 공개 파일이 아니라 이 표에 들어가요. 로그인하지 않으면 읽을 수 없어요.
create table if not exists public.readbeat_levels (
  id text primary key,
  name text not null,
  ord int not null default 0,
  units jsonb not null default '[]'::jsonb
);
alter table public.readbeat_levels enable row level security;
drop policy if exists p_rbl_sel on public.readbeat_levels;
create policy p_rbl_sel on public.readbeat_levels for select to authenticated using (true);
drop policy if exists p_rbl_all on public.readbeat_levels;
create policy p_rbl_all on public.readbeat_levels for all to authenticated using (public.is_teacher()) with check (public.is_teacher());
revoke all on public.readbeat_levels from anon;
grant select, insert, update, delete on public.readbeat_levels to authenticated;

-- 학생이 한 판 끝낼 때마다 점수를 남겨요
create table if not exists public.readbeat_runs (
  run_id uuid primary key,
  student_id uuid not null references public.profiles(id) on delete cascade,
  level_id text not null,
  unit int not null,
  score int not null default 0,
  combo int not null default 0,
  stage int not null default 1,
  at timestamptz not null default now()
);
create index if not exists readbeat_runs_stu_idx on public.readbeat_runs (student_id, level_id, unit);
alter table public.readbeat_runs enable row level security;
drop policy if exists p_rbr_sel on public.readbeat_runs;
create policy p_rbr_sel on public.readbeat_runs for select to authenticated using (student_id = auth.uid() or public.is_teacher());
drop policy if exists p_rbr_del on public.readbeat_runs;
create policy p_rbr_del on public.readbeat_runs for delete to authenticated using (public.is_teacher());
revoke all on public.readbeat_runs from anon;
grant select, delete on public.readbeat_runs to authenticated;
revoke insert, update on public.readbeat_runs from authenticated;

create or replace function public.readbeat_submit(p_run uuid, p_level text, p_unit int, p_score int, p_combo int, p_stage int)
returns jsonb language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); best int;
begin
  if me is null then raise exception 'not_logged_in'; end if;
  if p_run is null or coalesce(p_level, '') = '' or not exists (select 1 from public.readbeat_levels where id = p_level) then raise exception 'bad_answer'; end if;
  insert into public.readbeat_runs (run_id, student_id, level_id, unit, score, combo, stage)
  values (p_run, me, p_level, least(greatest(coalesce(p_unit, 0), 0), 99), least(greatest(coalesce(p_score, 0), 0), 300000),
          least(greatest(coalesce(p_combo, 0), 0), 999), least(greatest(coalesce(p_stage, 1), 1), 4))
  on conflict (run_id) do update set
    score = greatest(public.readbeat_runs.score, excluded.score), combo = greatest(public.readbeat_runs.combo, excluded.combo),
    stage = greatest(public.readbeat_runs.stage, excluded.stage), at = now()
  where public.readbeat_runs.student_id = me;
  select max(score) into best from public.readbeat_runs where student_id = me and level_id = p_level and unit = p_unit;
  return jsonb_build_object('ok', true, 'best', coalesce(best, 0));
end $$;
revoke all on function public.readbeat_submit(uuid, text, int, int, int, int) from public, anon;
grant execute on function public.readbeat_submit(uuid, text, int, int, int, int) to authenticated;
