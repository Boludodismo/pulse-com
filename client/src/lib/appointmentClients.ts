/** Mantém a lista existente utilizável quando uma atualização posterior falha. */
export function shouldShowClientLoadError(hasError: boolean, clientCount: number) {
  return hasError && clientCount === 0;
}
