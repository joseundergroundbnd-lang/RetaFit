import {
  DailyLog,
  InitialImportRecord,
  MedicationLog,
  RetafitBackupPayload,
  UserProfile,
} from '../types/retafit';

export const DEFAULT_PROFILE: UserProfile = {
  sex: 'male',
  age: 50,
  heightCm: 172,
  referenceWeightKg: 90,
  targetLossKg: 15,
  targetCalories: 2000,
  targetProteinG: 175,
  targetFatG: 60,
  targetCarbsG: 190,
  estimatedTdee: 2550,
  habitualActivityNote:
    'Caminata diaria de aproximadamente una hora, entrenamiento de fuerza ligero y actividad monitorizada mediante reloj o aplicaciones deportivas.',
  lastBackupAt: null,
};

export const INITIAL_HISTORICAL_RECORDS: InitialImportRecord[] = [
  { date: '2026-11-04', weight: 91.7, cal: 2449, protein: 268, carbs: 140, fat: 88, active: 600, med: false, medAmount: null, medUnit: 'ml' },
  { date: '2026-11-05', weight: null, cal: null, protein: null, carbs: null, fat: null, active: null, med: true, medName: 'Mounjaro', medAmount: 2.5, medUnit: 'ml' },
  { date: '2026-11-06', weight: null, cal: 1290, protein: 157, carbs: 62, fat: 45, active: 740, med: false, medAmount: null, medUnit: 'ml' },
  { date: '2026-11-07', weight: 90.65, cal: 1707, protein: 216, carbs: 146, fat: 28, active: 374, med: false, medAmount: null, medUnit: 'ml' },
  { date: '2026-11-08', weight: 90.55, cal: 1430, protein: 200, carbs: 35, fat: 50, active: 393, med: false, medAmount: null, medUnit: 'ml' },
  { date: '2026-11-09', weight: 89.85, cal: 1486, protein: 190, carbs: 51, fat: 55, active: 600, med: false, medAmount: null, medUnit: 'ml' },
  { date: '2026-11-10', weight: 90.0, cal: 1730, protein: 187, carbs: 107, fat: 61, active: 700, med: false, medAmount: null, medUnit: 'ml' },
  { date: '2026-11-11', weight: 90.0, cal: 1182, protein: 75, carbs: 79, fat: 62, active: null, med: false, medAmount: null, medUnit: 'ml' },
  { date: '2026-11-12', weight: null, cal: 1811, protein: 178, carbs: 148, fat: 51, active: 700, med: true, medName: 'Mounjaro', medAmount: 2.5, medUnit: 'ml' },
  { date: '2026-11-13', weight: 90.0, cal: 1716, protein: 197, carbs: 132, fat: 45, active: 670, med: false, medAmount: null, medUnit: 'ml' },
  { date: '2026-11-14', weight: 90.0, cal: 2000, protein: 190, carbs: 125, fat: 50, active: 600, med: false, medAmount: null, medUnit: 'ml' },
  { date: '2026-11-15', weight: 89.25, cal: 1663, protein: 190, carbs: 68, fat: 67, active: 600, med: false, medAmount: null, medUnit: 'ml' },
  { date: '2026-11-16', weight: null, cal: 1752, protein: 233, carbs: 106, fat: 39, active: 750, med: false, medAmount: null, medUnit: 'ml' },
  { date: '2026-11-17', weight: 89.9, cal: 1816, protein: 154, carbs: 155, fat: 64, active: 600, med: true, medName: 'Retatrutida', medAmount: 2, medUnit: 'ml' },
];

function deterministicId(prefix: string, date: string, index: number): string {
  return `${prefix}-${date}-${index}`;
}

export function buildInitialData(): {
  dailyLogs: DailyLog[];
  medicationLogs: MedicationLog[];
} {
  const dailyLogs: DailyLog[] = [];
  const medicationLogs: MedicationLog[] = [];

  INITIAL_HISTORICAL_RECORDS.forEach((rec, idx) => {
    const hasDailyMetrics =
      rec.weight !== null ||
      rec.cal !== null ||
      rec.protein !== null ||
      rec.carbs !== null ||
      rec.fat !== null ||
      rec.active !== null;

    if (hasDailyMetrics) {
      dailyLogs.push({
        id: deterministicId('log', rec.date, idx),
        date: rec.date,
        weightKg: rec.weight ?? null,
        calories: rec.cal ?? null,
        proteinG: rec.protein ?? null,
        carbsG: rec.carbs ?? null,
        fatG: rec.fat ?? null,
        activeCalories: rec.active ?? null,
        steps: rec.steps ?? null,
        exerciseType: rec.exerciseType ?? null,
        exerciseDurationMin: rec.exerciseDurationMin ?? null,
        notes: rec.notes ?? null,
      });
    }

    if (rec.med && rec.medAmount !== null && rec.medAmount !== undefined) {
      medicationLogs.push({
        id: deterministicId('med', rec.date, idx),
        date: rec.date,
        medName: rec.medName?.trim() || 'Medicación',
        volumeMl: rec.medAmount,
        concentrationMgMl: null,
        notes: 'Registro histórico inicial importado (volumen expresado en ml).',
      });
    }
  });

  return { dailyLogs, medicationLogs };
}

function toNullableNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

function isValidIsoDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export interface ParsedImportResult {
  dailyLogs: DailyLog[];
  medicationLogs: MedicationLog[];
  profile?: Partial<UserProfile>;
}

export function parseImportedJson(rawText: string): ParsedImportResult {
  const parsed = JSON.parse(rawText) as unknown;

  // Format 1: Full RETAFIT backup object
  if (
    parsed &&
    typeof parsed === 'object' &&
    !Array.isArray(parsed) &&
    'dailyLogs' in parsed
  ) {
    const payload = parsed as Partial<RetafitBackupPayload>;
    const dailyLogs: DailyLog[] = (Array.isArray(payload.dailyLogs) ? payload.dailyLogs : [])
      .filter((item) => item && isValidIsoDate(item.date))
      .map((item, idx) => ({
        id: item.id || `import-log-${item.date}-${idx}`,
        date: item.date,
        weightKg: toNullableNumber(item.weightKg),
        calories: toNullableNumber(item.calories),
        proteinG: toNullableNumber(item.proteinG),
        carbsG: toNullableNumber(item.carbsG),
        fatG: toNullableNumber(item.fatG),
        activeCalories: toNullableNumber(item.activeCalories),
        steps: toNullableNumber(item.steps),
        exerciseType: typeof item.exerciseType === 'string' && item.exerciseType.trim() ? item.exerciseType.trim() : null,
        exerciseDurationMin: toNullableNumber(item.exerciseDurationMin),
        notes: typeof item.notes === 'string' && item.notes.trim() ? item.notes.trim() : null,
      }));

    const medicationLogs: MedicationLog[] = (Array.isArray(payload.medicationLogs) ? payload.medicationLogs : [])
      .filter((item) => item && isValidIsoDate(item.date) && toNullableNumber(item.volumeMl) !== null)
      .map((item, idx) => ({
        id: item.id || `import-med-${item.date}-${idx}`,
        date: item.date,
        medName: typeof item.medName === 'string' && item.medName.trim() ? item.medName.trim() : 'Medicación',
        volumeMl: Number(item.volumeMl),
        concentrationMgMl: toNullableNumber(item.concentrationMgMl),
        notes: typeof item.notes === 'string' && item.notes.trim() ? item.notes.trim() : null,
      }));

    return {
      dailyLogs,
      medicationLogs,
      profile: payload.profile,
    };
  }

  // Format 2: Historical flat JSON array matching user's exact schema
  if (Array.isArray(parsed)) {
    const dailyByDate = new Map<string, DailyLog>();
    const medicationLogs: MedicationLog[] = [];

    parsed.forEach((rawItem, idx) => {
      if (!rawItem || typeof rawItem !== 'object') return;
      const item = rawItem as Record<string, unknown>;
      if (!isValidIsoDate(item.date)) return;

      const weightKg = toNullableNumber(item.weight ?? item.weightKg);
      const calories = toNullableNumber(item.cal ?? item.calories);
      const proteinG = toNullableNumber(item.protein ?? item.proteinG);
      const carbsG = toNullableNumber(item.carbs ?? item.carbsG);
      const fatG = toNullableNumber(item.fat ?? item.fatG);
      const activeCalories = toNullableNumber(item.active ?? item.activeCalories);
      const steps = toNullableNumber(item.steps);
      const exerciseDurationMin = toNullableNumber(item.exerciseDurationMin);
      const exerciseType =
        typeof item.exerciseType === 'string' && item.exerciseType.trim()
          ? item.exerciseType.trim()
          : null;
      const notes =
        typeof item.notes === 'string' && item.notes.trim() ? item.notes.trim() : null;

      const hasDaily =
        weightKg !== null ||
        calories !== null ||
        proteinG !== null ||
        carbsG !== null ||
        fatG !== null ||
        activeCalories !== null ||
        steps !== null ||
        exerciseType !== null ||
        exerciseDurationMin !== null ||
        notes !== null;

      if (hasDaily) {
        dailyByDate.set(item.date, {
          id: `import-log-${item.date}-${idx}`,
          date: item.date,
          weightKg,
          calories,
          proteinG,
          carbsG,
          fatG,
          activeCalories,
          steps,
          exerciseType,
          exerciseDurationMin,
          notes,
        });
      }

      const medFlag = Boolean(item.med);
      const medAmount = toNullableNumber(item.medAmount ?? item.volumeMl);
      if (medFlag && medAmount !== null) {
        medicationLogs.push({
          id: `import-med-${item.date}-${idx}`,
          date: item.date,
          medName:
            typeof item.medName === 'string' && item.medName.trim()
              ? item.medName.trim()
              : 'Medicación',
          volumeMl: medAmount,
          concentrationMgMl: toNullableNumber(item.concentrationMgMl),
          notes: 'Importado desde JSON (volumen en ml).',
        });
      }
    });

    if (dailyByDate.size === 0 && medicationLogs.length === 0) {
      throw new Error('El archivo JSON no contiene registros válidos con formato YYYY-MM-DD.');
    }

    return {
      dailyLogs: Array.from(dailyByDate.values()),
      medicationLogs,
    };
  }

  throw new Error('Formato JSON no reconocido. Debe ser un array de registros o una copia de seguridad RETAFIT.');
}
