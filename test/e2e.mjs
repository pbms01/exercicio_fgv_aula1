// Teste de aceite ponta a ponta (PLANO, seção 10), em Chromium via Playwright.
//
// Uso: node test/e2e.mjs            (só verifica)
//      SHOTS=pasta node test/e2e.mjs (também salva screenshots)
//
// Sem dependências no package.json: o servidor estático é node:http, e o
// Playwright é resolvido do ambiente (instalação global ou NODE_PATH).

import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { join, extname, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const HOJE = "2026-10-17";
const SHOTS = process.env.SHOTS;

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml"
};

function servir() {
  const srv = createServer(async (req, res) => {
    try {
      let caminho = decodeURIComponent(new URL(req.url, "http://x").pathname);
      if (caminho.endsWith("/")) caminho += "index.html";
      const arquivo = normalize(join(RAIZ, caminho));
      if (!arquivo.startsWith(RAIZ)) throw new Error("fora da raiz");
      const corpo = await readFile(arquivo);
      res.writeHead(200, { "Content-Type": TIPOS[extname(arquivo)] ?? "application/octet-stream", "Cache-Control": "no-store" });
      res.end(corpo);
    } catch {
      res.writeHead(404).end("404");
    }
  });
  return new Promise((ok) => srv.listen(0, "127.0.0.1", () => ok(srv)));
}

const resultados = [];
async function etapa(nome, fn) {
  try {
    await fn();
    resultados.push(["ok", nome]);
    console.log(`ok      ${nome}`);
  } catch (err) {
    resultados.push(["FALHOU", nome, err]);
    console.log(`FALHOU  ${nome}\n        ${err.message.split("\n").join("\n        ")}`);
  }
}

async function foto(page, nome) {
  if (!SHOTS) return;
  await mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, `${nome}.png`), fullPage: true });
}

async function semRolagemHorizontal(page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert.ok(sw <= iw, `rolagem horizontal: scrollWidth ${sw} > innerWidth ${iw}`);
}

const statusPainel = (page) => page.locator(".col-painel .semaforo").first().getAttribute("data-status");
const statusPorta = (page, id) => page.locator(`.porta[data-porta="${id}"]`).getAttribute("data-status");

