-- =============================================================================
-- Ritual — core schema, constraints and Row Level Security
-- Safe to run once on a fresh Supabase project (SQL editor or `supabase db push`).
-- Every table that holds personal data has RLS enabled and is scoped to
-- auth.uid(). Shared reference data (the exercise library and starter
-- templates) is stored with user_id = NULL and is read-only for everyone.
-- =============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- A weekday set is a non-empty subset of 0..6 (0 = Sunday, like JS Date#getDay).
create or replace function public.is_valid_weekdays(d smallint[])
returns boolean
language sql
immutable
set search_path = ''
as $$
  select d is not null
     and cardinality(d) between 1 and 7
     and d <@ array[0,1,2,3,4,5,6]::smallint[];
$$;

-- ---------------------------------------------------------------------------
-- Profiles (one per auth user, created automatically on sign-up)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users (id) on delete cascade,
  display_name    text not null default 'Friend'
                  check (char_length(btrim(display_name)) between 1 and 60),
  avatar_path     text,
  weight_unit     text not null default 'kg' check (weight_unit in ('kg', 'lb')),
  length_unit     text not null default 'cm' check (length_unit in ('cm', 'in')),
  timezone        text not null default 'UTC' check (char_length(timezone) <= 64),
  week_starts_on  smallint not null default 1 check (week_starts_on between 0 and 6),
  show_streaks    boolean not null default true,
  reminders       jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint avatar_in_own_folder check (avatar_path is null or avatar_path like id::text || '/%')
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 60), ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'Friend'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Personal care: products, scheduled routine items, completions
-- ---------------------------------------------------------------------------
create table public.care_products (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area                text not null check (area in ('skin', 'hair')),
  category            text not null,
  name                text not null check (char_length(btrim(name)) between 1 and 120),
  brand               text check (brand is null or char_length(brand) <= 120),
  notes               text check (notes is null or char_length(notes) <= 2000),
  usage_instructions  text check (usage_instructions is null or char_length(usage_instructions) <= 2000),
  actives             text[] not null default '{}',
  started_on          date,
  replace_on          date,
  status              text not null default 'active' check (status in ('active', 'paused', 'archived')),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  constraint care_category_matches_area check (
    (area = 'skin' and category in ('cleanser','toner','serum','eye_care','moisturiser','sunscreen',
                                    'exfoliant','retinoid','spot_treatment','mask','oil','other'))
    or
    (area = 'hair' and category in ('shampoo','conditioner','scalp_treatment','hair_serum','hair_mask',
                                    'leave_in','oil','styling','other'))
  ),
  constraint care_actives_known check (
    actives <@ array['retinoid','aha','bha','vitamin_c','benzoyl_peroxide','niacinamide',
                     'azelaic_acid','spf','peptides','hyaluronic_acid']::text[]
  ),
  constraint care_dates_order check (replace_on is null or started_on is null or replace_on >= started_on)
);

create index care_products_user_idx on public.care_products (user_id, area, status);
create trigger care_products_updated_at before update on public.care_products
  for each row execute function public.set_updated_at();

-- A routine item is one scheduled step: a product in the morning routine on
-- Mon/Wed/Fri, or a product-less activity such as "scalp massage" on Sundays.
-- Items are versioned with starts_on / ends_on so that editing a schedule
-- never rewrites past consistency statistics.
create table public.routine_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  area        text not null check (area in ('skin', 'hair')),
  product_id  uuid references public.care_products (id) on delete cascade,
  label       text check (label is null or char_length(btrim(label)) between 1 and 120),
  activity    text check (activity is null or activity in ('wash','condition','scalp','treatment','styling','other')),
  slot        text not null default 'anytime' check (slot in ('morning', 'evening', 'anytime')),
  days        smallint[] not null check (public.is_valid_weekdays(days)),
  position    integer not null default 0,
  starts_on   date not null default current_date,
  ends_on     date,
  created_at  timestamptz not null default now(),
  constraint routine_item_has_subject check (product_id is not null or label is not null),
  constraint routine_item_dates check (ends_on is null or ends_on >= starts_on)
);

create index routine_items_user_idx on public.routine_items (user_id, area, starts_on);
create index routine_items_product_idx on public.routine_items (product_id);

create table public.routine_completions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  routine_item_id  uuid not null references public.routine_items (id) on delete cascade,
  on_date          date not null,
  completed_at     timestamptz not null default now(),
  unique (routine_item_id, on_date)
);

create index routine_completions_user_date_idx on public.routine_completions (user_id, on_date);

