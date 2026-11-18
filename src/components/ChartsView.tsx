import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { DailyLog, DateRangePreset, MedicationLog, UserProfile } from '../types/retafit';
import {
  buildChartSeries,
  computePeriodComparison,
  formatFullDateEs,
  MOUNJARO_END,
  MOUNJARO_START,
  RETATRUTIDA_START,
} from '../lib/calculations';

interface ChartsViewProps {
  logs: DailyLog[];
  meds: MedicationLog[];
  profile: UserProfile;
}

function shiftIsoDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays));
  return dt.toISOString().slice(0, 10);
}

function fmt(val: number | null, unit = '', dec = 0): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  return `${val.toLocaleString('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })}${unit ? ` ${unit}` : ''}`;
}

export const ChartsView: React.FC<ChartsViewProps> = ({ logs, meds, profile }) => {
  const [preset, setPreset] = useState<DateRangePreset>('all');
  const [customStart, setCustomStart] = useState('2026-11-04');
  const [customEnd, setCustomEnd] = useState('2026-11-30');

  const fullSeries = useMemo(() => buildChartSeries(logs, meds, profile), [logs, meds, profile]);

  const filteredSeries = useMemo(() => {
    if (fullSeries.length === 0) return [];
    if (preset === 'all') return fullSeries;

    const latestDate = fullSeries[fullSeries.length - 1].date;
    if (preset === 'custom') {
      return fullSeries.filter(
        (p) => (!customStart || p.date >= customStart) && (!customEnd || p.date <= customEnd)
      );
    }

    const days = preset === '7d' ? 6 : preset === '30d' ? 29 : 89;
    const cutoff = shiftIsoDate(latestDate, -days);
    return fullSeries.filter((p) => p.date >= cutoff);
  }, [fullSeries, preset, customStart, customEnd]);

  const weightDomain = useMemo(() => {
    const vals = filteredSeries
      .flatMap((d) => [d.weightKg, d.movingAvg7])
      .filter((v): v is number => v !== null);
    if (vals.length === 0) return [70, 100];
    return [Math.floor(Math.min(...vals) - 1), Math.ceil(Math.max(...vals) + 1)];
  }, [filteredSeries]);

  const mounjaroStats = useMemo(
    () => computePeriodComparison(logs, meds, 'Mounjaro', MOUNJARO_START, MOUNJARO_END),
    [logs, meds]
  );

  const retatrutidaStats = useMemo(
    () => computePeriodComparison(logs, meds, 'Retatrutida', RETATRUTIDA_START, null),
    [logs, meds]
  );

  const periodBarData = useMemo(
    () => [
      {
        metric: 'Calorías (kcal)',
        Mounjaro: mounjaroStats.avgCalories ?? 0,
        Retatrutida: retatrutidaStats.avgCalories ?? 0,
      },
      {
        metric: 'Cal. activas',
        Mounjaro: mounjaroStats.avgActiveCalories ?? 0,
        Retatrutida: retatrutidaStats.avgActiveCalories ?? 0,
      },
      {
        metric: 'Proteínas (g)',
        Mounjaro: mounjaroStats.avgProtein ?? 0,
        Retatrutida: retatrutidaStats.avgProtein ?? 0,
      },
      {
        metric: 'Hidratos (g)',
        Mounjaro: mounjaroStats.avgCarbs ?? 0,
        Retatrutida: retatrutidaStats.avgCarbs ?? 0,
      },
      {
        metric: 'Grasas (g)',
        Mounjaro: mounjaroStats.avgFat ?? 0,
        Retatrutida: retatrutidaStats.avgFat ?? 0,
      },
    ],
    [mounjaroStats, retatrutidaStats]
  );

  const tooltipStyle = {
    backgroundColor: '#080B08',
    border: '1px solid #354435',
    borderRadius: '10px',
    fontSize: '12px',
    color: '#FFFFFF',
  };

  return (
    <div className="space-y-6">
      {/* Header & Range Selector */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Gráficas y comparativa
          </h1>
          <p className="text-xs text-[#A0A0A0] mt-1">
            Visualización de evolución ponderal, macros, gasto energético y periodos de medicación.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#191F19] border border-[#2a342a]">
            {[
              { id: '7d' as const, label: '7 días' },
              { id: '30d' as const, label: '30 días' },
              { id: '90d' as const, label: '90 días' },
              { id: 'all' as const, label: 'Todo' },
              { id: 'custom' as const, label: 'Personalizado' },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPreset(item.id)}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                  preset === item.id
                    ? 'bg-[#B7FF00] text-black'
                    : 'text-[#A0A0A0] hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {preset === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="min-h-[38px] px-2.5 rounded-lg bg-[#191F19] border border-[#2a342a] text-xs font-mono text-white"
              />
              <span className="text-xs text-[#A0A0A0]">–</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="min-h-[38px] px-2.5 rounded-lg bg-[#191F19] border border-[#2a342a] text-xs font-mono text-white"
              />
            </div>
          )}
        </div>
      </div>

      {/* Charts 1 & 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Evolución del peso */}
        <ChartCard
          title="1. Evolución del peso"
          subtitle="Pesajes diarios registrados (kg)"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filteredSeries} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
              <defs>
                <linearGradient id="neonFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#B7FF00" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#B7FF00" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#263026" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <YAxis domain={weightDomain} stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area
                type="monotone"
                dataKey="weightKg"
                name="Peso (kg)"
                stroke="#B7FF00"
                strokeWidth={2.5}
                fill="url(#neonFill)"
                dot={{ r: 3.5, fill: '#B7FF00' }}
                connectNulls
              />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 2. Peso diario frente a media móvil de 7 días */}
        <ChartCard
          title="2. Peso diario vs media móvil 7 días"
          subtitle="Suavizado de oscilaciones de agua y glucógeno"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredSeries} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="#263026" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <YAxis domain={weightDomain} stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="weightKg"
                name="Peso diario"
                stroke="#FFFFFF"
                strokeWidth={1.8}
                dot={{ r: 3.5, fill: '#FFFFFF' }}
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
        </ChartCard>

        {/* 3. Calorías ingeridas frente a gasto estimado */}
        <ChartCard
          title="3. Calorías ingeridas vs gasto estimado"
          subtitle={`Referencia de gasto total estimado: ${profile.estimatedTdee} kcal/día`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredSeries} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#263026" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine
                y={profile.estimatedTdee}
                stroke="#FFFFFF"
                strokeDasharray="4 4"
                label={{ value: 'GET', fill: '#A0A0A0', fontSize: 10, position: 'insideTopRight' }}
              />
              <ReferenceLine
                y={profile.targetCalories}
                stroke="#B7FF00"
                strokeOpacity={0.5}
                strokeDasharray="2 3"
              />
              <Bar dataKey="calories" name="Ingeridas (kcal)" fill="#B7FF00" radius={[4, 4, 0, 0]} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 4. Evolución de proteínas */}
        <ChartCard
          title="4. Evolución de proteínas"
          subtitle={`Objetivo diario: ${profile.targetProteinG} g`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#263026" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={profile.targetProteinG} stroke="#FFFFFF" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="proteinG"
                name="Proteínas (g)"
                stroke="#B7FF00"
                strokeWidth={2.5}
                dot={{ r: 3.5, fill: '#B7FF00' }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 5. Evolución de hidratos */}
        <ChartCard
          title="5. Evolución de hidratos de carbono"
          subtitle={`Objetivo diario: ${profile.targetCarbsG} g`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#263026" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={profile.targetCarbsG} stroke="#6E7A6E" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="carbsG"
                name="Hidratos (g)"
                stroke="#FFFFFF"
                strokeWidth={2.2}
                dot={{ r: 3.5, fill: '#FFFFFF' }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 6. Evolución de grasas */}
        <ChartCard
          title="6. Evolución de grasas"
          subtitle={`Objetivo diario: ${profile.targetFatG} g`}
        >
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#263026" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <ReferenceLine y={profile.targetFatG} stroke="#6E7A6E" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey="fatG"
                name="Grasas (g)"
                stroke="#A0A0A0"
                strokeWidth={2.2}
                dot={{ r: 3.5, fill: '#B7FF00' }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 7. Calorías activas */}
        <ChartCard
          title="7. Calorías activas"
          subtitle="Actividad diaria registrada desde reloj / app deportiva"
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filteredSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid stroke="#263026" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <YAxis stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar
                dataKey="activeCalories"
                name="Calorías activas (kcal)"
                fill="#B7FF00"
                radius={[5, 5, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 8. Evolución de peso por periodos de medicación */}
        <ChartCard
          title="8. Peso por periodos de medicación"
          subtitle="Mounjaro (4–16 nov) · Retatrutida (desde 17 nov)"
        >
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={filteredSeries} margin={{ top: 8, right: 12, left: -14, bottom: 0 }}>
              <CartesianGrid stroke="#263026" strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="shortDate" stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <YAxis domain={weightDomain} stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line
                type="monotone"
                dataKey="mounjaroWeight"
                name="Periodo Mounjaro (kg)"
                stroke="#FFFFFF"
                strokeWidth={2.5}
                dot={{ r: 4, fill: '#FFFFFF' }}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="retatrutidaWeight"
                name="Periodo Retatrutida (kg)"
                stroke="#B7FF00"
                strokeWidth={3}
                dot={{ r: 5, fill: '#B7FF00' }}
                connectNulls
              />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* 9. Comparación de medias entre periodos + Tabla comparativa */}
      <section className="rounded-2xl bg-[#191F19] border border-[#263026] p-5 sm:p-6 space-y-6">
        <div>
          <h2 className="font-display text-xl font-bold text-white">
            9. Comparación entre periodos de medicación
          </h2>
          <p className="text-xs text-[#A0A0A0] mt-1">
            Observación descriptiva entre el periodo histórico con Mounjaro ({formatFullDateEs(MOUNJARO_START)} – {formatFullDateEs(MOUNJARO_END)}) y el periodo con Retatrutida (desde {formatFullDateEs(RETATRUTIDA_START)}).
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-5 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={periodBarData} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#263026" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="metric" stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 10 }} tickLine={false} />
                <YAxis stroke="#A0A0A0" tick={{ fill: '#A0A0A0', fontSize: 11 }} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="Mounjaro" name="Mounjaro" fill="#FFFFFF" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Retatrutida" name="Retatrutida" fill="#B7FF00" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="lg:col-span-7 overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs sm:text-sm">
              <thead>
                <tr className="border-b border-[#263026] text-[#A0A0A0]">
                  <th className="py-2.5 pr-4 font-medium">Indicador</th>
                  <th className="py-2.5 px-3 font-semibold text-white text-right">Mounjaro</th>
                  <th className="py-2.5 pl-3 font-semibold text-[#B7FF00] text-right">Retatrutida</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#263026] font-mono tabular-nums">
                {[
                  ['Periodo', '4 – 16 nov 2026', 'Desde 17 nov 2026'],
                  ['Duración', `${mounjaroStats.durationDays} días`, `${retatrutidaStats.durationDays} días`],
                  ['Registros', `${mounjaroStats.totalRecords}`, `${retatrutidaStats.totalRecords}`],
                  ['Peso inicial periodo', fmt(mounjaroStats.startWeight, 'kg', 2), fmt(retatrutidaStats.startWeight, 'kg', 2)],
                  ['Último peso disponible', fmt(mounjaroStats.latestWeight, 'kg', 2), fmt(retatrutidaStats.latestWeight, 'kg', 2)],
                  [
                    'Variación en kg',
                    mounjaroStats.deltaKg !== null ? `${mounjaroStats.deltaKg > 0 ? '+' : ''}${fmt(mounjaroStats.deltaKg, 'kg', 2)}` : '—',
                    retatrutidaStats.deltaKg !== null ? `${retatrutidaStats.deltaKg > 0 ? '+' : ''}${fmt(retatrutidaStats.deltaKg, 'kg', 2)}` : '—',
                  ],
                  [
                    'Variación porcentual',
                    mounjaroStats.deltaPercent !== null ? `${mounjaroStats.deltaPercent > 0 ? '+' : ''}${fmt(mounjaroStats.deltaPercent, '%', 2)}` : '—',
                    retatrutidaStats.deltaPercent !== null ? `${retatrutidaStats.deltaPercent > 0 ? '+' : ''}${fmt(retatrutidaStats.deltaPercent, '%', 2)}` : '—',
                  ],
                  ['Calorías medias', fmt(mounjaroStats.avgCalories, 'kcal'), fmt(retatrutidaStats.avgCalories, 'kcal')],
                  ['Proteínas medias', fmt(mounjaroStats.avgProtein, 'g'), fmt(retatrutidaStats.avgProtein, 'g')],
                  ['Hidratos medios', fmt(mounjaroStats.avgCarbs, 'g'), fmt(retatrutidaStats.avgCarbs, 'g')],
                  ['Grasas medias', fmt(mounjaroStats.avgFat, 'g'), fmt(retatrutidaStats.avgFat, 'g')],
                  ['Calorías activas medias', fmt(mounjaroStats.avgActiveCalories, 'kcal'), fmt(retatrutidaStats.avgActiveCalories, 'kcal')],
                  ['Administraciones (ml)', `${mounjaroStats.medCount} (${mounjaroStats.totalVolumeMl} ml)`, `${retatrutidaStats.medCount} (${retatrutidaStats.totalVolumeMl} ml)`],
                ].map(([label, v1, v2]) => (
                  <tr key={label}>
                    <td className="py-2.5 pr-4 font-sans text-[#A0A0A0]">{label}</td>
                    <td className="py-2.5 px-3 text-white text-right">{v1}</td>
                    <td className="py-2.5 pl-3 text-[#B7FF00] text-right">{v2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-xs text-[#A0A0A0] leading-relaxed border-t border-[#263026] pt-4">
          Nota metodológica: los datos anteriores son observaciones descriptivas de cada periodo. Cuando un periodo cuenta con un único pesaje no se calcula variación dentro del propio tramo (se muestra «—» sin inventar datos). Las variaciones ponderales dependen de múltiples factores simultáneos como ingesta calórica, proteínas, actividad física, hidratación y adherencia, por lo que no deben atribuirse automáticamente de forma exclusiva a la medicación.
        </p>
      </section>
    </div>
  );
};

const ChartCard: React.FC<{
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ title, subtitle, children }) => (
  <div className="rounded-2xl bg-[#191F19] border border-[#263026] p-5 flex flex-col">
    <div className="mb-4">
      <h3 className="font-display text-base font-bold text-white">{title}</h3>
      <p className="text-xs text-[#A0A0A0] mt-0.5">{subtitle}</p>
    </div>
    <div className="h-60 w-full">{children}</div>
  </div>
);
