"use client";

import { useEffect, useId, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { centsToInput, formatQuantity, parseMoneyToCents, parseQuantityToMilli } from "@/lib/money/money";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-white hover:bg-accent-strong disabled:bg-slate-300 disabled:text-slate-500",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:text-slate-400",
  ghost: "text-slate-700 hover:bg-slate-100 disabled:text-slate-400",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:text-red-300",
};

export function Button({ variant = "secondary", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-md px-3 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

const INPUT =
  "h-9 w-full rounded-md border border-slate-300 bg-white px-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25 disabled:bg-slate-100 disabled:text-slate-500 aria-[invalid=true]:border-red-500";

export function Field({ label, error, hint, children, className = "" }: { label: string; error?: string; hint?: string; children: (id: string, describedBy: string | undefined) => ReactNode; className?: string }) {
  const id = useId();
  const messageId = `${id}-message`;
  const message = error ?? hint;
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={id} className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>
      {children(id, message ? messageId : undefined)}
      {message && (
        <p id={messageId} className={`mt-1 text-xs ${error ? "text-red-600" : "text-slate-500"}`}>
          {message}
        </p>
      )}
    </div>
  );
}

export function TextInput({ invalid, className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input {...props} aria-invalid={invalid || undefined} className={`${INPUT} ${className}`} />;
}

export function TextArea({ className = "", ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`${INPUT} h-auto min-h-16 py-1.5 ${className}`} />;
}

export function Select({ className = "", ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${INPUT} pr-7 ${className}`} />;
}

export function Checkbox({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="size-4 accent-accent" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  );
}

// Holds the raw text while typing and commits a parsed integer value on blur, so partial input like "15." is never lost.
function ScaledInput({
  value,
  onCommit,
  parse,
  format,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  value: number | null;
  onCommit: (value: number | null) => void;
  parse: (text: string) => number | null;
  format: (value: number) => string;
}) {
  const [text, setText] = useState(value === null ? "" : format(value));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(value === null ? "" : format(value));
  }, [value, focused, format]);
  const parsed = text.trim() === "" ? null : parse(text);
  const invalid = text.trim() !== "" && parsed === null;
  return (
    <input
      {...props}
      inputMode="decimal"
      value={text}
      aria-invalid={invalid || undefined}
      onFocus={() => setFocused(true)}
      onChange={(event) => setText(event.target.value)}
      onBlur={() => {
        setFocused(false);
        if (!invalid && parsed !== value) onCommit(parsed);
        else setText(value === null ? "" : format(value));
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter") (event.target as HTMLInputElement).blur();
      }}
      className={`${INPUT} text-right tabular-nums ${props.className ?? ""}`}
    />
  );
}

export function MoneyInput(props: Omit<Parameters<typeof ScaledInput>[0], "parse" | "format">) {
  return <ScaledInput {...props} parse={parseMoneyToCents} format={centsToInput} />;
}

export function QuantityInput(props: Omit<Parameters<typeof ScaledInput>[0], "parse" | "format">) {
  return <ScaledInput {...props} parse={parseQuantityToMilli} format={formatQuantity} />;
}

const parseInteger = (text: string) => (/^\d{1,9}$/.test(text.replace(/,/g, "").trim()) ? Number(text.replace(/,/g, "").trim()) : null);
const formatInteger = (value: number) => String(value);

export function IntegerInput(props: Omit<Parameters<typeof ScaledInput>[0], "parse" | "format">) {
  return <ScaledInput {...props} parse={parseInteger} format={formatInteger} />;
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "amber" | "green" | "red" | "blue" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    amber: "bg-amber-50 text-amber-800 ring-amber-200",
    green: "bg-emerald-50 text-emerald-800 ring-emerald-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    blue: "bg-blue-50 text-blue-800 ring-blue-200",
  };
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

export function Panel({ title, actions, children, className = "" }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
      {(title || actions) && (
        <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-2.5">
          {title && <h2 className="text-sm font-semibold text-slate-900">{title}</h2>}
          {actions}
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Alert({ tone = "red", children }: { tone?: "red" | "amber" | "blue" | "green"; children: ReactNode }) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-800",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
  return (
    <div role={tone === "red" ? "alert" : "status"} className={`rounded-md border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}
