import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
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

/* -----------------------------
   STREAMING HELPER (ChatGPT STYLE)
----------------------------- */
function useTypewriter(setMessages, assistantIdRef) {
  const intervalRef = useRef(null);

  const streamText = (fullText) => {
    let i = 0;

    clearInterval(intervalRef.current);

    intervalRef.current = setInterval(() => {
      i += Math.max(1, Math.floor(fullText.length / 120)); // smooth speed

      const chunk = fullText.slice(0, i);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantIdRef.current
            ? { ...m, content: chunk }
            : m
        )
      );

      if (i >= fullText.length) {
        clearInterval(intervalRef.current);
      }
    }, 15);
  };

  return streamText;
}

export default function ReubenAI({ user, activeChat, setActiveChat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const abortRef = useRef(null);
  const assistantIdRef = useRef(null);

  const streamText = useTypewriter(setMessages, assistantIdRef);

  /* -----------------------------
     LOAD CHAT HISTORY
  ----------------------------- */
  useEffect(() => {
    if (!activeChat) return;

    const load = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", activeChat)
        .order("created_at", { ascending: true });

      setMessages(
        (data || []).map((m) =>
          createMessage(m.role, m.content)
        )
      );
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
     SEND MESSAGE (STREAM FIXED)
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
      if (!chatId) chatId = await createChat();

      const userMsg = createMessage("user", text);

      const assistantId = crypto.randomUUID();
      assistantIdRef.current = assistantId;

      const assistantMsg = createMessage("assistant", "", {
        id: assistantId,
      });

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

      // ✅ STREAM IT (ChatGPT STYLE)
      streamText(responseText);

      await supabase.from("chat_messages").insert([
        {
          session_id: chatId,
          role: "user",
          content: text,
        },
        {
          session_id: chatId,
          role: "assistant",
          content: responseText,
        },
      ]);
    } catch (err) {
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

  /* -----------------------------
     STOP GENERATION
----------------------------- */
  const stop = () => {
    abortRef.current?.abort();
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white">

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
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="mb-2">{children}</p>,
                ol: ({ children }) => (
                  <ol className="list-decimal ml-5 space-y-1">{children}</ol>
                ),
                ul: ({ children }) => (
                  <ul className="list-disc ml-5 space-y-1">{children}</ul>
                ),
              }}
            >
              {m.content}
            </ReactMarkdown>
          </div>
        ))}
      </div>

      {/* ERROR */}
      {error && (
        <div className="px-3 text-red-400 text-sm">{error}</div>
      )}

      {/* INPUT */}
      <div className="p-3 border-t border-zinc-800 flex gap-2">
        <input
          className="flex-1 p-2 bg-zinc-900 rounded outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") sendMessage();
          }}
          placeholder="Ask..."
        />

        <button
          onClick={sendMessage}
          className="px-4 py-2 bg-zinc-800 rounded"
        >
          {loading ? "Stop" : "Send"}
        </button>
      </div>
    </div>
  );
}