-- ---------------------------------------------------------------------------
-- Habits
-- ---------------------------------------------------------------------------
create table public.habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name           text not null check (char_length(btrim(name)) between 1 and 80),
  icon           text not null default 'sparkles' check (char_length(icon) <= 40),
  days           smallint[] not null default '{0,1,2,3,4,5,6}' check (public.is_valid_weekdays(days)),
  reminder_time  time,
  position       integer not null default 0,
  created_on     date not null default current_date,
  archived_on    date,
  created_at     timestamptz not null default now()
);

create index habits_user_idx on public.habits (user_id);

create table public.habit_completions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  habit_id      uuid not null references public.habits (id) on delete cascade,
  on_date       date not null,
  completed_at  timestamptz not null default now(),
  unique (habit_id, on_date)
);

create index habit_completions_user_date_idx on public.habit_completions (user_id, on_date);

-- ---------------------------------------------------------------------------
-- Fitness: profile, exercise library, templates, plan, sessions, sets
-- ---------------------------------------------------------------------------
create table public.fitness_profiles (
  user_id          uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  goal             text not null default 'general_fitness'
                   check (goal in ('muscle_gain','strength','fat_loss','general_fitness','endurance','flexibility')),
  experience       text not null default 'beginner' check (experience in ('beginner','intermediate','advanced')),
  location         text not null default 'home' check (location in ('home','gym','outdoors')),
  equipment        text[] not null default '{}',
  preferred_days   smallint[] not null default '{1,3,5}' check (public.is_valid_weekdays(preferred_days)),
  session_minutes  integer not null default 45 check (session_minutes between 5 and 240),
  updated_at       timestamptz not null default now()
);

create trigger fitness_profiles_updated_at before update on public.fitness_profiles
  for each row execute function public.set_updated_at();

create table public.exercises (
  id                    uuid primary key default gen_random_uuid(),
  -- NULL = shared library exercise (read-only); otherwise a user's custom exercise
  user_id               uuid default auth.uid() references auth.users (id) on delete cascade,
  name                  text not null check (char_length(btrim(name)) between 1 and 100),
  muscle_group          text not null check (muscle_group in ('chest','back','shoulders','biceps','triceps',
                                             'legs','glutes','core','cardio','mobility','full_body')),
  equipment             text not null default 'none' check (equipment in ('none','dumbbells','barbell','kettlebell',
                                             'machine','cable','bands','pullup_bar','bench','cardio_machine','other')),
  category              text not null default 'strength'
                        check (category in ('strength','bodyweight','cardio','mobility','plyometric')),
  difficulty            text not null default 'beginner' check (difficulty in ('beginner','intermediate','advanced')),
  instructions          text check (instructions is null or char_length(instructions) <= 3000),
  is_timed              boolean not null default false,
  default_sets          integer not null default 3 check (default_sets between 1 and 20),
  default_reps          integer check (default_reps is null or default_reps between 1 and 200),
  default_duration_sec  integer check (default_duration_sec is null or default_duration_sec between 5 and 7200),
  default_rest_sec      integer not null default 60 check (default_rest_sec between 0 and 900),
  demo_url              text check (demo_url is null or demo_url ~ '^https://'),
  archived_at           timestamptz,
  created_at            timestamptz not null default now()
);

create index exercises_user_idx on public.exercises (user_id);
create index exercises_group_idx on public.exercises (muscle_group);

