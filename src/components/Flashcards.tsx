import React, { useState, useMemo } from 'react';
import { useStore } from '@/store';
import { isBefore, startOfDay, parseISO } from 'date-fns';
import { BrainCircuit, RefreshCw, Check, X, Plus } from 'lucide-react';

export function Flashcards() {
  const { flashcards, topics, subjects, reviewFlashcard, addFlashcard, questionLogs } = useStore();
  const [showBack, setShowBack] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [newFront, setNewFront] = useState('');
  const [newBack, setNewBack] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');

  const today = startOfDay(new Date());

  // Prioritize flashcards:
  // 1. Due today or overdue
  // 2. Sort by topic performance (worst first)
  const dueCards = useMemo(() => {
    const due = flashcards.filter(card => {
      if (!card.nextReviewAt) return true;
      const reviewDate = startOfDay(parseISO(card.nextReviewAt));
      return isBefore(reviewDate, today) || reviewDate.getTime() === today.getTime();
    });

    // Calculate performance per topic
    const topicPerformance = new Map<string, number>();
    topics.forEach(t => {
      const logs = questionLogs.filter(q => q.topicId === t.id);
      if (logs.length === 0) {
        topicPerformance.set(t.id, 100);
      } else {
        const total = logs.reduce((acc, curr) => acc + curr.totalQuestions, 0);
        const correct = logs.reduce((acc, curr) => acc + curr.correctAnswers, 0);
        topicPerformance.set(t.id, total > 0 ? (correct / total) * 100 : 100);
      }
    });

    return due.sort((a, b) => {
      const perfA = topicPerformance.get(a.topicId) || 100;
      const perfB = topicPerformance.get(b.topicId) || 100;
      return perfA - perfB; // Ascending, worst first
    });
  }, [flashcards, topics, questionLogs, today]);

  const currentCard = dueCards[0];

  const handleReview = (quality: number) => {
    if (!currentCard) return;
    reviewFlashcard(currentCard.id, quality);
    setShowBack(false);
  };

  const handleAddCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopic || !newFront || !newBack) return;
    addFlashcard({ topicId: selectedTopic, front: newFront, back: newBack });
    setNewFront('');
    setNewBack('');
    setIsAdding(false);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex justify-between items-end">
        <div>
          <p className="text-zinc-400 mt-1">Repetição espaçada com prioridade para tópicos críticos.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          {isAdding ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? 'Cancelar' : 'Novo Card'}
        </button>
      </header>

      {isAdding && (
        <form onSubmit={handleAddCard} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 space-y-4 animate-in slide-in-from-top-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Tópico</label>
            <select 
              required
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm"
            >
              <option value="">Selecione...</option>
              {subjects.map(subject => (
                <optgroup key={subject.id} label={subject.name}>
                  {topics.filter(t => t.subjectId === subject.id).map(topic => (
                    <option key={topic.id} value={topic.id}>{topic.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Frente (Pergunta)</label>
            <textarea 
              required
              value={newFront}
              onChange={(e) => setNewFront(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm min-h-[80px]"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1 uppercase tracking-wider">Verso (Resposta)</label>
            <textarea 
              required
              value={newBack}
              onChange={(e) => setNewBack(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 text-zinc-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 text-sm min-h-[80px]"
            />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors">
              Salvar Card
            </button>
          </div>
        </form>
      )}

      {!isAdding && (
        <div className="flex flex-col items-center justify-center min-h-[400px]">
          {currentCard ? (
            <div className="w-full max-w-2xl">
              <div className="text-center mb-6">
                <span className="text-sm text-zinc-500 font-medium bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
                  {dueCards.length} cards pendentes hoje
                </span>
              </div>
              
              <div 
                className="bg-zinc-900 border border-zinc-800 rounded-3xl p-10 min-h-[300px] flex flex-col items-center justify-center text-center cursor-pointer transition-all hover:border-zinc-700 shadow-2xl"
                onClick={() => !showBack && setShowBack(true)}
              >
                <div className="text-xs text-zinc-500 uppercase tracking-widest mb-6 font-semibold">
                  {topics.find(t => t.id === currentCard.topicId)?.name}
                </div>
                
                <div className="text-2xl text-zinc-100 font-medium leading-relaxed">
                  {currentCard.front}
                </div>

                {showBack ? (
                  <div className="mt-8 pt-8 border-t border-zinc-800 w-full animate-in fade-in slide-in-from-bottom-4">
                    <div className="text-xl text-emerald-400 font-medium leading-relaxed">
                      {currentCard.back}
                    </div>
                  </div>
                ) : (
                  <div className="mt-12 text-sm text-zinc-500 flex items-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Clique para revelar a resposta
                  </div>
                )}
              </div>

              {showBack && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mt-8 animate-in fade-in slide-in-from-bottom-4">
                  <button onClick={() => handleReview(1)} className="bg-zinc-900 hover:bg-red-500/20 text-red-500 border border-zinc-800 hover:border-red-500/50 py-3 rounded-xl font-medium transition-colors text-sm">
                    Errei (1)
                  </button>
                  <button onClick={() => handleReview(3)} className="bg-zinc-900 hover:bg-amber-500/20 text-amber-500 border border-zinc-800 hover:border-amber-500/50 py-3 rounded-xl font-medium transition-colors text-sm">
                    Difícil (3)
                  </button>
                  <button onClick={() => handleReview(4)} className="bg-zinc-900 hover:bg-blue-500/20 text-blue-400 border border-zinc-800 hover:border-blue-500/50 py-3 rounded-xl font-medium transition-colors text-sm">
                    Bom (4)
                  </button>
                  <button onClick={() => handleReview(5)} className="bg-zinc-900 hover:bg-emerald-500/20 text-emerald-500 border border-zinc-800 hover:border-emerald-500/50 py-3 rounded-xl font-medium transition-colors text-sm">
                    Fácil (5)
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center flex flex-col items-center">
              <BrainCircuit className="w-16 h-16 text-zinc-800 mb-4" />
              <h3 className="text-xl font-semibold text-zinc-300">Tudo em dia!</h3>
              <p className="text-zinc-500 mt-2 max-w-sm">Você não tem flashcards pendentes para revisão hoje. Aproveite para adicionar novos cards ou avançar no edital.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
