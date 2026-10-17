import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  resolverRegime,
  respostaLocal,
  validarResposta,
  classificar,
  STATUS_VALIDOS
} from "../src/api/oraculo.js";

const base = JSON.parse(await readFile(new URL("../data/oraculo.local.json", import.meta.url), "utf8"));
const NOS = Object.keys(base).filter((k) => !k.startsWith("_"));

// Dia seguinte em UTC, para checar contiguidade entre regimes.
function diaSeguinte(iso) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

const status = (no, data) => resolverRegime(base[no], data)?.enquadramento.status ?? null;
const pena = (no, data) => resolverRegime(base[no], data)?.enquadramento.pena ?? null;

// ---------------------------------------------------------------------------
// Integridade da base canônica
// ---------------------------------------------------------------------------

test("regimes de cada nó são contíguos, ordenados e sem sobreposição", () => {
  for (const id of NOS) {
    const rs = base[id].regimes;
    assert.ok(rs.length > 0, id);
    assert.equal(rs.at(-1).ate, null, `${id}: último regime deve ficar aberto até hoje`);
    for (let i = 1; i < rs.length; i++) {
      assert.ok(rs[i - 1].ate, `${id}: regime ${i - 1} sem fim antes de outro`);
      assert.equal(rs[i].de, diaSeguinte(rs[i - 1].ate), `${id}: lacuna ou sobreposição entre regimes ${i - 1} e ${i}`);
    }
  }
});

test("todo regime tem status válido e os campos que o painel exibe", () => {
  for (const id of NOS) {
    for (const r of base[id].regimes) {
      const e = r.enquadramento;
      assert.ok(STATUS_VALIDOS.includes(e.status), `${id}: status ${e.status}`);
      assert.ok(e.rubrica && e.fundamento, `${id}: rubrica/fundamento`);
      assert.ok(r.resumo && r.explicacao_leigo && r.explicacao_tecnica, `${id}: textos`);
      if (e.status !== "atipico") assert.ok(e.tipo_penal && e.pena, `${id}: tipo/pena em fato típico`);
      if (e.status === "fronteira") {
        assert.ok(r.divergencia?.majoritaria && r.divergencia?.contraria, `${id}: fronteira sem as duas teses`);
      }
      assert.deepEqual(validarResposta({ enquadramento: e, divergencia: r.divergencia }), [], `${id}: passa no próprio validador`);
    }
  }
});

test("Ato 3 traz competência e ação penal em todo regime", () => {
  for (const id of ["ato3_maquina", "ato3_vitima"]) {
    for (const r of base[id].regimes) {
      assert.ok(r.competencia, `${id}: competência`);
      assert.ok(r.acao_penal, `${id}: ação penal`);
    }
  }
});

// ---------------------------------------------------------------------------
// Marcos temporais (o coração do Ato 2 e o ajuste da Lei 15.397/2026)
// ---------------------------------------------------------------------------

test("porta com cadeado: sem tipo antes de 02/04/2013, típico depois; pena muda em 28/05/2021", () => {
  assert.equal(status("ato2_com_cadeado", "2013-04-01"), "atipico");
  assert.equal(status("ato2_com_cadeado", "2013-04-02"), "tipico");
  assert.match(pena("ato2_com_cadeado", "2021-05-27"), /detenção, de 3 meses a 1 ano/);
  assert.match(pena("ato2_com_cadeado", "2021-05-28"), /reclusão, de 1 a 4 anos/);
});

test("porta sem cadeado: atípica até 27/05/2021, fronteira a partir de 28/05/2021", () => {
  assert.equal(status("ato2_sem_cadeado", "2015-06-01"), "atipico");
  assert.equal(status("ato2_sem_cadeado", "2021-05-27"), "atipico");
  assert.equal(status("ato2_sem_cadeado", "2021-05-28"), "fronteira");
  assert.equal(status("ato2_sem_cadeado", "2026-10-17"), "fronteira");
});

test("furto eletrônico: teto sobe de 8 para 10 anos com a Lei 15.397/2026", () => {
  assert.match(pena("ato3_maquina", "2026-05-03"), /4 a 8 anos/);
  assert.match(pena("ato3_maquina", "2026-05-04"), /4 a 10 anos/);
  assert.match(pena("ato3_vitima", "2026-10-17"), /4 a 8 anos/);
});

test("estelionato eletrônico: ação condicionada até 2026, incondicionada depois", () => {
  assert.match(resolverRegime(base.ato3_vitima, "2025-01-10").acao_penal, /condicionada à representação/);
  assert.match(resolverRegime(base.ato3_vitima, "2026-10-17").acao_penal, /incondicionada/);
});

