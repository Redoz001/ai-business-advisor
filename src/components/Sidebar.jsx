import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabase.js";

export default function Sidebar({ onNewChat, onSelectSession, activeSession }) {
  const [sessions, setSessions] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchChats();
  }, []);

  const fetchChats = async () => {
    const { data, error } = await supabase
      .from("chats")
      .select("id, title, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching chats:", error);
      setError("Failed to load chats");
      return;
    }

    setSessions(data || []);
  };

  return (
    <div className="flex flex-col bg-zinc-950 h-full w-64 border-r border-zinc-800">
      
      <div className="p-4 border-b border-zinc-800">
        <h2 className="font-bold pt-12 text-white">Reuben AI</h2>
      </div>

      <div className="flex flex-col p-4 space-y-4 overflow-y-auto">

        <button
          onClick={onNewChat}
          className="text-left font-bold text-[#00ffcc]"
        >
          + New Chat
        </button>

        {error && (
          <p className="text-red-500 text-xs">{error}</p>
        )}

        <div className="mt-4">
          <h3 className="text-xs text-zinc-500 uppercase">Recent</h3>

          {sessions.map((chat) => (
            <button
              key={chat.id}
              onClick={() => onSelectSession(chat.id)}
              className={`block w-full text-left p-2 rounded hover:bg-zinc-800 truncate ${
                activeSession === chat.id
                  ? "bg-zinc-800 text-[#00ffcc]"
                  : "text-zinc-300"
              }`}
            >
              {chat.title || "New Conversation"}
            </button>
          ))}
        </div>

      </div>
    </div>
  );
}