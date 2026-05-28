import React, { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";

export default function ReubenAI({ user, activeChat }) {
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
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", activeChat)
        .order("created_at", { ascending: true });

      setMessages(data || []);
    };

    load();
  }, [activeChat]);

  const sendMessage = async () => {
    if (!input.trim() || loading || !activeChat) return;

    const text = input;
    setInput("");
    setLoading(true);

    // show instantly
    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "Thinking..." },
    ]);

    try {
      const session = await supabase.auth.getSession();

      if (!session?.data?.session?.access_token) {
        throw new Error("Not logged in");
      }

      const res = await fetch(
        "https://whvzdutfyydshamwfhvu.supabase.co/functions/v1/reuben-ai",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.data.session.access_token}`,
          },
          body: JSON.stringify({
            message: text,
            chatId: activeChat,
          }),
        }
      );

      if (!res.ok) {
        throw new Error(await res.text());
      }

      const data = await res.json();

      const reply = data.reply;

      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: reply,
        };
        return copy;
      });

      // save assistant
      await supabase.from("chat_messages").insert([
        {
          session_id: activeChat,
          user_id: user.id,
          role: "assistant",
          content: reply,
        },
      ]);
    } catch (err) {
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