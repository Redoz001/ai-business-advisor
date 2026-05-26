import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { getAIStream } from "../services/aiService.js";

export default function ReubenAI({
  user,
  activeChat,
  onNewSessionCreated,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const endRef = useRef(null);

  // =========================
  // AUTO SCROLL
  // =========================
  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [messages, loading]);

  // =========================
  // LOAD CHAT HISTORY
  // =========================
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

  // =========================
  // SEND MESSAGE
  // =========================
  const sendMessage = async () => {
    if (!user) {
      alert("Please log in first.");
      return;
    }

    if (!input.trim() || loading) return;

    const text = input.trim();

    setInput("");
    setLoading(true);

    let sessionId = activeChat;

    try {
      // =========================
      // CREATE SESSION
      // =========================
      if (!sessionId) {
        const { data, error } = await supabase
          .from("chat_sessions")
          .insert([
            {
              user_id: user.id,
              title: text.slice(0, 30),
            },
          ])
          .select()
          .single();

        if (error) throw error;

        sessionId = data.id;

        if (typeof onNewSessionCreated === "function") {
          onNewSessionCreated(sessionId);
        }
      }

      // =========================
      // USER MESSAGE UI
      // =========================
      const userMessage = {
        session_id: sessionId,
        user_id: user.id,
        is_user: true,
        content: text,
      };

      setMessages((prev) => [...prev, userMessage]);

      // =========================
      // ASSISTANT PLACEHOLDER
      // =========================
      setMessages((prev) => [
        ...prev,
        {
          is_user: false,
          content: "",
        },
      ]);

      // =========================
      // AI STREAM
      // =========================
      const stream = await getAIStream({
        message: text,
        userId: user.id,
        chatId: sessionId,
      });

      let finalText = "";

      for await (const chunk of stream) {
        finalText += chunk;

        setMessages((prev) => {
          const copy = [...prev];

          copy[copy.length - 1] = {
            is_user: false,
            content: finalText,
          };

          return copy;
        });
      }

      // fallback protection
      if (!finalText.trim()) {
        finalText = "No response generated.";
      }

      // =========================
      // SAVE TO DATABASE
      // =========================
      const { error } = await supabase.from("messages").insert([
        {
          session_id: sessionId,
          user_id: user.id,
          is_user: true,
          content: text,
        },
        {
          session_id: sessionId,
          user_id: user.id,
          is_user: false,
          content: finalText,
        },
      ]);

      if (error) {
        console.error("Save messages error:", error);
      }
    } catch (err) {
      console.error("Send message error:", err);

      alert(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* MESSAGES */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] p-3 rounded-xl ${
              m.is_user
                ? "bg-[#00ffcc] text-black ml-auto"
                : "bg-zinc-900 text-white"
            }`}
          >
            {m.content}
          </div>
        ))}

        {loading && (
          <div className="text-zinc-400">
            ReubenAI is thinking...
          </div>
        )}

        <div ref={endRef} />
      </div>

      {/* INPUT */}
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
          disabled={loading}
          className="flex-1 bg-zinc-900 p-3 rounded-xl resize-none"
          placeholder={
            loading
              ? "ReubenAI is thinking..."
              : "Message ReubenAI..."
          }
        />

        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-[#00ffcc] text-black px-4 rounded-xl font-bold disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}