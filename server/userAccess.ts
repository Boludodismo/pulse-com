import { TRPCError } from '@trpc/server';
type Account = { id: number; role: string; studioId?: number | null };
export function assertManagedUser(actor: Account, target?: Account, changes?: { role?: string; studioId?: number | null; artistId?: number | null }, creating = false) {
  if (!['admin', 'superadmin'].includes(actor.role)) throw new TRPCError({ code: 'FORBIDDEN' });
  if (!creating && !target) throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuário não encontrado.' });
  if (actor.role === 'superadmin') return;
  if (!actor.studioId || (!creating && (target!.studioId !== actor.studioId || target!.role === 'superadmin')) || changes?.role === 'superadmin' || (changes?.studioId !== undefined && changes.studioId !== actor.studioId) || (creating && changes?.studioId !== actor.studioId)) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Usuário fora da sua empresa ou permissão insuficiente.' });
  }
  // Artist assignments are managed by the tenant-aware invitation flow.
  if (changes?.artistId != null) throw new TRPCError({ code: 'FORBIDDEN', message: 'Vincule artistas pelo convite da empresa.' });
}
export function safeUser<T extends object>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash: _secret, ...safe } = user as T & { passwordHash?: unknown };
  return safe;
}
