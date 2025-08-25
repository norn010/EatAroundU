export default function ConfirmDialog({ open, title="ยืนยัน", message="ยืนยันการทำรายการ?", onCancel, onConfirm }) {
  if (!open) return null;
  return (
    <div style={{position:"fixed", inset:0, background:"rgba(0,0,0,.4)", display:"grid", placeItems:"center", zIndex:1200}}>
      <div style={{background:"#fff", padding:16, borderRadius:10, width:320, boxShadow:"0 10px 30px rgba(0,0,0,.2)"}}>
        <div style={{fontWeight:700, marginBottom:6}}>{title}</div>
        <div style={{opacity:.85, marginBottom:12}}>{message}</div>
        <div style={{display:"flex", gap:8, justifyContent:"flex-end"}}>
          <button onClick={onCancel}>ยกเลิก</button>
          <button onClick={onConfirm} style={{background:"#111", color:"#fff", border:"none", padding:"8px 12px", borderRadius:6}}>ยืนยัน</button>
        </div>
      </div>
    </div>
  );
}
