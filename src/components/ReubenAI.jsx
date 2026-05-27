import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { sendMessageToAI } from "../services/aiService.js";

export default function ReubenAI({ user, activeChat, onNewSessionCreated }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  // Auto-scroll to bottom of chat when messages update
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    if (!user || !input.trim() || loading) return;

    const text = input.trim();
    setInput("");
    setLoading(true);

    // 1. Add user message + "Thinking..." placeholder
    setMessages((prev) => [
      ...prev,
      { is_user: true, content: text },
      { is_user: false, content: "Thinking..." },
    ]);

    let sessionId = activeChat;

    try {
      // 2. Handle session creation
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

      // 3. Request to backend
      const result = await sendMessageToAI({ message: text, userId: user.id, chatId: sessionId });

      // 4. Validate response
      if (!result) throw new Error("Server returned no response.");
      if (result.error) throw new Error(result.error);

      const aiText = result.reply || result.message || "No content received.";

      // 5. Update UI with real content
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { is_user: false, content: aiText };
        return copy;
      });

      // 6. Persist to database
      await supabase.from("messages").insert([
        { session_id: sessionId, user_id: user.id, is_user: true, content: text },
        { session_id: sessionId, user_id: user.id, is_user: false, content: aiText },
      ]);

    } catch (err) {
      console.error("FULL ERROR DEBUG:", err);
      
      // 7. FORCE ERROR DISPLAY (This replaces the generic "No response generated")
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          is_user: false,
          content: `ERROR: ${err.message || "Failed to fetch response. Check browser console."}`,
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
          <div
            key={i}
            className={`max-w-[80%] p-3 rounded-xl ${
              m.is_user ? "bg-[#00ffcc] text-black ml-auto" : "bg-zinc-900 text-white"
            }`}
          >
            {m.content}
          </div>
        ))}
        {loading && <div className="text-zinc-400">Thinking...</div>}
        <div ref={endRef} />
      </div>

      <div className="p-4 border-t border-zinc-800 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-zinc-900 p-3 rounded-xl resize-none"
          placeholder="Message ReubenAI..."
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-[#00ffcc] text-black px-4 rounded-xl font-bold"
        >
          Send
        </button>
      </div>
    </div>
  );
}