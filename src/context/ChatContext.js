'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const ChatContext = createContext();

const INITIAL_GREETING = { 
  role: 'model', 
  content: "Hi! I'm your CDV-sales-intelligence AI. Ask me anything about your accounts, sales trends, or missed orders!" 
};

export function ChatProvider({ children }) {
  const [sessions, setSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Helper to generate unique session IDs
  const generateId = () => 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);

  // Helper to create a clean session object
  const createSessionObject = (id, title = 'New Chat', messages = [INITIAL_GREETING]) => ({
    id: id || generateId(),
    title: title,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: messages
  });

  // Load sessions from localStorage on mount
  useEffect(() => {
    try {
      const savedSessions = localStorage.getItem('gemini_chat_sessions_v2');
      const savedActiveId = localStorage.getItem('gemini_active_session_id');

      if (savedSessions) {
        const parsed = JSON.parse(savedSessions);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed);
          const activeExists = parsed.some(s => s.id === savedActiveId);
          setCurrentSessionId(activeExists ? savedActiveId : parsed[0].id);
        } else {
          const newSession = createSessionObject();
          setSessions([newSession]);
          setCurrentSessionId(newSession.id);
        }
      } else {
        // Migration check for legacy gemini_chat_history
        const legacyHistory = localStorage.getItem('gemini_chat_history');
        let initialMessages = [INITIAL_GREETING];
        if (legacyHistory) {
          try {
            const parsedLegacy = JSON.parse(legacyHistory);
            if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
              initialMessages = parsedLegacy;
            }
          } catch (e) {}
        }
        const newSession = createSessionObject(null, 'Recent Chat', initialMessages);
        setSessions([newSession]);
        setCurrentSessionId(newSession.id);
      }
    } catch (e) {
      console.error('Failed to load chat sessions:', e);
      const fallbackSession = createSessionObject();
      setSessions([fallbackSession]);
      setCurrentSessionId(fallbackSession.id);
    }
    setIsInitialized(true);
  }, []);

  // Save sessions to localStorage whenever sessions or active ID change
  useEffect(() => {
    if (isInitialized && sessions.length > 0) {
      localStorage.setItem('gemini_chat_sessions_v2', JSON.stringify(sessions));
      if (currentSessionId) {
        localStorage.setItem('gemini_active_session_id', currentSessionId);
      }
    }
  }, [sessions, currentSessionId, isInitialized]);

  // Active session object and active messages
  const activeSession = sessions.find(s => s.id === currentSessionId) || sessions[0];
  const messages = activeSession ? activeSession.messages : [INITIAL_GREETING];

  const createNewChat = () => {
    const newSession = createSessionObject(null, 'New Chat', [INITIAL_GREETING]);
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    setInput('');
    return newSession.id;
  };

  const selectSession = (id) => {
    if (sessions.some(s => s.id === id)) {
      setCurrentSessionId(id);
      setInput('');
    }
  };

  const deleteSession = (id) => {
    setSessions(prev => {
      const filtered = prev.filter(s => s.id !== id);
      if (filtered.length === 0) {
        const freshSession = createSessionObject();
        setCurrentSessionId(freshSession.id);
        return [freshSession];
      }
      if (currentSessionId === id) {
        setCurrentSessionId(filtered[0].id);
      }
      return filtered;
    });
  };

  const clearChat = () => {
    if (!currentSessionId) return;
    setSessions(prev => prev.map(s => {
      if (s.id === currentSessionId) {
        return {
          ...s,
          title: 'New Chat',
          updatedAt: Date.now(),
          messages: [INITIAL_GREETING]
        };
      }
      return s;
    }));
  };

  const clearAllSessions = () => {
    const freshSession = createSessionObject();
    setSessions([freshSession]);
    setCurrentSessionId(freshSession.id);
    setInput('');
    localStorage.removeItem('gemini_chat_sessions_v2');
    localStorage.removeItem('gemini_active_session_id');
  };

  const sendMessage = async (userMsg) => {
    if (!userMsg.trim() || isLoading) return;

    let targetSessionId = currentSessionId;
    let currentMsgs = messages;

    // If no active session, create one
    if (!targetSessionId || !sessions.some(s => s.id === targetSessionId)) {
      targetSessionId = createNewChat();
      currentMsgs = [INITIAL_GREETING];
    }

    const userMessageObj = { role: 'user', content: userMsg };
    const updatedMessages = [...currentMsgs, userMessageObj];

    // Determine auto-generated title if this is the first user prompt in the session
    const isFirstUserMsg = !currentMsgs.some(m => m.role === 'user');
    const autoTitle = isFirstUserMsg 
      ? (userMsg.trim().length > 28 ? userMsg.trim().substring(0, 28) + '...' : userMsg.trim())
      : null;

    // Optimistically update session state with user message
    setSessions(prev => prev.map(s => {
      if (s.id === targetSessionId) {
        return {
          ...s,
          title: autoTitle || s.title,
          updatedAt: Date.now(),
          messages: updatedMessages
        };
      }
      return s;
    }));

    setIsLoading(true);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: updatedMessages.slice(0, -1) // Send all previous messages
        })
      });

      const data = await res.json();
      const replyContent = res.ok 
        ? (data.text || 'No response text content returned.') 
        : `**Error:** ${data.error || 'Something went wrong.'}`;

      const finalMessages = [...updatedMessages, { role: 'model', content: replyContent }];

      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId) {
          return {
            ...s,
            updatedAt: Date.now(),
            messages: finalMessages
          };
        }
        return s;
      }));
    } catch (err) {
      console.error(err);
      const errorMessages = [...updatedMessages, { role: 'model', content: '**Error:** Failed to connect to AI server.' }];
      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId) {
          return {
            ...s,
            updatedAt: Date.now(),
            messages: errorMessages
          };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChatContext.Provider value={{
      sessions,
      currentSessionId,
      messages,
      isLoading,
      input,
      setInput,
      sendMessage,
      createNewChat,
      selectSession,
      deleteSession,
      clearChat,
      clearAllSessions,
      isInitialized
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
