import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // ต้องตรงกับ ADMIN_UI_PATH ใน index.js (มี / ปิดท้าย)
  base: "/backoffice/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:8080" },
  },
});
