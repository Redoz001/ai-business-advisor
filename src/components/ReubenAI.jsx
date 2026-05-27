import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { sendMessageToAI } from "../services/aiService.js";

export default function ReubenAI({ user, activeChat, onNewSessionCreated }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!user || !input.trim() || loading) return;

    const text = input.trim();
    setInput("");
    setLoading(true);

    let sessionId = activeChat;

    try {
      // 1. Session check
      if (!sessionId) {
        const { data, error } = await supabase
          .from("chat_sessions")
          .insert([{ user_id: user.id, title: text.slice(0, 30) }])
          .select()
          .single();
        if (error) throw error;
        sessionId = data.id;
        if (typeof onNewSessionCreated === "function") onNewSessionCreated(sessionId);
      }

      // 2. Add placeholders
      setMessages((prev) => [...prev, { is_user: true, content: text }, { is_user: false, content: "Thinking..." }]);

      // 3. Call AI Service
      const result = await sendMessageToAI({ message: text, userId: user.id, chatId: sessionId });

      // 4. FIX: Stop the generic "No response generated"
      // If the backend didn't return an error property, check if it returned the content
      if (!result) throw new Error("Server returned an empty response.");
      
      const aiText = result.reply || result.message || result.response;
      
      if (!aiText) {
        // If we are here, the server didn't send an error, but it also didn't send a message
        throw new Error("Server responded but contained no message (Check your Backend logic).");
      }

      // 5. Update UI
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { is_user: false, content: aiText };
        return copy;
      });

      // 6. Save to Database
      await supabase.from("messages").insert([
        { session_id: sessionId, user_id: user.id, is_user: true, content: text },
        { session_id: sessionId, user_id: user.id, is_user: false, content: aiText },
      ]);

    } catch (err) {
      console.error("DEBUG ERROR:", err);
      // THIS WILL NOW SHOW THE REAL ERROR ON YOUR SCREEN
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { 
          is_user: false, 
          content: `Error: ${err.message}` 
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m, i) => (
          <div key={i} className={`max-w-[80%] p-3 rounded-xl ${m.is_user ? "bg-[#00ffcc] text-black ml-auto" : "bg-zinc-900 text-white"}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="text-zinc-400">ReubenAI is thinking...</div>}
        <div ref={endRef} />
      </div>
      <div className="p-4 border-t border-zinc-800 flex gap-2">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} className="flex-1 bg-zinc-900 p-3 rounded-xl resize-none" placeholder="Message ReubenAI..." />
        <button onClick={sendMessage} disabled={loading} className="bg-[#00ffcc] text-black px-4 rounded-xl font-bold">Send</button>
      </div>
    </div>
  );
}