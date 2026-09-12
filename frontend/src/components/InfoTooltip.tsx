import { useLayoutEffect, useRef, useState, type ReactNode } from "react";

type Entry = { simple: string; technical?: string; example?: string };

interface InfoTooltipProps {
  term: string;
  simple?: string;
  technical?: string;
  example?: string;
}

const POP_MAX = 280;
const POP_PAD = 8;

function placePopover(wrap: HTMLElement, pop: HTMLElement) {
  const btn = wrap.getBoundingClientRect();
  const maxW = Math.min(POP_MAX, window.innerWidth - POP_PAD * 2);
  pop.style.maxWidth = `${maxW}px`;
  pop.style.width = `${maxW}px`;
  const flip = btn.left + maxW > window.innerWidth - POP_PAD;
  let left = flip ? btn.right - maxW : btn.left;
  if (left < POP_PAD) left = POP_PAD;
  if (left + maxW > window.innerWidth - POP_PAD) {
    left = Math.max(POP_PAD, window.innerWidth - POP_PAD - maxW);
  }
  let top = btn.bottom + 4;
  const height = pop.offsetHeight;
  if (top + height > window.innerHeight - POP_PAD) {
    const above = btn.top - 4 - height;
    if (above >= POP_PAD) top = above;
    else top = Math.max(POP_PAD, window.innerHeight - POP_PAD - height);
  }
  pop.style.position = "fixed";
  pop.style.left = `${left}px`;
  pop.style.top = `${top}px`;
  pop.style.right = "auto";
  pop.classList.toggle("info-pop-flip", flip);
}

export function InfoTooltip({ term, simple, technical, example }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const glossary = typeof window !== "undefined" ? window.GLOSSARY?.[term] : undefined;
  const s = simple || glossary?.simple || "No definition yet";
  const t = technical || glossary?.technical;
  const ex = example || glossary?.example;

  useLayoutEffect(() => {
    if (!open || !wrapRef.current || !popRef.current) return;
    const wrap = wrapRef.current;
    const pop = popRef.current;
    const place = () => placePopover(wrap, pop);
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, s, t, ex]);

  return (
    <span
      className="info-wrap"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-btn"
        aria-label={`Info about ${term}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        i
      </button>
      {open && (
        <div className="info-pop" role="tooltip" ref={popRef} data-testid="info-pop">
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
