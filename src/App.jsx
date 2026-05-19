import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js";
import Auth from "./src/Auth";
import Chat from "./src/Chat.jsx";

export default function App() {
  const [user, setUser] = useState(null);
  const [activeChat, setActiveChat] = useState(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });
  }, []);

  if (!user) return <Auth setUser={setUser} />;

  return (
    <Chat user={user} activeChat={activeChat} />
  );
}