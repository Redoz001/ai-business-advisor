import { useEffect } from "react";
import { supabase } from "./lib/supabase.js";

export default function Callback() {
  useEffect(() => {
    const run = async () => {
      try {
        // 🔥 THIS IS REQUIRED (finalizes OAuth session)
        const { error } = await supabase.auth.exchangeCodeForSession(
          window.location.href
        );

        if (error) {
          console.error("Auth error:", error);
          window.location.replace("/auth");
          return;
        }

        // wait a tiny bit so session is written to storage
        setTimeout(() => {
          window.location.replace("/");
        }, 300);
      } catch (err) {
        console.error(err);
        window.location.replace("/auth");
      }
    };

    run();
  }, []);

  return (
    <div className="h-screen flex items-center justify-center bg-black text-white">
      Signing you in...
    </div>
  );
}