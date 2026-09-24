import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { 
  Play, 
  Pause, 
  Square, 
  Clock, 
  X, 
  Settings, 
  Coffee, 
  Target, 
  Volume2, 
  VolumeX, 
  Check, 
  ChevronDown,
  Sparkles,
  SkipForward,
  Timer as TimerIcon,
  ArrowDownCircle,
  ArrowUpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore, PomodoroConfig } from '@/store';

type PomodoroMode = 'work' | 'shortBreak' | 'longBreak';

// Função para tocar bipe suave de conclusão via Web Audio API
const playCompletionSound = () => {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880.00, now + 0.15);
    osc.frequency.setValueAtTime(1174.66, now + 0.30);

    gain.gain.setValueAtTime(0.25, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.65);
  } catch (err) {
    console.error('Erro ao tocar efeito sonoro:', err);
  }
};

export function Timer() {
  const { 
    topics, 
    subjects,
    logStudySession, 
    activeTopicId, 
    setActiveTopicId,
    pomodoroConfig,
    updatePomodoroConfig
  } = useStore();

  const [mode, setMode] = useState<PomodoroMode>('work');
  const [secondsLeft, setSecondsLeft] = useState<number>((pomodoroConfig.workMinutes || 25) * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentCycle, setCurrentCycle] = useState(1);
  const [accumulatedWorkSeconds, setAccumulatedWorkSeconds] = useState(0);

  // Estados de Modais e Dropdowns
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTopicDropdownOpen, setIsTopicDropdownOpen] = useState(false);
  
  // Form de Configuração do Pomodoro
  const [formConfig, setFormConfig] = useState<PomodoroConfig>({
    ...pomodoroConfig,
    timerType: pomodoroConfig.timerType || 'countdown'
  });

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Calcula tempo total da fase atual em segundos
  const currentPhaseTotalSeconds = mode === 'work'
    ? (pomodoroConfig.workMinutes || 25) * 60
    : mode === 'shortBreak'
    ? (pomodoroConfig.shortBreakMinutes || 5) * 60
    : (pomodoroConfig.longBreakMinutes || 15) * 60;

  // Atualiza tempo restante se a configuração mudar e o timer estiver parado no início
  useEffect(() => {
    if (!isRunning && !isPaused) {
      if (mode === 'work') {
        setSecondsLeft((pomodoroConfig.workMinutes || 25) * 60);
      } else if (mode === 'shortBreak') {
        setSecondsLeft((pomodoroConfig.shortBreakMinutes || 5) * 60);
      } else if (mode === 'longBreak') {
        setSecondsLeft((pomodoroConfig.longBreakMinutes || 15) * 60);
      }
    }
  }, [pomodoroConfig.workMinutes, pomodoroConfig.shortBreakMinutes, pomodoroConfig.longBreakMinutes, mode, isRunning, isPaused]);

  // Se o usuário nunca configurou o Pomodoro, abre a modal de configuração inicial no primeiro clique
  const handleInitialConfigCheck = () => {
    if (!pomodoroConfig.hasConfigured) {
      setFormConfig({ 
        ...pomodoroConfig,
        timerType: pomodoroConfig.timerType || 'countdown'
      });
      setIsSettingsOpen(true);
      return false;
    }
    return true;
  };

  const lastTickRef = useRef<number>(Date.now());
  const modeRef = useRef(mode);

  // Mantenha a referência do modo sempre atualizada sem causar re-renders
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  // Efeito principal do Cronômetro (Tick preciso baseado em tempo real)
  useEffect(() => {
    if (isRunning) {
      lastTickRef.current = Date.now();
      intervalRef.current = setInterval(() => {
        const now = Date.now();
        const deltaMs = now - lastTickRef.current;
        const deltaSecs = Math.floor(deltaMs / 1000);

        if (deltaSecs >= 1) {
          lastTickRef.current += deltaSecs * 1000;

          setSecondsLeft((prev) => {
            const next = prev - deltaSecs;
            return next <= 0 ? 0 : next;
          });

          // Se estiver em modo de foco, acumula tempo real estudado
          if (modeRef.current === 'work') {
            setAccumulatedWorkSeconds((prev) => prev + deltaSecs);
          }
        }
      }, 500); // Frequência de 500ms compensa o background throttling
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Ação executada quando uma fase do Pomodoro zera (00:00)
  const handlePhaseCompletion = () => {
    if (pomodoroConfig.soundEnabled) {
      playCompletionSound();
    }

    if (mode === 'work') {
      // Salva sessão de estudos no histórico
      const currentTopicId = activeTopicId;
      const totalSecondsToLog = accumulatedWorkSeconds;
      
      if (currentTopicId && totalSecondsToLog > 0) {
        logStudySession(currentTopicId, totalSecondsToLog);
      }
      setAccumulatedWorkSeconds(0);

      // Calcula a próxima pausa (curta ou longa)
      const isLongBreakDue = currentCycle % (pomodoroConfig.longBreakInterval || 4) === 0;
      const nextMode: PomodoroMode = isLongBreakDue ? 'longBreak' : 'shortBreak';
      const nextDuration = isLongBreakDue 
        ? (pomodoroConfig.longBreakMinutes || 15) * 60 
        : (pomodoroConfig.shortBreakMinutes || 5) * 60;

      setMode(nextMode);
      setSecondsLeft(nextDuration);
      setIsRunning(pomodoroConfig.autoStartBreaks);
      setIsPaused(!pomodoroConfig.autoStartBreaks);

      if (isLongBreakDue) {
        setCurrentCycle((prev) => prev + 1);
      }
    } else {
      // Fim da Pausa -> Volta para Foco
      setMode('work');
      setSecondsLeft((pomodoroConfig.workMinutes || 25) * 60);
      setIsRunning(pomodoroConfig.autoStartPomodoros);
      setIsPaused(!pomodoroConfig.autoStartPomodoros);
    }
  };

  // Dispara a conclusão de fase quando timer zera
  useEffect(() => {
    if (isRunning && secondsLeft === 0) {
      handlePhaseCompletion();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, isRunning]);

  // Play / Resume
  const handleStart = () => {
    if (!handleInitialConfigCheck()) return;
    setIsRunning(true);
    setIsPaused(false);
  };

  // Pausar
  const handlePause = () => {
    setIsRunning(false);
    setIsPaused(true);
  };

  // Continuar de onde parou
  const handleResume = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  // Concluir / Finalizar sessão de estudo manualmente
  const handleFinishSession = () => {
    if (mode === 'work' && accumulatedWorkSeconds > 0 && activeTopicId) {
      logStudySession(activeTopicId, accumulatedWorkSeconds);
    }
    
    setIsRunning(false);
    setIsPaused(false);
    setAccumulatedWorkSeconds(0);
    setMode('work');
    setSecondsLeft((pomodoroConfig.workMinutes || 25) * 60);
  };

  // Pular fase atual (Avançar)
  const handleSkipPhase = () => {
    if (mode === 'work' && accumulatedWorkSeconds > 0 && activeTopicId) {
      logStudySession(activeTopicId, accumulatedWorkSeconds);
    }

    setAccumulatedWorkSeconds(0);
    setIsRunning(false);
    setIsPaused(false);

    if (mode === 'work') {
      const isLongBreakDue = currentCycle % (pomodoroConfig.longBreakInterval || 4) === 0;
      setMode(isLongBreakDue ? 'longBreak' : 'shortBreak');
      setSecondsLeft((isLongBreakDue ? (pomodoroConfig.longBreakMinutes || 15) : (pomodoroConfig.shortBreakMinutes || 5)) * 60);
    } else {
      setMode('work');
      setSecondsLeft((pomodoroConfig.workMinutes || 25) * 60);
    }
  };

  // Salvar formulário de configuração do Pomodoro
  const handleSaveConfig = (e: React.FormEvent) => {
    e.preventDefault();
    const updated: PomodoroConfig = {
      ...formConfig,
      workMinutes: Math.max(1, Math.min(120, Number(formConfig.workMinutes) || 25)),
      shortBreakMinutes: Math.max(1, Math.min(60, Number(formConfig.shortBreakMinutes) || 5)),
      longBreakMinutes: Math.max(1, Math.min(90, Number(formConfig.longBreakMinutes) || 15)),
      longBreakInterval: Math.max(1, Math.min(12, Number(formConfig.longBreakInterval) || 4)),
      timerType: formConfig.timerType || 'countdown',
      hasConfigured: true,
    };

    updatePomodoroConfig(updated);
    setIsSettingsOpen(false);

    // Ajusta o cronômetro para os novos minutos caso esteja zerado ou pausado no início
    if (!isRunning && !isPaused) {
      if (mode === 'work') setSecondsLeft(updated.workMinutes * 60);
      else if (mode === 'shortBreak') setSecondsLeft(updated.shortBreakMinutes * 60);
      else if (mode === 'longBreak') setSecondsLeft(updated.longBreakMinutes * 60);
    }
  };

  // Formata os segundos em MM:SS ou HH:MM:SS
  const formatSeconds = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;

    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Calcula os segundos a serem exibidos com base na escolha (Regressiva vs Progressiva)
  const displaySeconds = (pomodoroConfig.timerType || 'countdown') === 'stopwatch'
    ? Math.max(0, currentPhaseTotalSeconds - secondsLeft)
    : secondsLeft;

  const activeTopic = topics.find((t) => t.id === activeTopicId);
  const activeSubject = activeTopic ? subjects.find((s) => s.id === activeTopic.subjectId) : null;

  return (
    <div className="relative">
      {/* Container Principal Compacto da Barra do Cronômetro Pomodoro */}
      <div className={cn(
        "flex items-center gap-2 sm:gap-3 px-3 py-1.5 sm:px-4 sm:py-2 rounded-full border shadow-xl backdrop-blur-md transition-all duration-300",
        mode === 'work' && isRunning && "bg-emerald-950/40 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/20",
        mode === 'work' && isPaused && "bg-amber-950/40 border-amber-500/40 text-amber-300 ring-1 ring-amber-500/20",
        mode === 'work' && !isRunning && !isPaused && "bg-zinc-900/90 border-zinc-800 text-zinc-100",
        mode === 'shortBreak' && "bg-cyan-950/40 border-cyan-500/40 text-cyan-300 ring-1 ring-cyan-500/20",
        mode === 'longBreak' && "bg-purple-950/40 border-purple-500/40 text-purple-300 ring-1 ring-purple-500/20"
      )}>
        
        {/* Ícone Indicador de Modo */}
        <div className="flex items-center gap-1.5 shrink-0">
          {mode === 'work' ? (
            <Target className={cn(
              "w-4 h-4 sm:w-5 sm:h-5 transition-transform",
              isRunning ? "text-emerald-400 animate-pulse" : isPaused ? "text-amber-400" : "text-zinc-400"
            )} />
          ) : (
            <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400 animate-bounce" />
          )}

          {/* Badge do Modo (Foco / Pausa) */}
          <span className={cn(
            "hidden md:inline-block text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border",
            mode === 'work' && "bg-emerald-500/10 border-emerald-500/30 text-emerald-400",
            mode === 'shortBreak' && "bg-cyan-500/10 border-cyan-500/30 text-cyan-400",
            mode === 'longBreak' && "bg-purple-500/10 border-purple-500/30 text-purple-400"
          )}>
            {mode === 'work' ? (isPaused ? 'Pausado' : 'Foco') : mode === 'shortBreak' ? 'Pausa Curta' : 'Pausa Longa'}
          </span>
        </div>

        {/* Display Digital do Tempo (Regressivo ou Progressivo) */}
        <div 
          className="font-mono text-base sm:text-xl font-bold tracking-wider text-center min-w-[56px] sm:min-w-[70px]"
          title={pomodoroConfig.timerType === 'stopwatch' ? 'Contagem Progressiva (00:00 -> Meta)' : 'Contagem Regressiva (Meta -> 00:00)'}
        >
          {formatSeconds(displaySeconds)}
        </div>

        {/* Indicador do Tópico de Estudo Selecionado */}
        <div className="relative">
          <button
            onClick={() => setIsTopicDropdownOpen(!isTopicDropdownOpen)}
            className="flex items-center gap-1.5 text-xs text-zinc-300 hover:text-white max-w-[130px] sm:max-w-[190px] truncate bg-zinc-800/60 hover:bg-zinc-800 px-2.5 py-1 rounded-full border border-zinc-700/50 transition-all text-left"
            title={activeTopic ? `${activeSubject?.name || ''}: ${activeTopic.name}` : 'Selecionar Matéria/Tópico'}
          >
            {activeSubject && (
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeSubject.color }} />
            )}
            <span className="truncate font-medium">
              {activeTopic ? activeTopic.name : 'Selecionar Tópico'}
            </span>
            <ChevronDown className="w-3 h-3 shrink-0 text-zinc-400 ml-0.5" />
          </button>

          {/* Dropdown para escolher o Tópico de Estudo diretamente da barra */}
          {isTopicDropdownOpen && (
            <div className="absolute top-full left-0 mt-2 w-64 max-h-72 overflow-y-auto bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 duration-150 custom-scrollbar">
              <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider px-2 py-1 flex items-center justify-between">
                <span>Escolher Tópico</span>
                <button onClick={() => setIsTopicDropdownOpen(false)} className="text-zinc-500 hover:text-zinc-300">
                  <X className="w-3 h-3" />
                </button>
              </div>

              {topics.length === 0 ? (
                <div className="p-3 text-xs text-zinc-500 text-center italic">
                  Nenhum tópico cadastrado no Edital.
                </div>
              ) : (
                topics.map((t) => {
                  const subject = subjects.find((s) => s.id === t.subjectId);
                  const isSelected = t.id === activeTopicId;
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setActiveTopicId(t.id);
                        setIsTopicDropdownOpen(false);
                      }}
                      className={cn(
                        "w-full text-left p-2 rounded-xl text-xs transition-colors flex items-center gap-2 mb-1",
                        isSelected ? "bg-emerald-500/20 text-emerald-300 font-bold" : "hover:bg-zinc-800 text-zinc-300"
                      )}
                    >
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: subject?.color || '#10b981' }} />
                      <div className="truncate min-w-0">
                        <div className="text-[9px] text-zinc-500 uppercase tracking-tight">{subject?.name}</div>
                        <div className="truncate">{t.name}</div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        {/* Botões de Controle Principal: Play, Pause, Resume, Stop */}
        <div className="flex items-center gap-1 shrink-0">
          {!isRunning && !isPaused && (
            <button
              onClick={handleStart}
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md transition-all hover:scale-105 active:scale-95"
              title="Iniciar Pomodoro"
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />
            </button>
          )}

          {isRunning && (
            <button
              onClick={handlePause}
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-md transition-all hover:scale-105 active:scale-95"
              title="Pausar Cronômetro"
            >
              <Pause className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
            </button>
          )}

          {isPaused && (
            <button
              onClick={handleResume}
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md transition-all hover:scale-105 active:scale-95 animate-pulse"
              title="Continuar Tempo"
            >
              <Play className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current ml-0.5" />
            </button>
          )}

          {/* Botão de Finalizar / Concluir Estudo (Registra Horas) */}
          {(isRunning || isPaused || accumulatedWorkSeconds > 0) && (
            <button
              onClick={handleFinishSession}
              className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors"
              title="Concluir Estudo e Salvar Horas"
            >
              <Square className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" />
            </button>
          )}

          {/* Botão de Pular Fase */}
          {(isRunning || isPaused) && (
            <button
              onClick={handleSkipPhase}
              className="hidden sm:flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Pular para Próxima Fase"
            >
              <SkipForward className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
            </button>
          )}

          {/* Botão de Configurações do Pomodoro */}
          <button
            onClick={() => {
              setFormConfig({ 
                ...pomodoroConfig,
                timerType: pomodoroConfig.timerType || 'countdown'
              });
              setIsSettingsOpen(true);
            }}
            className="flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
            title="Configurar Pomodoro"
          >
            <Settings className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </button>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          MODAL DE CONFIGURAÇÕES DO POMODORO (Renderizado via Portal)
         ───────────────────────────────────────────────────────────── */}
      {isSettingsOpen && createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-4 sm:p-6 overflow-y-auto animate-in fade-in duration-200">
          <div className="relative my-auto w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
            {/* Header fixo da Modal */}
            <div className="p-5 sm:p-6 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/90 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl">
                  <TimerIcon className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-zinc-100">Configurar Pomodoro</h3>
                  <p className="text-xs text-zinc-400">Ajuste os tempos e modo de contagem</p>
                </div>
              </div>
              <button
                onClick={() => setIsSettingsOpen(false)}
                className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo com rolabilidade interna (overflow-y-auto) */}
            <form onSubmit={handleSaveConfig} className="p-5 sm:p-6 space-y-5 overflow-y-auto custom-scrollbar">
              {!pomodoroConfig.hasConfigured && (
                <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-xs text-emerald-300 flex items-start gap-2.5">
                  <Sparkles className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold text-emerald-200">Configuração Inicial!</strong>
                    <p className="mt-0.5 text-emerald-300/90 leading-relaxed">
                      Configure o tipo de contagem e tempos para iniciar seus estudos.
                    </p>
                  </div>
                </div>
              )}

              {/* SELEÇÃO DO TIPO DE CONTAGEM: Regressiva vs Progressiva */}
              <div className="space-y-2 text-left">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Modo de Contagem do Tempo
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setFormConfig({ ...formConfig, timerType: 'countdown' })}
                    className={cn(
                      "flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all",
                      formConfig.timerType === 'countdown'
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/30"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    )}
                  >
                    <ArrowDownCircle className={cn(
                      "w-4 h-4 shrink-0",
                      formConfig.timerType === 'countdown' ? "text-emerald-400" : "text-zinc-500"
                    )} />
                    <div>
                      <div className="text-xs font-bold">Regressiva</div>
                      <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">25:00 ➔ 00:00</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormConfig({ ...formConfig, timerType: 'stopwatch' })}
                    className={cn(
                      "flex items-center gap-2.5 p-3 rounded-2xl border text-left transition-all",
                      formConfig.timerType === 'stopwatch'
                        ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-300 ring-1 ring-emerald-500/30"
                        : "bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700"
                    )}
                  >
                    <ArrowUpCircle className={cn(
                      "w-4 h-4 shrink-0",
                      formConfig.timerType === 'stopwatch' ? "text-emerald-400" : "text-zinc-500"
                    )} />
                    <div>
                      <div className="text-xs font-bold">Progressiva</div>
                      <div className="text-[10px] text-zinc-500 leading-tight mt-0.5">00:00 ➔ 25:00</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Ajuste de Minutos dos Blocos de Estudo */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5 text-left">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    🎯 Foco (Min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="120"
                    value={formConfig.workMinutes}
                    onChange={(e) => setFormConfig({ ...formConfig, workMinutes: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    ☕ Pausa Curta
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={formConfig.shortBreakMinutes}
                    onChange={(e) => setFormConfig({ ...formConfig, shortBreakMinutes: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
                    required
                  />
                </div>

                <div className="space-y-1.5 text-left">
                  <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                    🌴 Pausa Longa
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="90"
                    value={formConfig.longBreakMinutes}
                    onChange={(e) => setFormConfig({ ...formConfig, longBreakMinutes: Number(e.target.value) })}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-center text-sm font-bold text-zinc-100 focus:outline-none focus:border-purple-500 transition-colors"
                    required
                  />
                </div>
              </div>

              {/* Ciclos até Pausa Longa */}
              <div className="space-y-1.5 text-left">
                <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                  Ciclos de Foco até Pausa Longa
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={formConfig.longBreakInterval}
                  onChange={(e) => setFormConfig({ ...formConfig, longBreakInterval: Number(e.target.value) })}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm font-bold text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
                  required
                />
                <p className="text-[10px] text-zinc-500">
                  Após realizar {formConfig.longBreakInterval} ciclos de foco, o aplicativo ativará a Pausa Longa de {formConfig.longBreakMinutes} minutos.
                </p>
              </div>

              {/* Opção de Alarme Sonoro */}
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {formConfig.soundEnabled ? (
                    <Volume2 className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-zinc-500" />
                  )}
                  <span className="text-xs font-medium text-zinc-300">Aviso Sonoro ao Concluir</span>
                </div>
                <button
                  type="button"
                  onClick={() => setFormConfig({ ...formConfig, soundEnabled: !formConfig.soundEnabled })}
                  className={cn(
                    "w-11 h-6 rounded-full transition-colors relative p-0.5",
                    formConfig.soundEnabled ? "bg-emerald-500" : "bg-zinc-800"
                  )}
                >
                  <div
                    className={cn(
                      "w-5 h-5 rounded-full bg-white transition-transform shadow-md",
                      formConfig.soundEnabled ? "translate-x-5" : "translate-x-0"
                    )}
                  />
                </button>
              </div>

              {/* Botão de Salvar */}
              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 stroke-[3]" /> Salvar e Iniciar Estudos
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
