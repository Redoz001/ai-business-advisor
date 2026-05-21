import React, { useState } from 'react';
import { supabase } from '../lib/supabase.js';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    let error;
    if (isSignUp) {
      const res = await supabase.auth.signUp({ email, password });
      error = res.error;
      if (!error) alert("Check your email for the confirmation link!");
    } else {
      const res = await supabase.auth.signInWithPassword({ email, password });
      error = res.error;
    }

    if (error) alert(error.message);
    setLoading(false);
  };

  return (
    <div className="flex justify-center items-center h-screen bg-black text-white font-sans">
      <form onSubmit={handleAuth} className="p-8 bg-gray-900 border border-gray-800 rounded-lg w-96 shadow-xl">
        <h2 className="mb-6 text-2xl font-bold text-center">Reuben AI</h2>
        
        <input 
          className="w-full p-3 mb-4 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-[#00ffcc]" 
          type="email" 
          placeholder="Email Address" 
          required
          onChange={(e) => setEmail(e.target.value)} 
        />
        
        <input 
          className="w-full p-3 mb-6 bg-gray-800 border border-gray-700 rounded focus:outline-none focus:border-[#00ffcc]" 
          type="password" 
          placeholder="Password" 
          required
          onChange={(e) => setPassword(e.target.value)} 
        />
        
        <button disabled={loading} className="w-full p-3 bg-[#00ffcc] text-black font-bold rounded mb-4 hover:bg-[#00cca3] transition-colors">
          {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
        </button>

        <p className="text-center text-sm text-gray-400 cursor-pointer hover:text-white" onClick={() => setIsSignUp(!isSignUp)}>
          {isSignUp ? 'Already have an account? Sign in.' : "Don't have an account? Sign up."}
        </p>
      </form>
    </div>
  );
}