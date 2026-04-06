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
    
    const manualSimulados = simulados.filter(s => s.type === 'manual');
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

    const simuladoData = simulados.map(s => {
      const dateObj = parseISO(s.date);
      return {
        name: s.name,
        score: Math.round((s.score / s.total) * 100),
        date: isValid(dateObj) ? format(dateObj, 'dd/MM', { locale: ptBR }) : 'N/A'
      };
    });

    return { totalQuestionsAll, totalCorrectAll, hours, minutes, totalTopics, completedTopicsAll, subjectPerformance, simuladoData };
  }, [subjects, topics, questionLogs, simulados, studySessions]);

  const { totalQuestionsAll, totalCorrectAll, hours, minutes, totalTopics, completedTopicsAll, subjectPerformance, simuladoData } = stats;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <p className="text-zinc-400 mt-1">Acompanhe sua evolução e identifique pontos críticos.</p>
      </header>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Heatmap / Subject Performance */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Mapa de Calor por Disciplina</h2>
          <div className="space-y-4">
            {subjectPerformance.map(subject => (
              <div key={subject.name} className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-zinc-300 font-medium">{subject.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500 text-[10px] uppercase font-bold mr-2">{subject.completedTopics}/{subject.totalSubjectTopics} temas</span>
                    <span className="text-zinc-400 text-xs">{subject.totalQuestions} questões</span>
                    <span className="font-mono text-zinc-100">{subject.percentage}%</span>
                  </div>
                </div>
                <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${subject.percentage}%`, backgroundColor: subject.color }}
                  />
                </div>
                <div className="flex justify-end">
                  <span className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: subject.color }}>
                    {subject.status}
                  </span>
                </div>
              </div>
            ))}
            {subjectPerformance.length === 0 && (
              <div className="text-zinc-500 text-center py-4 text-sm">Nenhuma disciplina cadastrada.</div>
            )}
          </div>
        </div>

        {/* Simulados Evolution */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 flex flex-col">
          <h2 className="text-lg font-semibold text-zinc-100 mb-4">Evolução em Simulados</h2>
          <div className="flex-1 h-[250px] w-full mt-4">
            {simuladoData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={simuladoData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                  <XAxis dataKey="name" stroke="#a1a1aa" fontSize={12} tickLine={false} axisLine={false} />
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
      </div>
    </div>
  );
}
