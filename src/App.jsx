import React, { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';

import Login from './components/Login.jsx';
import ReubenAI from './components/ReubenAI.jsx';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activePage, setActivePage] = useState('dashboard');

  useEffect(() => {
    supabase.auth.getSession()
      .then(({ data: { session } }) => setSession(session))
      .finally(() => setLoading(false));

    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setLoading(false);
      });

    return () => subscription?.unsubscribe();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <div style={styles.loading}>
        <h2>INITIALIZING SYSTEM</h2>
        <p>Checking authentication...</p>
      </div>
    );
  }

  if (!session) return <Login />;

  const renderPage = () => {
    switch (activePage) {

      case 'dashboard':
        return (
          <div>
            <h1>Dashboard</h1>

            <div style={styles.card}>
              <h3>System Status</h3>
              <p>Online ✅</p>
            </div>

            <div style={styles.card}>
              <h3>User</h3>
              <p>{session.user.email}</p>
            </div>
          </div>
        );

      case 'chat':
        return <ReubenAI session={session} />;

      case 'history':
        return (
          <div>
            <h1>History</h1>
            <div style={styles.card}>
              <p>Chat history will appear here (Supabase-ready).</p>
            </div>
          </div>
        );

      case 'settings':
        return (
          <div>
            <h1>Settings</h1>

            <div style={styles.card}>
              <p>{session.user.email}</p>
            </div>

            <button onClick={logout} style={styles.btn}>
              Logout
            </button>
          </div>
        );
    }
  };

  return (
    <div style={styles.app}>

      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <h2 style={styles.logo}>REUBEN AI</h2>

        <button onClick={() => setActivePage('dashboard')} style={styles.menuBtn}>
          Dashboard
        </button>

        <button onClick={() => setActivePage('chat')} style={styles.menuBtn}>
          Chat
        </button>

        <button onClick={() => setActivePage('history')} style={styles.menuBtn}>
          History
        </button>

        <button onClick={() => setActivePage('settings')} style={styles.menuBtn}>
          Settings
        </button>

        <div style={{ marginTop: 'auto' }}>
          <button onClick={logout} style={styles.logout}>
            Logout
          </button>
        </div>
      </div>

      {/* MAIN */}
      <div style={styles.main}>
        {renderPage()}
      </div>

    </div>
  );
}

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    background: '#000',
    color: '#fff'
  },

  sidebar: {
    width: 240,
    background: '#111',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    borderRight: '1px solid #222'
  },

  logo: {
    color: '#00ffcc',
    marginBottom: 20
  },

  menuBtn: {
    padding: 12,
    background: '#1a1a1a',
    border: '1px solid #333',
    color: '#fff',
    borderRadius: 10,
    cursor: 'pointer'
  },

  logout: {
    padding: 12,
    background: '#222',
    border: '1px solid #444',
    color: '#fff',
    borderRadius: 10,
    width: '100%'
  },

  main: {
    flex: 1,
    padding: 30,
    overflowY: 'auto'
  },

  card: {
    background: '#111',
    border: '1px solid #222',
    padding: 20,
    borderRadius: 12,
    marginBottom: 15
  },

  btn: {
    padding: 12,
    background: '#fff',
    color: '#000',
    borderRadius: 8,
    border: 'none'
  },

  loading: {
    height: '100vh',
    background: '#000',
    color: '#00ffcc',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  }
};