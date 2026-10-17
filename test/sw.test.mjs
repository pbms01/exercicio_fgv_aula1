// Garante que o service worker pré-carrega todo arquivo que o app usa. Sem
// isso, um módulo novo esquecido na lista quebraria só o modo offline, e só
// na sala de aula.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = fileURLToPath(new URL("..", import.meta.url));

async function listar(dir) {
  const saida = [];
  for (const ent of await readdir(join(raiz, dir), { withFileTypes: true })) {
    const p = join(dir, ent.name);
    if (ent.isDirectory()) saida.push(...(await listar(p)));
    else saida.push(p);
  }
  return saida;
}

test("sw.js pré-carrega todos os arquivos de src/, data/ e assets/", async () => {
  const sw = await readFile(join(raiz, "sw.js"), "utf8");
  const bloco = sw.match(/const ARQUIVOS = \[([\s\S]*?)\];/);
  assert.ok(bloco, "lista ARQUIVOS não encontrada em sw.js");
  const listados = new Set([...bloco[1].matchAll(/"\.\/([^"]*)"/g)].map((m) => m[1]));

  const esperados = [
    "index.html",
    "config.js",
    ...(await listar("src")),
    ...(await listar("data")),
    ...(await listar("assets"))
  ].map((p) => relative(".", p).split("\\").join("/"));

  const faltando = esperados.filter((p) => !listados.has(p));
  assert.deepEqual(faltando, [], `fora do precache: ${faltando.join(", ")}`);

  const inexistentes = [...listados].filter((p) => p && !esperados.includes(p));
  assert.deepEqual(inexistentes, [], `listados mas inexistentes: ${inexistentes.join(", ")}`);
});
