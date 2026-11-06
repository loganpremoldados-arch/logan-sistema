import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, Cell, LabelList,
} from "recharts";
import { formatBRL, formatQty } from "../lib/format";

// Brand palette — validated for categorical use (light surface).
// Gray (--cinza-medio) is excluded from data color (fails chroma floor / reads as "no data").
export const COLORS = {
  laranja: "#e85a2a",
  azul: "#2f6fa8",
  verde: "#2f9e5a",
  amarelo: "#d99a1f",
  vermelho: "#d4453a",
  grid: "#e3dfd6",
  axisText: "#808285",
};
export const CATEGORICAL = [COLORS.laranja, COLORS.azul, COLORS.verde, COLORS.amarelo];

const axisStyle = { fontSize: 11.5, fill: COLORS.axisText };
const tooltipStyle = {
  background: "#fff",
  border: `1px solid ${COLORS.grid}`,
  borderRadius: 8,
  fontSize: 12.5,
  boxShadow: "0 2px 10px rgba(26,26,26,0.08)",
};

export function ChartEmpty({ label }: { label?: string }) {
  return <div className="empty-state">{label ?? "Sem dados suficientes para este gráfico ainda."}</div>;
}

function hasAnyValue(rows: any[], keys: string[]): boolean {
  return rows.some((r) => keys.some((k) => Number(r[k]) > 0));
}

// Single-series bar chart over a category axis (months, stages, products…)
export function SimpleBarChart({
  data, xKey, yKey, color = COLORS.laranja, formatter = formatQty, height = 220, layout = "horizontal",
}: {
  data: any[]; xKey: string; yKey: string; color?: string; formatter?: (v: number) => string; height?: number;
  layout?: "horizontal" | "vertical";
}) {
  if (!data || !hasAnyValue(data, [yKey])) return <ChartEmpty />;
  const vertical = layout === "vertical";
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout={layout} margin={{ top: 6, right: 10, left: vertical ? 10 : -14, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={COLORS.grid} strokeDasharray="0" vertical={vertical} horizontal={!vertical} />
        {vertical ? (
          <>
            <XAxis type="number" tick={axisStyle} axisLine={{ stroke: COLORS.grid }} tickLine={false} tickFormatter={(v) => formatter(v)} />
            <YAxis type="category" dataKey={xKey} tick={axisStyle} axisLine={false} tickLine={false} width={150} />
          </>
        ) : (
          <>
            <XAxis dataKey={xKey} tick={axisStyle} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
            <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => formatter(v)} width={54} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatter(v)} cursor={{ fill: "rgba(26,26,26,0.04)" }} />
        <Bar dataKey={yKey} fill={color} radius={vertical ? [0, 4, 4, 0] : [4, 4, 0, 0]} maxBarSize={36} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// Categorical bar chart — one color per bar, direct value labels (mitigates adjacent-hue CVD warning)
export function CategoricalBarChart({
  data, xKey, yKey, formatter = formatBRL, height = 220,
}: { data: any[]; xKey: string; yKey: string; formatter?: (v: number) => string; height?: number }) {
  if (!data || !hasAnyValue(data, [yKey])) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 10, left: -14, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke={COLORS.grid} strokeDasharray="0" vertical={false} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => formatter(v)} width={54} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatter(v)} cursor={{ fill: "rgba(26,26,26,0.04)" }} />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]} maxBarSize={44}>
          {data.map((_, i) => <Cell key={i} fill={CATEGORICAL[i % CATEGORICAL.length]} />)}
          <LabelList dataKey={yKey} position="top" formatter={(v: number) => formatter(v)} style={{ fontSize: 11, fill: "#1a1a1a", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// Single-series line/area trend over months
export function TrendLineChart({
  data, xKey, yKey, color = COLORS.laranja, formatter = formatQty, height = 220,
}: { data: any[]; xKey: string; yKey: string; color?: string; formatter?: (v: number) => string; height?: number }) {
  if (!data || !hasAnyValue(data, [yKey])) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 6, right: 14, left: -14, bottom: 0 }}>
        <CartesianGrid stroke={COLORS.grid} strokeDasharray="0" vertical={false} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => formatter(v)} width={54} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatter(v)} cursor={{ stroke: COLORS.grid }} />
        <Line type="monotone" dataKey={yKey} stroke={color} strokeWidth={2} dot={{ r: 3.5, fill: color, strokeWidth: 0 }} activeDot={{ r: 5 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Two-series grouped bar (e.g. planejado × realizado) — categorical identity, legend + direct labels
export function TwoSeriesBarChart({
  data, xKey, aKey, bKey, aLabel, bLabel, formatter = formatQty, height = 220,
}: {
  data: any[]; xKey: string; aKey: string; bKey: string; aLabel: string; bLabel: string;
  formatter?: (v: number) => string; height?: number;
}) {
  if (!data || !hasAnyValue(data, [aKey, bKey])) return <ChartEmpty />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 10, left: -14, bottom: 0 }} barCategoryGap="30%" barGap={4}>
        <CartesianGrid stroke={COLORS.grid} strokeDasharray="0" vertical={false} />
        <XAxis dataKey={xKey} tick={axisStyle} axisLine={{ stroke: COLORS.grid }} tickLine={false} />
        <YAxis tick={axisStyle} axisLine={false} tickLine={false} tickFormatter={(v) => formatter(v)} width={54} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => formatter(v)} cursor={{ fill: "rgba(26,26,26,0.04)" }} />
        <Legend wrapperStyle={{ fontSize: 12, color: COLORS.axisText }} iconType="circle" iconSize={8} />
        <Bar dataKey={aKey} name={aLabel} fill={COLORS.laranja} radius={[4, 4, 0, 0]} maxBarSize={40}>
          <LabelList dataKey={aKey} position="top" formatter={(v: number) => formatter(v)} style={{ fontSize: 10.5, fill: "#1a1a1a", fontWeight: 600 }} />
        </Bar>
        <Bar dataKey={bKey} name={bLabel} fill={COLORS.azul} radius={[4, 4, 0, 0]} maxBarSize={40}>
          <LabelList dataKey={bKey} position="top" formatter={(v: number) => formatter(v)} style={{ fontSize: 10.5, fill: "#1a1a1a", fontWeight: 600 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
