import { createContext, useContext, useEffect, useState } from "react";
import { useResource } from "./useResource";
import { api } from "../api";

const BranchesContext = createContext(null);

export function BranchesProvider({ children }) {
  const resource = useResource("branches");
  const [regions, setRegions] = useState([]);
  useEffect(() => { api.get("/regions").then(setRegions).catch(() => setRegions([])); }, []);
  const sections = regions.flatMap((r) => r.sections || []);
  return <BranchesContext.Provider value={{ ...resource, sections }}>{children}</BranchesContext.Provider>;
}

export function useBranches() {
  return useContext(BranchesContext);
}
