import { Link } from "react-router-dom";
import { useResourceContext } from "../hooks/useResourceContext";
import PageHeader from "../components/PageHeader";
import UnsavedBar from "../components/UnsavedBar";
import ImagePreview from "../components/ImagePreview";
import RowControls from "../components/RowControls";
import FlexPreviewButton from "../components/FlexPreviewButton";
import { move, removeAt, MENUS } from "../utils";

const menuLabel = (v) => (MENUS.find((m) => m.value === v) || {}).label || v;

export default function BranchesPage() {
  const resource = useResourceContext();
  const { draft, setDraft, errors, status, message, sections } = resource;
  if (status === "loading" || draft === null) return <p className="muted">กำลังโหลด...</p>;
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
      <PageHeader
        title="สาขา"
        subtitle={`${draft.length} สาขา · เปิดใช้ ${draft.filter((b) => b.enabled).length} · ลำดับในตาราง = ลำดับภายในภูมิภาคในเมนู "ตารางแพทย์"`}
        actions={<><FlexPreviewButton trigger="ตารางแพทย์" /><button type="button" className="primary" onClick={addBranch}>+ เพิ่มสาขาใหม่</button></>}
      />
      <UnsavedBar resource={resource} />
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th style={{ width: 72 }}>รูป</th><th>สาขา</th><th>ภูมิภาค</th><th>เมนู</th><th className="num">สถานะ</th><th className="num">แพทย์</th><th style={{ width: 200 }}></th></tr></thead>
          <tbody>
            {draft.map((b, i) => (
              <tr key={i} className={hasError(i) ? "has-error" : ""}>
                <td className="thumb-sm"><ImagePreview url={b.imageUrl} size={48} /></td>
                <td>
                  <div className="cell-main"><Link to={`/branches/${i}`}>{b.trigger || "(ยังไม่ตั้งชื่อ)"}</Link>{hasError(i) && <span className="badge">มีข้อผิดพลาด</span>}</div>
                  <div className="cell-sub">{b.displayName}{b.phoneNumber ? ` · ${b.phoneNumber}` : ""}</div>
                </td>
                <td>{b.region}</td>
                <td className="muted">{menuLabel(b.menu)}</td>
                <td className="num">{b.enabled ? <span className="badge ok" style={{ margin: 0 }}>เปิด</span> : <span className="badge muted" style={{ margin: 0 }}>ปิด</span>}</td>
                <td className="num">{(b.doctors || []).length}</td>
                <td>
                  <div className="actions">
                    <Link to={`/branches/${i}`} className="btn sm">แก้ไข</Link>
                    <RowControls index={i} length={draft.length} onMove={(a, c) => setDraft(move(draft, a, c))} onDelete={(k) => setDraft(removeAt(draft, k))} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
