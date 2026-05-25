import React, { useState } from "react";
import { supabase } from "./lib/supabase.js";

export default function Auth({ setUser }) {

  // =========================
  // STATE
  // =========================
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  // =========================
  // SIGN UP
  // =========================
  async function signUp() {

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(
        "Account created successfully. Check your email verification."
      );

      if (data?.user) {
        setUser(data.user);
      }

    } catch (err) {

      console.error(err);

      setErrorMessage(
        "Unable to create account."
      );

    } finally {
      setLoading(false);
    }
  }

  // =========================
  // SIGN IN
  // =========================
  async function signIn() {

    setLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setSuccessMessage(
        "Authentication successful."
      );

      if (data?.user) {
        setUser(data.user);
      }

    } catch (err) {

      console.error(err);

      setErrorMessage(
        "Login failed."
      );

    } finally {
      setLoading(false);
    }
  }

  // =========================
  // UI
  // =========================
  return (

    <div
      className="
        min-h-screen
        bg-black
        text-white
        flex
        items-center
        justify-center
        p-6
      "
    >

      {/* MAIN CARD */}
      <div
        className="
          w-full
          max-w-md
          bg-zinc-950
          border
          border-zinc-800
          rounded-3xl
          p-8
          shadow-2xl
        "
      >

        {/* HEADER */}
        <div className="text-center mb-8">

          <h1
            className="
              text-4xl
              font-bold
              text-[#00ffcc]
              mb-3
            "
          >
            Reuben AI
          </h1>

          <p className="text-zinc-400">
            Secure AI Authentication Portal
          </p>

        </div>

        {/* ERROR */}
        {errorMessage && (

          <div
            className="
              mb-4
              bg-red-500/10
              border
              border-red-500/30
              text-red-400
              p-3
              rounded-xl
              text-sm
            "
          >
            {errorMessage}
          </div>

        )}

        {/* SUCCESS */}
        {successMessage && (

          <div
            className="
              mb-4
              bg-green-500/10
              border
              border-green-500/30
              text-green-400
              p-3
              rounded-xl
              text-sm
            "
          >
            {successMessage}
          </div>

        )}

        {/* EMAIL */}
        <div className="mb-5">

          <label
            className="
              block
              text-sm
              text-zinc-400
              mb-2
            "
          >
            Email Address
          </label>

          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="
              w-full
              bg-zinc-900
              border
              border-zinc-700
              rounded-xl
              px-4
              py-3
              outline-none
              focus:border-[#00ffcc]
              transition
            "
          />

        </div>

        {/* PASSWORD */}
        <div className="mb-6">

          <label
            className="
              block
              text-sm
              text-zinc-400
              mb-2
            "
          >
            Password
          </label>

          <div className="relative">

            <input
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="
                w-full
                bg-zinc-900
                border
                border-zinc-700
                rounded-xl
                px-4
                py-3
                pr-14
                outline-none
                focus:border-[#00ffcc]
                transition
              "
            />

            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="
                absolute
                right-3
                top-1/2
                -translate-y-1/2
                text-zinc-400
                hover:text-white
              "
            >
              {showPassword ? "🙈" : "👁️"}
            </button>

          </div>

        </div>

        {/* BUTTONS */}
        <div className="space-y-3">

          {/* LOGIN */}
          <button
            onClick={signIn}
            disabled={loading}
            className="
              w-full
              bg-[#00ffcc]
              hover:opacity-90
              text-black
              font-bold
              py-3
              rounded-xl
              transition
              disabled:opacity-50
            "
          >
            {loading ? "PROCESSING..." : "LOGIN"}
          </button>

          {/* SIGN UP */}
          <button
            onClick={signUp}
            disabled={loading}
            className="
              w-full
              bg-zinc-900
              border
              border-zinc-700
              hover:bg-zinc-800
              py-3
              rounded-xl
              transition
              disabled:opacity-50
            "
          >
            CREATE ACCOUNT
          </button>

        </div>

        {/* FOOTER */}
        <div
          className="
            mt-8
            pt-6
            border-t
            border-zinc-800
            text-center
            text-xs
            text-zinc-500
          "
        >
          Reuben AI • Secure Authentication System
        </div>

      </div>

    </div>
  );
}