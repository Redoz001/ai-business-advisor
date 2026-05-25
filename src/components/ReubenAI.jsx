import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";
import { getAIResponse } from "../services/aiService.js";

export default function ReubenAI({
  user,
  activeChat,
  onNewSessionCreated,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // =========================
  // LOAD CHAT HISTORY
  // =========================
  useEffect(() => {
    if (!activeChat) {
      setMessages([]);
      return;
    }

    const fetchHistory = async () => {
      try {
        const { data, error } = await supabase
          .from("messages")
          .select("*")
          .eq("session_id", activeChat)
          .order("created_at", { ascending: true });

        if (error) {
          console.error("Fetch history error:", error);
          return;
        }

        setMessages(data || []);
      } catch (err) {
        console.error("History crash:", err);
      }
    };

    fetchHistory();
  }, [activeChat]);

  // =========================
  // SEND MESSAGE
  // =========================
  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage = input.trim();

    setInput("");
    setLoading(true);

    try {
      let sessionId = activeChat;

      // =========================
      // CREATE CHAT SESSION
      // =========================
      if (!sessionId) {
        const { data, error } = await supabase
          .from("chat_sessions")
          .insert([
            {
              user_id: user.id,
              title: userMessage.substring(0, 30),
            },
          ])
          .select()
          .single();

        if (error) {
          console.error("Session creation error:", error);
          throw new Error(error.message);
        }

        sessionId = data.id;

        if (typeof onNewSessionCreated === "function") {
          onNewSessionCreated(sessionId);
        }
      }

      // =========================
      // SHOW USER MESSAGE IN UI
      // =========================
      const newUserMessage = {
        role: "user",
        content: userMessage,
      };

      setMessages((prev) => [...prev, newUserMessage]);

      // =========================
      // SAVE USER MESSAGE
      // =========================
      const { error: userInsertError } = await supabase
        .from("messages")
        .insert([
          {
            session_id: sessionId,
            role: "user",
            content: userMessage,
          },
        ]);

      if (userInsertError) {
        console.error("User message insert error:", userInsertError);
      }

      // =========================
      // GET AI RESPONSE
      // =========================
      const aiData = await getAIResponse({
        message: userMessage,
        userId: user.id,
        chatId: sessionId,
      });

      const aiReply =
        aiData?.reply ||
        aiData?.response ||
        "Sorry, I could not generate a response.";

      // =========================
      // SHOW AI RESPONSE IN UI
      // =========================
      const newAIMessage = {
        role: "assistant",
        content: aiReply,
      };

      setMessages((prev) => [...prev, newAIMessage]);

      // =========================
      // SAVE AI RESPONSE
      // =========================
      const { error: aiInsertError } = await supabase
        .from("messages")
        .insert([
          {
            session_id: sessionId,
            role: "assistant",
            content: aiReply,
          },
        ]);

      if (aiInsertError) {
        console.error("AI message insert error:", aiInsertError);
      }
    } catch (err) {
      console.error("AI ERROR:", err);

      alert(
        "AI failed to respond: " +
          (err?.message || "Unknown error")
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================
  // ENTER KEY SEND
  // =========================
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">
      {/* ========================= */}
      {/* CHAT AREA */}
      {/* ========================= */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-zinc-500 text-center mt-10">
            Start chatting with Reuben AI
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            className={`max-w-[80%] p-4 rounded-2xl whitespace-pre-wrap ${
              m.role === "user"
                ? "bg-[#00ffcc] text-black ml-auto"
                : "bg-zinc-800 text-white"
            }`}
          >
            {m.content}
          </div>
        ))}

        {loading && (
          <div className="bg-zinc-800 text-zinc-300 p-4 rounded-2xl max-w-[80%]">
            Reuben is thinking...
          </div>
        )}
      </div>

      {/* ========================= */}
      {/* INPUT AREA */}
      {/* ========================= */}
      <div className="border-t border-zinc-800 p-4">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder={
              loading
                ? "Reuben is thinking..."
                : "Ask Reuben anything..."
            }
            disabled={loading}
            className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl p-3 resize-none outline-none"
          />

          <button
            onClick={sendMessage}
            disabled={loading}
            className="bg-[#00ffcc] text-black font-bold px-6 rounded-xl disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}