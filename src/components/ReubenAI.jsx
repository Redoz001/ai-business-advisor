import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
} from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "../lib/supabase";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reuben-ai`;

/* =========================
   CODE BLOCK (copy button)
========================= */
const CodeBlock = ({ children, className }) => {
  const code = String(children);

  const copyCode = async () => {
    await navigator.clipboard.writeText(code);
  };

  return (
    <div className="relative bg-black rounded-lg border border-zinc-800 my-2">
      <button
        onClick={copyCode}
        className="absolute top-2 right-2 text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded"
      >
        Copy
      </button>

      <pre className="p-3 overflow-x-auto text-sm">
        <code className={className}>{code}</code>
      </pre>
    </div>
  );
};

/* =========================
   MESSAGE FACTORY
========================= */
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
   STREAMING HELPER
========================= */
function streamText(setter, text, speed = 12) {
  let i = 0;

  const interval = setInterval(() => {
    i++;
    setter(text.slice(0, i));

    if (i >= text.length) clearInterval(interval);
  }, speed);

  return () => clearInterval(interval);
}

/* =========================
   20 UNIQUE WELCOME MESSAGES
========================= */
const WELCOME_MESSAGES = [
  "Ask me anything and I’ll break it down step by step.",
  "What are we building today?",
  "I can help you code, design, or think faster.",
  "Drop a problem — I’ll solve it with you.",
  "Need ideas? I’ve got plenty.",
  "Let’s turn your thoughts into code.",
  "Ask me to explain anything simply.",
  "I’m here to help you build smarter.",
  "What challenge are we solving today?",
  "I can debug, design, and optimize your ideas.",
  "Let’s create something powerful.",
  "What do you want to understand better?",
  "Ask me anything technical or creative.",
  "I’ll guide you step by step.",
  "No limits — just ask.",
  "Let’s build something interesting.",
  "Tell me your idea — I’ll shape it.",
  "I can simplify complex topics instantly.",
  "Ready when you are.",
  "Let’s ship something amazing today."
];

export default function ReuNexus({
  user,
  activeChat,
  setActiveChat,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [chatKey, setChatKey] = useState(0); // 🔥 controls welcome reset

  const abortRef = useRef(null);
  const bottomRef = useRef(null);

  /* AUTO SCROLL */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages]);

  /* RESET WELCOME ON CHAT SWITCH */
  useEffect(() => {
    setMessages([]);
    setChatKey((p) => p + 1);
  }, [activeChat]);

  /* LOAD HISTORY */
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
        (data || []).map((m) =>
          createMessage(m.role, m.content, { db: true })
        )
      );
    };

    load();
  }, [activeChat]);

  /* CREATE CHAT */
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

  return data.id;
};

/* SEND MESSAGE */
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
    let isNewChat = false;

    if (!chatId) {
      chatId = await createChat();
      setActiveChat(chatId);
      isNewChat = true;
    }

    const userMsg = createMessage("user", text);

    const assistantId = crypto.randomUUID();

    const assistantMsg = {
      id: assistantId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
    };

    setMessages((prev) => [
      ...prev,
      userMsg,
      assistantMsg,
    ]);

    /* AUTO TITLE GENERATION (ONLY FIRST MESSAGE) */
  const { data: chatSession, error: sessionError } = await supabase
  .from("chat_sessions")
  .select("title")
  .eq("id", chatId)
  .single();

if (sessionError) {
  console.error(sessionError);
}

if (chatSession?.title === "New Chat") {
  const title =
    text.length > 50
      ? text.slice(0, 50) + "..."
      : text;

  const { error } = await supabase
    .from("chat_sessions")
    .update({ title })
    .eq("id", chatId);

  if (error) console.error(error);
}

    const session = await supabase.auth.getSession();
    const token = session?.data?.session?.access_token;

    const res = await fetch(API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token
          ? { Authorization: `Bearer ${token}` }
          : {}),
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

    /* STREAM RESPONSE */
    streamText((val) => {
      setMessages((prev) => {
        const copy = [...prev];
        const idx = copy.findIndex(
          (m) => m.id === assistantId
        );

        if (idx !== -1) {
          copy[idx] = {
            ...copy[idx],
            content: val,
          };
        }

        return copy;
      });
    }, responseText);

    /* SAVE */
    setTimeout(async () => {
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
    }, responseText.length * 12 + 300);
  } catch (err) {
    setError(err.message);

    setMessages((prev) => [
      ...prev,
      createMessage(
        "assistant",
        "⚠️ " + err.message
      ),
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

 /* WELCOME */
const welcome = useMemo(() => {
  return WELCOME_MESSAGES[
    Math.floor(Math.random() * WELCOME_MESSAGES.length)
  ];
}, [chatKey]);

const showWelcome = messages.length === 0;

return (
  <div className="flex flex-col h-screen bg-zinc-950 text-white overflow-hidden">

{/* HEADER */}
<div className="p-3 border-b border-zinc-800 flex justify-between shrink-0">
  <div className="font-bold">REUNEXUS</div>
  )
</div>
   
    {/* CHAT AREA */}
    <div className="flex-1 min-h-0 overflow-y-auto p-4 flex flex-col">
     
      {/* WELCOME SCREEN */}
      {showWelcome && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="max-w-md">
            <h2 className="text-xl font-bold mb-3">
              Hey {user?.email?.split("@")[0] || "there"} 👋
            </h2>

            <p className="text-zinc-400">
              {welcome}
            </p>
          </div>
        </div>
      )}

      {/* MESSAGES */}
      <div className="space-y-3">
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
                code({ inline, className, children }) {
                  return !inline ? (
                    <CodeBlock className={className}>
                      {children}
                    </CodeBlock>
                  ) : (
                    <code className="bg-zinc-800 px-1 rounded text-sm">
                      {children}
                    </code>
                  );
                },
              }}
            >
              {m.content}
            </ReactMarkdown>
          </div>
        ))}
      </div>

      <div ref={bottomRef} />
    </div>

    {/* ERROR */}
    {error && (
      <div className="px-3 text-red-400 text-sm">
        {error}
      </div>
    )}

    {/* INPUT */}
    <div className="p-3 border-t border-zinc-800 flex gap-2 items-center">
      <input
        className="flex-1 p-2 bg-zinc-900 rounded outline-none"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) =>
          e.key === "Enter" && sendMessage()
        }
        placeholder="Ask anything..."
      />

      {loading && (
        <button
          onClick={stop}
          className="text-red-400 text-sm px-3"
        >
          Stop
        </button>
      )}

      <button
        onClick={sendMessage}
        className="px-4 py-2 bg-zinc-800 rounded"
        disabled={loading}
      >
        {loading ? "..." : "Send"}
      </button>
    </div>
  </div>
);
}
