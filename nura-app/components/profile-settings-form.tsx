"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Save, Upload } from "lucide-react";
import { getAvatarUrl } from "@/lib/avatar";
import { PhoneNumberInput } from "@/components/phone-number-input";
import { useToast } from "@/components/toast";

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
  const { toast } = useToast();
  const [name, setName] = useState(displayName);
  const [photo, setPhoto] = useState(avatarUrl);
  const [phoneNumber, setPhoneNumber] = useState(phone);
  const [saving, setSaving] = useState(false);
  const dirty =
    name.trim() !== displayName.trim() || photo !== avatarUrl || phoneNumber !== phone;

  async function imageToAvatar(file: File) {
    const supportedType = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type);
    if (!supportedType) {
      toast({ tone: "warning", message: "Choose a JPG, PNG, WebP or GIF photo." });
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
        toast({ tone: "error", message: "Could not prepare that photo. Try another image." });
        return;
      }

      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      const nextPhoto = canvas.toDataURL("image/jpeg", 0.72);
      if (nextPhoto.length > 80_000) {
        toast({ tone: "warning", message: "That photo is still too large. Try a smaller image." });
        return;
      }
      setPhoto(nextPhoto);
      toast({ tone: "info", message: "Photo ready. Save changes to update your profile." });
    } catch {
      toast({ tone: "error", message: "That photo could not be loaded. Try a JPG or PNG image." });
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function save() {
    if (!name.trim()) {
      toast({ tone: "warning", message: "Add a name before saving." });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: name, avatarUrl: photo, phone: phoneNumber }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.ok) {
        toast({ tone: "error", message: data?.error || "Could not save profile. Try a smaller photo or save again." });
        return;
      }
      toast({ title: "Saved", message: "Your profile is up to date." });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-panels profile-edit-panels">
      <section>
        <h3>Photo & name</h3>
        <p className="muted">This is how you appear across Nura.</p>
        <div className="profile-picture-editor centered">
          <label className="profile-photo-picker" htmlFor="avatar-file">
            <span
              className="profile-photo large"
              style={{ backgroundImage: `url(${photo || getAvatarUrl(name || email)})` }}
            />
            <span className="profile-photo-badge">
              <Upload size={13} />
            </span>
          </label>
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
        <label>
          Name
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
        </label>
        <label>
          Email
          <input value={email} disabled />
        </label>
        <p className="muted field-hint">Email comes from your sign-in and can’t be edited here.</p>
      </section>
      <section>
        <h3>Check-in number</h3>
        <p className="muted">
          Number Nura can call for scheduled voice check-ins. WhatsApp linking lives under Connected apps.
        </p>
        <label htmlFor="profile-phone">
          Phone
          <PhoneNumberInput id="profile-phone" value={phoneNumber} onChange={setPhoneNumber} />
        </label>
      </section>
      <button
        className="primary-cta profile-save-button"
        type="button"
        onClick={save}
        disabled={saving || !name.trim() || !dirty}
      >
        {saving ? "Saving..." : (
          <>
            <Save /> Save changes
          </>
        )}
      </button>
    </div>
  );
}
