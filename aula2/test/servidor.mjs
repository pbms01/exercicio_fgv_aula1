// Servidor local que serve cada artefato dentro de um esqueleto equivalente
// ao que a plataforma injeta ao publicar (doctype, viewport com
// viewport-fit=cover, reset com color-scheme claro, :root com padding de
// safe-area, body com margem zero e fonte de 14 px). Assim o teste roda a
// página como ela será servida, e não como um HTML solto.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const ESQUELETO_INICIO =
  '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">' +
  "<style>:root{color-scheme:light;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}" +
  "body{margin:0;font:14px system-ui,-apple-system,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>";
const ESQUELETO_FIM = "</body></html>";

export async function servir(rotas) {
  const srv = createServer(async (req, res) => {
    const caminho = new URL(req.url, "http://x").pathname;
    const arquivo = rotas[caminho];
    if (!arquivo) { res.writeHead(404).end(); return; }
    const corpo = await readFile(arquivo, "utf8");
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" });
    res.end(ESQUELETO_INICIO + corpo + ESQUELETO_FIM);
  });
  await new Promise((ok) => srv.listen(0, "127.0.0.1", ok));
  return { srv, base: `http://127.0.0.1:${srv.address().port}` };
}
