import { useResource } from "../hooks/useResource";
import PageHeader from "../components/PageHeader";
import UnsavedBar from "../components/UnsavedBar";
import FieldError from "../components/FieldError";
import RowControls from "../components/RowControls";
import FlexPreviewButton from "../components/FlexPreviewButton";
import { move, removeAt } from "../utils";

export default function RegionsPage() {
  const resource = useResource("regions");
  const { draft, setDraft, errors, status, message } = resource;
  if (status === "loading" || draft === null) return <p className="muted">กำลังโหลด...</p>;
  if (status === "error") return <p className="field-error">{message}</p>;

  const update = (i, sections) => setDraft(draft.map((r, j) => (j === i ? { ...r, sections } : r)));

  return (
    <div>
      <PageHeader
        title={'ภูมิภาคในเมนู "ตารางแพทย์"'}
        subtitle={`${draft.length} bubble · 1 กล่อง = 1 bubble ในเมนู หัวข้อแรกเป็นหัวข้อหลัก หัวข้อถัดไปเป็นหัวข้อย่อยใน bubble เดียวกัน`}
        actions={<><FlexPreviewButton trigger="ตารางแพทย์" /><button type="button" className="primary" onClick={() => setDraft([...draft, { sections: [""] }])}>+ เพิ่ม bubble</button></>}
      />
      <UnsavedBar resource={resource} />
      <div className="notice">ลบหัวข้อไม่ได้ถ้ายังมีสาขาใช้อยู่ หากต้องการเปลี่ยนชื่อหัวข้อ ให้เพิ่มชื่อใหม่ก่อน แล้วย้ายสาขาทั้งหมดไปที่ชื่อใหม่ในหน้าสาขา บันทึก แล้วจึงลบชื่อเดิมทิ้ง</div>
      <FieldError errors={errors} path="" />
      {draft.map((r, i) => (
        <div className="card" key={i}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
            <div className="card-title" style={{ margin: 0 }}>Bubble {i + 1}{r.sections[0] ? ` · ${r.sections[0]}` : ""}</div>
            <RowControls index={i} length={draft.length} onMove={(a, c) => setDraft(move(draft, a, c))} onDelete={(k) => setDraft(removeAt(draft, k))} />
          </div>
          <FieldError errors={errors} path={`[${i}].sections`} />
          <div className="inline-list">
            {r.sections.map((s, k) => (
              <div key={k}>
                <span className="section-label">{k === 0 ? "หัวข้อหลัก" : "หัวข้อย่อย"}</span>
                <input value={s} onChange={(e) => update(i, r.sections.map((x, j) => (j === k ? e.target.value : x)))} />
                <RowControls index={k} length={r.sections.length} onMove={(a, c) => update(i, move(r.sections, a, c))} onDelete={(j) => update(i, removeAt(r.sections, j))} />
                <FieldError errors={errors} path={`[${i}].sections[${k}]`} />
              </div>
            ))}
            <div><button type="button" className="sm" onClick={() => update(i, [...r.sections, ""])}>+ เพิ่มหัวข้อย่อย</button></div>
          </div>
        </div>
      ))}
    </div>
  );
}
