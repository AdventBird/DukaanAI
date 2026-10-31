import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Key,
  X,
  ExternalLink,
  MessageSquare,
  AlertCircle,
  CheckCircle2,
  TrendingUp,
  Package,
  BookOpen,
  DollarSign,
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  actions?: Array<{ tool: string; status: string; summary: string }>;
  evidence?: Array<{ type: string; id: string; label: string }>;
}

export function FloatingChatWidget() {
  const navigate = useNavigate();
  const location = useLocation();

  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        'Namaste! I am DukaanAI Munimji, your Kirana store AI copilot. You can ask me about live sales, low-stock items, top-selling FMCG products, customer Khata balances, or log quick expenses.',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Key Modal State
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customKey, setCustomKey] = useState(
    () => localStorage.getItem('dukaanai_custom_api_key') || ''
  );
  const [keyInput, setKeyInput] = useState('');
  const [keySavedToast, setKeySavedToast] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  const handleSend = async (overrideText?: string) => {
    const textToSend = (overrideText || input).trim();
    if (!textToSend || loading) return;

    setInput('');
    const userMsgId = `user_${Date.now()}`;
    const userMessage: ChatMessage = { id: userMsgId, role: 'user', content: textToSend };
    setMessages((prev) => [...prev, userMessage]);
    setLoading(true);

    try {
      const activeKey = localStorage.getItem('dukaanai_custom_api_key') || '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (activeKey.trim()) {
        headers['x-ai-api-key'] = activeKey.trim();
      }

      const res = await fetch(`${API_BASE}/ai/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          message: textToSend,
          sessionId: sessionId || undefined,
          customApiKey: activeKey.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || `Request failed with status ${res.status}`);
      }

      const data = json.data;
      if (data.sessionId) setSessionId(data.sessionId);

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        role: 'assistant',
        content: data.message,
        actions: data.actions,
        evidence: data.evidence,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: `⚠️ Error communicating with AI: ${err.message}. Please check your connection or API key.`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const saveCustomKey = () => {
    const trimmed = keyInput.trim();
    if (trimmed) {
      localStorage.setItem('dukaanai_custom_api_key', trimmed);
      setCustomKey(trimmed);
    } else {
      localStorage.removeItem('dukaanai_custom_api_key');
      setCustomKey('');
    }
    setKeySavedToast(true);
    setTimeout(() => {
      setKeySavedToast(false);
      setShowKeyModal(false);
    }, 1200);
  };

  // If already on the dedicated full-page /ai route, hide the floating widget to avoid redundancy
  if (location.pathname === '/ai') {
    return null;
  }

  return (
    <>
      {/* Floating Action Button */}
      <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
        {!isOpen ? (
          <button
            onClick={() => setIsOpen(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '12px 20px',
              borderRadius: '9999px',
              backgroundColor: '#0f172a',
              color: '#ffffff',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.3)',
              cursor: 'pointer',
              fontWeight: 600,
              fontSize: '14px',
              transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
              e.currentTarget.style.boxShadow = '0 14px 28px rgba(0,0,0,0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
              e.currentTarget.style.boxShadow =
                '0 10px 25px -5px rgba(0,0,0,0.4), 0 8px 10px -6px rgba(0,0,0,0.3)';
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                color: '#fff',
              }}
            >
              <Bot size={18} />
            </div>
            <span>DukaanAI Munimji</span>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: customKey ? '#10b981' : '#38bdf8',
                boxShadow: `0 0 6px ${customKey ? '#10b981' : '#38bdf8'}`,
              }}
              title={customKey ? 'Custom API Key active' : 'Offline Engine ready'}
            />
          </button>
        ) : (
          /* Expanded Chat Drawer / Card */
          <div
            style={{
              width: '400px',
              maxWidth: 'calc(100vw - 32px)',
              height: '580px',
              maxHeight: 'calc(100vh - 48px)',
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#1e293b',
              color: '#f8fafc',
              borderRadius: '16px',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.6)',
              border: '1px solid rgba(255,255,255,0.12)',
              overflow: 'hidden',
              animation: 'fadeInScale 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                backgroundColor: '#0f172a',
                borderBottom: '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                  }}
                >
                  <Bot size={20} color="#ffffff" />
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    DukaanAI Munimji
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: customKey ? '#065f46' : '#1e3a8a',
                        color: customKey ? '#34d399' : '#93c5fd',
                        fontWeight: 600,
                      }}
                    >
                      {customKey ? 'Gemini Pro/Flash' : 'Offline Mode'}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>Store Digital Manager</div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  onClick={() => {
                    setKeyInput(customKey);
                    setShowKeyModal(true);
                  }}
                  title="Configure AI API Key"
                  style={{
                    padding: '6px 8px',
                    borderRadius: '8px',
                    backgroundColor: customKey ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.08)',
                    color: customKey ? '#34d399' : '#cbd5e1',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                  }}
                >
                  <Key size={13} />
                  <span>{customKey ? 'Key Active' : 'Set Key'}</span>
                </button>

                <button
                  onClick={() => {
                    setIsOpen(false);
                    navigate('/ai');
                  }}
                  title="Open Full AI Studio"
                  style={{
                    padding: '6px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    color: '#cbd5e1',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <ExternalLink size={14} />
                </button>

                <button
                  onClick={() => setIsOpen(false)}
                  style={{
                    padding: '6px',
                    borderRadius: '8px',
                    backgroundColor: 'rgba(255,255,255,0.08)',
                    color: '#cbd5e1',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Quick Action Prompt Chips */}
            <div
              style={{
                display: 'flex',
                gap: '6px',
                padding: '10px 12px',
                backgroundColor: '#1e293b',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                overflowX: 'auto',
                whiteSpace: 'nowrap',
              }}
            >
              <button
                onClick={() => handleSend("How much did we sell today?")}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(59, 130, 246, 0.15)',
                  color: '#93c5fd',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  cursor: 'pointer',
                }}
              >
                <TrendingUp size={11} /> Today's Sales
              </button>

              <button
                onClick={() => handleSend("What products are low on stock?")}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  color: '#fcd34d',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  cursor: 'pointer',
                }}
              >
                <Package size={11} /> Low Stock
              </button>

              <button
                onClick={() => handleSend("Which products are top selling?")}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#6ee7b7',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  cursor: 'pointer',
                }}
              >
                <Sparkles size={11} /> Top Selling
              </button>

              <button
                onClick={() => handleSend("Who owes money on Khata?")}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '11px',
                  padding: '4px 10px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(139, 92, 246, 0.15)',
                  color: '#c4b5fd',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  cursor: 'pointer',
                }}
              >
                <BookOpen size={11} /> Khata Udhar
              </button>
            </div>

            {/* Chat Body */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {messages.map((m) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '100%',
                    }}
                  >
                    <div
                      style={{
                        padding: '10px 14px',
                        borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                        backgroundColor: isUser ? '#2563eb' : '#334155',
                        color: '#ffffff',
                        fontSize: '13px',
                        lineHeight: 1.5,
                        maxWidth: '85%',
                        wordBreak: 'break-word',
                        whiteSpace: 'pre-wrap',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      }}
                    >
                      {m.content}
                    </div>

                    {/* Tool execution badge */}
                    {m.actions && m.actions.length > 0 && (
                      <div style={{ marginTop: '6px', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                        {m.actions.map((act, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '10px',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              backgroundColor: act.status === 'SUCCEEDED' ? '#064e3b' : '#7f1d1d',
                              color: act.status === 'SUCCEEDED' ? '#a7f3d0' : '#fca5a5',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <CheckCircle2 size={10} />
                            {act.tool}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Evidence pills */}
                    {m.evidence && m.evidence.length > 0 && (
                      <div
                        style={{
                          marginTop: '6px',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '3px',
                          maxWidth: '90%',
                        }}
                      >
                        {m.evidence.slice(0, 4).map((ev, eIdx) => (
                          <div
                            key={eIdx}
                            style={{
                              fontSize: '11px',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              backgroundColor: 'rgba(0,0,0,0.25)',
                              border: '1px solid rgba(255,255,255,0.08)',
                              color: '#94a3b8',
                            }}
                          >
                            📌 {ev.label}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '12px' }}>
                  <div
                    style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.2)',
                      borderTopColor: '#38bdf8',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }}
                  />
                  <span>DukaanAI is checking store records…</span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <div
              style={{
                padding: '12px',
                backgroundColor: '#0f172a',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                display: 'flex',
                gap: '8px',
              }}
            >
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSend();
                }}
                placeholder="Ask Munimji (e.g. today's sales, low stock)..."
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '9px 12px',
                  borderRadius: '8px',
                  backgroundColor: '#1e293b',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.12)',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || loading}
                style={{
                  padding: '9px 14px',
                  borderRadius: '8px',
                  backgroundColor: input.trim() && !loading ? '#2563eb' : '#334155',
                  color: '#ffffff',
                  border: 'none',
                  cursor: input.trim() && !loading ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Send size={15} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Key Setup Modal */}
      {showKeyModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
        >
          <div
            style={{
              width: '460px',
              maxWidth: '100%',
              backgroundColor: '#0f172a',
              borderRadius: '16px',
              border: '1px solid rgba(255,255,255,0.15)',
              padding: '24px',
              color: '#f8fafc',
              boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '16px' }}>
                <Key size={18} color="#38bdf8" />
                Configure AI Integration API Key
              </div>
              <button
                onClick={() => setShowKeyModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer',
                }}
              >
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#94a3b8', lineHeight: 1.5, marginBottom: '16px' }}>
              Enter your <b>Google Gemini API Key</b> (or OpenAI API key). When saved, DukaanAI will connect directly to the live LLM for intelligent Kirana store assistance.
            </p>

            <div
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                marginBottom: '16px',
                fontSize: '12px',
                color: '#bae6fd',
                lineHeight: 1.5,
              }}
            >
              💡 <b>Where to get a free API key?</b>
              <br />
              Visit <b>aistudio.google.com</b> &gt; Click <b>Create API Key</b>. Free tier includes high quotas for Gemini 2.5 Flash!
            </div>

            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, marginBottom: '6px' }}>
              API Key (starts with AIzaSy... or sk-...)
            </label>
            <input
              type="password"
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder="Paste your Gemini or OpenAI API key here..."
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                backgroundColor: '#1e293b',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.15)',
                fontSize: '13px',
                marginBottom: '16px',
                outline: 'none',
              }}
            />

            {keySavedToast && (
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '6px',
                  backgroundColor: '#064e3b',
                  color: '#a7f3d0',
                  fontSize: '12px',
                  marginBottom: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <CheckCircle2 size={14} /> Key saved successfully in local session!
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button
                onClick={() => {
                  setKeyInput('');
                  localStorage.removeItem('dukaanai_custom_api_key');
                  setCustomKey('');
                  setShowKeyModal(false);
                }}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  color: '#f87171',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Clear Key
              </button>
              <button
                onClick={() => setShowKeyModal(false)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  backgroundColor: '#334155',
                  color: '#cbd5e1',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                }}
              >
                Cancel
              </button>
              <button
                onClick={saveCustomKey}
                style={{
                  padding: '8px 16px',
                  borderRadius: '8px',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Save Key
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
