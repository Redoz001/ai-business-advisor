import React, { useState, useEffect } from "react";
import { supabase } from "./lib/supabase.js"; // Ensure this path matches your structure
import Auth from "./Auth.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ReubenAI from "./components/ReubenAI.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    // Check for existing session on load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null);
    });
  }, []);

  // If user is not logged in, show Auth component
  if (!user) return <Auth setUser={setUser} />;

  return (
    <div className="flex h-screen bg-black text-white relative">
      
      {/* 1. Floating Toggle Button */}
      {/* Absolute positioning ensures it stays visible even when sidebar is hidden */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)} 
        className="absolute top-4 left-4 z-50 text-2xl text-white p-2 hover:bg-zinc-800 rounded transition-colors"
      >
        ☰
      </button>

      {/* 2. Sidebar (Width animates based on isSidebarOpen state) */}
      <div className={`${isSidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 overflow-hidden border-r border-zinc-800`}>
        <Sidebar 
          activeSession={activeSession} 
          onSelectSession={setActiveSession} 
          onNewChat={() => setActiveSession(null)} 
        />
      </div>

      {/* 3. Main Content Area */}
      <div className="flex-1 relative">
        <ReubenAI 
          user={user} 
          activeChat={activeSession} 
          onNewSessionCreated={(id) => setActiveSession(id)} 
        />
      </div>
    </div>
  );
}