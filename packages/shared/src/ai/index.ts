import { z } from 'zod';

export const agentTaskStatuses = [
  'QUEUED',
  'RUNNING',
  'WAITING_EXTERNAL',
  'WAITING_APPROVAL',
  'NEEDS_ATTENTION',
  'RETRY_SCHEDULED',
  'COMPLETED',
  'FAILED',
  'CANCELLED',
] as const;
export type AgentTaskStatus = (typeof agentTaskStatuses)[number];

export const agentTaskTypes = [
  'REPLENISHMENT',
  'PRICE_AUDIT',
  'SUPPLIER_FOLLOW_UP',
  'QUERY',
] as const;
export type AgentTaskType = (typeof agentTaskTypes)[number];

export const agentToolPermissions = [
  'READ',
  'DRAFT_WRITE',
  'APPROVAL_REQUEST',
  'APPROVED_EXECUTION',
] as const;
export type AgentToolPermission = (typeof agentToolPermissions)[number];

export const chatMessageSchema = z.object({
  id: z.string().optional(),
  sessionId: z.string().optional(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
  createdAt: z.string().optional(),
});
export type ChatMessage = z.infer<typeof chatMessageSchema>;

export const chatRequestSchema = z.object({
  sessionId: z.string().nullable().optional(),
  message: z.string().min(1, 'Message cannot be empty'),
  customApiKey: z.string().optional(),
});
export type ChatRequest = z.infer<typeof chatRequestSchema>;

export interface AgentEvidenceItem {
  type: 'INVENTORY_PRODUCT' | 'SUPPLIER_QUOTE' | 'PURCHASE_ORDER' | 'VOICE_TRANSCRIPT' | 'PORTAL_SUBMISSION';
  id: string;
  label: string;
  data?: unknown;
}

export interface AgentToolAction {
  tool: string;
  status: 'SUCCEEDED' | 'FAILED' | 'WAITING_APPROVAL';
  summary?: string;
  durationMs?: number;
}

export interface ChatResponseData {
  sessionId: string;
  message: string;
  taskIds: string[];
  actions: AgentToolAction[];
  evidence: AgentEvidenceItem[];
  model: string;
  keySource: 'CUSTOM' | 'SYSTEM_DEFAULT';
}

export interface AgentTaskStep {
  stepIndex: number;
  name: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'SKIPPED';
  detail?: string;
  toolName?: string;
  completedAt?: string;
}

export interface AgentTaskRecord {
  id: string;
  storeId: string;
  taskType: AgentTaskType;
  status: AgentTaskStatus;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  inputSummary: string;
  currentStep: number;
  steps: AgentTaskStep[];
  checkpoint: Record<string, unknown>;
  attemptCount: number;
  maxAttempts: number;
  nextRunAt?: string | null;
  leaseOwner?: string | null;
  leaseExpiresAt?: string | null;
  lastErrorCode?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface VoiceCallResult {
  callId: string;
  taskId?: string;
  mode: 'SIMULATED' | 'LIVE';
  language: 'hi-IN' | 'mr-IN' | 'en-IN';
  supplierId: string;
  supplierName: string;
  phoneNumber: string;
  purpose: 'SUPPLIER_QUOTATION' | 'DELIVERY_FOLLOW_UP';
  startedAt: string;
  endedAt: string;
  transcript: Array<{ speaker: 'AI_AGENT' | 'SUPPLIER'; text: string; timestamp: string }>;
  extractedQuote?: {
    productName: string;
    packLabel: string;
    unitsPerPack: number;
    quotedPricePerPack: string;
    normalizedPricePerStockUnit: string;
    availablePacks: number;
    leadTimeDays: number;
    notes?: string;
    negotiationApplied: boolean;
  };
  confirmedBySupplier: boolean;
}

export interface AIHealthStatus {
  status: 'READY' | 'DEGRADED' | 'UNCONFIGURED';
  model: string;
  provider: string;
  keyConfigured: boolean;
  keySource: 'CUSTOM' | 'SYSTEM_DEFAULT' | 'NONE';
  maskedKey: string;
  mockPortalUrl: string;
}
