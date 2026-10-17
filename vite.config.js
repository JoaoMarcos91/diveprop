import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFile } from 'node:child_process';

// Ponte de desenvolvimento: a página (com ?dev) manda relatórios/screenshots e lê comandos.
// Só existe no `npm run dev`; o build final não inclui nada disso.
function devBridge() {
  const dir = resolve('.devreports');
  const install = (server) => {
    mkdirSync(dir, { recursive: true });
    server.middlewares.use('/__devreport', (req, res) => {
      let body = '';
      req.on('data', c => { body += c; });
      req.on('end', () => {
        try {
          const msg = JSON.parse(body);
          if (msg.type === 'shot' && msg.data) {
            const b64 = msg.data.split(',')[1];
            const raw = resolve(dir, `${msg.name}.bmp`);
            writeFileSync(raw, Buffer.from(b64, 'base64'));
            // converte para JPG com o sips do macOS (só para inspecionar)
            execFile('sips', ['-s', 'format', 'jpeg', raw, '--out', resolve(dir, `${msg.name}.jpg`)], () => unlinkSync(raw));
            delete msg.data;
          }
          appendFileSync(resolve(dir, 'log.jsonl'), JSON.stringify(msg) + '\n');
        } catch { /* ignora */ }
        res.end('ok');
      });
    });
    server.middlewares.use('/__devcmd', (req, res) => {
      const f = resolve(dir, 'cmd.json');
      let out = '[]';
      if (existsSync(f)) { out = readFileSync(f, 'utf8') || '[]'; unlinkSync(f); }
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Cache-Control', 'no-store');
      res.end(out);
    });
  };
  return {
    name: 'fpvsim-dev-bridge',
    configureServer: install,
    // `vite preview` também ganha a ponte, para testar um build feito com VITE_DEVBRIDGE=1
    configurePreviewServer: install,
  };
}

export default defineConfig({
  base: './',
  plugins: [devBridge()],
  server: { port: 5173, strictPort: true, watch: { ignored: ['**/.devreports/**'] } },
  build: { target: 'safari15', chunkSizeWarningLimit: 4000 },
});
