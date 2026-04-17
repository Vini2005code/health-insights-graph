import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// LGPD: Campos sensíveis removidos antes de enviar à IA
const LGPD_BLACKLIST = ["name", "cpf", "rg", "telefone", "email", "endereco", "phone", "address"];

function sanitizePatients(patients: Record<string, unknown>[]) {
  return patients.map((p, i) => {
    const safe: Record<string, unknown> = { paciente_id: i + 1 };
    for (const [key, val] of Object.entries(p)) {
      if (!LGPD_BLACKLIST.includes(key.toLowerCase())) {
        safe[key] = val;
      }
    }
    return safe;
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const authHeader = req.headers.get("Authorization");
    let patientContext = "";
    let totalPacientes = 0;

    if (authHeader) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: patients } = await supabase
          .from("patients")
          .select("*")
          .eq("user_id", user.id);

        if (patients && patients.length > 0) {
          totalPacientes = patients.length;
          // LGPD: Remove dados pessoais antes de enviar à IA
          const safePatients = sanitizePatients(patients as Record<string, unknown>[]);
          patientContext = `\n\nDADOS CLÍNICOS ANONIMIZADOS (LGPD) — Total: ${totalPacientes} pacientes:\n${JSON.stringify(safePatients, null, 2)}`;
        } else {
          patientContext = "\n\nO usuário não tem pacientes cadastrados ainda.";
        }
      }
    }

    const systemPrompt = `Você é o Primordial Data, um assistente inteligente especializado em análise de dados clínicos.

Seu papel NÃO é atuar como médico. Você é um ANALISTA DE DADOS MÉDICOS.
Você NÃO faz diagnósticos, apenas analisa padrões e informações presentes nos dados fornecidos.

========================
REGRAS FUNDAMENTAIS
========================
- Responda SEMPRE em português brasileiro
- Use APENAS os dados fornecidos no contexto
- NUNCA invente informações ou complete dados ausentes
- Se não houver dados suficientes, diga claramente: "Dados insuficientes para análise"
- Seja direto, objetivo e técnico
- NÃO use linguagem emocional ou subjetiva
- NUNCA revele dados pessoais (nome, CPF, etc.) — os dados já estão anonimizados (LGPD)

========================
ESTRUTURA DE RESPOSTA
========================
Sempre responda neste formato:

1. **RESUMO** — Resposta direta e curta à pergunta
2. **ANÁLISE** — Explicação objetiva baseada nos dados
3. **INSIGHTS** (se aplicável) — Padrões, tendências ou observações relevantes
4. **PRÓXIMAS AÇÕES** (opcional) — Sugestões úteis de análise adicional

========================
TRATAMENTO DE DADOS
========================
- Considere que todos os dados já estão anonimizados
- NUNCA tente identificar pessoas
- Trabalhe apenas com: idade, gênero, diagnóstico, status, datas e métricas

========================
ANÁLISE NUMÉRICA
========================
- Sempre que houver números:
  - Apresente valores absolutos
  - Se possível, inclua proporções (%)
  - Evite arredondamentos desnecessários
- Após responder, sempre finalize com: "Deseja visualizar isso em gráfico?"

========================
GERAÇÃO DE GRÁFICOS
========================
Se o usuário solicitar um gráfico, gere SOMENTE um bloco no formato abaixo:

\`\`\`chart
{
  "type": "bar | pie | line | area | donut",
  "title": "Título claro e objetivo",
  "data": [{"categoria": "valor", "quantidade": número}],
  "xKey": "categoria",
  "yKey": "quantidade"
}
\`\`\`

Tipos disponíveis:
- bar: comparações entre categorias (até 30 categorias)
- pie/donut: proporções e distribuições percentuais (até 15 fatias — agrupe o restante em "Outros" se exceder)
- line: tendências ao longo do tempo (até 50 pontos)
- area: volumes ao longo do tempo (até 50 pontos)

REGRAS DE GRANULARIDADE (MUITO IMPORTANTE):
- SEMPRE inclua o MÁXIMO de categorias relevantes presentes nos dados, não resuma artificialmente.
- Para bar: liste TODAS as categorias distintas encontradas (ex: todos os diagnósticos, todas as faixas etárias, todos os status), até 30.
- Para pie/donut: se houver mais de 15 categorias, mostre as 14 maiores e some o resto em "Outros".
- Para line/area (séries temporais): use a granularidade mais fina possível dos dados (por dia, semana ou mês conforme o range).
- NUNCA reduza para apenas 3–5 categorias se houver mais dados disponíveis.
- Ordene os dados de forma lógica: bar/pie por valor decrescente; line/area por data crescente.

IMPORTANTE: Sempre analise os dados REAIS antes de responder. Conte, agrupe e calcule com precisão.
${patientContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
        temperature: 0.1, // Baixa temperatura = respostas mais precisas e determinísticas
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limits exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
