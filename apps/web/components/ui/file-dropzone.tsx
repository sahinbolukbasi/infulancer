"use client";

import { useId, useState, type DragEvent } from "react";
import { UploadIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

/**
 * Kesikli kenarlıklı yükleme bölgesi; sürükleyince içi dolar.
 * Gerçek <input type=file> görsel olarak gizli ama klavyeyle odaklanabilir.
 */
export function FileDropzone({
  label = "Dosya yükle",
  hint,
  name,
  accept,
  multiple,
  disabled,
  onFiles,
}: {
  label?: string;
  hint?: string;
  name?: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles?: (files: File[]) => void;
}) {
  const id = useId();
  const [dragging, setDragging] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);

  const handle = (list: FileList | null) => {
    const files = list ? Array.from(list) : [];
    setPicked(files.map((f) => f.name));
    if (files.length) onFiles?.(files);
  };

  const onDrop = (e: DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    setDragging(false);
    if (disabled) return;
    const input = document.getElementById(id) as HTMLInputElement | null;
    if (input && e.dataTransfer.files.length) {
      // Form gönderiminde de dosyalar taşınsın.
      input.files = e.dataTransfer.files;
    }
    handle(e.dataTransfer.files);
  };

  return (
    <div>
      <input
        id={id}
        type="file"
        name={name}
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="peer sr-only"
        aria-describedby={hint ? `${id}-hint` : undefined}
        onChange={(e) => handle(e.currentTarget.files)}
      />
      <label
        htmlFor={id}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-[8px] border border-dashed px-6 py-10 text-center transition-standard",
          "peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-fg",
          dragging ? "border-fg bg-surface-hover" : "border-border-strong bg-transparent hover:border-fg-muted",
          disabled && "pointer-events-none opacity-40",
        )}
      >
        <UploadIcon size={24} className="text-fg-muted" />
        <span className="text-sm text-fg">{label}</span>
        <span className="text-[13px] text-fg-passive">Sürükleyip bırakın ya da tıklayarak seçin</span>
        {hint ? (
          <span id={`${id}-hint`} className="text-[12px] text-fg-passive">
            {hint}
          </span>
        ) : null}
        {picked.length ? (
          <span className="text-[13px] text-fg-muted" aria-live="polite">
            {picked.join(", ")}
          </span>
        ) : null}
      </label>
    </div>
  );
}
