import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Kart: 24px iç boşluk, 1px kenarlık; hover'da kenarlık #404040 ve 1px yukarı. */
export function Card({
  className,
  interactive = true,
  children,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { interactive?: boolean; children?: ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[8px] border border-border bg-surface p-6 transition-standard",
        interactive && "hover:-translate-y-px hover:border-border-strong",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn("text-section text-fg", className)}>{children}</h2>;
}
