import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search } from "lucide-react";

type Patient = {
  id: string;
  name: string;
  age: number;
  gender: string;
  diagnosis: string | null;
  admission_date: string;
  status: string;
  notes: string | null;
};

const emptyForm = { name: "", age: "", gender: "masculino", diagnosis: "", admission_date: new Date().toISOString().split("T")[0], status: "ativo", notes: "" };

const Patients = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => { if (user) loadPatients(); }, [user]);

  const loadPatients = async () => {
    const { data } = await supabase.from("patients").select("*").order("created_at", { ascending: false });
    if (data) setPatients(data);
  };

  const handleSave = async () => {
    if (!user || !form.name || !form.age) return;

    const payload = {
      user_id: user.id,
      name: form.name.trim(),
      age: parseInt(form.age),
      gender: form.gender,
      diagnosis: form.diagnosis || null,
      admission_date: form.admission_date,
      status: form.status,
      notes: form.notes || null,
    };

    if (editingId) {
      const { error } = await supabase.from("patients").update(payload).eq("id", editingId);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Paciente atualizado" });
    } else {
      const { error } = await supabase.from("patients").insert(payload);
      if (error) { toast({ title: "Erro", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Paciente cadastrado" });
    }

    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    loadPatients();
  };

  const handleEdit = (p: Patient) => {
    setEditingId(p.id);
    setForm({
      name: p.name,
      age: String(p.age),
      gender: p.gender,
      diagnosis: p.diagnosis || "",
      admission_date: p.admission_date,
      status: p.status,
      notes: p.notes || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    await supabase.from("patients").delete().eq("id", id);
    toast({ title: "Paciente removido" });
    loadPatients();
  };

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.diagnosis || "").toLowerCase().includes(search.toLowerCase())
  );

  const statusColor = (s: string) => {
    if (s === "ativo") return "default";
    if (s === "alta") return "secondary";
    return "outline";
  };

  return (
    <div className="p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Pacientes</h1>
          <p className="text-sm text-muted-foreground">{patients.length} pacientes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 w-60"
            />
          </div>
          <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingId(null); setForm(emptyForm); } }}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" /> Novo</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Paciente" : "Novo Paciente"}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Idade *</Label>
                    <Input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} min={0} max={200} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gênero</Label>
                    <Select value={form.gender} onValueChange={(v) => setForm({ ...form, gender: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="masculino">Masculino</SelectItem>
                        <SelectItem value="feminino">Feminino</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ativo">Ativo</SelectItem>
                        <SelectItem value="inativo">Inativo</SelectItem>
                        <SelectItem value="alta">Alta</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Diagnóstico</Label>
                  <Input value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Data de Admissão</Label>
                  <Input type="date" value={form.admission_date} onChange={(e) => setForm({ ...form, admission_date: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
                </div>
                <Button onClick={handleSave} className="w-full">{editingId ? "Salvar" : "Cadastrar"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome</TableHead>
              <TableHead>Idade</TableHead>
              <TableHead>Gênero</TableHead>
              <TableHead>Diagnóstico</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Admissão</TableHead>
              <TableHead className="w-20">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-32 text-center text-muted-foreground">Nenhum paciente encontrado</TableCell></TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{p.age}</TableCell>
                  <TableCell className="capitalize">{p.gender}</TableCell>
                  <TableCell>{p.diagnosis || "—"}</TableCell>
                  <TableCell><Badge variant={statusColor(p.status)}>{p.status}</Badge></TableCell>
                  <TableCell>{new Date(p.admission_date).toLocaleDateString("pt-BR")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default Patients;
