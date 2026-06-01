import React, { useState, useMemo, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";

import Profile from "../components/profile.jsx";

export default function Sidebar({
  sessions = [],
  activeChat,
  setActiveChat,
  createNewChat,
  user,
  workspace,
  role,
  subscription,
  refreshSessions,
}) {
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);

  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [renameId, setRenameId] = useState(null);

  /* 🧠 PROFILE SYSTEM */
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState("account");

  const navigate = useNavigate();

  /* =========================
     ESC KEY CLOSE MODALS
  ========================= */
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === "Escape") {
        setProfileOpen(false);
        setAccountOpen(false);
        setCommandOpen(false);
        setRenameOpen(false);
      }
    };

    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, []);

  /* =========================
     FILTER CHATS
  ========================= */
  const filtered = useMemo(() => {
    return sessions.filter((s) =>
      (s.title || "New Chat").toLowerCase().includes(search.toLowerCase())
    );
  }, [sessions, search]);

  /* =========================
     INITIALS
  ========================= */
  const initials = useMemo(() => {
    if (!user?.email) return "U";

    const base = user.email.split("@")[0];
    const parts = base.split(/[._-]/).filter(Boolean);

    const first = parts[0]?.[0] || "";
    const second = parts[1]?.[0] || "";

    return (first + second || first || "U").toUpperCase();
  }, [user]);

  /* =========================
     LOGOUT
  ========================= */
  const logout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  /* =========================
     DELETE CHAT
  ========================= */
  const deleteChat = async (id) => {
    await supabase.from("chat_messages").delete().eq("session_id", id);
    await supabase.from("chat_sessions").delete().eq("id", id);

    refreshSessions?.();

    if (activeChat === id) setActiveChat?.(null);
  };

  /* =========================
     RENAME CHAT
  ========================= */
  const openRename = (chat) => {
    setRenameId(chat.id);
    setRenameValue(chat.title || "New Chat");
    setRenameOpen(true);
  };

  const saveRename = async () => {
    if (!renameValue.trim()) return;

    await supabase
      .from("chat_sessions")
      .update({ title: renameValue })
      .eq("id", renameId);

    setRenameOpen(false);
    setRenameId(null);
    setRenameValue("");
    refreshSessions?.();
  };

  const isPro = subscription?.plan !== "free";

  /* =========================
     CLICK OUTSIDE PROFILE CLOSE
  ========================= */
  const closeProfile = (e) => {
    if (e.target.id === "profile-backdrop") {
      setProfileOpen(false);
    }
  };

  return (
    <div
      className={`h-full bg-black border-r border-zinc-800 flex flex-col transition-all duration-300 ${
        collapsed ? "w-20" : "w-72"
      }`}
    >
      {/* HEADER */}
      <div className="p-4 flex justify-between border-b border-zinc-800">
        {!collapsed && (
          <div>
            <h1 className="text-white font-bold">ReubenAI</h1>
            <p className="text-xs text-zinc-500">
              {workspace?.name || "Workspace"}
            </p>
          </div>
        )}

        <button onClick={() => setCollapsed(!collapsed)} className="text-zinc-400">
          {collapsed ? "➜" : "⬅"}
        </button>
      </div>

      {/* SEARCH */}
      {!collapsed && (
        <div className="p-3">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chats..."
            className="w-full bg-zinc-900 text-white p-2 rounded-lg text-sm"
          />
        </div>
      )}

      {/* NEW CHAT */}
      <div className="px-3">
        <button
          onClick={createNewChat}
          className="w-full bg-emerald-400 text-black py-2 rounded-lg text-sm font-bold"
        >
          + {!collapsed && "New Chat"}
        </button>
      </div>

      {/* CHAT LIST */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filtered.map((s) => (
          <div
            key={s.id}
            className={`group flex justify-between items-center p-2 rounded-lg cursor-pointer text-sm ${
              activeChat === s.id
                ? "bg-zinc-800 text-white"
                : "text-zinc-400 hover:bg-zinc-900"
            }`}
          >
            <div onClick={() => setActiveChat(s.id)} className="flex-1 truncate">
              {!collapsed && s.title}
            </div>

            {!collapsed && (
              <div className="hidden group-hover:flex gap-2">
                <button onClick={() => openRename(s)} className="text-xs text-blue-400">
                  ✏️
                </button>

                <button onClick={() => deleteChat(s.id)} className="text-xs text-red-400">
                  🗑
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* FOOTER */}
      <div className="border-t border-zinc-800 p-3 relative">
        {!collapsed && (
          <div className="text-[10px] text-zinc-500 mb-2">
            Plan: {subscription?.plan || "free"} {isPro && "🔥"}
          </div>
        )}

        {/* ACCOUNT BUTTON */}
        <button
          onClick={() => setAccountOpen(!accountOpen)}
          className="flex items-center gap-2 w-full p-2 hover:bg-zinc-900 rounded-lg"
        >
          <div className="w-8 h-8 bg-emerald-400 text-black rounded-full flex items-center justify-center font-bold">
            {initials}
          </div>

          {!collapsed && (
            <span className="text-white text-sm">
              {user?.email?.split("@")[0]}
            </span>
          )}
        </button>

        {/* ACCOUNT DROPDOWN */}
        <AnimatePresence>
          {accountOpen && (
            <motion.div className="absolute bottom-16 left-2 right-2 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden z-50">
              <MenuItem label="Profile" onClick={() => setProfileOpen(true)} />
              <MenuItem label="Settings" onClick={() => navigate("/settings")} />
              <MenuItem label="Workspace" onClick={() => navigate("/workspace")} />

              {role === "admin" && (
                <MenuItem label="Admin Panel" onClick={() => navigate("/admin")} />
              )}

              <MenuItem label="Command Palette" onClick={() => setCommandOpen(true)} />

              <div className="h-px bg-zinc-800" />

              <MenuItem label="Logout" danger onClick={logout} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* =========================
         🧠 PROFILE MODAL (FULL CHATGPT STYLE)
      ========================= */}
      <AnimatePresence>
        {profileOpen && (
          <motion.div
            id="profile-backdrop"
            onClick={closeProfile}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-zinc-950 border border-zinc-800 rounded-xl w-[500px] max-h-[85vh] overflow-hidden"
            >
              {/* HEADER */}
              <div className="flex justify-between items-center p-4 border-b border-zinc-800">
                <h2 className="text-white font-bold">Profile Settings</h2>
                <button
                  onClick={() => setProfileOpen(false)}
                  className="text-zinc-400"
                >
                  ✕
                </button>
              </div>

              {/* TABS */}
              <div className="flex border-b border-zinc-800 text-sm">
                {["account", "security", "ai", "billing"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setProfileTab(tab)}
                    className={`flex-1 p-2 ${
                      profileTab === tab
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-400"
                    }`}
                  >
                    {tab.toUpperCase()}
                  </button>
                ))}
              </div>

              {/* CONTENT */}
              <div className="p-4 overflow-y-auto max-h-[60vh]">
                {profileTab === "account" && (
                  <Profile section="account" user={user} />
                )}

                {profileTab === "security" && (
                  <Profile section="security" user={user} />
                )}

                {profileTab === "ai" && (
                  <Profile section="ai" user={user} />
                )}

                {profileTab === "billing" && (
                  <Profile section="billing" user={user} />
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* COMMAND PALETTE */}
      <AnimatePresence>
        {commandOpen && (
          <motion.div className="fixed inset-0 bg-black/70 flex items-start justify-center pt-24">
            <div className="w-[500px] bg-zinc-950 border border-zinc-800 rounded-xl p-3">
              <div className="space-y-2 text-sm">
                <div onClick={createNewChat} className="p-2 hover:bg-zinc-900 rounded">
                  New Chat
                </div>
                <div onClick={() => navigate("/settings")} className="p-2 hover:bg-zinc-900 rounded">
                  Settings
                </div>
                <div onClick={logout} className="p-2 hover:bg-zinc-900 rounded text-red-400">
                  Logout
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* RENAME MODAL */}
      <AnimatePresence>
        {renameOpen && (
          <motion.div className="fixed inset-0 bg-black/70 flex items-center justify-center">
            <div className="bg-zinc-950 p-4 rounded-xl w-[300px]">
              <h2 className="text-white mb-2">Rename Chat</h2>

              <input
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                className="w-full p-2 bg-zinc-900 rounded text-white"
              />

              <div className="flex justify-end gap-2 mt-3">
                <button onClick={() => setRenameOpen(false)} className="text-sm text-zinc-400">
                  Cancel
                </button>

                <button onClick={saveRename} className="text-sm bg-emerald-400 text-black px-3 py-1 rounded">
                  Save
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* =========================
   MENU ITEM
========================= */
function MenuItem({ label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-2 text-sm hover:bg-zinc-900 ${
        danger ? "text-red-400" : "text-zinc-300"
      }`}
    >
      {label}
    </button>
  );
}