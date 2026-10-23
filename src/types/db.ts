// Hand-written row types matching supabase/migrations. Keep in sync with the SQL.

export type UUID = string;
export type ISODate = string; // 'YYYY-MM-DD' in the user's local timezone
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export type Area = 'skin' | 'hair';
export type ProductStatus = 'active' | 'paused' | 'archived';
export type Slot = 'morning' | 'evening' | 'anytime';
export type HairActivity = 'wash' | 'condition' | 'scalp' | 'treatment' | 'styling' | 'other';

export interface ReminderPrefs {
  enabled?: boolean;
  morning?: string | null; // 'HH:MM'
  evening?: string | null;
  workout?: string | null;
  habits?: boolean;
}

export interface Profile {
  id: UUID;
  display_name: string;
  avatar_path: string | null;
  weight_unit: 'kg' | 'lb';
  length_unit: 'cm' | 'in';
  timezone: string;
  week_starts_on: number;
  show_streaks: boolean;
  reminders: ReminderPrefs;
  created_at: string;
  updated_at: string;
}

export interface CareProduct {
  id: UUID;
  user_id: UUID;
  area: Area;
  category: string;
  name: string;
  brand: string | null;
  notes: string | null;
  usage_instructions: string | null;
  actives: string[];
  started_on: ISODate | null;
  replace_on: ISODate | null;
  status: ProductStatus;
  created_at: string;
  updated_at: string;
}

export interface RoutineItem {
  id: UUID;
  user_id: UUID;
  area: Area;
  product_id: UUID | null;
  label: string | null;
  activity: HairActivity | null;
  slot: Slot;
  days: number[];
  position: number;
  starts_on: ISODate;
  ends_on: ISODate | null;
  created_at: string;
}

export interface RoutineCompletion {
  id: UUID;
  user_id: UUID;
  routine_item_id: UUID;
  on_date: ISODate;
  completed_at: string;
}

export interface Habit {
  id: UUID;
  user_id: UUID;
  name: string;
  icon: string;
  days: number[];
  reminder_time: string | null;
  position: number;
  created_on: ISODate;
  archived_on: ISODate | null;
  created_at: string;
}

export interface HabitCompletion {
  id: UUID;
  user_id: UUID;
  habit_id: UUID;
  on_date: ISODate;
  completed_at: string;
}

export type FitnessGoalType = 'muscle_gain' | 'strength' | 'fat_loss' | 'general_fitness' | 'endurance' | 'flexibility';
export type Experience = 'beginner' | 'intermediate' | 'advanced';

export interface FitnessProfile {
  user_id: UUID;
  goal: FitnessGoalType;
  experience: Experience;
  location: 'home' | 'gym' | 'outdoors';
  equipment: string[];
  preferred_days: number[];
  session_minutes: number;
  updated_at: string;
}

export type MuscleGroup =
  | 'chest' | 'back' | 'shoulders' | 'biceps' | 'triceps' | 'legs'
  | 'glutes' | 'core' | 'cardio' | 'mobility' | 'full_body';
export type Equipment =
  | 'none' | 'dumbbells' | 'barbell' | 'kettlebell' | 'machine' | 'cable'
  | 'bands' | 'pullup_bar' | 'bench' | 'cardio_machine' | 'other';
export type ExerciseCategory = 'strength' | 'bodyweight' | 'cardio' | 'mobility' | 'plyometric';

export interface Exercise {
  id: UUID;
  user_id: UUID | null;
  name: string;
  muscle_group: MuscleGroup;
  equipment: Equipment;
  category: ExerciseCategory;
  difficulty: Experience;
  instructions: string | null;
  is_timed: boolean;
  default_sets: number;
  default_reps: number | null;
  default_duration_sec: number | null;
  default_rest_sec: number;
  demo_url: string | null;
  archived_at: string | null;
  created_at: string;
}

export type TemplateFocus =
  | 'full_body' | 'upper' | 'lower' | 'push' | 'pull' | 'legs'
  | 'strength' | 'mobility' | 'cardio' | 'home' | 'custom';

export interface WorkoutTemplate {
  id: UUID;
  user_id: UUID | null;
  name: string;
  description: string | null;
  focus: TemplateFocus;
  estimated_minutes: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TemplateExercise {
  id: UUID;
  template_id: UUID;
  user_id: UUID | null;
  exercise_id: UUID;
  position: number;
  sets: number;
  target_reps: number | null;
  target_duration_sec: number | null;
  target_weight_kg: number | null;
  rest_sec: number;
  notes: string | null;
}

export interface TemplateWithExercises extends WorkoutTemplate {
  workout_template_exercises: (TemplateExercise & { exercises: Exercise | null })[];
}

export interface PlannedWorkout {
  id: UUID;
  user_id: UUID;
  on_date: ISODate;
  kind: 'workout' | 'rest';
  template_id: UUID | null;
  title: string;
  planned_minutes: number | null;
  notes: string | null;
  status: 'planned' | 'completed' | 'skipped';
  created_at: string;
}

export interface WorkoutSession {
  id: UUID;
  user_id: UUID;
  template_id: UUID | null;
  planned_workout_id: UUID | null;
  title: string;
  on_date: ISODate;
  started_at: string;
  ended_at: string | null;
  active_seconds: number;
  status: 'in_progress' | 'completed' | 'discarded';
  effort: number | null;
  notes: string | null;
  created_at: string;
}

export interface SessionExercise {
  id: UUID;
  session_id: UUID;
  user_id: UUID;
  exercise_id: UUID | null;
  exercise_name: string;
  muscle_group: string | null;
  is_timed: boolean;
  position: number;
  target_sets: number;
  target_reps: number | null;
  target_duration_sec: number | null;
  target_weight_kg: number | null;
  rest_sec: number;
  notes: string | null;
}

export interface WorkoutSet {
  id: UUID;
  session_exercise_id: UUID;
  user_id: UUID;
  set_number: number;
  reps: number | null;
  weight_kg: number | null;
  duration_sec: number | null;
  completed: boolean;
  completed_at: string | null;
}

export interface SessionExerciseWithSets extends SessionExercise {
  workout_sets: WorkoutSet[];
  exercises: Pick<Exercise, 'instructions' | 'demo_url' | 'equipment'> | null;
}

export interface SessionWithDetails extends WorkoutSession {
  workout_session_exercises: SessionExerciseWithSets[];
}

export type GoalKind = 'body_weight' | 'lift' | 'workouts_per_week' | 'measurement' | 'custom';

export interface FitnessGoal {
  id: UUID;
  user_id: UUID;
  title: string;
  kind: GoalKind;
  exercise_id: UUID | null;
  measurement_kind: string | null;
  start_value: number | null;
  current_value: number | null;
  target_value: number;
  unit: string | null;
  target_date: ISODate | null;
  achieved_on: ISODate | null;
  archived_at: string | null;
  created_at: string;
}

export type MeasurementKind = 'weight' | 'waist' | 'chest' | 'hips' | 'arm' | 'thigh' | 'neck' | 'body_fat';

export interface BodyMeasurement {
  id: UUID;
  user_id: UUID;
  measured_on: ISODate;
  kind: MeasurementKind;
  value: number;
  notes: string | null;
  created_at: string;
}

export interface ProgressPhoto {
  id: UUID;
  user_id: UUID;
  taken_on: ISODate;
  storage_path: string;
  note: string | null;
  created_at: string;
}
