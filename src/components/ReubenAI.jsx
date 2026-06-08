import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabase";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

<<<<<<< HEAD
export default function ReuNexus({ activeChat, user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  const sessionRef = useRef(activeChat);
  const titleGeneratedRef = useRef(false);

  /* =========================
     🔥 ROTATING WELCOME MESSAGES
  ========================= */
  const welcomeMessages = [
    (name) => `Hey ${name}, how can I help you today?`,
    (name) => `Welcome back ${name}. What are we building today?`,
    (name) => `Hi ${name} 👋 Ask me anything.`,
    (name) => `Good to see you ${name}. Ready when you are.`,
    (name) => `Hey ${name}, let’s solve something today.`,
    (name) => `Hello ${name}. What would you like to explore?`,
    (name) => `Hi ${name}, I’m here to help.`,
    (name) => `Hey ${name}, your AI assistant is ready.`,
    (name) => `Welcome ${name}. Let’s get started.`,
    (name) => `Yo ${name}! What are we working on today?`,
  ];

  const getUserName = () => {
    if (!user?.email) return "there";
    return user.email.split("@")[0];
  };

  const [welcomeMessage, setWelcomeMessage] = useState("");
=======
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
>>>>>>> 66bcdd993b0721b3eed3ad817603a06ee42f235c

  /* -----------------------------
     AUTO SCROLL
  ----------------------------- */
  useEffect(() => {
    const name = getUserName();
    const random =
      welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

<<<<<<< HEAD
    setWelcomeMessage(random(name));
  }, [activeChat, user]);

  /* =========================
     TITLE GENERATION
  ========================= */
  const generateFallbackTitle = (text) => {
    return text
      .replace(/[^\w\s]/g, "")
      .split(" ")
      .slice(0, 5)
      .join(" ");
  };

  const generateAITitle = async (text) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reuben-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            message: text,
            mode: "title",
          }),
        }
      );

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : null;

      return data?.payload || generateFallbackTitle(text);
    } catch {
      return generateFallbackTitle(text);
    }
  };

  /* =========================
     CHAT SYNC
  ========================= */
=======
  /* -----------------------------
     LOAD CHAT HISTORY
  ----------------------------- */
>>>>>>> 66bcdd993b0721b3eed3ad817603a06ee42f235c
  useEffect(() => {
    sessionRef.current = activeChat;
    setMessages([]);
    titleGeneratedRef.current = false;

    if (!activeChat) return;
<<<<<<< HEAD
    loadMessages(activeChat);
  }, [activeChat]);

  const loadMessages = async (chatId) => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", chatId)
      .order("created_at", { ascending: true });

    if (data) {
      setMessages(
        data.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
        }))
      );
    }
  };

  /* =========================
     AUTO SCROLL
  ========================= */
  useEffect(() => {
    scrollRef.current?.scrollTo(0, scrollRef.current.scrollHeight);
  }, [messages]);

  /* =========================
     TYPE EFFECT
  ========================= */
  const typeMessage = (text, id) => {
    let i = 0;

    const interval = setInterval(() => {
      i++;
      setMessages((prev) =>
        prev.map((m) =>
          m.id === id ? { ...m, content: text.slice(0, i) } : m
        )
      );
      if (i >= text.length) clearInterval(interval);
    }, 8);
  };

  /* =========================
     SEND MESSAGE
  ========================= */
  const send = async () => {
    if (!input.trim() || loading || !activeChat) return;
=======

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
>>>>>>> 66bcdd993b0721b3eed3ad817603a06ee42f235c

    const text = input;
    setInput("");
    setError(null);

    setLoading(true);

<<<<<<< HEAD
    const userMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };

    const aiId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      userMsg,
      { id: aiId, role: "assistant", content: "" },
    ]);

    /* TITLE (UNCHANGED LOGIC) */
    if (!titleGeneratedRef.current) {
      titleGeneratedRef.current = true;

      const fallback = generateFallbackTitle(text);

      await supabase
        .from("chat_sessions")
        .update({ title: fallback })
        .eq("id", activeChat);

      generateAITitle(text).then((aiTitle) => {
        if (aiTitle) {
          supabase
            .from("chat_sessions")
            .update({ title: aiTitle })
            .eq("id", activeChat);
        }
      });
    }

    await supabase.from("chat_messages").insert({
      session_id: activeChat,
      role: "user",
      content: text,
    });

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reuben-ai`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            message: text,
            context: { sessionHistory: messages.slice(-6) },
          }),
        }
      );
=======
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
>>>>>>> 66bcdd993b0721b3eed3ad817603a06ee42f235c

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : null;

      const responseText = data?.payload || "";

<<<<<<< HEAD
      typeMessage(responseText, aiId);

      await supabase.from("chat_messages").insert({
        session_id: activeChat,
        role: "assistant",
        content: responseText,
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
=======
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
>>>>>>> 66bcdd993b0721b3eed3ad817603a06ee42f235c
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "⚠️ " + err.message,
        },
      ]);
<<<<<<< HEAD
=======
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
>>>>>>> 66bcdd993b0721b3eed3ad817603a06ee42f235c
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
    <div className="flex flex-col h-full bg-zinc-950 text-white w-full">

<<<<<<< HEAD
      {/* CHAT AREA */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-center px-4 leading-relaxed">
            {welcomeMessage}
=======
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
>>>>>>> 66bcdd993b0721b3eed3ad817603a06ee42f235c
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${
                m.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div className="max-w-[92%] md:max-w-xl p-3 rounded bg-zinc-800 whitespace-pre-wrap leading-relaxed">
                <ReactMarkdown
                  components={{
                    p: ({ children }) => (
                      <p className="mb-3 leading-7">{children}</p>
                    ),
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ERROR */}
      {error && (
        <div className="px-3 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* INPUT */}
      <div className="p-2 md:p-3 border-t border-zinc-800 flex gap-2">
        <input
          className="flex-1 p-2 bg-zinc-900 rounded outline-none"
          value={input}
          rows={2}
          onChange={(e) => setInput(e.target.value)}
<<<<<<< HEAD
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask ReuNexus Anything..."
=======
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
          placeholder="Ask ReubenAI..."
>>>>>>> 66bcdd993b0721b3eed3ad817603a06ee42f235c
        />
        <button
          onClick={send}
          className="px-3 md:px-4 py-2 bg-zinc-800 rounded"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}