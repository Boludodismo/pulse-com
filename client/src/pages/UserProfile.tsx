import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  ArrowLeft,
  UserCircle,
  Mail,
  Shield,
  Calendar,
  Clock,
  Palette,
  Edit,
  Trash2,
  KeyRound,
  Power,
  PowerOff,
} from "lucide-react";

export default function UserProfile() {
  const params = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const userId = parseInt(params.id || "0");

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    role: "collaborator" as "superadmin" | "admin" | "collaborator",
    artistId: null as number | null,
  });

  const authMode = (import.meta.env.VITE_AUTH_MODE as string) || "local";
  const utils = trpc.useUtils();

  const { data: user, isLoading } = trpc.users.getById.useQuery(
    { id: userId },
    { enabled: userId > 0 }
  );

  const { data: artists } = trpc.artists.list.useQuery();

  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso!");
      utils.users.getById.invalidate({ id: userId });
      utils.users.list.invalidate();
      setIsEditModalOpen(false);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const setPasswordMutation = trpc.users.setPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha atualizada com sucesso!");
      setIsPasswordModalOpen(false);
      setNewPassword("");
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar senha: ${error.message}`);
    },
  });

  const deleteUserMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso!");
      navigate("/users");
    },
    onError: (error) => {
      toast.error(`Erro ao excluir: ${error.message}`);
    },
  });

  const handleOpenEdit = () => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        role: user.role as "superadmin" | "admin" | "collaborator",
        artistId: user.artistId ?? null,
      });
      setIsEditModalOpen(true);
    }
  };

  const handleUpdate = () => {
    if (!formData.name) {
      toast.error("Nome é obrigatório");
      return;
    }
    updateUserMutation.mutate({
      id: userId,
      name: formData.name,
      email: formData.email || undefined,
      role: formData.role,
      artistId: formData.artistId,
    });
  };

  const handleToggleStatus = () => {
    if (user) {
      updateUserMutation.mutate({
        id: userId,
        isActive: user.isActive === 1 ? 0 : 1,
      });
    }
  };

  const handleDelete = () => {
    deleteUserMutation.mutate({ id: userId });
  };

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { variant: any; label: string; color: string }> = {
      superadmin: { variant: "destructive", label: "Super Admin", color: "text-red-400" },
      admin: { variant: "default", label: "Admin", color: "text-orange-400" },
      collaborator: { variant: "secondary", label: "Colaborador", color: "text-blue-400" },
    };
    const config = variants[role] || variants.collaborator;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return "Nunca";
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="container py-8">
        <Skeleton className="h-8 w-48 mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container py-8">
        <Button variant="ghost" onClick={() => navigate("/users")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <div className="text-center py-12">
          <UserCircle className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Usuário não encontrado</h2>
          <p className="text-muted-foreground">O usuário solicitado não existe ou foi removido.</p>
        </div>
      </div>
    );
  }

  const linkedArtist = artists?.find((a) => a.id === user.artistId);

  return (
    <div className="container py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => navigate("/users")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{user.name || "Sem nome"}</h1>
            <p className="text-muted-foreground">{user.email || "Sem e-mail"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleOpenEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          {authMode === "local" && (
            <Button variant="outline" onClick={() => { setNewPassword(""); setIsPasswordModalOpen(true); }}>
              <KeyRound className="mr-2 h-4 w-4" />
              Redefinir Senha
            </Button>
          )}
          <Button
            variant="outline"
            onClick={handleToggleStatus}
            className={user.isActive === 1 ? "text-yellow-500 border-yellow-500" : "text-green-500 border-green-500"}
          >
            {user.isActive === 1 ? <PowerOff className="mr-2 h-4 w-4" /> : <Power className="mr-2 h-4 w-4" />}
            {user.isActive === 1 ? "Desativar" : "Ativar"}
          </Button>
          <Button variant="destructive" onClick={() => setIsDeleteDialogOpen(true)}>
            <Trash2 className="mr-2 h-4 w-4" />
            Excluir
          </Button>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Informações Básicas */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCircle className="h-5 w-5" />
              Informações Básicas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nome</p>
              <p className="font-medium">{user.name || "Não informado"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">E-mail</p>
              <p className="font-medium flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                {user.email || "Não informado"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              {user.isActive === 1 ? (
                <Badge variant="default" className="bg-green-600">Ativo</Badge>
              ) : (
                <Badge variant="destructive">Inativo</Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Permissões */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Permissões e Acesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Role</p>
              <div className="mt-1">{getRoleBadge(user.role)}</div>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Artista Vinculado</p>
              <p className="font-medium flex items-center gap-2">
                {linkedArtist ? (
                  <>
                    <Palette className="h-4 w-4 text-muted-foreground" />
                    {linkedArtist.name}
                  </>
                ) : (
                  <span className="text-muted-foreground">Nenhum</span>
                )}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Método de Login</p>
              <p className="font-medium">
                {user.loginMethod === "local" ? "E-mail + Senha" : user.loginMethod === "manus" ? "OAuth (Manus)" : user.loginMethod || "Local"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Atividade */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Atividade
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Criado em</p>
              <p className="font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {formatDate(user.createdAt as any)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Último acesso</p>
              <p className="font-medium flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                {formatDate(user.lastSignedIn as any)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">ID do Sistema</p>
              <p className="font-mono text-sm text-muted-foreground">{user.openId}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Modal de Edição */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Atualize os dados de {user.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Nome <span className="text-red-500">*</span></Label>
              <Input
                id="edit-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label>Role</Label>
              <Select value={formData.role} onValueChange={(value: any) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="collaborator">Colaborador</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="superadmin">Super Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {formData.role === "collaborator" && (
              <div>
                <Label>Artista Vinculado</Label>
                <Select
                  value={formData.artistId?.toString() || "none"}
                  onValueChange={(value) => setFormData({ ...formData, artistId: value === "none" ? null : parseInt(value) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um artista" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {artists?.map((artist) => (
                      <SelectItem key={artist.id} value={artist.id.toString()}>
                        {artist.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Redefinir Senha */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>Defina uma nova senha para {user.name}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="new-password">Nova Senha <span className="text-red-500">*</span></Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
                minLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPasswordModalOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => setPasswordMutation.mutate({ id: userId, password: newPassword })}
              disabled={setPasswordMutation.isPending || newPassword.length < 6}
            >
              {setPasswordMutation.isPending ? "Salvando..." : "Salvar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">Excluir Usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{user.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-sm text-red-400">
              O usuário será permanentemente removido do sistema. Todos os registros de auditoria serão mantidos.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteUserMutation.isPending}
            >
              {deleteUserMutation.isPending ? "Excluindo..." : "Confirmar Exclusão"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
