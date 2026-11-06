export function StatCard({
  label, value, hint, highlight,
}: { label: string; value: string | number; hint?: string; highlight?: boolean }) {
  return (
    <div className="stat-card">
      <div className="label">{label}</div>
      <div className={`value ${highlight ? "laranja" : ""}`}>{value}</div>
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}
