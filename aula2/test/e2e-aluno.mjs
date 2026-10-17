// Aceite do exercício do aluno (plano, seção 8): percurso completo a 360 px
// em claro e escuro, recarga restaura a tela, sem rolagem horizontal, sem
// erros de página. Uso: node test/e2e-aluno.mjs [pasta-de-screenshots]
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdir } from "node:fs/promises";
import assert from "node:assert/strict";
import { servir } from "./servidor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const raiz = fileURLToPath(new URL("..", import.meta.url));
const SHOTS = process.argv[2];

const resultados = [];
async function etapa(nome, fn) {
  try { await fn(); resultados.push(true); console.log(`ok      ${nome}`); }
  catch (e) { resultados.push(false); console.log(`FALHOU  ${nome}\n        ${String(e.message).split("\n").join("\n        ")}`); }
}
async function foto(page, nome) {
  if (!SHOTS) return;
  await mkdir(SHOTS, { recursive: true });
  await page.screenshot({ path: join(SHOTS, nome + ".png"), fullPage: true });
}
async function semRolagemHorizontal(page, onde) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert.ok(sw <= iw, `${onde}: scrollWidth ${sw} > innerWidth ${iw}`);
}
const avancar = (page) => page.locator(".nav .btn:not(.btn-sec)").click();

const { srv, base } = await servir({ "/a": join(raiz, "dist/aula2-aluno.html") });
const browser = await chromium.launch();
const erros = [];

