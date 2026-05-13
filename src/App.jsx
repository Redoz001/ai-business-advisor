// src/App.jsx

import React, { useState } from 'react';
import Chat from './chat.jsx'; // Add the .jsx extension explicitly
import './App.css';

function App() {
  // ... rest of your code

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>REUBEN MURIMI: UNLIMITED</h1>
          <p>Sovereign Intelligence | Ghost Protocol Active</p>
        </div>
        <div className="header-stats">
          <div className="stat-badge"><span className="stat-label">DOMAINS</span><span className="stat-value active">∞</span></div>
          <div className="stat-badge"><span className="stat-label">MODE</span><span className="stat-value">RECURSIVE</span></div>
        </div>
      </header>

      <main className="main-content">
        <Chat />
      </main>

      <footer className="app-footer">
        SIGNED BY PRIME ARCHITECT: REUBEN MURIMI | KERNEL OPTIMIZED
      </footer>
    </div>
  );
}

export default App;
