import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function Profile() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [me, setMe] = useState(null);
  const [meLoading, setMeLoading] = useState(true);

  const [linkStatus, setLinkStatus] = useState(null);

  const [editedUserName, setEditedUserName] = useState("");
  const [saveStatus, setSaveStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  // 1) Load user from cookie session
  useEffect(() => {
    let cancelled = false;

    const loadMe = async () => {
      setMeLoading(true);
      try {
        const res = await fetch("http://localhost:3000/api/me", {
          method: "GET",
          credentials: "include",
        });

        if (!res.ok) {
          if (!cancelled) navigate("/login");
          return;
        }

        const data = await res.json();
        if (!cancelled && data?.user) {
          setMe(data.user);
          setEditedUserName(data.user.userName || "");
          localStorage.setItem("user", JSON.stringify(data.user));
          window.dispatchEvent(new Event("userUpdated"));
        }
      } catch (err) {
        // fallback UI když je server off
        const saved = localStorage.getItem("user");
        const fallback = saved ? JSON.parse(saved) : null;
        if (!cancelled) {
          setMe(fallback);
          setEditedUserName(fallback?.userName || "");
        }
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    };

    loadMe();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  // 2) Discord magic link catcher
  useEffect(() => {
    const discordIdFromUrl = searchParams.get("discordId");
    const discordNameFromUrl = searchParams.get("discordName");

    if (!discordIdFromUrl) return;

    window.history.replaceState(null, "", "/profile");
    setLinkStatus({ type: "loading", text: "Linking your Discord account..." });

    fetch("http://localhost:3000/api/bot/link-discord", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        discordId: discordIdFromUrl,
        discordName: discordNameFromUrl,
      }),
    })
      .then((res) => {
        if (!res.ok) throw new Error("Server returned " + res.status);
        return res.json();
      })
      .then((data) => {
        if (data.success) {
          setLinkStatus({ type: "success", text: "Discord account linked successfully!" });

          // patch local state + localStorage
          setMe((prev) => {
            const next = {
              ...(prev || {}),
              discordId: discordIdFromUrl,
              discordName: discordNameFromUrl,
            };
            localStorage.setItem("user", JSON.stringify(next));
            window.dispatchEvent(new Event("userUpdated"));
            return next;
          });
        } else {
          setLinkStatus({ type: "error", text: "Failed to link Discord." });
        }
      })
      .catch((err) => {
        console.error("Linking error:", err);
        setLinkStatus({ type: "error", text: "Server error while linking." });
      });
  }, [searchParams]);

  const userName = me?.userName || "User";
  const email = me?.email || "No email provided";
  const isDirty = editedUserName.trim() !== userName;

  const handleLogout = () => {
    // UI logout (cookie expirová sama, nebo si pak doděláme /logout endpoint)
    localStorage.removeItem("user");
    localStorage.removeItem("token");
    window.dispatchEvent(new Event("userUpdated"));
    navigate("/login");
  };

  const handleSaveProfile = async () => {
    const nextName = editedUserName.trim();

    if (nextName.length < 2) {
      setSaveStatus({ type: "error", text: "Username musí mít alespoň 2 znaky." });
      return;
    }
    if (nextName.length > 24) {
      setSaveStatus({ type: "error", text: "Username je moc dlouhý (max 24)." });
      return;
    }

    setSaving(true);
    setSaveStatus({ type: "loading", text: "Saving changes..." });

    try {
      const res = await fetch("http://localhost:3000/api/me", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userName: nextName }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setSaveStatus({
          type: "error",
          text: (data?.message || "Save failed") + ` (HTTP ${res.status})`,
        });
        return;
      }

      if (data?.user) {
        setMe(data.user);
        setEditedUserName(data.user.userName || "");
        localStorage.setItem("user", JSON.stringify(data.user));
        window.dispatchEvent(new Event("userUpdated"));
      }

      setSaveStatus({ type: "success", text: "Profile updated ✅" });
    } catch (err) {
      console.error(err);
      setSaveStatus({ type: "error", text: "Server error while saving." });
    } finally {
      setSaving(false);
    }
  };

  if (meLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "white" }}>
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
          "radial-gradient(900px 600px at 12% 8%, rgba(236,72,153,0.22), transparent 60%)," +
          "radial-gradient(700px 500px at 90% 18%, rgba(14,165,233,0.18), transparent 58%)," +
          "radial-gradient(800px 700px at 50% 110%, rgba(99,102,241,0.2), transparent 65%)," +
          "radial-gradient(circle at 30% 40%, #0a0834 0%, #040425 45%, #02021a 100%)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: "24px",
        color: "white",
        fontFamily: '"Poppins", "Trebuchet MS", sans-serif',
      }}
    >
      <section
        style={{
          width: "100%",
          maxWidth: "900px",
          borderRadius: "28px",
          border: "1px solid rgba(255,255,255,0.1)",
          background: "rgba(10, 10, 30, 0.88)",
          boxShadow: "0 24px 60px rgba(0,0,0,0.45)",
          padding: "28px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <div>
            <p style={{ margin: 0, fontSize: "12px", letterSpacing: "1.2px", textTransform: "uppercase", color: "rgba(255,255,255,0.55)" }}>
              My Account
            </p>
            <h1 style={{ margin: "8px 0 0 0", fontSize: "32px" }}>Profile</h1>
          </div>
          <button
            onClick={() => navigate("/")}
            style={{
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              padding: "10px 14px",
              cursor: "pointer",
            }}
          >
            Back to Home
          </button>
        </div>

        {/* Discord banner */}
        {linkStatus && (
          <div
            style={{
              marginTop: "20px",
              padding: "12px 16px",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: 600,
              background:
                linkStatus.type === "success"
                  ? "rgba(34, 197, 94, 0.15)"
                  : linkStatus.type === "error"
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(255, 255, 255, 0.1)",
              border: `1px solid ${
                linkStatus.type === "success"
                  ? "rgba(34, 197, 94, 0.4)"
                  : linkStatus.type === "error"
                  ? "rgba(239, 68, 68, 0.4)"
                  : "rgba(255, 255, 255, 0.2)"
              }`,
              color: linkStatus.type === "success" ? "#4ade80" : linkStatus.type === "error" ? "#f87171" : "#fff",
            }}
          >
            {linkStatus.type === "loading" && "⏳ "}
            {linkStatus.text}
          </div>
        )}

        {/* Save banner */}
        {saveStatus && (
          <div
            style={{
              marginTop: "12px",
              padding: "12px 16px",
              borderRadius: "12px",
              fontSize: "14px",
              fontWeight: 600,
              background:
                saveStatus.type === "success"
                  ? "rgba(34, 197, 94, 0.15)"
                  : saveStatus.type === "error"
                  ? "rgba(239, 68, 68, 0.15)"
                  : "rgba(255, 255, 255, 0.1)",
              border: `1px solid ${
                saveStatus.type === "success"
                  ? "rgba(34, 197, 94, 0.4)"
                  : saveStatus.type === "error"
                  ? "rgba(239, 68, 68, 0.4)"
                  : "rgba(255, 255, 255, 0.2)"
              }`,
              color: saveStatus.type === "success" ? "#4ade80" : saveStatus.type === "error" ? "#f87171" : "#fff",
            }}
          >
            {saveStatus.type === "loading" && "⏳ "}
            {saveStatus.text}
          </div>
        )}

        <div style={{ marginTop: "22px", display: "grid", gridTemplateColumns: "1.1fr 0.9fr", gap: "16px" }}>
          {/* LEFT CARD */}
          <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", background: "rgba(255,255,255,0.04)", padding: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "54px",
                  height: "54px",
                  borderRadius: "999px",
                  background: "linear-gradient(135deg, #ec4899, #22d3ee)",
                  color: "#040425",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "20px",
                }}
              >
                {userName ? userName.charAt(0).toUpperCase() : "U"}
              </div>

              <div style={{ minWidth: 0, flex: 1 }}>
                {/* Editovat HNED */}
                <input
                  value={editedUserName}
                  onChange={(e) => setEditedUserName(e.target.value)}
                  placeholder="Username"
                  style={{
                    width: "100%",
                    margin: 0,
                    padding: "8px 10px",
                    borderRadius: "10px",
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(0,0,0,0.25)",
                    color: "white",
                    outline: "none",
                    fontSize: "16px",
                    fontWeight: 700,
                  }}
                />

                <p style={{ margin: "6px 0 0 0", color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>
                  Logged in to Muzeer
                </p>
              </div>
            </div>

            <div style={{ marginTop: "18px", display: "grid", gap: "10px" }}>
              <div style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", padding: "10px 12px" }}>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.58)", fontSize: "12px" }}>Email</p>
                <p style={{ margin: "3px 0 0 0" }}>{email}</p>
              </div>

              <div style={{ borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", padding: "10px 12px" }}>
                <p style={{ margin: 0, color: "rgba(255,255,255,0.58)", fontSize: "12px" }}>Plan</p>
                <p style={{ margin: "3px 0 0 0" }}>Free</p>
              </div>

              <div
                style={{
                  borderRadius: "12px",
                  border: "1px solid rgba(88, 101, 242, 0.4)",
                  background: "rgba(88, 101, 242, 0.1)",
                  padding: "10px 12px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <p style={{ margin: 0, color: "rgba(255,255,255,0.7)", fontSize: "12px" }}>Discord Connection</p>
                  <p style={{ margin: "3px 0 0 0", fontWeight: "bold", color: "#5865F2" }}>
                    {me?.discordName ? `@${me.discordName}` : "Not linked"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT CARD */}
          <div style={{ border: "1px solid rgba(255,255,255,0.1)", borderRadius: "20px", background: "rgba(255,255,255,0.04)", padding: "20px" }}>
            <h3 style={{ margin: 0, fontSize: "18px" }}>Quick actions</h3>
            <p style={{ margin: "8px 0 18px 0", color: "rgba(255,255,255,0.6)", fontSize: "14px" }}>
              Profile controls.
            </p>

            <div style={{ display: "grid", gap: "10px" }}>
              <button
                disabled={!isDirty || saving}
                onClick={handleSaveProfile}
                style={{
                  border: "none",
                  borderRadius: "12px",
                  background: !isDirty || saving ? "rgba(255,255,255,0.12)" : "linear-gradient(90deg, #22c55e, #06b6d4)",
                  color: !isDirty || saving ? "rgba(255,255,255,0.6)" : "#05001f",
                  fontWeight: 800,
                  padding: "11px 14px",
                  cursor: !isDirty || saving ? "not-allowed" : "pointer",
                  textAlign: "left",
                }}
              >
                Uložit změny
              </button>

              <button
                onClick={() => {
                  setEditedUserName(userName);
                  setSaveStatus(null);
                }}
                style={{
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "12px",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  padding: "11px 14px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                Reset
              </button>

              <button
                onClick={handleLogout}
                style={{
                  border: "none",
                  borderRadius: "12px",
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