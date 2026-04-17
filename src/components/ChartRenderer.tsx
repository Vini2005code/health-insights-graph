import { useRef, useState } from "react";
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, LayoutDashboard, X } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

export type ChartData = {
  type: "bar" | "pie" | "line" | "area" | "donut";
  title: string;
  data: Array<Record<string, string | number>>;
  xKey: string;
  yKey: string;
};

const COLORS = [
  "hsl(210, 78%, 46%)", "hsl(168, 76%, 42%)", "hsl(38, 92%, 50%)",
  "hsl(0, 84%, 60%)", "hsl(262, 80%, 50%)", "hsl(142, 76%, 36%)",
  "hsl(280, 65%, 60%)", "hsl(20, 90%, 50%)",
];

export const renderChartContent = (chart: ChartData) => {
  const { type, data, xKey, yKey } = chart;

  // Altura dinâmica conforme volume de dados
  const count = data.length;
  const height =
    type === "pie" || type === "donut"
      ? Math.min(480, 320 + Math.max(0, count - 6) * 8)
      : Math.min(520, 320 + Math.max(0, count - 8) * 6);

  if (type === "pie" || type === "donut") {
    const compact = count > 8;
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey={yKey}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            outerRadius={compact ? 110 : 100}
            innerRadius={type === "donut" ? (compact ? 60 : 50) : 0}
            label={
              compact
                ? ({ percent }) => `${(percent * 100).toFixed(0)}%`
                : ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`
            }
            labelLine={!compact}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
          <Legend
            layout={compact ? "vertical" : "horizontal"}
            align={compact ? "right" : "center"}
            verticalAlign={compact ? "middle" : "bottom"}
            wrapperStyle={compact ? { fontSize: 11, maxHeight: height - 40, overflowY: "auto" } : { fontSize: 12 }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  // XAxis adaptativo: rotaciona rótulos quando há muitas categorias
  const manyCats = count > 10;
  const xAxisProps = {
    dataKey: xKey,
    interval: 0 as const,
    angle: manyCats ? -35 : 0,
    textAnchor: manyCats ? ("end" as const) : ("middle" as const),
    height: manyCats ? 80 : 30,
    tick: { fontSize: manyCats ? 11 : 12 },
  };

  if (type === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: manyCats ? 20 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis {...xAxisProps} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line
            type="monotone"
            dataKey={yKey}
            stroke={COLORS[0]}
            strokeWidth={2}
            dot={count > 30 ? false : { r: 3 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (type === "area") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <AreaChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: manyCats ? 20 : 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis {...xAxisProps} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Area type="monotone" dataKey={yKey} stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: manyCats ? 20 : 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis {...xAxisProps} />
        <YAxis />
        <Tooltip />
        <Legend />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const ChartRenderer = ({ chart, showPin = true }: { chart: ChartData; showPin?: boolean }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const chartRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const exportPDF = async () => {
    if (!chartRef.current) return;

    toast({ title: "Gerando PDF...", description: "Capturando o gráfico em alta resolução." });

    const canvas = await html2canvas(chartRef.current, {
      scale: 3,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
    });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("landscape", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    // Brand colors (matches design system: primary hsl(210,78%,46%))
    const PRIMARY: [number, number, number] = [25, 99, 178];
    const ACCENT: [number, number, number] = [26, 175, 152];
    const TEXT_DARK: [number, number, number] = [30, 41, 59];
    const TEXT_MUTED: [number, number, number] = [100, 116, 139];
    const BORDER: [number, number, number] = [226, 232, 240];
    const ROW_ALT: [number, number, number] = [248, 250, 252];

    // === HEADER BAR ===
    pdf.setFillColor(...PRIMARY);
    pdf.rect(0, 0, pdfW, 18, "F");
    pdf.setFillColor(...ACCENT);
    pdf.rect(0, 18, pdfW, 1.5, "F");

    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Primordial Data", 12, 11.5);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.text("Relatório Analítico", pdfW - 12, 11.5, { align: "right" });

    // === TITLE BLOCK ===
    pdf.setTextColor(...TEXT_DARK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(18);
    pdf.text(chart.title, pdfW / 2, 30, { align: "center" });

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);
    pdf.setTextColor(...TEXT_MUTED);
    const now = new Date();
    const dateStr = now.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
    const timeStr = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    pdf.text(`Gerado em ${dateStr} às ${timeStr}`, pdfW / 2, 36, { align: "center" });

    // Decorative divider
    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.3);
    pdf.line(pdfW / 2 - 25, 39, pdfW / 2 + 25, 39);

    // === CHART IMAGE ===
    const chartTop = 44;
    const chartMaxH = 110;
    const maxImgW = pdfW - 40;
    const ratio = canvas.height / canvas.width;
    let imgW = maxImgW;
    let imgH = imgW * ratio;
    if (imgH > chartMaxH) {
      imgH = chartMaxH;
      imgW = imgH / ratio;
    }
    const imgX = (pdfW - imgW) / 2;

    // Subtle shadow box behind chart
    pdf.setFillColor(245, 247, 250);
    pdf.roundedRect(imgX - 3, chartTop - 2, imgW + 6, imgH + 4, 2, 2, "F");
    pdf.addImage(imgData, "PNG", imgX, chartTop, imgW, imgH);

    // === DATA TABLE ===
    const tableTop = chartTop + imgH + 8;
    const totalNumeric = chart.data.reduce((s, r) => {
      const v = Number(r[chart.yKey]);
      return s + (isNaN(v) ? 0 : v);
    }, 0);

    // Section header
    pdf.setTextColor(...TEXT_DARK);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(10);
    pdf.text("Dados Detalhados", 20, tableTop);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(...TEXT_MUTED);
    pdf.text(`${chart.data.length} ${chart.data.length === 1 ? "registro" : "registros"}`, pdfW - 20, tableTop, { align: "right" });

    // Table
    const tableY = tableTop + 3;
    const colW = [pdfW * 0.4, pdfW * 0.2, pdfW * 0.2];
    const colX = [20, 20 + colW[0], 20 + colW[0] + colW[1]];
    const rowH = 5.5;

    // Header row
    pdf.setFillColor(...PRIMARY);
    pdf.rect(20, tableY, pdfW - 40, rowH, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8.5);
    pdf.text(String(chart.xKey).toUpperCase(), colX[0] + 2, tableY + 3.7);
    pdf.text(String(chart.yKey).toUpperCase(), colX[1] + 2, tableY + 3.7);
    pdf.text("PARTICIPAÇÃO", colX[2] + 2, tableY + 3.7);

    // Data rows
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    let y = tableY + rowH;
    const maxRows = Math.floor((pdfH - y - 18) / rowH);
    const visible = chart.data.slice(0, maxRows);

    visible.forEach((row, i) => {
      if (i % 2 === 0) {
        pdf.setFillColor(...ROW_ALT);
        pdf.rect(20, y, pdfW - 40, rowH, "F");
      }
      const val = Number(row[chart.yKey]);
      const pct = totalNumeric > 0 && !isNaN(val) ? ((val / totalNumeric) * 100).toFixed(1) : "—";
      pdf.setTextColor(...TEXT_DARK);
      pdf.text(String(row[chart.xKey]), colX[0] + 2, y + 3.7);
      pdf.text(String(row[chart.yKey]), colX[1] + 2, y + 3.7);
      pdf.setTextColor(...TEXT_MUTED);
      pdf.text(pct === "—" ? "—" : `${pct}%`, colX[2] + 2, y + 3.7);
      y += rowH;
    });

    // Totals row
    if (visible.length === chart.data.length && totalNumeric > 0) {
      pdf.setFillColor(...BORDER);
      pdf.rect(20, y, pdfW - 40, rowH, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(...TEXT_DARK);
      pdf.text("TOTAL", colX[0] + 2, y + 3.7);
      pdf.text(String(totalNumeric), colX[1] + 2, y + 3.7);
      pdf.text("100.0%", colX[2] + 2, y + 3.7);
      y += rowH;
    }

    // Truncation note
    if (visible.length < chart.data.length) {
      pdf.setFont("helvetica", "italic");
      pdf.setFontSize(7);
      pdf.setTextColor(...TEXT_MUTED);
      pdf.text(`+ ${chart.data.length - visible.length} registros adicionais omitidos`, 20, y + 4);
    }

    // === FOOTER ===
    const footerY = pdfH - 8;
    pdf.setDrawColor(...BORDER);
    pdf.setLineWidth(0.2);
    pdf.line(20, footerY - 4, pdfW - 20, footerY - 4);

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    pdf.setTextColor(...TEXT_MUTED);
    pdf.text("Primordial Data — Análise Inteligente de Dados Clínicos", 20, footerY);
    pdf.text(`Página 1 de 1`, pdfW - 20, footerY, { align: "right" });

    const safeName = chart.title.replace(/[^\w\s-]/g, "").replace(/\s+/g, "_");
    const stamp = now.toISOString().slice(0, 10);
    pdf.save(`${safeName}_${stamp}.pdf`);

    toast({ title: "PDF exportado!", description: "O download começou automaticamente." });
  };

  const pinToDashboard = async () => {
    setContextMenu(null);
    if (!user) return;

    // Check limit
    const { count } = await supabase
      .from("dashboard_charts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id);

    if ((count ?? 0) >= 10) {
      toast({ title: "Limite atingido", description: "Máximo de 10 gráficos no dashboard. Remova um antes de adicionar.", variant: "destructive" });
      return;
    }

    const { error } = await supabase.from("dashboard_charts").insert({
      user_id: user.id,
      title: chart.title,
      chart_type: chart.type,
      chart_data: chart.data as any,
      x_key: chart.xKey,
      y_key: chart.yKey,
      position: (count ?? 0),
    });

    if (error) {
      toast({ title: "Erro", description: "Não foi possível fixar o gráfico.", variant: "destructive" });
    } else {
      toast({ title: "Adicionado!", description: "Gráfico adicionado ao dashboard." });
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    if (!showPin) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  return (
    <>
      <Card className="my-3" onContextMenu={handleContextMenu}>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base">{chart.title}</CardTitle>
          <div className="flex gap-1">
            {showPin && (
              <Button variant="outline" size="sm" onClick={pinToDashboard} className="gap-2" title="Adicionar ao dashboard">
                <LayoutDashboard className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
              <Download className="h-3.5 w-3.5" />
              PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div ref={chartRef}>{renderChartContent(chart)}</div>
        </CardContent>
      </Card>

      {/* Custom context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-50" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 min-w-[200px] rounded-lg border bg-popover p-1 shadow-md"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              onClick={pinToDashboard}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              Adicionar ao Dashboard
            </button>
            <button
              onClick={() => { setContextMenu(null); exportPDF(); }}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <Download className="h-4 w-4" />
              Exportar PDF
            </button>
          </div>
        </>
      )}
    </>
  );
};

export default ChartRenderer;
