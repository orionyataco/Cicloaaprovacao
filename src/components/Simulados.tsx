import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '@/store';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Trophy, Plus, X, Brain, Loader2, CheckCircle2, ChevronRight, AlertTriangle, Trash2, BrainCircuit, Share2, Users } from 'lucide-react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { GeneratedQuestion, SharedQuestion } from '@/store';

// Removido interface GeneratedQuestion local pois foi movida para o store.ts

export function Simulados() {
  const { simulados, addSimulado, deleteSimulado, subjects, topics, editalInfo, addFlashcard, addQuestionLog, logStudySession, autoGenerateTopicId, setAutoGenerateTopicId, followingIds, sharedQuestions, userProfile } = useStore();
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [score, setScore] = useState('');
  const [total, setTotal] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string|null>(null);
  const [convertedToFlashcard, setConvertedToFlashcard] = useState<Record<number, boolean>>({});
  const [showSubjectBreakdown, setShowSubjectBreakdown] = useState(false);
  const [manualSubjectScores, setManualSubjectScores] = useState<Record<string, { correct: string, total: string }>>({});

  // AI Generation State
  const [isGeneratingModalOpen, setIsGeneratingModalOpen] = useState(false);
  const [distribution, setDistribution] = useState<Record<string, number>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Active Exam State
  const [activeExam, setActiveExam] = useState<GeneratedQuestion[]|null>(null);
  const [userAnswers, setUserAnswers] = useState<Record<number, number>>({});
  const [examFinished, setExamFinished] = useState(false);
  const [examStartTime, setExamStartTime] = useState<number|null>(null);

  // Sharing State
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [questionToShare, setQuestionToShare] = useState<GeneratedQuestion|null>(null);
  const [friends, setFriends] = useState<{uid: string, name: string, username: string}[]>([]);
  const [isSharingLoading, setIsSharingLoading] = useState(false);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !score || !total) return;
    
    addSimulado({
      name,
      score: Number(score),
      total: Number(total),
      date: new Date().toISOString(),
      type: 'manual'
    });

    // Se houver breakdown por matéria, adiciona ao questionLog para refletir nos relatórios
    if (showSubjectBreakdown) {
      Object.entries(manualSubjectScores).forEach(([subjectId, results]) => {
        const res = results as { correct: string, total: string };
        if (res.correct && res.total) {
          // Encontra o primeiro tópico da matéria para atribuir os acertos
          const firstTopic = topics.find(t => t.subjectId === subjectId);
          if (firstTopic) {
            addQuestionLog({
              topicId: firstTopic.id,
              totalQuestions: Number(res.total),
              correctAnswers: Number(res.correct),
              errorReason: 'NONE'
            });
          }
        }
      });
    }
    
    setName('');
    setScore('');
    setTotal('');
    setManualSubjectScores({});
    setShowSubjectBreakdown(false);
    setIsAdding(false);
  };

  const handleDistributionChange = (subjectId: string, value: string) => {
    const num = parseInt(value) || 0;
    setDistribution(prev => ({ ...prev, [subjectId]: num }));
  };

  const totalRequestedQuestions = Object.values(distribution).reduce((a: number, b: number) => a + b, 0);

  const generateExam = useCallback(async (overrideDistribution?: Record<string, number>, targetTopicId?: string) => {
    const dist = overrideDistribution || distribution;
    const total = Object.values(dist).reduce((a: number, b: number) => a + b, 0);

    if (total === 0) {
      alert('Selecione pelo menos uma questão.');
      return;
    }

    setIsGenerating(true);
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY?.replace(/['"]/g, '').trim();
      if (!apiKey) {
        alert('API Key do Gemini não configurada.');
        setIsGenerating(false);
        return;
      }

      const genAI = new GoogleGenerativeAI(apiKey);
      // Tentativa 1: Flash Latest
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });
      
      const isCespe = editalInfo.banca.toLowerCase().includes('cespe') || editalInfo.banca.toLowerCase().includes('cebraspe');
      const promptType = isCespe ? 'Certo/Errado (2 alternativas)' : 'múltipla escolha (5 alternativas)';

      let subjectsWithTopics;
      if (targetTopicId) {
        const topic = topics.find(t => t.id === targetTopicId);
        const subject = subjects.find(s => s.id === topic?.subjectId);
        subjectsWithTopics = [{
          disciplina: subject?.name || 'Assunto',
          quantidade_questoes: 3,
          topicos_base: [topic?.name || 'Tema']
        }];
      } else {
        subjectsWithTopics = subjects
          .filter(s => dist[s.id] > 0)
          .map(s => ({
            disciplina: s.name,
            quantidade_questoes: dist[s.id],
            topicos_base: topics.filter(t => t.subjectId === s.id).map(t => t.name)
          }));
      }

      const prompt = `Gere um simulado de ${promptType} focado em concursos públicos para a banca ${editalInfo.banca || 'padrão'}.
Distribuição solicitada de questões:
${JSON.stringify(subjectsWithTopics, null, 2)}

Crie questões desafiadoras, focadas EXCLUSIVAMENTE nos tópicos listados para cada disciplina.
IMPORTANTE: Utilize PRIORITARIAMENTE os nomes de disciplinas e tópicos exatamente como fornecidos no JSON acima para os campos "subject" e "topic".

RETORNE UM JSON NO FORMATO:
[
  {
    "subject": "Nome da disciplina (exatamente como fornecido)",
    "topic": "Tópico abordado (exatamente como fornecido)",
    "text": "Enunciado da questão",
    "options": ["Opção A", "Opção B", ...],
    "correctIndex": 0,
    "explanation": "Explicação detalhada"
  }
]`;

      let response;
      try {
        const result = await model.generateContent(prompt);
        response = await result.response;
      } catch (err: any) {
        console.error('Primeira tentativa (1.5-flash) falhou:', err);
        const errMsg = err.message || '';
        if (errMsg.includes('API key') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('expired')) {
           throw new Error('CHAVE INVÁLIDA: A API Key do Gemini está expirada ou incorreta. Crie uma nova em aistudio.google.com/app/apikey e atualize o .env');
        }

        console.log('Modelo Flash principal falhou. Tentando modelo pro...');
        try {
          const fallbackModel = genAI.getGenerativeModel({ 
            model: "gemini-2.5-pro",
            generationConfig: { responseMimeType: "application/json" }
          });
          const result = await fallbackModel.generateContent(prompt);
          response = await result.response;
        } catch (fallbackErr: any) {
          console.error('Tentativa com 8b também falhou:', fallbackErr);
          throw new Error(`Falha na IA.\nErro modelo principal: ${errMsg}\nErro fallback: ${fallbackErr.message}`);
        }
      }
      const responseText = response.text();

      if (responseText) {
        const cleanText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const generatedQuestions = JSON.parse(cleanText) as GeneratedQuestion[];
        
        setActiveExam(generatedQuestions);
        setUserAnswers({});
        setExamFinished(false);
        setExamStartTime(Date.now());
        setIsGeneratingModalOpen(false);
      } else {
        throw new Error('Resposta vazia da IA');
      }
    } catch (error: any) {
      console.error('Erro ao gerar simulado:', error);
      let errorMsg = 'Erro ao gerar o simulado.';
      if (error.message?.includes('503')) errorMsg = 'IA Temporariamente Indisponível (Sobrecarregada). Tente novamente em alguns segundos.';
      else if (error.message?.includes('429')) errorMsg = 'Limite de uso da IA excedido. Tente novamente em um minuto.';
      else if (error.message?.includes('403') || error.message?.includes('CHAVE INVÁLIDA')) errorMsg = 'Erro de autenticação: API Key inválida ou expirada.';
      alert(`${errorMsg}\n\nDetalhes: ${error.message || ''}`);
    } finally {
      setIsGenerating(false);
    }
  }, [distribution, editalInfo.banca, subjects, topics]);

  useEffect(() => {
    if (autoGenerateTopicId) {
      const topic = topics.find(t => t.id === autoGenerateTopicId);
      if (topic) {
        generateExam({ [topic.subjectId]: 3 }, topic.id);
      }
      setAutoGenerateTopicId(null);
    }
  }, [autoGenerateTopicId, topics, generateExam, setAutoGenerateTopicId]);

  const finishExam = () => {
    if (!activeExam) return;
    
    let correctCount = 0;
    const subjectResults: Record<string, { total: number, correct: number }> = {};

    activeExam.forEach((q, index) => {
      const isCorrect = userAnswers[index] === q.correctIndex;
      if (isCorrect) {
        correctCount++;
      }

      // Track by topic for question logs
      // Busca a matéria de forma robusta (case-insensitive e trim)
      const subject = subjects.find(s => 
        s.name.trim().toLowerCase() === q.subject.trim().toLowerCase() ||
        s.name.toLowerCase().includes(q.subject.toLowerCase()) ||
        q.subject.toLowerCase().includes(s.name.toLowerCase())
      );

      if (subject) {
        // Busca o tópico dentro da matéria de forma robusta
        let topic = topics.find(t => 
          t.subjectId === subject.id && (
            t.name.trim().toLowerCase() === q.topic.trim().toLowerCase() ||
            t.name.toLowerCase().includes(q.topic.toLowerCase()) ||
            q.topic.toLowerCase().includes(t.name.toLowerCase())
          )
        );

        // Se não encontrar o tópico específico, atribui ao primeiro tópico da matéria
        // para garantir que o progresso seja contabilizado no dashboard
        if (!topic) {
          topic = topics.find(t => t.subjectId === subject.id);
        }

        if (topic) {
          if (!subjectResults[topic.id]) {
            subjectResults[topic.id] = { total: 0, correct: 0 };
          }
          subjectResults[topic.id].total++;
          if (isCorrect) {
            subjectResults[topic.id].correct++;
          }
        }
      }
    });

    // Log each topic result to question logs
    Object.entries(subjectResults).forEach(([topicId, result]) => {
      addQuestionLog({
        topicId,
        totalQuestions: result.total,
        correctAnswers: result.correct,
        errorReason: 'NONE'
      });
    });

    // Log study session duration
    if (examStartTime) {
      const durationSeconds = Math.floor((Date.now() - examStartTime) / 1000);
      // Log to the first topic found (or just log a general session if we had a general topic)
      // For now, let's log the duration to each topic proportionally? 
      // Or just log one session for the first topic to ensure it's counted in total hours.
      const firstTopicId = Object.keys(subjectResults)[0];
      if (firstTopicId) {
        logStudySession(firstTopicId, durationSeconds);
      }
    }

    addSimulado({
      name: `Simulado IA - ${format(new Date(), "dd/MM/yyyy HH:mm")}`,
      score: correctCount,
      total: activeExam.length,
      date: new Date().toISOString(),
      type: 'ai'
    });

    setExamFinished(true);
  };

  const handleConvertToFlashcard = (q: GeneratedQuestion, index: number) => {
    addFlashcard({
      topicId: topics.find(t => t.name === q.topic)?.id || topics[0]?.id || 't1',
      front: q.text,
      back: `Assunto: ${q.subject}\nResposta: ${q.options[q.correctIndex]}\n\nExplicação: ${q.explanation}`
    });
    setConvertedToFlashcard(prev => ({ ...prev, [index]: true }));
  };

  const openShareModal = (q: GeneratedQuestion) => {
    setQuestionToShare(q);
    setIsShareModalOpen(true);
    fetchFriends();
  };

  const fetchFriends = async () => {
    if (followingIds.length === 0) return;
    setIsSharingLoading(true);
    try {
      const q = query(collection(db, 'profiles'), where('uid', 'in', followingIds));
      const snap = await getDocs(q);
      const profiles = snap.docs.map(doc => ({
        uid: doc.id,
        name: doc.data().name,
        username: doc.data().username
      }));
      setFriends(profiles);
    } catch (err) {
      console.error('Erro ao buscar amigos para compartilhar:', err);
    } finally {
      setIsSharingLoading(false);
    }
  };

  const shareWithFriend = async (friendUid: string) => {
    if (!questionToShare || !auth.currentUser) return;
    
    try {
      await addDoc(collection(db, 'shared_questions'), {
        fromUid: auth.currentUser.uid,
        fromName: userProfile.name,
        toUid: friendUid,
        date: new Date().toISOString(),
        question: questionToShare,
        timestamp: serverTimestamp()
      });
      alert('Questão compartilhada com sucesso!');
      setIsShareModalOpen(false);
    } catch (err) {
      console.error('Erro ao compartilhar questão:', err);
      alert('Erro ao compartilhar.');
    }
  };

  const deleteSharedQuestion = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'shared_questions', id));
    } catch (err) {
      console.error('Erro ao excluir questão compartilhada:', err);
    }
  };

  if (isGenerating && !activeExam) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-8 animate-in fade-in duration-300">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin" />
          <Brain className="w-8 h-8 text-blue-400 absolute inset-0 m-auto animate-pulse" />
        </div>
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black text-zinc-100 tracking-tight">Gerando suas questões...</h2>
          <p className="text-zinc-500 font-medium">A IA do Ciclo está preparando o melhor material para você. Aguarde alguns segundos.</p>
          <div className="flex items-center justify-center gap-2 text-[10px] text-blue-400 font-bold uppercase tracking-widest pt-4">
             <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce" />
             <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
             <div className="w-1 h-1 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
             Processando
          </div>
        </div>
      </div>
    );
  }

  if (activeExam) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <header className="flex justify-between items-end border-b border-zinc-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold text-zinc-100 tracking-tight">Simulado e Questões IA</h1>
            <p className="text-zinc-400 mt-1">
              {examFinished ? 'Resultados do simulado' : `Questão ${Object.keys(userAnswers).length} de ${activeExam.length} respondidas`}
            </p>
          </div>
          <button 
            onClick={() => setActiveExam(null)}
            className="text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Sair do Simulado
          </button>
        </header>

        <div className="space-y-12">
          {activeExam.map((q, qIndex) => (
            <div key={qIndex} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 md:p-8">
              <div className="flex items-center gap-3 mb-4">
                <span className="bg-zinc-800 text-zinc-300 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider">
                  Questão {qIndex + 1}
                </span>
                <span className="text-sm text-emerald-400 font-medium">{q.subject}</span>
                <span className="text-sm text-zinc-500">• {q.topic}</span>
              </div>
              
              <p className="text-lg text-zinc-100 mb-8 leading-relaxed whitespace-pre-wrap">{q.text}</p>
              
              <div className="space-y-3">
                {q.options.map((opt, optIndex) => {
                  const isSelected = userAnswers[qIndex] === optIndex;
                  const isCorrect = q.correctIndex === optIndex;
                  const showResult = examFinished;
                  
                  let optionClass = "border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-300";
                  
                  if (showResult) {
                    if (isCorrect) optionClass = "border-emerald-500/50 bg-emerald-500/10 text-emerald-200";
                    else if (isSelected && !isCorrect) optionClass = "border-red-500/50 bg-red-500/10 text-red-200";
                    else optionClass = "border-zinc-800 bg-zinc-900/50 text-zinc-500 opacity-50";
                  } else if (isSelected) {
                    optionClass = "border-emerald-500 bg-emerald-500/10 text-emerald-200";
                  }

                  return (
                    <button
                      key={optIndex}
                      disabled={examFinished}
                      onClick={() => setUserAnswers(prev => ({ ...prev, [qIndex]: optIndex }))}
                      className={cn(
                        "w-full text-left p-4 rounded-xl border transition-all flex items-start gap-4",
                        optionClass,
                        !examFinished && "cursor-pointer"
                      )}
                    >
                      <div className={cn(
                        "w-6 h-6 rounded-full border flex items-center justify-center flex-shrink-0 mt-0.5",
                        showResult && isCorrect ? "border-emerald-500 bg-emerald-500 text-zinc-900" :
                        showResult && isSelected && !isCorrect ? "border-red-500 bg-red-500 text-zinc-900" :
                        isSelected ? "border-emerald-500 bg-emerald-500 text-zinc-900" : "border-zinc-600"
                      )}>
                        {showResult && isCorrect ? <CheckCircle2 className="w-4 h-4" /> : 
                         showResult && isSelected && !isCorrect ? <X className="w-4 h-4" /> : 
                         String.fromCharCode(65 + optIndex)}
                      </div>
                      <span className="leading-relaxed">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {examFinished && (
                <div className="mt-6 space-y-4">
                  <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-5 h-5 text-blue-400" />
                      <h4 className="font-semibold text-zinc-200">Explicação</h4>
                    </div>
                    <p className="text-zinc-400 text-sm leading-relaxed">{q.explanation}</p>
                  </div>

                  <div className="flex justify-end gap-3 pt-4">
                    <button
                      onClick={() => handleConvertToFlashcard(q, qIndex)}
                      disabled={convertedToFlashcard[qIndex]}
                      className={cn(
                        "flex-1 items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold transition-all flex border",
                        convertedToFlashcard[qIndex]
                          ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          : "bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border-blue-500/30"
                      )}
                    >
                      {convertedToFlashcard[qIndex] ? (
                        <>
                          <CheckCircle2 className="w-4 h-4" /> Flashcard Criado
                        </>
                      ) : (
                        <>
                          <BrainCircuit className="w-4 h-4" /> Criar Flashcard
                        </>
                      )}
                    </button>
                    
                    <button
                      onClick={() => openShareModal(q)}
                      className="flex-1 bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 border border-zinc-700/50 px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2"
                    >
                      <Share2 className="w-4 h-4" /> Compartilhar Questão
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {!examFinished && (
          <div className="sticky bottom-8 flex justify-end">
            <button
              onClick={finishExam}
              disabled={Object.keys(userAnswers).length < activeExam.length}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:text-zinc-500 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-2xl transition-all flex items-center gap-3"
            >
              Finalizar Simulado <ChevronRight className="w-6 h-6" />
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <p className="text-zinc-400 mt-1">Registre e acompanhe sua evolução em provas completas e questões avulsas.</p>
        </div>
        <div className="flex gap-3">
          {sharedQuestions.length > 0 && (
             <div className="flex items-center gap-2 px-3 py-1 bg-amber-500/10 border border-amber-500/20 rounded-full text-[10px] font-bold text-amber-500 uppercase tracking-widest animate-pulse">
                <Users className="w-3 h-3" /> {sharedQuestions.length} novas questões compartilhadas
             </div>
          )}
          <button 
            onClick={() => setIsGeneratingModalOpen(true)}
            className="bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Brain className="w-4 h-4" /> Gerar com IA
          </button>
          <button 
            onClick={() => setIsAdding(!isAdding)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
          >
            {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isAdding ? 'Cancelar' : 'Registrar Manual'}
          </button>
        </div>
      </header>

      {/* Shared Questions Section */}
      {sharedQuestions.length > 0 && (
        <section className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-amber-500 flex items-center gap-2">
              <Users className="w-5 h-5" /> Questões Compartilhadas com Você
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {sharedQuestions.map((shared) => (
              <div key={shared.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 hover:border-amber-500/30 transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px] text-zinc-400 font-bold">
                       {shared.fromName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Enviado por {shared.fromName}</p>
                      <p className="text-[8px] text-zinc-600">{format(parseISO(shared.date), "dd/MM 'às' HH:mm", { locale: ptBR })}</p>
                    </div>
                  </div>
                  <button onClick={() => deleteSharedQuestion(shared.id)} className="p-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
                <p className="text-sm text-zinc-100 line-clamp-2 mb-4 italic">"{shared.question.text}"</p>
                <button 
                  onClick={() => {
                    setActiveExam([shared.question]);
                    setUserAnswers({});
                    setExamFinished(false);
                    setExamStartTime(Date.now());
                  }}
                  className="w-full py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 text-xs font-bold rounded-lg border border-amber-500/20 transition-all flex items-center justify-center gap-2"
                >
                  <Brain className="w-3 h-3" /> Resolver agora
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Modal de Geração */}
      {isGeneratingModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-2">
                <Brain className="w-5 h-5 text-blue-400" />
                Gerar Simulado ou Questões
              </h2>
              <button onClick={() => setIsGeneratingModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            {subjects.length === 0 ? (
              <div className="text-center py-8 text-zinc-500">
                <AlertTriangle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Cadastre disciplinas no Edital primeiro.</p>
              </div>
            ) : (
              <>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                  <p className="text-sm text-zinc-400 mb-4">
                    Escolha a quantidade de questões por matéria:
                  </p>
                  {subjects.map(subject => (
                    <div key={subject.id} className="flex items-center justify-between bg-zinc-800/50 p-3 rounded-lg border border-zinc-800">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: subject.color }} />
                        <span className="text-sm font-medium text-zinc-200">{subject.name}</span>
                      </div>
                      <input
                        type="number"
                        min="0"
                        max="20"
                        value={distribution[subject.id] || ''}
                        onChange={(e) => handleDistributionChange(subject.id, e.target.value)}
                        placeholder="0"
                        className="w-16 bg-zinc-900 border border-zinc-700 text-zinc-200 rounded text-center py-1 focus:outline-none focus:border-blue-500"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t border-zinc-800 flex items-center justify-between">
                  <div className="text-sm text-zinc-400">
                    Total: <span className="text-zinc-100 font-bold">{totalRequestedQuestions}</span> questões
                  </div>
                  <button
                    onClick={generateExam}
                    disabled={isGenerating || totalRequestedQuestions === 0}
                    className="bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    {isGenerating ? 'Gerando...' : 'Gerar Agora'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isAdding && (
        <form onSubmit={handleAdd} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Nome da Prova</label>
              <input 
                type="text"
                required
                placeholder="Ex: Simulado TJ-SP 01"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Acertos</label>
              <input 
                type="number"
                required
                min="0"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Total de Questões</label>
              <input 
                type="number"
                required
                min="1"
                value={total}
                onChange={(e) => setTotal(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
              />
            </div>
          </div>

          <div className="bg-zinc-800/50 p-4 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Brain className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-zinc-100 uppercase tracking-widest">Desempenho por Matéria (Opcional)</h3>
              </div>
              <button 
                type="button" 
                onClick={() => setShowSubjectBreakdown(!showSubjectBreakdown)}
                className="text-xs text-blue-400 hover:text-blue-300 font-medium"
              >
                {showSubjectBreakdown ? 'Ocultar Detalhes' : 'Detalhar por Matéria'}
              </button>
            </div>
            <p className="text-[10px] text-zinc-500">Ao detalhar por matéria, esses resultados serão refletidos nos seus Relatórios de Performance.</p>
            
            {showSubjectBreakdown && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2">
                {subjects.map(subject => (
                  <div key={subject.id} className="flex items-center justify-between gap-4 p-3 bg-zinc-900/50 rounded-lg border border-zinc-800">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: subject.color }} />
                      <span className="text-xs text-zinc-300 truncate">{subject.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <input 
                        type="number" 
                        placeholder="Hits"
                        value={manualSubjectScores[subject.id]?.correct || ''}
                        onChange={(e) => setManualSubjectScores(prev => ({ 
                          ...prev, 
                          [subject.id]: { ...prev[subject.id], correct: e.target.value, total: prev[subject.id]?.total || '10' } 
                        }))}
                        className="w-12 bg-zinc-950 border border-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs text-center"
                      />
                      <span className="text-zinc-600">/</span>
                      <input 
                        type="number" 
                        placeholder="Total"
                        value={manualSubjectScores[subject.id]?.total || ''}
                        onChange={(e) => setManualSubjectScores(prev => ({ 
                          ...prev, 
                          [subject.id]: { ...prev[subject.id], total: e.target.value } 
                        }))}
                        className="w-12 bg-zinc-950 border border-zinc-800 text-zinc-200 rounded px-2 py-1 text-xs text-center"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
              Salvar
            </button>
          </div>
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {simulados.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(simulado => {
          const percentage = Math.round((simulado.score / simulado.total) * 100);
          let colorClass = "text-zinc-400";
          if (percentage >= 85) colorClass = "text-emerald-400";
          else if (percentage >= 70) colorClass = "text-blue-400";
          else colorClass = "text-red-400";

          return (
            <div key={simulado.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 transition-colors">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-2">
                  <Trophy className={`w-5 h-5 ${colorClass}`} />
                  <h3 className="font-semibold text-zinc-100">{simulado.name}</h3>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">
                    {format(parseISO(simulado.date), "dd MMM yyyy", { locale: ptBR })}
                  </span>
                  {confirmDelete === simulado.id ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-red-400 font-medium">Excluir?</span>
                      <button onClick={() => { deleteSimulado(simulado.id); setConfirmDelete(null); }} className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600">Sim</button>
                      <button onClick={() => setConfirmDelete(null)} className="text-xs bg-zinc-700 text-zinc-200 px-2 py-1 rounded hover:bg-zinc-600">Não</button>
                    </div>
                  ) : (
                    <button 
                      onClick={() => setConfirmDelete(simulado.id)}
                      className="text-zinc-500 hover:text-red-400 transition-colors p-1 rounded-md hover:bg-red-400/10"
                      title="Excluir simulado"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
              
              <div className="flex items-end gap-2">
                <span className={`text-4xl font-bold tracking-tighter ${colorClass}`}>
                  {percentage}%
                </span>
                <span className="text-sm text-zinc-500 mb-1">
                  ({simulado.score}/{simulado.total})
                </span>
              </div>
            </div>
          );
        })}
        
        {simulados.length === 0 && !isAdding && (
          <div className="col-span-full text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-2xl">
            Nenhum simulado registrado.
          </div>
        )}
      </div>
      {/* Share Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[999] p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-zinc-100 flex items-center gap-3">
                <Share2 className="w-6 h-6 text-blue-400" />
                Compartilhar Questão
              </h2>
              <button onClick={() => setIsShareModalOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <p className="text-zinc-400 text-sm mb-6 bg-zinc-950 p-4 rounded-xl border border-zinc-800 italic">
               "{questionToShare?.text.substring(0, 100)}..."
            </p>

            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
               <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Para qual amigo?</p>
               {isSharingLoading ? (
                 <div className="flex justify-center py-8">
                   <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                 </div>
               ) : friends.length > 0 ? (
                 friends.map(friend => (
                   <button 
                    key={friend.uid}
                    onClick={() => shareWithFriend(friend.uid)}
                    className="w-full flex items-center justify-between p-4 bg-zinc-800/30 hover:bg-blue-600/10 rounded-2xl border border-zinc-800 hover:border-blue-500/30 transition-all text-left group"
                   >
                     <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-xs font-bold text-zinc-400 group-hover:text-blue-400">
                          {friend.name.charAt(0)}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-zinc-100">{friend.name}</div>
                          <div className="text-[10px] text-zinc-500">@{friend.username}</div>
                        </div>
                     </div>
                     <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-blue-400" />
                   </button>
                 ))
               ) : (
                 <div className="text-center py-8">
                   <p className="text-zinc-500 text-sm italic">Você não segue nenhum amigo ainda.</p>
                   <p className="text-[10px] text-zinc-600 mt-1">Siga outros alunos na aba Rankings para compartilhar questões.</p>
                 </div>
               )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
