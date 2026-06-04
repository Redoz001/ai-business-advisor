import React, { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabase";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

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

  useEffect(() => {
    const name = getUserName();
    const random =
      welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

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
  useEffect(() => {
    sessionRef.current = activeChat;
    setMessages([]);
    titleGeneratedRef.current = false;

    if (!activeChat) return;
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

    const text = input;
    setInput("");
    setLoading(true);

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

      const raw = await res.text();
      const data = raw ? JSON.parse(raw) : null;

      const responseText = data?.payload || "";

      typeMessage(responseText, aiId);

      await supabase.from("chat_messages").insert({
        session_id: activeChat,
        role: "assistant",
        content: responseText,
      });
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: "⚠️ " + err.message,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-white w-full">

      {/* CHAT AREA */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 md:p-4 space-y-4"
      >
        {messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-zinc-500 text-center px-4 leading-relaxed">
            {welcomeMessage}
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

      {/* INPUT */}
      <div className="p-2 md:p-3 border-t border-zinc-800 flex gap-2">
        <input
          className="flex-1 p-2 bg-zinc-900 rounded outline-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder="Ask ReuNexus Anything..."
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