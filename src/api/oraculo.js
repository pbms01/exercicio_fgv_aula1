// Adaptador do oráculo jurídico.
//
// Precedência (invariante 6 do PLANO): a base canônica local é o conteúdo.
// A API, quando ligada em config.js, é consultada primeiro, mas sua resposta
// só é aceita se (a) chegar a tempo, (b) passar na validação de schema e
// (c) concordar com o status canônico do nó para a mesma data. Qualquer falha
// cai para a base local, e o retorno informa o motivo para a UI sinalizar.
//
// Tudo que toca rede ou arquivo é injetável (base, fetchImpl, config), para
// que test/oraculo.test.mjs exercite o fallback sem navegador nem servidor.

export const STATUS_VALIDOS = Object.freeze(["atipico", "tipico", "fronteira"]);

// ---------------------------------------------------------------------------
// Resolução temporal (pura)
// ---------------------------------------------------------------------------

// Datas ISO "AAAA-MM-DD" comparam corretamente como string; evitamos Date
// para não depender do fuso horário da máquina de projeção.
export function dentroDoRegime(regime, dataFato) {
  const aposInicio = regime.de == null || dataFato >= regime.de;
  const antesDoFim = regime.ate == null || dataFato <= regime.ate;
  return aposInicio && antesDoFim;
}

export function resolverRegime(no, dataFato) {
  if (!no?.regimes?.length) return null;
  return no.regimes.find((r) => dentroDoRegime(r, dataFato)) ?? null;
}

// Monta a resposta no mesmo formato que a API devolveria (PLANO, seção 5.1).
export function respostaLocal(base, idNo, dataFato) {
  const no = base[idNo];
  if (!no) throw new Error(`Nó sem entrada na base canônica: ${idNo}`);
  const regime = resolverRegime(no, dataFato);
  if (!regime) {
    return {
      no: idNo,
      data_fato: dataFato,
      sem_regime: true,
      enquadramento: null,
      rubrica_no: no.rubrica_no,
      fontes: no.fontes ?? []
    };
  }
  return {
    no: idNo,
    data_fato: dataFato,
    rubrica_no: no.rubrica_no,
    intuicao_desfeita: no.intuicao_desfeita,
    enquadramento: regime.enquadramento,
    divergencia: regime.divergencia ?? null,
    competencia: regime.competencia ?? null,
    acao_penal: regime.acao_penal ?? null,
    resumo: regime.resumo,
    explicacao_leigo: regime.explicacao_leigo,
    explicacao_tecnica: regime.explicacao_tecnica,
    nota_destaque: regime.nota_destaque ?? null,
    objecao: no.objecao ?? null,
    linha_do_tempo: linhaDoTempo(no),
    regime: { de: regime.de, ate: regime.ate },
    fontes: no.fontes ?? [],
    conferir: Boolean(no.conferir)
  };
}

// A linha do tempo é derivada dos próprios regimes, para nunca divergir deles.
export function linhaDoTempo(no) {
  return (no.regimes ?? []).map((r) => ({
    de: r.de,
    ate: r.ate,
    status: r.enquadramento?.status ?? null,
    pena: r.enquadramento?.pena ?? null,
    resumo: r.resumo
  }));
}

// ---------------------------------------------------------------------------
// Validação de resposta remota (pura)
// ---------------------------------------------------------------------------

export function validarResposta(r) {
  const erros = [];
  if (!r || typeof r !== "object") return ["resposta não é objeto"];
  const e = r.enquadramento;
  if (!e || typeof e !== "object") erros.push("enquadramento ausente");
  else {
    if (!STATUS_VALIDOS.includes(e.status)) erros.push(`status inválido: ${e.status}`);
    if (e.status !== "atipico" && !e.tipo_penal) erros.push("tipo_penal ausente em fato típico ou de fronteira");
  }
  if (e?.status === "fronteira") {
    const d = r.divergencia;
    // Aceita "contraria" (v2) e "minoritaria" (contrato v1) para não quebrar
    // uma API que ainda siga o schema antigo.
    const lado2 = d?.contraria ?? d?.minoritaria;
    if (!d?.majoritaria?.conclusao || !lado2?.conclusao) erros.push("fronteira sem as duas teses");
  }
  return erros;
}

// ---------------------------------------------------------------------------
// Fachada usada pelo app
// ---------------------------------------------------------------------------

let basePromise = null;

export function carregarBase(fetchImpl = globalThis.fetch) {
  if (!basePromise) {
    const url = new URL("../../data/oraculo.local.json", import.meta.url);
    basePromise = fetchImpl(url).then((res) => {
      if (!res.ok) throw new Error(`Falha ao carregar base canônica: ${res.status}`);
      return res.json();
    });
  }
  return basePromise;
}

// evento: { no, data_fato, fatos?, nivel_explicacao? }
// opcoes: { config, base, fetchImpl }
// Devolve { resposta, origem: "local" | "remoto", aviso: null | "offline" | "descartada", detalhe? }
export async function classificar(evento, { config, base, fetchImpl = globalThis.fetch } = {}) {
  const cfg = config ?? (await import("../../config.js")).ORACULO;
  const canonica = base ?? (await carregarBase(fetchImpl));
  const local = respostaLocal(canonica, evento.no, evento.data_fato);

  if (cfg.MODE === "local" || !cfg.BASE_URL) {
    return { resposta: local, origem: "local", aviso: null };
  }

  let remota;
  try {
    remota = await chamarRemoto(evento, cfg, fetchImpl);
  } catch (err) {
    return { resposta: local, origem: "local", aviso: "offline", detalhe: String(err?.message ?? err) };
  }

  const erros = validarResposta(remota);
  if (erros.length) {
    return { resposta: local, origem: "local", aviso: "descartada", detalhe: erros.join("; ") };
  }
  if (local.enquadramento && remota.enquadramento.status !== local.enquadramento.status) {
    return {
      resposta: local,
      origem: "local",
      aviso: "descartada",
      detalhe: `status remoto "${remota.enquadramento.status}" diverge do canônico "${local.enquadramento.status}"`
    };
  }

  // Resposta remota aceita. Campos ausentes nela são completados pela base
  // local, para a UI nunca receber um painel pela metade.
  return { resposta: { ...local, ...remota, fontes: remota.fontes ?? local.fontes }, origem: "remoto", aviso: null };
}

async function chamarRemoto(evento, cfg, fetchImpl) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), cfg.TIMEOUT_MS ?? 6000);
  try {
    const res = await fetchImpl(`${cfg.BASE_URL.replace(/\/$/, "")}/classificar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        no: evento.no,
        data_fato: evento.data_fato,
        fatos: evento.fatos ?? {},
        nivel_explicacao: evento.nivel_explicacao ?? "ambos"
      }),
      signal: ctrl.signal
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}
