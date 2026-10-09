"use client";
import { useId } from "react";

export function Field({
  label,
  name,
  error,
  hint,
  optional,
  children,
}: {
  label: string;
  name: string;
  error?: string;
  hint?: string;
  optional?: boolean;
  children: (props: { id: string; name: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => React.ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
        {optional && <span className="font-normal text-muted"> (opcional)</span>}
      </label>
      {children({ id, name, "aria-invalid": error ? true : undefined, "aria-describedby": [hintId, errId].filter(Boolean).join(" ") || undefined })}
      {hint && (
        <p id={hintId} className="field-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
