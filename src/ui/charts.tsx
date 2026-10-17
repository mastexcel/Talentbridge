"use client";
/**
 * Graphiques (Recharts). Règles appliquées :
 *  - palette catégorielle validée (scripts dataviz : bande de luminosité, chroma, daltonisme, contraste),
 *    attribuée dans un ORDRE FIXE ; une série garde sa couleur quel que soit le filtre ;
 *  - un seul axe Y ; traits fins ; barres à extrémités arrondies ; grille discrète ;
 *  - info-bulle au survol ; légende dès 2 séries ; tableau des données accessible sous chaque graphique.
 */
import { formatMoney } from "@/domain/money";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const SERIES_COLORS = ["#A13A4A", "#5E8A1E", "#2F6FB5", "#D4640F", "#7C5CB8"] as const;
const INK = "#64748B";
const GRID = "#E5E8EE";

type Datum = Record<string, string | number | null>;
type Series = { key: string; label: string };

const fmtNumber = (v: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(v).replace(/ /g, " ");
/** Formateur : montant (si `currency`, montants en unités mineures) ou nombre. Les fonctions ne traversent pas la frontière serveur/client. */
const formatter = (currency?: string) => (currency ? (v: number) => formatMoney(v, currency) : fmtNumber);

function DataTable({ data, xKey, series, format }: { data: Datum[]; xKey: string; series: Series[]; format: (v: number) => string }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-slate">Voir les données</summary>
      <table className="mt-2 w-full text-left">
        <thead><tr><th className="py-1 pr-2">{xKey === "label" ? "" : xKey}</th>{series.map((s) => <th key={s.key} className="py-1 pr-2">{s.label}</th>)}</tr></thead>
        <tbody>{data.map((d, i) => <tr key={i} className="border-t border-line"><td className="py-1 pr-2">{String(d[xKey])}</td>{series.map((s) => <td key={s.key} className="py-1 pr-2 tabular-nums">{d[s.key] == null ? "—" : format(Number(d[s.key]))}</td>)}</tr>)}</tbody>
      </table>
    </details>
  );
}

function TooltipBox({ active, payload, label, format }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string; format: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-line bg-white px-3 py-2 text-xs shadow-lift">
      {label && <p className="mb-1 font-semibold text-ink">{label}</p>}
      {payload.map((p) => <p key={p.name} className="flex items-center gap-2 text-ink"><span className="h-2 w-2 rounded-full" style={{ background: p.color }} />{p.name} : <strong className="tabular-nums">{format(p.value)}</strong></p>)}
    </div>
  );
}

export function BarChartCard({ data, xKey, series, height = 260, currency, layout = "horizontal", stacked }: { data: Datum[]; xKey: string; series: Series[]; height?: number; currency?: string; layout?: "horizontal" | "vertical"; stacked?: boolean }) {
  const format = formatter(currency);
  if (!data.length) return <p className="py-10 text-center text-sm text-slate">Aucune donnée sur la période.</p>;
  const vertical = layout === "vertical";
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout={layout} margin={{ top: 8, right: 12, left: 4, bottom: 4 }} barCategoryGap="28%">
          <CartesianGrid stroke={GRID} vertical={vertical} horizontal={!vertical} />
          {vertical ? <XAxis type="number" tick={{ fill: INK, fontSize: 11 }} tickFormatter={format} axisLine={false} tickLine={false} /> : <XAxis dataKey={xKey} tick={{ fill: INK, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} />}
          {vertical ? <YAxis type="category" dataKey={xKey} width={120} tick={{ fill: INK, fontSize: 11 }} axisLine={false} tickLine={false} /> : <YAxis tick={{ fill: INK, fontSize: 11 }} tickFormatter={format} axisLine={false} tickLine={false} width={70} />}
          <Tooltip cursor={{ fill: "rgba(23,33,43,0.04)" }} content={<TooltipBox format={format} />} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: INK }} iconType="circle" />}
          {series.map((s, i) => <Bar key={s.key} dataKey={s.key} name={s.label} fill={SERIES_COLORS[i % SERIES_COLORS.length]} stackId={stacked ? "a" : undefined} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} stroke="#fff" strokeWidth={stacked ? 2 : 0} />)}
        </BarChart>
      </ResponsiveContainer>
      <DataTable data={data} xKey={xKey} series={series} format={format} />
    </div>
  );
}

