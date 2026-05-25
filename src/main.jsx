import React, { useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";
import Sidebar from "./Sidebar.jsx";
import ReubenAI from "./ReubenAI.jsx";

export default function App({ user }) {
  const [sessions, setSessions] = useState([]);
  const [activeChat, setActiveChat] = useState(null);

  // LOAD SESSIONS
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("chat_sessions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setSessions(data || []);
    };

    load();
  }, [user]);

  // CREATE CHAT
  const createNewChat = async () => {
    const { data } = await supabase
      .from("chat_sessions")
      .insert([
        {
          user_id: user.id,
          title: "New Chat",
        },
      ])
      .select()
      .single();

    setSessions((p) => [data, ...p]);
    setActiveChat(data.id);
  };

  return (
    <div className="flex h-screen bg-black">

      <Sidebar
        sessions={sessions}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
        createNewChat={createNewChat}
      />

      <div className="flex-1">
        <ReubenAI
          user={user}
          activeChat={activeChat}
          onNewSessionCreated={(id) => {
            setActiveChat(id);
          }}
        />
      </div>
    </div>
  );
}