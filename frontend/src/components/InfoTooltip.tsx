import { useState, type ReactNode } from "react";

type Entry = { simple: string; technical?: string; example?: string };

interface InfoTooltipProps {
  term: string;
  simple?: string;
  technical?: string;
  example?: string;
}

export function InfoTooltip({ term, simple, technical, example }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const glossary = typeof window !== "undefined" ? window.GLOSSARY?.[term] : undefined;
  const s = simple || glossary?.simple || "No definition yet";
  const t = technical || glossary?.technical;
  const ex = example || glossary?.example;

  return (
    <span className="info-wrap">
      <button
        type="button"
        className="info-btn"
        aria-label={`Info about ${term}`}
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
      >
        i
      </button>
      {open && (
        <div className="info-pop" role="tooltip">
          <div className="info-pop-title">{term}</div>
          <div>{s}</div>
          {ex && (
            <div className="info-pop-ex">
              <strong>Example:</strong> {ex}
            </div>
          )}
          {t && <div className="info-pop-tech">Tech: {t}</div>}
        </div>
      )}
    </span>
  );
}

export function LabelWithInfo({ label, children }: { label: string; children?: ReactNode }) {
  return (
    <span className="label-info">
      {children || label}
      <InfoTooltip term={label} />
    </span>
  );
}

export function lookupGlossary(term: string): Entry | undefined {
  return typeof window !== "undefined" ? window.GLOSSARY?.[term] : undefined;
}
