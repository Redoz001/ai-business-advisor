import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reuben-ai`;

/* -----------------------------
   MESSAGE FACTORY
----------------------------- */
function createMessage(role, content, extra = {}) {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
    ...extra,
  };
}

export default function ReubenAI({ user, activeChat, setActiveChat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const endRef = useRef(null);

  /* -----------------------------
     AUTO SCROLL
  ----------------------------- */
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* -----------------------------
     LOAD CHAT HISTORY
  ----------------------------- */
  useEffect(() => {
    if (!activeChat) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", activeChat)
        .order("created_at", { ascending: true });

      if (error) {
        console.error(error);
        return;
      }

      const formatted =
        (data || []).map((m) =>
          createMessage(m.role, m.content, {
            db: true,
          })
        ) || [];

      setMessages(formatted);
    };

    load();
  }, [activeChat]);

  /* -----------------------------
     CREATE CHAT SESSION
  ----------------------------- */
  const createChat = async () => {
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert([
        {
          user_id: user?.id || null,
          title: "New Chat",
        },
      ])
      .select()
      .single();

    if (error) throw error;

    setActiveChat?.(data.id);
    return data.id;
  };

  /* -----------------------------
     SEND MESSAGE
  ----------------------------- */
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const text = input;
    setInput("");
    setError(null);

    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      let chatId = activeChat;

      if (!chatId) {
        chatId = await createChat();
      }

      /* -------------------------
         USER MESSAGE (optimistic)
      ------------------------- */
      const userMsg = createMessage("user", text);

      const thinkingMsg = createMessage("assistant", "Thinking...");

      setMessages((prev) => [...prev, userMsg, thinkingMsg]);

      /* -------------------------
         AUTH TOKEN
      ------------------------- */
      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;

      /* -------------------------
         API CALL
      ------------------------- */
      const res = await fetch(API_URL, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: text,
          chatId,
          userId: user?.id || "anon",
        }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText);
      }

      const data = await res.json();

      const reply = data?.reply || "No response";

      /* -------------------------
         UPDATE ASSISTANT MESSAGE
      ------------------------- */
      setMessages((prev) => {
        const copy = [...prev];
        const idx = copy.findLastIndex((m) => m.role === "assistant");
        if (idx !== -1) {
          copy[idx] = createMessage("assistant", reply);
        }
        return copy;
      });

      /* -------------------------
         SAVE ASSISTANT MESSAGE
      ------------------------- */
      await supabase.from("chat_messages").insert([
        {
          session_id: chatId,
          user_id: user?.id || null,
          role: "assistant",
          content: reply,
        },
      ]);
    } catch (err) {
      console.error(err);

      setError(err.message);

      setMessages((prev) => {
        const copy = [...prev];
        const idx = copy.findLastIndex((m) => m.role === "assistant");
        if (idx !== -1) {
          copy[idx] = createMessage(
            "assistant",
            "⚠️ Error: " + err.message
          );
        }
        return copy;
      });
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  /* -----------------------------
     STOP GENERATION
  ----------------------------- */
  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">

      {/* HEADER */}
      <div className="p-3 border-b border-zinc-800 flex justify-between">
        <div className="font-bold">ReubenAI</div>

        {loading && (
          <button
            onClick={stop}
            className="text-red-400 text-sm"
          >
            Stop
          </button>
        )}
      </div>

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-xl max-w-[80%] whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-green-400 text-black ml-auto"
                : "bg-zinc-900"
            }`}
          >
            {m.content}
          </div>
        ))}

        <div ref={endRef} />
      </div>

      {/* ERROR */}
      {error && (
        <div className="px-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* INPUT */}
      <div className="p-3 flex gap-2 border-t border-zinc-800">

        <textarea
          className="flex-1 bg-zinc-900 p-3 rounded-xl outline-none resize-none"
          value={input}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask ReubenAI..."
        />

        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-green-400 text-black px-4 rounded-xl font-bold disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}