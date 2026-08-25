import { useRef, type ChangeEvent } from "react";
import { InfoTooltip } from "../InfoTooltip";

export function BulkUploadButton({
  busy,
  onFile,
}: {
  busy: boolean;
  onFile: (file: File) => void;
}) {
  const input = useRef<HTMLInputElement>(null);

  function change(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) onFile(file);
    if (input.current) input.current.value = "";
  }

  return (
    <>
      <button type="button" disabled={busy} onClick={() => input.current?.click()}>
        Bulk Upload
      </button>
      <InfoTooltip term="Bulk Upload" />
      <input
        ref={input}
        className="file-hidden"
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        onChange={change}
      />
    </>
  );
}
