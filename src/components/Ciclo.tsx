import React, { useState, useMemo } from 'react';
import { useStore, ErrorReason } from '@/store';
import { isBefore, startOfDay, parseISO, getDay } from 'date-fns';
import { 
  CheckCircle2, 
  AlertTriangle, 
  Brain, 
  Target, 
  Clock, 
  BookMarked, 
  BookOpen, 
  X, 
  Save, 
  Play, 
  Loader2, 
  Sparkles, 
  Youtube, 
  Image,
  Lightbulb,
  Scale,
  Coins,
  User,
  BarChart2,
  FileText,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { callGemini, callGeminiJSON } from '@/lib/gemini';

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  idea: Lightbulb,
  lightbulb: Lightbulb,
  law: Scale,
  scale: Scale,
  target: Target,
  clock: Clock,
  money: Coins,
  coins: Coins,
  person: User,
  user: User,
  chart: BarChart2,
  barchart: BarChart2,
};

const renderVisualIcon = (iconName: string, className: string) => {
  const IconComponent = ICON_MAP[iconName?.toLowerCase()] || FileText;
  return <IconComponent className={className} />;
};

const THEME_MAP: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  blue: {
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/15',
    text: 'text-blue-400',
    iconBg: 'bg-blue-500/10'
  },
  emerald: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/15',
    text: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10'
  },
  green: {
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/15',
    text: 'text-emerald-400',
    iconBg: 'bg-emerald-500/10'
  },
  amber: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/15',
    text: 'text-amber-400',
    iconBg: 'bg-amber-500/10'
  },
  yellow: {
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/15',
    text: 'text-amber-400',
    iconBg: 'bg-amber-500/10'
  },
  rose: {
    bg: 'bg-rose-500/5',
    border: 'border-rose-500/15',
    text: 'text-rose-400',
    iconBg: 'bg-rose-500/10'
  },
  red: {
    bg: 'bg-rose-500/5',
    border: 'border-rose-500/15',
    text: 'text-rose-400',
    iconBg: 'bg-rose-500/10'
  },
  purple: {
    bg: 'bg-purple-500/5',
    border: 'border-purple-500/15',
    text: 'text-purple-400',
    iconBg: 'bg-purple-500/10'
  }
};

const getThemeClasses = (colorTheme: string) => {
  return THEME_MAP[colorTheme?.toLowerCase()] || THEME_MAP.purple;
};

