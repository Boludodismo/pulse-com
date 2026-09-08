import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ status: 'processed', calls: 0, insert: vi.fn(), handle: vi.fn() }));
vi.mock('../db', () => ({ getDb: async () => ({
  select: () => ({ from: () => ({ where: () => ({ limit: async () => ++state.calls === 1
    ? [{ id: 1, studioId: 10, encryptedWebhookSecret: 'secret' }]
    : [{ id: 2, status: state.status }] }) }) }), insert: state.insert,
}) }));
vi.mock('./crypto', () => ({ decryptIntegrationSecret: () => 'secret', hashIntegrationPayload: () => 'hash', isWebhookSignatureValid: () => true }));
vi.mock('./webhook', () => ({ handleWebhookReply: state.handle }));
import { receiveBotConversaWebhook } from './secureWebhook';
beforeEach(() => { state.calls = 0; vi.clearAllMocks(); });
describe('inbound webhook duplicate outcomes', () => {
  it.each([
    ['processed', { accepted: true, duplicate: true }],
    ['ignored', { accepted: true, ignored: true }],
    ['received', { accepted: false, processing: true }],
  ])('reports actual %s state', async (status, expected) => {
    state.status = status;
    expect(await receiveBotConversaWebhook({ connectionKey:'key',rawBody:'{}' })).toEqual(expected);
    expect(state.handle).not.toHaveBeenCalled();
    expect(state.insert).not.toHaveBeenCalled();
  });
  it('never labels a failed event as successfully duplicated', async () => {
    state.status='failed';
    expect(await receiveBotConversaWebhook({ connectionKey:'key',rawBody:'{}' })).toMatchObject({accepted:false,failed:true});
    expect(state.handle).not.toHaveBeenCalled();
  });
});
