'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, X, Maximize2, Minimize2, Send, Download } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useChat } from '../context/ChatContext';
import SortableMarkdownTable from './SortableMarkdownTable';

export default function GeminiChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const pathname = usePathname();
  const router = useRouter();

  const { messages, isLoading, input, setInput, sendMessage, clearChat } = useChat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isLoading, isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [isOpen]);

  // Hide the floating widget entirely if we are on the full-screen gemini-ai page or the public about page
  if (pathname === '/gemini-ai' || pathname === '/about') {
    return null;
  }

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleExpand = () => {
    setIsOpen(false);
    router.push('/gemini-ai');
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="glass-panel"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
          borderRadius: '50%',
          width: '60px',
          height: '60px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: 'var(--blue)',
          border: 0,
          boxShadow: '0 24px 60px rgba(0,0,0,.35)',
          transition: 'transform 0.3s cubic-bezier(.2,.8,.2,1)'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Bot size={28} color="#fff" />
      </button>
    );
  }

  return (
    <div 
      className="glass-panel"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        width: '400px',
        height: '550px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 'var(--r-group)',
        overflow: 'hidden',
        boxShadow: '0 24px 60px rgba(0,0,0,.35)',
        border: 0,
        background: 'var(--surface)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        borderBottom: '1px solid var(--line)',
        background: 'transparent'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
 background: 'var(--blue)', 
            padding: '6px', 
            borderRadius: '50%' 
          }}>
            <Bot size={20} color="#fff" />
          </div>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 600, letterSpacing: '-.01em', color: 'var(--text)' }}>Claude Intelligence</h3>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button 
            onClick={handleExpand}
            style={{ background: 'var(--trk)', border: 0, cursor: 'pointer', color: 'var(--text)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Full Screen"
          >
            <Maximize2 size={18} />
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            style={{ background: 'var(--trk)', border: 0, cursor: 'pointer', color: 'var(--text)', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Chat Area */}
      <div 
        className="gemini-chat-scroll"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        {messages.map((msg, i) => (
          <div 
            key={i} 
            style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            <div 
              className="chat-bubble markdown-body"
              style={{
                maxWidth: '85%',
                padding: '12px 16px',
                borderRadius: 'var(--r-card)',
                background: msg.role === 'user' ? 'var(--blue)' : 'var(--s2)',
                color: msg.role === 'user' ? '#fff' : 'var(--text)',
                border: 0,
                borderBottomRightRadius: msg.role === 'user' ? '4px' : 'var(--r-card)',
                borderBottomLeftRadius: msg.role === 'model' ? '4px' : 'var(--r-card)',
                fontSize: '15px',
                lineHeight: '22px'
              }}
            >
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({node, ...props}) => <SortableMarkdownTable {...props} />
                }}
              >
                {msg.content}
              </ReactMarkdown>
            </div>
          </div>
        ))}
        
        {isLoading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--r-card)',
              background: 'var(--s2)',
              border: 0,
              display: 'flex',
              gap: '6px',
              alignItems: 'center'
            }}>
              <span className="dot-pulse"></span>
              <span className="dot-pulse" style={{ animationDelay: '0.2s' }}></span>
              <span className="dot-pulse" style={{ animationDelay: '0.4s' }}></span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form 
        onSubmit={handleSubmit}
        style={{
          padding: '16px',
          borderTop: '1px solid var(--line)',
          background: 'transparent',
          display: 'flex',
          gap: '12px'
        }}
      >
        <input 
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about declining sales, orders..."
          disabled={isLoading}
          style={{
            flex: 1,
            background: 'var(--s2)',
            border: 0,
            borderRadius: '999px',
            minHeight: '44px',
            padding: '0 16px',
            color: 'var(--text)',
            outline: 'none',
            fontSize: '15px'
          }}
        />
        <button 
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            background: 'var(--blue)',
            border: 0,
            borderRadius: '999px',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer',
            opacity: (isLoading || !input.trim()) ? 0.4 : 1,
            color: '#fff'
          }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
