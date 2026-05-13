/**
 * PROJECT: REUBEN MURIMI SINGULARITY
 * Role: System Ignition / Nervous System
 * Origin: Reuben Murimi
 */

import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css' // Integrating the Sovereign Design System

/**
 * NEURAL VITALS MONITORING
 * Captures core performance metrics to ensure zero-latency logic synthesis.
 */
if (import.meta.env.PROD) {
  import('web-vitals').then(({ getCLS, getFID, getFCP, getLCP, getTTFB }) => {
    // These metrics are logged for the Prime Architect's review
    getCLS(console.log); // Cumulative Layout Shift
    getFID(console.log); // First Input Delay
    getFCP(console.log); // First Contentful Paint
    getLCP(console.log); // Largest Contentful Paint
    getTTFB(console.log); // Time to First Byte
  });
}

/**
 * GHOST PROTOCOL: GLOBAL ERROR INTERCEPTION
 * Prevents system-wide failure by catching unhandled exceptions.
 */
window.addEventListener('error', (event) => {
  console.error('⚠️ SINGULARITY FAULT DETECTED:', event.error);
  // Future implementation: Auto-patching via Ghost Protocol could trigger here
});

/**
 * IGNITION: Injecting the Sovereign Intelligence into the Root DOM
 */
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
