import { beforeEach, describe, expect, it, vi } from 'vitest';
const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('./_core/env', () => ({ ENV: {
  cookieSecret: 'test-only-secret', appBaseUrl: 'https://crm.example.test',
  storageProvider: 's3', s3Endpoint: 'https://s3.example.test',
  s3AccessKeyId: 'test', s3SecretAccessKey: 'test', s3Bucket: 'test-bucket',
  s3Region: 'auto', s3UrlStyle: 'path',
}}));
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class { send = send; },
  PutObjectCommand: class { constructor(public input: any) {} },
  GetObjectCommand: class { constructor(public input: any) {} },
  DeleteObjectCommand: class { constructor(public input: any) {} },
}));
import { checkS3Storage, storagePut, verifyStorageAccessToken } from './storage';
describe('private production storage', () => {
  beforeEach(() => { send.mockReset(); });
  it('keeps a stable signed URL and rejects a different object or token', async () => {
    send.mockResolvedValue({});
    const result = await storagePut('/clients/1/image.png', 'image', 'image/png');
    const url = new URL(result.url);
    expect(result.key).toBe('clients/1/image.png');
    expect(url.pathname).toBe('/api/storage');
    const token = url.searchParams.get('token')!;
    expect(verifyStorageAccessToken(result.key, token)).toBe(true);
    expect(verifyStorageAccessToken('clients/2/image.png', token)).toBe(false);
    expect(verifyStorageAccessToken(result.key, 'bad')).toBe(false);
  });
  it('does not claim an upload succeeded when S3 rejects it', async () => {
    send.mockRejectedValue(new Error('AccessDenied'));
    await expect(storagePut('image.png', 'image')).rejects.toThrow('AccessDenied');
  });
  it('checks actual bytes and removes only its own random probe', async () => {
    let marker = '';
    send.mockImplementation(async (cmd: any) => {
      if (cmd.input.Body) { marker = cmd.input.Body; return {}; }
      return { Body: { transformToString: async () => marker } };
    });
    await checkS3Storage();
    expect(send).toHaveBeenCalledTimes(3);
    const inputs = send.mock.calls.map(([c]) => c.input);
    expect(inputs[0].Key).toMatch(/^_healthcheck\/[^/]+\.txt$/);
    expect(inputs[1].Key).toBe(inputs[0].Key);
    expect(inputs[2].Key).toBe(inputs[0].Key);
  });
  it('fails startup on corrupt reads and still removes the probe', async () => {
    send.mockResolvedValue({ Body: { transformToString: async () => 'wrong' } });
    await expect(checkS3Storage()).rejects.toThrow('S3 read verification failed');
    expect(send).toHaveBeenCalledTimes(3);
  });
});
