import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabase.js";
import Auth from "./Auth.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ReubenAI from "./components/ReubenAI.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // ================================
  // CHECK AUTH SESSION
  // ================================
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // ================================
  // SHOW AUTH PAGE
  // ================================
  if (!user) {
    return <Auth setUser={setUser} />;
  }

  return (
    <div className="h-screen w-screen bg-black text-white flex overflow-hidden">

      {/* ================================
          SIDEBAR
      ================================= */}
      <div
        className={`
          bg-zinc-950 border-r border-zinc-800
          transition-all duration-300 ease-in-out
          overflow-hidden flex-shrink-0
          ${isSidebarOpen ? "w-64" : "w-0"}
        `}
      >
        <div className="h-full w-64">
          <Sidebar
            activeSession={activeSession}
            onSelectSession={setActiveSession}
            onNewChat={() => setActiveSession(null)}
          />
        </div>
      </div>

      {/* ================================
          MAIN CHAT AREA
      ================================= */}
      <div className="flex-1 flex flex-col relative bg-black overflow-hidden">

        {/* ================================
            TOP BAR
        ================================= */}
        <div className="h-16 border-b border-zinc-800 flex items-center px-4 bg-black z-20">

          {/* MENU BUTTON */}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="
              text-white text-2xl
              hover:bg-zinc-800
              p-2 rounded-xl
              transition
            "
          >
            ☰
          </button>

          {/* LOGO / TITLE */}
          <h1 className="ml-4 text-lg font-semibold tracking-wide">
            ReubenAI
          </h1>
        </div>

        {/* ================================
            CHAT CONTENT
        ================================= */}
        <div className="flex-1 overflow-hidden">
          <ReubenAI
            user={user}
            activeChat={activeSession}
            onNewSessionCreated={(id) => setActiveSession(id)}
          />
        </div>
      </div>
    </div>
  );
}