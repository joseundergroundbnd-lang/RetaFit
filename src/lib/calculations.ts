import { DailyLog, MedicationLog, UserProfile } from '../types/retafit';

export const MOUNJARO_START = '2026-11-04';
export const MOUNJARO_END = '2026-11-16';
export const RETATRUTIDA_START = '2026-11-17';

export function calculateBmrMifflinStJeor(
  profile: UserProfile,
  weightKgOverride?: number | null
): number {
  const weight = weightKgOverride ?? profile.referenceWeightKg;
  const base = 10 * weight + 6.25 * profile.heightCm - 5 * profile.age;
  return Math.round(profile.sex === 'male' ? base + 5 : base - 161);
}

export function averageNonNull(values: Array<number | null | undefined>): {
  avg: number | null;
  count: number;
} {
  const valid = values.filter((v): v is number => v !== null && v !== undefined && Number.isFinite(v));
  if (valid.length === 0) return { avg: null, count: 0 };
  const sum = valid.reduce((acc, v) => acc + v, 0);
  return { avg: sum / valid.length, count: valid.length };
}

export function getDayCompleteness(log: DailyLog | undefined): 'complete' | 'partial' | 'empty' {
  if (!log) return 'empty';
  const coreFields = [log.weightKg, log.calories, log.proteinG, log.carbsG, log.fatG, log.activeCalories];
  const presentCount = coreFields.filter((v) => v !== null).length;
  if (presentCount === 0 && !log.steps && !log.exerciseType && !log.notes) return 'empty';
  if (presentCount >= 5) return 'complete';
  return 'partial';
}

export function sortLogsAsc(logs: DailyLog[]): DailyLog[] {
  return [...logs].sort((a, b) => a.date.localeCompare(b.date));
}

export function getMedicationPeriodLabel(date: string): 'Mounjaro' | 'Retatrutida' | 'Previo' {
  if (date >= RETATRUTIDA_START) return 'Retatrutida';
  if (date >= MOUNJARO_START && date <= MOUNJARO_END) return 'Mounjaro';
  return 'Previo';
}

export interface ChartPoint {
  date: string;
  shortDate: string;
  weightKg: number | null;
  movingAvg7: number | null;
  trendWeight: number | null;
  calories: number | null;
  estimatedTdee: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  activeCalories: number | null;
  steps: number | null;
  exerciseDurationMin: number | null;
  medPeriod: 'Mounjaro' | 'Retatrutida' | 'Previo';
  mounjaroWeight: number | null;
  retatrutidaWeight: number | null;
  medBadge: string | null;
}

