import type { Area, Equipment, ExerciseCategory, MeasurementKind, MuscleGroup, TemplateFocus } from '@/types/db';

export const SKIN_CATEGORIES: Record<string, string> = {
  cleanser: 'Cleanser',
  toner: 'Toner',
  serum: 'Serum',
  eye_care: 'Eye care',
  moisturiser: 'Moisturiser',
  sunscreen: 'Sunscreen',
  exfoliant: 'Exfoliant',
  retinoid: 'Retinoid',
  spot_treatment: 'Spot treatment',
  mask: 'Mask',
  oil: 'Face oil',
  other: 'Other',
};

export const HAIR_CATEGORIES: Record<string, string> = {
  shampoo: 'Shampoo',
  conditioner: 'Conditioner',
  scalp_treatment: 'Scalp treatment',
  hair_serum: 'Hair serum',
  hair_mask: 'Hair mask',
  leave_in: 'Leave-in',
  oil: 'Hair oil',
  styling: 'Styling product',
  other: 'Other',
};

export function categoriesFor(area: Area) {
  return area === 'skin' ? SKIN_CATEGORIES : HAIR_CATEGORIES;
}

/** Typical application order used as a default when adding skincare products. */
export const SKIN_ORDER: Record<string, number> = {
  cleanser: 10, toner: 20, exfoliant: 25, serum: 30, retinoid: 35, spot_treatment: 40,
  eye_care: 45, mask: 50, moisturiser: 60, oil: 70, sunscreen: 90, other: 80,
};

export const ACTIVES: Record<string, string> = {
  retinoid: 'Retinoid (retinol, retinal, tretinoin)',
  aha: 'AHA (glycolic, lactic, mandelic)',
  bha: 'BHA (salicylic acid)',
  vitamin_c: 'Vitamin C (ascorbic acid)',
  benzoyl_peroxide: 'Benzoyl peroxide',
  niacinamide: 'Niacinamide',
  azelaic_acid: 'Azelaic acid',
  peptides: 'Peptides',
  hyaluronic_acid: 'Hyaluronic acid',
  spf: 'SPF / UV filters',
};

export const HAIR_ACTIVITIES: Record<string, string> = {
  wash: 'Wash',
  condition: 'Condition',
  scalp: 'Scalp care',
  treatment: 'Treatment / mask',
  styling: 'Styling',
  other: 'Other',
};

export const SLOT_LABEL = { morning: 'Morning', evening: 'Evening', anytime: 'Any time' } as const;

export const MUSCLE_GROUPS: Record<MuscleGroup, string> = {
  chest: 'Chest', back: 'Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps',
  legs: 'Legs', glutes: 'Glutes', core: 'Core', cardio: 'Cardio', mobility: 'Mobility', full_body: 'Full body',
};

export const EQUIPMENT: Record<Equipment, string> = {
  none: 'No equipment', dumbbells: 'Dumbbells', barbell: 'Barbell', kettlebell: 'Kettlebell',
  machine: 'Machine', cable: 'Cable', bands: 'Resistance bands', pullup_bar: 'Pull-up bar',
  bench: 'Bench', cardio_machine: 'Cardio machine', other: 'Other',
};

export const EXERCISE_CATEGORIES: Record<ExerciseCategory, string> = {
  strength: 'Strength', bodyweight: 'Bodyweight', cardio: 'Cardio', mobility: 'Mobility', plyometric: 'Plyometric',
};

export const DIFFICULTY = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' } as const;

export const FOCUS: Record<TemplateFocus, string> = {
  full_body: 'Full body', upper: 'Upper body', lower: 'Lower body', push: 'Push', pull: 'Pull', legs: 'Legs',
  strength: 'Strength', mobility: 'Mobility', cardio: 'Cardio', home: 'Home', custom: 'Custom',
};

export const FITNESS_GOALS = {
  muscle_gain: 'Build muscle', strength: 'Get stronger', fat_loss: 'Lose fat',
  general_fitness: 'General fitness', endurance: 'Endurance', flexibility: 'Flexibility',
} as const;

export const LOCATIONS = { home: 'Home', gym: 'Gym', outdoors: 'Outdoors' } as const;

export const MEASUREMENTS: Record<MeasurementKind, { label: string; type: 'weight' | 'length' | 'percent' }> = {
  weight: { label: 'Body weight', type: 'weight' },
  waist: { label: 'Waist', type: 'length' },
  chest: { label: 'Chest', type: 'length' },
  hips: { label: 'Hips', type: 'length' },
  arm: { label: 'Arm', type: 'length' },
  thigh: { label: 'Thigh', type: 'length' },
  neck: { label: 'Neck', type: 'length' },
  body_fat: { label: 'Body fat', type: 'percent' },
};

export const HABIT_ICONS = [
  'droplets', 'moon', 'footprints', 'book-open', 'brain', 'sun', 'pill', 'apple', 'dumbbell', 'sparkles', 'heart', 'leaf',
] as const;

export const HABIT_SUGGESTIONS: { name: string; icon: string }[] = [
  { name: 'Drink water', icon: 'droplets' },
  { name: 'Wind-down routine', icon: 'moon' },
  { name: 'Stretch for 10 minutes', icon: 'leaf' },
  { name: 'Daily walk', icon: 'footprints' },
  { name: 'Read', icon: 'book-open' },
  { name: 'Meditate', icon: 'brain' },
];
