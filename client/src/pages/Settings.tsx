import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Settings as SettingsIcon, Building2, Palette, Clock, Users, Loader2, Plus, Pencil, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export default function Settings() {
  const utils = trpc.useUtils();
  
  const { data: settings, isLoading } = trpc.settings.get.useQuery();
  const { data: artists } = trpc.artists.list.useQuery();
  
  const updateSettings = trpc.settings.update.useMutation({
    onSuccess: () => {
      toast.success("Configurações salvas com sucesso!");
      utils.settings.get.invalidate();
    },
    onError: () => {
      toast.error("Erro ao salvar configurações");
    },
  });

  const createArtist = trpc.artists.create.useMutation({
    onSuccess: (data) => {
      console.log('[Settings] Artist created successfully:', data);
      toast.success("Artista adicionado com sucesso!");
      utils.artists.list.invalidate();
      setArtistDialogOpen(false);
      setNewArtist({ name: "", email: "", phone: "", instagram: "", specialty: "", bio: "" });
    },
    onError: (error) => {
      console.error('[Settings] Error creating artist:', error);
      toast.error(`Erro ao adicionar artista: ${error.message}`);
    },
  });

  const deleteArtist = trpc.artists.delete.useMutation({
    onSuccess: () => {
      toast.success("Artista removido com sucesso!");
      utils.artists.list.invalidate();
    },
    onError: () => {
      toast.error("Erro ao remover artista");
    },
  });

  const [basicInfo, setBasicInfo] = useState({
    studioName: settings?.studioName || "",
    address: settings?.address || "",
    city: settings?.city || "",
    state: settings?.state || "",
    zipCode: settings?.zipCode || "",
    phone: settings?.phone || "",
    email: settings?.email || "",
    website: settings?.website || "",
    instagram: settings?.instagram || "",
  });

  const [visualIdentity, setVisualIdentity] = useState({
    primaryColor: settings?.primaryColor || "#f97316",
    secondaryColor: settings?.secondaryColor || "#fed7aa",
  });

  const [notificationSettings, setNotificationSettings] = useState({
    enableBirthdayReminders: settings?.enableBirthdayReminders === 1,
    enableAppointmentReminders: settings?.enableAppointmentReminders === 1,
    reminderDaysBefore: settings?.reminderDaysBefore ?? 1,
    reminderSendTime: settings?.reminderSendTime ?? "09:00",
    reminderResend: settings?.reminderResend === 1,
    reminderResendTime: settings?.reminderResendTime ?? "18:00",
  });

  // Sincroniza os estados quando os dados do servidor chegarem
  useEffect(() => {
    if (!settings) return;
    setBasicInfo({
      studioName: settings.studioName || "",
      address: settings.address || "",
      city: settings.city || "",
      state: settings.state || "",
      zipCode: settings.zipCode || "",
      phone: settings.phone || "",
      email: settings.email || "",
      website: settings.website || "",
      instagram: settings.instagram || "",
    });
    setVisualIdentity({
      primaryColor: settings.primaryColor || "#f97316",
      secondaryColor: settings.secondaryColor || "#fed7aa",
    });
    setNotificationSettings({
      enableBirthdayReminders: settings.enableBirthdayReminders === 1,
      enableAppointmentReminders: settings.enableAppointmentReminders === 1,
      reminderDaysBefore: settings.reminderDaysBefore ?? 1,
      reminderSendTime: settings.reminderSendTime ?? "09:00",
      reminderResend: settings.reminderResend === 1,
      reminderResendTime: settings.reminderResendTime ?? "18:00",
    });
  }, [settings]);

  const [artistDialogOpen, setArtistDialogOpen] = useState(false);
  const [newArtist, setNewArtist] = useState({
    name: "",
    email: "",
    phone: "",
    instagram: "",
    specialty: "",
    bio: "",
  });

  const handleSaveBasicInfo = () => {
    updateSettings.mutate(basicInfo);
  };

  const handleSaveVisualIdentity = () => {
    updateSettings.mutate(visualIdentity);
  };

  const handleSaveNotifications = () => {
    updateSettings.mutate({
      enableBirthdayReminders: notificationSettings.enableBirthdayReminders ? 1 : 0,
      enableAppointmentReminders: notificationSettings.enableAppointmentReminders ? 1 : 0,
      reminderDaysBefore: notificationSettings.reminderDaysBefore,
      reminderSendTime: notificationSettings.reminderSendTime,
      reminderResend: notificationSettings.reminderResend ? 1 : 0,
      reminderResendTime: notificationSettings.reminderResendTime,
    });
  };

  const handleCreateArtist = () => {
    if (!newArtist.name) {
      toast.error("Nome do artista é obrigatório");
      return;
    }
    createArtist.mutate(newArtist);
  };

  const handleDeleteArtist = (id: number) => {
    if (confirm("Tem certeza que deseja remover este artista?")) {
      deleteArtist.mutate({ id });
    }
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Configurações</h1>
          <p className="text-muted-foreground text-sm sm:text-base">
            Personalize as informações e a identidade visual do seu estúdio
          </p>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="basic" className="space-y-4 sm:space-y-6">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 gap-1">
            <TabsTrigger value="basic" className="text-xs sm:text-sm">
              <Building2 className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Informações</span>
              <span className="sm:hidden">Info</span>
            </TabsTrigger>
            <TabsTrigger value="visual" className="text-xs sm:text-sm">
              <Palette className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Visual</span>
              <span className="sm:hidden">Vis.</span>
            </TabsTrigger>
            <TabsTrigger value="artists" className="text-xs sm:text-sm">
              <Users className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Artistas</span>
              <span className="sm:hidden">Art.</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="text-xs sm:text-sm">
              <SettingsIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Notificações</span>
              <span className="sm:hidden">Not.</span>
            </TabsTrigger>
          </TabsList>

          {/* Informações Básicas */}
          <TabsContent value="basic" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Informações Básicas</CardTitle>
                <CardDescription>
                  Dados principais do estúdio
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="studioName">Nome do Estúdio</Label>
                    <Input
                      id="studioName"
                      value={basicInfo.studioName}
                      onChange={(e) => setBasicInfo({ ...basicInfo, studioName: e.target.value })}
                      placeholder="POD Tattoo Studio"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Telefone</Label>
                    <Input
                      id="phone"
                      value={basicInfo.phone}
                      onChange={(e) => setBasicInfo({ ...basicInfo, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                    />
                  </div>
                </div>

                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={basicInfo.email}
                      onChange={(e) => setBasicInfo({ ...basicInfo, email: e.target.value })}
                      placeholder="contato@podtattoo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="instagram">Instagram</Label>
                    <Input
                      id="instagram"
                      value={basicInfo.instagram}
                      onChange={(e) => setBasicInfo({ ...basicInfo, instagram: e.target.value })}
                      placeholder="@podtattoo"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    value={basicInfo.website}
                    onChange={(e) => setBasicInfo({ ...basicInfo, website: e.target.value })}
                    placeholder="https://podtattoo.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Endereço</Label>
                  <Input
                    id="address"
                    value={basicInfo.address}
                    onChange={(e) => setBasicInfo({ ...basicInfo, address: e.target.value })}
                    placeholder="Rua das Flores, 123"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="city">Cidade</Label>
                    <Input
                      id="city"
                      value={basicInfo.city}
                      onChange={(e) => setBasicInfo({ ...basicInfo, city: e.target.value })}
                      placeholder="São Paulo"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="state">Estado</Label>
                    <Input
                      id="state"
                      value={basicInfo.state}
                      onChange={(e) => setBasicInfo({ ...basicInfo, state: e.target.value })}
                      placeholder="SP"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">CEP</Label>
                    <Input
                      id="zipCode"
                      value={basicInfo.zipCode}
                      onChange={(e) => setBasicInfo({ ...basicInfo, zipCode: e.target.value })}
                      placeholder="01234-567"
                    />
                  </div>
                </div>

                <Button onClick={handleSaveBasicInfo} disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Informações"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Identidade Visual */}
          <TabsContent value="visual" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Identidade Visual</CardTitle>
                <CardDescription>
                  Personalize as cores do sistema
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="primaryColor">Cor Primária</Label>
                    <div className="flex gap-2">
                      <Input
                        id="primaryColor"
                        type="color"
                        value={visualIdentity.primaryColor}
                        onChange={(e) => setVisualIdentity({ ...visualIdentity, primaryColor: e.target.value })}
                        className="h-10 w-20"
                      />
                      <Input
                        value={visualIdentity.primaryColor}
                        onChange={(e) => setVisualIdentity({ ...visualIdentity, primaryColor: e.target.value })}
                        placeholder="#f97316"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryColor">Cor Secundária</Label>
                    <div className="flex gap-2">
                      <Input
                        id="secondaryColor"
                        type="color"
                        value={visualIdentity.secondaryColor}
                        onChange={(e) => setVisualIdentity({ ...visualIdentity, secondaryColor: e.target.value })}
                        className="h-10 w-20"
                      />
                      <Input
                        value={visualIdentity.secondaryColor}
                        onChange={(e) => setVisualIdentity({ ...visualIdentity, secondaryColor: e.target.value })}
                        placeholder="#a78bfa"
                      />
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="mb-2 text-sm font-medium">Preview</p>
                  <div className="flex gap-2">
                    <div
                      className="h-16 w-16 rounded-lg"
                      style={{ backgroundColor: visualIdentity.primaryColor }}
                    />
                    <div
                      className="h-16 w-16 rounded-lg"
                      style={{ backgroundColor: visualIdentity.secondaryColor }}
                    />
                  </div>
                </div>

                <Button onClick={handleSaveVisualIdentity} disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Cores"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Artistas */}
          <TabsContent value="artists" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Artistas do Estúdio</CardTitle>
                    <CardDescription>
                      Gerencie a lista de tatuadores
                    </CardDescription>
                  </div>
                  <Dialog open={artistDialogOpen} onOpenChange={setArtistDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Novo Artista
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Adicionar Artista</DialogTitle>
                        <DialogDescription>
                          Preencha os dados do novo artista
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="artistName">Nome *</Label>
                          <Input
                            id="artistName"
                            value={newArtist.name}
                            onChange={(e) => setNewArtist({ ...newArtist, name: e.target.value })}
                            placeholder="Nome do artista"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="artistEmail">Email</Label>
                          <Input
                            id="artistEmail"
                            type="email"
                            value={newArtist.email}
                            onChange={(e) => setNewArtist({ ...newArtist, email: e.target.value })}
                            placeholder="email@example.com"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="artistPhone">Telefone</Label>
                          <Input
                            id="artistPhone"
                            value={newArtist.phone}
                            onChange={(e) => setNewArtist({ ...newArtist, phone: e.target.value })}
                            placeholder="(11) 99999-9999"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="artistInstagram">Instagram</Label>
                          <Input
                            id="artistInstagram"
                            value={newArtist.instagram}
                            onChange={(e) => setNewArtist({ ...newArtist, instagram: e.target.value })}
                            placeholder="@artista"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="artistSpecialty">Especialidade</Label>
                          <Input
                            id="artistSpecialty"
                            value={newArtist.specialty}
                            onChange={(e) => setNewArtist({ ...newArtist, specialty: e.target.value })}
                            placeholder="Realismo, Old School, etc"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="artistBio">Bio</Label>
                          <Textarea
                            id="artistBio"
                            value={newArtist.bio}
                            onChange={(e) => setNewArtist({ ...newArtist, bio: e.target.value })}
                            placeholder="Breve descrição do artista"
                            rows={3}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setArtistDialogOpen(false)}>
                          Cancelar
                        </Button>
                        <Button onClick={handleCreateArtist} disabled={createArtist.isPending}>
                          {createArtist.isPending ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Adicionando...
                            </>
                          ) : (
                            "Adicionar"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {!artists || artists.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    Nenhum artista cadastrado
                  </div>
                ) : (
                  <div className="space-y-3">
                    {artists.map((artist) => (
                      <div
                        key={artist.id}
                        className="flex items-center justify-between rounded-lg border p-4"
                      >
                        <div>
                          <p className="font-medium">{artist.name}</p>
                          <div className="text-sm text-muted-foreground">
                            {artist.specialty && <span>{artist.specialty}</span>}
                            {artist.instagram && (
                              <span className="ml-2">• {artist.instagram}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteArtist(artist.id)}
                          disabled={deleteArtist.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notificações */}
          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificações</CardTitle>
                <CardDescription>
                  Configure os lembretes automáticos
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="birthdayReminders">Lembretes de Aniversário</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba notificações de aniversários de clientes
                    </p>
                  </div>
                  <Switch
                    id="birthdayReminders"
                    checked={notificationSettings.enableBirthdayReminders}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        enableBirthdayReminders: checked,
                      })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="appointmentReminders">Lembretes de Agendamento</Label>
                    <p className="text-sm text-muted-foreground">
                      Receba notificações de agendamentos próximos
                    </p>
                  </div>
                  <Switch
                    id="appointmentReminders"
                    checked={notificationSettings.enableAppointmentReminders}
                    onCheckedChange={(checked) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        enableAppointmentReminders: checked,
                      })
                    }
                  />
                </div>

                <Button onClick={handleSaveNotifications} disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Preferências"
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Configurações de Lembrete WhatsApp */}
            <Card>
              <CardHeader>
                <CardTitle>Lembrete WhatsApp</CardTitle>
                <CardDescription>
                  Configure como e quando os lembretes serão enviados aos clientes via WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="reminderDaysBefore">Dias antes do agendamento</Label>
                    <Input
                      id="reminderDaysBefore"
                      type="number"
                      min={1}
                      max={7}
                      value={notificationSettings.reminderDaysBefore}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, reminderDaysBefore: parseInt(e.target.value) || 1 })}
                    />
                    <p className="text-xs text-muted-foreground">Quantos dias antes enviar o lembrete</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reminderSendTime">Horário do envio</Label>
                    <Input
                      id="reminderSendTime"
                      type="time"
                      value={notificationSettings.reminderSendTime}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, reminderSendTime: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Horário em que o lembrete será enviado</p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="reminderResend">Reenviar lembrete</Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar um segundo lembrete no mesmo dia
                    </p>
                  </div>
                  <Switch
                    id="reminderResend"
                    checked={notificationSettings.reminderResend}
                    onCheckedChange={(checked) => setNotificationSettings({ ...notificationSettings, reminderResend: checked })}
                  />
                </div>

                {notificationSettings.reminderResend && (
                  <div className="space-y-2">
                    <Label htmlFor="reminderResendTime">Horário do reenvio</Label>
                    <Input
                      id="reminderResendTime"
                      type="time"
                      value={notificationSettings.reminderResendTime}
                      onChange={(e) => setNotificationSettings({ ...notificationSettings, reminderResendTime: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">Horário do segundo envio</p>
                  </div>
                )}

                <Button onClick={handleSaveNotifications} disabled={updateSettings.isPending}>
                  {updateSettings.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar Configurações WhatsApp"
                  )}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
