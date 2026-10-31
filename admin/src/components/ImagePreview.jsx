export default function ImagePreview({ url, size = 96 }) {
  if (!url) return <div className="img-placeholder" style={{ width: size, height: size }}>ไม่มีรูป</div>;
  return <img className="img-preview" src={url} alt="" style={{ width: size, height: size }} onError={(e) => { e.currentTarget.classList.add("broken"); }} />;
}
