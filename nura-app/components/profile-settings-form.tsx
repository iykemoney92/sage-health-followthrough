"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Camera, Save, Upload } from "lucide-react";
import { getAvatarUrl } from "@/lib/avatar";
import { PhoneNumberInput } from "@/components/phone-number-input";

export function ProfileSettingsForm({
  displayName,
  email,
  avatarUrl,
  phone,
}: {
  displayName: string;
  email: string;
  avatarUrl: string;
  phone: string;
}) {
  const router = useRouter();
  const [name, setName] = useState(displayName);
  const [photo, setPhoto] = useState(avatarUrl);
  const [phoneNumber, setPhoneNumber] = useState(phone);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  async function imageToAvatar(file: File) {
    const supportedType = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
    if (!supportedType) {
      setNotice("Choose a JPG, PNG, WebP or GIF photo.");
      return;
    }

    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      const loaded = new Promise<HTMLImageElement>((resolve, reject) => {
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("Image failed to load"));
      });
      image.src = url;
      await loaded;

      const size = 192;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) {
        setNotice("Could not prepare that photo. Try another image.");
        return;
      }

      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      const nextPhoto = canvas.toDataURL("image/jpeg", 0.72);
      if (nextPhoto.length > 80_000) {
        setNotice("That photo is still too large. Try a smaller image.");
        return;
      }
      setPhoto(nextPhoto);
      setNotice("Photo ready. Save changes to update your profile.");
    } catch {
      setNotice("That photo could not be loaded. Try a JPG or PNG image.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function save() {
    setSaving(true);
    setNotice("");
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, avatarUrl: photo, phone: phoneNumber }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        setNotice("Could not save profile. Try a smaller photo or save again.");
        return;
      }
      setNotice("Profile saved.");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-panels profile-edit-panels">
      <section>
        <div className="profile-picture-editor">
          <label className="profile-photo-picker" htmlFor="avatar-file">
            <span className="profile-photo large" style={{ backgroundImage: `url(${photo || getAvatarUrl(name || email)})` }} />
            <span className="profile-photo-badge"><Upload size={13} /></span>
          </label>
          <div>
            <h3>Profile picture</h3>
            <label className="secondary-cta profile-upload-button" htmlFor="avatar-file">
              <Upload /> Upload photo
            </label>
          </div>
          <input
            id="avatar-file"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="profile-photo-input"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void imageToAvatar(file);
            }}
          />
        </div>
        <label>Name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label>Email<input value={email} disabled /></label>
      </section>
      <section>
        <h3>Check-in number</h3>
        <p className="muted">Number Nura can check in on for scheduled reminders.</p>
        <label htmlFor="profile-phone">Phone<PhoneNumberInput id="profile-phone" value={phoneNumber} onChange={setPhoneNumber} /></label>
      </section>
      <section>
        <span className="modal-icon"><Camera /></span>
        <h3>Personalisation</h3>
        <p className="muted">Your profile photo appears in the app header and Me page so demo accounts feel like real people.</p>
      </section>
      {notice && <p className="profile-save-note">{notice}</p>}
      <button className="primary-cta profile-save-button" type="button" onClick={save} disabled={saving || !name.trim()}>
        {saving ? "Saving..." : <><Save /> Save changes</>}
      </button>
    </div>
  );
}
