import React from "react";

export default function Header({ title = "", user, onAvatarClick }) {
  return (
    <header>
      {/* บรรทัด 1: Brand */}
      <div style={{
        background:"#111", color:"#fff", padding:"8px 12px",
        display:"flex", alignItems:"center", justifyContent:"space-between"
      }}>
        <div>🍜 Eat Around You</div>
      </div>

      {/* บรรทัด 2: Page Title + Avatar */}
      <div style={{
        background:"#f7f7f7", color:"#222", padding:"10px 12px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        borderBottom:"1px solid #eee"
      }}>
        <div style={{fontWeight:600}}>{title}</div>
        <button
          onClick={onAvatarClick}
          title={user?.email || "Profile"}
          style={{
            width:34, height:34, borderRadius:"50%", border:"1px solid #ddd",
            background:"#fff", cursor:"pointer"
          }}
        >
          {/* ไอคอนหน้าคนง่ายๆ */}
          👤
        </button>
      </div>
    </header>
  );
}
