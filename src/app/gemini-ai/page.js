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
      background: 'var(--bg)',
      color: 'var(--text)',
      overflow: 'hidden'
    }}>
      {/* History Sidebar */}
      <div style={{
        width: sidebarOpen ? '280px' : '0px',
        minWidth: sidebarOpen ? '280px' : '0px',
        transition: 'width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1), min-width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)',
        background: 'var(--bg)',
        borderRight: sidebarOpen ? '1px solid var(--line)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        zIndex: 20
      }}>
        {/* Sidebar Header */}
        <div style={{
          padding: '16px',
          borderBottom: '1px solid var(--line)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <History size={20} color="var(--blue)" />
              <span style={{ fontWeight: 600, fontSize: '17px', lineHeight: '22px', letterSpacing: '-0.01em', color: 'var(--text)' }}>Chat History</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                background: 'var(--trk)',
                border: 0,
                color: 'var(--muted)',
                cursor: 'pointer',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Close Sidebar"
            >
              <PanelLeftClose size={18} />
            </button>
          </div>

          <button
            onClick={createNewChat}
            style={{
              background: 'var(--blue)',
              color: '#fff',
              border: 0,
              borderRadius: 'var(--r-pill)',
              minHeight: '44px',
              padding: '0 20px',
              fontWeight: 600,
              fontSize: '15px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              transition: 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
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
                  minHeight: '44px',
                  padding: '0 14px',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  background: isActive 
                    ? 'var(--blue-tint)' 
                    : isHovered 
                    ? 'var(--trk)' 
                    : 'transparent',
                  border: 0,
                  color: isActive ? 'var(--blue)' : 'var(--muted)',
                  transition: 'background 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                  <MessageSquare size={16} color={isActive ? 'var(--blue)' : 'var(--muted)'} style={{ flexShrink: 0 }} />
                  <span style={{
                    fontSize: '15px',
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
                      border: 0,
                      color: 'var(--red)',
                      cursor: 'pointer',
                      padding: '4px',
                      borderRadius: '50%',
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
          borderTop: '1px solid var(--line)'
        }}>
          <button
            onClick={() => {
              if (window.confirm("Are you sure you want to clear all chat history?")) {
                clearAllSessions();
              }
            }}
            style={{
              width: '100%',
              background: 'var(--red-tint)',
              color: 'var(--red)',
              border: 0,
              minHeight: '44px',
              padding: '0 20px',
              borderRadius: 'var(--r-pill)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              fontSize: '13px',
              fontWeight: 600,
              transition: 'opacity 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)'
            }}
            onMouseOver={e => e.currentTarget.style.opacity = 0.8}
            onMouseOut={e => e.currentTarget.style.opacity = 1}
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
          padding: '16px',
          borderBottom: '1px solid var(--line)',
          background: 'var(--bg)',
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
                  background: 'var(--trk)',
                  border: 0,
                  color: 'var(--text)',
                  minHeight: '44px',
                  padding: '0 16px',
                  borderRadius: 'var(--r-pill)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  fontSize: '15px'
                }}
                title="Open Sidebar"
              >
                <PanelLeft size={18} color="var(--blue)" />
                <span>History</span>
              </button>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ 
                background: 'var(--blue)', 
                padding: '10px', 
                borderRadius: '50%',
                display: 'flex'
              }}>
                <Bot size={24} color="#fff" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '22px', lineHeight: '28px', letterSpacing: '-0.02em', fontWeight: 700, color: 'var(--text)' }}>Claude Intelligence</h1>
                <p style={{ margin: '2px 0 0 0', color: 'var(--muted)', fontSize: '13px', lineHeight: '18px' }}>AI Sales Assistant</p>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={createNewChat}
              style={{
                background: 'var(--blue-tint)',
                color: 'var(--blue)',
                border: 0,
                minHeight: '44px',
                padding: '0 20px',
                borderRadius: 'var(--r-pill)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '15px',
                fontWeight: 600
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
            padding: '24px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
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
                  background: msg.role === 'user' ? 'var(--s2)' : 'var(--blue)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  color: 'var(--text)'
                }}>
                  {msg.role === 'user' ? <span style={{fontSize:'1rem', fontWeight: 600}}>U</span> : <Bot size={20} color="#fff" />}
                </div>

                {/* Message Bubble */}
                <div 
                  className="chat-bubble markdown-body"
                  style={{
                    padding: '12px 16px',
                    borderRadius: '18px',
                    background: msg.role === 'user' ? 'var(--blue)' : 'var(--s2)',
                    color: msg.role === 'user' ? '#fff' : 'var(--text)',
                    border: 0,
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
            </div>
          ))}
          
          {isLoading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginLeft: '52px' }}>
              <div style={{
                padding: '16px 20px',
                borderRadius: '18px',
                background: 'var(--s2)',
                border: 0,
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
          padding: '16px',
          borderTop: '1px solid var(--line)',
          background: 'var(--bg)'
        }}>
          <form 
            onSubmit={handleSubmit}
            style={{
              display: 'flex',
              gap: '12px',
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
                background: 'var(--s2)',
                border: 0,
                borderRadius: '24px',
                minHeight: '48px',
                padding: '0 56px 0 20px',
                color: 'var(--text)',
                fontFamily: 'inherit',
                fontSize: '15px'
              }}
            />
            <button 
              type="submit"
              disabled={isLoading || !input.trim()}
              style={{
                position: 'absolute',
                right: '6px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'var(--blue)',
                border: 0,
                borderRadius: '50%',
                width: '36px',
                height: '36px',
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
      </div>
    </div>
  );
}
