const ITEMS: Array<{ label: string; dot: string }> = [
  { label: 'info', dot: 'bg-zinc-500' },
  { label: 'low', dot: 'bg-emerald-500' },
  { label: 'medium', dot: 'bg-amber-500' },
  { label: 'high', dot: 'bg-orange-500' },
  { label: 'critical', dot: 'bg-red-600' },
];

export default function SeverityLegend() {
  return (
    <div className="flex items-center gap-3 border-b border-zinc-800 bg-[#0a0a0a] px-4 py-2">
      <span className="text-[10px] uppercase tracking-widest text-zinc-500">Severity</span>
      <div className="flex items-center gap-2.5">
        {ITEMS.map((i) => (
          <div key={i.label} className="flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full ${i.dot}`} />
            <span className="text-[10px] text-zinc-400">{i.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
