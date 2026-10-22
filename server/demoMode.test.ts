import {describe,it,expect,vi,afterEach} from 'vitest';
import {assertDemoScope} from './demoMode';
import {demoPath} from './demoStorage';
afterEach(()=>vi.unstubAllEnvs());
function demo(){vi.stubEnv('DEMO_MODE','true');vi.stubEnv('DEMO_UPLOAD_DIR','/tmp/tatuei-demo-test/uploads');vi.stubEnv('DATABASE_URL','mysql://test:test@127.0.0.1:3307/tatuei_demo');vi.stubEnv('OUTBOUND_MESSAGING_DISABLED','true');vi.stubEnv('RUN_DB_MIGRATIONS','false');}
describe('Disposable demo isolation',()=>{
 it('accepts the dedicated local database only',()=>{demo();expect(()=>assertDemoScope()).not.toThrow();});
 it('rejects a remote database before schema startup',()=>{demo();vi.stubEnv('DATABASE_URL','mysql://test:test@production.example.invalid/tatuei_demo');expect(()=>assertDemoScope()).toThrow('DEMO_ISOLATION_REQUIRED');});
 it('rejects another local database',()=>{demo();vi.stubEnv('DATABASE_URL','mysql://test:test@127.0.0.1/production');expect(()=>assertDemoScope()).toThrow('DEMO_ISOLATION_REQUIRED');});
 it('refuses outgoing messaging enabled',()=>{demo();vi.stubEnv('OUTBOUND_MESSAGING_DISABLED','false');expect(()=>assertDemoScope()).toThrow('DEMO_SAFETY_REQUIRED');});
 it('rejects upload storage outside temporary demo',()=>{demo();vi.stubEnv('DEMO_UPLOAD_DIR','/var/lib/mysql');expect(()=>demoPath('x')).toThrow();});
 it('maps traversal-shaped keys to opaque filenames',()=>{demo();expect(demoPath('../../etc/passwd')).toMatch(/^\/tmp\/tatuei-demo-test\/uploads\/[a-f0-9]{64}$/);});
});
