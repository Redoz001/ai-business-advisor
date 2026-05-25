import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { getAIResponse } from "../services/aiService.js";

// Note: Using the exact prop name defined in App.jsx
export default function ReubenAI({ user, activeChat, onNewSessionCreated }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeChat) { 
      setMessages([]); 
      return; 
    }
    
    const fetchHistory = async () => {
      const { data } = await supabase
        .from('messages')
        .select('*')
        .eq('session_id', activeChat)
        .order('created_at', { ascending: true });
      setMessages(data || []);
    };
    fetchHistory();
  }, [activeChat]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    
    const userMessage = input.trim();
    setInput("");
    setLoading(true);

    try {
      let sessionId = activeChat;

      // 1. Create session if it doesn't exist
      if (!sessionId) {
        const { data, error } = await supabase
          .from('chat_sessions')
          .insert([{ user_id: user.id, title: userMessage.substring(0, 30) }])
          .select()
          .single();
        if (error) throw error;
        
        sessionId = data.id;
        
        // This now matches the prop passed in App.jsx
        if (typeof onNewSessionCreated === 'function') {
            onNewSessionCreated(sessionId);
        }
      }

      // 2. Save user message to database
      await supabase.from('messages').insert({ session_id: sessionId, role: 'user', content: userMessage });
      setMessages(prev => [...prev, { role: 'user', content: userMessage }]);

      // 3. Get AI Response
      const aiResponse = await getAIResponse([...messages, { role: 'user', content: userMessage }]);
      
      // 4. Save AI response to database
      await supabase.from('messages').insert({ session_id: sessionId, role: 'assistant', content: aiResponse });
      setMessages(prev => [...prev, { role: 'assistant', content: aiResponse }]);

    } catch (err) {
      console.error("AI Error:", err);
      alert("AI failed to respond: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-black text-white p-4">
      <div className="flex-1 overflow-y-auto space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`p-4 rounded-xl max-w-lg ${m.role === 'user' ? 'bg-[#00ffcc] text-black ml-auto' : 'bg-zinc-800'}`}>
            {m.content}
          </div>
        ))}
      </div>
      <div className="mt-4">
        <input 
          value={input} 
          onChange={(e) => setInput(e.target.value)}
          className="w-full bg-zinc-900 p-3 rounded-xl border border-zinc-700"
          placeholder={loading ? "Reuben is thinking..." : "Ask Reuben..."}
          disabled={loading}
        />
        <button onClick={sendMessage} className="mt-2 bg-[#00ffcc] text-black font-bold p-3 rounded-xl w-full">Send</button>
      </div>
    </div>
  );
}