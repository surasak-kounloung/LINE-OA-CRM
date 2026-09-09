// ปุ่ม ขึ้น / ลง / ลบ สำหรับรายการที่เรียงลำดับได้
export default function RowControls({ index, length, onMove, onDelete }) {
  return (
    <div className="row-controls">
      <button type="button" title="เลื่อนขึ้น" disabled={index === 0} onClick={() => onMove(index, index - 1)}>↑</button>
      <button type="button" title="เลื่อนลง" disabled={index === length - 1} onClick={() => onMove(index, index + 1)}>↓</button>
      <button type="button" title="ลบ" className="danger" onClick={() => { if (window.confirm("ลบรายการนี้?")) onDelete(index); }}>ลบ</button>
    </div>
  );
}
