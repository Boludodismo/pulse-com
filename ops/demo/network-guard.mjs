import net from 'node:net';
import { syncBuiltinESMExports } from 'node:module';
export function allowedHost(host) { return ['127.0.0.1', '::1', 'localhost'].includes(host); }
const original = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const a = Array.isArray(args[0]) ? args[0] : args;
  const opt = typeof a[0] === 'object' ? a[0] : {host: typeof a[1] === 'string' ? a[1] : 'localhost', port: a[0]};
  if (opt.path || !allowedHost(opt.host || opt.hostname || 'localhost')) throw new Error('DEMO_EXTERNAL_NETWORK_BLOCKED');
  return original.apply(this, args);
};
syncBuiltinESMExports();
const originalFetch = globalThis.fetch;
globalThis.fetch = function (input, init) {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url);
  if (!allowedHost(url.hostname)) return Promise.reject(new Error('DEMO_EXTERNAL_NETWORK_BLOCKED'));
  return originalFetch(input, init);
};
