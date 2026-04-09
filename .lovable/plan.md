

## Plano: ChatBot Médico com Geração de Gráficos

### 1. Configurar Lovable Cloud + Banco de Dados
- Habilitar Lovable Cloud (backend + banco de dados)
- Criar tabela `patients` (nome, idade, gênero, diagnóstico, data_cadastro, etc.)
- Criar tabela `conversations` e `messages` para histórico de chat
- Configurar autenticação (login do médico)

### 2. Tela de Login e Cadastro
- Página de login/registro com email
- Proteção de rotas (apenas usuários logados acessam)

### 3. Gestão de Pacientes
- CRUD completo de pacientes (cadastrar, editar, excluir, listar)
- Campos: nome, idade, gênero, diagnóstico, data de admissão, status, observações
- Importação em massa via CSV (opcional)

### 4. Interface de Chat com IA
- Chat estilo conversacional (parecido com ChatGPT)
- Histórico de conversas no sidebar esquerdo
- Streaming de respostas token por token
- A IA tem acesso aos dados dos pacientes para responder perguntas
- Templates de perguntas médicas prontas para facilitar

### 5. Geração Inteligente de Gráficos
- Quando a resposta envolver dados numéricos, a IA pergunta: "Deseja gerar um gráfico?"
- Opções de tipo: barras, pizza/donut, linha, área (IA sugere o melhor)
- Gráficos com visual profissional/médico usando Recharts
- Personalização: cores, título, legendas

### 6. Exportação em PDF
- Botão "Exportar como PDF" em cada gráfico
- PDF formatado com título, gráfico, dados resumidos e data de geração
- Pronto para impressão ou envio

### 7. Dashboard Resumo
- Cards com métricas principais (total pacientes, média de idade, distribuição por gênero)
- Gráficos padrão atualizados automaticamente

### Stack Técnica
- **Frontend**: React + Tailwind + Recharts (gráficos) + react-markdown
- **Backend**: Lovable Cloud (Supabase) + Edge Functions
- **IA**: Lovable AI Gateway (Gemini) com acesso ao banco de dados
- **Exportação**: jsPDF + html2canvas para PDF dos gráficos

