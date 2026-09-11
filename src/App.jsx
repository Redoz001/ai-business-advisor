import React, {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
} from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { supabase } from "./lib/supabase.js";

import ReubenAI from "./components/ReubenAI.jsx";
import Sidebar from "./components/Sidebar.jsx";

const Auth = lazy(() => import("./Auth.jsx"));
const Callback = lazy(() => import("./Callback.jsx"));
const Visual = lazy(() => import("./Visual.jsx"));
const Settings = lazy(() => import("./components/settings.jsx"));

const fallbackScreen = (
  <div className="flex h-screen items-center justify-center bg-black text-white">
    Loading...
  </div>
);

export default function App() {
  const [user, setUser] = useState(undefined);
  const [activeChat, setActiveChat] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const loadingRef = useRef(false);

  /* ===============================
     AUTH STATE
  =============================== */

  useEffect(() => {
    let alive = true;

    async function initAuth() {
      const { data, error } = await supabase.auth.getSession();

      console.log("Session:", data.session);
      console.log("Auth Error:", error);

      if (!alive) return;

      setUser(data?.session?.user ?? null);
    }

    initAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;

      console.log("Auth State Changed:", session);

      setUser(session?.user ?? null);
    });

    return () => {
      alive = false;
      subscription.unsubscribe();
    };
  }, []);

  /* ===============================
     LOAD CHAT SESSIONS
  =============================== */

  const loadSessions = async () => {
    if (!user?.id) return;
    if (loadingRef.current) return;

    loadingRef.current = true;

    try {
      const { data, error } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", {
          ascending: false,
        });

      if (error) {
        console.error(error);
        return;
      }

      setSessions(data || []);
    } finally {
      loadingRef.current = false;
    }
  };

  useEffect(() => {
    if (user?.id) {
      loadSessions();
    }
  }, [user]);

  /* ===============================
     REALTIME CHAT
  =============================== */

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`chat_sessions_${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "chat_sessions",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          loadSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  /* ===============================
     AUTO SELECT CHAT
  =============================== */

  useEffect(() => {
    if (!activeChat && sessions.length > 0) {
      setActiveChat(sessions[0].id);
    }
  }, [sessions]);

  /* ===============================
     LOADING
  =============================== */

  if (user === undefined) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-white">
        Loading...
      </div>
    );
  }

  return (
    <Suspense fallback={fallbackScreen}>
      <Routes>
        {/* OAuth Callback */}
        <Route
          path="/auth/callback"
          element={<Callback />}
        />

        {/* Login */}
        <Route
          path="/auth"
          element={
            user
              ? <Navigate to="/" replace />
              : <Auth />
          }
        />

        {/* Chat */}
        <Route
          path="/"
          element={
            user ? (
              <div className="flex h-screen overflow-hidden bg-black text-white">

                <div
                  className={`overflow-hidden transition-all duration-300 ${
                    sidebarOpen ? "w-64" : "w-0"
                  }`}
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

                <div className="flex flex-1 flex-col overflow-hidden">

                  <div className="flex h-14 items-center border-b border-zinc-800 px-3">

                    <button
                      onClick={() =>
                        setSidebarOpen(!sidebarOpen)
                      }
                    >
                      ☰
                    </button>

                    <h1 className="ml-3 font-bold">
                      ReuNexus
                    </h1>

                  </div>

                  <ReubenAI
                    user={user}
                    activeChat={activeChat}
                    setActiveChat={setActiveChat}
                  />

                </div>

              </div>
            ) : (
              <Navigate
                to="/auth"
                replace
              />
            )
          }
        />

        {/* Visual Workspace */}
        <Route
          path="/visual"
          element={
            user
              ? <Visual />
              : <Navigate
                  to="/auth"
                  replace
                />
          }
        />

        {/* Settings */}
        <Route
          path="/settings"
          element={
            user
              ? <Settings user={user} />
              : <Navigate
                  to="/auth"
                  replace
                />
          }
        />

        {/* Catch All */}
        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </Suspense>
  );
}