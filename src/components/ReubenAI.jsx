import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabase";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reuben-ai`;

function createMessage(role, content, extra = {}) {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    createdAt: Date.now(),
    ...extra,
  };
}

/* =========================
   STREAM HELPER (typing effect)
========================= */
function streamText(setter, text, speed = 15) {
  let i = 0;

  const interval = setInterval(() => {
    i++;
    setter(text.slice(0, i));

    if (i >= text.length) {
      clearInterval(interval);
    }
  }, speed);

  return () => clearInterval(interval);
}

export default function ReubenAI({ user, activeChat, setActiveChat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const bottomRef = useRef(null);

  /* AUTO SCROLL */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  /* LOAD CHAT HISTORY */
  useEffect(() => {
    if (!activeChat) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", activeChat)
        .order("created_at", { ascending: true });

      if (error) return console.error(error);

      setMessages(
        (data || []).map((m) => createMessage(m.role, m.content, { db: true }))
      );
    };

    load();
  }, [activeChat]);

  /* CREATE CHAT */
  const createChat = async () => {
    const { data, error } = await supabase
      .from("chat_sessions")
      .insert([{ user_id: user?.id || null, title: "New Chat" }])
      .select()
      .single();

    if (error) throw error;

    setActiveChat?.(data.id);
    return data.id;
  };

  /* SEND MESSAGE (STREAMING VERSION) */
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
      if (!chatId) chatId = await createChat();

      const userMsg = createMessage("user", text);

      // assistant placeholder (EMPTY for streaming)
      const assistantMsg = createMessage("assistant", "");

      setMessages((prev) => [...prev, userMsg, assistantMsg]);

      const session = await supabase.auth.getSession();
      const token = session?.data?.session?.access_token;

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

      if (!res.ok) throw new Error(await res.text());

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : null;

      const responseText = data?.payload || "";

      /* STREAM INTO UI (ChatGPT style typing) */
      let liveText = "";

      streamText((val) => {
        setMessages((prev) => {
          const copy = [...prev];
          const idx = copy.findLastIndex((m) => m.role === "assistant");
          if (idx !== -1) {
            copy[idx] = {
              ...copy[idx],
              content: val,
            };
          }
          return copy;
        });
      }, responseText);

      /* SAVE AFTER STREAM COMPLETE */
      setTimeout(async () => {
        await supabase.from("chat_messages").insert([
          { session_id: chatId, role: "user", content: text },
          { session_id: chatId, role: "assistant", content: responseText },
        ]);
      }, responseText.length * 15 + 300);
    } catch (err) {
      console.error(err);
      setError(err.message);

      setMessages((prev) => [
        ...prev,
        createMessage("assistant", "⚠️ " + err.message),
      ]);
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">

      {/* HEADER (cleaned branding) */}
      <div className="p-3 border-b border-zinc-800 flex justify-between">
        <div className="font-bold">Chat</div>

        {loading && (
          <button onClick={stop} className="text-red-400 text-sm">
            Stop
          </button>
        )}
      </div>

      {/* CHAT */}
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
            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
        ))}

        <div ref={bottomRef} />
      </div>

      {/* ERROR */}
      {error && <div className="px-3 text-red-400 text-sm">{error}</div>}

      {/* INPUT */}
      <div className="p-3 border-t border-zinc-800 flex gap-2">
        <input
          className="flex-1 p-2 bg-zinc-900 rounded outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Ask anything..."
        />

        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-zinc-800 rounded"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}