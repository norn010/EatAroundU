// web/src/pages/RestaurantQueuePage.jsx
import { useEffect, useState, useMemo } from "react";
import { auth, db } from "../firebase";
import {
    collection, doc, onSnapshot, orderBy, query,
    where, limit, addDoc, updateDoc, serverTimestamp, getDocs, getDoc
} from "firebase/firestore";

export default function RestaurantQueuePage({ restId, goBack }) {
    const [rest, setRest] = useState(null);
    const [tables, setTables] = useState([]);
    const [myBooking, setMyBooking] = useState(null);
    const [busy, setBusy] = useState(false);

    // โหลดข้อมูลร้าน
    useEffect(() => {
        if (!restId) return;
        const unsub = onSnapshot(doc(db, "restaurants", restId), (snap) => {
            if (snap.exists()) setRest({ id: snap.id, ...snap.data() });
        });
        return () => unsub();
    }, [restId]);

    // โหลดโต๊ะทั้งหมดแบบ realtime
    useEffect(() => {
        if (!restId) return;
        const qRef = query(
            collection(db, "restaurants", restId, "tables"),
            orderBy("table_number")
        );
        const unsub = onSnapshot(qRef, (snap) => {
            setTables(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        });
        return () => unsub();
    }, [restId]);

    // โหลดคิวของเรา (ถ้ามี) เฉพาะร้านนี้
    useEffect(() => {
        (async () => {
            const u = auth.currentUser;
            if (!u || !restId) {
                setMyBooking(null);
                return;
            }
            const qRef = query(
                collection(db, 'table_bookings'),
                where('restaurant_id', '==', restId),
                where('user_id', '==', uid),
                where('canceled_at', '==', null),
                orderBy('reserved_at', 'desc'),
                limit(1)
            );

            const snap = await getDocs(qRef);
            setMyBooking(snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() });
        })();
    }, [restId]);

    async function bookTable(t) {
        const u = auth.currentUser;
        if (!u) return alert("กรุณาเข้าสู่ระบบ");
        if (myBooking) return alert("คุณมีคิวอยู่แล้ว");

        try {
            setBusy(true);
            await updateDoc(doc(db, "restaurants", restId, "tables", t.id), {
                status: "occupied",
                updated_at: serverTimestamp()
            });
            const ref = await addDoc(collection(db, "table_bookings"), {
                restaurant_id: restId,
                table_id: t.id,
                user_id: u.uid,
                reserved_at: serverTimestamp(),
                canceled_at: null,
                created_at: serverTimestamp()
            });
            setMyBooking({ id: ref.id, restaurant_id: restId, table_id: t.id, user_id: u.uid, reserved_at: new Date(), canceled_at: null });
            alert(`จองโต๊ะหมายเลข ${t.table_number} เรียบร้อย`);
        } catch (e) {
            console.error(e);
            alert("จองไม่สำเร็จ");
        } finally {
            setBusy(false);
        }
    }

    async function cancelBooking() {
        if (!myBooking) return;
        try {
            setBusy(true);
            // คืนสถานะโต๊ะเป็น available
            const tdoc = await getDoc(doc(db, "restaurants", restId, "tables", myBooking.table_id));
            if (tdoc.exists()) {
                await updateDoc(doc(db, "restaurants", restId, "tables", myBooking.table_id), {
                    status: "available",
                    updated_at: serverTimestamp()
                });
            }
            // ปิดคิว
            await updateDoc(doc(db, "table_bookings", myBooking.id), {
                canceled_at: serverTimestamp()
            });
            setMyBooking(null);
        } catch (e) {
            console.error(e);
            alert("ยกเลิกไม่สำเร็จ");
        } finally {
            setBusy(false);
        }
    }

    return (
        <div style={{ maxWidth: 560, margin: "0 auto" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button onClick={goBack}>← Back</button>
                <h2 style={{ margin: "12px 0" }}>{rest?.name || "Queue"}</h2>
            </div>

            {/* คิวของฉัน */}
            <div style={{ background: "#fff", padding: 12, borderRadius: 10, marginBottom: 12 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>My Queue</div>
                {myBooking ? (
                    <div>
                        <div>คุณมีการจองอยู่ — โต๊ะ {myBooking.table_id}</div>
                        <button disabled={busy} onClick={cancelBooking}
                            style={{ marginTop: 8, border: "1px solid #ddd", padding: "6px 10px", borderRadius: 8 }}>
                            {busy ? "Cancelling..." : "Cancel"}
                        </button>
                    </div>
                ) : (
                    <div style={{ opacity: .7 }}>ยังไม่มีการจองโต๊ะ</div>
                )}
            </div>

            {/* โต๊ะทั้งหมด */}
            <div style={{ background: "#fff", padding: 12, borderRadius: 10 }}>
                <div style={{ fontWeight: 800, marginBottom: 6 }}>Tables</div>
                <div style={{ display: "grid", gap: 8 }}>
                    {tables.map(t => (
                        <div key={t.id}
                            style={{
                                display: "flex", justifyContent: "space-between", alignItems: "center",
                                padding: "8px 10px", border: "1px solid #eee", borderRadius: 8
                            }}>
                            <div>โต๊ะ {t.table_number} — {t.status === "available" ? "ว่าง" : "ไม่ว่าง"}</div>
                            <div>
                                {t.status === "available" ? (
                                    <button disabled={busy || !!myBooking}
                                        onClick={() => bookTable(t)}
                                        style={{ border: "1px solid #ddd", padding: "6px 10px", borderRadius: 8 }}>
                                        จอง
                                    </button>
                                ) : (
                                    <span style={{ opacity: .6 }}>—</span>
                                )}
                            </div>
                        </div>
                    ))}
                    {tables.length === 0 && <div style={{ opacity: .6 }}>ยังไม่มีข้อมูลโต๊ะ</div>}
                </div>
            </div>
        </div>
    );
}
