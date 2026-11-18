import React, { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Bar,
} from 'recharts';
import { Plus, ArrowRight, Activity, Flame, ShieldCheck } from 'lucide-react';
import { DailyLog, MedicationLog, UserProfile } from '../types/retafit';
import {
  buildChartSeries,
  computeDashboardSummary,
  computeWindowAverages,
  formatFullDateEs,
  sortLogsAsc,
} from '../lib/calculations';

interface DashboardViewProps {
  logs: DailyLog[];
  meds: MedicationLog[];
  profile: UserProfile;
  onNavigateToLog: (date?: string) => void;
  onNavigateToCharts: () => void;
}

function fmtNum(val: number | null, suffix = '', decimals = 0): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return `${val.toLocaleString('es-ES', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}${suffix ? ` ${suffix}` : ''}`;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  logs,
  meds,
  profile,
  onNavigateToLog,
  onNavigateToCharts,
}) => {
  const [nutritionWindow, setNutritionWindow] = useState<'daily' | '7d' | '30d'>('daily');

  const summary = useMemo(() => computeDashboardSummary(logs, profile), [logs, profile]);
  const chartSeries = useMemo(() => buildChartSeries(logs, meds, profile), [logs, meds, profile]);

  const sortedLogs = useMemo(() => sortLogsAsc(logs), [logs]);
  const latestLog = sortedLogs[sortedLogs.length - 1] ?? null;

  const avg7d = useMemo(() => computeWindowAverages(logs, 7, 'Media 7 días'), [logs]);
  const avg30d = useMemo(() => computeWindowAverages(logs, 30, 'Media 30 días'), [logs]);

  const activeNutritionMetrics = useMemo(() => {
    if (nutritionWindow === 'daily') {
      const latestWithNutrition = [...sortedLogs]
        .reverse()
        .find((l) => l.calories !== null || l.proteinG !== null || l.carbsG !== null || l.fatG !== null);
      return {
        subtitle: latestWithNutrition
          ? `Último día con datos (${formatFullDateEs(latestWithNutrition.date)})`
          : 'Sin registros nutricionales',
        calories: latestWithNutrition?.calories ?? null,
        proteinG: latestWithNutrition?.proteinG ?? null,
        carbsG: latestWithNutrition?.carbsG ?? null,
        fatG: latestWithNutrition?.fatG ?? null,
      };
    }
    const win = nutritionWindow === '7d' ? avg7d : avg30d;
    return {
      subtitle: `${win.label} (${win.daysWithData} días con registro)`,
      calories: win.calories,
      proteinG: win.proteinG,
      carbsG: win.carbsG,
      fatG: win.fatG,
    };
  }, [nutritionWindow, sortedLogs, avg7d, avg30d]);

  const macroDistributionData = useMemo(() => {
    const p = activeNutritionMetrics.proteinG ?? 0;
    const c = activeNutritionMetrics.carbsG ?? 0;
    const f = activeNutritionMetrics.fatG ?? 0;
    if (p + c + f === 0) return [];
    return [
      { name: 'Proteínas (kcal)', value: p * 4, grams: p, color: '#B7FF00' },
      { name: 'Hidratos (kcal)', value: c * 4, grams: c, color: '#FFFFFF' },
      { name: 'Grasas (kcal)', value: f * 9, grams: f, color: '#6E7A6E' },
    ];
  }, [activeNutritionMetrics]);

  const exerciseBreakdown = useMemo(() => {
    const counts = new Map<string, { count: number; totalMin: number }>();
    logs.forEach((l) => {
      if (l.exerciseType && l.exerciseType.trim()) {
        const key = l.exerciseType.trim();
        const prev = counts.get(key) ?? { count: 0, totalMin: 0 };
        counts.set(key, {
          count: prev.count + 1,
          totalMin: prev.totalMin + (l.exerciseDurationMin ?? 0),
        });
      }
    });
    return Array.from(counts.entries());
  }, [logs]);

  const weightDomain = useMemo(() => {
    const vals = chartSeries
      .flatMap((d) => [d.weightKg, d.movingAvg7])
      .filter((v): v is number => v !== null);
    if (vals.length === 0) return [70, 100];
    const min = Math.floor(Math.min(...vals) - 1);
    const max = Math.ceil(Math.max(...vals) + 1);
    return [min, max];
  }, [chartSeries]);

  const proteinPctOfTarget =
    activeNutritionMetrics.proteinG !== null && profile.targetProteinG > 0
      ? Math.round((activeNutritionMetrics.proteinG / profile.targetProteinG) * 100)
      : null;

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-mono text-[#A0A0A0]">
            {logs.length} días registrados · {meds.length} administraciones ·{' '}
            {summary.latestWeightDate
              ? `Último peso: ${formatFullDateEs(summary.latestWeightDate)}`
              : 'Sin registros de peso'}
          </p>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight mt-1">
            Panel de progreso
          </h1>
        </div>
        <button
          type="button"
          onClick={() => onNavigateToLog()}
          className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#B7FF00] text-black font-bold text-sm hover:bg-[#c8ff33] active:scale-[0.98] transition-all whitespace-nowrap shrink-0 cursor-pointer shadow-[0_0_24px_rgba(183,255,0,0.16)]"
        >
          <Plus className="w-4 h-4 stroke-[2.5]" />
          <span>Registrar día</span>
        </button>
      </div>

      {/* Hero Goal Progress Card */}
      <section className="rounded-2xl bg-[#191F19] border border-[#2a342a] p-5 sm:p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#A0A0A0]">
              <span>Objetivo de pérdida: {fmtNum(profile.targetLossKg, 'kg', 1)}</span>
              <span aria-hidden="true">·</span>
              <span>Peso referencia: {fmtNum(profile.referenceWeightKg, 'kg', 1)}</span>
              <span aria-hidden="true">·</span>
              <span>Meta final: {fmtNum(summary.targetWeight, 'kg', 1)}</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-display text-4xl sm:text-5xl font-extrabold text-[#B7FF00] tabular-nums">
                {summary.latestWeight !== null ? fmtNum(summary.latestWeight, 'kg', 2) : '—'}
              </span>
              {summary.kilosLost !== null && (
                <span className="text-sm font-medium text-white tabular-nums">
                  {summary.kilosLost >= 0
                    ? `-${fmtNum(summary.kilosLost, 'kg', 2)} desde inicio`
                    : `+${fmtNum(Math.abs(summary.kilosLost), 'kg', 2)} desde inicio`}
                </span>
              )}
            </div>
            <p className="text-xs text-[#A0A0A0] leading-relaxed">
              Las oscilaciones diarias suelen reflejar hidratación, glucógeno y digestión; evalúa la evolución mediante la media móvil de 7 días y no por un único pesaje aislado.
            </p>
          </div>

          <div className="w-full lg:w-96 shrink-0 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-medium">
              <span className="text-[#A0A0A0]">Progreso hacia {fmtNum(summary.targetWeight, 'kg', 1)}</span>
              <span className="font-mono text-[#B7FF00] font-bold tabular-nums">
                {summary.progressPercent.toFixed(1)}%
              </span>
            </div>
            <div className="h-3.5 w-full rounded-full bg-[#080B08] border border-[#2a342a] overflow-hidden p-0.5">
              <div
                className="h-full rounded-full bg-[#B7FF00] transition-all duration-500 shadow-[0_0_12px_rgba(183,255,0,0.45)]"
                style={{ width: `${Math.max(2, summary.progressPercent)}%` }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-[#A0A0A0] font-mono tabular-nums">
              <span>Inicio: {fmtNum(summary.initialWeight, 'kg', 1)}</span>
              <span>
                Pendientes:{' '}
                {summary.kilosRemaining !== null
                  ? fmtNum(Math.max(0, summary.kilosRemaining), 'kg', 2)
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 12 Core Metrics Grid */}
      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: 'Peso actual',
            value: fmtNum(summary.latestWeight, 'kg', 2),
            sub: summary.latestWeightDate ? formatShortLabel(summary.latestWeightDate) : 'Sin dato',
            highlight: true,
          },
          {
            label: 'Peso inicial',
            value: fmtNum(summary.initialWeight, 'kg', 1),
            sub: summary.initialWeightDate ? formatShortLabel(summary.initialWeightDate) : 'Sin dato',
          },
          {
            label: 'Peso objetivo',
            value: fmtNum(summary.targetWeight, 'kg', 1),
            sub: `Meta -${profile.targetLossKg} kg`,
          },
          {
            label: 'Kilos perdidos',
            value:
              summary.kilosLost !== null
                ? `${summary.kilosLost >= 0 ? '-' : '+'}${fmtNum(Math.abs(summary.kilosLost), 'kg', 2)}`
                : '—',
            sub: 'Respecto al inicio',
            highlight: (summary.kilosLost ?? 0) > 0,
          },
          {
            label: 'Kilos pendientes',
            value:
              summary.kilosRemaining !== null
                ? fmtNum(Math.max(0, summary.kilosRemaining), 'kg', 2)
                : '—',
            sub: `Hasta ${summary.targetWeight} kg`,
          },
          {
            label: 'Evolución semanal',
            value:
              summary.weeklyDeltaKg !== null
                ? `${summary.weeklyDeltaKg > 0 ? '+' : ''}${fmtNum(summary.weeklyDeltaKg, 'kg', 2)}`
                : '—',
            sub: 'Media 7d / semana',
            highlight: (summary.weeklyDeltaKg ?? 0) < 0,
          },
          {
            label: 'Media calorías',
            value: fmtNum(summary.avgCalories, 'kcal'),
            sub: `${summary.caloriesCount} días con dato`,
            highlight: true,
          },
          {
            label: 'Media proteínas',
            value: fmtNum(summary.avgProtein, 'g'),
            sub: `Objetivo ${profile.targetProteinG} g`,
            highlight: (summary.avgProtein ?? 0) >= profile.targetProteinG,
          },
          {
            label: 'Media grasas',
            value: fmtNum(summary.avgFat, 'g'),
            sub: `Objetivo ${profile.targetFatG} g`,
          },
          {
            label: 'Media hidratos',
            value: fmtNum(summary.avgCarbs, 'g'),
            sub: `Objetivo ${profile.targetCarbsG} g`,
          },
          {
            label: 'Media cal. activas',
            value: fmtNum(summary.avgActiveCalories, 'kcal'),
            sub: `${summary.activeCount} días reloj`,
          },
          {
            label: 'Déficit estimado',
            value:
              summary.avgEstimatedDeficit !== null
                ? `${summary.avgEstimatedDeficit >= 0 ? '-' : '+'}${fmtNum(Math.abs(summary.avgEstimatedDeficit), 'kcal')}`
                : '—',
            sub: `Frente a ${profile.estimatedTdee} kcal`,
            highlight: (summary.avgEstimatedDeficit ?? 0) > 0,
          },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-2xl bg-[#191F19] border border-[#263026] p-4 flex flex-col justify-between"
          >
            <span className="text-xs text-[#A0A0A0] leading-snug">{kpi.label}</span>
            <span
              className={`font-mono text-xl sm:text-2xl font-bold tabular-nums mt-2 ${
                kpi.highlight ? 'text-[#B7FF00]' : 'text-white'
              }`}
            >
              {kpi.value}
            </span>
            <span className="text-[11px] text-[#A0A0A0] mt-1 truncate">{kpi.sub}</span>
          </div>
        ))}
      </section>

      {/* Main Weight Chart */}
      <section className="rounded-2xl bg-[#191F19] border border-[#263026] p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Evolución del peso y media móvil de 7 días
            </h2>
            <p className="text-xs text-[#A0A0A0] mt-0.5">
              Calculada únicamente sobre los días con pesaje registrado · Línea discontinua: tendencia lineal
            </p>
          </div>
          <button
            type="button"
            onClick={onNavigateToCharts}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B7FF00] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Ver las 9 gráficas</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="h-72 w-full">
          {chartSeries.some((p) => p.weightKg !== null) ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#263026" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="shortDate"
                  stroke="#A0A0A0"
                  tick={{ fill: '#A0A0A0', fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis
                  domain={weightDomain}
                  stroke="#A0A0A0"
                  tick={{ fill: '#A0A0A0', fontSize: 11 }}
                  tickLine={false}
                  tickFormatter={(v) => `${v}`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#080B08',
                    border: '1px solid #354435',
                    borderRadius: '12px',
                    fontSize: '12px',
                    color: '#FFFFFF',
                  }}
                  formatter={(value: unknown, name: unknown) => {
                    const label = String(name ?? '');
                    if (value === null || value === undefined) return ['Ausente', label];
                    return [`${Number(value).toFixed(2)} kg`, label];
                  }}
                  labelFormatter={(label, payload) => {
                    const row = payload?.[0]?.payload;
                    return row?.date
                      ? `${formatFullDateEs(row.date)}${row.medBadge ? ` · ${row.medBadge}` : ''}`
                      : String(label);
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="trendWeight"
                  name="Tendencia general"
                  stroke="#6E7A6E"
                  strokeWidth={1.5}
                  strokeDasharray="5 5"
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="weightKg"
                  name="Peso diario"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  dot={{ r: 4, fill: '#FFFFFF', strokeWidth: 0 }}
                  activeDot={{ r: 6, fill: '#B7FF00' }}
                  connectNulls={false}
                />
                <Line
                  type="monotone"
                  dataKey="movingAvg7"
                  name="Media móvil 7d"
                  stroke="#B7FF00"
                  strokeWidth={3}
                  dot={false}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-[#A0A0A0]">
              Añade al menos un registro de peso para visualizar la evolución.
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-6 text-xs text-[#A0A0A0]">
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-0.5 bg-white inline-block" /> Peso diario
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-1 bg-[#B7FF00] inline-block rounded-full" /> Media móvil 7 días
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="w-3 h-0.5 border-t border-dashed border-[#6E7A6E] inline-block" /> Tendencia
          </span>
        </div>
      </section>

      {/* Nutrition Analysis + Protein Priority */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-2xl bg-[#191F19] border border-[#263026] p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Análisis nutricional</h2>
              <p className="text-xs text-[#A0A0A0] mt-0.5">{activeNutritionMetrics.subtitle}</p>
            </div>
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#080B08] border border-[#263026] self-start">
              {[
                { id: 'daily' as const, label: 'Último día' },
                { id: '7d' as const, label: 'Media 7d' },
                { id: '30d' as const, label: 'Media 30d' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setNutritionWindow(tab.id)}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    nutritionWindow === tab.id
                      ? 'bg-[#B7FF00] text-black'
                      : 'text-[#A0A0A0] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {[
              {
                label: 'Calorías',
                val: activeNutritionMetrics.calories,
                target: profile.targetCalories,
                unit: 'kcal',
                accent: true,
              },
              {
                label: 'Proteínas (prioridad muscular)',
                val: activeNutritionMetrics.proteinG,
                target: profile.targetProteinG,
                unit: 'g',
                accent: true,
              },
              {
                label: 'Hidratos de carbono',
                val: activeNutritionMetrics.carbsG,
                target: profile.targetCarbsG,
                unit: 'g',
                accent: false,
              },
              {
                label: 'Grasas',
                val: activeNutritionMetrics.fatG,
                target: profile.targetFatG,
                unit: 'g',
                accent: false,
              },
            ].map((item) => {
              const pct =
                item.val !== null && item.target > 0
                  ? Math.min(130, Math.round((item.val / item.target) * 100))
                  : 0;
              return (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-medium text-white">{item.label}</span>
                    <span className="font-mono tabular-nums text-[#A0A0A0]">
                      <strong className={item.accent ? 'text-[#B7FF00]' : 'text-white'}>
                        {fmtNum(item.val, item.unit)}
                      </strong>{' '}
                      / {fmtNum(item.target, item.unit)} ({item.val !== null ? `${pct}%` : '—'})
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-[#080B08] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        item.accent ? 'bg-[#B7FF00]' : 'bg-white/80'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Protein priority highlight */}
          <div className="mt-6 pt-5 border-t border-[#263026] flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-[#B7FF00] shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <p className="font-semibold text-white">
                Prioridad proteica para preservar masa muscular:{' '}
                <span className="text-[#B7FF00] font-mono tabular-nums">
                  {proteinPctOfTarget !== null ? `${proteinPctOfTarget}% del objetivo` : 'Sin datos'}
                </span>
              </p>
              <p className="text-[#A0A0A0] mt-0.5">
                {activeNutritionMetrics.proteinG !== null &&
                activeNutritionMetrics.proteinG >= profile.targetProteinG
                  ? `Excelente aporte proteico (${activeNutritionMetrics.proteinG} g frente a ${profile.targetProteinG} g objetivo), ayudando a proteger el tejido magro durante el déficit.`
                  : `Objetivo diario fijado en ${profile.targetProteinG} g/día para favorecer la conservación muscular durante la pérdida de peso.`}
              </p>
            </div>
          </div>
        </div>

        {/* Macro Donut Ring Chart */}
        <div className="rounded-2xl bg-[#191F19] border border-[#263026] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-white">Reparto calórico</h2>
            <p className="text-xs text-[#A0A0A0] mt-0.5">Distribución por macronutrientes</p>
          </div>

          <div className="h-52 w-full my-2">
            {macroDistributionData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroDistributionData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={56}
                    outerRadius={80}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {macroDistributionData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#080B08',
                      border: '1px solid #354435',
                      borderRadius: '10px',
                      fontSize: '12px',
                      color: '#FFFFFF',
                    }}
                    formatter={(val: unknown, _name: unknown, props: { payload?: { grams?: number; name?: string } }) => [
                      `${props?.payload?.grams ?? 0} g (${Math.round(Number(val))} kcal)`,
                      props?.payload?.name ?? '',
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-[#A0A0A0]">
                Sin macros registrados en este periodo.
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-[#263026] pt-4 text-xs">
            {macroDistributionData.map((m) => (
              <div key={m.name} className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-[#A0A0A0]">
                  <span
                    className="w-2.5 h-2.5 rounded-sm inline-block"
                    style={{ backgroundColor: m.color }}
                  />
                  {m.name.replace(' (kcal)', '')}
                </span>
                <span className="font-mono font-semibold text-white tabular-nums">{m.grams} g</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Activity & Energy Balance Explanation */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Physical Activity */}
        <div className="rounded-2xl bg-[#191F19] border border-[#263026] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Actividad física</h2>
              <p className="text-xs text-[#A0A0A0] mt-0.5">
                Calorías activas del reloj frente a peso diario
              </p>
            </div>
            <Activity className="w-5 h-5 text-[#B7FF00]" />
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4 text-xs">
            <div className="border-b border-[#263026] pb-3">
              <span className="text-[#A0A0A0] block">Media 7d activas</span>
              <span className="font-mono text-base font-bold text-[#B7FF00] tabular-nums">
                {fmtNum(avg7d.activeCalories, 'kcal')}
              </span>
            </div>
            <div className="border-b border-[#263026] pb-3">
              <span className="text-[#A0A0A0] block">Pasos medios</span>
              <span className="font-mono text-base font-bold text-white tabular-nums">
                {fmtNum(avg30d.steps)}
              </span>
            </div>
            <div className="border-b border-[#263026] pb-3">
              <span className="text-[#A0A0A0] block">Duración media</span>
              <span className="font-mono text-base font-bold text-white tabular-nums">
                {fmtNum(avg30d.exerciseMin, 'min')}
              </span>
            </div>
          </div>

          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartSeries} margin={{ top: 5, right: 5, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="#263026" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="shortDate" stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
                <YAxis yAxisId="left" stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  domain={weightDomain}
                  hide
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#080B08',
                    border: '1px solid #354435',
                    borderRadius: '10px',
                    fontSize: '12px',
                    color: '#FFFFFF',
                  }}
                />
                <Bar
                  yAxisId="left"
                  dataKey="activeCalories"
                  name="Calorías activas (kcal)"
                  fill="#B7FF00"
                  fillOpacity={0.75}
                  radius={[4, 4, 0, 0]}
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="weightKg"
                  name="Peso (kg)"
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#FFFFFF' }}
                  connectNulls
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <p className="mt-3 text-xs text-[#A0A0A0]">
            {exerciseBreakdown.length > 0
              ? `Sesiones registradas: ${exerciseBreakdown
                  .map(([name, info]) => `${name} (${info.count})`)
                  .join(' · ')}`
              : profile.habitualActivityNote}
          </p>
        </div>

        {/* Energy Balance & BMR Breakdown */}
        <div className="rounded-2xl bg-[#191F19] border border-[#263026] p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-white">Balance energético estimado</h2>
                <p className="text-xs text-[#A0A0A0] mt-0.5">
                  Separación clara sin doble conteo de actividad
                </p>
              </div>
              <Flame className="w-5 h-5 text-[#B7FF00]" />
            </div>

            <div className="divide-y divide-[#263026] text-sm">
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#A0A0A0]">Metabolismo basal (Mifflin-St Jeor)</span>
                <span className="font-mono font-semibold text-white tabular-nums">
                  {fmtNum(summary.bmrCurrent, 'kcal/día')}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#A0A0A0]">Calorías activas registradas (media)</span>
                <span className="font-mono font-semibold text-white tabular-nums">
                  {fmtNum(summary.avgActiveCalories, 'kcal/día')}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#A0A0A0]">Gasto energético total estimado (GET)</span>
                <span className="font-mono font-semibold text-white tabular-nums">
                  {fmtNum(profile.estimatedTdee, 'kcal/día')}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="text-[#A0A0A0]">Calorías ingeridas (media real)</span>
                <span className="font-mono font-semibold text-white tabular-nums">
                  {fmtNum(summary.avgCalories, 'kcal/día')}
                </span>
              </div>
              <div className="py-2.5 flex items-center justify-between">
                <span className="font-medium text-white">Déficit energético estimado</span>
                <span className="font-mono font-bold text-[#B7FF00] tabular-nums">
                  {summary.avgEstimatedDeficit !== null
                    ? `${summary.avgEstimatedDeficit >= 0 ? '-' : '+'}${fmtNum(Math.abs(summary.avgEstimatedDeficit), 'kcal/día')}`
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          <p className="mt-4 text-xs text-[#A0A0A0] leading-relaxed">
            Nota: el gasto energético total ({fmtNum(profile.estimatedTdee, 'kcal/día')}) ya incluye tu actividad habitual estimada, por lo que no se suman automáticamente las calorías activas del reloj encima del GET para evitar doble conteo. El déficit mostrado es una estimación orientativa, no una medición metabólica exacta.
          </p>
        </div>
      </section>

      {latestLog && (
        <div className="text-xs text-[#A0A0A0] flex flex-wrap items-center justify-between gap-2 pt-1">
          <span>
            Último registro completo/parcial: {formatFullDateEs(latestLog.date)}
          </span>
          <button
            type="button"
            onClick={() => onNavigateToLog(latestLog.date)}
            className="text-[#B7FF00] font-medium hover:underline cursor-pointer"
          >
            Editar último día
          </button>
        </div>
      )}
    </div>
  );
};

function formatShortLabel(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}
