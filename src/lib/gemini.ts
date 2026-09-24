import { GoogleGenerativeAI } from '@google/generative-ai';

export function getApiKey(): string {
  // 1. Tenta chave personalizada salva pelo usuário no navegador
  const userKey = localStorage.getItem('ciclo_gemini_key')?.replace(/['"]/g, '').trim();
  if (userKey && userKey.length > 5) return userKey;

  // 2. Tenta chaves de ambiente .env
  const envKey = (import.meta.env.VITE_GEMINI_API_KEY_V2 || import.meta.env.VITE_GEMINI_API_KEY)?.replace(/['"]/g, '').trim();
  if (envKey && envKey !== 'sua_chave_gemini_aqui' && envKey.length > 5) {
    return envKey;
  }

  throw new Error('API Key do Gemini não encontrada. Por favor, insira sua chave da API do Gemini para ativar o AjudAÍ!');
}

export function hasValidGeminiKey(): boolean {
  try {
    const key = getApiKey();
    return !!key && key.length > 5;
  } catch {
    return false;
  }
}

// Lista de modelos ordenados por preferência e velocidade
const CANDIDATE_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-2.5-flash"
];

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function callGemini(prompt: string, retries = 3, delayMs = 2000): Promise<string> {
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);

  let lastError: any = null;

  // Tenta cada modelo disponível da família Gemini Flash / Pro
  for (const modelName of CANDIDATE_MODELS) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      
      for (let i = 0; i < retries; i++) {
        try {
          const result = await model.generateContent(prompt);
          const response = await result.response;
          const text = response.text();
          if (text && text.trim().length > 0) {
            return text;
          }
        } catch (err: any) {
          lastError = err;
          const isRateLimit = err?.message?.includes('429') || 
                              err?.message?.toLowerCase().includes('resource_exhausted') || 
                              err?.message?.toLowerCase().includes('quota') ||
                              err?.message?.toLowerCase().includes('limit');
                              
          if (isRateLimit && i < retries - 1) {
            console.warn(`Gemini (${modelName}) rate limit atingido. Aguardando ${delayMs}ms...`);
            await delay(delayMs);
            continue;
          }
          // Se for erro de modelo inexistente (404), vai para o próximo modelo na lista
          break;
        }
      }
    } catch (err: any) {
      lastError = err;
    }
  }

  throw lastError || new Error('Falha ao obter resposta da API do Gemini.');
}

export async function callGeminiJSON<T>(prompt: string): Promise<T> {
  const text = await callGemini(prompt);
  const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanText) as T;
}
