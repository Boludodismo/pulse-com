import { afterEach, expect, it, vi } from 'vitest';
import { BotConversaProvider } from './providers/botconversa';
afterEach(()=>vi.unstubAllGlobals());
it('tests authentication with a trimmed API token and a read-only request',async()=>{
  const fetch=vi.fn(async()=>new Response('{}',{status:200})); vi.stubGlobal('fetch',fetch);
  const result=await new BotConversaProvider({provider:'botconversa',apiToken:' key \n',phoneNumber:'+5531999851316'}).testConnection();
  expect(result.success).toBe(true);
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/webhook/subscribers/'),expect.objectContaining({method:'GET',headers:expect.objectContaining({'API-KEY':'key'})}));
});
it('reports credential rejection without exposing the token',async()=>{
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}',{status:401})));
  const result=await new BotConversaProvider({provider:'botconversa',apiToken:'sensitive-token',phoneNumber:'+5531999851316'}).testConnection();
  expect(result.success).toBe(false);
  expect(result.error).toContain('HTTP 401');
  expect(result.error).not.toContain('sensitive-token');
});