create table public.workout_templates (
  id                 uuid primary key default gen_random_uuid(),
  -- NULL = starter template (read-only, users duplicate it to customise)
  user_id            uuid default auth.uid() references auth.users (id) on delete cascade,
  name               text not null check (char_length(btrim(name)) between 1 and 100),
  description        text check (description is null or char_length(description) <= 1000),
  focus              text not null default 'full_body'
                     check (focus in ('full_body','upper','lower','push','pull','legs','strength','mobility','cardio','home','custom')),
  estimated_minutes  integer not null default 45 check (estimated_minutes between 5 and 240),
  archived_at        timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index workout_templates_user_idx on public.workout_templates (user_id);
create trigger workout_templates_updated_at before update on public.workout_templates
  for each row execute function public.set_updated_at();

create table public.workout_template_exercises (
  id                   uuid primary key default gen_random_uuid(),
  template_id          uuid not null references public.workout_templates (id) on delete cascade,
  user_id              uuid default auth.uid() references auth.users (id) on delete cascade,
  exercise_id          uuid not null references public.exercises (id) on delete cascade,
  position             integer not null default 0,
  sets                 integer not null default 3 check (sets between 1 and 20),
  target_reps          integer check (target_reps is null or target_reps between 1 and 200),
  target_duration_sec  integer check (target_duration_sec is null or target_duration_sec between 5 and 7200),
  target_weight_kg     numeric(6,2) check (target_weight_kg is null or target_weight_kg between 0 and 1000),
  rest_sec             integer not null default 60 check (rest_sec between 0 and 900),
  notes                text check (notes is null or char_length(notes) <= 500)
);

create index wte_template_idx on public.workout_template_exercises (template_id, position);

create table public.planned_workouts (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  on_date          date not null,
  kind             text not null default 'workout' check (kind in ('workout', 'rest')),
  template_id      uuid references public.workout_templates (id) on delete set null,
  title            text not null check (char_length(btrim(title)) between 1 and 100),
  planned_minutes  integer check (planned_minutes is null or planned_minutes between 5 and 240),
  notes            text check (notes is null or char_length(notes) <= 1000),
  status           text not null default 'planned' check (status in ('planned', 'completed', 'skipped')),
  created_at       timestamptz not null default now()
);

create index planned_workouts_user_date_idx on public.planned_workouts (user_id, on_date);

create table public.workout_sessions (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references auth.users (id) on delete cascade,
  template_id         uuid references public.workout_templates (id) on delete set null,
  planned_workout_id  uuid references public.planned_workouts (id) on delete set null,
  title               text not null check (char_length(btrim(title)) between 1 and 100),
  on_date             date not null,
  started_at          timestamptz not null default now(),
  ended_at            timestamptz,
  active_seconds      integer not null default 0 check (active_seconds between 0 and 86400),
  status              text not null default 'in_progress' check (status in ('in_progress', 'completed', 'discarded')),
  effort              smallint check (effort is null or effort between 1 and 10),
  notes               text check (notes is null or char_length(notes) <= 2000),
  created_at          timestamptz not null default now(),
  constraint completed_has_end check (status <> 'completed' or ended_at is not null)
);

create index workout_sessions_user_date_idx on public.workout_sessions (user_id, on_date);

create table public.workout_session_exercises (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.workout_sessions (id) on delete cascade,
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  -- Kept nullable + name snapshot so history survives if a custom exercise is deleted.
  exercise_id          uuid references public.exercises (id) on delete set null,
  exercise_name        text not null,
  muscle_group         text,
  is_timed             boolean not null default false,
  position             integer not null default 0,
  target_sets          integer not null default 3 check (target_sets between 1 and 20),
  target_reps          integer,
  target_duration_sec  integer,
  target_weight_kg     numeric(6,2),
  rest_sec             integer not null default 60 check (rest_sec between 0 and 900),
  notes                text check (notes is null or char_length(notes) <= 500)
);

create index wse_session_idx on public.workout_session_exercises (session_id, position);
create index wse_user_exercise_idx on public.workout_session_exercises (user_id, exercise_id);

create table public.workout_sets (
  id                   uuid primary key default gen_random_uuid(),
  session_exercise_id  uuid not null references public.workout_session_exercises (id) on delete cascade,
  user_id              uuid not null default auth.uid() references auth.users (id) on delete cascade,
  set_number           integer not null check (set_number between 1 and 50),
  reps                 integer check (reps is null or reps between 0 and 500),
  weight_kg            numeric(6,2) check (weight_kg is null or weight_kg between 0 and 1000),
  duration_sec         integer check (duration_sec is null or duration_sec between 0 and 7200),
  completed            boolean not null default false,
  completed_at         timestamptz,
  unique (session_exercise_id, set_number)
);

create index workout_sets_user_idx on public.workout_sets (user_id);

-- ---------------------------------------------------------------------------
-- Goals, body measurements, progress photos (all optional, all private)
-- ---------------------------------------------------------------------------
create table public.fitness_goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title             text not null check (char_length(btrim(title)) between 1 and 100),
  kind              text not null check (kind in ('body_weight','lift','workouts_per_week','measurement','custom')),
  exercise_id       uuid references public.exercises (id) on delete set null,
  measurement_kind  text,
  start_value       numeric(8,2),
  current_value     numeric(8,2),
  target_value      numeric(8,2) not null,
  unit              text check (unit is null or char_length(unit) <= 20),
  target_date       date,
  achieved_on       date,
  archived_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index fitness_goals_user_idx on public.fitness_goals (user_id);

create table public.body_measurements (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  measured_on  date not null,
  -- weight is stored in kg, lengths in cm, body_fat in %
  kind         text not null check (kind in ('weight','waist','chest','hips','arm','thigh','neck','body_fat')),
  value        numeric(7,2) not null check (value > 0 and value < 1000),
  notes        text check (notes is null or char_length(notes) <= 500),
  created_at   timestamptz not null default now()
);

create index body_measurements_user_idx on public.body_measurements (user_id, kind, measured_on);

create table public.progress_photos (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  taken_on      date not null,
  storage_path  text not null unique,
  note          text check (note is null or char_length(note) <= 500),
  created_at    timestamptz not null default now(),
  constraint photo_in_own_folder check (storage_path like user_id::text || '/%')
);

create index progress_photos_user_idx on public.progress_photos (user_id, taken_on);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles                   enable row level security;
alter table public.care_products              enable row level security;
alter table public.routine_items              enable row level security;
alter table public.routine_completions        enable row level security;
alter table public.habits                     enable row level security;
alter table public.habit_completions          enable row level security;
alter table public.fitness_profiles           enable row level security;
alter table public.exercises                  enable row level security;
alter table public.workout_templates          enable row level security;
alter table public.workout_template_exercises enable row level security;
alter table public.planned_workouts           enable row level security;
alter table public.workout_sessions           enable row level security;
alter table public.workout_session_exercises  enable row level security;
alter table public.workout_sets               enable row level security;
alter table public.fitness_goals              enable row level security;
alter table public.body_measurements          enable row level security;
alter table public.progress_photos            enable row level security;

-- Profiles: the row id IS the user id. Rows are created by the sign-up trigger.
create policy "profiles: read own"   on public.profiles for select to authenticated
  using (id = (select auth.uid()));
create policy "profiles: update own" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Simple owner-only tables
create policy "care_products: owner all" on public.care_products for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "habits: owner all" on public.habits for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "fitness_profiles: owner all" on public.fitness_profiles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "workout_sessions: owner all" on public.workout_sessions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (template_id is null or exists (
      select 1 from public.workout_templates t
      where t.id = template_id and (t.user_id is null or t.user_id = (select auth.uid()))))
    and (planned_workout_id is null or exists (
      select 1 from public.planned_workouts p
      where p.id = planned_workout_id and p.user_id = (select auth.uid())))
  );
