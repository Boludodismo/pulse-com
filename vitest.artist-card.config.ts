import {defineConfig,mergeConfig} from 'vitest/config';
import base from './vitest.config';
// Keep the shared test configuration unchanged. The card renderer uses the
// same automatic JSX transform as the existing Vite application build.
export default mergeConfig(base,defineConfig({esbuild:{jsx:'automatic'}}));
