import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { streamChat } from "@/lib/chatStream";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Plus, Send, Loader2, MessageSquare, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import ChartRenderer, { type ChartData } from "@/components/ChartRenderer";
import { cn } from "@/lib/utils";

type Message = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  chart_data?: ChartData | null;
};

type Conversation = {
  id: string;
  title: string;
  created_at: string;
};

const TEMPLATES = [
  "Quantos pacientes tenho cadastrados?",
  "Distribuição de pacientes por gênero",
  "Quais diagnósticos mais comuns?",
  "Pacientes com mais de 60 anos",
  "Pacientes admitidos nos últimos 30 dias",
];

const Chat = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConv, setActiveConv] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user) loadConversations();
  }, [user]);

  useEffect(() => {
    if (activeConv) loadMessages(activeConv);
  }, [activeConv]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadConversations = async () => {
    const { data } = await supabase
      .from("conversations")
      .select("*")
      .order("updated_at", { ascending: false });
    if (data) setConversations(data);
  };

  const loadMessages = async (convId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", convId)
      .order("created_at");
    if (data) {
      setMessages(
        data.map((m) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          content: m.content,
          chart_data: m.chart_data as ChartData | null,
        }))
      );
    }
  };

  const createConversation = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: "Nova conversa" })
      .select()
      .single();
    if (data) {
      setConversations((prev) => [data, ...prev]);
      setActiveConv(data.id);
      setMessages([]);
    }
  };

  const deleteConversation = async (id: string) => {
    await supabase.from("conversations").delete().eq("id", id);
    setConversations((prev) => prev.filter((c) => c.id !== id));
    if (activeConv === id) {
      setActiveConv(null);
      setMessages([]);
    }
  };

  const sendMessage = async (text?: string) => {
    const msgText = text || input.trim();
    if (!msgText || isLoading || !user) return;
    setInput("");

    let convId = activeConv;
    if (!convId) {
      const { data } = await supabase
        .from("conversations")
        .insert({ user_id: user.id, title: msgText.slice(0, 50) })
        .select()
        .single();
      if (!data) return;
      convId = data.id;
      setActiveConv(convId);
      setConversations((prev) => [data, ...prev]);
    } else {
      // Update title if first message
      if (messages.length === 0) {
        await supabase.from("conversations").update({ title: msgText.slice(0, 50) }).eq("id", convId);
        setConversations((prev) =>
          prev.map((c) => (c.id === convId ? { ...c, title: msgText.slice(0, 50) } : c))
        );
      }
    }

    const userMsg: Message = { role: "user", content: msgText };
    setMessages((prev) => [...prev, userMsg]);

    // Save user message
    await supabase.from("messages").insert({
      conversation_id: convId,
      user_id: user.id,
      role: "user",
      content: msgText,
    });

    setIsLoading(true);
    let assistantSoFar = "";

    const allMsgs = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    try {
      await streamChat({
        messages: allMsgs,
        onDelta: (chunk) => {
          assistantSoFar += chunk;
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant" && !last.id) {
              return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
            }
            return [...prev, { role: "assistant", content: assistantSoFar }];
          });
        },
        onDone: async () => {
          setIsLoading(false);

          // Try to parse chart data from response
          let chartData: ChartData | null = null;
          const chartMatch = assistantSoFar.match(/```chart\n([\s\S]*?)\n```/);
          if (chartMatch) {
            try {
              chartData = JSON.parse(chartMatch[1]);
            } catch {}
          }

          // Save assistant message
          const { data: savedMsg } = await supabase.from("messages").insert({
            conversation_id: convId!,
            user_id: user!.id,
            role: "assistant",
            content: assistantSoFar,
            chart_data: chartData as any,
          }).select().single();

          if (savedMsg) {
            setMessages((prev) =>
              prev.map((m, i) =>
                i === prev.length - 1
                  ? { ...m, id: savedMsg.id, chart_data: chartData }
                  : m
              )
            );
          }

          await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", convId!);
        },
      });
    } catch (e: any) {
      setIsLoading(false);
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  return (
    <div className="flex h-full">
      {/* Conversation sidebar */}
      <div className="hidden w-64 flex-col border-r bg-muted/30 md:flex">
        <div className="p-3">
          <Button onClick={createConversation} className="w-full gap-2" size="sm">
            <Plus className="h-4 w-4" /> Nova conversa
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="space-y-1 p-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm cursor-pointer transition-colors",
                  activeConv === conv.id
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground"
                )}
                onClick={() => setActiveConv(conv.id)}
              >
                <MessageSquare className="h-3.5 w-3.5 shrink-0" />
                <span className="flex-1 truncate">{conv.title}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Chat area */}
      <div className="flex flex-1 flex-col">
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-6 py-20">
              <div className="text-center">
                <h2 className="mb-2 text-xl font-semibold">Como posso ajudar?</h2>
                <p className="text-sm text-muted-foreground">
                  Faça perguntas sobre seus pacientes ou solicite gráficos
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2">
                {TEMPLATES.map((t) => (
                  <Button
                    key={t}
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => sendMessage(t)}
                  >
                    {t}
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <ReactMarkdown>
                          {msg.content.replace(/```chart\n[\s\S]*?\n```/g, "")}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                    {msg.chart_data && <ChartRenderer chart={msg.chart_data} />}
                  </div>
                </div>
              ))}
              {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
                <div className="flex justify-start">
                  <div className="rounded-2xl bg-muted px-4 py-3">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
              <div ref={scrollRef} />
            </div>
          )}
        </ScrollArea>

        <div className="border-t p-4">
          <form
            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
            className="mx-auto flex max-w-3xl gap-2"
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Faça uma pergunta sobre seus pacientes..."
              disabled={isLoading}
              className="flex-1"
            />
            <Button type="submit" disabled={isLoading || !input.trim()} size="icon">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