create policy "body_measurements: owner all" on public.body_measurements for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "progress_photos: owner all" on public.progress_photos for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Child tables: the owner must also own the parent row they point at.
create policy "routine_items: owner all" on public.routine_items for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (product_id is null or exists (
      select 1 from public.care_products p
      where p.id = product_id and p.user_id = (select auth.uid()) and p.area = routine_items.area))
  );

create policy "routine_completions: owner all" on public.routine_completions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.routine_items i
                where i.id = routine_item_id and i.user_id = (select auth.uid()))
  );

create policy "habit_completions: owner all" on public.habit_completions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.habits h where h.id = habit_id and h.user_id = (select auth.uid()))
  );

create policy "planned_workouts: owner all" on public.planned_workouts for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (template_id is null or exists (
      select 1 from public.workout_templates t
      where t.id = template_id and (t.user_id is null or t.user_id = (select auth.uid()))))
  );

create policy "workout_session_exercises: owner all" on public.workout_session_exercises for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_sessions s
                where s.id = session_id and s.user_id = (select auth.uid()))
    and (exercise_id is null or exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid()))))
  );

create policy "workout_sets: owner all" on public.workout_sets for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_session_exercises se
                where se.id = session_exercise_id and se.user_id = (select auth.uid()))
  );

create policy "fitness_goals: owner all" on public.fitness_goals for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (exercise_id is null or exists (
      select 1 from public.exercises e
      where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid()))))
  );

-- Shared library + own rows: everyone signed in can READ library rows
-- (user_id is null); only owners can write, and nobody can create library rows.
create policy "exercises: read library and own" on public.exercises for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy "exercises: insert own" on public.exercises for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "exercises: update own" on public.exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "exercises: delete own" on public.exercises for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "templates: read starters and own" on public.workout_templates for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy "templates: insert own" on public.workout_templates for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "templates: update own" on public.workout_templates for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "templates: delete own" on public.workout_templates for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "template_exercises: read starters and own" on public.workout_template_exercises
  for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
create policy "template_exercises: insert own" on public.workout_template_exercises
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_templates t
                where t.id = template_id and t.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e
                where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid())))
  );
create policy "template_exercises: update own" on public.workout_template_exercises
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.workout_templates t
                where t.id = template_id and t.user_id = (select auth.uid()))
    and exists (select 1 from public.exercises e
                where e.id = exercise_id and (e.user_id is null or e.user_id = (select auth.uid())))
  );
create policy "template_exercises: delete own" on public.workout_template_exercises
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Privileges: signed-in users only. The anon role gets nothing.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;
-- Profiles are created by the trigger and removed with the account.
revoke insert, delete on public.profiles from authenticated;

-- ---------------------------------------------------------------------------
-- Account deletion (self-service). Removes the auth user; every personal row
-- above cascades from auth.users. The app deletes the user's storage files
-- first, through the Storage API.
-- ---------------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
