import React from "react";
// Updated import to point to your AI logic component
import ChatCore from "./ReubenAI.jsx"; 

export default function Chat({ user, activeChat, memoryContext }) {

  // =========================
  // SAFETY CHECKS
  // =========================
  if (!user) {
    return (
      <div style={styles.center}>
        Please log in to start chatting.
      </div>
    );
  }

  if (!activeChat) {
    return (
      <div style={styles.center}>
        No active conversation selected.
      </div>
    );
  }

  return (
    <div style={styles.chatWrapper}>

      {/* memoryContext is now passed to your AI engine */}
      <ChatCore
        user={user}
        activeChat={activeChat}
        memoryContext={memoryContext} 
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
  },

  center: {
    flex: 1,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    color: "#888",
    background: "#0f0f0f",
    fontSize: "14px",
  },
};