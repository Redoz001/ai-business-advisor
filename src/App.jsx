import React, { useEffect, useState, useRef } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase.js";

import Auth from "./Auth.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ReubenAI from "./components/ReubenAI.jsx";

/* ===============================
   CALLBACK (FIXED)
================================= */
function AuthCallback() {
  useEffect(() => {
    const handleAuth = async () => {
      // wait for Supabase to store session from URL
      await supabase.auth.getSession();

      setTimeout(() => {
        window.location.replace("/");
      }, 400);
    };

    handleAuth();
  }, []);

  return (
    <div className="h-screen flex items-center justify-center bg-black text-white">
      Signing you in...
    </div>
  );
}

/* ===============================
   APP
================================= */
export default function App() {
  const [user, setUser] = useState(undefined);
  const [activeChat, setActiveChat] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadingSessionsRef = useRef(false);

  /* ===============================
     AUTH
  =============================== */
  useEffect(() => {
    let alive = true;

    const initAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (alive) setUser(data?.session?.user ?? null);
    };

    initAuth();

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (alive) setUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /* ===============================
     LOAD CHAT SESSIONS
  =============================== */
  const loadSessions = async () => {
    if (!user?.id) return;
    if (loadingSessionsRef.current) return;

    loadingSessionsRef.current = true;

    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    setSessions(data || []);

    loadingSessionsRef.current = false;
  };

  useEffect(() => {
    if (user?.id) loadSessions();
  }, [user?.id]);

  /* ===============================
     REALTIME UPDATES
  =============================== */
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("chat_sessions_realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_sessions",
          filter: `user_id=eq.${user.id}`,
        },
        () => loadSessions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  /* ===============================
     AUTO SELECT CHAT
  =============================== */
  useEffect(() => {
    if (!activeChat && sessions.length > 0) {
      setActiveChat(sessions[0].id);
    }
  }, [sessions]);

  /* ===============================
     LOADING STATE
  =============================== */
  if (user === undefined) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      {/* AUTH CALLBACK */}
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* LOGIN */}
      <Route
        path="/auth"
        element={user ? <Navigate to="/" /> : <Auth />}
      />

      {/* MAIN APP */}
      <Route
        path="/"
        element={
          user ? (
            <div className="h-screen flex bg-black text-white overflow-hidden">

              {/* SIDEBAR */}
              <div
                className={`${
                  sidebarOpen ? "w-64" : "w-0"
                } transition-all duration-300 overflow-hidden`}
              >
                <Sidebar
                  user={user}
                  sessions={sessions}
                  refreshSessions={loadSessions}
                  activeChat={activeChat}
                  setActiveChat={setActiveChat}
                  createNewChat={() => setActiveChat(null)}
                />
              </div>

              {/* MAIN */}
              <div className="flex-1 flex flex-col">

                {/* TOP BAR */}
                <div className="h-14 border-b border-zinc-800 flex items-center px-3">
                  <button onClick={() => setSidebarOpen((p) => !p)}>
                    ☰
                  </button>
                  <h1 className="ml-3 font-bold">ReuNexus</h1>
                </div>

                {/* CHAT */}
                <ReubenAI
                  user={user}
                  activeChat={activeChat}
                  setActiveChat={setActiveChat}
                />
              </div>
            </div>
          ) : (
            <Navigate to="/auth" />
          )
        }
      />
    </Routes>
  );
}