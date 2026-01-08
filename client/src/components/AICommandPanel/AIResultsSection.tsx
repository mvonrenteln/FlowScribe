import type { ReactNode } from "react";

interface AIResultsSectionProps {
  title: ReactNode;
  meta?: ReactNode;
  children?: ReactNode;
}

export function AIResultsSection({ title, meta, children }: AIResultsSectionProps) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        {meta}
      </div>
      {children}
    </section>
  );
}
