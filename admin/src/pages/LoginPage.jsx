import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, setToken } from "../api";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const { token } = await api.post("/login", { password });
      setToken(token);
      navigate("/promotions");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login">
      <form onSubmit={submit} className="card">
        <div className="brand">
          <div className="brand-mark" style={{ color: "#fff" }}>V</div>
          <div>
            <div className="brand-name">VSQ LINE Admin</div>
            <div className="brand-sub">จัดการข้อมูลบอท LINE OA</div>
          </div>
        </div>
        <label>
          รหัสผ่าน
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus placeholder="••••••••" />
        </label>
        {error && <div className="field-error">{error}</div>}
        <button type="submit" className="primary" disabled={busy || !password}>{busy ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}</button>
      </form>
    </div>
  );
}
