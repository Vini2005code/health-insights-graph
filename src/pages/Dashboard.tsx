import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, UserX, Activity, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { renderChartContent, type ChartData } from "@/components/ChartRenderer";
import {
  BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = [
  "hsl(210, 78%, 46%)", "hsl(168, 76%, 42%)", "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)", "hsl(262, 80%, 50%)", "hsl(142, 76%, 36%)",
];

type Patient = {
  age: number;
  gender: string;
  diagnosis: string | null;
  status: string;
};

type PinnedChart = {
  id: string;
  title: string;
  chart_type: string;
  chart_data: any;
  x_key: string;
  y_key: string;
};

const Dashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pinnedCharts, setPinnedCharts] = useState<PinnedChart[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from("patients").select("age, gender, diagnosis, status").then(({ data }) => {
      if (data) setPatients(data);
    });
    loadPinnedCharts();
  }, [user]);

  const loadPinnedCharts = async () => {
    const { data } = await supabase
      .from("dashboard_charts")
      .select("*")
      .order("position");
    if (data) setPinnedCharts(data as PinnedChart[]);
  };

  const removePinnedChart = async (id: string) => {
    await supabase.from("dashboard_charts").delete().eq("id", id);
    setPinnedCharts((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Removido", description: "Gráfico removido do dashboard." });
  };

  const total = patients.length;
  const active = patients.filter((p) => p.status === "ativo").length;
  const discharged = patients.filter((p) => p.status === "alta").length;
  const avgAge = total ? Math.round(patients.reduce((s, p) => s + p.age, 0) / total) : 0;

  const ageBuckets = [
    { range: "0-17", count: patients.filter((p) => p.age <= 17).length },
    { range: "18-30", count: patients.filter((p) => p.age >= 18 && p.age <= 30).length },
    { range: "31-45", count: patients.filter((p) => p.age >= 31 && p.age <= 45).length },
    { range: "46-60", count: patients.filter((p) => p.age >= 46 && p.age <= 60).length },
    { range: "60+", count: patients.filter((p) => p.age > 60).length },
  ];

  const genderData = Object.entries(
    patients.reduce((acc, p) => { acc[p.gender] = (acc[p.gender] || 0) + 1; return acc; }, {} as Record<string, number>)
  ).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));

  const diagCounts = patients
    .filter((p) => p.diagnosis)
    .reduce((acc, p) => { acc[p.diagnosis!] = (acc[p.diagnosis!] || 0) + 1; return acc; }, {} as Record<string, number>);
  const topDiag = Object.entries(diagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count }));

  const stats = [
    { label: "Total", value: total, icon: Users, color: "text-primary" },
    { label: "Ativos", value: active, icon: UserCheck, color: "text-medical-success" },
    { label: "Alta", value: discharged, icon: UserX, color: "text-medical-warning" },
    { label: "Idade Média", value: avgAge, icon: Activity, color: "text-medical-info" },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="flex items-center gap-4 p-4">
              <div className={`rounded-lg bg-muted p-2.5 ${s.color}`}>
                <s.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-2xl font-bold">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pinned charts from chat */}
      {pinnedCharts.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Gráficos Fixados ({pinnedCharts.length}/10)</h2>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {pinnedCharts.map((pc) => {
              const chartData: ChartData = {
                type: pc.chart_type as ChartData["type"],
                title: pc.title,
                data: pc.chart_data,
                xKey: pc.x_key,
                yKey: pc.y_key,
              };
              return (
                <Card key={pc.id}>
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <CardTitle className="text-base">{pc.title}</CardTitle>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      onClick={() => removePinnedChart(pc.id)}
                      title="Remover do dashboard"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {renderChartContent(chartData)}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Faixa Etária</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={ageBuckets}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" name="Pacientes" radius={[4, 4, 0, 0]}>
                  {ageBuckets.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Distribuição por Gênero</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={genderData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {genderData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {topDiag.length > 0 && (
          <Card className="lg:col-span-2">
            <CardHeader><CardTitle className="text-base">Diagnósticos Mais Comuns</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={topDiag} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={150} />
                  <Tooltip />
                  <Bar dataKey="count" name="Pacientes" radius={[0, 4, 4, 0]}>
                    {topDiag.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
