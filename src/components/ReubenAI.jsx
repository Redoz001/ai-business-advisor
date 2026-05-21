import React, { useState } from 'react';
import { askReuben } from '../services/aiService';

export default function ReubenAI({ session }) {

  const [messages, setMessages] = useState([
    { role: 'ai', content: 'System online. Ready.' }
  ]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const send = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = { role: 'user', content: input };

    const updated = [...messages, userMsg];

    setMessages(updated);
    setInput('');
    setLoading(true);

    try {
      const reply = await askReuben(
        input,
        session?.user?.id,
        updated
      );

      setMessages(prev => [
        ...prev,
        { role: 'ai', content: reply }
      ]);

    } catch (err) {
      setMessages(prev => [
        ...prev,
        { role: 'ai', content: 'Connection error.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.wrap}>

      <div style={styles.header}>
        <h2>Reuben AI Chat</h2>
        <p>{session?.user?.email}</p>
      </div>

      <div style={styles.chat}>
        {messages.map((m, i) => (
          <div key={i} style={styles.msg(m.role)}>
            <b>{m.role}:</b> {m.content}
          </div>
        ))}

        {loading && <p>Thinking...</p>}
      </div>

      <form onSubmit={send} style={styles.inputBox}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything..."
          style={styles.input}
        />

        <button style={styles.btn}>
          SEND
        </button>
      </form>

    </div>
  );
}

const styles = {
  wrap: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    background: '#000',
    border: '1px solid #222',
    borderRadius: 12
  },

  header: {
    padding: 20,
    borderBottom: '1px solid #222'
  },

  chat: {
    flex: 1,
    padding: 20,
    overflowY: 'auto'
  },

  msg: (role) => ({
    padding: 10,
    marginBottom: 10,
    borderRadius: 8,
    background: role === 'user' ? '#111' : '#001a16'
  }),

  inputBox: {
    display: 'flex',
    gap: 10,
    padding: 15,
    borderTop: '1px solid #222'
  },

  input: {
    flex: 1,
    padding: 12,
    background: '#111',
    border: '1px solid #333',
    color: '#fff',
    borderRadius: 8
  },

  btn: {
    padding: 12,
    background: '#fff',
    color: '#000',
    borderRadius: 8,
    border: 'none'
  }
};