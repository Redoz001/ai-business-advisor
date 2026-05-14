/**
 * PROJECT: REUBEN MURIMI SINGULARITY
 * Entry Point (Clean Production Version)
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

/**
 * SIMPLE SAFE PERFORMANCE LOGGING (no dependencies)
 */
if (import.meta.env.PROD) {
  console.log("📊 App Performance Monitoring Active");

  window.addEventListener("load", () => {
    const nav = performance.getEntriesByType("navigation")[0];

    if (nav) {
      console.log("⚡ Page Load Time:", nav.loadEventEnd - nav.startTime);
      console.log("⚡ DOM Ready:", nav.domContentLoadedEventEnd - nav.startTime);
    }
  });
}

/**
 * GLOBAL ERROR HANDLER
 */
window.addEventListener('error', (event) => {
  console.error('⚠️ SYSTEM ERROR:', event.error);
});

/**
 * APP BOOTSTRAP
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);