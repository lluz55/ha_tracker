import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env from current directory
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/hat': {
          target: `http://localhost:${env.BACKEND_PORT || '3001'}`,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
})
