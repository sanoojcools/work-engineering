import type { WorkUnit } from "../../types";
import type { IndustryGroup } from "../../lib/groupWorkUnits";
import { WorkUnitRow } from "./WorkUnitRow";

export function IndustrySubGroup({
  group,
  expanded,
  onToggle,
  selectedId,
  highlightedId,
  search,
  onSelect,
}: {
  group: IndustryGroup;
  expanded: boolean;
  onToggle: () => void;
  selectedId: number | null;
  highlightedId: number | null;
  search: string;
  onSelect: (unit: WorkUnit) => void;
}) {
  if (group.units.length === 0) return null;
  return (
    <div className="industry-group">
      <button type="button" className="industry-pill" onClick={onToggle} aria-expanded={expanded}>
        {expanded ? "−" : "+"} {group.name} ({group.units.length})
      </button>
      {expanded && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Status</th>
                <th>L</th>
                <th>Readable</th>
                <th>Provenance</th>
              </tr>
            </thead>
            <tbody>
              {group.units.map((unit) => (
                <WorkUnitRow
                  key={unit.id}
                  unit={unit}
                  selected={selectedId === unit.id}
                  highlighted={highlightedId === unit.id}
                  search={search}
                  onClick={() => onSelect(unit)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
