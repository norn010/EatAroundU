// src/components/Toast.jsx
import { useEffect, useState } from "react";

export default function Toast({ text = "", open = false, onClose }) {
  const [show, setShow] = useState(open);
  useEffect(() => setShow(open), [open]);

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => onClose?.(), 1400);
    return () => clearTimeout(t);
  }, [show, onClose]);

  return (
    <div style={{
      position: "fixed", left: 0, right: 0, bottom: 80,
      display: "grid", placeItems: "center", pointerEvents: "none", zIndex: 2000
    }}>
      <div style={{
        transform: `translateY(${show ? 0 : 20}px)`,
        opacity: show ? 1 : 0, transition: "all .25s",
        background: "#111", color: "#fff", borderRadius: 999,
        padding: "8px 14px", fontWeight: 600
      }}>
        {text}
      </div>
    </div>
  );
}
