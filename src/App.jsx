import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase.js"; // Tailored path assuming supabase.js is inside src/lib/
import Auth from "./Auth.jsx";               // Looks directly inside the src folder
import Chat from "./Chat.jsx";               // Looks directly inside the src folder

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