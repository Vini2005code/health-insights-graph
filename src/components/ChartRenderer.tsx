import { useRef } from "react";
import {
  BarChart, Bar, PieChart, Pie, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download } from "lucide-react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

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

const ChartRenderer = ({ chart }: { chart: ChartData }) => {
  const chartRef = useRef<HTMLDivElement>(null);

  const exportPDF = async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { scale: 2, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("landscape", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = pdf.internal.pageSize.getHeight();

    pdf.setFontSize(18);
    pdf.text(chart.title, pdfW / 2, 15, { align: "center" });
    pdf.setFontSize(10);
    pdf.text(`Gerado em: ${new Date().toLocaleString("pt-BR")}`, pdfW / 2, 22, { align: "center" });

    const imgW = pdfW - 40;
    const imgH = (canvas.height / canvas.width) * imgW;
    pdf.addImage(imgData, "PNG", 20, 30, imgW, Math.min(imgH, pdfH - 50));

    // Data summary table
    const startY = Math.min(imgH + 40, pdfH - 30);
    if (startY < pdfH - 15) {
      pdf.setFontSize(9);
      chart.data.forEach((row, i) => {
        const y = startY + i * 5;
        if (y < pdfH - 10) {
          pdf.text(`${row[chart.xKey]}: ${row[chart.yKey]}`, 20, y);
        }
      });
    }

    pdf.save(`${chart.title.replace(/\s+/g, "_")}.pdf`);
  };

  const renderChart = () => {
    const { type, data, xKey, yKey } = chart;

    if (type === "pie" || type === "donut") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              dataKey={yKey}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={100}
              innerRadius={type === "donut" ? 50 : 0}
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (type === "line") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey={yKey} stroke={COLORS[0]} strokeWidth={2} dot={{ r: 4 }} />
          </LineChart>
        </ResponsiveContainer>
      );
    }

    if (type === "area") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={xKey} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey={yKey} stroke={COLORS[0]} fill={COLORS[0]} fillOpacity={0.3} />
          </AreaChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey={xKey} />
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

  return (
    <Card className="my-3">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{chart.title}</CardTitle>
        <Button variant="outline" size="sm" onClick={exportPDF} className="gap-2">
          <Download className="h-3.5 w-3.5" />
          PDF
        </Button>
      </CardHeader>
      <CardContent>
        <div ref={chartRef}>{renderChart()}</div>
      </CardContent>
    </Card>
  );
};

export default ChartRenderer;
