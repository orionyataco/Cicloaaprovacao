import React, { useState, useEffect } from 'react';
import { useStore } from '@/store';
import { format, addDays, isBefore, startOfDay, parseISO, differenceInDays, getDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Calendar, Clock, Settings2, Save, X, ChevronRight, BookOpen, AlertCircle, Timer as TimerIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function Cronograma() {
  const { subjects, editalInfo, scheduleConfig, updateScheduleConfig, currentCycleIndex } = useStore();
  const [isEditing, setIsEditing] = useState(false);
  const [tempConfig, setTempConfig] = useState(scheduleConfig);
  const [timeLeft, setTimeLeft] = useState<{ days: number } | null>(null);

  const parseDate = (dateStr: string) => {
    if (!dateStr) return null;
    // Try DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const date = new Date(year, month, day);
      return isNaN(date.getTime()) ? null : date;
    }
    // Fallback to ISO
    try {
      const date = parseISO(dateStr);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const updateCountdown = () => {
      const target = parseDate(editalInfo.dataProva);
      if (!target) {
        setTimeLeft(null);
        return;
      }

      const now = new Date();
      const diff = target.getTime() - now.getTime();

      if (diff <= 0) {
        setTimeLeft({ days: 0 });
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      setTimeLeft({ days });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 60000); // Update every minute is enough for days
    return () => clearInterval(timer);
  }, [editalInfo.dataProva]);

  const today = startOfDay(new Date());
  const dataProva = parseDate(editalInfo.dataProva);
  
  const daysUntilProva = dataProva ? differenceInDays(startOfDay(dataProva), today) : 0;
  const totalWeeks = Math.ceil(daysUntilProva / 7);
  
  const handleSave = () => {
    updateScheduleConfig(tempConfig);
    setIsEditing(false);
  };

  const toggleDay = (day: number) => {
    setTempConfig(prev => ({
      ...prev,
      activeDays: prev.activeDays.includes(day)
        ? prev.activeDays.filter(d => d !== day)
        : [...prev.activeDays, day].sort()
    }));
  };

  // Generate schedule for the next 14 days
  const scheduleDays = [];
  let cyclePtr = currentCycleIndex;
  
  const hoursPerActiveDay = scheduleConfig.hoursPerDay;

  for (let i = 0; i < 14; i++) {
    const date = addDays(today, i);
    const dayOfWeek = getDay(date);
    const isActive = scheduleConfig.activeDays.includes(dayOfWeek);
    
    const daySubjects = [];
    if (isActive && subjects.length > 0) {
      for (let h = 0; h < hoursPerActiveDay; h++) {
        daySubjects.push(subjects[cyclePtr % subjects.length]);
        cyclePtr++;
      }
    }
    
    scheduleDays.push({
      date,
      isActive,
      subjects: daySubjects
    });
  }

  const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
        >
          <Settings2 className="w-4 h-4" /> 
          {isEditing ? 'Fechar Configurações' : 'Configurar Horário'}
        </button>
      </div>

      {isEditing && (
        <div className="bg-zinc-900 border border-emerald-500/20 rounded-2xl p-6 animate-in slide-in-from-top-4">
          <div className="flex items-center gap-2 mb-6">
            <Settings2 className="w-5 h-5 text-emerald-400" />
            <h2 className="text-lg font-bold text-zinc-100">Configurações do Cronograma</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Dias de Estudo</label>
              <div className="flex flex-wrap gap-2">
                {weekDays.map((day, idx) => {
                  const isActive = tempConfig.activeDays.includes(idx);
                  return (
                    <button
                      key={day}
                      onClick={() => toggleDay(idx)}
                      className={cn(
                        "w-12 h-12 rounded-xl border text-sm font-bold transition-all",
                        isActive 
                          ? "bg-emerald-500 border-emerald-400 text-white shadow-lg shadow-emerald-500/20" 
                          : "bg-zinc-800 border-zinc-700 text-zinc-500 hover:border-zinc-600"
                      )}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">Horas por Dia de Estudo</label>
              <div className="flex items-center gap-4">
                <input 
                  type="range" 
                  min="1" 
                  max="12" 
                  value={tempConfig.hoursPerDay}
                  onChange={(e) => setTempConfig(prev => ({ ...prev, hoursPerDay: parseInt(e.target.value) }))}
                  className="flex-1 h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
                <div className="bg-zinc-950 border border-zinc-800 px-4 py-2 rounded-xl min-w-[80px] text-center">
                  <span className="text-xl font-bold text-emerald-400">{tempConfig.hoursPerDay}h</span>
                </div>
              </div>
              <p className="text-xs text-zinc-500 italic">
                {tempConfig.activeDays.length > 0 
                  ? `Total de ${tempConfig.hoursPerDay * tempConfig.activeDays.length}h de estudo por semana.`
                  : 'Selecione pelo menos um dia de estudo.'}
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3">
            <button 
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-zinc-200"
            >
              Cancelar
            </button>
            <button 
              onClick={handleSave}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
            >
              <Save className="w-4 h-4" /> Salvar Cronograma
            </button>
          </div>
        </div>
      )}

      {/* Stats Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <TimerIcon className="w-12 h-12 sm:w-16 sm:h-16 text-blue-400" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-5 h-5 text-blue-400" />
            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest">Contagem Regressiva</span>
          </div>
          
          {timeLeft ? (
            <div className="flex items-baseline gap-2">
              <span className="text-3xl sm:text-4xl font-black text-zinc-100 tabular-nums">
                {timeLeft.days}
              </span>
              <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest">Dias Restantes</span>
            </div>
          ) : (
            <div className="text-zinc-500 text-xs sm:text-sm italic py-2">
              Defina a data da prova no Meu Edital.
            </div>
          )}
          
          <div className="text-[10px] text-zinc-500 mt-4 font-medium border-t border-zinc-800 pt-3">
            {dataProva ? `Data: ${format(dataProva, "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}` : 'Aguardando data do edital...'}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-5 h-5 text-emerald-400" />
            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest">Carga Diária</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-zinc-100">{scheduleConfig.hoursPerDay} horas</div>
          <div className="text-[10px] sm:text-xs text-zinc-500 mt-1">Em cada um dos {scheduleConfig.activeDays.length} dias ativos.</div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-4 sm:p-6 rounded-2xl">
          <div className="flex items-center gap-3 mb-2">
            <BookOpen className="w-5 h-5 text-amber-400" />
            <span className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest">Matérias no Ciclo</span>
          </div>
          <div className="text-xl sm:text-2xl font-bold text-zinc-100">{subjects.length} matérias</div>
          <div className="text-[10px] sm:text-xs text-zinc-500 mt-1">Organizadas de forma sequencial.</div>
        </div>
      </div>

      {/* Schedule Grid */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-zinc-100 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-emerald-500" />
          Próximos 14 Dias
        </h2>

        {subjects.length === 0 ? (
          <div className="bg-zinc-900 border border-dashed border-zinc-800 rounded-2xl p-12 text-center">
            <AlertCircle className="w-12 h-12 text-zinc-700 mx-auto mb-4" />
            <p className="text-zinc-500">Cadastre matérias no Meu Edital para gerar seu cronograma.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-4">
            {scheduleDays.map((day, idx) => {
              const isToday = idx === 0;
              return (
                <div 
                  key={idx} 
                  className={cn(
                    "bg-zinc-900 border rounded-xl overflow-hidden flex flex-col min-h-[160px] transition-all",
                    day.isActive ? "border-zinc-800" : "border-zinc-900 opacity-40",
                    isToday && "ring-2 ring-emerald-500 border-transparent shadow-lg shadow-emerald-500/10"
                  )}
                >
                  <div className={cn(
                    "p-3 border-b text-center",
                    isToday ? "bg-emerald-500 text-white border-emerald-400" : "bg-zinc-950 border-zinc-800"
                  )}>
                    <div className="text-[10px] font-bold uppercase tracking-widest opacity-80">
                      {format(day.date, 'EEE', { locale: ptBR })}
                    </div>
                    <div className="text-lg font-bold">
                      {format(day.date, 'dd/MM')}
                    </div>
                  </div>
                  
                  <div className="p-3 flex-1 space-y-2">
                    {day.isActive ? (
                      day.subjects.length > 0 ? (
                        day.subjects.map((subj, sIdx) => (
                          <div 
                            key={sIdx} 
                            className="flex items-center gap-2 bg-zinc-800/50 p-2 rounded-lg border border-zinc-800"
                            title={subj.name}
                          >
                            <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: subj.color }} />
                            <span className="text-[10px] font-medium text-zinc-300 truncate">{subj.name}</span>
                          </div>
                        ))
                      ) : (
                        <div className="text-[10px] text-zinc-600 italic text-center py-4">Sem carga horária</div>
                      )
                    ) : (
                      <div className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest text-center py-8 rotate-[-45deg]">Descanso</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl flex items-start gap-4">
        <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
          <Clock className="w-5 h-5 text-blue-400" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-zinc-200 mb-1">Como funciona o Ciclo?</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">
            As matérias são distribuídas de forma cíclica. Se você não conseguir estudar uma matéria hoje, 
            ela continuará sendo a próxima da lista no seu <strong>Ciclo de Hoje</strong>. O cronograma acima é uma 
            projeção do seu planejamento ideal. Conforme você registra suas sessões de estudo, o ciclo avança automaticamente.
          </p>
        </div>
      </div>
    </div>
  );
}
