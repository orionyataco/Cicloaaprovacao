import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Bot, 
  User, 
  Trash2, 
  Copy, 
  Check, 
  BookOpen, 
  Lightbulb, 
  RefreshCw, 
  Filter, 
  Scale, 
  Target, 
  ChevronRight,
  Brain,
  Key,
  KeyRound,
  AlertCircle,
  ExternalLink,
  X,
  Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';
import { callGemini, hasValidGeminiKey, getApiKey } from '@/lib/gemini';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: string;
  contextSubject?: string;
  contextTopic?: string;
  isError?: boolean;
}

// Sugestões rápidas de perguntas para os estudantes
const QUICK_SUGGESTIONS = [
  {
    title: 'Lei Penal no Tempo x Espaço',
    prompt: 'Qual a diferença entre lei penal no tempo e lei penal no espaço?',
    icon: Scale,
    color: 'from-amber-500/20 to-orange-500/10 border-amber-500/30 text-amber-400'
  },
  {
    title: 'Planejamento de Revisões',
    prompt: 'Como devo organizar meu ciclo de revisões para não esquecer as matérias estudadas?',
    icon: RefreshCw,
    color: 'from-emerald-500/20 to-teal-500/10 border-emerald-500/30 text-emerald-400'
  },
  {
    title: 'Técnicas de Memorização',
    prompt: 'Quais as melhores técnicas para memorizar prazos e leis secas sem dar branco na prova?',
    icon: Brain,
    color: 'from-purple-500/20 to-indigo-500/10 border-purple-500/30 text-purple-400'
  },
  {
    title: 'Estratégia para Bancas',
    prompt: 'Como identificar pegadinhas em questões da banca Cebraspe/CESPE?',
    icon: Target,
    color: 'from-cyan-500/20 to-blue-500/10 border-cyan-500/30 text-cyan-400'
  }
];

