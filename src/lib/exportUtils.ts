import { DailyLog, MedicationLog, RetafitBackupPayload, UserProfile } from '../types/retafit';
import { sortLogsAsc } from './calculations';

function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportFullBackupJson(
  profile: UserProfile,
  dailyLogs: DailyLog[],
  medicationLogs: MedicationLog[]
): string {
  const exportedAt = new Date().toISOString();
  const payload: RetafitBackupPayload = {
    app: 'RETAFIT',
    version: 1,
    exportedAt,
    profile,
    dailyLogs: sortLogsAsc(dailyLogs),
    medicationLogs: [...medicationLogs].sort((a, b) => a.date.localeCompare(b.date)),
  };

  const stamp = exportedAt.slice(0, 10);
  triggerDownload(
    JSON.stringify(payload, null, 2),
    `retafit-backup-${stamp}.json`,
    'application/json;charset=utf-8'
  );
  return exportedAt;
}

function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportRecordsCsv(
  dailyLogs: DailyLog[],
  medicationLogs: MedicationLog[]
): string {
  const sortedLogs = sortLogsAsc(dailyLogs);
  const medsByDate = new Map<string, MedicationLog[]>();
  medicationLogs.forEach((m) => {
    const arr = medsByDate.get(m.date) ?? [];
    arr.push(m);
    medsByDate.set(m.date, arr);
  });

  const allDates = Array.from(
    new Set([...sortedLogs.map((l) => l.date), ...medicationLogs.map((m) => m.date)])
  ).sort((a, b) => a.localeCompare(b));

  const logByDate = new Map(sortedLogs.map((l) => [l.date, l]));

  const headers = [
    'fecha',
    'peso_kg',
    'calorias_kcal',
    'proteinas_g',
    'hidratos_g',
    'grasas_g',
    'calorias_activas_kcal',
    'pasos',
    'tipo_ejercicio',
    'duracion_min',
    'medicacion',
    'volumen_ml',
    'concentracion_mg_ml',
    'observaciones',
  ];

  const rows = allDates.map((date) => {
    const log = logByDate.get(date);
    const meds = medsByDate.get(date) ?? [];
    const medNames = meds.map((m) => m.medName).join(' + ');
    const medVol = meds.length > 0 ? meds.map((m) => m.volumeMl).join(' + ') : '';
    const medConc = meds.some((m) => m.concentrationMgMl !== null)
      ? meds.map((m) => m.concentrationMgMl ?? '').join(' + ')
      : '';
    const combinedNotes = [log?.notes, ...meds.map((m) => m.notes)]
      .filter((n): n is string => Boolean(n && n.trim()))
      .join(' | ');

    return [
      csvCell(date),
      csvCell(log?.weightKg),
      csvCell(log?.calories),
      csvCell(log?.proteinG),
      csvCell(log?.carbsG),
      csvCell(log?.fatG),
      csvCell(log?.activeCalories),
      csvCell(log?.steps),
      csvCell(log?.exerciseType),
      csvCell(log?.exerciseDurationMin),
      csvCell(medNames),
      csvCell(medVol),
      csvCell(medConc),
      csvCell(combinedNotes),
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(csvContent, `retafit-registros-${stamp}.csv`, 'text/csv;charset=utf-8');
  return new Date().toISOString();
}
