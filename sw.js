// Service worker do artefato (invariante 4: a aula não depende de rede).
//
// Estratégia: stale-while-revalidate para os arquivos do próprio site.
// - Com rede ou sem rede, a resposta sai do cache na hora, se existir.
// - Em paralelo, busca a versão nova e atualiza o cache para a próxima abertura.
// Assim, uma correção na base canônica chega à turma seguinte mesmo que se
// esqueça de incrementar CACHE_VERSION; incrementar continua sendo o correto,
// porque força a troca completa e limpa caches antigos.
//
// Requisições a outras origens (a API do oráculo ou o proxy) não passam por
// aqui: são POST e não devem ser cacheadas.

const CACHE_VERSION = "aula1-v2.0.1";

// Mantida em sincronia por test/sw.test.mjs, que falha se um arquivo do app
// ficar fora desta lista.
const ARQUIVOS = [
  "./",
  "./index.html",
  "./config.js",
  "./assets/styles.css",
  "./data/alvo-fake.json",
  "./data/oraculo.local.json",
  "./data/pseudocodigos.json",
  "./src/app.js",
  "./src/router.js",
  "./src/state-machine.js",
  "./src/pseudocode-runner.js",
  "./src/api/oraculo.js",
  "./src/atos/ato1-momento.js",
  "./src/atos/ato2-acesso.js",
  "./src/atos/ato3-modo.js",
  "./src/atos/comum.js",
  "./src/atos/corredor.js",
  "./src/ui/controle-data.js",
  "./src/ui/datas.js",
  "./src/ui/mapa.js",
  "./src/ui/painel-juridico.js",
  "./src/ui/semaforo.js"
];

self.addEventListener("install", (ev) => {
  ev.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((c) => c.addAll(ARQUIVOS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (ev) => {
  ev.waitUntil(
    caches
      .keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE_VERSION).map((n) => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (ev) => {
  const req = ev.request;
  if (req.method !== "GET") return;
  if (new URL(req.url).origin !== self.location.origin) return;

  ev.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // Navegações com ?hoje=… ou #… devem achar o index em cache.
      const emCache = await cache.match(req, { ignoreSearch: req.mode === "navigate" });
      const daRede = fetch(req)
        .then((res) => {
          if (res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => null);

      if (emCache) {
        ev.waitUntil(daRede);
        return emCache;
      }
      const res = await daRede;
      if (res) return res;
      // Sem cache e sem rede: para navegação, devolve o index em cache.
      if (req.mode === "navigate") {
        const index = await cache.match("./");
        if (index) return index;
      }
      return new Response("Sem conexão e sem cópia em cache deste arquivo.", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" }
      });
    })
  );
});
