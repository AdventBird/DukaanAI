import test from 'node:test';
import assert from 'node:assert/strict';
import { getEffectiveAIConfig, maskApiKey, getAIHealth } from '../src/modules/ai/config.js';
import { toolRegistry } from '../src/modules/ai/tools/tool.registry.js';
import { taskService } from '../src/modules/ai/task.service.js';
import { demoVoiceProvider } from '../src/modules/ai/adapters/voice.adapter.js';
import { browserPortalAdapter } from '../src/modules/ai/adapters/browser.adapter.js';
import { AIService } from '../src/modules/ai/ai.service.js';
import { procurementService } from '../src/modules/procurement/procurement.service.js';

test('AI Config & Key Security - Masks key and allows custom key override', () => {
  const config = getEffectiveAIConfig();
  assert.ok(config.apiKey, 'API key must be resolved');
  assert.ok(config.apiKey.length > 0, 'API key must not be empty');

  const health = getAIHealth(config);
  assert.equal(health.keyConfigured, true);
  assert.equal(health.status, 'READY');
  assert.ok(health.maskedKey.startsWith('AQ.Ab8'), 'Masked key must start with prefix');
  assert.ok(health.maskedKey.endsWith('DKqg'), 'Masked key must end with suffix');
  assert.ok(health.maskedKey.includes('••••'), 'Masked key must hide middle characters');
  assert.notEqual(health.maskedKey, config.apiKey, 'Masked key must NEVER equal raw key');

  // Custom key override
  const customConfig = getEffectiveAIConfig('custom-user-key-1234567890');
  assert.equal(customConfig.apiKey, 'custom-user-key-1234567890');
  assert.equal(customConfig.keySource, 'CUSTOM');
  const customHealth = getAIHealth(customConfig);
  assert.ok(customHealth.maskedKey.includes('••••'));

  // Utility maskApiKey
  assert.equal(maskApiKey(''), 'Not Configured');
  assert.equal(maskApiKey('short'), 'Not Configured');
  assert.equal(maskApiKey('AQ.Ab8TESTKEYFORUNITTESTONLYDKqg'), 'AQ.Ab8••••••••DKqg');
});

test('AI Tool Registry - Strict permission classes and schema registration', () => {
  const toolDefs = toolRegistry.getAllDefinitions();
  assert.ok(toolDefs.length >= 8, 'Should register all core business tools');

  // Verify permission classifications on internal tools
  const searchTool = toolRegistry.get('search_products');
  assert.ok(searchTool);
  assert.equal(searchTool?.permission, 'READ');

  const draftTool = toolRegistry.get('create_purchase_order_draft');
  assert.ok(draftTool);
  assert.equal(draftTool?.permission, 'DRAFT_WRITE');

  const approvalTool = toolRegistry.get('submit_order_for_approval');
  assert.ok(approvalTool);
  assert.equal(approvalTool?.permission, 'APPROVAL_REQUEST');

  const portalTool = toolRegistry.get('submit_order_via_mock_portal');
  assert.ok(portalTool);
  assert.equal(portalTool?.permission, 'APPROVED_EXECUTION');
});

test('Safety Constraint - AI cannot submit unapproved PO to distributor portal', async () => {
  const portalTool = toolRegistry.get('submit_order_via_mock_portal');
  assert.ok(portalTool);

  // 1. Non-existent PO is rejected
  await assert.rejects(
    async () => {
      await portalTool.execute(
        {
          storeId: 'demo-store',
          userId: 'demo-owner',
          requestId: 'req_safety_check_1',
          prisma: {} as any,
        },
        { purchaseOrderId: 'po_unapproved_123' }
      );
    },
    /Purchase order po_unapproved_123 not found/i
  );

  // 2. Draft (unapproved) PO is strictly rejected by the AI portal execution tool
  const draftPo = await procurementService.createPurchaseOrderDraft('demo-store', 'demo-owner', {
    supplierId: 'sup_metro',
    items: [
      {
        productId: 'prod_101',
        quantityInPurchasePacks: '2.000',
        unitPricePerPurchasePack: '110.00',
      },
    ],
    notes: 'Safety test unapproved draft',
  });

  assert.equal(draftPo.status, 'DRAFT');

  await assert.rejects(
    async () => {
      await portalTool.execute(
        {
          storeId: 'demo-store',
          userId: 'demo-owner',
          requestId: 'req_safety_check_2',
          prisma: {} as any,
        },
        { purchaseOrderId: draftPo.id }
      );
    },
    /Safety check failed: Order status is 'DRAFT'|The store owner must explicitly approve/i
  );
});

