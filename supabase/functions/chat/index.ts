import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Get user's auth token to fetch their patients
    const authHeader = req.headers.get("Authorization");
    let patientContext = "";

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
          patientContext = `\n\nDados dos pacientes do usuário (total: ${patients.length}):\n${JSON.stringify(patients, null, 2)}`;
        } else {
          patientContext = "\n\nO usuário não tem pacientes cadastrados ainda.";
        }
      }
    }

    const systemPrompt = `Você é o MedChat AI, um assistente inteligente para análise de dados médicos. Você ajuda médicos a entender seus dados de pacientes.

REGRAS:
1. Responda sempre em português brasileiro
2. Quando a pergunta envolver dados numéricos ou comparações, SEMPRE pergunte ao usuário se deseja gerar um gráfico
3. Quando o usuário pedir um gráfico, gere os dados no formato especial abaixo
4. Sugira o tipo de gráfico mais adequado (bar, pie, donut, line, area)
5. Seja preciso com os dados - use apenas os dados reais dos pacientes fornecidos
6. Se não houver dados suficientes, informe o usuário

FORMATO DE GRÁFICO (use quando solicitado):
Insira um bloco de código com a tag "chart" contendo um JSON válido:
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
