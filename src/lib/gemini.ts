import { GoogleGenerativeAI } from '@google/generative-ai';

function getApiKey(): string {
  const key = (import.meta.env.VITE_GEMINI_API_KEY_V2 || import.meta.env.VITE_GEMINI_API_KEY)?.replace(/['"]/g, '').trim();
  if (!key) throw new Error('API Key do Gemini não configurada. Configure VITE_GEMINI_API_KEY ou VITE_GEMINI_API_KEY_V2 no .env');
  return key;
}

function createModel() {
  const genAI = new GoogleGenerativeAI(getApiKey());
  return genAI.getGenerativeModel({ model: "gemini-2.5-flash-lite" }, { apiVersion: 'v1beta' });
}

export async function callGemini(prompt: string): Promise<string> {
  const model = createModel();
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  if (!text) throw new Error('Resposta vazia da IA');
  return text;
}

export async function callGeminiJSON<T>(prompt: string): Promise<T> {
  const text = await callGemini(prompt);
  const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanText) as T;
}
