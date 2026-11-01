import { Children, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Çocuklara 60ms artan gecikmeyle giriş animasyonu uygular. */
export function Stagger({ children, className, step = 60 }: { children: ReactNode; className?: string; step?: number }) {
  return (
    <div className={className}>
      {Children.toArray(children).map((child, i) => (
        <div key={i} className="animate-enter" style={{ animationDelay: `${i * step}ms` } as CSSProperties}>
          {child}
        </div>
      ))}
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="flex flex-col gap-2">
        <h1 className="text-title text-fg">{title}</h1>
        {description ? <p className="text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
