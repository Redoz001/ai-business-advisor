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

  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }
    const fetchMessages = async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", activeChat)
        .order("created_at", { ascending: true });
      if (error) {
        console.error("Fetch messages error:", error);
        return;
      }
      setMessages(data || []);
    };
    fetchMessages();
  }, [activeChat]);

  const sendMessage = async () => {
    if (!user || !input.trim() || loading) return;

    const text = input.trim();
    setInput("");
    setLoading(true);

    let sessionId = activeChat;

    try {
      // 1. Session Creation
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

      // 2. UI Update
      setMessages((prev) => [...prev, { is_user: true, content: text }, { is_user: false, content: "Thinking..." }]);

      // 3. API Call
      const result = await sendMessageToAI({ message: text, userId: user.id, chatId: sessionId });

      // 4. Detailed Error Checking
      if (!result) throw new Error("No response received from server.");
      if (result.success === false) throw new Error(result.error || "Unknown backend error.");

      const aiText = result.reply || result.message || "No content returned.";

      // 5. Update Chat
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { is_user: false, content: aiText };
        return copy;
      });

      // 6. Save to DB
      await supabase.from("messages").insert([
        { session_id: sessionId, user_id: user.id, is_user: true, content: text },
        { session_id: sessionId, user_id: user.id, is_user: false, content: aiText },
      ]);

    } catch (err) {
      console.error("Full Error Details:", err);
      // This forces the chat UI to show the real error
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { is_user: false, content: `Error: ${err.message}` };
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