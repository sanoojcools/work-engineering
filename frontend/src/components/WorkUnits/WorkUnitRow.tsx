import type { WorkUnit } from "../../types";
import { Badge } from "../../ui";
import { highlightMatch, provenanceLabel } from "../../lib/groupWorkUnits";

export function WorkUnitRow({
  unit,
  selected,
  highlighted,
  search,
  onClick,
}: {
  unit: WorkUnit;
  selected: boolean;
  highlighted: boolean;
  search: string;
  onClick: () => void;
}) {
  const codeHit = highlightMatch(unit.code, search);
  const nameHit = highlightMatch(unit.name, search);
  return (
    <tr
      data-row-id={unit.id}
      className={[selected ? "selected" : "", highlighted ? "highlight" : ""].filter(Boolean).join(" ") || undefined}
      onClick={onClick}
      style={{ cursor: "pointer" }}
    >
      <td>
        {codeHit ? (
          <>
            {codeHit.before}
            <mark>{codeHit.match}</mark>
            {codeHit.after}
          </>
        ) : (
          unit.code
        )}
      </td>
      <td>
        {nameHit ? (
          <>
            {nameHit.before}
            <mark>{nameHit.match}</mark>
            {nameHit.after}
          </>
        ) : (
          unit.name
        )}
      </td>
      <td>{unit.status}</td>
      <td>L{unit.autonomy_level}</td>
      <td>
        <Badge ok={unit.machine_readable}>{unit.machine_readable ? "yes" : "no"}</Badge>
      </td>
      <td>
        <span className="badge">{provenanceLabel(unit.provenance)}</span>
      </td>
    </tr>
  );
}
