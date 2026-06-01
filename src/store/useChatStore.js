import { create } from "zustand";

export const useChatStore = create((set) => ({

  // =========================
  // USER
  // =========================
  user: null,
  setUser: (user) =>
    set({ user }),

  // =========================
  // CHAT SESSIONS
  // =========================
  sessions: [],
  setSessions: (sessions) =>
    set({ sessions }),

  // =========================
  // ACTIVE CHAT
  // =========================
  activeChat: null,
  setActiveChat: (activeChat) =>
    set({ activeChat }),

  // =========================
  // MESSAGES
  // =========================
  messages: [],
  setMessages: (messages) =>
    set({ messages }),

  // =========================
  // INPUT
  // =========================
  input: "",
  setInput: (input) =>
    set({ input }),

  // =========================
  // LOADING
  // =========================
  loading: false,
  setLoading: (loading) =>
    set({ loading }),

  // =========================
  // SIDEBAR
  // =========================
  sidebarOpen: true,
  setSidebarOpen: (sidebarOpen) =>
    set({ sidebarOpen }),

  // =========================
  // APP READY
  // =========================
  appReady: false,
  setAppReady: (appReady) =>
    set({ appReady }),

  // =========================
  // RESET CHAT
  // =========================
  resetChat: () =>
    set({
      messages: [],
      input: "",
      loading: false,
    }),

}));