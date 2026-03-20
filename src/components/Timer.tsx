import { useState, useEffect } from 'react';
import { Play, Square, Clock, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStore } from '@/store';

export function Timer() {
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const { topics, logStudySession, activeTopicId, setActiveTopicId } = useStore();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isActive) {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive]);

  const toggleTimer = () => {
    if (isActive) {
      // Stop and log
      if (activeTopicId) {
        logStudySession(activeTopicId, seconds);
      }
      setSeconds(0);
      // We don't necessarily want to clear the active topic when stopping, 
      // maybe the user wants to resume or just finished that session.
      // But the user said "no relógio não faz sentido ter o selecionar tópico".
    }
    setIsActive(!isActive);
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const activeTopic = topics.find(t => t.id === activeTopicId);

  return (
    <div className="flex items-center gap-2 sm:gap-4 bg-zinc-900 border border-zinc-800 rounded-full px-3 sm:px-4 py-1.5 sm:py-2 shadow-lg">
      <Clock className="w-4 h-4 sm:w-5 h-5 text-zinc-400 hidden xs:block" />
      <div className="font-mono text-base sm:text-xl font-medium text-zinc-100 tracking-wider w-20 sm:w-24 text-center">
        {formatTime(seconds)}
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
