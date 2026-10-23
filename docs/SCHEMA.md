# Database schema

All tables live in `public` and are created by `supabase/migrations/20261023000001_schema.sql`.
Every user-owned row has `user_id uuid not null default auth.uid() references auth.users on delete cascade`, so deleting
an auth user removes all their data.

```
auth.users ─┬─ profiles (1:1, created by trigger on sign-up)
            ├─ care_products ──< routine_items ──< routine_completions
            │        (product-less hair activities are routine_items with product_id = null)
            ├─ habits ──< habit_completions
            ├─ fitness_profiles (1:1)
            ├─ exercises*  (user_id null = shared library)
            ├─ workout_templates* ──< workout_template_exercises >── exercises
            ├─ planned_workouts >── workout_templates
            ├─ workout_sessions >── workout_templates, planned_workouts
            │        └──< workout_session_exercises >── exercises (set null on delete; name is snapshotted)
            │                 └──< workout_sets
            ├─ fitness_goals >── exercises
            ├─ body_measurements
            └─ progress_photos  (paths point into the private progress-photos bucket)
```
`*` = also holds read-only shared rows with `user_id = null`.

## Design decisions

**One product table for skin and hair.** `care_products.area` is `skin` or `hair`; a check constraint keeps categories
consistent with the area. This avoids two near-identical tables.

**Schedules are versioned.** A `routine_items` row says "this product/activity, in this slot, on these weekdays", valid
from `starts_on` to `ends_on`. Editing a schedule that already has history closes the old row (yesterday) and opens a new
one (today), and pausing/archiving a product closes its rows. Consistency statistics therefore always reflect what was
actually scheduled on each past day.

**Completions are rows, not flags.** `routine_completions` and `habit_completions` hold one row per item per day
(`unique (item, on_date)`). Dates are the user's local calendar date (`date`, not timestamp), computed in the profile's
timezone.

**Workout history survives edits.** Sessions copy the template's exercises into `workout_session_exercises`, including
the exercise name, so changing or deleting a template or a custom exercise never rewrites the past. Weights are stored
in kg and measurements in cm; the UI converts.

**Ownership is enforced on children too.** Policies on child tables check both `user_id = auth.uid()` and that the
referenced parent belongs to the caller (and, for products, that the area matches).

## Row Level Security summary

| Table | Select | Insert / update / delete |
| --- | --- | --- |
| profiles | own row | update own row (insert by trigger, delete by cascade) |
| care_products, habits, fitness_profiles, body_measurements, progress_photos | own | own |
| routine_items, routine_completions, habit_completions, planned_workouts, workout_sessions, workout_session_exercises, workout_sets, fitness_goals | own | own **and** parent/reference must be own (or shared library/starter where allowed) |
| exercises, workout_templates, workout_template_exercises | shared rows + own | own only (`user_id` must equal caller) |
| storage.objects (`avatars`, `progress-photos`) | files under `<uid>/` | files under `<uid>/` |

`anon` has no privileges on any table. `delete_my_account()` is executable by `authenticated` only.

## Indexes

Every foreign key used for lookups and every `(user_id, date)` pair used by the dashboard, calendar and analytics has
an index (see the migration). The data set per user is small, so these are mainly about keeping RLS checks cheap.

## Testing

`npm run test:db` boots a disposable PostgreSQL, installs a tiny stand-in for Supabase's `auth` and `storage` schemas
(`supabase/tests/supabase_shim.sql`), applies the migrations (plus the seed twice, to prove it's idempotent) and runs
`supabase/tests/rls_test.sql`.