export function formatShortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${day}/${month}`;
}

export function formatFullDateEs(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function daysBetweenIso(d1: string, d2: string): number {
  const t1 = Date.parse(d1 + 'T00:00:00Z');
  const t2 = Date.parse(d2 + 'T00:00:00Z');
  return Math.round((t2 - t1) / (1000 * 60 * 60 * 24));
}

export function buildChartSeries(
  logs: DailyLog[],
  meds: MedicationLog[],
  profile: UserProfile
): ChartPoint[] {
  const sorted = sortLogsAsc(logs);

  // Merge dates from logs and medication logs so medication-only days appear cleanly
  const allDatesSet = new Set<string>(sorted.map((l) => l.date));
  meds.forEach((m) => allDatesSet.add(m.date));
  const allDates = Array.from(allDatesSet).sort((a, b) => a.localeCompare(b));

  const logByDate = new Map(sorted.map((l) => [l.date, l]));
  const medsByDate = new Map<string, MedicationLog[]>();
  meds.forEach((m) => {
    const arr = medsByDate.get(m.date) ?? [];
    arr.push(m);
    medsByDate.set(m.date, arr);
  });

  // Linear regression for weight trend over valid weight points
  const weightPoints: Array<{ x: number; y: number }> = [];
  if (allDates.length > 0) {
    const startDate = allDates[0];
    allDates.forEach((d) => {
      const w = logByDate.get(d)?.weightKg;
      if (w !== null && w !== undefined) {
        weightPoints.push({ x: daysBetweenIso(startDate, d), y: w });
      }
    });
  }

  let slope = 0;
  let intercept = 0;
  let hasTrend = false;
  if (weightPoints.length >= 2) {
    const n = weightPoints.length;
    const sumX = weightPoints.reduce((s, p) => s + p.x, 0);
    const sumY = weightPoints.reduce((s, p) => s + p.y, 0);
    const sumXY = weightPoints.reduce((s, p) => s + p.x * p.y, 0);
    const sumXX = weightPoints.reduce((s, p) => s + p.x * p.x, 0);
    const denom = n * sumXX - sumX * sumX;
    if (denom !== 0) {
      slope = (n * sumXY - sumX * sumY) / denom;
      intercept = (sumY - slope * sumX) / n;
      hasTrend = true;
    }
  }

  return allDates.map((date) => {
    const log = logByDate.get(date);
    const dayMeds = medsByDate.get(date) ?? [];

    // 7-day calendar window moving average strictly over available (non-null) weights
    const windowWeights: number[] = [];
    allDates.forEach((candidateDate) => {
      const diff = daysBetweenIso(candidateDate, date);
      if (diff >= 0 && diff <= 6) {
        const w = logByDate.get(candidateDate)?.weightKg;
        if (w !== null && w !== undefined) {
          windowWeights.push(w);
        }
      }
    });

    const movingAvg7 =
      windowWeights.length > 0
        ? Number((windowWeights.reduce((a, b) => a + b, 0) / windowWeights.length).toFixed(2))
        : null;

    const trendWeight =
      hasTrend && allDates.length > 0
        ? Number((intercept + slope * daysBetweenIso(allDates[0], date)).toFixed(2))
        : null;

    const medPeriod = getMedicationPeriodLabel(date);
    const weightKg = log?.weightKg ?? null;

    return {
      date,
      shortDate: formatShortDate(date),
      weightKg,
      movingAvg7,
      trendWeight,
      calories: log?.calories ?? null,
      estimatedTdee: profile.estimatedTdee,
      proteinG: log?.proteinG ?? null,
      carbsG: log?.carbsG ?? null,
      fatG: log?.fatG ?? null,
      activeCalories: log?.activeCalories ?? null,
      steps: log?.steps ?? null,
      exerciseDurationMin: log?.exerciseDurationMin ?? null,
      medPeriod,
      mounjaroWeight: medPeriod === 'Mounjaro' ? weightKg : null,
      retatrutidaWeight: medPeriod === 'Retatrutida' ? weightKg : null,
      medBadge:
        dayMeds.length > 0
          ? dayMeds.map((m) => `${m.medName} ${m.volumeMl} ml`).join(' · ')
          : null,
    };
  });
}

export interface DashboardSummary {
  initialWeight: number | null;
  initialWeightDate: string | null;
  latestWeight: number | null;
  latestWeightDate: string | null;
  targetWeight: number;
  kilosLost: number | null;
  kilosRemaining: number | null;
  progressPercent: number;
  avgCalories: number | null;
  caloriesCount: number;
  avgProtein: number | null;
  proteinCount: number;
  avgFat: number | null;
  fatCount: number;
  avgCarbs: number | null;
  carbsCount: number;
  avgActiveCalories: number | null;
  activeCount: number;
  avgEstimatedDeficit: number | null;
  weeklyDeltaKg: number | null;
  bmrCurrent: number;
  bmrReference: number;
}

export function computeDashboardSummary(
  logs: DailyLog[],
  profile: UserProfile
): DashboardSummary {
  const sorted = sortLogsAsc(logs);
  const weightEntries = sorted.filter((l) => l.weightKg !== null);

  const initialEntry = weightEntries[0] ?? null;
  const latestEntry = weightEntries[weightEntries.length - 1] ?? null;

  const initialWeight = initialEntry?.weightKg ?? null;
  const latestWeight = latestEntry?.weightKg ?? null;
  const targetWeight = Number((profile.referenceWeightKg - profile.targetLossKg).toFixed(2));

  const kilosLost =
    initialWeight !== null && latestWeight !== null
      ? Number((initialWeight - latestWeight).toFixed(2))
      : null;

  const kilosRemaining =
    latestWeight !== null ? Number((latestWeight - targetWeight).toFixed(2)) : null;

  // Progress from starting weight (or reference weight if no initial weight) toward targetWeight
  const baselineForProgress = initialWeight ?? profile.referenceWeightKg;
  const totalToLoseFromStart = Math.max(0.1, baselineForProgress - targetWeight);
  const lostFromStart = latestWeight !== null ? baselineForProgress - latestWeight : 0;
  const progressPercent = Math.max(0, Math.min(100, (lostFromStart / totalToLoseFromStart) * 100));

  const calAvg = averageNonNull(sorted.map((l) => l.calories));
  const proAvg = averageNonNull(sorted.map((l) => l.proteinG));
  const fatAvg = averageNonNull(sorted.map((l) => l.fatG));
  const carbAvg = averageNonNull(sorted.map((l) => l.carbsG));
  const actAvg = averageNonNull(sorted.map((l) => l.activeCalories));

  const avgEstimatedDeficit =
    calAvg.avg !== null ? Math.round(profile.estimatedTdee - calAvg.avg) : null;

  // Weekly evolution: compare latest 7-day calendar window average vs previous 7-day window (or delta over last 7 days)
  let weeklyDeltaKg: number | null = null;
  if (latestEntry) {
    const latestDate = latestEntry.date;
    const currentWeekWeights = weightEntries
      .filter((w) => {
        const diff = daysBetweenIso(w.date, latestDate);
        return diff >= 0 && diff <= 6;
      })
      .map((w) => w.weightKg!);

    const prevWeekWeights = weightEntries
      .filter((w) => {
        const diff = daysBetweenIso(w.date, latestDate);
        return diff >= 7 && diff <= 13;
      })
      .map((w) => w.weightKg!);

    if (currentWeekWeights.length > 0 && prevWeekWeights.length > 0) {
      const curAvg = currentWeekWeights.reduce((a, b) => a + b, 0) / currentWeekWeights.length;
      const prevAvg = prevWeekWeights.reduce((a, b) => a + b, 0) / prevWeekWeights.length;
      weeklyDeltaKg = Number((curAvg - prevAvg).toFixed(2));
    } else if (weightEntries.length >= 2) {
      const targetLookback = weightEntries.find((w) => daysBetweenIso(w.date, latestDate) <= 7);
      if (targetLookback && latestWeight !== null && targetLookback.weightKg !== null) {
        weeklyDeltaKg = Number((latestWeight - targetLookback.weightKg).toFixed(2));
      }
    }
  }

  return {
    initialWeight,
    initialWeightDate: initialEntry?.date ?? null,
    latestWeight,
    latestWeightDate: latestEntry?.date ?? null,
    targetWeight,
    kilosLost,
    kilosRemaining,
    progressPercent,
    avgCalories: calAvg.avg !== null ? Math.round(calAvg.avg) : null,
    caloriesCount: calAvg.count,
    avgProtein: proAvg.avg !== null ? Math.round(proAvg.avg) : null,
    proteinCount: proAvg.count,
    avgFat: fatAvg.avg !== null ? Math.round(fatAvg.avg) : null,
    fatCount: fatAvg.count,
    avgCarbs: carbAvg.avg !== null ? Math.round(carbAvg.avg) : null,
    carbsCount: carbAvg.count,
    avgActiveCalories: actAvg.avg !== null ? Math.round(actAvg.avg) : null,
    activeCount: actAvg.count,
    avgEstimatedDeficit,
    weeklyDeltaKg,
    bmrCurrent: calculateBmrMifflinStJeor(profile, latestWeight),
    bmrReference: calculateBmrMifflinStJeor(profile, profile.referenceWeightKg),
  };
}

export interface PeriodComparisonStats {
  label: string;
  dateRangeText: string;
  startDate: string;
  endDate: string | null;
  durationDays: number;
  totalRecords: number;
  weightRecordsCount: number;
  startWeight: number | null;
  latestWeight: number | null;
  deltaKg: number | null;
  deltaPercent: number | null;
  avgCalories: number | null;
  avgProtein: number | null;
  avgCarbs: number | null;
  avgFat: number | null;
  avgActiveCalories: number | null;
  medCount: number;
  totalVolumeMl: number;
}

export function computePeriodComparison(
  logs: DailyLog[],
  meds: MedicationLog[],
  label: string,
  startDate: string,
  endDate: string | null
): PeriodComparisonStats {
  const sortedLogs = sortLogsAsc(logs).filter((l) => {
    if (l.date < startDate) return false;
    if (endDate && l.date > endDate) return false;
    return true;
  });

  const periodMeds = meds.filter((m) => {
    if (m.date < startDate) return false;
    if (endDate && m.date > endDate) return false;
    return true;
  });

  const weights = sortedLogs.filter((l) => l.weightKg !== null);
  const startWeight = weights[0]?.weightKg ?? null;
  const latestWeight = weights[weights.length - 1]?.weightKg ?? null;

  const deltaKg =
    startWeight !== null && latestWeight !== null && weights.length >= 2
      ? Number((latestWeight - startWeight).toFixed(2))
      : null;

  const deltaPercent =
    deltaKg !== null && startWeight !== null && startWeight > 0
      ? Number(((deltaKg / startWeight) * 100).toFixed(2))
      : null;

  const cal = averageNonNull(sortedLogs.map((l) => l.calories));
  const pro = averageNonNull(sortedLogs.map((l) => l.proteinG));
  const carb = averageNonNull(sortedLogs.map((l) => l.carbsG));
  const fat = averageNonNull(sortedLogs.map((l) => l.fatG));
  const act = averageNonNull(sortedLogs.map((l) => l.activeCalories));

  const lastKnownDate =
    endDate ??
    (sortedLogs.length > 0
      ? sortedLogs[sortedLogs.length - 1].date
      : periodMeds.length > 0
      ? periodMeds[periodMeds.length - 1].date
      : startDate);

  const durationDays = Math.max(1, daysBetweenIso(startDate, lastKnownDate) + 1);

  return {
    label,
    dateRangeText: endDate
      ? `${formatFullDateEs(startDate)} – ${formatFullDateEs(endDate)}`
      : `Desde ${formatFullDateEs(startDate)}`,
    startDate,
    endDate,
    durationDays,
    totalRecords: new Set([...sortedLogs.map((l) => l.date), ...periodMeds.map((m) => m.date)]).size,
    weightRecordsCount: weights.length,
    startWeight,
    latestWeight,
    deltaKg,
    deltaPercent,
    avgCalories: cal.avg !== null ? Math.round(cal.avg) : null,
    avgProtein: pro.avg !== null ? Math.round(pro.avg) : null,
    avgCarbs: carb.avg !== null ? Math.round(carb.avg) : null,
    avgFat: fat.avg !== null ? Math.round(fat.avg) : null,
    avgActiveCalories: act.avg !== null ? Math.round(act.avg) : null,
    medCount: periodMeds.length,
    totalVolumeMl: Number(periodMeds.reduce((s, m) => s + m.volumeMl, 0).toFixed(2)),
  };
}

export interface WindowAverages {
  label: string;
  calories: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  activeCalories: number | null;
  steps: number | null;
  exerciseMin: number | null;
  daysWithData: number;
}

export function computeWindowAverages(logs: DailyLog[], windowDays: number | 'all', label: string): WindowAverages {
  const sorted = sortLogsAsc(logs);
  if (sorted.length === 0) {
    return {
      label,
      calories: null,
      proteinG: null,
      carbsG: null,
      fatG: null,
      activeCalories: null,
      steps: null,
      exerciseMin: null,
      daysWithData: 0,
    };
  }

  const latestDate = sorted[sorted.length - 1].date;
  const subset =
    windowDays === 'all'
      ? sorted
      : sorted.filter((l) => daysBetweenIso(l.date, latestDate) < windowDays);

  const cal = averageNonNull(subset.map((l) => l.calories));
  const pro = averageNonNull(subset.map((l) => l.proteinG));
  const carb = averageNonNull(subset.map((l) => l.carbsG));
  const fat = averageNonNull(subset.map((l) => l.fatG));
  const act = averageNonNull(subset.map((l) => l.activeCalories));
  const stp = averageNonNull(subset.map((l) => l.steps));
  const ex = averageNonNull(subset.map((l) => l.exerciseDurationMin));

  return {
    label,
    calories: cal.avg !== null ? Math.round(cal.avg) : null,
    proteinG: pro.avg !== null ? Math.round(pro.avg) : null,
    carbsG: carb.avg !== null ? Math.round(carb.avg) : null,
    fatG: fat.avg !== null ? Math.round(fat.avg) : null,
    activeCalories: act.avg !== null ? Math.round(act.avg) : null,
    steps: stp.avg !== null ? Math.round(stp.avg) : null,
    exerciseMin: ex.avg !== null ? Math.round(ex.avg) : null,
    daysWithData: subset.length,
  };
}
