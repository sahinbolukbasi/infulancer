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
        "rounded-[16px] border border-line bg-surface/80 p-6 backdrop-blur transition-standard",
        interactive && "hover:-translate-y-px hover:border-line-strong",
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
