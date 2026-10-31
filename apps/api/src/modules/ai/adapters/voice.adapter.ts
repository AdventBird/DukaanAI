import { randomUUID } from 'node:crypto';
import type { VoiceCallResult } from '@dukaanai/shared';

export interface SupplierCallContext {
  storeName?: string;
  supplierId: string;
  supplierName: string;
  phoneNumber?: string;
  productName: string;
  productSku?: string;
  requestedQuantity: number;
  packLabel: string;
  scenario?: 'NORMAL' | 'NEGOTIATED_DISCOUNT' | 'SHORTAGE';
}

export class DemoVoiceProvider {
  private readonly callHistory = new Map<string, VoiceCallResult>();

  async simulateOutboundCall(
    language: 'hi-IN' | 'mr-IN' | 'en-IN',
    purpose: 'SUPPLIER_QUOTATION' | 'DELIVERY_FOLLOW_UP',
    context: SupplierCallContext
  ): Promise<VoiceCallResult> {
    const callId = `call_${Date.now()}_${randomUUID().slice(0, 6)}`;
    const now = new Date();
    const startedAt = now.toISOString();
    const endedAt = new Date(now.getTime() + 45000).toISOString();

    const scenario = context.scenario || 'NEGOTIATED_DISCOUNT';
    const transcript: Array<{ speaker: 'AI_AGENT' | 'SUPPLIER'; text: string; timestamp: string }> = [];

    let extractedQuote: VoiceCallResult['extractedQuote'] | undefined;

    if (language === 'hi-IN') {
      transcript.push({
        speaker: 'AI_AGENT',
        text: `नमस्ते! मैं Kirana Store से बोल रहा हूँ DukaanAI असिस्टेंट। क्या मुझे ${context.supplierName} में बात करने को मिलेगा?`,
        timestamp: '00:03',
      });
      transcript.push({
        speaker: 'SUPPLIER',
        text: `हाँ जी, बोलिए। क्या चाहिए आपको आज?`,
        timestamp: '00:09',
      });
      transcript.push({
        speaker: 'AI_AGENT',
        text: `हमें ${context.productName} के ${context.requestedQuantity} ${context.packLabel} चाहिए। आपका आज का क्या रेट और डिलीवरी टाइम है?`,
        timestamp: '00:17',
      });

      if (scenario === 'SHORTAGE') {
        transcript.push({
          speaker: 'SUPPLIER',
          text: `भाईसाहब, ${context.productName} का स्टॉक अभी गोडाउन में खत्म है। नया लॉट आने में 4 से 5 दिन लगेंगे।`,
          timestamp: '00:26',
        });
        transcript.push({
          speaker: 'AI_AGENT',
          text: `ठीक है, जानकारी के लिए धन्यवाद। हम दूसरे डिस्ट्रीब्यूटर से चेक कर लेते हैं।`,
          timestamp: '00:32',
        });
        extractedQuote = {
          productName: context.productName,
          packLabel: context.packLabel,
          unitsPerPack: 12,
          quotedPricePerPack: '0.00',
          normalizedPricePerStockUnit: '0.00',
          availablePacks: 0,
          leadTimeDays: 5,
          notes: 'स्टॉक उपलब्ध नहीं है (Out of Stock)',
          negotiationApplied: false,
        };
      } else {
        // Negotiated discount
        transcript.push({
          speaker: 'SUPPLIER',
          text: `नॉर्मल रेट ₹115 प्रति ${context.packLabel} है। कल दोपहर तक माल पहुँच जाएगा।`,
          timestamp: '00:25',
        });
        transcript.push({
          speaker: 'AI_AGENT',
          text: `हम नियमित ग्राहक हैं। अगर हम ${context.requestedQuantity} ${context.packLabel} का पक्का ऑर्डर दें, तो क्या ₹110 लग सकता है?`,
          timestamp: '00:33',
        });
        transcript.push({
          speaker: 'SUPPLIER',
          text: `चलो ठीक है, रमेश भाई की दुकान के लिए ₹110 लगा देंगे। 12 पैकेट प्रति बॉक्स। कल सुबह 10 बजे डिलीवरी पक्की।`,
          timestamp: '00:41',
        });
        transcript.push({
          speaker: 'AI_AGENT',
          text: `बहुत बढ़िया! कन्फर्म कर रहा हूँ: ${context.requestedQuantity} ${context.packLabel} @ ₹110 प्रति बॉक्स, डिलीवरी कल सुबह। शुक्रिया!`,
          timestamp: '00:48',
        });

        extractedQuote = {
          productName: context.productName,
          packLabel: context.packLabel,
          unitsPerPack: 12,
          quotedPricePerPack: '110.00',
          normalizedPricePerStockUnit: '9.17',
          availablePacks: 50,
          leadTimeDays: 1,
          notes: 'टेलीफोनिक वार्ता द्वारा ₹115 से घटकर ₹110 पर सहमति',
          negotiationApplied: true,
        };
      }
    } else if (language === 'mr-IN') {
      transcript.push({
        speaker: 'AI_AGENT',
        text: `नमस्कार! मी Kirana Store चा डिजिटल असिस्टंट बोलतोय. ${context.supplierName} मधील सेल्स प्रतिनिधी उपलब्ध आहेत का?`,
        timestamp: '00:03',
      });
      transcript.push({
        speaker: 'SUPPLIER',
        text: `हो, बोला काय पाहिजे होते?`,
        timestamp: '00:08',
      });
      transcript.push({
        speaker: 'AI_AGENT',
        text: `आम्हाला ${context.productName} चे ${context.requestedQuantity} ${context.packLabel} हवे आहेत. आजचा दर काय आहे?`,
        timestamp: '00:16',
      });
      transcript.push({
        speaker: 'SUPPLIER',
        text: `रेग्युलर दर ₹114 आहे. पण जर तुम्ही पूर्ण लॉट घेतला तर ₹109 ने देतो, उद्या सकाळी डिलिव्हरी होईल.`,
        timestamp: '00:25',
      });
      transcript.push({
        speaker: 'AI_AGENT',
        text: `उत्तम! कन्फर्म करत आहे: ${context.requestedQuantity} ${context.packLabel} @ ₹109, उद्या डिलिव्हरी. धन्यवाद!`,
        timestamp: '00:33',
      });

      extractedQuote = {
        productName: context.productName,
        packLabel: context.packLabel,
        unitsPerPack: 12,
        quotedPricePerPack: '109.00',
        normalizedPricePerStockUnit: '9.08',
        availablePacks: 60,
        leadTimeDays: 1,
        notes: 'मराठी संभाषणातून ₹109 विशेष घाऊक दर निश्चित',
        negotiationApplied: true,
      };
    } else {
      // English
      transcript.push({
        speaker: 'AI_AGENT',
        text: `Hello, this is DukaanAI on behalf of Kirana Store. Am I speaking with ${context.supplierName}?`,
        timestamp: '00:03',
      });
      transcript.push({
        speaker: 'SUPPLIER',
        text: `Yes, how can we help you today?`,
        timestamp: '00:08',
      });
      transcript.push({
        speaker: 'AI_AGENT',
        text: `We need ${context.requestedQuantity} ${context.packLabel} of ${context.productName}. Could you quote the wholesale price and delivery time?`,
        timestamp: '00:15',
      });
      transcript.push({
        speaker: 'SUPPLIER',
        text: `Standard price is ₹115. For an immediate order of ${context.requestedQuantity} packs, we can offer ₹111 with next-day morning delivery.`,
        timestamp: '00:24',
      });
      transcript.push({
        speaker: 'AI_AGENT',
        text: `Confirmed: ${context.requestedQuantity} ${context.packLabel} at ₹111/box with delivery tomorrow. Thank you.`,
        timestamp: '00:31',
      });

      extractedQuote = {
        productName: context.productName,
        packLabel: context.packLabel,
        unitsPerPack: 12,
        quotedPricePerPack: '111.00',
        normalizedPricePerStockUnit: '9.25',
        availablePacks: 40,
        leadTimeDays: 1,
        notes: 'Negotiated wholesale rate of ₹111/box via outbound voice call',
        negotiationApplied: true,
      };
    }

    const result: VoiceCallResult = {
      callId,
      mode: 'SIMULATED',
      language,
      supplierId: context.supplierId,
      supplierName: context.supplierName,
      phoneNumber: context.phoneNumber || '+91 98200 12345',
      purpose,
      startedAt,
      endedAt,
      transcript,
      extractedQuote,
      confirmedBySupplier: Boolean(extractedQuote && extractedQuote.availablePacks > 0),
    };

    this.callHistory.set(callId, result);
    return result;
  }

  getCall(callId: string): VoiceCallResult | undefined {
    return this.callHistory.get(callId);
  }
}

export const demoVoiceProvider = new DemoVoiceProvider();
