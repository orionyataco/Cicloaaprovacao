import React, { useState, useEffect } from 'react';
import { Brain, CheckCircle2, X, BookOpen, GraduationCap, RefreshCw, Loader2, ExternalLink, UserPlus, Trophy, Sparkles, ArrowRight } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { cn } from '@/lib/utils';

interface PublicQuestion {
  subject: string;
  topic: string;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface PublicQuestionData {
  fromName: string;
  fromAvatar: string | null;
  question: PublicQuestion;
  date: string;
  views: number;
  solves: number;
}

export function SharedQuestionView({ questionId, onGoToSignup, onGoToLogin }: { 
  questionId: string;
  onGoToSignup: () => void;
  onGoToLogin: () => void;
}) {
  const [data, setData] = useState<PublicQuestionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [showCTA, setShowCTA] = useState(false);

  useEffect(() => {
    const fetchQuestion = async () => {
      try {
        const docRef = doc(db, 'public_questions', questionId);
        const snap = await getDoc(docRef);
        
        if (!snap.exists()) {
          setError('Questão não encontrada ou o link expirou.');
          return;
        }

        const questionData = snap.data() as PublicQuestionData;
        setData(questionData);

        // Incrementa visualizações
        try {
          await updateDoc(docRef, { views: increment(1) });
        } catch (_) {
          // silently fail - visitor may not have write permissions
        }
      } catch (err) {
        console.error('Erro ao buscar questão compartilhada:', err);
        setError('Não foi possível carregar a questão. Tente novamente mais tarde.');
      } finally {
        setLoading(false);
      }
    };

    fetchQuestion();
  }, [questionId]);

  const handleAnswer = (index: number) => {
    if (isRevealed) return;
    setSelectedAnswer(index);
  };

  const handleReveal = async () => {
    if (selectedAnswer === null) return;
    setIsRevealed(true);

    // Incrementa resoluções
    try {
      const docRef = doc(db, 'public_questions', questionId);
      await updateDoc(docRef, { solves: increment(1) });
    } catch (_) {
      // silently fail
    }

    // Mostra CTA após 2 segundos
    setTimeout(() => setShowCTA(true), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/10 rounded-full blur-[120px] -z-10" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[120px] -z-10" />
        <div className="relative w-24 h-24 mb-6">
          <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full animate-spin border-t-emerald-500" />
          <div className="absolute inset-2 border-4 border-blue-500/10 rounded-full animate-spin border-t-blue-500" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }} />
        </div>
        <h2 className="text-xl font-bold text-zinc-100 animate-pulse">Carregando questão...</h2>
        <p className="text-zinc-500 text-sm mt-2">Aguarde um instante.</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#09090b] flex flex-col items-center justify-center p-4">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-red-600/5 rounded-full blur-[120px] -z-10" />
        <div className="w-full max-w-md text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center">
            <X className="w-10 h-10 text-red-400" />
          </div>
          <h2 className="text-2xl font-bold text-zinc-100 mb-3">Oops!</h2>
          <p className="text-zinc-400 mb-8">{error || 'Questão não encontrada.'}</p>
          <button
            onClick={onGoToSignup}
            className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/20 inline-flex items-center gap-2"
          >
            <UserPlus className="w-5 h-5" />
            Criar conta no Ciclo a Aprovação
          </button>
        </div>
      </div>
    );
  }

  const isCorrect = selectedAnswer === data.question.correctIndex;

  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-100 selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Background Glow */}
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-emerald-600/5 rounded-full blur-[120px] -z-10 pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-blue-600/5 rounded-full blur-[120px] -z-10 pointer-events-none" />

      {/* Header */}
      <header className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <div className="absolute inset-0 border-2 border-dashed border-emerald-500/30 rounded-full animate-[spin_10s_linear_infinite]" />
              <BookOpen className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-tight bg-gradient-to-r from-emerald-400 to-blue-500 bg-clip-text text-transparent">
                Ciclo a Aprovação
              </h1>
              <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Questão Compartilhada</p>
            </div>
          </div>
          <button
            onClick={onGoToLogin}
            className="text-xs text-zinc-400 hover:text-emerald-400 transition-colors font-medium flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-zinc-900 border border-transparent hover:border-zinc-800"
          >
            Já tenho conta <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-8 pb-32">
        {/* Sender Card */}
        <div className="flex items-center gap-4 mb-8 p-4 bg-zinc-900/50 rounded-2xl border border-zinc-800">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-emerald-500/20 to-blue-500/20 border border-zinc-700 flex items-center justify-center shrink-0 overflow-hidden">
            {data.fromAvatar ? (
              <img src={data.fromAvatar} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="text-lg font-bold text-emerald-400">{data.fromName.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <div>
            <p className="text-sm text-zinc-300">
              <span className="font-bold text-zinc-100">{data.fromName}</span> compartilhou uma questão com você
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Mostre que você consegue resolver! 🎯</p>
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden">
          {/* Question Header */}
          <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3 bg-zinc-900/80">
            <span className="bg-blue-500/10 text-blue-400 text-xs font-bold px-3 py-1.5 rounded-full uppercase tracking-wider border border-blue-500/20">
              {data.question.subject}
            </span>
            <span className="text-sm text-zinc-500">• {data.question.topic}</span>
          </div>

          {/* Question Text */}
          <div className="px-6 py-6">
            <p className="text-base sm:text-lg text-zinc-100 leading-relaxed whitespace-pre-wrap">
              {data.question.text}
            </p>
          </div>

          {/* Options */}
          <div className="px-6 pb-6 space-y-3">
            {data.question.options.map((opt, index) => {
              const isSelected = selectedAnswer === index;
              const isCorrectOpt = data.question.correctIndex === index;

              let optionClass = "border-zinc-800 bg-zinc-950/50 hover:bg-zinc-800/70 text-zinc-300 cursor-pointer";

              if (isRevealed) {
                if (isCorrectOpt) {
                  optionClass = "border-emerald-500/50 bg-emerald-500/10 text-emerald-200";
                } else if (isSelected && !isCorrectOpt) {
                  optionClass = "border-red-500/50 bg-red-500/10 text-red-200";
                } else {
                  optionClass = "border-zinc-800 bg-zinc-950/50 text-zinc-500 opacity-50";
                }
              } else if (isSelected) {
                optionClass = "border-emerald-500 bg-emerald-500/10 text-emerald-200 ring-2 ring-emerald-500/20";
              }

              return (
                <button
                  key={index}
                  disabled={isRevealed}
                  onClick={() => handleAnswer(index)}
                  className={cn(
                    "w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start gap-4",
                    optionClass
                  )}
                >
                  <div className={cn(
                    "w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 text-sm font-bold transition-all",
                    isRevealed && isCorrectOpt ? "border-emerald-500 bg-emerald-500 text-zinc-900" :
                    isRevealed && isSelected && !isCorrectOpt ? "border-red-500 bg-red-500 text-zinc-900" :
                    isSelected ? "border-emerald-500 bg-emerald-500 text-zinc-900" : "border-zinc-600 text-zinc-500"
                  )}>
                    {isRevealed && isCorrectOpt ? <CheckCircle2 className="w-4 h-4" /> :
                     isRevealed && isSelected && !isCorrectOpt ? <X className="w-4 h-4" /> :
                     String.fromCharCode(65 + index)}
                  </div>
                  <span className="leading-relaxed text-sm sm:text-base">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Confirm Button */}
          {!isRevealed && (
            <div className="px-6 pb-6">
              <button
                onClick={handleReveal}
                disabled={selectedAnswer === null}
                className="w-full bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 disabled:from-zinc-700 disabled:to-zinc-700 disabled:text-zinc-500 text-white font-bold py-4 rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/20 disabled:shadow-none flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5" />
                Confirmar Resposta
              </button>
            </div>
          )}

          {/* Result + Explanation */}
          {isRevealed && (
            <div className="px-6 pb-6 space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Result Banner */}
              <div className={cn(
                "p-4 rounded-xl border flex items-center gap-4",
                isCorrect 
                  ? "bg-emerald-500/10 border-emerald-500/20" 
                  : "bg-red-500/10 border-red-500/20"
              )}>
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center shrink-0",
                  isCorrect ? "bg-emerald-500/20" : "bg-red-500/20"
                )}>
                  {isCorrect ? (
                    <Trophy className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <X className="w-6 h-6 text-red-400" />
                  )}
                </div>
                <div>
                  <h3 className={cn("font-bold text-lg", isCorrect ? "text-emerald-400" : "text-red-400")}>
                    {isCorrect ? 'Parabéns! Você acertou! 🎉' : 'Não foi dessa vez 😕'}
                  </h3>
                  <p className="text-sm text-zinc-400">
                    {isCorrect 
                      ? 'Excelente! Você domina esse assunto.' 
                      : `A resposta correta era a alternativa ${String.fromCharCode(65 + data.question.correctIndex)}.`}
                  </p>
                </div>
              </div>

              {/* Explanation */}
              <div className="p-4 bg-zinc-800/50 rounded-xl border border-zinc-700/50">
                <div className="flex items-center gap-2 mb-2">
                  <Brain className="w-5 h-5 text-blue-400" />
                  <h4 className="font-semibold text-zinc-200">Explicação</h4>
                </div>
                <p className="text-zinc-400 text-sm leading-relaxed">{data.question.explanation}</p>
              </div>
            </div>
          )}
        </div>

        {/* CTA - Signup Section */}
        {showCTA && (
          <div className="mt-10 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="relative bg-gradient-to-br from-zinc-900 to-zinc-900 border border-zinc-800 rounded-3xl p-8 overflow-hidden">
              {/* Glow decoration */}
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl" />
              <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl" />

              <div className="relative z-10 text-center">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-[10px] font-bold text-emerald-400 uppercase tracking-widest mb-4">
                  <Sparkles className="w-3 h-3" />
                  Grátis para começar
                </div>

                <h2 className="text-2xl sm:text-3xl font-bold text-zinc-100 mb-3 tracking-tight">
                  Quer mais questões como essa?
                </h2>
                <p className="text-zinc-400 mb-8 max-w-md mx-auto text-sm sm:text-base">
                  No <span className="text-emerald-400 font-semibold">Ciclo a Aprovação</span> você gera questões com IA, 
                  estuda com flashcards inteligentes, acompanha sua evolução e desafia seus amigos.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                  <button
                    onClick={onGoToSignup}
                    className="w-full sm:w-auto bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-bold py-4 px-8 rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group"
                  >
                    <UserPlus className="w-5 h-5" />
                    Criar minha conta grátis
                    <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={onGoToLogin}
                    className="w-full sm:w-auto text-zinc-400 hover:text-zinc-200 font-medium py-4 px-6 rounded-2xl transition-colors text-sm border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-900"
                  >
                    Já tenho uma conta
                  </button>
                </div>

                {/* Social proof */}
                <div className="mt-8 flex items-center justify-center gap-6 text-[11px] text-zinc-500">
                  <div className="flex items-center gap-1.5">
                    <Brain className="w-3 h-3 text-blue-400" /> Questões com IA
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-3 h-3 text-amber-400" /> Rankings
                  </div>
                  <div className="flex items-center gap-1.5">
                    <RefreshCw className="w-3 h-3 text-emerald-400" /> Revisão espaçada
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 bg-zinc-950/80 backdrop-blur-md border-t border-zinc-800/50 py-3 px-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <p className="text-[10px] text-zinc-600">
            &copy; {new Date().getFullYear()} Ciclo a Aprovação
          </p>
          <button
            onClick={onGoToSignup}
            className="text-xs text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-1 transition-colors"
          >
            Criar conta grátis <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </footer>
    </div>
  );
}
