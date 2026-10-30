import { useEffect } from "react";
import { setDirty } from "./dirtyState";

// หน้าที่เก็บ draft ใน state ของตัวเอง: เตือนก่อนปิด/รีเฟรชแท็บ และตั้งสถานะ dirty ให้เมนูข้างเตือนตอนนำทาง
export function useDirtyGuard(dirty) {
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  useEffect(() => { setDirty(dirty); return () => setDirty(false); }, [dirty]);
}
