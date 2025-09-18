import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage, db } from "../firebase";
import { doc, updateDoc } from "firebase/firestore";

async function handlePick(e) {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) return alert("กรุณาเลือกรูปภาพ");
  if (file.size > 5 * 1024 * 1024) return alert("ขนาดรูปต้องไม่เกิน 5MB");

  const uid = auth.currentUser?.uid;
  if (!uid) return;

  setUploading(true);
  try {
    const path = `users/${uid}/photos/profile_${Date.now()}`;
    const fileRef = ref(storage, path);

    const task = uploadBytesResumable(fileRef, file, { contentType: file.type });
    await new Promise((resolve, reject) => {
      task.on("state_changed", null, reject, resolve);
    });

    const url = await getDownloadURL(fileRef);
    setAvatarUrl(url);

    // บันทึกลง users/{uid}
    await updateDoc(doc(db, "users", uid), { avatar_url: url, updated_at: new Date() });
  } catch (err) {
    console.error(err);
    alert("อัปโหลดไม่สำเร็จ");
  } finally {
    setUploading(false);
    e.target.value = "";
  }
}
