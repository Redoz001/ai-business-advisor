import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';

import Login from './components/Login.jsx';
import ReubenAI from './components/ReubenAI.jsx';

export default function App() {

  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // =========================
  // AUTH HANDLER
  // =========================
  useEffect(() => {

    supabase.auth.getSession()
      .then(({ data: { session } }) => {
        setSession(session);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, currentSession) => {
        setSession(currentSession);
        setLoading(false);
      });

    return () => {
      if (subscription) subscription.unsubscribe();
    };

  }, []);

  // =========================
  // LOGOUT
  // =========================
  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  // =========================
  // LOADING SCREEN
  // =========================
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-black text-[#00ffcc] font-mono">
        [ INITIALIZING REUBEN AI... ]
      </div>
    );
  }

  // =========================
  // LOGIN SCREEN
  // =========================
  if (!session) {
    return <Login />;
  }

  // =========================
  // PAGE CONTENT
  // =========================
  const renderPage = () => {

    switch (activePage) {

      case 'dashboard':
        return (
          <div className="space-y-4">

            <h1 className="text-2xl font-bold">Dashboard</h1>

            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <h2 className="font-semibold">Welcome 👋</h2>

              <p className="text-sm text-zinc-400">
                Your AI SaaS system is running.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm text-zinc-400">Status</h3>
                <p className="text-green-400">Online</p>
              </div>

              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm text-zinc-400">User</h3>
                <p>{session.user.email}</p>
              </div>

              <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
                <h3 className="text-sm text-zinc-400">Plan</h3>
                <p>Free Tier</p>
              </div>

            </div>

          </div>
        );

      case 'chat':
        return <ReubenAI session={session} />;

      case 'history':
        return (
          <div>
            <h1 className="text-2xl font-bold mb-4">
              History
            </h1>

            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800">
              <p className="text-zinc-400">
                No history system connected yet.
              </p>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div>

            <h1 className="text-2xl font-bold mb-4">
              Settings
            </h1>

            <div className="bg-zinc-900 p-4 rounded-xl border border-zinc-800 space-y-3">

              <p>Email: {session.user.email}</p>

              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg"
              >
                Logout
              </button>

            </div>

          </div>
        );

      default:
        return <ReubenAI session={session} />;
    }
  };

  // =========================
  // MAIN UI
  // =========================
  return (

    <div className="flex h-screen bg-black text-white overflow-hidden">

      {/* SIDEBAR */}
      <div
        className={`
          fixed md:relative z-50 w-56 h-screen bg-zinc-950 border-r border-zinc-800 p-4
          transition-transform duration-200
          ${sidebarOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"}
        `}
      >

        {/* LOGO */}
        <h2 className="text-[#00ffcc] font-bold text-2xl mb-6">
          Reuben AI
        </h2>

        {/* DASHBOARD */}
        <button
          onClick={() => {
            setActivePage('dashboard');
            setSidebarOpen(false);
          }}
          className="block w-full text-left p-3 hover:bg-zinc-900 rounded-lg transition"
        >
          Dashboard
        </button>

        {/* CHAT */}
        <button
          onClick={() => {
            setActivePage('chat');
            setSidebarOpen(false);
          }}
          className="block w-full text-left p-3 hover:bg-zinc-900 rounded-lg transition"
        >
          Chat
        </button>

        {/* HISTORY */}
        <button
          onClick={() => {
            setActivePage('history');
            setSidebarOpen(false);
          }}
          className="block w-full text-left p-3 hover:bg-zinc-900 rounded-lg transition"
        >
          History
        </button>

        {/* SETTINGS */}
        <button
          onClick={() => {
            setActivePage('settings');
            setSidebarOpen(false);
          }}
          className="block w-full text-left p-3 hover:bg-zinc-900 rounded-lg transition"
        >
          Settings
        </button>

        {/* LOGOUT */}
        <button
          onClick={handleLogout}
          className="mt-10 w-full bg-red-500 hover:bg-red-600 text-white p-3 rounded-lg transition"
        >
          Logout
        </button>

      </div>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* TOP BAR */}
        <div className="flex items-center p-3 border-b border-zinc-800 bg-black">

          {/* MOBILE MENU */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-2xl mr-3 md:hidden text-white"
          >
            ☰
          </button>

          <h1 className="font-bold text-lg uppercase tracking-wide">
            {activePage}
          </h1>

        </div>

        {/* CONTENT */}
        <div className="flex-1 p-4 overflow-hidden">
          {renderPage()}
        </div>

      </div>

    </div>
  );
}