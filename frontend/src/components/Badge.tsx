export function Badge({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={`badge ${className ?? "badge-gray"}`}>{children}</span>;
}
