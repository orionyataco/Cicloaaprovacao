import { useState, useEffect, useRef } from 'react';
import { Play, Square, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

export function Timer() {
  const { 
    topics, 
    logStudySession, 
    activeTopicId, 
    setActiveTopicId,
    timerStartTime,
    timerActiveTopicId,
    startTimer,
    stopTimer
  } = useStore();

  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (timerStartTime) {
      // Se já estava rodando (ex: refresh), sincroniza o tempo imediatamente
      const updateTime = () => {
        const start = new Date(timerStartTime).getTime();
        const now = Date.now();
        setElapsedSeconds(Math.floor((now - start) / 1000));
      };
      
      updateTime();
      intervalRef.current = setInterval(updateTime, 1000);
    } else {
      setElapsedSeconds(0);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [timerStartTime]);

  const toggleTimer = () => {
    if (timerStartTime) {
      // Ao parar, salva o log e reseta
      const currentTopicId = timerActiveTopicId || activeTopicId;
      if (currentTopicId) {
        logStudySession(currentTopicId, elapsedSeconds);
      }
      stopTimer();
    } else {
      startTimer(activeTopicId);
    }
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeTopic = topics.find(t => t.id === (timerActiveTopicId || activeTopicId));
  const isActive = !!timerStartTime;

  return (
    <div className="flex items-center gap-2 sm:gap-4 bg-zinc-900 border border-zinc-800 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 shadow-lg">
      <Clock className="w-4 h-4 sm:w-5 h-5 text-zinc-400 hidden xs:block" />
      <div className="font-mono text-base sm:text-xl font-medium text-zinc-100 tracking-wider w-20 sm:w-24 text-center">
        {formatTime(elapsedSeconds)}
      </div>
      
      <div className="text-xs sm:text-sm text-emerald-400 max-w-[80px] sm:max-w-[200px] truncate font-medium">
        {activeTopic ? activeTopic.name : 'Estudo'}
      </div>

      <button
        onClick={toggleTimer}
        className={cn(
          "flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full transition-colors flex-shrink-0",
          isActive 
            ? "bg-red-500/20 text-red-500 hover:bg-red-500/30" 
            : "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
        )}
      >
        {isActive ? <Square className="w-3 h-3 sm:w-4 sm:h-4 fill-current" /> : <Play className="w-3 h-3 sm:w-4 sm:h-4 fill-current ml-0.5" />}
      </button>

      {activeTopicId && (
        <button 
          onClick={() => setActiveTopicId(null)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
          title="Limpar tópico"
        >
          <X className="w-3 h-3 sm:w-4 sm:h-4" />
        </button>
      )}
    </div>
  );
}
