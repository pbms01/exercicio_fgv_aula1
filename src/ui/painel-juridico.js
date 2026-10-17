// Painel jurídico: renderiza a resposta do oráculo (local ou remota) no mesmo
// formato. Não decide nada de direito; só apresenta o que a base canônica ou
// a API validada devolveu.
//
// Decisão: texto entra sempre por textContent, nunca por innerHTML, porque a
// resposta pode vir de uma API externa. O innerHTML abaixo só monta a
// estrutura fixa, sem dados interpolados.

import { criarSemaforo, ROTULOS } from "./semaforo.js";
import { descreverIntervalo } from "./datas.js";

const AVISOS = {
  offline: "Modo offline: o oráculo não respondeu; exibindo a base local revisada.",
  descartada: "Resposta da API descartada (fora do schema ou divergente da base revisada); exibindo a base local."
};

function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto != null) e.textContent = texto;
  return e;
}

// opcoes: { modoExplicacao: "leigo" | "tecnico", aoTrocarModo, foroNoCenario }
export function renderPainel(container, resultado, opcoes = {}) {
  const { resposta: r, aviso, origem } = resultado;
  container.innerHTML = "";
  container.classList.add("painel");
  container.setAttribute("aria-label", "Painel jurídico");

  if (aviso) {
    const a = el("p", `aviso aviso-${aviso}`, AVISOS[aviso] ?? aviso);
    a.setAttribute("role", "status");
    container.append(a);
  }

  if (!r.enquadramento) {
    container.append(criarSemaforo("nenhum"));
    container.append(el("p", "painel-resumo", "Nenhum regime da base canônica cobre esta data para este nó."));
    return;
  }

  const e = r.enquadramento;

  // Cabeçalho: semáforo + rubrica
  const cab = el("div", "painel-cab");
  cab.append(criarSemaforo(e.status));
  const tit = el("div", "painel-titulo");
  tit.append(el("h3", "painel-rubrica", e.rubrica));
  if (e.tipo_penal) tit.append(el("p", "painel-tipo", e.tipo_penal));
  cab.append(tit);
  container.append(cab);

  if (r.resumo) container.append(el("p", "painel-resumo", r.resumo));

  // Ficha técnica
  const dl = el("dl", "painel-ficha");
  const linha = (rotulo, valor) => {
    if (!valor) return;
    dl.append(el("dt", null, rotulo), el("dd", null, valor));
  };
  linha("Pena", e.pena);
  linha("Fundamento", e.fundamento);
  linha("Competência", r.competencia);
  if (opcoes.foroNoCenario) linha("Foro no cenário", opcoes.foroNoCenario);
  linha("Ação penal", r.acao_penal);
  if (dl.children.length) container.append(dl);

  // Divergência: as duas teses lado a lado, sem gabarito
  if (r.divergencia) {
    const d = r.divergencia;
    const contraria = d.contraria ?? d.minoritaria;
    const box = el("section", "divergencia");
    box.append(el("h4", "divergencia-titulo", "Duas teses"));
    const grade = el("div", "divergencia-grade");
    const tese = (rotulo, t, classe) => {
      const c = el("article", `tese ${classe}`);
      c.append(el("p", "tese-rotulo", rotulo));
      c.append(el("p", "tese-conclusao", t.conclusao));
      if (t.razao) c.append(el("p", "tese-razao", t.razao));
      return c;
    };
    grade.append(tese("Tese majoritária", d.majoritaria, "tese-maj"));
    grade.append(tese("Tese contrária", contraria, "tese-con"));
    box.append(grade);
    box.append(el("p", "divergencia-nota", "O painel indica qual tese prevalece na doutrina, mas não carimba gabarito."));
    container.append(box);
  }

  // Explicação leigo/técnica
  const exp = el("section", "explicacao");
  const abas = el("div", "abas");
  abas.setAttribute("role", "group");
  abas.setAttribute("aria-label", "Nível da explicação");
  const modo = opcoes.modoExplicacao === "tecnico" ? "tecnico" : "leigo";
  for (const [valor, rotulo] of [["leigo", "Para leigo"], ["tecnico", "Técnica"]]) {
    const b = el("button", "aba", rotulo);
    b.type = "button";
    b.setAttribute("aria-pressed", String(modo === valor));
    b.addEventListener("click", () => opcoes.aoTrocarModo?.(valor));
    abas.append(b);
  }
  exp.append(abas);
  exp.append(el("p", "explicacao-texto", modo === "tecnico" ? r.explicacao_tecnica : r.explicacao_leigo));
  container.append(exp);

  if (r.nota_destaque) container.append(el("p", "nota-destaque", r.nota_destaque));

  if (r.objecao) {
    const ob = el("section", "objecao");
    ob.append(el("p", "objecao-pergunta", r.objecao.pergunta));
    ob.append(el("p", "objecao-resposta", r.objecao.resposta));
    container.append(ob);
  }

  // Linha do tempo derivada dos regimes, com o regime vigente destacado
  if (r.linha_do_tempo?.length > 1) {
    const lt = el("section", "linha-tempo");
    lt.append(el("h4", "linha-tempo-titulo", "Linha do tempo"));
    const ol = el("ol", "linha-tempo-lista");
    for (const item of r.linha_do_tempo) {
      const li = el("li", `lt-item lt-${item.status ?? "nenhum"}`);
      const vigente = r.regime && item.de === r.regime.de && item.ate === r.regime.ate;
      if (vigente) {
        li.classList.add("lt-vigente");
        li.setAttribute("aria-current", "true");
      }
      li.append(el("span", "lt-quando", descreverIntervalo(item.de, item.ate)));
      // Rótulo do semáforo (com acento), não o id interno do status.
      li.append(el("span", "lt-status", (ROTULOS[item.status] ?? ROTULOS.nenhum).titulo));
      if (item.pena) li.append(el("span", "lt-pena", item.pena));
      ol.append(li);
    }
    lt.append(ol);
    container.append(lt);
  }

  // Rodapé: fontes, origem, conferência pendente
  const rod = el("footer", "painel-rodape");
  if (r.conferir) {
    rod.append(el("p", "selo-conferir", "Dado da Lei 15.397/2026 pendente de conferência do autor no DOU."));
  }
  if (r.fontes?.length) {
    const det = el("details", "fontes");
    det.append(el("summary", null, "Fontes"));
    const ul = el("ul");
    for (const f of r.fontes) {
      const li = el("li");
      if (f.url) {
        const a = el("a", null, f.rotulo);
        a.href = f.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        li.append(a);
      } else {
        li.textContent = f.rotulo;
      }
      ul.append(li);
    }
    det.append(ul);
    rod.append(det);
  }
  rod.append(el("p", "origem", origem === "remoto" ? "Fonte: oráculo (API), validado contra a base." : "Fonte: base canônica local."));
  container.append(rod);
}
