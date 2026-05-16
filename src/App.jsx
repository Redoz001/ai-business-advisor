import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import Chat from "./Chat";

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