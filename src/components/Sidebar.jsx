import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

export default function Sidebar({ onNewChat, onSelectSession, activeSession }) {
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    const { data } = await supabase
      .from("chat_sessions")
      .select("*")
      .order("created_at", { ascending: false });

    setSessions(data || []);
  }

  return (
    <div className="w-64 bg-zinc-950 border-r border-zinc-800">
      <button onClick={onNewChat}>+ New Chat</button>

      {sessions.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelectSession(s.id)}
          className={activeSession === s.id ? "text-green-400" : ""}
        >
          {s.title}
        </button>
      ))}
    </div>
  );
}