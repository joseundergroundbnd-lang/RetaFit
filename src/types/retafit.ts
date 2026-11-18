export type Sex = 'male' | 'female';

export interface UserProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  referenceWeightKg: number;
  targetLossKg: number;
  targetCalories: number;
  targetProteinG: number;
  targetFatG: number;
  targetCarbsG: number;
  estimatedTdee: number;
  habitualActivityNote: string;
  lastBackupAt: string | null;
}

export interface DailyLog {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number | null;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  activeCalories: number | null;
  steps: number | null;
  exerciseType: string | null;
  exerciseDurationMin: number | null;
  notes: string | null;
  updatedAt?: string;
}

export interface MedicationLog {
  id: string;
  date: string; // YYYY-MM-DD
  medName: string;
  volumeMl: number;
  concentrationMgMl: number | null;
  notes: string | null;
  updatedAt?: string;
}

export interface InitialImportRecord {
  date: string;
  weight: number | null;
  cal: number | null;
  protein: number | null;
  carbs: number | null;
  fat: number | null;
  active: number | null;
  med: boolean;
  medName?: string | null;
  medAmount: number | null;
  medUnit?: string | null;
  steps?: number | null;
  exerciseType?: string | null;
  exerciseDurationMin?: number | null;
  notes?: string | null;
}

export interface RetafitBackupPayload {
  app: 'RETAFIT';
  version: number;
  exportedAt: string;
  profile?: Partial<UserProfile>;
  dailyLogs: DailyLog[];
  medicationLogs: MedicationLog[];
}

export type MainTab = 'inicio' | 'registro' | 'graficas' | 'historial';

export type DateRangePreset = '7d' | '30d' | '90d' | 'all' | 'custom';
