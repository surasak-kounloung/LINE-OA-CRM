import { createContext, useContext, useEffect, useState } from "react";
import { useResource } from "./useResource";
import { api } from "../api";

// Provider กลางสำหรับ resource ที่มีทั้งหน้ารายการและหน้าแก้ไข (โปรโมชั่น / บริการ / สาขา)
// ครอบไว้ที่ route "/<name>/*" ครั้งเดียว draft จึงอยู่รอดตอนสลับไปมาระหว่างรายการกับหน้าแก้ไข
// withRegions: โหลดชื่อหัวข้อภูมิภาคมาด้วย (หน้าสาขาใช้ทำ dropdown)
const ResourceContext = createContext(null);

export function ResourceProvider({ name, withRegions = false, children }) {
  const resource = useResource(name);
  const [regions, setRegions] = useState([]);
  useEffect(() => {
    if (!withRegions) return;
    api.get("/regions").then(setRegions).catch(() => setRegions([]));
  }, [withRegions]);
  const sections = regions.flatMap((r) => r.sections || []);
  return <ResourceContext.Provider value={{ ...resource, sections }}>{children}</ResourceContext.Provider>;
}

export function useResourceContext() {
  return useContext(ResourceContext);
}
