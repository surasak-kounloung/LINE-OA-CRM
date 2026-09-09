import { Link } from "react-router-dom";
import { useBranches } from "../hooks/useBranches";
import UnsavedBar from "../components/UnsavedBar";
import RowControls from "../components/RowControls";
import { move, removeAt, MENUS } from "../utils";

const menuLabel = (v) => (MENUS.find((m) => m.value === v) || {}).label || v;

export default function BranchesPage() {
  const resource = useBranches();
  const { draft, setDraft, errors, status, message, sections } = resource;
  if (status === "loading" || draft === null) return <p>กำลังโหลด...</p>;
  if (status === "error") return <p className="field-error">{message}</p>;

  const hasError = (i) => errors.some((e) => e.path.startsWith(`[${i}]`));

  function addBranch() {
    const id = `branch-${Date.now().toString(36)}`;
    setDraft([...draft, {
      id, trigger: "", displayName: "", region: sections[0] || "", menu: "main", enabled: false,
      fontSize: "xxl", mapUrl: "", imageUrl: "", phoneNumber: "", lineId: "", lineUrl: "", doctors: [],
    }]);
    window.location.hash = `#/branches/${draft.length}`;
  }

  return (
    <div>
      <h1>สาขา <span className="muted">({draft.length} สาขา, เปิดใช้ {draft.filter((b) => b.enabled).length})</span></h1>
      <UnsavedBar resource={resource} />
      <p className="muted">ลำดับในตารางนี้ = ลำดับที่แสดงภายในภูมิภาคในเมนู "ตารางแพทย์"</p>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>ชื่อ (trigger)</th><th>ภูมิภาค</th><th>เมนู</th><th>สถานะ</th><th>แพทย์</th><th></th></tr></thead>
          <tbody>
            {draft.map((b, i) => (
              <tr key={i} style={hasError(i) ? { background: "#fff0f0" } : undefined}>
                <td><Link to={`/branches/${i}`}>{b.trigger || "(ยังไม่ตั้งชื่อ)"}</Link>{hasError(i) && <span className="badge">มีข้อผิดพลาด</span>}</td>
                <td>{b.region}</td>
                <td>{menuLabel(b.menu)}</td>
                <td>{b.enabled ? "เปิด" : <span className="badge muted">ปิด</span>}</td>
                <td>{(b.doctors || []).length}</td>
                <td><RowControls index={i} length={draft.length} onMove={(a, c) => setDraft(move(draft, a, c))} onDelete={(k) => setDraft(removeAt(draft, k))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="primary" style={{ marginTop: "1rem" }} onClick={addBranch}>+ เพิ่มสาขาใหม่</button>
    </div>
  );
}
