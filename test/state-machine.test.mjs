import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ESTADOS,
  SEQUENCIA,
  estadoPorRota,
  normalizarRota,
  telaDe,
  proximoDe,
  anteriorDe,
  proximaOpcao
} from "../src/state-machine.js";
import { passo, criarEstadoRunner, terminou } from "../src/pseudocode-runner.js";

const lerJson = async (p) => JSON.parse(await readFile(new URL(p, import.meta.url), "utf8"));

test("toda rota volta para o mesmo estado", () => {
  for (const e of Object.values(ESTADOS)) {
    assert.equal(estadoPorRota("#" + e.rota).id, e.id);
  }
});

test("rotas desconhecidas e variações caem no índice ou se normalizam", () => {
  assert.equal(estadoPorRota("#/nao-existe").id, "indice");
  assert.equal(estadoPorRota("").id, "indice");
  assert.equal(normalizarRota("ato2/sem-cadeado/"), "/ato2/sem-cadeado");
});

test("sequência principal vai do índice ao fecho sem buracos", () => {
  let id = "indice";
  const visitados = [id];
  while (proximoDe(id)) {
    id = proximoDe(id);
    visitados.push(id);
  }
  assert.deepEqual(visitados, [...SEQUENCIA]);
  assert.equal(anteriorDe("ato1"), "indice");
  assert.equal(anteriorDe("indice"), null);
});

test("filhos de bifurcação são desenhados na tela do pai", () => {
  assert.equal(telaDe("ato2_sem_cadeado").id, "ato2");
  assert.equal(telaDe("ato3_vitima").id, "ato3");
  assert.equal(proximoDe("ato2_com_cadeado"), "corredor");
});

test("passador percorre as opções da bifurcação em ordem e depois sai", () => {
  assert.equal(proximaOpcao("ato2", null), "ato2_com_cadeado");
  assert.equal(proximaOpcao("ato2", "ato2_com_cadeado"), "ato2_sem_cadeado");
  assert.equal(proximaOpcao("ato2", "ato2_sem_cadeado"), null);
  assert.equal(proximaOpcao("ato3", null), "ato3_maquina");
});

test("todo estado aponta para roteiro e nó de oráculo existentes", async () => {
  const roteiros = await lerJson("../data/pseudocodigos.json");
  const base = await lerJson("../data/oraculo.local.json");
  for (const e of Object.values(ESTADOS)) {
    if (e.roteiro) assert.ok(roteiros[e.roteiro]?.linhas?.length, `roteiro ausente: ${e.roteiro}`);
    if (e.oraculo) assert.ok(base[e.oraculo]?.regimes?.length, `nó ausente na base: ${e.oraculo}`);
  }
});

test("runner é determinístico e respeita os limites", () => {
  let s = criarEstadoRunner(["a", "b", "c"]);
  assert.equal(passo(s, -1).mudou, false, "não volta antes do início");
  for (let i = 0; i < 3; i++) s = passo(s, +1).estado;
  assert.equal(s.indice, 2);
  assert.ok(terminou(s));
  assert.equal(passo(s, +1).mudou, false, "não avança depois do fim");
  // A mesma sequência de passos produz sempre o mesmo estado.
  const seq = [+1, +1, -1, +1, +1];
  const rodar = () => seq.reduce((acc, d) => passo(acc, d).estado, criarEstadoRunner(["a", "b", "c"]));
  assert.deepEqual(rodar(), rodar());
});
