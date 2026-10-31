import { Router, type Request, type Response } from 'express';
import type { PrismaClient } from '@prisma/client';
import {
  chatRequestSchema,
  successEnvelope,
  errorEnvelope,
} from '@dukaanai/shared';
import { AIService } from './ai.service.js';
import { getEffectiveAIConfig, getAIHealth } from './config.js';
import { taskService } from './task.service.js';
import { demoVoiceProvider } from './adapters/voice.adapter.js';
import { browserPortalAdapter } from './adapters/browser.adapter.js';
import { procurementService } from '../procurement/procurement.service.js';

export function createAIRouter(prisma: PrismaClient): Router {
  const router = Router();
  const aiService = new AIService(prisma);

  // Helper to extract custom API key from header or body
  const getCustomKey = (req: Request): string | undefined => {
    const fromHeader = req.header('x-ai-api-key');
    if (fromHeader && fromHeader.trim().length > 0) return fromHeader.trim();
    if (req.body && typeof req.body.customApiKey === 'string' && req.body.customApiKey.trim().length > 0) {
      return req.body.customApiKey.trim();
    }
    return undefined;
  };

  // GET /api/ai/health
  router.get('/health', (req: Request, res: Response) => {
    const customKey = getCustomKey(req);
    const config = getEffectiveAIConfig(customKey);
    const health = getAIHealth(config);
    res.json(successEnvelope(health, res.locals.requestId));
  });

  // POST /api/ai/chat
  router.post('/chat', async (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'A valid session is required.', res.locals.requestId));
    }

    const parseResult = chatRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json(
        errorEnvelope('VALIDATION_ERROR', 'Invalid chat request payload.', res.locals.requestId, parseResult.error.issues)
      );
    }

    const customKey = getCustomKey(req);

    try {
      const chatResponse = await aiService.handleChat({
        storeId: req.auth.storeId,
        userId: req.auth.userId,
        requestId: res.locals.requestId,
        message: parseResult.data.message,
        sessionId: parseResult.data.sessionId,
        customApiKey: customKey,
      });

      res.json(successEnvelope(chatResponse, res.locals.requestId));
    } catch (err: any) {
      console.error('[AIRouter] Chat error:', err);
      res.status(500).json(
        errorEnvelope('INTERNAL_ERROR', err.message || 'AI processing encountered an unexpected error.', res.locals.requestId)
      );
    }
  });

  // GET /api/ai/sessions
  router.get('/sessions', (req: Request, res: Response) => {
    if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'Auth required', res.locals.requestId));
    const sessions = aiService.listSessions(req.auth.storeId);
    res.json(successEnvelope(sessions, res.locals.requestId));
  });

  // GET /api/ai/sessions/:id
  router.get('/sessions/:id', (req: Request, res: Response) => {
    if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'Auth required', res.locals.requestId));
    const session = aiService.getSession(String(req.params.id), req.auth.storeId);
    if (!session) {
      return res.status(404).json(errorEnvelope('NOT_FOUND', 'Session not found.', res.locals.requestId));
    }
    res.json(successEnvelope(session, res.locals.requestId));
  });

  // GET /api/ai/tasks
  router.get('/tasks', (req: Request, res: Response) => {
    if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'Auth required', res.locals.requestId));
    const status = req.query.status as any;
    const tasks = taskService.listTasks(req.auth.storeId, status);
    res.json(successEnvelope(tasks, res.locals.requestId));
  });

  // GET /api/ai/tasks/:id
  router.get('/tasks/:id', (req: Request, res: Response) => {
    if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'Auth required', res.locals.requestId));
    const task = taskService.getTask(String(req.params.id));
    if (!task || task.storeId !== req.auth.storeId) {
      return res.status(404).json(errorEnvelope('NOT_FOUND', 'Task not found.', res.locals.requestId));
    }
    res.json(successEnvelope(task, res.locals.requestId));
  });

  // POST /api/ai/tasks
  router.post('/tasks', async (req: Request, res: Response) => {
    if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'Auth required', res.locals.requestId));
    const task = await aiService.startAutonomousReplenishmentTask(req.auth.storeId, req.auth.userId, res.locals.requestId);
    res.status(201).json(successEnvelope(task, res.locals.requestId));
  });

  // POST /api/ai/tasks/:id/cancel
  router.post('/tasks/:id/cancel', (req: Request, res: Response) => {
    if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'Auth required', res.locals.requestId));
    try {
      const task = taskService.cancelTask(String(req.params.id), req.body?.reason);
      res.json(successEnvelope(task, res.locals.requestId));
    } catch (err: any) {
      res.status(400).json(errorEnvelope('INVALID_STATE', err.message, res.locals.requestId));
    }
  });

  // POST /api/ai/tasks/:id/resume
  router.post('/tasks/:id/resume', async (req: Request, res: Response) => {
    if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'Auth required', res.locals.requestId));
    const task = taskService.getTask(String(req.params.id));
    if (!task || task.storeId !== req.auth.storeId) {
      return res.status(404).json(errorEnvelope('NOT_FOUND', 'Task not found.', res.locals.requestId));
    }

    const poId = task.checkpoint.purchaseOrderId as string;
    if (!poId) {
      return res.status(400).json(errorEnvelope('INVALID_STATE', 'Task has no linked purchase order.', res.locals.requestId));
    }

    const po = await procurementService.getPurchaseOrder(req.auth.storeId, poId);
    if (!po) {
      return res.status(404).json(errorEnvelope('NOT_FOUND', 'Linked purchase order not found.', res.locals.requestId));
    }

    if (po.status !== 'APPROVED') {
      return res.status(400).json(
        errorEnvelope(
          'APPROVAL_REQUIRED',
          `Cannot resume task. Purchase order status is '${po.status}'. Owner must approve the PO before portal submission.`,
          res.locals.requestId
        )
      );
    }

    try {
      // Execute computer use portal submission
      const portalResult = await browserPortalAdapter.submitPurchaseOrder({
        supplierId: po.supplierId,
        poNumber: po.orderNumber,
        items: po.items.map((it) => ({
          sku: it.productId,
          name: it.productNameSnapshot,
          packs: Number(it.orderedQuantityInPurchasePacks),
          unitPrice: Number(it.unitPricePerPurchasePack),
          total: Number(it.lineTotal),
        })),
        totalAmount: Number(po.estimatedTotal),
      });

      // Update PO status to SUBMITTED
      await procurementService.submitPurchaseOrder(req.auth.storeId, po.id, {
        expectedRevision: po.revision,
        idempotencyKey: portalResult.orderReference,
        submissionChannel: 'MOCK_PORTAL',
      });

      taskService.advanceStep(
        task.id,
        5,
        'COMPLETED',
        `Submitted to ${po.supplierName} portal via automated browser agent. Distributor Ref: ${portalResult.orderReference}.`
      );
      taskService.updateTaskStatus(task.id, 'COMPLETED', undefined, {
        portalOrderReference: portalResult.orderReference,
        submittedAt: portalResult.submittedAt,
      });

      res.json(successEnvelope({ task, portalResult }, res.locals.requestId));
    } catch (err: any) {
      taskService.updateTaskStatus(task.id, 'NEEDS_ATTENTION', err.message);
      res.status(500).json(errorEnvelope('SUBMISSION_FAILED', err.message, res.locals.requestId));
    }
  });

  // POST /api/ai/voice-call
  router.post('/voice-call', async (req: Request, res: Response) => {
    const { language, purpose, supplierId, supplierName, productName, requestedQuantity, packLabel, scenario } = req.body;
    const callResult = await demoVoiceProvider.simulateOutboundCall(
      language || 'hi-IN',
      purpose || 'SUPPLIER_QUOTATION',
      {
        supplierId: supplierId || 'sup_anand',
        supplierName: supplierName || 'Anand Agencies Wholesalers',
        productName: productName || 'Parle-G Gold Biscuits 250g',
        requestedQuantity: Number(requestedQuantity || 30),
        packLabel: packLabel || 'box',
        scenario: scenario || 'NEGOTIATED_DISCOUNT',
      }
    );
    res.json(successEnvelope(callResult, res.locals.requestId));
  });

  // GET /api/ai/activity
  router.get('/activity', (req: Request, res: Response) => {
    if (!req.auth) return res.status(401).json(errorEnvelope('UNAUTHENTICATED', 'Auth required', res.locals.requestId));
    const tasks = taskService.listTasks(req.auth.storeId);
    const activities = tasks.flatMap((t) =>
      t.steps
        .filter((s) => s.status === 'COMPLETED')
        .map((s) => ({
          taskId: t.id,
          taskType: t.taskType,
          stepName: s.name,
          detail: s.detail,
          timestamp: s.completedAt || t.updatedAt,
        }))
    );
    res.json(successEnvelope(activities.slice(0, 20), res.locals.requestId));
  });

  return router;
}
