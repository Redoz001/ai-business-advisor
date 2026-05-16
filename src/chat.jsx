export default function Chat({ user, activeChat }) {
  return (
    <div style={styles.chatWrapper}>
      {/* your Step 9 Chat UI goes inside here */}
      <ChatCore user={user} activeChat={activeChat} />
    </div>
  );
}

const styles = {
  chatWrapper: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#0f0f0f",
  },
};