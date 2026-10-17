// Aceite do painel do professor (plano, seção 8): QR gerado localmente,
// cronômetro, gabarito revelável, simulador com os números de referência,
// navegação por passador e teclado, mãos, sem rolagem horizontal em celular e
// projetor, claro e escuro, sem erros. Uso: node test/e2e-professor.mjs [pasta]
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
import { servir } from "./servidor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const raiz = fileURLToPath(new URL("..", import.meta.url));
const SHOTS = process.argv[2];
const QR_URL = "https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js";
// O jsDelivr não é alcançável daqui; servimos a mesma versão do pacote npm.
const QR_JS = await readFile(join(raiz, "vendor/pkg/package/qrcode.js"), "utf8");

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
const bloco = (page) => page.locator("[data-bloco]").getAttribute("data-bloco");

const { srv, base } = await servir({ "/b": join(raiz, "dist/aula2-professor.html") });
const browser = await chromium.launch();
const erros = [];

async function novoContexto(viewport, esquema) {
  const ctx = await browser.newContext({ viewport, colorScheme: esquema });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  await ctx.route(QR_URL, (r) => r.fulfill({ status: 200, contentType: "application/javascript", body: QR_JS }));
  const page = await ctx.newPage();
  page.on("pageerror", (e) => erros.push(`${esquema} ${viewport.width} pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/fonts\.g/.test(m.text()) && !/ERR_FAILED/.test(m.text())) erros.push(`${esquema} console: ${m.text()}`); });
  return { ctx, page };
}

async function percurso(esquema, viewport) {
  const tag = `[${esquema} ${viewport.width}]`;
  const { ctx, page } = await novoContexto(viewport, esquema);

  await etapa(`${tag} acesso: QR em SVG sobre placa branca e link visível`, async () => {
    await page.goto(base + "/b");
    await page.locator(".qr-placa svg").waitFor();
    const rects = await page.locator(".qr-placa svg path, .qr-placa svg rect").count();
    assert.ok(rects >= 1, "o SVG do QR tem conteúdo");
    assert.match(await page.locator("#link-aluno").textContent(), /^https:\/\/claude\.ai\/artifact\//);
    const fundo = await page.locator(".qr-placa").evaluate((el) => getComputedStyle(el).backgroundColor);
    assert.equal(fundo, "rgb(255, 255, 255)");
    await semRolagemHorizontal(page, "acesso");
    await foto(page, `${esquema}-${viewport.width}-1-acesso`);
  });

  await etapa(`${tag} passador: PageDown percorre os sete blocos e volta ao início`, async () => {
    const vistos = [];
    for (let i = 0; i < 7; i++) {
      vistos.push(await bloco(page));
      await semRolagemHorizontal(page, vistos[i]);
      await page.keyboard.press("PageDown");
    }
    assert.deepEqual(vistos, ["acesso", "cronometro", "gabarito", "simulador", "placar", "maos", "variante"]);
    assert.equal(await bloco(page), "acesso");
    await page.keyboard.press("PageUp");
    assert.equal(await bloco(page), "variante");
  });

  await etapa(`${tag} cronômetro: inicia, conta, pausa e zera`, async () => {
    await page.keyboard.press("2");
    assert.equal(await bloco(page), "cronometro");
    assert.equal(await page.locator("#relogio").textContent(), "00:00");
    assert.match(await page.locator("#relogio-sub").textContent(), /Faltam 18:00/);
    await page.locator("#btn-relogio").click();
    await page.waitForFunction(() => document.getElementById("relogio").textContent === "00:01", null, { timeout: 3000 });
    await page.locator("#btn-relogio").click();
    assert.equal(await page.locator("#btn-relogio").textContent(), "Continuar");
    const congelado = await page.locator("#relogio").textContent();
    await page.waitForTimeout(1200);
    assert.equal(await page.locator("#relogio").textContent(), congelado);
    assert.equal(await page.locator(".fase.atual").count(), 1);
    await semRolagemHorizontal(page, "cronômetro");
    await foto(page, `${esquema}-${viewport.width}-2-cronometro`);
    await page.locator("button", { hasText: "Zerar" }).click();
    assert.equal(await page.locator("#relogio").textContent(), "00:00");
    assert.equal(await page.locator("#btn-relogio").textContent(), "Iniciar");
  });

  await etapa(`${tag} gabarito: revela uma célula, depois tudo, depois oculta`, async () => {
    await page.keyboard.press("3");
    assert.equal(await page.locator(".gab button.revelar").count(), 12);
    await page.locator('td[data-celula="e1.requisito"] button').click();
    assert.equal(await page.locator(".gab td.aberta").count(), 1);
    assert.match(await page.locator('td[data-celula="e1.requisito"]').textContent(), /ordem judicial/);
    await page.locator("button", { hasText: "Revelar tudo" }).click();
    assert.equal(await page.locator(".gab td.aberta").count(), 12);
    assert.equal(await page.locator(".gab .gab-parcial").count(), 1);
    await semRolagemHorizontal(page, "gabarito");
    await foto(page, `${esquema}-${viewport.width}-3-gabarito`);
    await page.locator("button", { hasText: "Ocultar tudo" }).click();
    assert.equal(await page.locator(".gab td.aberta").count(), 0);
  });

  await etapa(`${tag} simulador: números de referência e relógio desalinhado`, async () => {
    await page.keyboard.press("4");
    await page.locator("#l-captura").waitFor();
    assert.equal(await page.locator("#l-captura").textContent(), "86%");
    assert.equal(await page.locator("#l-terceiros").textContent(), "≈ 550");
    assert.equal(await page.locator("#l-cobre").textContent(), "Sim");
    assert.match(await page.locator("#out-sjanela").textContent(), /13h37 às 13h57/);
    assert.equal(await page.locator("#grafico .curva").count(), 3);
    assert.equal(await page.locator("#grafico .curva.destaque").count(), 1);
    // Textos do gráfico: nenhum rótulo cortado pela borda nem sobreposto a outro,
    // e o corpo do texto não encolhe abaixo de 11 px na tela.
    const caixas = await page.locator("#grafico text").evaluateAll((els) => els.map((e) => {
      const b = e.getBoundingClientRect(), g = e.ownerSVGElement.getBoundingClientRect();
      return { cls: e.getAttribute("class"), t: e.textContent, x0: b.left - g.left, x1: b.right - g.left, y0: b.top - g.top, y1: b.bottom - g.top, w: g.width, px: parseFloat(getComputedStyle(e).fontSize) * (g.width / e.ownerSVGElement.viewBox.baseVal.width) };
    }));
    for (const c of caixas) {
      assert.ok(c.x0 >= -1 && c.x1 <= c.w + 1, `"${c.t}" cortado (${c.x0.toFixed(0)}..${c.x1.toFixed(0)} de ${c.w.toFixed(0)})`);
      assert.ok(c.px >= 11, `"${c.t}" com ${c.px.toFixed(1)} px`);
    }
    for (let i = 0; i < caixas.length; i++) for (let j = i + 1; j < caixas.length; j++) {
      const a = caixas[i], b = caixas[j];
      const sobrepoe = a.x0 < b.x1 - 1 && b.x0 < a.x1 - 1 && a.y0 < b.y1 - 1 && b.y0 < a.y1 - 1;
      assert.ok(!sobrepoe, `"${a.t}" sobre "${b.t}"`);
    }
    await page.locator("#sdesvio").fill("15");
    assert.equal(await page.locator("#l-cobre").textContent(), "Não");
    assert.equal(await page.locator("#l-efetiva").textContent(), "< 1%");
    // Teclas de seta dentro do controle deslizante não trocam de bloco.
    await page.locator("#sraio").focus();
    await page.keyboard.press("ArrowRight");
    assert.equal(await bloco(page), "simulador");
    assert.equal(await page.locator("#out-sraio").textContent(), "55 m");
    await page.locator('label:has(#fonte-gnss)').click();
    assert.equal(await page.locator("#l-captura").textContent(), "> 99%");
    await page.locator("#grafico rect").hover();
    assert.equal(await page.locator("#dica").isVisible(), true);
    assert.match(await page.locator("#dica").textContent(), / m · /);
    await semRolagemHorizontal(page, "simulador");
    await foto(page, `${esquema}-${viewport.width}-4-simulador`);
    // Volta ao estado de referência para a próxima rodada.
    await page.locator('label:has(#fonte-mista)').click();
    await page.locator("#sraio").fill("50");
    await page.locator("#sdesvio").fill("0");
    // Com o foco num controle, só o passador navega; tira o foco para os números.
    await page.evaluate(() => document.activeElement.blur());
  });

  await etapa(`${tag} placar e Chatrie`, async () => {
    await page.keyboard.press("5");
    const contagens = await page.locator(".voto .contagem").allTextContents();
    assert.equal(contagens.map(Number).reduce((a, b) => a + b, 0), 7);
    assert.match(await page.locator(".situacao").textContent(), /5 pela admissão, 2 pela vedação/);
    assert.match(await page.locator("body").textContent(), /Chatrie/);
    await semRolagemHorizontal(page, "placar");
    await foto(page, `${esquema}-${viewport.width}-5-placar`);
  });

  await etapa(`${tag} mãos: contadores somam, descontam e persistem`, async () => {
    await page.keyboard.press("6");
    const mais = page.getByRole("button", { name: "Mais uma mão: Defiro com restrições" }).first();
    await mais.click(); await mais.click(); await mais.click();
    await page.getByRole("button", { name: "Menos uma mão: Defiro com restrições" }).first().click();
    assert.equal(await page.locator("#o-maos-cerca-restricoes").textContent(), "2");
    await page.getByRole("button", { name: "Mais uma mão: Indefiro" }).nth(1).click();
    assert.equal(await page.locator("#o-maos-palavra-indefiro").textContent(), "1");
    await semRolagemHorizontal(page, "mãos");
    await foto(page, `${esquema}-${viewport.width}-6-maos`);
    await page.reload();
    await page.keyboard.press("6");
    assert.equal(await page.locator("#o-maos-cerca-restricoes").textContent(), "2");
    await page.locator("button", { hasText: "Zerar contagem" }).click();
    assert.equal(await page.locator("#o-maos-cerca-restricoes").textContent(), "0");
  });

  await etapa(`${tag} variante: análise revelável e contagem separada`, async () => {
    await page.keyboard.press("7");
    await page.locator("button", { hasText: "Revelar a análise" }).click();
    assert.ok(await page.locator(".analise li").count() >= 2);
    await page.getByRole("button", { name: "Mais uma mão: Defiro" }).first().click();
    assert.equal(await page.locator("#o-maosVariante-cerca-defiro").textContent(), "1");
    await semRolagemHorizontal(page, "variante");
    await foto(page, `${esquema}-${viewport.width}-7-variante`);
    await page.locator("button", { hasText: "Zerar contagem da variante" }).click();
  });

  await ctx.close();
}

try {
  await percurso("light", { width: 1280, height: 800 });
  await percurso("dark", { width: 1280, height: 800 });
  await percurso("light", { width: 390, height: 844 });
  await percurso("dark", { width: 390, height: 844 });

  await etapa("sem a biblioteca do QR, o bloco mostra o link e não quebra", async () => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
    await ctx.route(QR_URL, (r) => r.abort());
    const page = await ctx.newPage();
    const errosLocais = [];
    page.on("pageerror", (e) => errosLocais.push(e.message));
    await page.goto(base + "/b");
    await page.locator(".sem-qr").waitFor();
    assert.match(await page.locator("#link-aluno").textContent(), /claude\.ai/);
    assert.deepEqual(errosLocais, []);
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
