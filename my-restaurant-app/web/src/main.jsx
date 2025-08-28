import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// ⚠️ เวอร์ชันทดสอบ/ดีบั๊ก: ไม่ใช้ StrictMode เพื่อไม่ให้ useEffect ยิงซ้ำใน dev
createRoot(document.getElementById("root")).render(<App />);
