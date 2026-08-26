import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Search, Edit, Trash2, Power, PowerOff, UserCircle, KeyRound, Eye } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { UserProfilePhotoField } from "@/components/UserProfilePhotoField";

export default function Users() {
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const authMode = (import.meta.env.VITE_AUTH_MODE as string) || "local";

  // Form states
  const [formData, setFormData] = useState({
    openId: "",
    name: "",
    email: "",
    password: "",
    role: "collaborator" as "superadmin" | "admin" | "collaborator",
    studioId: null as number | null,
    artistId: null as number | null,
    profilePhotoUrl: null as string | null,
    profilePhotoKey: null as string | null,
  });
  const [newPassword, setNewPassword] = useState("");
  const [createError, setCreateError] = useState("");

  const utils = trpc.useUtils();
  const { data: users, isLoading } = trpc.users.list.useQuery();
  const { data: artists } = trpc.artists.list.useQuery();

  const createLocalUserMutation = trpc.users.createLocal.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      utils.users.list.invalidate();
      setIsCreateModalOpen(false);
      setCreateError("");
      resetForm();
    },
    onError: (error) => {
      const msg = error.message || "Erro ao criar usuário";
      setCreateError(msg);
      toast.error(msg);
    },
  });

  const setPasswordMutation = trpc.users.setPassword.useMutation({
    onSuccess: () => {
      toast.success("Senha atualizada com sucesso!");
      setIsPasswordModalOpen(false);
      setNewPassword("");
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar senha: ${error.message}`);
    },
  });

  const createUserMutation = trpc.users.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      utils.users.list.invalidate();
      setIsCreateModalOpen(false);
      setCreateError("");
      resetForm();
    },
    onError: (error) => {
      const msg = error.message || "Erro ao criar usuário";
      setCreateError(msg);
      toast.error(msg);
    },
  });

  const updateUserMutation = trpc.users.update.useMutation({
    onSuccess: async () => {
      toast.success("Usuário atualizado com sucesso!");
      await Promise.all([utils.users.list.invalidate(), utils.auth.me.invalidate()]);
      setIsEditModalOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error(`Erro ao atualizar usuário: ${error.message}`);
    },
  });

  const deleteUserMutation = trpc.users.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso!");
      utils.users.list.invalidate();
      setIsDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error) => {
      toast.error(`Erro ao excluir usuário: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      openId: "",
      name: "",
      email: "",
      password: "",
      role: "collaborator",
      studioId: null,
      artistId: null,
      profilePhotoUrl: null,
      profilePhotoKey: null,
    });
    setCreateError("");
  };

  const handleCreate = () => {
    setCreateError("");
    if (authMode === "local") {
      if (!formData.name.trim()) {
        setCreateError("Nome é obrigatório");
        return;
      }
      if (!formData.email.trim()) {
        setCreateError("E-mail é obrigatório");
        return;
      }
      if (!formData.password || formData.password.length < 6) {
        setCreateError("Senha deve ter no mínimo 6 caracteres");
        return;
      }
      createLocalUserMutation.mutate({
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password,
        role: formData.role,
        studioId: formData.studioId,
        artistId: formData.artistId,
        profilePhotoUrl: formData.profilePhotoUrl,
        profilePhotoKey: formData.profilePhotoKey,
      });
    } else {
      if (!formData.openId || !formData.name) {
        setCreateError("Preencha todos os campos obrigatórios");
        return;
      }
      createUserMutation.mutate(formData);
    }
  };

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setFormData({
      openId: user.openId,
      name: user.name || "",
      email: user.email || "",
      password: "",
      role: user.role,
      studioId: user.studioId,
      artistId: user.artistId,
      profilePhotoUrl: user.profilePhotoUrl ?? null,
      profilePhotoKey: user.profilePhotoKey ?? null,
    });
    setIsEditModalOpen(true);
  };

  const handleOpenSetPassword = (user: any) => {
    setSelectedUser(user);
    setNewPassword("");
    setIsPasswordModalOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedUser || !formData.name) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    updateUserMutation.mutate({
      id: selectedUser.id,
      name: formData.name,
      email: formData.email || undefined,
      role: formData.role,
      artistId: formData.artistId,
      profilePhotoUrl: formData.profilePhotoUrl,
      profilePhotoKey: formData.profilePhotoKey,
    });
  };

  const handleToggleStatus = (user: any) => {
    updateUserMutation.mutate({
      id: user.id,
      isActive: user.isActive === 1 ? 0 : 1,
    });
  };

  const handleDeleteConfirm = (user: any) => {
    setSelectedUser(user);
    setIsDeleteDialogOpen(true);
  };

  const handleDelete = () => {
    if (selectedUser) {
      deleteUserMutation.mutate({ id: selectedUser.id });
    }
  };

  // Filtrar usuários
  const filteredUsers = users?.filter((user) => {
    const matchesSearch =
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.openId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    const matchesStatus = statusFilter === "all" || (statusFilter === "active" ? user.isActive === 1 : user.isActive === 0);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleBadge = (role: string) => {
    const variants: Record<string, { variant: any; label: string }> = {
      superadmin: { variant: "destructive", label: "Super Admin" },
      admin: { variant: "default", label: "Admin" },
      collaborator: { variant: "secondary", label: "Colaborador" },
    };
    const config = variants[role] || variants.collaborator;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getStatusBadge = (isActive: number) => {
    return isActive === 1 ? (
      <Badge variant="default" className="bg-green-600">
        Ativo
      </Badge>
    ) : (
      <Badge variant="destructive">Inativo</Badge>
    );
  };

  return (
    <div className="container py-4 sm:py-8">
      <div className="mb-4 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Gerenciamento de Usuários</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">Gerencie contas de usuários e artistas do sistema</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg sm:text-xl">Usuários do Sistema</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Lista de todos os usuários cadastrados</CardDescription>
            </div>
            <Button onClick={() => { resetForm(); setIsCreateModalOpen(true); }} className="w-full sm:w-auto text-xs sm:text-sm">
              <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Novo Usuário
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filtros */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6 flex-wrap">
            <div className="flex-1 min-w-[150px] sm:min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 sm:pl-9 text-xs sm:text-sm"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-full sm:w-[140px] text-xs sm:text-sm">
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os roles</SelectItem>
                <SelectItem value="superadmin">Super Admin</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="collaborator">Colaborador</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[140px] text-xs sm:text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Tabela de usuários */}
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : filteredUsers && filteredUsers.length > 0 ? (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs sm:text-sm">Nome</TableHead>
                  <TableHead className="hidden sm:table-cell text-xs sm:text-sm">Email</TableHead>
                  <TableHead className="text-xs sm:text-sm">Role</TableHead>
                  <TableHead className="hidden md:table-cell text-xs sm:text-sm">Artista Vinculado</TableHead>
                  <TableHead className="text-xs sm:text-sm">Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => {
                  const linkedArtist = artists?.find((a) => a.id === user.artistId);
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">
                        <button
                          onClick={() => navigate(`/users/${user.id}`)}
                          className="flex items-center gap-2 hover:text-orange-400 transition-colors cursor-pointer text-left"
                        >
                          <Avatar className="h-9 w-9 border shrink-0">
                            {user.profilePhotoUrl && <AvatarImage src={user.profilePhotoUrl} alt={`Foto de ${user.name || "usuário"}`} className="object-cover" />}
                            <AvatarFallback className="text-xs">
                              {(user.name || "U").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="underline decoration-dotted underline-offset-4">
                            {user.name || "Sem nome"}
                          </span>
                        </button>
                      </TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>{getRoleBadge(user.role)}</TableCell>
                      <TableCell>{linkedArtist ? linkedArtist.name : "-"}</TableCell>
                      <TableCell>{getStatusBadge(user.isActive)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => navigate(`/users/${user.id}`)} title="Ver detalhes">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(user)} title="Editar">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleToggleStatus(user)}
                            title={user.isActive === 1 ? "Desativar" : "Ativar"}
                          >
                            {user.isActive === 1 ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                          </Button>
                          {authMode === "local" && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenSetPassword(user)}
                              title="Redefinir senha"
                            >
                              <KeyRound className="h-4 w-4 text-blue-500" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteConfirm(user)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <UserCircle className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum usuário encontrado</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de Confirmação de Exclusão */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">Excluir Usuário</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir <strong>{selectedUser?.name}</strong>? Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
            <p className="text-sm text-red-400">
              O usuário será permanentemente removido do sistema.
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

      {/* Modal de Redefinir Senha */}
      <Dialog open={isPasswordModalOpen} onOpenChange={setIsPasswordModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>
              Defina uma nova senha para {selectedUser?.name || "o usuário"}.
            </DialogDescription>
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
              onClick={() => selectedUser && setPasswordMutation.mutate({ id: selectedUser.id, password: newPassword })}
              disabled={setPasswordMutation.isPending || newPassword.length < 6}
            >
              {setPasswordMutation.isPending ? "Salvando..." : "Salvar Senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Criação */}
      <Dialog open={isCreateModalOpen} onOpenChange={(open) => { setIsCreateModalOpen(open); if (!open) setCreateError(""); }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Criar Novo Usuário</DialogTitle>
            <DialogDescription>Preencha os dados do novo usuário</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {createError && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                <p className="text-sm text-red-400 font-medium">{createError}</p>
              </div>
            )}
            {authMode !== "local" && (
            <div>
              <Label htmlFor="openId">
                Open ID <span className="text-red-500">*</span>
              </Label>
              <Input
                id="openId"
                value={formData.openId}
                onChange={(e) => setFormData({ ...formData, openId: e.target.value })}
                placeholder="ID único do usuário"
              />
            </div>
            )}
            <UserProfilePhotoField
              name={formData.name}
              profilePhotoUrl={formData.profilePhotoUrl}
              profilePhotoKey={formData.profilePhotoKey}
              onChange={(photo) => setFormData({ ...formData, ...photo })}
              disabled={createUserMutation.isPending || createLocalUserMutation.isPending}
            />
            <div>
              <Label htmlFor="name">
                Nome <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Nome completo"
              />
            </div>
            <div>
              <Label htmlFor="email">
                Email {authMode === "local" && <span className="text-red-500">*</span>}
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
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
                <Label htmlFor="artistId">Artista Vinculado</Label>
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
            {authMode === "local" && (
              <div>
                <Label htmlFor="create-password">
                  Senha <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="create-password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={createUserMutation.isPending || createLocalUserMutation.isPending}>
              {(createUserMutation.isPending || createLocalUserMutation.isPending) ? "Criando..." : "Criar Usuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Edição */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Atualize os dados do usuário</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <UserProfilePhotoField
              name={formData.name}
              profilePhotoUrl={formData.profilePhotoUrl}
              profilePhotoKey={formData.profilePhotoKey}
              onChange={(photo) => setFormData({ ...formData, ...photo })}
              disabled={updateUserMutation.isPending}
            />
            <div>
              <Label htmlFor="edit-name">
                Nome <span className="text-red-500">*</span>
              </Label>
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
              <Label htmlFor="edit-role">Role</Label>
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
                <Label htmlFor="edit-artistId">Artista Vinculado</Label>
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
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdate} disabled={updateUserMutation.isPending}>
              {updateUserMutation.isPending ? "Salvando..." : "Salvar Alterações"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
