/**
 * useSyncToast
 *
 * Hook que exibe notificações visuais (toast) sobre o status da sincronização
 * com o Google Sheets. Deve ser chamado após mutações bem-sucedidas que
 * disparam sync no backend.
 *
 * Uso:
 *   const { notifySync } = useSyncToast();
 *   // No onSuccess de uma mutation:
 *   onSuccess: () => { notifySync("cliente"); }
 */

import { useCallback } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export type SyncEntity =
  | "cliente"
  | "agendamento"
  | "anamnese"
  | "material"
  | "movimentacao";

const ENTITY_LABELS: Record<SyncEntity, string> = {
  cliente: "Cliente",
  agendamento: "Agendamento",
  anamnese: "Anamnese",
  material: "Material de estoque",
  movimentacao: "Movimentação de estoque",
};

export function useSyncToast() {
  const syncTestMutation = trpc.system.syncTest.useMutation();

  const notifySync = useCallback(
    (entity: SyncEntity) => {
      const label = ENTITY_LABELS[entity];

      // Mostra toast de "sincronizando" enquanto aguarda
      const toastId = toast.loading(`Sincronizando ${label} com Google Sheets…`, {
        duration: 15_000,
      });

      syncTestMutation.mutate(undefined, {
        onSuccess: (result) => {
          toast.dismiss(toastId);
          if (result.ok) {
            toast.success(`${label} sincronizado com Google Sheets`, {
              description: "Planilha atualizada com sucesso.",
              duration: 4_000,
            });
          } else {
            toast.error(`Falha ao sincronizar ${label}`, {
              description: result.error ?? "Verifique a conexão com o Google Sheets.",
              duration: 8_000,
            });
          }
        },
        onError: (err) => {
          toast.dismiss(toastId);
          toast.error(`Erro na sincronização com Google Sheets`, {
            description: err.message ?? "Tente novamente mais tarde.",
            duration: 8_000,
          });
        },
      });
    },
    [syncTestMutation]
  );

  return { notifySync };
}
