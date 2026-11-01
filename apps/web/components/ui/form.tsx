import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  primary: "bg-fg text-bg hover:bg-fg-muted border border-fg hover:border-fg-muted",
  secondary: "bg-transparent text-fg border border-border hover:border-border-strong hover:bg-surface-hover",
  ghost: "bg-transparent text-fg-muted border border-transparent hover:text-fg hover:bg-surface-hover",
};
const sizeClass: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded-[8px] font-medium whitespace-nowrap transition-standard",
    "disabled:opacity-40 disabled:pointer-events-none",
    variantClass[variant],
    sizeClass[size],
    extra,
  );
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", className, type = "button", ...rest },
  ref,
) {
  return <button ref={ref} type={type} className={buttonClass(variant, size, className)} {...rest} />;
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {children}
    </Link>
  );
}

const controlClass =
  "w-full rounded-[8px] border border-border bg-bg px-3 text-sm text-fg placeholder:text-fg-passive transition-standard hover:border-border-strong focus:border-fg focus:outline-none aria-[invalid=true]:border-critical disabled:opacity-40";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(controlClass, "h-10 tabular-nums", className)} {...rest} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...rest },
  ref,
) {
  return (
    <select ref={ref} className={cn(controlClass, "h-10 appearance-none pr-8", className)} {...rest}>
      {children}
    </select>
  );
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 4, ...rest }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(controlClass, "py-2 leading-relaxed", className)} {...rest} />;
  },
);

/**
 * Etiket + kontrol + yardım/hata metni. Çocuk bir render fonksiyonuysa
 * id ve aria-describedby bağlanır.
 */
export function Field({
  label,
  hint,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  className?: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
}) {
  const id = useId();
  const descId = hint || error ? `${id}-desc` : undefined;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={id} className="text-label text-fg-muted">
        {label}
      </label>
      {children({ id, "aria-describedby": descId, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p id={descId} className="text-[13px] text-critical" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={descId} className="text-[13px] text-fg-passive">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
