/**
 * Utilidade de comparação semântica de tópicos entre editais.
 * Usa análise de tokens + normalização linguística para determinar
 * se dois tópicos/matérias tratam do mesmo conteúdo, mesmo com nomes diferentes.
 */

// Stop words em português que não agregam significado para comparação
const STOP_WORDS = new Set([
  'a', 'e', 'o', 'de', 'do', 'da', 'dos', 'das', 'no', 'na', 'nos', 'nas',
  'em', 'um', 'uma', 'para', 'por', 'com', 'ao', 'à', 'às', 'aos',
  'seu', 'sua', 'seus', 'suas', 'que', 'se', 'os', 'as', 'ou', 'i', 'ii',
  'iii', 'iv', 'v', 'vi', 'vii', 'viii', 'ix', 'x', 'xi', 'xii',
  'artigo', 'art', 'cf', 'lei', 'cp', 'cpp', 'cc', 'cpc',
]);

// Equivalências semânticas comuns em concursos
const SYNONYMS: Record<string, string> = {
  // Áreas do Direito
  'constitucional': 'constitucional',
  'const': 'constitucional',
  'administrativo': 'administrativo',
  'adm': 'administrativo',
  'penal': 'penal',
  'civil': 'civil',
  'tributario': 'tributario',
  'tributário': 'tributario',
  'trabalho': 'trabalho',
  'trabalhista': 'trabalho',
  'processual': 'processual',
  'processo': 'processual',
  'proc': 'processual',
  'eleitoral': 'eleitoral',
  'empresarial': 'empresarial',
  'comercial': 'empresarial',
  'ambiental': 'ambiental',
  'previdenciario': 'previdenciario',
  'previdenciário': 'previdenciario',

  // Conceitos gerais
  'principios': 'principios',
  'princípios': 'principios',
  'princ': 'principios',
  'fundamentais': 'fundamentais',
  'fundamental': 'fundamentais',
  'direitos': 'direitos',
  'dir': 'direitos',
  'garantias': 'garantias',
  'deveres': 'deveres',
  'organizacao': 'organizacao',
  'organização': 'organizacao',
  'org': 'organizacao',
  'competencias': 'competencias',
  'competências': 'competencias',
  'competencia': 'competencias',
  'competência': 'competencias',
  'poder': 'poder',
  'poderes': 'poder',
  'controle': 'controle',
  'fiscalizacao': 'controle',
  'fiscalização': 'controle',
  'responsabilidade': 'responsabilidade',
  'responsabilidades': 'responsabilidade',
  'licitacao': 'licitacao',
  'licitação': 'licitacao',
  'licitacoes': 'licitacao',
  'licitações': 'licitacao',
  'contratos': 'contratos',
  'contrato': 'contratos',
  'servidores': 'servidores',
  'servidor': 'servidores',
  'publicos': 'publicos',
  'públicos': 'publicos',
  'publica': 'publica',
  'pública': 'publica',
  'administracao': 'administracao',
  'administração': 'administracao',
  'atos': 'atos',
  'ato': 'atos',
  'improbidade': 'improbidade',
  'crimes': 'crimes',
  'crime': 'crimes',
  'pena': 'pena',
  'penas': 'pena',
  'sancao': 'sancao',
  'sanção': 'sancao',
  'sancoes': 'sancao',
  'sanções': 'sancao',
  'recursos': 'recursos',
  'recurso': 'recursos',
  'judiciais': 'judicial',
  'judicial': 'judicial',
  'jurisdicao': 'jurisdicao',
  'jurisdição': 'jurisdicao',
  'mandado': 'mandado',
  'seguranca': 'seguranca',
  'segurança': 'seguranca',
  'habeas': 'habeas',
  'corpus': 'corpus',
  'inquerito': 'inquerito',
  'inquérito': 'inquerito',
  'obrigacoes': 'obrigacoes',
  'obrigações': 'obrigacoes',
  'obrigacao': 'obrigacoes',
  'obrigação': 'obrigacoes',
  'individuais': 'individuais',
  'individual': 'individuais',
  'coletivos': 'coletivos',
  'coletivo': 'coletivos',
  'sociais': 'sociais',
  'social': 'sociais',

  // Português
  'morfologia': 'morfologia',
  'sintaxe': 'sintaxe',
  'semantica': 'semantica',
  'semântica': 'semantica',
  'ortografia': 'ortografia',
  'acentuacao': 'acentuacao',
  'acentuação': 'acentuacao',
  'concordancia': 'concordancia',
  'concordância': 'concordancia',
  'regencia': 'regencia',
  'regência': 'regencia',
  'pontuacao': 'pontuacao',
  'pontuação': 'pontuacao',
  'redacao': 'redacao',
  'redação': 'redacao',
  'interpretacao': 'interpretacao',
  'interpretação': 'interpretacao',
  'compreensao': 'compreensao',
  'compreensão': 'compreensao',
  'texto': 'texto',
  'textos': 'texto',
  'textual': 'texto',

  // Informática
  'informatica': 'informatica',
  'informática': 'informatica',
  'computacao': 'computacao',
  'computação': 'computacao',
  'windows': 'windows',
  'linux': 'linux',
  'excel': 'excel',
  'word': 'word',
  'internet': 'internet',
  'redes': 'redes',
  'rede': 'redes',
  'seguranca_info': 'seguranca_info',
  'banco_dados': 'banco_dados',

  // Matemática
  'matematica': 'matematica',
  'matemática': 'matematica',
  'raciocinio': 'raciocinio',
  'raciocínio': 'raciocinio',
  'logico': 'logico',
  'lógico': 'logico',
  'logica': 'logico',
  'lógica': 'logico',
  'probabilidade': 'probabilidade',
  'estatistica': 'estatistica',
  'estatística': 'estatistica',
  'porcentagem': 'porcentagem',
  'juros': 'juros',
  'equacoes': 'equacoes',
  'equações': 'equacoes',
  'equacao': 'equacoes',
  'equação': 'equacoes',
  'geometria': 'geometria',
  'algebra': 'algebra',
  'álgebra': 'algebra',
};

