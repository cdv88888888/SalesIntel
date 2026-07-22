'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, X, Maximize2, Minimize2, Send, Download } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { useChat } from '../context/ChatContext';

const TableWithCSV = ({ children }) => {
  const handleDownload = (e) => {
    const table = e.currentTarget.parentElement.querySelector('table');
    if (!table) return;
    let csv = [];
    const rows = table.querySelectorAll('tr');
    for (let i = 0; i < rows.length; i++) {
      let row = [], cols = rows[i].querySelectorAll('td, th');
      for (let j = 0; j < cols.length; j++) 
        row.push('"' + (cols[j].textContent || '').replace(/"/g, '""') + '"');
      csv.push(row.join(','));
    }
    const csvFile = new Blob([csv.join('\\n')], {type: 'text/csv'});
    const downloadLink = document.createElement('a');
    downloadLink.download = 'sales_intelligence_data.csv';
    downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = 'none';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    downloadLink.remove();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start', margin: '16px 0', width: '100%' }}>
      <div style={{ width: '100%', overflowX: 'auto', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
      </div>
      <button 
        onClick={handleDownload} 
        style={{ 
          background: 'var(--primary-accent)', 
          color: 'white', 
          padding: '6px 12px', 
          borderRadius: '6px', 
          border: 'none', 
          cursor: 'pointer', 
          fontSize: '0.8rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '6px',
          transition: 'opacity 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.opacity = 0.8}
        onMouseOut={e => e.currentTarget.style.opacity = 1}
      >
        <Download size={14} />
        Download CSV
      </button>
    </div>
  );
};

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
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.8), rgba(30, 64, 175, 0.8))',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          transition: 'transform 0.2s ease, box-shadow 0.2s ease'
        }}
        onMouseOver={e => e.currentTarget.style.transform = 'scale(1.05)'}
        onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        <Bot size={32} color="white" />
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
        borderRadius: '16px',
        overflow: 'hidden',
        boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px',
        borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        background: 'rgba(0, 0, 0, 0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', 
            padding: '6px', 
            borderRadius: '8px' 
          }}>
            <Bot size={20} color="white" />
          </div>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'white' }}>Gemini Intelligence</h3>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            onClick={handleExpand}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
            title="Full Screen"
          >
            <Maximize2 size={18} />
          </button>
          <button 
            onClick={() => setIsOpen(false)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.6)' }}
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
                borderRadius: '12px',
                background: msg.role === 'user' ? 'var(--primary-accent)' : 'rgba(255, 255, 255, 0.05)',
                color: 'white',
                border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.1)',
                borderBottomRightRadius: msg.role === 'user' ? '4px' : '12px',
                borderBottomLeftRadius: msg.role === 'model' ? '4px' : '12px',
                fontSize: '0.95rem',
                lineHeight: '1.5'
              }}
            >
              <ReactMarkdown 
                remarkPlugins={[remarkGfm]}
                components={{
                  table: ({node, ...props}) => <TableWithCSV {...props} />
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
              borderRadius: '12px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
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
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.2)',
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
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '24px',
            padding: '12px 16px',
            color: 'white',
            outline: 'none',
            fontSize: '0.95rem'
          }}
        />
        <button 
          type="submit"
          disabled={isLoading || !input.trim()}
          style={{
            background: 'var(--primary-accent)',
            border: 'none',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: (isLoading || !input.trim()) ? 'not-allowed' : 'pointer',
            opacity: (isLoading || !input.trim()) ? 0.5 : 1,
            color: 'white'
          }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}
