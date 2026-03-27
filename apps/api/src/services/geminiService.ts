import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import type { ExtractedReceipt } from '@expense-report/shared';

const apiKey = process.env.GEMINI_API_KEY;

// Gemini schema mapped from ExtractedReceiptSchema (Zod → Gemini ResponseSchema)
const receiptSchema = {
  type: SchemaType.OBJECT,
  properties: {
    merchantName: { type: SchemaType.STRING, description: 'Name of the merchant or vendor' },
    amount: { type: SchemaType.NUMBER, description: 'Total amount charged' },
    currency: {
      type: SchemaType.STRING,
      description: 'ISO 4217 3-letter currency code (e.g. USD, EUR)',
    },
    transactionDate: {
      type: SchemaType.STRING,
      description: 'Transaction date in YYYY-MM-DD format',
    },
  },
  required: ['merchantName', 'amount', 'currency', 'transactionDate'],
};

/**
 * Extract receipt data from a file buffer using Gemini 1.5 Flash.
 * Returns null if the API key is not configured or extraction fails.
 * Caller is responsible for presenting extracted data to user for review.
 */
export async function extractReceiptData(
  fileBuffer: Buffer,
  mimeType: string
): Promise<ExtractedReceipt | null> {
  if (!apiKey) {
    console.warn('GEMINI_API_KEY not configured — skipping AI extraction');
    return null;
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: receiptSchema,
      },
    });

    const base64Data = fileBuffer.toString('base64');
    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType,
        },
      },
      `Extract the following information from this receipt:
      - merchantName: The name of the store or vendor
      - amount: The total amount charged (as a number)
      - currency: The ISO 4217 currency code (3 letters, e.g., USD)
      - transactionDate: The date of the transaction in YYYY-MM-DD format
      
      Return only the JSON object with these four fields. If a field cannot be determined, use a reasonable default.`,
    ]);

    const text = result.response.text();
    const parsed = JSON.parse(text) as ExtractedReceipt;

    // Validate the response has the expected shape
    if (
      !parsed.merchantName ||
      typeof parsed.amount !== 'number' ||
      !parsed.currency ||
      !parsed.transactionDate
    ) {
      throw new Error('Incomplete extraction response from Gemini');
    }

    return parsed;
  } catch (error) {
    console.error('Gemini extraction failed:', error);
    return null;
  }
}
