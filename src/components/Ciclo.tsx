import React, { useState } from 'react';
import { useStore, ErrorReason } from '@/store';
import { isBefore, startOfDay, format, parseISO, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CheckCircle2, AlertTriangle, Brain, Target, Clock, BookMarked, BookOpen, X, Save, Play } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Ciclo({ onViewChange }: { onViewChange: (view: any) => void }) {
  const { topics, subjects, addQuestionLog, questionLogs, currentCycleIndex, scheduleConfig, setActiveTopicId, setAutoGenerateTopicId } = useStore();
  const [selectedTopic, setSelectedTopic] = useState('');
  const [totalQuestions, setTotalQuestions] = useState('');
  const [correctAnswers, setCorrectAnswers] = useState('');
  const [errorReason, setErrorReason] = useState<ErrorReason>('NONE');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const today = startOfDay(new Date());

  const openRegisterModal = (topicId: string) => {
    setSelectedTopic(topicId);
    setActiveTopicId(topicId);
    setIsModalOpen(true);
  };

  // Topics due for review today or overdue
  const dueTopics = topics.filter(t => {
    if (!t.nextReviewAt) return false;
    const reviewDate = startOfDay(parseISO(t.nextReviewAt));
    return isBefore(reviewDate, today) || reviewDate.getTime() === today.getTime();
  });

  // Identify recovery topics (worst 3 performance)
  const topicPerformance = topics.map(t => {
    const logs = questionLogs.filter(q => q.topicId === t.id);
    if (logs.length === 0) return { id: t.id, percentage: 100, total: 0 };
    const total = logs.reduce((acc, curr) => acc + curr.totalQuestions, 0);
    const correct = logs.reduce((acc, curr) => acc + curr.correctAnswers, 0);
    return { id: t.id, percentage: (correct / total) * 100, total };
  }).filter(t => t.total > 0);

  const recoveryTopics = [...topicPerformance]
    .sort((a, b) => a.percentage - b.percentage)
    .slice(0, 3)
    .filter(t => t.percentage < 70) // Only if below 70%
    .map(t => topics.find(topic => topic.id === t.id)!);

  // Calculate subjects and their pending topics for today based on cycle
  // IMPORTANTE: O ciclo distribui matérias DIFERENTES a cada slot.
  // Ao concluir um assunto, o próximo slot será de outra matéria (round-robin).
  const dayOfWeek = getDay(today);
  const isActiveToday = scheduleConfig.activeDays.includes(dayOfWeek);
  const hoursPerActiveDay = scheduleConfig.hoursPerDay;

  const cycleData: { subject: typeof subjects[0]; topic: typeof topics[0] | undefined }[] = [];
  if (isActiveToday && subjects.length > 0) {
    // Filtra matérias que ainda têm tópicos pendentes (NOT_READ)
    const subjectsWithPending = subjects.filter(s =>
      topics.some(t => t.subjectId === s.id && t.status === 'NOT_READ')
    );

    if (subjectsWithPending.length > 0) {
      const usedSubjectIds = new Set<string>();
      let pointer = currentCycleIndex % subjects.length;
      let attempts = 0;
      const maxAttempts = subjects.length * hoursPerActiveDay; // evitar loop infinito

      while (cycleData.length < hoursPerActiveDay && attempts < maxAttempts) {
        const subject = subjects[pointer % subjects.length];
        pointer++;
        attempts++;

        // Pula matérias já adicionadas neste round (garante variedade)
        // Só permite repetir quando todas as matérias com pendências já apareceram
        if (usedSubjectIds.has(subject.id) && usedSubjectIds.size < subjectsWithPending.length) {
          continue;
        }

        // Pula matérias sem tópicos pendentes
        const firstPendingTopic = topics.find(t => t.subjectId === subject.id && t.status === 'NOT_READ');
        if (!firstPendingTopic) {
          continue;
        }

        cycleData.push({ subject, topic: firstPendingTopic });
        usedSubjectIds.add(subject.id);

        // Se todas as matérias com pendências já foram usadas, reseta para permitir repetições
        if (usedSubjectIds.size >= subjectsWithPending.length) {
          usedSubjectIds.clear();
        }
      }
    }
  }

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
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <Brain className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-zinc-100">Registrar Desempenho</h2>
                  <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Lançar resultados</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6">
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

              <form onSubmit={handleLogSubmit} className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Total Questões</label>
                    <input 
                      type="number" 
                      min="1"
                      required
                      placeholder="0"
                      value={totalQuestions}
                      onChange={(e) => setTotalQuestions(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Acertos</label>
                    <input 
                      type="number" 
                      min="0"
                      max={totalQuestions || undefined}
                      required
                      placeholder="0"
                      value={correctAnswers}
                      onChange={(e) => setCorrectAnswers(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 text-zinc-200 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-sm transition-all"
                    />
                  </div>
                </div>

                {totalQuestions && correctAnswers && parseInt(totalQuestions) > parseInt(correctAnswers) && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="block text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">Motivo Principal do Erro</label>
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { id: 'ATTENTION', label: 'Falta de Atenção', color: 'text-amber-400' },
                        { id: 'UNSEEN', label: 'Matéria Não Vista', color: 'text-blue-400' },
                        { id: 'TRICK', label: 'Pegadinha da Banca', color: 'text-red-400' }
                      ].map((reason) => (
                        <button
                          key={reason.id}
                          type="button"
                          onClick={() => setErrorReason(reason.id as ErrorReason)}
                          className={cn(
                            "flex items-center justify-between px-4 py-3 rounded-xl border transition-all text-sm font-medium",
                            errorReason === reason.id 
                              ? "bg-blue-500/10 border-blue-500/50 text-blue-400" 
                              : "bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700"
                          )}
                        >
                          {reason.label}
                          {errorReason === reason.id && <CheckCircle2 className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 mt-4"
                >
                  <Save className="w-5 h-5" /> Registrar Desempenho
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
