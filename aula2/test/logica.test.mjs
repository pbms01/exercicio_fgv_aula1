import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const base = new URL("../src/", import.meta.url);
vm.runInThisContext(await readFile(new URL("logica.js", base), "utf8"));
const L = globalThis.Aula2Logica;
const C = JSON.parse(await readFile(new URL("conteudo.json", base), "utf8"));
const M = C.modelo;

// --- Conteúdo ---------------------------------------------------------------

test("cada célula tem exatamente uma correta e três cartões com fundamento", () => {
  assert.equal(C.elos.length, 4);
  for (const elo of C.elos) {
    for (const col of C.colunas) {
      const cel = elo.celulas[col.id];
      assert.ok(cel, `${elo.id}.${col.id} ausente`);
      assert.equal(cel.cartoes.length, 3, `${elo.id}.${col.id}`);
      assert.equal(cel.cartoes.filter((c) => c.tipo === "correta").length, 1, `${elo.id}.${col.id}`);
      for (const c of cel.cartoes) {
        assert.ok(c.sintese && c.detalhe && c.texto, `${elo.id}.${col.id}.${c.id} sem texto`);
        assert.ok(c.fundamentos.length > 0, `${elo.id}.${col.id}.${c.id} sem fundamento`);
      }
    }
  }
});

test("a resposta correta não fica sempre na mesma posição", () => {
  const posicoes = new Set();
  for (const elo of C.elos) {
    for (const col of C.colunas) {
      posicoes.add(elo.celulas[col.id].cartoes.findIndex((c) => c.tipo === "correta"));
    }
  }
  assert.equal(posicoes.size, 3);
});

test("o único parcial é o art. 19.3.c no laudo", () => {
  const parciais = [];
  for (const elo of C.elos) for (const col of C.colunas)
    for (const c of elo.celulas[col.id].cartoes) if (c.tipo === "parcial") parciais.push(`${elo.id}.${col.id}`);
  assert.deepEqual(parciais, ["e4.budapeste"]);
});

// --- Modelo -----------------------------------------------------------------

test("números de referência do plano", () => {
  assert.ok(Math.abs(L.terceiros(300, 120, M) - 76341) < 50, "300 m e 120 min ≈ 76 mil");
  assert.ok(Math.abs(L.terceiros(50, 20, M) - 550) < 5, "50 m e 20 min ≈ 550");
  assert.ok(Math.abs(L.terceiros(25, 10, M) - 98) < 3, "25 m e 10 min ≈ 100");
  assert.equal(L.formatarPct(L.captura(50, M.sigma)), "86%");
  assert.equal(L.formatarPct(L.captura(25, M.sigma)), "39%");
  assert.equal(L.formatarPct(L.captura(300, M.sigma)), "> 99%");
  assert.equal(L.formatarTerceiros(L.terceiros(300, 120, M)), "≈ 76 mil");
  assert.equal(L.formatarTerceiros(L.terceiros(50, 20, M)), "≈ 550");
});

test("medidores monotônicos: raio ou janela maiores nunca reduzem terceiros nem captura", () => {
  for (let r = M.raio.min; r < M.raio.max; r += M.raio.passo) {
    assert.ok(L.captura(r + M.raio.passo, M.sigma) >= L.captura(r, M.sigma));
    for (let t = M.janela.min; t <= M.janela.max; t += M.janela.passo) {
      assert.ok(L.terceiros(r + M.raio.passo, t, M) >= L.terceiros(r, t, M));
      if (t < M.janela.max) assert.ok(L.terceiros(r, t + M.janela.passo, M) >= L.terceiros(r, t, M));
    }
  }
});

test("janela centrada no registro do banco", () => {
  assert.deepEqual(L.janelaHorario("13:47", 20), { inicio: "13h37", fim: "13h57" });
  assert.deepEqual(L.janelaHorario("13:47", 10), { inicio: "13h42", fim: "13h52" });
  assert.deepEqual(L.janelaHorario("13:47", 120), { inicio: "12h47", fim: "14h47" });
});

// --- Seis sinais: cada combinação dispara só o seu --------------------------

