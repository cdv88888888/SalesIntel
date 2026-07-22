'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const ChatContext = createContext();

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('gemini_chat_history');
      if (saved) {
        setMessages(JSON.parse(saved));
      } else {
        setMessages([
          { role: 'model', content: "Hi! I'm your CDV-sales-intelligence AI. Ask me anything about your accounts, sales trends, or missed orders!" }
        ]);
      }
    } catch (e) {
      console.error('Failed to load chat history', e);
    }
    setIsInitialized(true);
  }, []);

  // Save to localStorage whenever messages change
  useEffect(() => {
    if (isInitialized) {
      localStorage.setItem('gemini_chat_history', JSON.stringify(messages));
    }
  }, [messages, isInitialized]);

  const clearChat = () => {
    const initialMsg = [
      { role: 'model', content: "Hi! I'm your CDV-sales-intelligence AI. Ask me anything about your accounts, sales trends, or missed orders!" }
    ];
    setMessages(initialMsg);
    localStorage.setItem('gemini_chat_history', JSON.stringify(initialMsg));
  };

  const sendMessage = async (userMsg) => {
    if (!userMsg.trim() || isLoading) return;

    const newMessages = [...messages, { role: 'user', content: userMsg }];
    setMessages(newMessages);
    setIsLoading(true);
    setInput('');

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          history: newMessages.slice(0, -1) // Send all previous messages
        })
      });

      const data = await res.json();
      
      if (res.ok) {
        setMessages([...newMessages, { role: 'model', content: data.text }]);
      } else {
        setMessages([...newMessages, { role: 'model', content: `**Error:** ${data.error || 'Something went wrong.'}` }]);
      }
    } catch (err) {
      console.error(err);
      setMessages([...newMessages, { role: 'model', content: '**Error:** Failed to connect to AI server.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ChatContext.Provider value={{
      messages,
      isLoading,
      input,
      setInput,
      sendMessage,
      clearChat,
      isInitialized
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  return useContext(ChatContext);
}
