import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reuben-ai`;

function createMessage(role, content) {
  return {
    id: crypto.randomUUID(),
    role,
    content,
  };
}

const cleanText = (text) => {
  return text
    .replace(/\s+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
};

export default function ReubenAI({ user, activeChat, setActiveChat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [isStreaming, setIsStreaming] = useState(false);

  // ✅ VOICE RECORDER STATE
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef(null);

  const lastPromptRef = useRef("");
  const abortRef = useRef(null);
  const endRef = useRef(null);

  // ✅ prevents zombie stream updates after STOP
  const streamActiveRef = useRef(false);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!activeChat) return;

    (async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", activeChat)
        .order("created_at", { ascending: true });

      setMessages(
        (data || []).map((m) => ({
          id: crypto.randomUUID(),
          role: m.role,
          content: m.content,
        }))
      );
    })();
  }, [activeChat]);

  const createChat = async () => {
    const { data } = await supabase
      .from("chat_sessions")
      .insert([{ user_id: user?.id, title: "New Chat" }])
      .select()
      .single();

    setActiveChat(data.id);
    return data.id;
  };

  const streamResponse = async (res, onToken) => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      if (!streamActiveRef.current) break; // ✅ STOP SAFETY

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed.startsWith("data:")) {
          const data = trimmed.replace("data: ", "");

          if (data === "[DONE]") return;

          try {
            const json = JSON.parse(data);
            const token = json?.choices?.[0]?.delta?.content;
            if (token && streamActiveRef.current) onToken(token);
          } catch {
            if (streamActiveRef.current) onToken(data);
          }
        }
      }
    }
  };

  const sendMessage = async (overrideText = null) => {
    if ((!input.trim() && !overrideText) || loading) return;

    const text = overrideText ?? input;

    setInput("");
    setLoading(true);
    setIsStreaming(true);
    streamActiveRef.current = true;

    lastPromptRef.current = text;

    const chatId = activeChat || (await createChat());

    const assistantId = crypto.randomUUID();

    setMessages((prev) => [
      ...prev,
      createMessage("user", text),
      { id: assistantId, role: "assistant", content: "" },
    ]);

    await supabase.from("chat_messages").insert([
      {
        session_id: chatId,
        user_id: user?.id,
        role: "user",
        content: text,
      },
    ]);

    try {
      abortRef.current = new AbortController();

      const res = await fetch(API_URL, {
        method: "POST",
        signal: abortRef.current.signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          chatId,
          userId: user?.id ?? null,
        }),
      });

      let full = "";

      await streamResponse(res, (token) => {
        full += token;

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: cleanText(full) }
              : m
          )
        );
      });

      await supabase.from("chat_messages").insert([
        {
          session_id: chatId,
          user_id: user?.id,
          role: "assistant",
          content: cleanText(full),
        },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setIsStreaming(false);
      streamActiveRef.current = false;
    }
  };

  // ✅ STOP (FIXED)
  const stopGenerating = () => {
    streamActiveRef.current = false;
    abortRef.current?.abort();
    setLoading(false);
    setIsStreaming(false);
  };

  // ✅ REGENERATE (FIXED)
  const regenerate = () => {
    if (loading || !lastPromptRef.current) return;
    sendMessage(lastPromptRef.current);
  };

  // ✅ VOICE RECORDER (WEB SPEECH API)
  const toggleVoice = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice recognition not supported in this browser");
      return;
    }

    if (!recognitionRef.current) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = "en-US";

      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => prev + " " + transcript);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      recognitionRef.current.start();
      setIsRecording(true);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">

      {/* HEADER */}
      <div className="p-3 border-b border-zinc-800 flex justify-between">
        <div className="font-bold">ReubenAI</div>

        <div className="flex gap-3">
          <button onClick={regenerate} className="text-blue-400 text-sm">
            Regenerate
          </button>
        </div>
      </div>

      {/* CHAT */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`p-3 rounded-xl max-w-[80%] ${
              m.role === "user"
                ? "bg-emerald-400 text-black ml-auto"
                : "bg-zinc-900"
            }`}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {m.content}
            </ReactMarkdown>
          </div>
        ))}
        <div ref={endRef} />
      </div>

      {/* INPUT AREA */}
      <div className="p-3 border-t border-zinc-800 flex gap-2 items-center">

        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="flex-1 bg-zinc-900 p-3 rounded-xl"
          placeholder="Ask ReubenAI..."
        />

        {/* 🎤 VOICE BUTTON */}
        <button
          onClick={toggleVoice}
          className={`px-3 py-2 rounded-xl border transition ${
            isRecording
              ? "bg-red-500 text-white"
              : "bg-zinc-800 text-white"
          }`}
        >
          🎤
        </button>

        {/* ⛔ STOP */}
        {isStreaming && (
          <button
            onClick={stopGenerating}
            className="px-3 py-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500"
          >
            ⛔
          </button>
        )}

        {/* SEND */}
        <button
          onClick={() => sendMessage()}
          className="bg-emerald-400 text-black px-4 py-2 rounded-xl font-bold"
        >
          Send
        </button>
      </div>
    </div>
  );
}