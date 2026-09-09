import { useResource } from "../hooks/useResource";
import UnsavedBar from "../components/UnsavedBar";
import FieldError from "../components/FieldError";
import RowControls from "../components/RowControls";
import FlexPreviewButton from "../components/FlexPreviewButton";
import { move, removeAt } from "../utils";

export default function RegionsPage() {
  const resource = useResource("regions");
  const { draft, setDraft, errors, status, message } = resource;
  if (status === "loading" || draft === null) return <p>กำลังโหลด...</p>;
  if (status === "error") return <p className="field-error">{message}</p>;

  const update = (i, sections) => setDraft(draft.map((r, j) => (j === i ? { ...r, sections } : r)));

  return (
    <div>
      <h1>ภูมิภาคในเมนู "ตารางแพทย์" <FlexPreviewButton trigger="ตารางแพทย์" /></h1>
      <UnsavedBar resource={resource} />
      <p className="muted">1 กล่อง = 1 bubble ในเมนู หัวข้อแรกเป็นหัวข้อหลัก หัวข้อถัดไปเป็นหัวข้อย่อยใน bubble เดียวกัน ลบหัวข้อไม่ได้ถ้ายังมีสาขาใช้อยู่</p>
      <FieldError errors={errors} path="" />
      {draft.map((r, i) => (
        <div className="card card-row" key={i} style={{ gridTemplateColumns: "1fr auto" }}>
          <div className="inline-list">
            <FieldError errors={errors} path={`[${i}].sections`} />
            {r.sections.map((s, k) => (
              <div key={k}>
                <span className="muted">{k === 0 ? "หัวข้อหลัก" : "หัวข้อย่อย"}</span>
                <input value={s} onChange={(e) => update(i, r.sections.map((x, j) => (j === k ? e.target.value : x)))} />
                <RowControls index={k} length={r.sections.length} onMove={(a, c) => update(i, move(r.sections, a, c))} onDelete={(j) => update(i, removeAt(r.sections, j))} />
                <FieldError errors={errors} path={`[${i}].sections[${k}]`} />
              </div>
            ))}
            <div><button type="button" onClick={() => update(i, [...r.sections, ""])}>+ เพิ่มหัวข้อย่อย</button></div>
          </div>
          <RowControls index={i} length={draft.length} onMove={(a, c) => setDraft(move(draft, a, c))} onDelete={(k) => setDraft(removeAt(draft, k))} />
        </div>
      ))}
      <button type="button" className="primary" onClick={() => setDraft([...draft, { sections: [""] }])}>+ เพิ่ม bubble</button>
    </div>
  );
}
