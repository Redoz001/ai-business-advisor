import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { getAIStream } from "../services/aiService.js";

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

    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("session_id", activeChat)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    })();
  }, [activeChat]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const text = input;
    setInput("");

    let sessionId = activeChat;

    if (!sessionId) {
      const { data } = await supabase
        .from("chat_sessions")
        .insert([
          {
            user_id: user.id,
            title: text.slice(0, 30),
          },
        ])
        .select()
        .single();

      sessionId = data.id;
      onNewSessionCreated?.(sessionId);
    }

    setMessages((p) => [...p, { role: "user", content: text }]);

    setLoading(true);

    try {
      const stream = await getAIStream({ message: text });

      let finalText = "";

      // placeholder assistant message
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      for await (const chunk of stream) {
        finalText = chunk;

        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            role: "assistant",
            content: finalText,
          };
          return copy;
        });
      }

      await supabase.from("messages").insert([
        {
          session_id: sessionId,
          user_id: user.id,
          role: "user",
          content: text,
        },
        {
          session_id: sessionId,
          user_id: user.id,
          role: "assistant",
          content: finalText,
        },
      ]);
    } catch (err) {
      console.error(err);
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
              m.role === "user"
                ? "bg-[#00ffcc] text-black ml-auto"
                : "bg-zinc-900 text-white"
            }`}
          >
            {m.content}
          </div>
        ))}

        {loading && (
          <div className="text-zinc-400">ReubenAI is thinking...</div>
        )}

        <div ref={endRef} />
      </div>

      <div className="p-4 border-t border-zinc-800 flex gap-2">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          className="flex-1 bg-zinc-900 p-3 rounded-xl"
          placeholder="Message ReubenAI..."
        />

        <button
          onClick={sendMessage}
          className="bg-[#00ffcc] text-black px-4 rounded-xl"
        >
          Send
        </button>
      </div>
    </div>
  );
}