/**
 * Normaliza um texto removendo acentos, caracteres especiais e convertendo para minúsculas.
 */
function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacríticos
    .replace(/[^a-z0-9\s]/g, ' ')     // Remove caracteres especiais
    .replace(/\s+/g, ' ')             // Colapsa espaços
    .trim();
}

/**
 * Extrai tokens significativos de um texto, removendo stop words e aplicando sinônimos.
 */
function tokenize(text: string): string[] {
  const normalized = normalize(text);
  const words = normalized.split(' ').filter(w => w.length > 1 && !STOP_WORDS.has(w));
  return words.map(w => SYNONYMS[w] || w);
}

/**
 * Calcula a similaridade de Jaccard entre dois conjuntos de tokens.
 * Retorna um valor entre 0 (nada em comum) e 1 (idênticos).
 */
function jaccardSimilarity(tokensA: string[], tokensB: string[]): number {
  if (tokensA.length === 0 && tokensB.length === 0) return 1;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }
  
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersection / union : 0;
}

/**
 * Verifica se um texto contém o outro como substring significativa.
 */
function containsSimilar(normalA: string, normalB: string): boolean {
  if (normalA.length < 3 || normalB.length < 3) return false;
  return normalA.includes(normalB) || normalB.includes(normalA);
}

/**
 * Calcula a similaridade semântica entre dois textos.
 * Retorna um valor entre 0 e 1.
 * 
 * Usa uma combinação de:
 * 1. Correspondência exata normalizada
 * 2. Similaridade de Jaccard com sinônimos
 * 3. Verificação de substring
 */
export function getSemanticSimilarity(textA: string, textB: string): number {
  if (!textA || !textB) return 0;
  
  const normA = normalize(textA);
  const normB = normalize(textB);
  
  // 1. Match exato após normalização
  if (normA === normB) return 1;
  
  // 2. Substring check (ex: "Princípios" vs "Princípios Fundamentais")
  if (containsSimilar(normA, normB)) {
    const ratio = Math.min(normA.length, normB.length) / Math.max(normA.length, normB.length);
    if (ratio > 0.5) return 0.85;
  }
  
  // 3. Tokenização com sinônimos + Jaccard
  const tokensA = tokenize(textA);
  const tokensB = tokenize(textB);
  
  const jaccard = jaccardSimilarity(tokensA, tokensB);
  
  // 4. Boost: se todos os tokens de um estão no outro (um é subconjunto)
  if (tokensA.length > 0 && tokensB.length > 0) {
    const aInB = tokensA.every(t => tokensB.includes(t));
    const bInA = tokensB.every(t => tokensA.includes(t));
    if (aInB || bInA) {
      return Math.max(jaccard, 0.8);
    }
  }
  
  return jaccard;
}

/**
 * Verifica se dois tópicos são semanticamente similares.
 * Requer que AMBOS matéria e tópico sejam similares.
 * 
 * @param threshold - Limiar de similaridade (padrão: 0.6 = 60%)
 */
export function areTopicsSemanticallyEqual(
  subjectA: string, topicA: string,
  subjectB: string, topicB: string,
  threshold = 0.6
): boolean {
  const subjectSim = getSemanticSimilarity(subjectA, subjectB);
  if (subjectSim < threshold) return false;
  
  const topicSim = getSemanticSimilarity(topicA, topicB);
  return topicSim >= threshold;
}

/**
 * Calcula a compatibilidade entre o curso ativo (matérias+tópicos da store) e um curso alvo.
 * Retorna um percentual de 0 a 100.
 */
export function calculateCourseCompatibility(
  activeSubjects: { id: string; name: string }[],
  activeTopics: { subjectId: string; name: string }[],
  targetSubjects: { id: string; name: string }[],
  targetTopics: { subjectId: string; name: string }[],
): number {
  if (targetTopics.length === 0 || activeTopics.length === 0) return 0;

  const activeWithSubject = activeTopics.map(t => {
    const sub = activeSubjects.find(s => s.id === t.subjectId);
    return { subjectName: sub?.name || '', topicName: t.name };
  });

  let matchCount = 0;
  for (const tt of targetTopics) {
    const tSub = targetSubjects.find(s => s.id === tt.subjectId);
    const tSubName = tSub?.name || '';
    
    const hasMatch = activeWithSubject.some(at =>
      areTopicsSemanticallyEqual(at.subjectName, at.topicName, tSubName, tt.name)
    );
    if (hasMatch) matchCount++;
  }

  return Math.round((matchCount / targetTopics.length) * 100);
}