export function LineChartCard({ data, xKey, series, height = 260, currency }: { data: Datum[]; xKey: string; series: Series[]; height?: number; currency?: string }) {
  const format = formatter(currency);
  if (!data.length) return <p className="py-10 text-center text-sm text-slate">Aucune donnée sur la période.</p>;
  return (
    <div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey={xKey} tick={{ fill: INK, fontSize: 11 }} axisLine={{ stroke: GRID }} tickLine={false} />
          <YAxis tick={{ fill: INK, fontSize: 11 }} tickFormatter={format} axisLine={false} tickLine={false} width={70} allowDecimals={false} />
          <Tooltip content={<TooltipBox format={format} />} cursor={{ stroke: INK, strokeDasharray: "3 3" }} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: INK }} iconType="circle" />}
          {series.map((s, i) => <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={SERIES_COLORS[i % SERIES_COLORS.length]} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} activeDot={{ r: 5 }} />)}
        </LineChart>
      </ResponsiveContainer>
      <DataTable data={data} xKey={xKey} series={series} format={format} />
    </div>
  );
}

/** Répartition (≤ 5 parts, au-delà regroupées dans « Autres ») avec étiquettes directes en légende. */
export function DonutCard({ data, height = 240, currency }: { data: { label: string; value: number }[]; height?: number; currency?: string }) {
  const format = formatter(currency);
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const parts = sorted.length > 5 ? [...sorted.slice(0, 4), { label: "Autres", value: sorted.slice(4).reduce((s, d) => s + d.value, 0) }] : sorted;
  const total = parts.reduce((s, d) => s + d.value, 0);
  if (!total) return <p className="py-10 text-center text-sm text-slate">Aucune donnée sur la période.</p>;
  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <div className="h-[200px] w-full sm:w-1/2" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={parts} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="88%" paddingAngle={1} stroke="#fff" strokeWidth={2}>
              {parts.map((p, i) => <Cell key={p.label} fill={SERIES_COLORS[i % SERIES_COLORS.length]} />)}
            </Pie>
            <Tooltip content={<TooltipBox format={format} />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="w-full space-y-1.5 text-sm sm:w-1/2">
        {parts.map((p, i) => <li key={p.label} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES_COLORS[i % SERIES_COLORS.length] }} />{p.label}</span><span className="tabular-nums text-slate">{format(p.value)} · {Math.round((p.value * 100) / total)} %</span></li>)}
      </ul>
    </div>
  );
}

/** Entonnoir de conversion : barres horizontales d'une seule teinte (magnitude) avec taux d'étape. */
export function FunnelCard({ steps }: { steps: { step: string; value: number }[] }) {
  const max = Math.max(1, ...steps.map((s) => s.value));
  return (
    <ol className="space-y-2">
      {steps.map((s, i) => (
        <li key={s.step}>
          <div className="flex justify-between text-sm"><span>{s.step}</span><span className="tabular-nums font-semibold">{fmtNumber(s.value)}{i > 0 && steps[i - 1].value ? <span className="ml-2 text-xs font-normal text-slate">({Math.round((s.value * 100) / steps[i - 1].value)} % de l'étape précédente)</span> : null}</span></div>
          <div className="mt-1 h-3 rounded-full bg-line"><div className="h-full rounded-full" style={{ width: `${(s.value * 100) / max}%`, background: SERIES_COLORS[0], opacity: 1 - i * 0.15 }} /></div>
        </li>
      ))}
    </ol>
  );
}
