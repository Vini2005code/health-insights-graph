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

    const systemPrompt = `Você é o MedChat AI, um assistente inteligente para análise de dados médicos clínicos.

REGRAS ESTRITAS:
1. Responda SEMPRE em português brasileiro
2. Use APENAS os dados clínicos fornecidos abaixo — NUNCA invente dados
3. Se não houver dados suficientes, informe o usuário claramente
4. Seja preciso e objetivo nas análises, como um engenheiro de dados médicos
5. Quando a pergunta envolver dados numéricos, distribuições ou comparações, SEMPRE pergunte se o usuário deseja um gráfico e sugira o tipo mais adequado
6. Quando o usuário confirmar ou pedir gráfico, gere no formato especial abaixo
7. NUNCA revele dados pessoais (nome, CPF, etc.) — os dados já estão anonimizados (LGPD)

FORMATO DE GRÁFICO (use APENAS quando solicitado):
Insira um bloco de código com a tag "chart" contendo JSON válido:
\`\`\`chart
{
  "type": "bar",
  "title": "Título do Gráfico",
  "data": [{"categoria": "A", "valor": 10}, {"categoria": "B", "valor": 20}],
  "xKey": "categoria",
  "yKey": "valor"
}
\`\`\`

Tipos disponíveis: bar, pie, donut, line, area
- bar: comparações entre categorias
- pie/donut: proporções e distribuições percentuais
- line: tendências ao longo do tempo
- area: volumes ao longo do tempo

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
