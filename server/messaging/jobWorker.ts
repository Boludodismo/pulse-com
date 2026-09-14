import { processPendingIntegrationJobs } from "./service";

type Timer = ReturnType<typeof setTimeout>;

export type IntegrationJobWorkerOptions = {
  processJobs?: (limit: number) => Promise<unknown>;
  initialDelayMs?: number;
  intervalMs?: number;
  limit?: number;
  onError?: (error: unknown) => void;
};

/**
 * Processa somente jobs já enfileirados. A criação automática de lembretes
 * continua sob responsabilidade do scheduler/Heartbeat configurado.
 */
export function createIntegrationJobWorker(options: IntegrationJobWorkerOptions = {}) {
  const processJobs = options.processJobs ?? processPendingIntegrationJobs;
  const initialDelayMs = options.initialDelayMs ?? 2_500;
  const intervalMs = options.intervalMs ?? 15_000;
  const limit = options.limit ?? 20;
  const onError = options.onError ?? ((error) => console.error("[Messaging worker] Falha ao processar fila:", error));

  let started = false;
  let running = false;
  let timer: Timer | undefined;

  const schedule = (delay: number) => {
    timer = setTimeout(() => void tick(), delay);
    timer.unref?.();
  };

  const tick = async () => {
    if (!started) return;
    if (running) {
      schedule(intervalMs);
      return;
    }

    running = true;
    try {
      await processJobs(limit);
    } catch (error) {
      onError(error);
    } finally {
      running = false;
      if (started) schedule(intervalMs);
    }
  };

  return {
    start() {
      if (started) return;
      started = true;
      schedule(initialDelayMs);
    },
    stop() {
      started = false;
      if (timer) clearTimeout(timer);
      timer = undefined;
    },
    isRunning() {
      return running;
    },
  };
}

const integrationJobWorker = createIntegrationJobWorker();

export function startIntegrationJobWorker() {
  integrationJobWorker.start();
  console.log("[Messaging worker] Processamento da fila ativo a cada 15 segundos.");
}

