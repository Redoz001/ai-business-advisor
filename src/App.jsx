import React, { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";

import Auth from "./Auth.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ReubenAI from "./components/ReubenAI.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [activeChat, setActiveChat] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [appReady, setAppReady] = useState(false);

  /**
   * ================================
   * AUTH SESSION RESTORE
   * ================================
   */
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        if (error) console.error("Session error:", error);
        if (!mounted) return;

        setUser(data?.session?.user || null);
      } catch (err) {
        console.error("Session restore failed:", err);
      } finally {
        if (mounted) setAppReady(true);
      }
    };

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAppReady(true);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * ================================
   * LOAD CHAT SESSIONS
   * ================================
   */
  useEffect(() => {
    if (!user) return;

    const loadSessions = async () => {
      try {
        const { data, error } = await supabase
          .from("chat_sessions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        if (error) throw error;

        setSessions(data || []);

        if (data?.length && !activeChat) {
          setActiveChat(data[0].id);
        }
      } catch (err) {
        console.error("Load sessions error:", err);
      }
    };

    loadSessions();
  }, [user]);

  /**
   * ================================
   * REALTIME DATABASE SYNC
   * ================================
   */
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("chat_sessions_global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "chat_sessions" },
        (payload) => {
          const updated = payload.new;
          if (!updated) return;

          setSessions((prev) => {
            const exists = prev.find((s) => s.id === updated.id);

            if (!exists) return [updated, ...prev];

            return prev.map((s) =>
              s.id === updated.id ? { ...s, ...updated } : s
            );
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /**
   * ================================
   * CREATE CHAT
   * ================================
   */
  const createNewChat = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .insert([{ user_id: user.id, title: "New Chat" }])
        .select()
        .single();

      if (error) throw error;

      setSessions((prev) => [data, ...prev]);
      setActiveChat(data.id);
    } catch (err) {
      console.error("Create chat error:", err);
    }
  };

  /**
   * ================================
   * DELETE CHAT
   * ================================
   */
  const deleteChat = async (id) => {
    try {
      await supabase.from("chat_sessions").delete().eq("id", id);

      setSessions((prev) => prev.filter((s) => s.id !== id));

      if (activeChat === id) setActiveChat(null);
    } catch (err) {
      console.error("Delete chat error:", err);
    }
  };

  /**
   * ================================
   * OPTIMISTIC TITLE UPDATE (FIX)
   * ================================
   */
  const updateChatTitle = (id, title) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title } : s))
    );
  };

  /**
   * ================================
   * LOADING STATE
   * ================================
   */
  if (!appReady) {
    return (
      <div className="h-screen bg-black text-white flex items-center justify-center">
        Loading ReubenAI...
      </div>
    );
  }

  /**
   * ================================
   * AUTH SCREEN
   * ================================
   */
  if (!appReady) {
  return (
    <div className="h-screen bg-black text-white flex items-center justify-center">
      Loading ReubenAI...
    </div>
  );
 }

   if (!user) {
   return <Auth setUser={setUser} />;
 }

  /**
   * ================================
   * MAIN UI
   * ================================
   */
  return (
    <div className="h-screen flex bg-black text-white overflow-hidden">

      {/* SIDEBAR */}
      <div
        className={`
          ${sidebarOpen ? "w-64" : "w-0"}
          transition-all duration-300
          overflow-hidden
          border-r border-zinc-800
        `}
      >
        <Sidebar
          sessions={sessions}
          activeChat={activeChat}
          setActiveChat={setActiveChat}
          createNewChat={createNewChat}
          deleteChat={deleteChat}
          updateChatTitle={updateChatTitle}
          user={user}
        />
      </div>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* TOP BAR */}
        <div className="h-14 border-b border-zinc-800 flex items-center px-3 shrink-0">
          <button
            onClick={() => setSidebarOpen((p) => !p)}
            className="text-white"
          >
            ☰
          </button>

          <h1 className="ml-3 font-bold">ReubenAI</h1>
        </div>

        {/* CHAT */}
        <div className="flex-1 overflow-hidden">
          <ReubenAI
            user={user}
            activeChat={activeChat}
            setActiveChat={setActiveChat}
          />
        </div>

      </div>
    </div>
  );
}