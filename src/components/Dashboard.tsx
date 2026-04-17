import { useMemo } from 'react';
import { useStore } from '@/store';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Target, CheckCircle2, Clock, BookOpen } from 'lucide-react';

export function Dashboard() {
  const { subjects, topics, questionLogs, simulados, studySessions } = useStore();

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

    return { totalQuestionsAll, totalCorrectAll, hours, minutes, totalTopics, completedTopicsAll, subjectPerformance, simuladosEvolution, questoesEvolution };
  }, [subjects, topics, questionLogs, simulados, studySessions]);

  const { totalQuestionsAll, totalCorrectAll, hours, minutes, totalTopics, completedTopicsAll, subjectPerformance, simuladosEvolution, questoesEvolution } = stats;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <p className="text-zinc-400 mt-1">Acompanhe sua evolução e identifique pontos críticos.</p>
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

      {/* Evolução Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col">
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

        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col">
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
    </div>
  );
}
