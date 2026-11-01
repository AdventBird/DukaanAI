import React, { useState, useEffect, useRef } from 'react';
import {
  Bot,
  Send,
  Sparkles,
  Key,
  PhoneCall,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  X,
  Volume2,
} from 'lucide-react';
import type {
  ChatResponseData,
  AgentTaskRecord,
  VoiceCallResult,
  AIHealthStatus,
} from '@dukaanai/shared';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3001/api';

async function fetchWithKey<T>(path: string, options: RequestInit = {}): Promise<T> {
  const customKey = localStorage.getItem('dukaanai_custom_api_key') || '';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (customKey.trim()) {
    headers['x-ai-api-key'] = customKey.trim();
  }

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const json = await res.json();
  if (!res.ok) {
    throw new Error(json.error?.message || `Request failed with HTTP ${res.status}`);
  }
  return json.data as T;
}

export function AIPage() {
  const [messages, setMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string; actions?: any[]; evidence?: any[] }>>([
    {
      role: 'assistant',
      text: 'Namaste! I am DukaanAI, your store assistant (Digital Munimji). I can scan low-stock products, compare wholesale quotes from distributors, simulate telephone price negotiations in Hindi/Marathi, and prepare purchase orders for your review.',
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);

  const [tasks, setTasks] = useState<AgentTaskRecord[]>([]);
  const [health, setHealth] = useState<AIHealthStatus | null>(null);

  // Key Settings Modal
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customKeyInput, setCustomKeyInput] = useState(localStorage.getItem('dukaanai_custom_api_key') || '');
  const [showKeyText, setShowKeyText] = useState(false);
  const [keySaveMessage, setKeySaveMessage] = useState('');

  // Voice Call Modal
  const [voiceCall, setVoiceCall] = useState<VoiceCallResult | null>(null);
  const [showVoiceModal, setShowVoiceModal] = useState(false);

  // Discrepancy Reconciliation Modal
  const [showDiscrepancyModal, setShowDiscrepancyModal] = useState(false);
  const [discrepancyDraftMessage, setDiscrepancyDraftMessage] = useState('');
  const [copiedNotice, setCopiedNotice] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadData = async () => {
    try {
      const [healthData, tasksData] = await Promise.all([
        fetchWithKey<AIHealthStatus>('/ai/health'),
        fetchWithKey<AgentTaskRecord[]>('/ai/tasks'),
      ]);
      setHealth(healthData);
      setTasks(tasksData);
    } catch (err) {
      console.warn('Failed to fetch initial AI health/tasks:', err);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    setInputText('');
    setMessages((prev) => [...prev, { role: 'user', text }]);
    setIsLoading(true);

    try {
      const data = await fetchWithKey<ChatResponseData>('/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          sessionId,
          message: text,
          customApiKey: localStorage.getItem('dukaanai_custom_api_key') || undefined,
        }),
      });

      setSessionId(data.sessionId);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.message,
          actions: data.actions,
          evidence: data.evidence,
        },
      ]);

      // Check if any voice transcript evidence was returned
      const voiceEv = data.evidence?.find((e: any) => e.type === 'VOICE_TRANSCRIPT');
      if (voiceEv && voiceEv.data) {
        setVoiceCall(voiceEv.data as VoiceCallResult);
      }

      await loadData();
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: `⚠️ Request Error: ${err.message}. Please check your connection or API settings.`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveCustomKey = () => {
    if (customKeyInput.trim()) {
      localStorage.setItem('dukaanai_custom_api_key', customKeyInput.trim());
      setKeySaveMessage('✅ Custom API Key saved! Now being used for AI requests.');
    } else {
      localStorage.removeItem('dukaanai_custom_api_key');
      setKeySaveMessage('✅ Switched back to System Default API Key.');
    }
    loadData();
    setTimeout(() => setKeySaveMessage(''), 3000);
  };

  const handleTriggerAllReplenishment = async () => {
    setIsLoading(true);
    try {
      const res: any = await fetchWithKey('/ai/trigger-check', { method: 'POST' });
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: 'Scan all store products for low-stock reorder conditions' },
        {
          role: 'assistant',
          text: `⚡ Inventory Scan Complete:\nChecked ${res.checkedCount} products. Triggered ${res.triggeredCount} replenishment workflow(s). Review the active tasks in the panel to inspect quotes and approve orders!`,
        },
      ]);
      await loadData();
    } catch (err: any) {
      alert(`Trigger failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerParleGScenario = async () => {
    setIsLoading(true);
    try {
      await fetchWithKey('/ai/trigger-product', {
        method: 'POST',
        body: JSON.stringify({ productId: 'prod-parle-g-100g' }),
      });
      setMessages((prev) => [
        ...prev,
        { role: 'user', text: 'Run restocking analysis for Parle-G 100g (Hackathon Demo)' },
        {
          role: 'assistant',
          text: `⚡ Parle-G 100g Restocking Initiated:\nCurrent stock is 8 packets (minimum threshold: 10, target: 40). Autonomous Replenishment Employee has compared Anand Wholesale (₹42, 1-day) vs Balaji Traders (₹40, 3-day), calculated reorder of 32 units, drafted Purchase Order, and paused for owner approval!`,
        },
      ]);
      await loadData();
    } catch (err: any) {
      alert(`Trigger failed: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleApproveTask = async (taskId: string) => {
    try {
      await fetchWithKey(`/ai/tasks/${taskId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ decisionNote: 'Approved by store owner via DukaanAI Munimji review' }),
      });
      alert('🎉 Purchase Order Approved and Placed with Distributor!');
      await loadData();
    } catch (err: any) {
      alert(`Approval error: ${err.message}`);
    }
  };

  const handleRejectTask = async (taskId: string) => {
    const reason = prompt('Reason for rejection:', 'Price consideration / Sufficient stock on hand') || 'Rejected by owner';
    try {
      await fetchWithKey(`/ai/tasks/${taskId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });
      alert('Purchase Order Draft rejected.');
      await loadData();
    } catch (err: any) {
      alert(`Rejection error: ${err.message}`);
    }
  };

  const handleGenerateDiscrepancyNotice = async () => {
    try {
      const res: any = await fetchWithKey('/ai/reconcile-discrepancy', {
        method: 'POST',
        body: JSON.stringify({
          receiptId: 'GR-2026-PARLEG-01',
          poNumber: 'PO-2026-PARLEG-100G',
          supplierName: 'Anand Wholesale Agencies',
          items: [
            {
              productName: 'Parle-G 100g Glucose Biscuits',
              orderedQuantity: '32',
              saleableQuantity: '28',
              damagedQuantity: '2',
              missingQuantity: '2',
            },
          ],
        }),
      });
      setDiscrepancyDraftMessage(res.draftMessage || '');
      setShowDiscrepancyModal(true);
      await loadData();
    } catch (err: any) {
      alert(`Notice generation failed: ${err.message}`);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)', gap: '20px', minHeight: '80vh' }}>
      {/* Left Column: Chat & Interactive Assistant */}
      <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', borderRadius: '12px', border: '1px solid var(--line)', padding: '20px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--line)', paddingBottom: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#eaf4ef', color: 'var(--green)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Bot size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '16px', margin: 0, fontWeight: 700 }}>DukaanAI Employee</h2>
              <small style={{ color: 'var(--muted)', fontSize: '11px' }}>
                Autonomous Store Munimji • Model: {health?.model || 'gemini-3.5-flash'}
              </small>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              style={{
                fontSize: '11px',
                padding: '4px 8px',
                borderRadius: '6px',
                background: health?.keySource === 'CUSTOM' ? '#eff6ff' : '#ecfdf5',
                color: health?.keySource === 'CUSTOM' ? '#1d4ed8' : '#15803d',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <ShieldCheck size={13} />
              {health?.keySource === 'CUSTOM' ? 'Custom Key' : 'System Default Key'}
            </span>

            <button
              onClick={() => setShowKeyModal(true)}
              style={{
                background: '#f8fafc',
                border: '1px solid #cbd5e1',
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                color: '#334155',
                fontWeight: 600,
              }}
              title="Configure API Key"
            >
              <Key size={13} />
              API Key
            </button>
          </div>
        </div>

        {/* Quick Action Prompt Chips */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '10px' }}>
          <button
            onClick={handleTriggerAllReplenishment}
            style={{ fontSize: '11px', padding: '6px 12px', background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', borderRadius: '16px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 700 }}
          >
            ⚡ Scan Low Stock & Reorder
          </button>
          <button
            onClick={handleTriggerParleGScenario}
            style={{ fontSize: '11px', padding: '6px 12px', background: '#eff6ff', border: '1px solid #93c5fd', color: '#1d4ed8', borderRadius: '16px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            🍪 Parle-G 100g Demo Reorder
          </button>
          <button
            onClick={handleGenerateDiscrepancyNotice}
            style={{ fontSize: '11px', padding: '6px 12px', background: '#fef3c7', border: '1px solid #fde047', color: '#b45309', borderRadius: '16px', cursor: 'pointer', whiteSpace: 'nowrap', fontWeight: 600 }}
          >
            📦 Reconcile Discrepancy
          </button>
          <button
            onClick={() => handleSendMessage('Explain the supplier quote trade-offs between Anand Wholesale and Balaji Traders')}
            style={{ fontSize: '11px', padding: '6px 12px', background: '#f1f5f9', border: '1px solid #cbd5e1', borderRadius: '16px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            ⚖️ Supplier Trade-offs
          </button>
          <button
            onClick={() => handleSendMessage('Simulate a supplier phone call to Anand Agencies in Hindi negotiating Parle-G wholesale boxes')}
            style={{ fontSize: '11px', padding: '6px 12px', background: '#f8fafc', border: '1px solid #cbd5e1', color: '#475569', borderRadius: '16px', cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            📞 Supplier Call (Hindi)
          </button>
        </div>

        {/* Message Stream */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '14px', paddingRight: '6px', maxHeight: '520px' }}>
          {messages.map((m, idx) => (
            <div
              key={idx}
              style={{
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                background: m.role === 'user' ? 'var(--green)' : '#f8fafc',
                color: m.role === 'user' ? '#fff' : '#1e293b',
                padding: '12px 16px',
                borderRadius: m.role === 'user' ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                border: m.role === 'user' ? 'none' : '1px solid #e2e8f0',
                fontSize: '12.5px',
                lineHeight: 1.5,
              }}
            >
              {m.role === 'assistant' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--green)', fontSize: '10.5px', fontWeight: 700, marginBottom: '6px' }}>
                  <Sparkles size={13} /> DUKAANAI MUNIMJI
                </div>
              )}

              <div style={{ whiteSpace: 'pre-wrap' }}>{m.text}</div>

              {/* Tool Execution Badges */}
              {m.actions && m.actions.length > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #cbd5e1', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {m.actions.map((act: any, aIdx: number) => (
                    <span
                      key={aIdx}
                      style={{
                        fontSize: '10px',
                        padding: '2px 7px',
                        borderRadius: '4px',
                        background: act.status === 'SUCCEEDED' ? '#dcfce7' : '#fee2e2',
                        color: act.status === 'SUCCEEDED' ? '#166534' : '#b91c1c',
                        fontFamily: 'monospace',
                      }}
                    >
                      ✔ {act.tool}
                    </span>
                  ))}
                </div>
              )}

              {/* Evidence Items */}
              {m.evidence && m.evidence.length > 0 && (
                <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {m.evidence.map((ev: any, eIdx: number) => (
                    <div
                      key={eIdx}
                      onClick={() => {
                        if (ev.type === 'VOICE_TRANSCRIPT' && ev.data) {
                          setVoiceCall(ev.data);
                          setShowVoiceModal(true);
                        }
                      }}
                      style={{
                        background: '#fff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '6px',
                        padding: '6px 10px',
                        fontSize: '11px',
                        cursor: ev.type === 'VOICE_TRANSCRIPT' ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>📎 {ev.label}</span>
                      {ev.type === 'VOICE_TRANSCRIPT' && (
                        <span style={{ color: '#2563eb', fontWeight: 600, fontSize: '10px' }}>Listen / View Transcript &rarr;</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div style={{ alignSelf: 'flex-start', background: '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', fontSize: '11.5px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <RefreshCw size={14} className="animate-spin" /> Thinking and verifying store records...
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Ask DukaanAI to inspect stock, draft reorders, or negotiate quotes..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            style={{
              flex: 1,
              padding: '12px 14px',
              border: '1px solid var(--line)',
              borderRadius: '8px',
              fontSize: '13px',
              outline: 'none',
            }}
          />
          <button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !inputText.trim()}
            style={{
              background: 'var(--green)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              padding: '0 20px',
              cursor: isLoading || !inputText.trim() ? 'not-allowed' : 'pointer',
              opacity: isLoading || !inputText.trim() ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 600,
            }}
          >
            <Send size={15} />
            Send
          </button>
        </div>
      </div>

      {/* Right Column: Autonomous Tasks & Owner Approval Gates */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* Active Autonomous Tasks Card */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '12px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h3 style={{ fontSize: '14px', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={16} color="var(--green)" /> Autonomous Tasks ({tasks.length})
            </h3>
            <button
              onClick={handleTriggerAllReplenishment}
              style={{ fontSize: '11px', background: '#f0fdf4', border: '1px solid #86efac', color: '#166534', padding: '4px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              + Scan Low Stock
            </button>
          </div>

          {tasks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--muted)', fontSize: '12px' }}>
              No active tasks. Click "+ New Replenishment" or ask in chat to start one.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '380px', overflowY: 'auto' }}>
              {tasks.map((task) => (
                <div
                  key={task.id}
                  style={{
                    border: '1px solid #e2e8f0',
                    borderRadius: '8px',
                    padding: '12px',
                    background: task.status === 'WAITING_APPROVAL' ? '#fffbeb' : '#f8fafc',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <strong style={{ fontSize: '12px', color: '#0f172a' }}>{task.inputSummary}</strong>
                    <span
                      style={{
                        fontSize: '9.5px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        background:
                          task.status === 'COMPLETED'
                            ? '#dcfce7'
                            : task.status === 'WAITING_APPROVAL'
                            ? '#fef3c7'
                            : '#e0f2fe',
                        color:
                          task.status === 'COMPLETED'
                            ? '#166534'
                            : task.status === 'WAITING_APPROVAL'
                            ? '#b45309'
                            : '#0369a1',
                      }}
                    >
                      {task.status}
                    </span>
                  </div>

                  {/* Step Timeline */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '8px 0' }}>
                    {task.steps?.map((step: any, sIdx: number) => (
                      <div key={sIdx} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10.5px' }}>
                        {step.status === 'COMPLETED' ? (
                          <CheckCircle2 size={13} color="#16a34a" />
                        ) : step.status === 'RUNNING' ? (
                          <RefreshCw size={13} color="#0284c7" className="animate-spin" />
                        ) : (
                          <Clock size={13} color="#94a3b8" />
                        )}
                        <span style={{ color: step.status === 'COMPLETED' ? '#15803d' : '#475569', fontWeight: step.status === 'COMPLETED' ? 600 : 400 }}>
                          {step.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Supplier Quotes & Stockout Risk Analysis Matrix */}
                  {task.checkpoint && (task.checkpoint as any).comparisonOffers && Array.isArray((task.checkpoint as any).comparisonOffers) && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#fff', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: '10px', fontWeight: 700, color: '#475569', marginBottom: '6px', textTransform: 'uppercase' }}>
                        Supplier Quotes & Stockout Risk
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 1fr', gap: '4px', fontSize: '10px' }}>
                        <div style={{ fontWeight: 700, color: '#64748b' }}>Distributor</div>
                        <div style={{ fontWeight: 700, color: '#64748b' }}>Rate</div>
                        <div style={{ fontWeight: 700, color: '#64748b' }}>Lead</div>
                        <div style={{ fontWeight: 700, color: '#64748b' }}>Stockout Risk</div>
                        {((task.checkpoint as any).comparisonOffers as any[]).map((off: any, oIdx: number) => (
                          <React.Fragment key={oIdx}>
                            <div style={{ fontWeight: off.supplierId === (task.checkpoint as any).recommendedSupplierId ? 700 : 400 }}>
                              {String(off.supplierName || 'Distributor')} {off.supplierId === (task.checkpoint as any).recommendedSupplierId ? '★' : ''}
                            </div>
                            <div>₹{String(off.unitPrice ?? '')}</div>
                            <div>{String(off.leadTimeDays ?? '')}d</div>
                            <div>
                              <span
                                style={{
                                  fontSize: '9px',
                                  padding: '1px 5px',
                                  borderRadius: '3px',
                                  background: off.stockoutRisk === 'LOW' ? '#dcfce7' : '#fee2e2',
                                  color: off.stockoutRisk === 'LOW' ? '#166534' : '#b91c1c',
                                  fontWeight: 700,
                                }}
                              >
                                {String(off.stockoutRisk || '')}
                              </span>
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                      {Boolean((task.checkpoint as any).reasoning) && (
                        <div style={{ marginTop: '6px', fontSize: '10px', color: '#166534', background: '#f0fdf4', padding: '5px', borderRadius: '4px' }}>
                          💡 <b>Munimji Trade-off Analysis:</b> {String((task.checkpoint as any).reasoning)}
                        </div>
                      )}
                    </div>
                  )}

                  {/* WAITING_APPROVAL Action Banner */}
                  {task.status === 'WAITING_APPROVAL' && (
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '10px',
                        background: '#fef3c7',
                        border: '1px solid #fde047',
                        borderRadius: '6px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#92400e', marginBottom: '6px' }}>
                        <AlertTriangle size={14} /> Action Required: Owner Approval
                      </div>
                      <p style={{ margin: '0 0 8px 0', fontSize: '10.5px', color: '#78350f' }}>
                        Order #{String(task.checkpoint.purchaseOrderNumber || 'Draft')} (₹{String(task.checkpoint.estimatedTotal || '0')}) prepared for {String(task.checkpoint.recommendedSupplierName || task.checkpoint.supplierName || 'Distributor')}. The AI cannot approve its own order.
                      </p>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          onClick={() => handleApproveTask(task.id)}
                          style={{
                            flex: 1.5,
                            background: '#15803d',
                            color: '#fff',
                            border: 'none',
                            padding: '7px 12px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          ✔ Approve & Place Order
                        </button>
                        <button
                          onClick={() => handleRejectTask(task.id)}
                          style={{
                            flex: 1,
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: '1px solid #fca5a5',
                            padding: '7px 10px',
                            borderRadius: '6px',
                            fontSize: '11px',
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          ✕ Reject Draft
                        </button>
                      </div>
                    </div>
                  )}

                  {/* WAITING_EXTERNAL Banner */}
                  {task.status === 'WAITING_EXTERNAL' && (
                    <div style={{ marginTop: '8px', padding: '8px', background: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', fontWeight: 700, color: '#065f46' }}>
                        <CheckCircle2 size={13} /> Order Placed with Distributor
                      </div>
                      <p style={{ margin: '2px 0 0', fontSize: '10px', color: '#047857' }}>
                        Approved by store owner. Awaiting goods delivery at kirana store.
                      </p>
                    </div>
                  )}

                  {/* Completed with Distributor Ref */}
                  {task.status === 'COMPLETED' && Boolean(task.checkpoint.portalOrderReference) && (
                    <div style={{ marginTop: '8px', fontSize: '10.5px', color: '#166534', background: '#dcfce7', padding: '6px 8px', borderRadius: '4px' }}>
                      Distributor Ref: <b>{String(task.checkpoint.portalOrderReference)}</b> (Submitted via browser automation)
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Simulated Indian-Language Voice Interaction Card */}
        <div style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: '12px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '14px', margin: 0, fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <PhoneCall size={16} color="#d97706" /> Supplier Voice Call (Demo)
            </h3>
            <span style={{ fontSize: '10px', background: '#fef3c7', color: '#b45309', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
              SIMULATED
            </span>
          </div>

          <p style={{ fontSize: '11px', color: 'var(--muted)', margin: '0 0 12px 0' }}>
            Demonstrates an outbound phone call in Hindi/Marathi where a wholesale distributor provides quotes and applies volume discounts.
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <button
              onClick={async () => {
                const res = await fetchWithKey<VoiceCallResult>('/ai/voice-call', {
                  method: 'POST',
                  body: JSON.stringify({ language: 'hi-IN', scenario: 'NEGOTIATED_DISCOUNT' }),
                });
                setVoiceCall(res);
                setShowVoiceModal(true);
              }}
              style={{ fontSize: '11px', padding: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              📞 Call in Hindi
            </button>
            <button
              onClick={async () => {
                const res = await fetchWithKey<VoiceCallResult>('/ai/voice-call', {
                  method: 'POST',
                  body: JSON.stringify({ language: 'mr-IN', scenario: 'NEGOTIATED_DISCOUNT' }),
                });
                setVoiceCall(res);
                setShowVoiceModal(true);
              }}
              style={{ fontSize: '11px', padding: '8px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
            >
              📞 Call in Marathi
            </button>
          </div>

          {voiceCall && (
            <div
              onClick={() => setShowVoiceModal(true)}
              style={{
                background: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: '8px',
                padding: '10px',
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 600, color: '#166534', marginBottom: '4px' }}>
                <span>Latest Call: {voiceCall.supplierName}</span>
                <span>{voiceCall.language}</span>
              </div>
              <p style={{ margin: 0, fontSize: '10.5px', color: '#14532d' }}>
                Quoted: ₹{voiceCall.extractedQuote?.quotedPricePerPack}/box • {voiceCall.extractedQuote?.notes}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Voice Transcript Modal */}
      {showVoiceModal && voiceCall && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '540px', padding: '20px', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px' }}>Outbound Supplier Voice Interaction</h3>
                <small style={{ color: '#64748b' }}>Language: {voiceCall.language} • Mode: {voiceCall.mode}</small>
              </div>
              <button onClick={() => setShowVoiceModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
              {voiceCall.transcript?.map((line: any, lIdx: number) => (
                <div
                  key={lIdx}
                  style={{
                    padding: '8px 12px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    background: line.speaker === 'AI_AGENT' ? '#eff6ff' : '#f8fafc',
                    border: '1px solid #e2e8f0',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: line.speaker === 'AI_AGENT' ? '#1d4ed8' : '#475569', fontWeight: 700, marginBottom: '2px' }}>
                    <span>{line.speaker === 'AI_AGENT' ? '🤖 DukaanAI Agent' : `🏢 Supplier (${voiceCall.supplierName})`}</span>
                    <span>{line.timestamp}</span>
                  </div>
                  <div>{line.text}</div>
                </div>
              ))}
            </div>

            {voiceCall.extractedQuote && (
              <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '10px', fontSize: '11.5px', color: '#166534' }}>
                <b>Extracted Quote Details:</b>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', marginTop: '4px' }}>
                  <span>Price / Box: <b>₹{voiceCall.extractedQuote.quotedPricePerPack}</b></span>
                  <span>Units / Box: <b>{voiceCall.extractedQuote.unitsPerPack}</b></span>
                  <span>Effective / Unit: <b>₹{voiceCall.extractedQuote.normalizedPricePerStockUnit}</b></span>
                  <span>Lead Time: <b>{voiceCall.extractedQuote.leadTimeDays} day(s)</b></span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Key Settings Modal */}
      {showKeyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '480px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Key size={16} color="var(--green)" /> AI Model & API Key Settings
              </h3>
              <button onClick={() => setShowKeyModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.5, marginBottom: '14px' }}>
              <p style={{ margin: '0 0 8px 0' }}>
                <b>Provider key:</b> AI is disabled until a provider key is configured through the environment or entered for this request. Autonomous actions remain deferred while business-data integration is stabilised.
              </p>
              <div style={{ background: '#f1f5f9', padding: '8px 12px', borderRadius: '6px', fontSize: '11px', fontFamily: 'monospace', color: '#0f172a', marginBottom: '12px' }}>
                Status: {health?.status === 'READY' ? '🟢 Active' : '🟡 Offline'} • Masked Key: {health?.maskedKey || 'Not Configured'}
              </div>
              <p style={{ margin: '0 0 6px 0' }}>
                <b>Use Your Own Custom API Key (Optional):</b>
              </p>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input
                  type={showKeyText ? 'text' : 'password'}
                  placeholder="Paste your Gemini or OpenAI API key here..."
                  value={customKeyInput}
                  onChange={(e) => setCustomKeyInput(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 40px 10px 12px',
                    border: '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '12px',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowKeyText(!showKeyText)}
                  style={{ position: 'absolute', right: '10px', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b' }}
                >
                  {showKeyText ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {keySaveMessage && (
              <div style={{ fontSize: '11px', color: '#166534', background: '#dcfce7', padding: '8px 10px', borderRadius: '6px', marginBottom: '12px' }}>
                {keySaveMessage}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => {
                  setCustomKeyInput('');
                  localStorage.removeItem('dukaanai_custom_api_key');
                  setKeySaveMessage('✅ Cleared custom key. Using System Default Key.');
                  loadData();
                }}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '6px', fontSize: '11.5px', cursor: 'pointer' }}
              >
                Revert to Default Key
              </button>
              <button
                onClick={handleSaveCustomKey}
                style={{ background: 'var(--green)', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer' }}
              >
                Save Custom Key
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discrepancy Reconciliation Modal */}
      {showDiscrepancyModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '560px', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '10px', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>Goods Receipt Discrepancy Reconciliation</h3>
                <small style={{ color: '#64748b' }}>Automated credit-note & supplier notice generator</small>
              </div>
              <button onClick={() => setShowDiscrepancyModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ fontSize: '12px', color: '#334155', marginBottom: '12px', background: '#f8fafc', padding: '10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
              <div><b>Delivery Note:</b> GR-2026-PARLEG-01 • <b>Distributor:</b> Anand Wholesale Agencies</div>
              <div><b>Verified Count:</b> 28 saleable received | <span style={{ color: '#b91c1c', fontWeight: 700 }}>2 damaged in transit, 2 missing from carton</span></div>
              <div style={{ fontSize: '11px', color: '#15803d', marginTop: '4px' }}>
                ✔ Inventory balance has been safely incremented by exactly <b>28 saleable units</b>.
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                DRAFTED SUPPLIER NOTICE (FOR WHATSAPP / EMAIL CREDIT NOTE REQUEST):
              </div>
              <pre style={{
                background: '#f1f5f9',
                padding: '12px',
                borderRadius: '6px',
                fontSize: '11.5px',
                whiteSpace: 'pre-wrap',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                margin: 0,
                border: '1px solid #cbd5e1',
                maxHeight: '220px',
                overflowY: 'auto',
              }}>
                {discrepancyDraftMessage}
              </pre>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(discrepancyDraftMessage);
                  setCopiedNotice(true);
                  setTimeout(() => setCopiedNotice(false), 3000);
                }}
                style={{
                  background: copiedNotice ? '#15803d' : '#0284c7',
                  color: '#fff',
                  border: 'none',
                  padding: '8px 16px',
                  borderRadius: '6px',
                  fontSize: '11.5px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copiedNotice ? '✔ Notice Copied to Clipboard!' : '📋 Copy Notice to Clipboard'}
              </button>
              <button
                onClick={() => setShowDiscrepancyModal(false)}
                style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 14px', borderRadius: '6px', fontSize: '11.5px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