function estado(over) {
  const e = L.estadoInicial(C);
  e.necessidade = "sim";
  e.raio = 50;
  e.janela = 20;
  e.etapas = true;
  e.termo = "nome";
  e.dias = 7;
  e.decisao.cerca = { escolha: "restricoes", fundamento: null };
  e.decisao.palavra = { escolha: "indefiro", fundamento: "gravidade" };
  return Object.assign(e, over);
}

test("combinação de referência: nenhum sinal", () => {
  assert.deepEqual(L.sinaisIncoerencia(estado({ adotaHediondos: true }), C), []);
});

const casos = {
  necessidade: { necessidade: "nao" },
  hediondos: { adotaHediondos: true, decisao: { cerca: { escolha: "indefiro", fundamento: "inadequacao" }, palavra: { escolha: "restricoes", fundamento: null } } },
  adequacao: { raio: 25, janela: 10 },
  estrita: { decisao: { cerca: { escolha: "defiro", fundamento: null }, palavra: { escolha: "indefiro", fundamento: "gravidade" } } },
  tematica: { decisao: { cerca: { escolha: "indefiro", fundamento: "inadequacao" }, palavra: { escolha: "defiro", fundamento: null } } },
  motivacao: { decisao: { cerca: { escolha: "indefiro", fundamento: "generico" }, palavra: { escolha: "indefiro", fundamento: "gravidade" } } }
};

for (const [sinal, over] of Object.entries(casos)) {
  test(`sinal "${sinal}" dispara sozinho`, () => {
    assert.deepEqual(L.sinaisIncoerencia(estado(over), C), [sinal]);
  });
}

test("indeferimento sem fundamento escolhido conta como motivação vazia", () => {
  const e = estado({ decisao: { cerca: { escolha: "indefiro", fundamento: null }, palavra: { escolha: "indefiro", fundamento: "gravidade" } } });
  assert.deepEqual(L.sinaisIncoerencia(e, C), ["motivacao"]);
});

test("decisão incompleta não gera sinais nem dispositivo", () => {
  const e = L.estadoInicial(C);
  assert.deepEqual(L.sinaisIncoerencia(e, C), []);
  assert.deepEqual(L.montarDispositivo(e, C), []);
  assert.equal(L.cartao(e, C), null);
});

test("dispositivo e cartão refletem as escolhas", () => {
  const e = estado({});
  const linhas = L.montarDispositivo(e, C);
  assert.ok(linhas.length >= 4 && linhas.length <= 5, `linhas: ${linhas.length}`);
  assert.match(linhas[1], /DEFIRO COM RESTRIÇÕES: raio de 50 m, das 13h37 às 13h57, com procedimento em etapas/);
  assert.match(linhas[2], /86%/);
  assert.match(linhas[3], /INDEFIRO, por desproporcionalidade, pois o crime não é hediondo/);
  assert.deepEqual(L.cartao(e, C), { cerca: "DEFIRO COM RESTRIÇÕES · 50 m · 20 min · em etapas", palavra: "INDEFIRO" });
});

test("defiro concede o pedido original, não os controles", () => {
  const e = estado({ raio: 25, janela: 10, decisao: { cerca: { escolha: "defiro", fundamento: null }, palavra: { escolha: "defiro", fundamento: null } } });
  const p = L.parametrosEfetivos(e, C);
  assert.equal(p.cerca.raio, 300);
  assert.equal(p.cerca.janela, 120);
  assert.equal(p.cerca.etapas, false);
  assert.equal(p.palavra.termo, "pedido");
  assert.equal(p.palavra.dias, 30);
});

test("grade da esteira reflete as escolhas", () => {
  const r = { "e1.requisito": "a", "e1.budapeste": "b", "e4.budapeste": "b" };
  const g = L.gradeEsteira(r, C);
  assert.deepEqual(g[0], ["correta", "distrator", null]);
  assert.equal(g[3][1], "parcial");
  assert.deepEqual(L.placarEsteira(r, C), { correta: 1, parcial: 1, distrator: 1, vazia: 9 });
});
