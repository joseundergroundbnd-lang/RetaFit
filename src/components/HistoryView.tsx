import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit3, Pill, Trash2 } from 'lucide-react';
import { DailyLog, MedicationLog } from '../types/retafit';
import { formatFullDateEs, getDayCompleteness } from '../lib/calculations';
import { ConfirmDialog } from './ConfirmDialog';

interface HistoryViewProps {
  logs: DailyLog[];
  meds: MedicationLog[];
  onEditDay: (date: string) => void;
  onAddMedicationForDay: (date: string) => void;
  onDeleteDailyLog: (date: string) => Promise<void>;
}

const WEEKDAYS_ES = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

function fmt(val: number | null, unit = '', dec = 0): string {
  if (val === null || val === undefined) return '—';
  return `${val.toLocaleString('es-ES', {
    minimumFractionDigits: dec,
    maximumFractionDigits: dec,
  })}${unit ? ` ${unit}` : ''}`;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  logs,
  meds,
  onEditDay,
  onAddMedicationForDay,
  onDeleteDailyLog,
}) => {
  // Default calendar month to latest available date or current month
  const defaultMonth = useMemo(() => {
    const allDates = [...logs.map((l) => l.date), ...meds.map((m) => m.date)].sort();
    const latest = allDates[allDates.length - 1] ?? new Date().toISOString().slice(0, 10);
    return latest.slice(0, 7); // YYYY-MM
  }, [logs, meds]);

  const [currentMonth, setCurrentMonth] = useState(defaultMonth);
  const [inspectedDate, setInspectedDate] = useState<string>(() => {
    const allDates = [...logs.map((l) => l.date), ...meds.map((m) => m.date)].sort();
    return allDates[allDates.length - 1] ?? new Date().toISOString().slice(0, 10);
  });

  // Filters
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [medFilter, setMedFilter] = useState<'all' | 'Mounjaro' | 'Retatrutida' | 'any_med'>('all');
  const [dateToDelete, setDateToDelete] = useState<string | null>(null);

  const logByDate = useMemo(() => new Map(logs.map((l) => [l.date, l])), [logs]);
  const medsByDate = useMemo(() => {
    const map = new Map<string, MedicationLog[]>();
    meds.forEach((m) => {
      const arr = map.get(m.date) ?? [];
      arr.push(m);
      map.set(m.date, arr);
    });
    return map;
  }, [meds]);

  const calendarCells = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const firstDay = new Date(Date.UTC(year, month - 1, 1));
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
    // Monday = 0 ... Sunday = 6
    const startOffset = (firstDay.getUTCDay() + 6) % 7;

    const cells: Array<{ date: string | null; dayNum: number | null }> = [];
    for (let i = 0; i < startOffset; i++) {
      cells.push({ date: null, dayNum: null });
    }
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${currentMonth}-${String(d).padStart(2, '0')}`;
      cells.push({ date: iso, dayNum: d });
    }
    return cells;
  }, [currentMonth]);

  const monthTitle = useMemo(() => {
    const [year, month] = currentMonth.split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1, 1));
    return dt.toLocaleDateString('es-ES', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  }, [currentMonth]);

  const shiftMonth = (delta: number) => {
    const [year, month] = currentMonth.split('-').map(Number);
    const dt = new Date(Date.UTC(year, month - 1 + delta, 1));
    setCurrentMonth(dt.toISOString().slice(0, 7));
  };

  const filteredDatesList = useMemo(() => {
    const allDates = Array.from(
      new Set([...logs.map((l) => l.date), ...meds.map((m) => m.date)])
    ).sort((a, b) => b.localeCompare(a));

    return allDates.filter((d) => {
      if (filterFrom && d < filterFrom) return false;
      if (filterTo && d > filterTo) return false;
      const dayMeds = medsByDate.get(d) ?? [];
      if (medFilter === 'any_med' && dayMeds.length === 0) return false;
      if (
        (medFilter === 'Mounjaro' || medFilter === 'Retatrutida') &&
        !dayMeds.some((m) => m.medName.toLowerCase().includes(medFilter.toLowerCase()))
      ) {
        return false;
      }
      return true;
    });
  }, [logs, meds, filterFrom, filterTo, medFilter, medsByDate]);

  const inspectedLog = logByDate.get(inspectedDate);
  const inspectedMeds = medsByDate.get(inspectedDate) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
          Historial y calendario
        </h1>
        <p className="text-xs text-[#A0A0A0] mt-1">
          Consulta cualquier fecha, verifica registros completos o parciales y filtra por medicación.
        </p>
      </div>

      {/* Calendar + Day Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-2xl bg-[#191F19] border border-[#263026] p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-lg font-bold text-white capitalize">{monthTitle}</h2>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                className="min-h-[40px] min-w-[40px] rounded-xl bg-[#080B08] border border-[#2c362c] flex items-center justify-center text-white hover:border-[#B7FF00] cursor-pointer"
                aria-label="Mes anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                className="min-h-[40px] min-w-[40px] rounded-xl bg-[#080B08] border border-[#2c362c] flex items-center justify-center text-white hover:border-[#B7FF00] cursor-pointer"
                aria-label="Mes siguiente"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-mono text-[#A0A0A0] mb-2">
            {WEEKDAYS_ES.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {calendarCells.map((cell, idx) => {
              if (!cell.date || !cell.dayNum) {
                return <div key={`empty-${idx}`} className="h-12 sm:h-14" />;
              }

              const log = logByDate.get(cell.date);
              const dayMeds = medsByDate.get(cell.date) ?? [];
              const completeness = getDayCompleteness(log);
              const isSelected = cell.date === inspectedDate;

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setInspectedDate(cell.date!)}
                  className={`relative h-12 sm:h-14 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#B7FF00] text-black border-[#B7FF00] font-bold'
                      : completeness === 'complete'
                      ? 'bg-[#080B08] text-white border-[#B7FF00]/45 hover:border-[#B7FF00]'
                      : completeness === 'partial'
                      ? 'bg-[#080B08] text-white border-[#3f4b3f] hover:border-white/50'
                      : dayMeds.length > 0
                      ? 'bg-[#080B08] text-white border-[#B7FF00]/40'
                      : 'bg-[#080B08]/40 text-[#596459] border-[#1f261f] hover:border-[#2e382e]'
                  }`}
                >
                  <span className="font-mono text-xs sm:text-sm tabular-nums">{cell.dayNum}</span>
                  <div className="flex items-center gap-1 mt-0.5 h-2">
                    {completeness === 'complete' && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-black' : 'bg-[#B7FF00]'
                        }`}
                        title="Registro completo"
                      />
                    )}
                    {completeness === 'partial' && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          isSelected ? 'bg-black/70' : 'bg-white/70'
                        }`}
                        title="Registro parcial"
                      />
                    )}
                    {dayMeds.length > 0 && (
                      <Pill
                        className={`w-2.5 h-2.5 ${
                          isSelected ? 'text-black' : 'text-[#B7FF00]'
                        }`}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="mt-4 pt-3 border-t border-[#263026] flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-[#A0A0A0]">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#B7FF00]" /> Completo
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-white/70" /> Parcial
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Pill className="w-3 h-3 text-[#B7FF00]" /> Medicación
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm border border-[#2e382e]" /> Sin datos
            </span>
          </div>
        </div>

        {/* Selected Date Detail Panel */}
        <div className="lg:col-span-5 rounded-2xl bg-[#191F19] border border-[#263026] p-5 flex flex-col justify-between space-y-5">
          <div>
            <div className="flex items-start justify-between gap-3 pb-4 border-b border-[#263026]">
              <div>
                <span className="text-xs font-mono text-[#A0A0A0]">{inspectedDate}</span>
                <h3 className="font-display text-xl font-bold text-white mt-0.5">
                  {formatFullDateEs(inspectedDate)}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEditDay(inspectedDate)}
                  className="min-h-[40px] px-3.5 rounded-xl bg-[#B7FF00] text-black text-xs font-bold inline-flex items-center gap-1.5 hover:bg-[#c8ff33] whitespace-nowrap cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{inspectedLog ? 'Editar día' : 'Registrar'}</span>
                </button>
              </div>
            </div>

            {!inspectedLog && inspectedMeds.length === 0 ? (
              <div className="py-10 text-center space-y-3">
                <p className="text-sm text-[#A0A0A0]">No hay datos registrados para esta fecha.</p>
                <button
                  type="button"
                  onClick={() => onAddMedicationForDay(inspectedDate)}
                  className="min-h-[40px] px-4 rounded-xl bg-[#080B08] border border-[#2c362c] text-xs font-medium text-white hover:border-[#B7FF00] cursor-pointer"
                >
                  Añadir medicación en esta fecha
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-4">
                {inspectedLog && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      ['Peso', fmt(inspectedLog.weightKg, 'kg', 2)],
                      ['Calorías', fmt(inspectedLog.calories, 'kcal')],
                      ['Proteínas', fmt(inspectedLog.proteinG, 'g')],
                      ['Hidratos', fmt(inspectedLog.carbsG, 'g')],
                      ['Grasas', fmt(inspectedLog.fatG, 'g')],
                      ['Cal. activas', fmt(inspectedLog.activeCalories, 'kcal')],
                      ['Pasos', fmt(inspectedLog.steps)],
                      [
                        'Ejercicio',
                        inspectedLog.exerciseType
                          ? `${inspectedLog.exerciseType}${
                              inspectedLog.exerciseDurationMin
                                ? ` (${inspectedLog.exerciseDurationMin} min)`
                                : ''
                            }`
                          : '—',
                      ],
                    ].map(([k, v]) => (
                      <div key={k} className="border-b border-[#263026] pb-2">
                        <span className="text-[#A0A0A0] block">{k}</span>
                        <span className="font-mono text-sm font-semibold text-white tabular-nums">
                          {v}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {inspectedLog?.notes && (
                  <div className="text-xs text-[#A0A0A0] bg-[#080B08] rounded-xl p-3 border border-[#263026]">
                    <span className="text-white font-medium block mb-1">Observaciones</span>
                    {inspectedLog.notes}
                  </div>
                )}

                {inspectedMeds.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#263026]">
                    <span className="text-xs font-semibold text-[#B7FF00] block">
                      Administración de medicación
                    </span>
                    {inspectedMeds.map((m) => (
                      <div
                        key={m.id}
                        className="text-xs bg-[#080B08] rounded-xl p-3 border border-[#B7FF00]/25"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-white">{m.medName}</span>
                          <span className="font-mono font-bold text-[#B7FF00] tabular-nums">
                            {m.volumeMl} ml
                          </span>
                        </div>
                        {m.concentrationMgMl !== null && (
                          <p className="text-[#A0A0A0] mt-1 font-mono">
                            Concentración: {m.concentrationMgMl} mg/ml
                          </p>
                        )}
                        {m.notes && <p className="text-[#A0A0A0] mt-1">{m.notes}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {inspectedLog && (
            <div className="pt-3 border-t border-[#263026] flex items-center justify-between">
              <button
                type="button"
                onClick={() => onAddMedicationForDay(inspectedDate)}
                className="text-xs font-medium text-[#B7FF00] hover:underline cursor-pointer"
              >
                + Añadir medicación
              </button>
              <button
                type="button"
                onClick={() => setDateToDelete(inspectedDate)}
                className="text-xs font-medium text-red-400 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar registro</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Filters & Complete Table */}
      <section className="rounded-2xl bg-[#191F19] border border-[#263026] p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <h2 className="font-display text-lg font-bold text-white">
            Listado de registros ({filteredDatesList.length})
          </h2>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              value={filterFrom}
              onChange={(e) => setFilterFrom(e.target.value)}
              aria-label="Filtrar desde fecha"
              className="min-h-[40px] px-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-xs font-mono text-white"
            />
            <span className="text-xs text-[#A0A0A0]">a</span>
            <input
              type="date"
              value={filterTo}
              onChange={(e) => setFilterTo(e.target.value)}
              aria-label="Filtrar hasta fecha"
              className="min-h-[40px] px-3 rounded-xl bg-[#080B08] border border-[#2c362c] text-xs font-mono text-white"
            />
            <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#080B08] border border-[#2c362c]">
              {[
                { id: 'all' as const, label: 'Todos' },
                { id: 'Mounjaro' as const, label: 'Mounjaro' },
                { id: 'Retatrutida' as const, label: 'Retatrutida' },
                { id: 'any_med' as const, label: 'Con med.' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMedFilter(tab.id)}
                  className={`min-h-[32px] px-2.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    medFilter === tab.id
                      ? 'bg-[#B7FF00] text-black'
                      : 'text-[#A0A0A0] hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {(filterFrom || filterTo || medFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setFilterFrom('');
                  setFilterTo('');
                  setMedFilter('all');
                }}
                className="text-xs text-[#B7FF00] hover:underline px-2 cursor-pointer"
              >
                Limpiar
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#263026] text-[#A0A0A0]">
                <th className="py-3 pr-3 font-medium">Fecha</th>
                <th className="py-3 px-2 font-medium text-right">Peso</th>
                <th className="py-3 px-2 font-medium text-right">Calorías</th>
                <th className="py-3 px-2 font-medium text-right">Prot.</th>
                <th className="py-3 px-2 font-medium text-right">Hidr.</th>
                <th className="py-3 px-2 font-medium text-right">Gras.</th>
                <th className="py-3 px-2 font-medium text-right">Activas</th>
                <th className="py-3 pl-3 font-medium">Medicación</th>
                <th className="py-3 pl-2 text-right font-medium">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#263026] font-mono tabular-nums">
              {filteredDatesList.map((date) => {
                const log = logByDate.get(date);
                const dayMeds = medsByDate.get(date) ?? [];
                return (
                  <tr
                    key={date}
                    onClick={() => setInspectedDate(date)}
                    className={`hover:bg-[#080B08]/60 transition-colors cursor-pointer ${
                      inspectedDate === date ? 'bg-[#080B08]/80' : ''
                    }`}
                  >
                    <td className="py-3 pr-3 text-white whitespace-nowrap">
                      {formatFullDateEs(date)}
                    </td>
                    <td className="py-3 px-2 text-right text-[#B7FF00] font-semibold whitespace-nowrap">
                      {fmt(log?.weightKg ?? null, 'kg', 2)}
                    </td>
                    <td className="py-3 px-2 text-right text-white whitespace-nowrap">
                      {fmt(log?.calories ?? null)}
                    </td>
                    <td className="py-3 px-2 text-right text-white whitespace-nowrap">
                      {fmt(log?.proteinG ?? null, 'g')}
                    </td>
                    <td className="py-3 px-2 text-right text-[#A0A0A0] whitespace-nowrap">
                      {fmt(log?.carbsG ?? null, 'g')}
                    </td>
                    <td className="py-3 px-2 text-right text-[#A0A0A0] whitespace-nowrap">
                      {fmt(log?.fatG ?? null, 'g')}
                    </td>
                    <td className="py-3 px-2 text-right text-white whitespace-nowrap">
                      {fmt(log?.activeCalories ?? null)}
                    </td>
                    <td className="py-3 pl-3 font-sans text-[#B7FF00] whitespace-nowrap">
                      {dayMeds.length > 0
                        ? dayMeds.map((m) => `${m.medName} (${m.volumeMl} ml)`).join(' · ')
                        : '—'}
                    </td>
                    <td className="py-3 pl-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditDay(date);
                        }}
                        className="text-xs font-sans font-semibold text-[#B7FF00] hover:underline px-2 py-1 cursor-pointer"
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredDatesList.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-8 text-center font-sans text-[#A0A0A0]">
                    No hay registros que coincidan con el filtro aplicado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(dateToDelete)}
        danger
        title={dateToDelete ? `Eliminar ${formatFullDateEs(dateToDelete)}` : ''}
        description="Se eliminarán los datos diarios de esta fecha. La medicación asociada puede gestionarse desde Registro > Medicación."
        confirmLabel="Eliminar"
        onCancel={() => setDateToDelete(null)}
        onConfirm={async () => {
          if (dateToDelete) {
            await onDeleteDailyLog(dateToDelete);
            setDateToDelete(null);
          }
        }}
      />
    </div>
  );
};
