import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

export default function ReubenAI({ user, activeChat, setActiveChat }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // LOAD CHAT
  useEffect(() => {
    if (!activeChat) return;

    const load = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", activeChat)
        .order("created_at", { ascending: true });

      if (!error) setMessages(data || []);
    };

    load();
  }, [activeChat]);

  // ================= SEND MESSAGE (FIXED) =================
  const sendMessage = async () => {
    console.log("SEND CLICKED");

    if (!input.trim()) return;
    if (!user) return;

    setLoading(true);

    try {
      let chatId = activeChat;

      // 🔥 AUTO CREATE CHAT IF NONE EXISTS
      if (!chatId) {
        const { data, error } = await supabase
          .from("chat_sessions")
          .insert([
            {
              user_id: user.id,
              title: "New Chat",
            },
          ])
          .select()
          .single();

        if (error) throw error;

        chatId = data.id;

        // IMPORTANT: sync state
        if (setActiveChat) setActiveChat(chatId);
      }

      const text = input;
      setInput("");

      // UI update immediately
      setMessages((prev) => [
        ...prev,
        { role: "user", content: text },
        { role: "assistant", content: "Thinking..." },
      ]);

      // get auth session safely
      const session = await supabase.auth.getSession();

      const token = session?.data?.session?.access_token;

      if (!token) {
        throw new Error("User not logged in");
      }

      // CALL EDGE FUNCTION
      const res = await fetch(
        "https://whvzdutfyydshamwfhvu.supabase.co/functions/v1/reuben-ai",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: text,
            chatId,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();

      const reply = data?.reply || "No response";

      // replace "Thinking..."
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: reply,
        };
        return copy;
      });

      // save assistant message
      await supabase.from("chat_messages").insert([
        {
          session_id: chatId,
          user_id: user.id,
          role: "assistant",
          content: reply,
        },
      ]);
    } catch (err) {
      console.error(err);

      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Error: " + err.message,
        };
        return copy;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-black text-white">

      {/* CHAT AREA */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.map((m, i) => (
          <div
            key={i}
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

      {/* INPUT */}
      <div className="p-3 flex gap-2 border-t border-zinc-800">

        <textarea
          className="flex-1 bg-zinc-900 p-3 rounded-xl outline-none resize-none"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
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