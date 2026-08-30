import type { WorkUnit } from "../../types";
import type { FunctionGroupData } from "../../lib/groupWorkUnits";
import { IndustrySubGroup } from "./IndustrySubGroup";

export function FunctionGroup({
  group,
  expanded,
  expandedIndustries,
  onToggle,
  onToggleIndustry,
  selectedId,
  highlightedId,
  search,
  onSelect,
}: {
  group: FunctionGroupData;
  expanded: boolean;
  expandedIndustries: Set<string>;
  onToggle: () => void;
  onToggleIndustry: (industry: string) => void;
  selectedId: number | null;
  highlightedId: number | null;
  search: string;
  onSelect: (unit: WorkUnit) => void;
}) {
  const total = group.units.length;
  const recRatio = total === 0 ? 0 : group.reconciled / total;
  return (
    <section className="fn-group" style={{ borderLeftColor: group.color }}>
      <button type="button" className="fn-header" onClick={onToggle} aria-expanded={expanded}>
        <span className="fn-chevron">{expanded ? "−" : "+"}</span>
        <span className="fn-name">{group.name}</span>
        <span className="fn-count">{total}</span>
        <span className="muted">
          {group.reconciled} rec · {group.draft} draft
        </span>
        {group.hours > 0 && <span className="muted">{group.hours.toFixed(0)} hrs</span>}
      </button>
      <div className="fn-progress" aria-hidden>
        <span style={{ width: `${recRatio * 100}%`, background: group.color }} />
      </div>
      {expanded && (
        <div className="fn-body">
          {total === 0 && <p className="muted">No Work Units in this function.</p>}
          {group.industries.map((ind) => (
            <IndustrySubGroup
              key={ind.name}
              group={ind}
              expanded={expandedIndustries.has(`${group.name}::${ind.name}`)}
              onToggle={() => onToggleIndustry(ind.name)}
              selectedId={selectedId}
              highlightedId={highlightedId}
              search={search}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </section>
  );
}