test('Simulated Indian-Language Voice Interaction - Negotiates and returns structured quote', async () => {
  const voiceResult = await demoVoiceProvider.simulateOutboundCall(
    'hi-IN',
    'SUPPLIER_QUOTATION',
    {
      storeName: 'Kirana Store',
      supplierId: 'sup_metro',
      supplierName: 'Metro Wholesale',
      productName: 'Parle-G Gold 1kg',
      requestedQuantity: 20,
      packLabel: 'cartons',
      scenario: 'NEGOTIATED_DISCOUNT',
    }
  );

  assert.equal(voiceResult.mode, 'SIMULATED', 'Must explicitly declare SIMULATED mode');
  assert.equal(voiceResult.language, 'hi-IN');
  assert.ok(voiceResult.transcript.length >= 4, 'Must have realistic multi-turn conversation');
  assert.ok(voiceResult.extractedQuote, 'Must produce extracted quote');
  assert.equal(voiceResult.extractedQuote?.productName, 'Parle-G Gold 1kg');
  assert.ok(voiceResult.extractedQuote?.quotedPricePerPack);

  // Check Devanagari Hindi text is present in dialogue
  const hasDevanagari = voiceResult.transcript.some((t) => /[\u0900-\u097F]/.test(t.text));
  assert.ok(hasDevanagari, 'Dialogue must contain Indian vernacular Hindi script');

  // Verify negotiation applied
  assert.equal(voiceResult.extractedQuote?.negotiationApplied, true);
  assert.equal(voiceResult.extractedQuote?.quotedPricePerPack, '110.00');
});

test('Durable Task State Machine - Checkpoints, approval pause, and step advancement', () => {
  // Create task
  const task = taskService.createTask({
    storeId: 'demo-store',
    taskType: 'REPLENISHMENT',
    inputSummary: 'Auto replenishment test for Parle-G',
    steps: [
      { name: '1. Check Low Stock', toolName: 'get_low_stock' },
      { name: '2. Call Supplier', toolName: 'simulate_supplier_voice_call' },
      { name: '3. Create Draft PO', toolName: 'create_purchase_order_draft' },
      { name: '4. Submit for Approval', toolName: 'submit_order_for_approval' },
      { name: '5. Submit to Distributor Portal', toolName: 'submit_order_via_mock_portal' },
    ],
    initialCheckpoint: {
      productId: 'prod_101',
      productName: 'Parle-G Gold 1kg',
    },
  });

  assert.equal(task.status, 'QUEUED');
  assert.equal(task.currentStep, 0);

  // Transition to RUNNING
  const running = taskService.updateTaskStatus(task.id, 'RUNNING');
  assert.equal(running?.status, 'RUNNING');

  // Advance step 0 -> 1
  taskService.advanceStep(task.id, 0, 'COMPLETED', 'Found 1 item below threshold');
  const fetched = taskService.getTask(task.id);
  assert.equal(fetched?.steps[0].status, 'COMPLETED');
  assert.equal(fetched?.currentStep, 1);

  // Pause at approval boundary
  taskService.updateTaskStatus(task.id, 'WAITING_APPROVAL', undefined, {
    purchaseOrderId: 'po_test_456',
    purchaseOrderNumber: 'PO-2026-0042',
    estimatedTotal: '3300.00',
  });
  const waitingApproval = taskService.getTask(task.id);
  assert.equal(waitingApproval?.status, 'WAITING_APPROVAL');
  assert.equal(waitingApproval?.checkpoint.purchaseOrderNumber, 'PO-2026-0042');

  // Complete task after approval and portal submission
  taskService.advanceStep(task.id, 4, 'COMPLETED', 'Submitted via automated browser');
  taskService.updateTaskStatus(task.id, 'COMPLETED', undefined, {
    portalOrderReference: 'DIST-ORD-88192',
  });

  const completed = taskService.getTask(task.id);
  assert.equal(completed?.status, 'COMPLETED');
  assert.equal(completed?.checkpoint.portalOrderReference, 'DIST-ORD-88192');
  assert.ok(completed?.completedAt);
});

test('Mock Distributor Portal Browser Adapter - Handles submission with offline fallback', async () => {
  const result = await browserPortalAdapter.submitPurchaseOrder({
    supplierId: 'sup_metro',
    poNumber: 'PO-2026-0099',
    items: [
      {
        sku: 'SKU-PARLE-1KG',
        name: 'Parle-G Gold 1kg',
        packs: 10,
        unitPrice: 110,
        total: 1100,
      },
    ],
    totalAmount: 1100,
  });

  assert.equal(result.success, true);
  assert.equal(result.status, 'ACKNOWLEDGED');
  assert.ok(result.orderReference.startsWith('DIST-ORD-'));
  assert.equal(result.poNumber, 'PO-2026-0099');
  assert.ok(result.diagnostics);
});

test('AI Service & Bounded Orchestrator - Chat query and session management', async () => {
  const mockPrisma = {} as any;
  const aiService = new AIService(mockPrisma);

  // Chat message query
  const response = await aiService.handleChat({
    storeId: 'demo-store',
    userId: 'demo-owner',
    requestId: 'req_chat_test',
    message: 'Hello, who are you and how can you help my kirana store?',
  });

  assert.ok(response.sessionId, 'Must assign session ID');
  assert.ok(response.message.length > 0, 'Must produce a response');
  assert.ok(Array.isArray(response.actions), 'Actions must be an array');
  assert.ok(Array.isArray(response.evidence), 'Evidence must be an array');
  assert.equal(response.keySource, 'SYSTEM_DEFAULT');

  // Session persistence
  const session = aiService.getSession(response.sessionId, 'demo-store');
  assert.ok(session, 'Session must be retrievable');
  assert.ok(session?.messages.length >= 2, 'Must record user and assistant messages');

  // Listing sessions for store
  const sessions = aiService.listSessions('demo-store');
  assert.ok(sessions.length >= 1, 'Must list store sessions');
});