export function Ciclo({ onViewChange }: { onViewChange: (view: any) => void }) {
  const { topics, subjects, addQuestionLog, questionLogs, currentCycleIndex, scheduleConfig, setActiveTopicId, setAutoGenerateTopicId } = useStore();
  const [selectedTopic, setSelectedTopic] = useState('');
  const [totalQuestions, setTotalQuestions] = useState('');
  const [correctAnswers, setCorrectAnswers] = useState('');
  const [errorReason, setErrorReason] = useState<ErrorReason>('NONE');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [infographicData, setInfographicData] = useState<{
    title: string;
    subtitle: string;
    items: { title: string; description: string; visualIcon?: string; colorTheme?: string }[];
    practicalExample?: string;
    comparison?: { correct: string; incorrect: string };
    goldTip: string;
  } | null>(null);
  const [isGeneratingInfographic, setIsGeneratingInfographic] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const today = startOfDay(new Date());

  const openRegisterModal = (topicId: string) => {
    setSelectedTopic(topicId);
    setActiveTopicId(topicId);
    setAiSummary(null);
    setInfographicData(null);
    setAiError(null);
    setIsModalOpen(true);
  };

  const handleGenerateInfographic = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    const subject = subjects.find(s => s.id === topic.subjectId);
    
    setIsGeneratingInfographic(true);
    setInfographicData(null);
    setAiError(null);
    try {
      const prompt = `Você é um designer de infográficos didáticos e professor tutor especialista em concursos. 
Crie o conteúdo estruturado e visual para um infográfico cirúrgico, prático e de facílima compreensão sobre o seguinte assunto de concurso público:
Materia: ${subject?.name || 'Geral'}
Assunto/Tópico: ${topic.name}

O infográfico deve ser muito didático, como as explicações ilustradas do NotebookLM. 
Retorne ESTRITAMENTE um objeto JSON válido (sem nenhuma outra palavra, introdução ou explicação), seguindo exatamente a estrutura abaixo:
{
  "title": "Título curto, prático e didático (máx 35 carac.)",
  "subtitle": "Subtítulo direto explicando o conceito em 1 frase simples (máx 60 carac.)",
  "items": [
    {
      "title": "Conceito 1 (máx 25 carac.)",
      "description": "Explicação visual simplificada (máx 80 carac.)",
      "visualIcon": "idea",
      "colorTheme": "blue"
    },
    {
      "title": "Conceito 2 (máx 25 carac.)",
      "description": "Explicação visual simplificada (máx 80 carac.)",
      "visualIcon": "law",
      "colorTheme": "purple"
    }
  ],
  "practicalExample": "Exemplo prático do dia a dia ou analogia lúdica de fácil compreensão para fixar (máx 90 carac.)",
  "comparison": {
    "correct": "Certo: Como cai ou o que é correto (máx 50 carac.)",
    "incorrect": "Pegadinha: O erro clássico da banca (máx 50 carac.)"
  },
  "goldTip": "Dica de ouro cirúrgica (máx 80 carac.)"
}

Para os campos "visualIcon", escolha um entre: "idea", "law", "target", "clock", "money", "person", "chart".
Para os campos "colorTheme", escolha um entre: "blue", "purple", "emerald", "amber", "rose".
Certifique-se de que a resposta seja um JSON bem-formed.`;

      const response = await callGeminiJSON<{
        title: string;
        subtitle: string;
        items: { title: string; description: string; visualIcon?: string; colorTheme?: string }[];
        practicalExample?: string;
        comparison?: { correct: string; incorrect: string };
        goldTip: string;
      }>(prompt);
      if (response && response.title && response.items) {
        setInfographicData(response);
      } else {
        setAiError('Não foi possível estruturar o infográfico.');
      }
    } catch (err: any) {
      console.error('Erro ao gerar infográfico:', err);
      const isQuotaError = err?.message?.includes('429') || 
                           err?.message?.toLowerCase().includes('resource_exhausted') || 
                           err?.message?.toLowerCase().includes('quota') ||
                           err?.message?.toLowerCase().includes('limit');
      if (isQuotaError) {
        setAiError('Limite de cota excedido! A chave de API gratuita do Gemini possui um limite de requisições por minuto. Por favor, aguarde 1 minuto e tente novamente.');
      } else {
        setAiError(`Erro ao gerar infográfico: ${err.message}`);
      }
    } finally {
      setIsGeneratingInfographic(false);
    }
  };

  const downloadInfographic = () => {
    const node = document.getElementById('infographic-container');
    if (!node) return;
    
    import('html-to-image').then((htmlToImage) => {
      htmlToImage.toPng(node, { cacheBust: true, backgroundColor: '#09090b', style: { borderRadius: '0px' } })
        .then((dataUrl) => {
          const link = document.createElement('a');
          const topicNameClean = topics.find(t => t.id === selectedTopic)?.name.toLowerCase().replace(/[^a-z0-9]/g, '_') || 'topic';
          link.download = `infografico-${topicNameClean}.png`;
          link.href = dataUrl;
          link.click();
        })
        .catch((err) => {
          console.error('Erro ao converter imagem:', err);
          alert('Erro ao converter o infográfico em imagem.');
        });
    });
  };

  const handleGenerateSummary = async (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    const subject = subjects.find(s => s.id === topic.subjectId);
    
    setIsGeneratingSummary(true);
    setAiSummary(null);
    setAiError(null);
    try {
      const prompt = `Você é um professor tutor especialista em concursos. Por favor, crie um resumo cirúrgico, estruturado e focado para revisão rápida sobre o seguinte assunto:
Materia: ${subject?.name || 'Geral'}
Assunto/Tópico: ${topic.name}

O resumo deve conter:
1. Resumo Teórico Direto (máximo 3 parágrafos curtos).
2. Tópicos de Lei Seca ou conceitos mais cobrados em provas (mencione os principais artigos ou termos se aplicável).
3. Uma dica estratégica "Fique Atento" para evitar pegadinhas comuns da banca.

Escreva em português do Brasil, utilizando formatação markdown limpa (negritos, listas e títulos simples). Seja prático e direto.`;
      
      const response = await callGemini(prompt);
      if (response) {
        setAiSummary(response);
      } else {
        setAiError('Não foi possível gerar o resumo.');
      }
    } catch (err: any) {
      console.error('Erro ao gerar resumo:', err);
      const isQuotaError = err?.message?.includes('429') || 
                           err?.message?.toLowerCase().includes('resource_exhausted') || 
                           err?.message?.toLowerCase().includes('quota') ||
                           err?.message?.toLowerCase().includes('limit');
      if (isQuotaError) {
        setAiError('Limite de cota excedido! A chave de API gratuita do Gemini possui um limite de requisições por minuto. Por favor, aguarde 1 minuto e tente novamente.');
      } else {
        setAiError(`Erro ao gerar resumo: ${err.message}`);
      }
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const handleYoutubeSearch = (topicId: string) => {
    const topic = topics.find(t => t.id === topicId);
    if (!topic) return;
    const subject = subjects.find(s => s.id === topic.subjectId);
    const query = `aula ${subject?.name || ''} ${topic.name}`;
    window.open(`https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`, '_blank');
  };

  // Memoização dos tópicos agendados para revisão hoje ou atrasados
  const dueTopics = useMemo(() => {
    return topics.filter(t => {
      if (!t.nextReviewAt) return false;
      const reviewDate = startOfDay(parseISO(t.nextReviewAt));
      return isBefore(reviewDate, today) || reviewDate.getTime() === today.getTime();
    });
  }, [topics, today]);

  // Memoização dos tópicos críticos para recuperação (desempenho abaixo de 70%)
  const recoveryTopics = useMemo(() => {
    const topicPerformance = topics.map(t => {
      const logs = questionLogs.filter(q => q.topicId === t.id);
      if (logs.length === 0) return { id: t.id, percentage: 100, total: 0 };
      const total = logs.reduce((acc, curr) => acc + curr.totalQuestions, 0);
      const correct = logs.reduce((acc, curr) => acc + curr.correctAnswers, 0);
      return { id: t.id, percentage: (correct / total) * 100, total };
    }).filter(t => t.total > 0);

    return [...topicPerformance]
      .sort((a, b) => a.percentage - b.percentage)
      .slice(0, 3)
      .filter(t => t.percentage < 70)
      .map(t => topics.find(topic => topic.id === t.id)!);
  }, [topics, questionLogs]);

  // Cálculo e memoização do ciclo de matérias do dia (evita recalcular em renderizações menores)
  const dayOfWeek = getDay(today);
  const isActiveToday = scheduleConfig.activeDays.includes(dayOfWeek);
  
  const cycleData = useMemo(() => {
    const hoursPerActiveDay = scheduleConfig.hoursPerDay;
    const result: { subject: typeof subjects[0]; topic: typeof topics[0] | undefined }[] = [];

    if (isActiveToday && subjects.length > 0) {
      const subjectsWithPending = subjects.filter(s =>
        topics.some(t => t.subjectId === s.id && t.status === 'NOT_READ')
      );

      if (subjectsWithPending.length > 0) {
        const usedSubjectIds = new Set<string>();
        let pointer = currentCycleIndex % subjects.length;
        let attempts = 0;
        const maxAttempts = subjects.length * hoursPerActiveDay;

        while (result.length < hoursPerActiveDay && attempts < maxAttempts) {
          const subject = subjects[pointer % subjects.length];
          pointer++;
          attempts++;

          if (usedSubjectIds.has(subject.id) && usedSubjectIds.size < subjectsWithPending.length) {
            continue;
          }

          const firstPendingTopic = topics.find(t => t.subjectId === subject.id && t.status === 'NOT_READ');
          if (!firstPendingTopic) {
            continue;
          }

          result.push({ subject, topic: firstPendingTopic });
          usedSubjectIds.add(subject.id);

          if (usedSubjectIds.size >= subjectsWithPending.length) {
            usedSubjectIds.clear();
          }
        }
      }
    }
    return result;
  }, [subjects, topics, currentCycleIndex, scheduleConfig, isActiveToday]);

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopic || !totalQuestions || !correctAnswers) return;
    
    addQuestionLog({
      topicId: selectedTopic,
      totalQuestions: parseInt(totalQuestions),
      correctAnswers: parseInt(correctAnswers),
      errorReason
    });

    setSelectedTopic('');
    setTotalQuestions('');
    setCorrectAnswers('');
    setErrorReason('NONE');
    setIsModalOpen(false);
    alert('Log de questões registrado com sucesso!');
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6">
        {/* Tasks for today */}
        <div className="space-y-6">
          {recoveryTopics.length > 0 && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-red-400" />
                <h2 className="text-lg font-semibold text-red-400">Revisão de Recuperação</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {recoveryTopics.map(topic => {
                  const subject = subjects.find(s => s.id === topic.subjectId);
                  return (
                    <button 
                      key={`rec-${topic.id}`} 
                      onClick={() => openRegisterModal(topic.id)}
                      className="flex items-center justify-between bg-zinc-900/50 p-4 rounded-xl border border-red-500/10 hover:border-red-500/40 transition-all text-left group"
                    >
                      <div>
                        <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-widest font-bold">{subject?.name}</div>
                        <div className="font-medium text-zinc-200 group-hover:text-white transition-colors">{topic.name}</div>
                      </div>
                      <div className="text-[10px] font-bold text-red-400 bg-red-400/10 px-2 py-1 rounded-md uppercase tracking-wider">
                        Crítico
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <BookMarked className="w-5 h-5 text-blue-500" />
              <h2 className="text-lg font-semibold text-zinc-100">Ciclo de Hoje (Teoria Pendente)</h2>
            </div>
            
            {isActiveToday ? (
              cycleData.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                  {cycleData.map((item, idx) => (
                    <div key={`cycle-group-${idx}`} className="space-y-3 p-4 bg-zinc-800/20 rounded-2xl border border-zinc-800/50">
                      <div className="flex items-center gap-2 px-1">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.subject.color }} />
                        <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest truncate">{item.subject.name}</span>
                      </div>
                      
                      {item.topic ? (
                        <button 
                          key={`topic-${item.topic.id}`} 
                          onClick={() => openRegisterModal(item.topic!.id)}
                          className="w-full flex items-center gap-3 bg-zinc-800/30 p-3 rounded-xl border border-zinc-800/50 group hover:border-blue-500/30 transition-all text-left"
                        >
                          <BookOpen className="w-4 h-4 text-zinc-600 group-hover:text-blue-400 transition-colors flex-shrink-0" />
                          <div className="font-medium text-zinc-300 text-sm group-hover:text-white transition-colors line-clamp-2">{item.topic.name}</div>
                        </button>
                      ) : (
                        <div className="text-xs text-zinc-600 italic px-1">
                          Todas as teorias concluídas!
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : subjects.length > 0 && topics.length > 0 && !topics.some(t => t.status === 'NOT_READ') ? (
                <div className="text-center py-10 flex flex-col items-center justify-center animate-in zoom-in-95 duration-500">
                  <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                  </div>
                  <h3 className="text-zinc-100 font-bold text-lg mb-2">Parabéns pelo estudo de hoje!</h3>
                  <p className="text-zinc-500 text-sm max-w-[280px]">
                    Você concluiu as teorias pendentes do dia. Descanse, e continue amanhã!
                  </p>
                </div>
              ) : (
                <div className="text-center py-6 text-zinc-500 text-sm">
                  Nenhuma matéria no ciclo. Cadastre-as no Edital.
                </div>
              )
            ) : (
              <div className="text-center py-6 text-zinc-500 text-sm italic">
                Hoje é seu dia de descanso! Aproveite para recarregar.
              </div>
            )}
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-5 h-5 text-emerald-500" />
              <h2 className="text-lg font-semibold text-zinc-100">Revisões Programadas (24/7/30)</h2>
            </div>
            
            {dueTopics.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {dueTopics.map(topic => {
                  const subject = subjects.find(s => s.id === topic.subjectId);
                  return (
                    <button 
                      key={`due-${topic.id}`} 
                      onClick={() => openRegisterModal(topic.id)}
                      className="flex items-center justify-between bg-zinc-800/30 p-4 rounded-xl border border-zinc-800/50 hover:border-emerald-500/30 transition-all text-left group gap-3"
                    >
                      <div className="min-w-0">
                        <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-widest font-bold truncate">{subject?.name}</div>
                        <div className="font-medium text-zinc-200 group-hover:text-white transition-colors text-sm truncate">{topic.name}</div>
                      </div>
                      <div className="text-[10px] text-zinc-400 flex items-center gap-1 font-bold uppercase tracking-wider flex-shrink-0">
                        <Clock className="w-3 h-3" />
                        R{topic.reviewCount + 1}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-zinc-500 flex flex-col items-center">
                <CheckCircle2 className="w-12 h-12 text-zinc-700 mb-3" />
                <p>Nenhuma revisão agendada para hoje.</p>
                <p className="text-sm mt-1">Avance na teoria no Meu Edital.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Error Notebook Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-500/10 rounded-lg">
                  <Brain className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-100">Central de Estudos</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Resumos e Videoaulas</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-grow custom-scrollbar">
              <div className="mb-6 p-4 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-zinc-500 mb-1 uppercase tracking-widest font-bold">
                    {subjects.find(s => s.id === topics.find(t => t.id === selectedTopic)?.subjectId)?.name}
                  </div>
                  <div className="font-bold text-zinc-100">{topics.find(t => t.id === selectedTopic)?.name}</div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold px-4 py-2 rounded-xl text-xs transition-all flex items-center gap-2"
                >
                  <Play className="w-3 h-3 fill-current" /> Iniciar Estudo
                </button>
              </div>

              <div className="mb-6">
                <button
                  onClick={() => {
                    setAutoGenerateTopicId(selectedTopic);
                    setIsModalOpen(false);
                    onViewChange('simulados');
                  }}
                  className="w-full bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-bold px-4 py-3 rounded-xl text-sm transition-all flex items-center justify-center gap-2"
                >
                  <Brain className="w-4 h-4" /> Gerar Questões Baseado no Assunto
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-2 mt-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => handleGenerateSummary(selectedTopic)}
                      disabled={isGeneratingSummary}
                      className="bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3.5 px-3 rounded-2xl transition-all shadow-lg shadow-purple-600/10 hover:shadow-purple-600/30 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-xs cursor-pointer group"
                    >
                      {isGeneratingSummary ? (
                        <Loader2 className="w-4 h-4 animate-spin text-purple-200" />
                      ) : (
                        <Sparkles className="w-4 h-4 text-purple-200 fill-purple-200 group-hover:animate-bounce" />
                      )}
                      {isGeneratingSummary ? 'Gerando...' : 'Gerar Resumo IA'}
                    </button>
                    
                    <button
                      onClick={() => handleYoutubeSearch(selectedTopic)}
                      className="bg-red-600 hover:bg-red-500 text-white font-bold py-3.5 px-3 rounded-2xl transition-all shadow-lg shadow-red-600/10 hover:shadow-red-600/30 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-xs cursor-pointer group"
                    >
                      <Youtube className="w-4 h-4 text-red-200 fill-red-200 group-hover:scale-110 transition-transform" />
                      Aulas no YouTube
                    </button>
                  </div>
                  
                  <button
                    onClick={() => handleGenerateInfographic(selectedTopic)}
                    disabled={isGeneratingInfographic}
                    className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white font-bold py-3.5 px-3 rounded-2xl transition-all shadow-lg shadow-blue-600/10 hover:shadow-blue-600/30 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 text-xs cursor-pointer group"
                  >
                    {isGeneratingInfographic ? (
                      <Loader2 className="w-4 h-4 animate-spin text-blue-200" />
                    ) : (
                      <Image className="w-4 h-4 text-blue-200 group-hover:rotate-6 transition-transform" />
                    )}
                    {isGeneratingInfographic ? 'Gerando Infográfico...' : 'Gerar Infográfico IA'}
                  </button>
                </div>
 
                {/* Mensagem de Erro da IA */}
                {aiError && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-red-500/10 via-rose-500/5 to-red-500/10 border border-red-500/25 rounded-2xl flex gap-3 items-start animate-in fade-in slide-in-from-top-2 duration-200">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="text-left">
                      <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider leading-none">Erro ou Limite de IA</h4>
                      <p className="text-[11px] text-zinc-300 mt-1.5 leading-relaxed font-medium">{aiError}</p>
                    </div>
                  </div>
                )}
 
                {/* Área de exibição do Resumo IA */}
                {(isGeneratingSummary || aiSummary) && (
                  <div className="mt-6 border-t border-zinc-800 pt-6 space-y-3 animate-in fade-in duration-300 text-left">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-purple-400 fill-purple-400 animate-pulse" />
                      Resumo Inteligente
                    </h3>
                    
                    {isGeneratingSummary ? (
                      <div className="flex flex-col items-center justify-center py-10 text-zinc-500 gap-3 bg-zinc-950/30 border border-zinc-800/50 rounded-2xl">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                        <span className="text-xs font-medium text-zinc-400">Sintetizando resumo teórico...</span>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-zinc-950/80 to-purple-950/10 border border-purple-500/20 p-5 rounded-2xl text-xs text-zinc-300 leading-relaxed max-h-[250px] overflow-y-auto pr-2 custom-scrollbar select-text selection:bg-purple-500/30 shadow-inner">
                        <div className="prose prose-invert max-w-none text-zinc-300 whitespace-pre-wrap">
                          {aiSummary}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Área de exibição do Infográfico */}
                {(isGeneratingInfographic || infographicData) && (
                  <div className="mt-6 border-t border-zinc-800 pt-6 space-y-4 animate-in fade-in duration-300 text-left">
                    <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                      <Image className="w-3.5 h-3.5 text-blue-400" />
                      Infográfico de Fixação
                    </h3>
                    
                    {isGeneratingInfographic ? (
                      <div className="flex flex-col items-center justify-center py-10 text-zinc-500 gap-2 bg-zinc-950/30 border border-zinc-800/50 rounded-2xl text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
                        <span className="text-xs font-medium text-zinc-400">Esboçando infográfico visual...</span>
                      </div>
                    ) : infographicData && (
                      <div className="space-y-4 text-center">
                        {/* Container imprimivel 1x1 */}
                        <div className="overflow-x-auto py-1">
                          <div 
                            id="infographic-container" 
                            className="p-4 bg-zinc-950 border border-zinc-800 rounded-3xl text-left relative overflow-hidden select-none w-[400px] h-[400px] flex flex-col justify-between mx-auto shadow-2xl"
                          >
                            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -z-10 pointer-events-none" />
                            <div className="absolute bottom-0 left-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -z-10 pointer-events-none" />

                            {/* Cabeçalho */}
                            <div className="border-b border-zinc-800/80 pb-2 flex-shrink-0 flex items-center justify-between">
                              <div>
                                <div className="text-[7px] text-zinc-500 mb-0.5 uppercase tracking-widest font-black">
                                  {subjects.find(s => s.id === topics.find(t => t.id === selectedTopic)?.subjectId)?.name}
                                </div>
                                <h2 className="text-xs font-black text-zinc-100 tracking-tight leading-tight uppercase">
                                  {infographicData.title}
                                </h2>
                                <p className="text-[8px] text-zinc-400 mt-0.5 leading-relaxed truncate max-w-[280px]">
                                  {infographicData.subtitle}
                                </p>
                              </div>
                              <div className="p-1.5 bg-purple-500/10 border border-purple-500/20 rounded-xl flex-shrink-0">
                                <Brain className="w-4 h-4 text-purple-400" />
                              </div>
                            </div>

                            {/* Corpo em Duas Colunas */}
                            <div className="grid grid-cols-2 gap-2 flex-grow py-2 items-stretch overflow-hidden">
                              {/* Coluna Esquerda: Conceitos + Exemplo */}
                              <div className="flex flex-col justify-between gap-1.5 h-full">
                                <div className="space-y-1.5">
                                  {infographicData.items.slice(0, 2).map((item, idx) => {
                                    const colors = getThemeClasses(item.colorTheme || 'purple');
                                    return (
                                      <div key={idx} className={cn("p-2 border rounded-xl flex gap-2 items-start", colors.bg, colors.border)}>
                                        <div className={cn("w-4 h-4 rounded-lg flex items-center justify-center mt-0.5 flex-shrink-0", colors.iconBg)}>
                                          {renderVisualIcon(item.visualIcon || 'idea', cn("w-2.5 h-2.5", colors.text))}
                                        </div>
                                        <div className="min-w-0">
                                          <h4 className="text-[9px] font-bold text-zinc-100 leading-none truncate">{item.title}</h4>
                                          <p className="text-[7.5px] text-zinc-400 mt-0.5 leading-tight">{item.description}</p>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                                
                                {infographicData.practicalExample && (
                                  <div className="p-2 bg-amber-500/5 border border-dashed border-amber-500/20 rounded-xl flex gap-1.5 items-start">
                                    <Sparkles className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                                    <div>
                                      <h4 className="text-[7.5px] font-bold text-amber-500 uppercase tracking-widest leading-none">Analogia Prática</h4>
                                      <p className="text-[7.5px] text-zinc-300 mt-0.5 leading-snug italic">"{infographicData.practicalExample}"</p>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Coluna Direita: Certo vs Errado + Dica de Ouro */}
                              <div className="flex flex-col justify-between gap-1.5 h-full">
                                {infographicData.comparison && (
                                  <div className="p-2 bg-zinc-900/30 border border-zinc-800/80 rounded-xl flex flex-col gap-1.5">
                                    <h4 className="text-[7.5px] font-black text-zinc-400 uppercase tracking-widest leading-none">Foco na Banca</h4>
                                    
                                    {/* Certo */}
                                    <div className="p-1.5 bg-emerald-500/5 border border-emerald-500/15 rounded-lg flex gap-1.5 items-start">
                                      <Check className="w-2.5 h-2.5 text-emerald-400 mt-0.5 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <span className="text-[7px] font-black text-emerald-400 uppercase leading-none block mb-0.5">Certo</span>
                                        <p className="text-[7px] text-zinc-300 leading-tight truncate">{infographicData.comparison.correct}</p>
                                      </div>
                                    </div>

                                    {/* Errado */}
                                    <div className="p-1.5 bg-rose-500/5 border border-rose-500/15 rounded-lg flex gap-1.5 items-start">
                                      <X className="w-2.5 h-2.5 text-rose-400 mt-0.5 flex-shrink-0" />
                                      <div className="min-w-0">
                                        <span className="text-[7px] font-black text-rose-400 uppercase leading-none block mb-0.5">Pegadinha</span>
                                        <p className="text-[7px] text-zinc-300 leading-tight truncate">{infographicData.comparison.incorrect}</p>
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {infographicData.goldTip && (
                                  <div className="p-2 bg-purple-500/5 border border-purple-500/15 rounded-xl flex gap-1.5 items-start">
                                    <AlertTriangle className="w-3.5 h-3.5 text-purple-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                      <h4 className="text-[7.5px] font-bold text-purple-400 uppercase tracking-widest leading-none">Dica de Ouro</h4>
                                      <p className="text-[7.5px] text-zinc-300 mt-0.5 leading-snug font-medium">{infographicData.goldTip}</p>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Rodapé */}
                            <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between text-[6px] text-zinc-600 font-black uppercase tracking-widest flex-shrink-0">
                              <span>Ciclo a Aprovação</span>
                              <span>Infográfico Inteligente 1x1</span>
                            </div>
                          </div>
                        </div>
                        
                        <button
                          onClick={downloadInfographic}
                          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 font-bold py-2.5 px-4 rounded-xl transition-all text-xs flex items-center justify-center gap-2 mx-auto cursor-pointer"
                        >
                          <Save className="w-4 h-4" /> Baixar Infográfico (PNG)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
