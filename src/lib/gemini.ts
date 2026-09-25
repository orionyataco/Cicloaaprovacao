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

  throw new Error('API Key do Gemini não encontrada. Por favor, insira sua chave da API do Gemini para ativar os recursos de IA!');
}

export function hasValidGeminiKey(): boolean {
  try {
    const key = getApiKey();
    return !!key && key.length > 5;
  } catch {
    return false;
  }
}

// Modelos estáveis ordenados por preferência e velocidade (atualizado set/2026)
const CANDIDATE_MODELS = [
  'gemini-3.5-flash',       // Estável, rápido, alto throughput
  'gemini-3.5-flash-lite',  // Estável, mais econômico
  'gemini-3.8-flash',       // Mais inteligente, nova geração
  'gemini-2.5-flash',       // Fallback legado, ainda disponível
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',  // Fallback legado
];

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRateLimitError(err: any): boolean {
  const msg = err?.message?.toLowerCase() || '';
  return msg.includes('429') || msg.includes('resource_exhausted') || msg.includes('quota') || msg.includes('limit');
}

function isOverloadError(err: any): boolean {
  const msg = err?.message?.toLowerCase() || '';
  return msg.includes('503') || msg.includes('overload') || msg.includes('high demand') || msg.includes('unavailable');
}

export async function callGemini(prompt: string, retries = 3, delayMs = 1500): Promise<string> {
  const apiKey = getApiKey();
  const genAI = new GoogleGenerativeAI(apiKey);
  let lastError: any = null;

  for (const modelName of CANDIDATE_MODELS) {
    let currentDelay = delayMs;
    const model = genAI.getGenerativeModel({ model: modelName });

    for (let i = 0; i < retries; i++) {
      try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();
        if (text && text.trim().length > 0) {
          return text;
        }
        throw new Error('Resposta vazia da IA');
      } catch (err: any) {
        lastError = err;

        if (isOverloadError(err)) {
          if (i < retries - 1) {
            console.warn(`[Gemini] Modelo ${modelName} sobrecarregado (503). Aguardando ${currentDelay}ms...`);
            await delay(currentDelay);
            currentDelay += 1000;
            continue;
          }
          console.warn(`[Gemini] Modelo ${modelName} indisponível após ${retries} tentativas. Tentando próximo modelo...`);
          break;
        }

        if (isRateLimitError(err)) {
          if (i < retries - 1) {
            console.warn(`[Gemini] Rate limit (429) em ${modelName}. Aguardando ${currentDelay}ms...`);
            await delay(currentDelay);
            currentDelay *= 2;
            continue;
          }
          console.warn(`[Gemini] Cota esgotada em ${modelName}. Tentando próximo modelo...`);
          break;
        }

        // Se for modelo não encontrado ou erro inesperado, tenta próximo da cadeia
        break;
      }
    }
  }

  throw (
    lastError ||
    new Error('Todos os modelos Gemini estão temporariamente indisponíveis. Tente novamente em alguns instantes.')
  );
}

export async function callGeminiJSON<T>(prompt: string): Promise<T> {
  const text = await callGemini(prompt);
  const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(cleanText) as T;
}
