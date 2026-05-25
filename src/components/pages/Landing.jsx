import React, { useEffect, useState } from 'react';

export default function Landing() {
  const [typedText, setTypedText] = useState('');
  const [isVisible, setIsVisible] = useState(false);
  // Optimization: Track window size in state to prevent layout thrashing
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize(); // Initialize on mount
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // ... (Typing Effect and Page Animation remain unchanged) ...
  useEffect(() => {
    const fullText = 'The Future of AI Productivity, Automation & Intelligent Conversation';
    let index = 0;
    const interval = setInterval(() => {
      setTypedText(fullText.slice(0, index));
      index++;
      if (index > fullText.length) clearInterval(interval);
    }, 28);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), 200);
    return () => clearTimeout(timer);
  }, []);

  const goToLogin = () => window.location.href = '/login';
  const goToApp = () => window.location.href = '/app';

  return (
    <div style={{ background: '#000', color: '#fff', minHeight: '100vh', overflowX: 'hidden', fontFamily: 'Inter, Arial, sans-serif' }}>
      
      {/* Background Effects remain unchanged */}
      <div style={{ position: 'fixed', top: -200, left: -200, width: 500, height: 500, background: '#00ffcc', opacity: 0.08, filter: 'blur(140px)', zIndex: 0 }} />
      <div style={{ position: 'fixed', bottom: -200, right: -200, width: 500, height: 500, background: '#00aaff', opacity: 0.08, filter: 'blur(140px)', zIndex: 0 }} />

      {/* NAVBAR */}
      <nav style={{ width: '100%', padding: '22px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'fixed', top: 0, left: 0, zIndex: 1000, backdropFilter: 'blur(16px)', background: 'rgba(0,0,0,0.55)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 42, height: 42, borderRadius: 12, background: 'linear-gradient(135deg,#00ffcc,#00aaff)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#000', fontWeight: 900, fontSize: 18, boxShadow: '0 0 25px rgba(0,255,204,0.35)' }}>R</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -1 }}>Reuben AI</div>
            <div style={{ color: '#777', fontSize: 12 }}>Intelligent SaaS Platform</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 15 }}>
          <button onClick={goToLogin} style={navButton} aria-label="Login to account">Login</button>
          <button onClick={goToApp} style={launchButton} aria-label="Launch application">Launch App</button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '160px 30px 100px', position: 'relative', zIndex: 2, opacity: isVisible ? 1 : 0, transform: isVisible ? 'translateY(0px)' : 'translateY(25px)', transition: 'all 1s ease' }}>
        <div style={{ maxWidth: 1100 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 999, border: '1px solid rgba(0,255,204,0.25)', background: 'rgba(0,255,204,0.08)', color: '#00ffcc', marginBottom: 35, fontSize: 14, fontWeight: 600 }}>⚡ Powered by GROQ + React + Supabase</div>
          
          {/* Using isMobile state for cleaner logic */}
          <h1 style={{ fontSize: isMobile ? 52 : 92, fontWeight: 900, lineHeight: 1, marginBottom: 25, letterSpacing: -4 }}>Reuben AI</h1>
          <h2 style={{ fontSize: isMobile ? 28 : 56, fontWeight: 700, lineHeight: 1.2, marginBottom: 30, color: '#f5f5f5' }}>
            {typedText}<span style={{ color: '#00ffcc' }}>|</span>
          </h2>
          
          <p style={{ maxWidth: 850, margin: '0 auto', fontSize: 20, lineHeight: 1.9, color: '#9a9a9a' }}>
            A next-generation AI platform engineered for intelligent chat, productivity, automation, memory systems, voice interaction, scalable SaaS deployment, and real-time AI experiences.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 50, flexWrap: 'wrap' }}>
            <button onClick={goToApp} style={heroPrimaryButton} aria-label="Launch Reuben AI Application">🚀 Launch Reuben AI</button>
            <button onClick={goToLogin} style={heroSecondaryButton} aria-label="Sign In">Sign In</button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 30, marginTop: 90, flexWrap: 'wrap' }}>
            <StatCard title="24/7" subtitle="AI Availability" />
            <StatCard title="Ultra Fast" subtitle="GROQ Inference" />
            <StatCard title="Secure" subtitle="Supabase Auth" />
            <StatCard title="Realtime" subtitle="AI Responses" />
          </div>
        </div>
      </section>

      {/* Rest of components omitted for brevity, logic remains identical */}
    </div>
  );
}
// ... (Keep your existing FeatureCard, StatCard, and style constants at the bottom)