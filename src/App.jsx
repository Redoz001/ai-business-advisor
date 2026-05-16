import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Chat from "./Chat";

export default function App() {
  const [user] = useState({ id: "demo-user" });
  const [conversations, setConversations] = useState([]);
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    loadChats();
  }, []);

  async function loadChats() {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("created_at", { ascending: false });

    if (data) setConversations(data);
  }

  async function newChat() {
    const { data } = await supabase
      .from("conversations")
      .insert([{ user_id: user.id, title: "New Chat" }])
      .select()
      .single();

    setConversations((prev) => [data, ...prev]);
    setActiveChat(data);
  }

  return (
    <div style={styles.wrapper}>
      {/* SIDEBAR */}
      <div style={styles.sidebar}>
        <button onClick={newChat} style={styles.newBtn}>
          + New Chat
        </button>

        <div style={styles.chatList}>
          {conversations.map((c) => (
            <div
              key={c.id}
              onClick={() => setActiveChat(c)}
              style={{
                ...styles.chatItem,
                background:
                  activeChat?.id === c.id ? "#2a2a2a" : "transparent",
              }}
            >
              {c.title}
            </div>
          ))}
        </div>
      </div>

      {/* MAIN CHAT */}
      <div style={styles.main}>
        {activeChat ? (
          <Chat user={user} activeChat={activeChat} />
        ) : (
          <div style={styles.empty}>
            Select a chat or create a new one
          </div>
        )}
      </div>
    </div>
  );
}

// =========================
// STYLES (CHATGPT STYLE)
// =========================
const styles = {
  wrapper: {
    display: "flex",
    height: "100vh",
    background: "#0f0f0f",
    color: "#fff",
    fontFamily: "Arial",
  },

  sidebar: {
    width: "260px",
    background: "#171717",
    padding: "10px",
    display: "flex",
    flexDirection: "column",
  },

  newBtn: {
    padding: "10px",
    marginBottom: "10px",
    background: "#2a2a2a",
    color: "#fff",
    border: "none",
    cursor: "pointer",
    borderRadius: "8px",
  },

  chatList: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },

  chatItem: {
    padding: "10px",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
  },

  main: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
  },

  empty: {
    margin: "auto",
    color: "#888",
    fontSize: "16px",
  },
};