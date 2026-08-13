import { useMemo, useState } from 'react';
import { useStore } from '@/store';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, parseISO, isValid, startOfDay, subDays, differenceInCalendarDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Target, CheckCircle2, Clock, BookOpen, Flame, Zap, Share2, Download, X, Loader2 } from 'lucide-react';
import { toPng } from 'html-to-image';

export function Dashboard() {
  const { subjects, topics, questionLogs, simulados, studySessions, userProfile, editalInfo } = useStore();
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownloadCard = async () => {
    setIsDownloading(true);
    try {
      const node = document.getElementById('achievement-card');
      if (!node) return;
      
      const dataUrl = await toPng(node, {
        quality: 0.95,
        backgroundColor: '#09090b'
      });
      
      const link = document.createElement('a');
      link.download = `desempenho-${userProfile.name || 'estudante'}.png`;
      link.href = dataUrl;
      link.click();
      setIsShareModalOpen(false);
    } catch (error) {
      console.error('Erro ao gerar card:', error);
      alert('Não foi possível gerar a imagem. Tente novamente.');
    } finally {
      setIsDownloading(false);
    }
  };

  const stats = useMemo(() => {
    const totalQuestionsFromLogs = questionLogs.reduce((acc, curr) => acc + curr.totalQuestions, 0);
    const totalCorrectFromLogs = questionLogs.reduce((acc, curr) => acc + curr.correctAnswers, 0);
    
    const manualSimulados = simulados.filter(s => s.type === 'manual' || s.type === 'shared');
    const totalQuestionsFromSimulados = manualSimulados.reduce((acc, curr) => acc + curr.total, 0);
    const totalCorrectFromSimulados = manualSimulados.reduce((acc, curr) => acc + curr.score, 0);

    const totalQuestionsAll = totalQuestionsFromLogs + totalQuestionsFromSimulados;
    const totalCorrectAll = totalCorrectFromLogs + totalCorrectFromSimulados;
    
    const totalStudySeconds = studySessions.reduce((acc, curr) => acc + curr.durationSeconds, 0);
    const hours = Math.floor(totalStudySeconds / 3600);
    const minutes = Math.floor((totalStudySeconds % 3600) / 60);

    const totalTopics = topics.length;
    const completedTopicsAll = topics.filter(t => t.status !== 'NOT_READ').length;

    const subjectPerformance = subjects.map(subject => {
      const subjectTopics = topics.filter(t => t.subjectId === subject.id).map(t => t.id);
      const logs = questionLogs.filter(q => subjectTopics.includes(q.topicId));
      const totalQuestions = logs.reduce((acc, curr) => acc + curr.totalQuestions, 0);
      const correctAnswers = logs.reduce((acc, curr) => acc + curr.correctAnswers, 0);
      const percentage = totalQuestions > 0 ? (correctAnswers / totalQuestions) * 100 : 0;
      
      let status = 'Sem Dados';
      let color = '#52525b';
      if (totalQuestions > 0) {
        if (percentage >= 85) { status = 'Mestre'; color = '#10b981'; }
        else if (percentage >= 70) { status = 'Competitivo'; color = '#3b82f6'; }
        else { status = 'Crítico'; color = '#ef4444'; }
      }

      return {
        name: subject.name,
        percentage: Math.round(percentage),
        totalQuestions,
        status,
        color,
        completedTopics: topics.filter(t => t.subjectId === subject.id && t.status !== 'NOT_READ').length,
        totalSubjectTopics: topics.filter(t => t.subjectId === subject.id).length
      };
    });

    // ── Consistency streak ──
    const dayMap = new Map<string, number>();
    studySessions.forEach(s => {
      const day = format(parseISO(s.date), 'yyyy-MM-dd');
      dayMap.set(day, (dayMap.get(day) || 0) + s.durationSeconds);
    });

    const today = startOfDay(new Date());
    let currentStreak = 0;
    let cursor = today;
    while (dayMap.has(format(cursor, 'yyyy-MM-dd'))) {
      currentStreak++;
      cursor = subDays(cursor, 1);
    }
    // Se hoje não tem registro, verifica a partir de ontem
    if (currentStreak === 0) {
      cursor = subDays(today, 1);
      while (dayMap.has(format(cursor, 'yyyy-MM-dd'))) {
        currentStreak++;
        cursor = subDays(cursor, 1);
      }
    }

    let longestStreak = 0;
    let tempStreak = 0;
    const sortedDays = Array.from(dayMap.keys()).sort();
    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0) { tempStreak = 1; continue; }
      const diff = differenceInCalendarDays(parseISO(sortedDays[i]), parseISO(sortedDays[i - 1]));
      if (diff === 1) tempStreak++;
      else tempStreak = 1;
      if (tempStreak > longestStreak) longestStreak = tempStreak;
    }

    // Grid dos últimos 70 dias (10 semanas)
    const streakGrid: { date: Date; minutes: number; dayLabel: string }[] = [];
    for (let i = 69; i >= 0; i--) {
      const d = subDays(today, i);
      const key = format(d, 'yyyy-MM-dd');
      const seconds = dayMap.get(key) || 0;
      streakGrid.push({
        date: d,
        minutes: Math.round(seconds / 60),
        dayLabel: format(d, 'EEE', { locale: ptBR }).slice(0, 1),
      });
    }

    const simuladosEvolution = simulados.filter(s => s.category === 'simulado').map(s => {
      const dateObj = parseISO(s.date);
      return {
        name: s.name,
        score: Math.round((s.score / s.total) * 100),
        date: isValid(dateObj) ? format(dateObj, 'dd/MM', { locale: ptBR }) : 'N/A'
      };
    });

    const questoesEvolution = simulados.filter(s => s.category === 'questoes').map(s => {
      const dateObj = parseISO(s.date);
      return {
        name: s.name,
        score: Math.round((s.score / s.total) * 100),
        date: isValid(dateObj) ? format(dateObj, 'dd/MM', { locale: ptBR }) : 'N/A'
      };
    });

    return { totalQuestionsAll, totalCorrectAll, hours, minutes, totalTopics, completedTopicsAll, subjectPerformance, simuladosEvolution, questoesEvolution, currentStreak, longestStreak, streakGrid };
  }, [subjects, topics, questionLogs, simulados, studySessions]);

  const { totalQuestionsAll, totalCorrectAll, hours, minutes, totalTopics, completedTopicsAll, subjectPerformance, simuladosEvolution, questoesEvolution, currentStreak, longestStreak, streakGrid } = stats;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-100">Desempenho Geral</h1>
          <p className="text-zinc-400 mt-1">Acompanhe sua evolução e identifique pontos críticos.</p>
        </div>
        <button
          onClick={() => setIsShareModalOpen(true)}
          className="bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-bold px-4 py-2.5 rounded-xl transition-all duration-300 shadow-md shadow-emerald-950/20 active:scale-[0.98] flex items-center justify-center gap-2 text-sm shrink-0"
        >
          <Share2 className="w-4 h-4" /> <span>Gerar Card de Progresso</span>
        </button>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 flex items-center gap-4">
          <div className="p-2 sm:p-3 bg-blue-500/10 rounded-xl">
            <Target className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest">Total de Questões</p>
            <p className="text-xl sm:text-2xl font-bold text-zinc-100">{totalQuestionsAll}</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 flex items-center gap-4">
          <div className="p-2 sm:p-3 bg-emerald-500/10 rounded-xl">
            <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest">Total de Acertos</p>
            <p className="text-xl sm:text-2xl font-bold text-zinc-100">{totalCorrectAll}</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 flex items-center gap-4">
          <div className="p-2 sm:p-3 bg-amber-500/10 rounded-xl">
            <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest">Horas Estudadas</p>
            <p className="text-xl sm:text-2xl font-bold text-zinc-100">{hours}h {minutes}m</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 sm:p-6 flex items-center gap-4">
          <div className="p-2 sm:p-3 bg-purple-500/10 rounded-xl">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
          </div>
          <div>
            <p className="text-[10px] sm:text-xs font-bold text-zinc-500 uppercase tracking-widest">Teoria Concluída</p>
            <p className="text-xl sm:text-2xl font-bold text-zinc-100">{completedTopicsAll}/{totalTopics}</p>
          </div>
        </div>
      </div>

      {/* Consistency Streak */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-400" />
            Consistência de Estudos
          </h2>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-2xl font-black text-orange-400 tabular-nums">{currentStreak}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Dias Seguidos</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-2xl font-black text-amber-400 tabular-nums">{longestStreak}</p>
                <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Maior Sequência</p>
              </div>
            </div>
          </div>
        </div>

        {/* Grade de consistência (GitHub-style) */}
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-rows-7 grid-flow-col gap-[3px] w-fit">
            {Array.from({ length: 7 }, (_, row) =>
              Array.from({ length: 10 }, (_, col) => {
                const idx = col * 7 + row;
                const day = streakGrid[idx];
                if (!day) return <div key={`${col}-${row}`} className="w-3 h-3 rounded-sm bg-zinc-950 border border-zinc-800/30" />;
                
                let intensity = 'bg-zinc-950 border border-zinc-800/20';
                if (day.minutes > 0) {
                  if (day.minutes < 30) intensity = 'bg-emerald-900/40 border border-emerald-800/30';
                  else if (day.minutes < 60) intensity = 'bg-emerald-700/50 border border-emerald-600/30';
                  else if (day.minutes < 120) intensity = 'bg-emerald-600/60 border border-emerald-500/40';
                  else intensity = 'bg-emerald-500/80 border border-emerald-400/50';
                }

                return (
                  <div
                    key={`${col}-${row}`}
                    className={`w-3 h-3 rounded-sm ${intensity}`}
                    title={`${format(day.date, 'dd/MM/yyyy', { locale: ptBR })}: ${day.minutes > 0 ? `${day.minutes}min` : 'Descanso'}`}
                  />
                );
              })
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-zinc-600">
          <span>Menos</span>
          <div className="w-3 h-3 rounded-sm bg-zinc-950 border border-zinc-800/20" />
          <div className="w-3 h-3 rounded-sm bg-emerald-900/40 border border-emerald-800/30" />
          <div className="w-3 h-3 rounded-sm bg-emerald-700/50 border border-emerald-600/30" />
          <div className="w-3 h-3 rounded-sm bg-emerald-600/60 border border-emerald-500/40" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500/80 border border-emerald-400/50" />
          <span>Mais</span>
        </div>
      </div>

      {/* Evolução Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col min-w-0 overflow-hidden">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Evolução em Simulados</h2>
          <div className="flex-1 h-[250px] w-full mt-2">
            {simuladosEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={simuladosEvolution} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" hide stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#10b981" strokeWidth={3} dot={{ r: 4, fill: '#10b981', strokeWidth: 2, stroke: '#18181b' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                Nenhum simulado registrado.
              </div>
            )}
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col min-w-0 overflow-hidden">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Evolução por Assunto (Questões)</h2>
          <div className="flex-1 h-[250px] w-full mt-2">
            {questoesEvolution.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={questoesEvolution} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" hide stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                    itemStyle={{ color: '#e4e4e7' }}
                  />
                  <Line type="monotone" dataKey="score" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#18181b' }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                Nenhuma sessão de questões registrada.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Heatmap Section */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-zinc-100 mb-4">Mapa de Calor por Disciplina</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {subjectPerformance.map(subject => {
            const subjectTopics = topics.filter(t => t.subjectId === subjects.find(s => s.name === subject.name)?.id);
            
            const topicDetails = subjectTopics.map(topic => {
              const logs = questionLogs.filter(q => q.topicId === topic.id);
              const tQuestions = logs.reduce((acc, curr) => acc + curr.totalQuestions, 0);
              const tCorrect = logs.reduce((acc, curr) => acc + curr.correctAnswers, 0);
              const tPercentage = tQuestions > 0 ? (tCorrect / tQuestions) * 100 : 0;
              
              let tColor = '#18181b'; // Base zinc-950
              if (tQuestions > 0) {
                if (tPercentage >= 85) tColor = '#10b981'; // Emerald
                else if (tPercentage >= 70) tColor = '#3b82f6'; // Blue
                else tColor = '#ef4444'; // Red
              } else if (topic.status !== 'NOT_READ') {
                tColor = '#3f3f46'; // Zinc-700 (Studied but no questions)
              }

              return { name: topic.name, color: tColor, percentage: Math.round(tPercentage), total: tQuestions };
            });

            return (
              <div key={subject.name} className="space-y-4 p-4 bg-zinc-800/20 rounded-xl border border-zinc-800/50">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-300 font-bold truncate max-w-[150px]" title={subject.name}>{subject.name}</span>
                  <div className="flex items-center gap-2">
                     <span className="text-zinc-500 text-[10px] uppercase font-bold mr-1">{subject.completedTopics}/{subject.totalSubjectTopics}</span>
                     <span className="font-mono text-zinc-100">{subject.percentage}%</span>
                  </div>
                </div>
                
                {/* Heatmap Grid */}
                <div className="flex flex-wrap gap-1">
                  {topicDetails.map((td, i) => (
                    <div 
                      key={i}
                      title={`${td.name}: ${td.total > 0 ? td.percentage + '%' : 'Sem questões'}`}
                      className="w-3.5 h-3.5 rounded-sm transition-all hover:scale-125 hover:z-10 cursor-help border border-white/5"
                      style={{ backgroundColor: td.color }}
                    />
                  ))}
                </div>

                <div className="h-1 w-full bg-zinc-800/50 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${subject.percentage}%`, backgroundColor: subject.color }}
                  />
                </div>
              </div>
            );
          })}
          {subjectPerformance.length === 0 && (
            <div className="text-zinc-500 text-center py-4 text-sm col-span-full">Nenhuma disciplina cadastrada.</div>
          )}
        </div>
      </div>
      {/* Share Card Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl w-full max-w-md overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-zinc-800 flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Seu Card de Conquistas</span>
              <button 
                onClick={() => setIsShareModalOpen(false)}
                className="p-1.5 hover:bg-zinc-800 rounded-full text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 flex flex-col items-center justify-center">
              {/* O Card real que será capturado */}
              <div 
                id="achievement-card"
                className="w-full aspect-[4/5] max-w-[340px] bg-gradient-to-br from-[#09090b] via-zinc-950 to-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden shadow-2xl"
              >
                {/* Glow Effects */}
                <div className="absolute -top-12 -right-12 w-32 h-32 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />
                
                {/* Header */}
                <div className="flex items-center justify-between border-b border-zinc-800/80 pb-4">
                  <div>
                    <h3 className="text-white text-xs font-bold tracking-widest uppercase">Ciclo a Aprovação</h3>
                    <p className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider mt-0.5">Foco & Disciplina</p>
                  </div>
                  <div className="bg-emerald-500/10 p-1.5 rounded-lg border border-emerald-500/20">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                </div>

                {/* User Info */}
                <div className="my-4 text-left w-full">
                  <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Estudante</p>
                  <p className="text-lg font-black text-white truncate">{userProfile.name || 'Estudante Concurseiro'}</p>
                  <p className="text-[10px] text-zinc-400 truncate mt-1">
                    🎯 {editalInfo.carreira || 'Geral'} {editalInfo.banca ? `| ${editalInfo.banca}` : ''}
                  </p>
                </div>

                {/* Level / Badge */}
                <div className="bg-zinc-900/50 border border-zinc-800/80 p-3.5 rounded-xl text-center flex items-center justify-center gap-2 w-full">
                  <span className="text-xl">🏆</span>
                  <div className="text-left">
                    <p className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">Nível de Foco</p>
                    <p className="text-xs font-black text-emerald-400">
                      {hours >= 20 ? 'Guerreiro Lendário' : hours >= 5 ? 'Estudante Altamente Focado' : 'Estudante Iniciante'}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mt-4 border-t border-zinc-800/80 pt-4 w-full">
                  <div className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900 text-left">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Questões</span>
                    <span className="text-sm font-black text-white">{totalQuestionsAll}</span>
                  </div>
                  <div className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900 text-left">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Acertos</span>
                    <span className="text-sm font-black text-emerald-400">
                      {totalQuestionsAll > 0 ? `${Math.round((totalCorrectAll / totalQuestionsAll) * 100)}%` : '0%'}
                    </span>
                  </div>
                  <div className="bg-zinc-950/40 p-2.5 rounded-lg border border-zinc-900 col-span-2 text-center">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest block">Horas Líquidas</span>
                    <span className="text-sm font-black text-blue-400">{hours}h {minutes}m</span>
                  </div>
                </div>
              </div>

              {/* Botão de Download */}
              <button
                onClick={handleDownloadCard}
                disabled={isDownloading}
                className="w-full mt-6 bg-gradient-to-r from-emerald-500 to-blue-600 hover:from-emerald-400 hover:to-blue-500 text-white font-bold py-3.5 rounded-2xl transition-all duration-300 shadow-lg shadow-emerald-500/10 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>GERANDO IMAGEM...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-5 h-5" />
                    <span>BAIXAR CARD DE DESEMPENHO</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