export function Ajudai() {
  const { subjects, topics } = useStore();

  // Estado da chave API do Gemini
  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      return getApiKey();
    } catch {
      return '';
    }
  });
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [tempKeyInput, setTempKeyInput] = useState('');

  // Carrega histórico de mensagens do localStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem('ciclo_ajudai_messages');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Erro ao carregar chat:', e);
    }
    return [
      {
        id: 'welcome-msg',
        sender: 'ai',
        text: 'Olá! Eu sou o **AjudAÍ**, seu tutor virtual inteligente alimentado pelo **Google Gemini AI**! 🤖✨\n\nEstou pronto para responder **qualquer dúvida de estudos**, explicar matérias do seu edital, comparar conceitos jurídicos, criar resumos ou dar dicas de prova. Como posso ajudar você agora?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ];
  });

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>('');
  const [selectedTopicId, setSelectedTopicId] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const chatEndRef = useRef<HTMLDivElement>(null);

  // Salva no localStorage quando o histórico muda
  useEffect(() => {
    try {
      localStorage.setItem('ciclo_ajudai_messages', JSON.stringify(messages));
    } catch (e) {
      console.error('Erro ao salvar chat:', e);
    }
  }, [messages]);

  // Rola para a mensagem mais recente
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // Salva chave do Gemini no localStorage
  const handleSaveApiKey = () => {
    const cleanKey = tempKeyInput.trim();
    if (!cleanKey) {
      alert('Por favor, insira uma chave de API válida.');
      return;
    }
    localStorage.setItem('ciclo_gemini_key', cleanKey);
    setApiKey(cleanKey);
    setIsKeyModalOpen(false);
    setTempKeyInput('');
  };

  const handleSend = async (textToSend?: string) => {
    const promptText = (textToSend || input).trim();
    if (!promptText || isTyping) return;

    // Se não houver chave configurada, solicita a chave ao usuário
    if (!hasValidGeminiKey() && !apiKey) {
      setIsKeyModalOpen(true);
      return;
    }

    const currentSubject = subjects.find(s => s.id === selectedSubjectId);
    const currentTopic = topics.find(t => t.id === selectedTopicId);

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substring(2, 9),
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      contextSubject: currentSubject?.name,
      contextTopic: currentTopic?.name
    };

    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setIsTyping(true);

    try {
      // Monta prompt detalhado com instrução de sistema para o modelo Google Gemini
      const geminiPrompt = `Você é o AjudAÍ, um tutor virtual didático, altamente inteligente e especializado em auxiliar estudantes para Concursos Públicos, Vestibulares e OAB no Brasil.
      
Dúvida do Estudante: "${promptText}"
${currentSubject ? `Matéria de Contexto do Edital: ${currentSubject.name}` : ''}
${currentTopic ? `Tópico Específico: ${currentTopic.name}` : ''}

Instruções para a sua resposta:
1. Responda de forma direta, clara, aprofundada e 100% precisa em relação à pergunta exata do estudante.
2. Utilize formatação Markdown rica (títulos, negritos, tópicos numerados, tabelas comparativas e mnemônicos de memorização quando útil).
3. Se for uma dúvida jurídica, cite os artigos de lei pertinentes (Constituição Federal, Código Penal, Código Civil, CPC, etc.).
4. Se for sobre planejamento de estudo ou bancas (Cebraspe, FGV, VUNESP, FCC), forneça orientações práticas.
5. Seja motivador e mantenha um tom de tutor profissional.`;

      const aiReplyText = await callGemini(geminiPrompt);

      const aiMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'ai',
        text: aiReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      console.error('Erro ao chamar o Gemini:', error);
      
      const errorMsg: ChatMessage = {
        id: Math.random().toString(36).substring(2, 9),
        sender: 'ai',
        isError: true,
        text: `⚠️ **Não foi possível conectar ao motor Gemini IA.**\n\n*Motivo:* ${error?.message || 'Chave da API inválida ou indisponível.'}\n\nClique no botão **"Chave Gemini"** no topo superior para inserir ou atualizar sua chave de API gratuita obtida no Google AI Studio.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Deseja limpar todo o histórico de conversas do AjudAÍ?')) {
      const resetMsg: ChatMessage = {
        id: 'welcome-reset',
        sender: 'ai',
        text: 'Histórico restaurado! Em que posso ajudar você agora? 🚀',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages([resetMsg]);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const availableTopics = topics.filter(t => t.subjectId === selectedSubjectId);
  const isKeyActive = hasValidGeminiKey();

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header do AjudAÍ */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-950/60 via-zinc-900 to-teal-950/40 border border-emerald-500/30 p-6 shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="w-48 h-48 text-emerald-400" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="p-3.5 bg-gradient-to-tr from-emerald-500 to-teal-400 text-zinc-950 rounded-2xl shadow-lg shadow-emerald-500/20">
              <Bot className="w-8 h-8 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-black tracking-tight text-white">AjudAÍ</h1>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Gemini IA Conectado
                </span>
              </div>
              <p className="text-xs text-zinc-400 mt-1 max-w-xl">
                Seu assistente virtual de inteligência artificial em tempo real (estilo ChatGPT) para tirar dúvidas, explicar matérias do edital e criar resumos sob medida.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start md:self-auto">
            {/* Botão de Configurar Chave Gemini */}
            <button
              onClick={() => {
                setTempKeyInput(localStorage.getItem('ciclo_gemini_key') || '');
                setIsKeyModalOpen(true);
              }}
              className={cn(
                "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all shadow-sm",
                isKeyActive
                  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/20"
                  : "bg-amber-500/20 border-amber-500/50 text-amber-300 hover:bg-amber-500/30 animate-pulse"
              )}
              title="Configurar Chave API do Gemini"
            >
              <Key className="w-3.5 h-3.5" />
              <span>{isKeyActive ? 'Gemini IA Ativo' : 'Configurar Chave Gemini'}</span>
            </button>

            {/* Botão de Limpar Chat */}
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-2 px-3 py-2 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-red-400 border border-zinc-700/50 rounded-xl text-xs font-semibold transition-all"
              title="Limpar Histórico de Mensagens"
            >
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">Limpar Chat</span>
            </button>
          </div>
        </div>

        {/* Filtro de Contexto do Edital */}
        <div className="mt-5 pt-4 border-t border-zinc-800/80 flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium shrink-0">
            <Filter className="w-3.5 h-3.5 text-emerald-400" />
            <span>Contexto:</span>
          </div>

          {/* Seletor de Matéria */}
          <select
            value={selectedSubjectId}
            onChange={(e) => {
              setSelectedSubjectId(e.target.value);
              setSelectedTopicId('');
            }}
            className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors max-w-[180px] sm:max-w-[220px] truncate"
          >
            <option value="">Todas as Matérias</option>
            {subjects.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Seletor de Tópico */}
          {selectedSubjectId && (
            <select
              value={selectedTopicId}
              onChange={(e) => setSelectedTopicId(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 transition-colors max-w-[180px] sm:max-w-[220px] truncate animate-in fade-in"
            >
              <option value="">Todos os Tópicos</option>
              {availableTopics.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}

          {(selectedSubjectId || selectedTopicId) && (
            <button
              onClick={() => {
                setSelectedSubjectId('');
                setSelectedTopicId('');
              }}
              className="text-[11px] text-emerald-400 hover:underline"
            >
              Limpar Filtro
            </button>
          )}
        </div>
      </div>

      {/* Caixa do Chat */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[560px]">
        {/* Lista de Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 custom-scrollbar">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex items-start gap-3 max-w-[88%] sm:max-w-[80%]",
                msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
              )}
            >
              {/* Avatar */}
              <div className={cn(
                "w-8 h-8 rounded-2xl flex items-center justify-center shrink-0 text-xs font-bold shadow-md",
                msg.sender === 'user' 
                  ? "bg-emerald-500 text-zinc-950" 
                  : msg.isError
                    ? "bg-red-500/20 border border-red-500/40 text-red-400"
                    : "bg-zinc-800 border border-zinc-700 text-emerald-400"
              )}>
                {msg.sender === 'user' ? <User className="w-4 h-4 stroke-[2.5]" /> : <Sparkles className="w-4 h-4" />}
              </div>

              {/* Balão da Mensagem */}
              <div className="group relative">
                {msg.contextSubject && (
                  <div className="text-[10px] text-emerald-400 font-semibold mb-1 flex items-center gap-1">
                    <BookOpen className="w-3 h-3" />
                    <span>{msg.contextSubject} {msg.contextTopic ? `> ${msg.contextTopic}` : ''}</span>
                  </div>
                )}

                <div className={cn(
                  "p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-sans shadow-md transition-all",
                  msg.sender === 'user'
                    ? "bg-emerald-600 text-white rounded-tr-none"
                    : msg.isError
                      ? "bg-red-950/40 border border-red-800/60 text-red-200 rounded-tl-none"
                      : "bg-zinc-950/90 border border-zinc-800 text-zinc-200 rounded-tl-none"
                )}>
                  {msg.text}
                </div>

                <div className={cn(
                  "flex items-center gap-2 mt-1 px-1 text-[10px] text-zinc-500",
                  msg.sender === 'user' ? "justify-end" : "justify-start"
                )}>
                  <span>{msg.timestamp}</span>
                  {msg.sender === 'ai' && !msg.isError && (
                    <button
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      className="opacity-0 group-hover:opacity-100 hover:text-zinc-300 transition-opacity flex items-center gap-1 ml-1"
                      title="Copiar texto"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-400" />
                          <span className="text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* Animação de Digitando */}
          {isTyping && (
            <div className="flex items-center gap-3 mr-auto max-w-[80%] animate-in fade-in">
              <div className="w-8 h-8 rounded-2xl bg-zinc-800 border border-zinc-700 text-emerald-400 flex items-center justify-center shrink-0">
                <Sparkles className="w-4 h-4 animate-spin text-emerald-400" />
              </div>
              <div className="bg-zinc-950 border border-zinc-800 p-4 rounded-2xl rounded-tl-none text-xs text-zinc-400 flex items-center gap-2 shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                <span className="ml-2 font-medium">O Google Gemini IA está processando sua dúvida...</span>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Sugestões Rápidas */}
        {messages.length <= 3 && !isTyping && (
          <div className="px-4 py-2 border-t border-zinc-800/60 bg-zinc-950/40">
            <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400" />
              <span>Perguntas Sugeridas:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {QUICK_SUGGESTIONS.map((item, idx) => {
                const IconComp = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => handleSend(item.prompt)}
                    className={cn(
                      "p-2.5 rounded-xl border bg-gradient-to-r text-left transition-all hover:scale-[1.01] active:scale-[0.99] flex items-center justify-between group",
                      item.color
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-2">
                      <IconComp className="w-4 h-4 shrink-0" />
                      <div className="truncate text-xs font-semibold">{item.title}</div>
                    </div>
                    <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Entrada de Mensagem */}
        <div className="p-3 sm:p-4 border-t border-zinc-800 bg-zinc-950 shrink-0">
          <div className="relative flex items-end gap-2 bg-zinc-900 border border-zinc-800 focus-within:border-emerald-500/80 rounded-2xl p-2 transition-colors">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Faça qualquer pergunta sobre a sua matéria ou edital ao Gemini IA... (Enter para enviar)"
              rows={1}
              className="w-full bg-transparent text-xs sm:text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none resize-none max-h-32 min-h-[38px] py-2 px-2 custom-scrollbar"
            />
            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || isTyping}
              className="p-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 disabled:hover:bg-emerald-500 text-zinc-950 font-bold rounded-xl transition-all shadow-md shrink-0 active:scale-95"
              title="Enviar mensagem"
            >
              <Send className="w-4 h-4 fill-current ml-0.5" />
            </button>
          </div>
          <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-zinc-500">
            <span>Dica: Use <strong>Shift + Enter</strong> para quebrar linha.</span>
            <span>AjudAÍ • Motor Google Gemini AI Oficial</span>
          </div>
        </div>
      </div>

      {/* Modal de Configuração da Chave da API do Gemini */}
      {isKeyModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 relative">
            <button
              onClick={() => setIsKeyModalOpen(false)}
              className="absolute top-4 right-4 text-zinc-500 hover:text-white p-1 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3">
              <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-2xl border border-emerald-500/30">
                <KeyRound className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Chave da API do Gemini</h3>
                <p className="text-xs text-zinc-400">Ative o motor de inteligência artificial do Google</p>
              </div>
            </div>

            <p className="text-xs text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded-2xl border border-zinc-800">
              O <strong>AjudAÍ</strong> utiliza a API gratuita do <strong>Google Gemini</strong> para gerar respostas em tempo real idênticas ao ChatGPT.
            </p>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 block">Sua Chave API (API Key):</label>
              <input
                type="password"
                value={tempKeyInput}
                onChange={(e) => setTempKeyInput(e.target.value)}
                placeholder="Cole sua API Key do Gemini aqui (AIzaSy...)"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] pt-1">
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:underline flex items-center gap-1 font-medium"
              >
                <span>Obter chave gratuita no Google AI Studio</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setIsKeyModalOpen(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-semibold transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveApiKey}
                className="px-5 py-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-xl text-xs transition-colors shadow-lg shadow-emerald-500/20"
              >
                Salvar Chave
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
