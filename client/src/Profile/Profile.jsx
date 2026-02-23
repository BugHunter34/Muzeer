import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const navigate = useNavigate();
  const serverBase = "http://localhost:3000";

  const [me, setMe] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [form, setForm] = useState({ userName: "", email: "" });
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  const saveUserToLocal = (user) => {
    localStorage.setItem("user", JSON.stringify(user));
    window.dispatchEvent(new Event("userUpdated"));
  };

  // ---- role theme ----
  const theme = useMemo(() => {
    const role = me?.role || "user";

    if (role === "admin") {
      return {
        a1: "rgba(239,68,68,0.25)",
        a2: "rgba(244,63,94,0.18)",
        accent: "#fb7185",
        button: "linear-gradient(90deg, #ef4444, #fb7185)",
        border: "rgba(239,68,68,0.35)",
      };
    }

    if (role === "owner") {
      return {
        a1: "rgba(234,179,8,0.26)",
        a2: "rgba(245,158,11,0.18)",
        accent: "#fbbf24",
        button: "linear-gradient(90deg, #f59e0b, #fbbf24)",
        border: "rgba(245,158,11,0.35)",
      };
    }

    return {
      a1: "rgba(236,72,153,0.22)",
      a2: "rgba(14,165,233,0.18)",
      accent: "#22d3ee",
      button: "linear-gradient(90deg, #22d3ee, #4ade80)",
      border: "rgba(34,211,238,0.35)",
    };
  }, [me]);

  const avatarSrc =
    avatarPreview ||
    (me?.avatarUrl
      ? (me.avatarUrl.startsWith("http") ? me.avatarUrl : `${serverBase}${me.avatarUrl}`)
      : null);

  const setField = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const pickAvatar = (file) => {
    setAvatarFile(file || null);

    if (avatarPreview) URL.revokeObjectURL(avatarPreview);

    if (!file) {
      setAvatarPreview(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setAvatarPreview(url);
  };

  useEffect(() => {
    return () => {
      if (avatarPreview) URL.revokeObjectURL(avatarPreview);
    };
  }, [avatarPreview]);

  // ---- load me ----
  useEffect(() => {
    const loadMe = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${serverBase}/api/auth/me`, {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          navigate("/login");
          return;
        }

        const data = await res.json();
        const user = data?.user || data;

        setMe(user);
        setForm({
          userName: user?.userName || "",
          email: user?.email || "",
        });

        saveUserToLocal(user);
      } catch (e) {
        console.error("GET /api/auth/me failed:", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadMe();
  }, [navigate]);

  const saveProfile = async () => {
    if (!me) return;

    setSaving(true);
    setBanner(null);

    try {
      // 1) PATCH profile
      const patchRes = await fetch(`${serverBase}/api/auth/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userName: form.userName,
          email: form.email,
        }),
      });

      const patchData = await patchRes.json().catch(() => ({}));

      if (!patchRes.ok) {
        setBanner({ type: "error", text: patchData?.message || "Save failed." });
        return;
      }

      const patched = patchData?.user || patchData;
      setMe(patched);
      saveUserToLocal(patched);

      // 2) Avatar upload
      if (avatarFile) {
        const fd = new FormData();
        fd.append("avatar", avatarFile);

        const upRes = await fetch(`${serverBase}/api/auth/me/avatar`, {
          method: "POST",
          credentials: "include",
          body: fd,
        });

        const upData = await upRes.json().catch(() => ({}));

        if (!upRes.ok) {
          setBanner({ type: "error", text: upData?.message || "Avatar upload failed." });
          return;
        }

        const updated = upData?.user || upData;
        setMe(updated);
        saveUserToLocal(updated);

        setAvatarFile(null);
        if (avatarPreview) URL.revokeObjectURL(avatarPreview);
        setAvatarPreview(null);
      }

      setBanner({ type: "success", text: "Uloženo ✅" });
    } catch (e) {
      console.error("saveProfile failed:", e);
      setBanner({ type: "error", text: "Server error while saving." });
    } finally {
      setSaving(false);
    }
  };

  const logout = () => {
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("userUpdated"));
    navigate("/login");
  };

  if (isLoading) {
    return (
      <div style={{
        minHeight: "100vh", width: "100vw", background: "#040425",
        display: "flex", alignItems: "center", justifyContent: "center", color: "white",
        fontFamily: '"Poppins","Trebuchet MS",sans-serif'
      }}>
        Loading profile...
      </div>
    );
  }

  if (!me) return null;

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100vw",
        background:
          `radial-gradient(900px 600px at 12% 8%, ${theme.a1}, transparent 60%),` +
          `radial-gradient(700px 500px at 90% 18%, ${theme.a2}, transparent 58%),` +
          "radial-gradient(800px 700px at 50% 110%, rgba(99,102,241,0.2), transparent 65%)," +
          "radial-gradient(circle at 30% 40%, #0a0834 0%, #040425 45%, #02021a 100%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
        color: "white",
        fontFamily: '"Poppins","Trebuchet MS",sans-serif',
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: 900,
          borderRadius: 28,
          border: `1px solid rgba(255,255,255,0.1)`,
          background: "rgba(10, 10, 30, 0.88)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          padding: 28,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>
              My Account
            </p>
            <h1 style={{ margin: "8px 0 0 0", fontSize: 32 }}>Profile</h1>
            <p style={{ margin: "6px 0 0 0", color: theme.accent, fontWeight: 700, fontSize: 12 }}>
              Role: {me.role}
            </p>
          </div>

          <button
            onClick={() => navigate("/")}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              background: "rgba(255,255,255,0.06)",
              color: "white",
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            Back to Home
          </button>
        </div>

        {banner && (
          <div
            style={{
              marginTop: 20,
              padding: "12px 16px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              background: banner.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
              border: `1px solid ${banner.type === "success" ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`,
            }}
          >
            {banner.text}
          </div>
        )}

        <div style={{ marginTop: 22, display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: 16 }}>
          {/* Left card */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              padding: 20,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 999,
                  overflow: "hidden",
                  border: `1px solid ${theme.border}`,
                  background: "rgba(255,255,255,0.08)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {avatarSrc ? (
                  <img src={avatarSrc} alt="avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                ) : (
                  <span style={{ color: "#040425", fontWeight: 900, fontSize: 20, background: theme.button, padding: "10px 14px", borderRadius: 999 }}>
                    {(form.userName || me.userName || "U").charAt(0).toUpperCase()}
                  </span>
                )}
              </div>

              <div>
                <h2 style={{ margin: 0, fontSize: 20 }}>{form.userName || me.userName}</h2>
                <p style={{ margin: "4px 0 0 0", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
                  Logged in to Muzeer
                </p>
              </div>
            </div>

            <div style={{ marginTop: 18, display: "grid", gap: 10 }}>
              <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", padding: "10px 12px" }}>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.58)", fontSize: 12 }}>Username</p>
                <input
                  value={form.userName}
                  onChange={(e) => setField("userName", e.target.value)}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    borderRadius: 10,
                    border: `1px solid ${theme.border}`,
                    background: "rgba(255,255,255,0.06)",
                    color: "white",
                    padding: "10px 10px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", padding: "10px 12px" }}>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.58)", fontSize: 12 }}>Email</p>
                <input
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  style={{
                    marginTop: 6,
                    width: "100%",
                    borderRadius: 10,
                    border: `1px solid ${theme.border}`,
                    background: "rgba(255,255,255,0.06)",
                    color: "white",
                    padding: "10px 10px",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.1)", padding: "10px 12px" }}>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.58)", fontSize: 12 }}>Profile photo</p>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => pickAvatar(e.target.files?.[0])}
                  style={{ marginTop: 8, width: "100%" }}
                />
              </div>

              <div style={{
                borderRadius: 12,
                border: "1px solid rgba(88, 101, 242, 0.4)",
                background: "rgba(88, 101, 242, 0.1)",
                padding: "10px 12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <div>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: 12 }}>Discord Connection</p>
                  <p style={{ margin: "3px 0 0 0", fontWeight: "bold", color: "#5865F2" }}>
                    {me?.discordName ? `@${me.discordName}` : "Not linked"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right card */}
          <div
            style={{
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 20,
              background: "rgba(255,255,255,0.04)",
              padding: 20,
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18 }}>Quick actions</h3>
            <p style={{ margin: "8px 0 18px 0", color: "rgba(255,255,255,0.6)", fontSize: 14 }}>
              Update profile then save.
            </p>

            <div style={{ display: "grid", gap: 10 }}>
              <button
                onClick={saveProfile}
                disabled={saving}
                style={{
                  border: "none",
                  borderRadius: 12,
                  background: saving ? "rgba(255,255,255,0.12)" : theme.button,
                  color: "#05001f",
                  fontWeight: 900,
                  padding: "11px 14px",
                  cursor: saving ? "not-allowed" : "pointer",
                  textAlign: "left",
                  opacity: saving ? 0.8 : 1,
                }}
              >
                {saving ? "Saving..." : "Uložit změny"}
              </button>

              <button
                onClick={logout}
                style={{
                  border: "none",
                  borderRadius: 12,
                  background: "linear-gradient(90deg, #ec4899, #22d3ee)",
                  color: "#05001f",
                  fontWeight: 700,
                  padding: "11px 14px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Log out
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}