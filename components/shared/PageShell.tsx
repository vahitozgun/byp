"use client";
interface PageShellProps { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; }
export function PageShell({ title, subtitle, action, children }: PageShellProps) {
  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-10 bg-white border-b border-zinc-200 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-zinc-900 leading-tight">{title}</h1>
            {subtitle && <p className="text-xs text-zinc-400 mt-0.5">{subtitle}</p>}
          </div>
          {action && <div className="flex-shrink-0">{action}</div>}
        </div>
      </div>
      <main className="flex-1 overflow-y-auto px-4 py-4 pb-24">{children}</main>
    </div>
  );
}