async function principal() {
  const srv = await servir();
  const base = `http://127.0.0.1:${srv.address().port}`;
  const browser = await chromium.launch();
  const erros = [];

  try {
    // ------------------------------------------------------------ projeção
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => erros.push(`pageerror: ${e.message}`));
    page.on("console", (m) => m.type() === "error" && erros.push(`console: ${m.text()}`));

    await etapa("1. mapa carrega com os três atos, sem rolagem horizontal", async () => {
      await page.goto(`${base}/?hoje=${HOJE}#/`);
      await page.locator(".mapa-svg").waitFor();
      assert.equal(await page.locator(".mapa-no").count(), 7);
      await semRolagemHorizontal(page);
      await foto(page, "01-mapa");
    });

    await etapa("7. Ato 1: passador avança o roteiro, semáforo atípico, nota do §1º", async () => {
      await page.keyboard.press("PageDown");
      await page.waitForURL(/#\/ato1$/);
      await page.locator(".col-painel .semaforo").waitFor();
      assert.equal(await statusPainel(page), "atipico");
      for (let i = 0; i < 5; i++) await page.keyboard.press("PageDown");
      assert.equal(await page.locator(".runner-contador").textContent(), "5 / 5");
      assert.match(await page.locator(".nota-destaque").textContent(), /154-A, §1º/);
      await semRolagemHorizontal(page);
      await foto(page, "02-ato1");
      await page.keyboard.press("PageDown");
      await page.waitForURL(/#\/ato2$/);
    });

    await etapa("2. Ato 2: três regimes no controle de data, para as duas portas", async () => {
      await page.locator('.porta[data-status]').nth(1).waitFor();
      assert.equal(await statusPorta(page, "ato2_com_cadeado"), "tipico");
      assert.equal(await statusPorta(page, "ato2_sem_cadeado"), "fronteira");

      await page.getByRole("button", { name: /^2012/ }).click();
      await page.waitForFunction(() => document.querySelector('.porta[data-porta="ato2_com_cadeado"]').dataset.status === "atipico");
      assert.equal(await statusPorta(page, "ato2_sem_cadeado"), "atipico");

      await page.getByRole("button", { name: /^2015/ }).click();
      await page.waitForFunction(() => document.querySelector('.porta[data-porta="ato2_com_cadeado"]').dataset.status === "tipico");
      assert.equal(await statusPorta(page, "ato2_sem_cadeado"), "atipico");
      assert.match(await page.locator('.porta[data-porta="ato2_com_cadeado"] .porta-pena').textContent(), /detenção, de 3 meses a 1 ano/);
      await foto(page, "03a-ato2-2015");

      await page.getByRole("button", { name: /^hoje/ }).click();
      await page.waitForFunction(() => document.querySelector('.porta[data-porta="ato2_sem_cadeado"]').dataset.status === "fronteira");
    });

    await etapa("2. Ato 2: porta sem cadeado exibe as duas teses, sem gabarito", async () => {
      await page.keyboard.press("PageDown");
      await page.waitForURL(/#\/ato2\/com-cadeado$/);
      for (let i = 0; i < 4; i++) await page.keyboard.press("PageDown");
      await page.keyboard.press("PageDown");
      await page.waitForURL(/#\/ato2\/sem-cadeado$/);
      await page.locator(".divergencia").waitFor();
      assert.equal(await statusPainel(page), "fronteira");
      const texto = await page.locator(".divergencia").textContent();
      assert.match(texto, /Tese majoritária/);
      assert.match(texto, /Tese contrária/);
      assert.equal(await page.locator(".lt-vigente").count(), 1);
      assert.match(await page.locator(".linha-tempo").textContent(), /ATÍPICO/);
      await semRolagemHorizontal(page);
      await foto(page, "03b-ato2-sem-cadeado");
    });

    await etapa("8. passador não mexe na data quando o foco está no controle", async () => {
      const range = page.locator(".cd-range");
      await range.focus();
      const antes = await range.inputValue();
      await page.keyboard.press("PageDown");
      assert.equal(await range.inputValue(), antes);
    });

    await etapa("3. corredor liga Ato 2 ao Ato 3 e explica a consunção", async () => {
      await page.getByRole("button", { name: /Seguir pelo corredor/ }).click();
      await page.waitForURL(/#\/corredor$/);
      await page.locator(".col-painel .semaforo").waitFor();
      assert.match(await page.locator(".painel-tipo").textContent(), /crime-meio, absorvido/);
      await page.getByRole("button", { name: "Técnica" }).click();
      assert.match(await page.locator(".explicacao-texto").textContent(), /consunção/);
      await page.getByRole("button", { name: "Para leigo" }).click();
      await foto(page, "04-corredor");
      await page.getByRole("button", { name: /Seguir para o Ato 3/ }).click();
      await page.waitForURL(/#\/ato3$/);
    });

    await etapa("4. Ato 3, máquina enganada: furto, 4 a 10 anos, foro da agência, objeção do §2º-A", async () => {
      await page.getByRole("button", { name: /A máquina foi enganada/ }).click();
      await page.waitForURL(/#\/ato3\/maquina$/);
      await page.locator(".painel-ficha").waitFor();
      const ficha = await page.locator(".painel-ficha").textContent();
      assert.match(ficha, /4 a 10 anos/);
      assert.match(ficha, /art\. 70, caput, CPP/);
      assert.match(ficha, /Vila Quixote/);
      assert.match(ficha, /incondicionada/);
      assert.match(await page.locator(".objecao").textContent(), /§2º-A/);
      await semRolagemHorizontal(page);
      await foto(page, "05-ato3-maquina");
    });

    await etapa("4. Ato 3, vítima enganada: estelionato, 4 a 8 anos, domicílio, ação incondicionada", async () => {
      await page.getByRole("button", { name: /A vítima foi enganada/ }).click();
      await page.waitForURL(/#\/ato3\/vitima$/);
      await page.waitForFunction(() => /Pindorama/.test(document.querySelector(".painel-ficha")?.textContent ?? ""));
      const ficha = await page.locator(".painel-ficha").textContent();
      assert.match(ficha, /4 a 8 anos/);
      assert.match(ficha, /art\. 70, §4º, CPP/);
      assert.match(ficha, /incondicionada/);
      await foto(page, "06-ato3-vitima");
    });

    await etapa("4. fecho compara os dois ramos: crime, pena, juiz, foro, ação", async () => {
      await page.getByRole("button", { name: /Ver o fecho/ }).click();
      await page.waitForURL(/#\/fecho$/);
      await page.locator(".fecho-tabela tbody tr").nth(5).waitFor();
      const t = await page.locator(".fecho-tabela").textContent();
      assert.match(t, /Vila Quixote/);
      assert.match(t, /Pindorama do Sul/);
      assert.match(t, /4 a 10 anos/);
      await semRolagemHorizontal(page);
      await foto(page, "07-fecho");
    });

    await etapa("1. reinício leva ao mapa e zera a sessão", async () => {
      await page.getByRole("button", { name: /Reiniciar para nova turma/ }).click();
      await page.waitForURL(/#\/$/);
      assert.equal(await page.locator(".mapa-no.visitado").count(), 0);
    });

    await etapa("5. offline: após uma visita, o artefato abre e funciona sem rede", async () => {
      await page.evaluate(() => navigator.serviceWorker.ready);
      // Recarrega para a página passar a ser controlada pelo service worker.
      await page.reload();
      await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
      await ctx.setOffline(true);
      await page.goto(`${base}/?hoje=${HOJE}#/ato2/sem-cadeado`);
      await page.locator(".divergencia").waitFor();
      assert.equal(await statusPorta(page, "ato2_sem_cadeado"), "fronteira");
      assert.equal(await page.locator("#status-rede").isVisible(), true);
      await foto(page, "08-offline");
      await ctx.setOffline(false);
    });
    await ctx.close();

    // ------------------------------------------- API remota indisponível
    await etapa("5. com MODE proxy e API fora do ar, cai para a base local e sinaliza", async () => {
      const c2 = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block" });
      const p2 = await c2.newPage();
      await p2.route("**/config.js", (r) =>
        r.fulfill({
          contentType: "text/javascript",
          body: 'export const ORACULO = { MODE: "proxy", BASE_URL: "https://proxy.exemplo.invalido", TIMEOUT_MS: 1500 };'
        })
      );
      await p2.route("https://proxy.exemplo.invalido/**", (r) => r.abort("internetdisconnected"));
      await p2.goto(`${base}/?hoje=${HOJE}#/ato2/sem-cadeado`);
      await p2.locator(".aviso-offline").waitFor();
      assert.match(await p2.locator("#status-modo").textContent(), /modo offline/);
      assert.equal(await p2.locator(".col-painel .semaforo").first().getAttribute("data-status"), "fronteira");
      await c2.close();
    });

    // ------------------------------------------------------------ celular
    await etapa("8. largura de celular (390px): nenhuma tela rola na horizontal", async () => {
      const c3 = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: "block" });
      const p3 = await c3.newPage();
      for (const rota of ["/", "/ato1", "/ato2/sem-cadeado", "/corredor", "/ato3/maquina", "/fecho"]) {
        await p3.goto(`${base}/?hoje=${HOJE}#${rota}`);
        await p3.locator(".tela").waitFor();
        await p3.waitForTimeout(150);
        await semRolagemHorizontal(p3);
      }
      await foto(p3, "09-celular-fecho");
      await c3.close();
    });

    await etapa("sem erros de console ou de página", async () => {
      assert.deepEqual(erros, []);
    });
  } finally {
    await browser.close();
    srv.close();
  }

  const falhas = resultados.filter((r) => r[0] !== "ok");
  console.log(`\n${resultados.length - falhas.length}/${resultados.length} etapas ok`);
  process.exit(falhas.length ? 1 : 0);
}

principal().catch((e) => {
  console.error(e);
  process.exit(1);
});
