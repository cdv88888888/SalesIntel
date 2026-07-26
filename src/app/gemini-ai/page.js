'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  Bot, 
  Send, 
  Download, 
  Trash2, 
  Plus, 
  MessageSquare, 
  PanelLeftClose, 
  PanelLeft, 
  History,
  Sparkles
} from 'lucide-react';
import { useChat } from '../../context/ChatContext';
import SortableMarkdownTable from '../../components/SortableMarkdownTable';

export default function GeminiAIPage() {
  const messagesEndRef = useRef(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hoveredSessionId, setHoveredSessionId] = useState(null);

  const { 
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
    clearAllSessions 
  } = useChat();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      background: 'var(--background-dark)',
      color: 'var(--text-primary)',
      overflow: 'hidden'
    }}>
      {/* History Sidebar */}
      <div style={{
        width: sidebarOpen ? '280px' : '0px',
        minWidth: sidebarOpen ? '280px' : '0px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        background: 'rgba(15, 23, 42, 0.95)',
        borderRight: sidebarOpen ? '1px solid var(--border-color)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 20
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <History size={20} color="#3b82f6" />
              <span style={{ fontWeight: 700, fontSize: '1.05rem', color: '#f8fafc' }}>Chat History</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Close Sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          <button
            onClick={createNewChat}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 16px',
              fontWeight: 600,
              fontSize: '0.95rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)',
              transition: 'transform 0.15s ease'
            }}
            onMouseOver={e => e.currentTarget.style.transform = 'scale(1.02)'}
            onMouseOut={e => e.currentTarget.style.transform = 'scale(1)'}
          >
            <Plus size={18} />
            New Chat
          </button>
        </div>

        {/* Sessions List */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          {sessions.map(session => {
            const isActive = session.id === currentSessionId;
            const isHovered = session.id === hoveredSessionId;

            return (
              <div
                key={session.id}
                onClick={() => selectSession(session.id)}
                onMouseEnter={() => setHoveredSessionId(session.id)}
                onMouseLeave={() => setHoveredSessionId(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  background: isActive 
                    ? 'rgba(59, 130, 246, 0.15)' 
                    : isHovered 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'transparent',
                  border: isActive ? '1px solid rgba(59, 130, 246, 0.4)' : '1px solid transparent',
                  color: isActive ? '#f8fafc' : '#94a3b8',
                  transition: 'all 0.15s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <MessageSquare size={16} color={isActive ? '#3b82f6' : '#64748b'} style={{ flexShrink: 0 }} />
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: isActive ? 600 : 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {session.title || 'New Chat'}
                  </span>
                </div>

                {(isHovered || isActive) && sessions.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSession(session.id);
                    }}
                    title="Delete Chat"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: '#ef4444',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      opacity: 0.8
                    }}
                    onMouseOver={e => e.currentTarget.style.opacity = 1}
                    onMouseOut={e => e.currentTarget.style.opacity = 0.8}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Sidebar Footer */}
        <div style={{
          padding: '16px',
          borderTop: '1px solid var(--border-color)',
          background: 'rgba(0, 0, 0, 0.2)'
        }}>
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to clear all chat history?")) {
                clearAllSessions();
              }
            }}
            style={{
              width: '100%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              padding: '10px 14px',
              borderRadius: '10px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              fontWeight: 500,
              transition: 'background 0.2s'
            }}
            onMouseOver={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)'}
            onMouseOut={e => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'}
          >
            <Trash2 size={14} />
            Clear All History
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative'
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          background: 'var(--modal-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          zIndex: 10
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                style={{
                  background: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid var(--border-color)',
                  color: 'white',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '0.9rem'
                }}
                title="Open Sidebar"
              >
                <PanelLeft size={18} color="#3b82f6" />
                <span>History</span>
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', 
                padding: '10px', 
                borderRadius: '10px',
                boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
              }}>
                <Bot size={24} color="white" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#f8fafc' }}>Gemini Intelligence</h1>
                <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '0.85rem' }}>AI Sales Assistant</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={createNewChat}
              style={{
                background: 'rgba(59, 130, 246, 0.1)',
                color: '#3b82f6',
                border: '1px solid rgba(59, 130, 246, 0.25)',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.88rem',
                fontWeight: 500
              }}
            >
              <Plus size={16} />
              New Chat
            </button>
          </div>
        </div>

        {/* Chat Scroll Area */}
        <div 
          className="gemini-chat-scroll"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '32px',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
            maxWidth: '1200px',
            margin: '0 auto',
            width: '100%'
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
              <div style={{
                display: 'flex',
                gap: '12px',
                maxWidth: '85%',
                flexDirection: msg.role === 'user' ? 'row-reverse' : 'row'
              }}>
                {/* Avatar */}
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  background: msg.role === 'user' ? 'var(--surface-dark)' : 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  border: msg.role === 'user' ? '1px solid var(--border-color)' : 'none'
                }}>
                  {msg.role === 'user' ? <span style={{fontSize:'1rem', fontWeight: 600}}>U</span> : <Bot size={20} color="white" />}
                </div>

                {/* Message Bubble */}
                <div 
                  className="chat-bubble markdown-body"
                  style={{
                    padding: '16px 24px',
                    borderRadius: '16px',
                    background: msg.role === 'user' ? 'var(--primary-accent)' : 'var(--box-bg)',
                    color: msg.role === 'user' ? '#fff' : 'var(--text-primary)',
                    border: msg.role === 'user' ? 'none' : '1px solid var(--border-color)',
                    borderTopRightRadius: msg.role === 'user' ? '4px' : '16px',
                    borderTopLeftRadius: msg.role === 'model' ? '4px' : '16px',
                    fontSize: '1.05rem',
                    lineHeight: '1.6',
                    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
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
            </div>
          ))}
          
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginLeft: '52px' }}>
              <div style={{
                padding: '16px 24px',
                borderRadius: '16px',
                background: 'var(--box-bg)',
                border: '1px solid var(--border-color)',
                display: 'flex',
                gap: '8px',
                alignItems: 'center'
              }}>
                <span className="dot-pulse" style={{width: '10px', height: '10px'}}></span>
                <span className="dot-pulse" style={{width: '10px', height: '10px', animationDelay: '0.2s'}}></span>
                <span className="dot-pulse" style={{width: '10px', height: '10px', animationDelay: '0.4s'}}></span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div style={{
          padding: '24px 32px',
          borderTop: '1px solid var(--border-color)',
          background: 'var(--modal-bg)',
          backdropFilter: 'blur(12px)'
        }}>
          <form 
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              gap: '16px',
              maxWidth: '1200px',
              margin: '0 auto',
              position: 'relative'
            }}
          >
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask your CDV-sales-intelligence AI..."
              disabled={isLoading}
              style={{
                flex: 1,
                background: 'var(--input-bg)',
                border: '1px solid var(--border-color)',
                borderRadius: '32px',
                padding: '18px 24px',
                paddingRight: '64px',
                color: 'var(--input-text)',
                outline: 'none',
                fontSize: '1.1rem',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
              }}
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
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
                color: 'white',
                boxShadow: '0 2px 8px rgba(59, 130, 246, 0.4)'
              }}
            >
              <Send size={20} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
