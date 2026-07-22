'use client';

import { useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot, Send, Download, Trash2 } from 'lucide-react';
import { useChat } from '../../context/ChatContext';

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
      <div style={{ width: '100%', overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>{children}</table>
      </div>
      <button 
        onClick={handleDownload} 
        style={{ 
          background: 'var(--primary-accent)', 
          color: 'white', 
          padding: '8px 16px', 
          borderRadius: '8px', 
          border: 'none', 
          cursor: 'pointer', 
          fontSize: '0.9rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '8px',
          fontWeight: 500,
          transition: 'background-color 0.2s'
        }}
        onMouseOver={e => e.currentTarget.style.backgroundColor = '#2563eb'}
        onMouseOut={e => e.currentTarget.style.backgroundColor = 'var(--primary-accent)'}
      >
        <Download size={16} />
        Download Data as CSV
      </button>
    </div>
  );
};

export default function GeminiAIPage() {
  const messagesEndRef = useRef(null);
  const { messages, isLoading, input, setInput, sendMessage, clearChat } = useChat();

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
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column',
      background: 'var(--background-dark)',
      color: 'var(--text-primary)'
    }}>
      {/* Header */}
      <div style={{
        padding: '24px 32px',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--modal-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ 
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', 
            padding: '12px', 
            borderRadius: '12px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}>
            <Bot size={32} color="white" />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: '#f8fafc' }}>Gemini Intelligence</h1>
            <p style={{ margin: '4px 0 0 0', color: '#94a3b8', fontSize: '0.95rem' }}>Full-Screen Assistant</p>
          </div>
        </div>
        
        <button 
          onClick={clearChat}
          title="Clear Chat History"
          style={{
            background: 'rgba(239, 68, 68, 0.1)',
            color: '#ef4444',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            padding: '8px 16px',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: 500,
            transition: 'all 0.2s'
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
          }}
        >
          <Trash2 size={16} />
          Clear Chat
        </button>
      </div>

      {/* Chat Area */}
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
                {msg.role === 'user' ? <span style={{fontSize:'1rem'}}>U</span> : <Bot size={20} color="white" />}
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
                    table: ({node, ...props}) => <TableWithCSV {...props} />
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
  );
}
