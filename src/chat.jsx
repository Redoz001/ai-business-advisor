import React, { useEffect } from "react";
import ChatCore from "./ReubenAI.jsx";

export default function Chat({
  user,
  activeChat,
  setActiveChat,
}) {

  // =========================
  // RESET CHAT STATE ON SWITCH
  // (important for streaming stability)
  // =========================
  useEffect(() => {

    return () => {
      // cleanup hook for future:
      // stop streaming, voice, listeners
    };

  }, [activeChat]);

  // =========================
  // NOT LOGGED IN
  // =========================
  if (!user) {

    return (
      <div style={styles.center}>
        Please log in to start chatting.
      </div>
    );
  }

  // =========================
  // NO ACTIVE CHAT
  // =========================
  if (!activeChat) {

    return (
      <div style={styles.center}>
        Select or create a conversation.
      </div>
    );
  }

  // =========================
  // CHAT UI
  // =========================
  return (
    <div style={styles.chatWrapper}>

      <ChatCore
        key={activeChat}   // IMPORTANT FIX
        user={user}
        activeChat={activeChat}
        setActiveChat={setActiveChat}
      />

    </div>
  );
}

const styles = {

  chatWrapper: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#0f0f0f",
    overflow: "hidden",
    minWidth: 0,
    height: "100%",
  },

  center: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "#888",
    background: "#0f0f0f",
    fontSize: "14px",
    padding: "20px",
    textAlign: "center",
  },
};