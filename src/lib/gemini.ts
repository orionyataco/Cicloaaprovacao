import { GoogleGenerativeAI } from '@google/generative-ai';

function getApiKey(): string {
  const key = (import.meta.env.VITE_GEMINI_API_KEY_V2 || import.meta.env.VITE_GEMINI_API_KEY)?.replace(/['"]/g, '').trim();
  if (!key) throw new Error('API Key do Gemini não configurada. Configure VITE_GEMINI_API_KEY || VITE_GEMINI_API_KEY_V2 no .env');
  return key;
}

function createModel() {
  const genAI = new GoogleGenerativeAI(getApiKey());
  return genAI.getGenerativeModel({ model: "gemini-3.5-flash" }, { apiVersion: 'v1beta' });
}

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callGemini(prompt: string, retries = 4, delayMs = 2500): Promise<string> {
  const model = createModel();
  let currentDelay = delayMs;
  
  for (let i = 0; i < retries; i++) {
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      if (!text) throw new Error('Resposta vazia da IA');
      return text;
    } catch (err: any) {
      const isRateLimit = err?.message?.includes('429') || 
                          err?.message?.toLowerCase().includes('resource_exhausted') || 
                          err?.message?.toLowerCase().includes('quota') ||
                          err?.message?.toLowerCase().includes('limit');
                          
      if (isRateLimit && i < retries - 1) {
        console.warn(`Gemini API rate limit atingido. Tentando novamente em ${currentDelay}ms... (Tentativa ${i + 1}/${retries})`);
        await delay(currentDelay);
        currentDelay *= 2; // Backoff exponencial
        continue;
      }
      throw err;
    }
  }
  throw new Error('Falha ao obter resposta da IA após múltiplas tentativas de retry.');
}

export async function callGeminiJSON<T>(prompt: string): Promise<T> {
  const text = await callGemini(prompt);
  const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanText) as T;
}
