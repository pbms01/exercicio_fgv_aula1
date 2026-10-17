// Monta os dois artefatos autocontidos a partir de uma fonte única.
// O mesmo conteudo.json e a mesma logica.js entram no exercício (A) e no
// painel (B), para que gabarito e painel nunca divirjam. Não há etapa de
// build na página: isto roda aqui, antes de publicar.
//
// Uso: node montar.mjs            (gera dist/)
//      node montar.mjs --checar   (falha se dist/ estiver desatualizado)

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";

const raiz = new URL("./", import.meta.url);
const ler = (p) => readFile(new URL(p, raiz), "utf8");

const conteudo = JSON.parse(await ler("src/conteudo.json"));
// "</" dentro de <script> encerraria o bloco; "\/" é um escape válido em JSON.
const json = JSON.stringify(conteudo).replace(/<\//g, "<\\/");
const logica = await ler("src/logica.js");
const base = await ler("src/base.css");

function montar(template) {
  for (const marca of ["/*__BASE_CSS__*/", "__CONTEUDO_JSON__", "/*__LOGICA__*/"]) {
    if (!template.includes(marca)) throw new Error(`marca ausente no template: ${marca}`);
  }
  return template
    .replace("/*__BASE_CSS__*/", () => base)
    .replace("__CONTEUDO_JSON__", () => json)
    .replace("/*__LOGICA__*/", () => logica);
}

const alvos = [
  ["src/aluno.html", "dist/aula2-aluno.html"],
  ["src/professor.html", "dist/aula2-professor.html"]
];

await mkdir(new URL("dist/", raiz), { recursive: true });
const checar = process.argv.includes("--checar");
let desatualizado = false;
for (const [origem, destino] of alvos) {
  if (!existsSync(new URL(origem, raiz))) continue;
  const saida = montar(await ler(origem));
  if (checar) {
    const atual = existsSync(new URL(destino, raiz)) ? await ler(destino) : "";
    if (atual !== saida) { desatualizado = true; console.error(`desatualizado: ${destino}`); }
  } else {
    await writeFile(new URL(destino, raiz), saida);
    console.log(`${destino}: ${(saida.length / 1024).toFixed(1)} KB`);
  }
}
if (desatualizado) process.exit(1);