test("data anterior ao primeiro regime devolve resposta sem regime, sem lançar", () => {
  const r = respostaLocal(base, "corredor_phishing", "2019-01-01");
  assert.equal(r.sem_regime, true);
  assert.equal(r.enquadramento, null);
});

// ---------------------------------------------------------------------------
// Adaptador: modos e fallback
// ---------------------------------------------------------------------------

const evento = { no: "ato2_sem_cadeado", data_fato: "2026-10-17", fatos: { havia_mecanismo_seguranca: false } };
const cfgRemoto = { MODE: "proxy", BASE_URL: "https://proxy.exemplo.invalido", TIMEOUT_MS: 200 };
const fetchJson = (corpo, ok = true, status = 200) => async () => ({ ok, status, json: async () => corpo });

test("modo local responde pela base, sem aviso", async () => {
  const r = await classificar(evento, { config: { MODE: "local", BASE_URL: "" }, base });
  assert.equal(r.origem, "local");
  assert.equal(r.aviso, null);
  assert.equal(r.resposta.enquadramento.status, "fronteira");
});

test("falha de rede cai para a base local com aviso offline", async () => {
  const r = await classificar(evento, {
    config: cfgRemoto,
    base,
    fetchImpl: async () => {
      throw new TypeError("Failed to fetch");
    }
  });
  assert.equal(r.origem, "local");
  assert.equal(r.aviso, "offline");
  assert.equal(r.resposta.enquadramento.status, "fronteira");
});

test("HTTP de erro cai para a base local com aviso offline", async () => {
  const r = await classificar(evento, { config: cfgRemoto, base, fetchImpl: fetchJson({}, false, 503) });
  assert.equal(r.aviso, "offline");
});

test("timeout cai para a base local com aviso offline", async () => {
  const lento = (_url, { signal }) =>
    new Promise((_, rej) => signal.addEventListener("abort", () => rej(new Error("abortado"))));
  const r = await classificar(evento, { config: cfgRemoto, base, fetchImpl: lento });
  assert.equal(r.aviso, "offline");
});

test("resposta fora do schema é descartada", async () => {
  const r = await classificar(evento, { config: cfgRemoto, base, fetchImpl: fetchJson({ enquadramento: { status: "talvez" } }) });
  assert.equal(r.aviso, "descartada");
  assert.equal(r.resposta.enquadramento.status, "fronteira");
});

test("fronteira remota sem as duas teses é descartada", async () => {
  const corpo = { enquadramento: { status: "fronteira", tipo_penal: "art. 154-A" }, divergencia: { majoritaria: { conclusao: "típico" } } };
  const r = await classificar(evento, { config: cfgRemoto, base, fetchImpl: fetchJson(corpo) });
  assert.equal(r.aviso, "descartada");
});

test("status remoto divergente do canônico é descartado", async () => {
  const corpo = { enquadramento: { status: "tipico", tipo_penal: "art. 154-A", pena: "x" } };
  const r = await classificar(evento, { config: cfgRemoto, base, fetchImpl: fetchJson(corpo) });
  assert.equal(r.aviso, "descartada");
  assert.match(r.detalhe, /diverge do canônico/);
});

test("resposta remota válida e concordante é aceita e completada pela base", async () => {
  const corpo = {
    enquadramento: { status: "fronteira", tipo_penal: "art. 154-A, caput, CP", pena: "reclusão, de 1 a 4 anos, e multa", rubrica: "Invasão", fundamento: "x" },
    divergencia: { majoritaria: { conclusao: "típico", razao: "r1" }, minoritaria: { conclusao: "atípico", razao: "r2" } },
    explicacao_leigo: "texto remoto"
  };
  let corpoEnviado;
  const r = await classificar(evento, {
    config: cfgRemoto,
    base,
    fetchImpl: async (_url, init) => {
      corpoEnviado = JSON.parse(init.body);
      return { ok: true, status: 200, json: async () => corpo };
    }
  });
  assert.equal(r.origem, "remoto");
  assert.equal(r.aviso, null);
  assert.equal(r.resposta.explicacao_leigo, "texto remoto");
  assert.ok(r.resposta.linha_do_tempo.length >= 2, "linha do tempo completada pela base local");
  // O request leva fatos e data, conforme o contrato v2.
  assert.equal(corpoEnviado.data_fato, "2026-10-17");
  assert.equal(corpoEnviado.fatos.havia_mecanismo_seguranca, false);
});