async function percurso(esquema) {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, colorScheme: esquema });
  // Fontes do Google ficam fora da rede deste ambiente; a página tem fallback.
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push(`${esquema} pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g/.test(m.text()) && !/ERR_FAILED/.test(m.text())) erros.push(`${esquema} console: ${m.text()}`); });

  await etapa(`[${esquema}] abertura carrega sem rolagem horizontal`, async () => {
    await page.goto(base + "/a");
    await page.locator(".titulo").waitFor();
    assert.match(await page.locator(".titulo").textContent(), /falsa central/);
    await semRolagemHorizontal(page, "abertura");
    await foto(page, `${esquema}-00-abertura`);
  });

  await etapa(`[${esquema}] Tarefa 1: responde as 12 células, uma errada, e lê o feedback`, async () => {
    await avancar(page);
    for (let elo = 0; elo < 4; elo++) {
      const celulas = page.locator(".celula");
      assert.equal(await celulas.count(), 3);
      for (let c = 0; c < 3; c++) {
        const cel = celulas.nth(c);
        // No Elo 1, a primeira célula recebe um distrator para colorir a grade.
        const alvo = elo === 0 && c === 0 ? cel.locator('.cartao[data-cartao="b"]') : cel.locator('.cartao[data-cartao="a"]');
        await alvo.click();
        await cel.locator(".sintese").waitFor();
      }
      await semRolagemHorizontal(page, `elo ${elo + 1}`);
      if (elo === 0) {
        assert.match(await celulas.nth(0).locator(".sintese").textContent(), /cadastrais/);
        await celulas.nth(0).locator("summary").first().click();
        assert.match(await celulas.nth(0).locator("details").first().textContent(), /art\. 10, §3º/);
        await foto(page, `${esquema}-01-elo1`);
      }
      await avancar(page);
    }
  });

  await etapa(`[${esquema}] síntese: grade 4×3 com 11 corretas e 1 errada`, async () => {
    await page.locator(".grade").waitFor();
    assert.equal(await page.locator(".grade td.correta").count(), 11);
    assert.equal(await page.locator(".grade td.distrator").count(), 1);
    await semRolagemHorizontal(page, "síntese");
    await foto(page, `${esquema}-05-sintese`);
    await avancar(page);
  });

  await etapa(`[${esquema}] pedido: três requisitos liberam a conclusão`, async () => {
    const reqs = page.locator(".requisito");
    for (let i = 0; i < 3; i++) await reqs.nth(i).click();
    await page.locator(".conclusao").waitFor();
    await semRolagemHorizontal(page, "pedido");
    await avancar(page);
  });

  await etapa(`[${esquema}] adequação: controles movem os medidores`, async () => {
    await page.locator("#val-terceiros").waitFor();
    assert.equal(await page.locator("#val-terceiros").textContent(), "≈ 76 mil");
    await page.locator("#raio").fill("50");
    await page.locator("#janela").fill("20");
    assert.equal(await page.locator("#val-terceiros").textContent(), "≈ 550");
    assert.equal(await page.locator("#val-captura").textContent(), "86%");
    assert.match(await page.locator("#out-janela").textContent(), /13h37 às 13h57/);
    await page.locator('label:has(#termo-nome)').click();
    await page.locator('label:has(#dias-7)').click();
    assert.equal(await page.locator(".degraus .atual").textContent(), "unidades a dezenas");
    await semRolagemHorizontal(page, "adequação");
    await foto(page, `${esquema}-07-adequacao`);
    await avancar(page);
  });

  await etapa(`[${esquema}] necessidade e proporcionalidade estrita`, async () => {
    await page.locator('label:has(#nec-sim)').click();
    await page.locator(".devolutiva").waitFor();
    await avancar(page);
    await page.locator('label:has(#grav-nao)').click();
    assert.match(await page.locator(".devolutiva").textContent(), /Correto: não é/);
    await page.locator('label:has(#adota-hediondos)').click();
    await page.locator('label:has(#etapas)').click();
    assert.match(await page.locator(".resumo-param").textContent(), /50 m/);
    await semRolagemHorizontal(page, "estrita");
    await avancar(page);
  });

  await etapa(`[${esquema}] decisão coerente: dispositivo sem sinais`, async () => {
    await page.locator('label:has(#dec-cerca-restricoes)').click();
    await page.locator('label:has(#dec-palavra-indefiro)').click();
    await page.locator("#fund-palavra").selectOption("gravidade");
    await page.locator(".dispositivo").waitFor();
    assert.match(await page.locator(".dispositivo").textContent(), /DEFIRO COM RESTRIÇÕES: raio de 50 m, das 13h37 às 13h57/);
    assert.equal(await page.locator(".sinais li.limpo").count(), 1);
    await foto(page, `${esquema}-10-decisao`);
  });

  await etapa(`[${esquema}] decisão incoerente acende o sinal certo`, async () => {
    await page.locator('label:has(#dec-palavra-defiro)').click();
    const textos = await page.locator(".sinais li").allTextContents();
    assert.equal(textos.length, 2, textos.join(" | "));
    assert.ok(textos.some((t) => /restrição a crimes hediondos/.test(t)));
    assert.ok(textos.some((t) => /termo genérico/.test(t)));
    await page.locator('label:has(#dec-palavra-indefiro)').click();
    await page.locator("#fund-palavra").selectOption("gravidade");
    await semRolagemHorizontal(page, "decisão");
    await avancar(page);
  });

  await etapa(`[${esquema}] cartão de decisão`, async () => {
    const valores = await page.locator(".cartao-decisao .valor").allTextContents();
    assert.deepEqual(valores, ["DEFIRO COM RESTRIÇÕES", "INDEFIRO"]);
    const params = await page.locator(".cartao-decisao .params span").allTextContents();
    assert.deepEqual(params, ["50 m", "20 min", "em etapas"]);
    await semRolagemHorizontal(page, "cartão");
    await foto(page, `${esquema}-11-cartao`);
  });

  await etapa(`[${esquema}] recarregar restaura a tela e as respostas`, async () => {
    await page.reload();
    await page.locator(".cartao-decisao").waitFor();
    assert.match(await page.locator("#onde").textContent(), /Cartão/);
    const e = await page.evaluate(() => window.Aula2.estado());
    assert.equal(Object.keys(e.respostas).length, 12);
    assert.equal(e.raio, 50);
    await avancar(page);
    await page.locator(".titulo").waitFor();
    assert.match(await page.locator(".titulo").textContent(), /Integridade/);
    await foto(page, `${esquema}-12-fecho`);
  });

  await etapa(`[${esquema}] recomeçar em duas etapas zera o estado`, async () => {
    await page.locator("#btn-recomecar").click();
    await page.locator("#btn-apagar").click();
    await page.locator(".titulo").waitFor();
    const e = await page.evaluate(() => window.Aula2.estado());
    assert.equal(e.tela, 0);
    assert.equal(Object.keys(e.respostas).length, 0);
  });

  await ctx.close();
}

try {
  await percurso("light");
  await percurso("dark");
  await etapa("desktop 1280 px: elo em três colunas, sem rolagem horizontal", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    const page = await ctx.newPage();
    await page.goto(base + "/a");
    await page.locator(".nav .btn").click();
    await page.locator(".celula").first().waitFor();
    const tops = await page.locator(".celula").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
    assert.equal(new Set(tops).size, 1, "as três células na mesma linha");
    await semRolagemHorizontal(page, "desktop");
    await foto(page, "desktop-01-elo1");
    await ctx.close();
  });
  await etapa("sem erros de página ou de console", async () => assert.deepEqual(erros, []));
} finally {
  await browser.close();
  srv.close();
}
const falhas = resultados.filter((r) => !r).length;
console.log(`\n${resultados.length - falhas}/${resultados.length} etapas ok`);
process.exit(falhas ? 1 : 0);
