// Ato 2: o acesso. Intuição desfeita: "invadir depende de haver cadeado, e
// isso é fixo no tempo".
//
// Layout: as duas portas lado a lado, cada uma com o próprio semáforo para a
// data escolhida; abaixo, o controle de data; abaixo, o roteiro e o painel da
// porta aberta. Mover a data reclassifica as duas portas ao mesmo tempo, que é
// o contraste que a aula quer projetar.

import { PseudocodeRunner } from "../pseudocode-runner.js";
import { proximaOpcao, estado } from "../state-machine.js";
import { criarSemaforo } from "../ui/semaforo.js";
import { criarControleData } from "../ui/controle-data.js";
import { el, cabecalhoAto, botaoSeguir, criarPainelVivo } from "./comum.js";

const PORTAS = [
  { id: "ato2_com_cadeado", chaveAlvo: "com_cadeado", fatos: { havia_mecanismo_seguranca: true, mecanismo_violado: true, autorizacao: "nenhuma", finalidade: "obter_dados" } },
  { id: "ato2_sem_cadeado", chaveAlvo: "sem_cadeado", fatos: { havia_mecanismo_seguranca: false, mecanismo_violado: false, autorizacao: "nenhuma", finalidade: "obter_dados" } }
];

export function render(container, ctx, est) {
  const bif = estado("ato2");
  const marcos = ctx.base._datas_marco;
  let selecionada = est.pai === "ato2" ? est.id : null;
  let runner = null;
  let painel = null;

  container.innerHTML = "";
  container.append(cabecalhoAto(bif.titulo, ctx.base.ato2_com_cadeado.intuicao_desfeita));

  // --- Portas ------------------------------------------------------------
  const portas = el("div", "portas");
  const cartoes = new Map();
  for (const p of PORTAS) {
    const info = ctx.alvo.portas[p.chaveAlvo];
    const b = el("button", "porta");
    b.type = "button";
    b.dataset.porta = p.id;
    const topo = el("div", "porta-topo");
    topo.append(el("span", "porta-icone", p.chaveAlvo === "com_cadeado" ? "🔒" : "🚪"));
    topo.append(el("span", "porta-titulo", estado(p.id).titulo));
    b.append(topo);
    b.append(el("p", "porta-desc", info.descricao_leiga));
    const sem = el("div", "porta-semaforo");
    const pena = el("p", "porta-pena");
    b.append(sem, pena);
    b.addEventListener("click", () => ctx.navegar(p.id));
    portas.append(b);
    cartoes.set(p.id, { b, sem, pena, p });
  }
  container.append(portas);

  // --- Controle de data --------------------------------------------------
  const controle = criarControleData({
    inicio: "2010-01-01",
    fim: ctx.hoje,
    valor: ctx.sessao.dataFato,
    marcos: [
      { data: marcos.lei_12737_2012_vigencia, rotulo: "Lei 12.737" },
      { data: marcos.lei_14155_2021_vigencia, rotulo: "Lei 14.155" }
    ],
    // Um atalho por regime: o professor salta entre as três épocas.
    atalhos: [
      { rotulo: "2012 · antes da lei", data: "2012-06-15" },
      { rotulo: "2015 · Lei 12.737", data: "2015-06-15" },
      { rotulo: "hoje · Lei 14.155", data: ctx.hoje }
    ],
    aoMudar: (iso) => {
      ctx.sessao.dataFato = iso;
      atualizarTudo();
    }
  });
  container.append(controle.el);

  // --- Detalhe da porta aberta -----------------------------------------
  const detalhe = el("div", "detalhe-porta");
  container.append(detalhe);

  const rodape = el("div", "ato-rodape");
  rodape.append(botaoSeguir("Seguir pelo corredor ▶", () => ctx.navegar("corredor")));
  container.append(rodape);

  async function atualizarPortas() {
    const data = ctx.sessao.dataFato;
    await Promise.all(
      PORTAS.map(async (p) => {
        const c = cartoes.get(p.id);
        const r = await ctx.classificar({ no: p.id, data_fato: data, fatos: p.fatos });
        const status = r.resposta.enquadramento?.status ?? "nenhum";
        c.sem.replaceChildren(criarSemaforo(status, { compacto: true }));
        c.pena.textContent = r.resposta.enquadramento?.pena ? `Pena: ${r.resposta.enquadramento.pena}` : "Sem pena: fato atípico nesta data";
        c.b.dataset.status = status;
      })
    );
  }

  function abrirDetalhe() {
    cartoes.forEach((c, id) => {
      c.b.classList.toggle("aberta", id === selecionada);
      c.b.setAttribute("aria-pressed", String(id === selecionada));
    });
    detalhe.innerHTML = "";
    runner = null;
    painel = null;
    if (!selecionada) {
      detalhe.append(el("p", "dica", "Escolha uma porta. Depois, arraste a data do fato e observe as duas portas mudarem de cor."));
      return;
    }
    const st = estado(selecionada);
    const grade = el("div", "grade-ato");
    const colRunner = el("div", "col-runner");
    const colPainel = el("aside", "col-painel");
    grade.append(colRunner, colPainel);
    detalhe.append(grade);
    runner = new PseudocodeRunner(colRunner, ctx.roteiros[st.roteiro]);
    painel = criarPainelVivo(colPainel, ctx);
    atualizarPainel();
  }

  function atualizarPainel() {
    if (!painel || !selecionada) return;
    const p = PORTAS.find((x) => x.id === selecionada);
    painel.atualizar({ no: selecionada, data_fato: ctx.sessao.dataFato, fatos: p.fatos });
  }

  function atualizarTudo() {
    atualizarPortas();
    atualizarPainel();
  }

  abrirDetalhe();
  atualizarPortas();

  return {
    // Navegação interna (troca de porta) sem redesenhar a tela inteira, para
    // preservar a data escolhida e evitar salto visual na projeção.
    aoRotear(novo) {
      if (novo.id !== "ato2" && novo.pai !== "ato2") return false;
      selecionada = novo.pai === "ato2" ? novo.id : null;
      abrirDetalhe();
      return true;
    },
    avancar() {
      if (!selecionada) {
        ctx.navegar(proximaOpcao("ato2", null));
        return true;
      }
      if (runner?.avancar()) return true;
      const prox = proximaOpcao("ato2", selecionada);
      if (prox) {
        ctx.navegar(prox);
        return true;
      }
      return false;
    },
    voltar() {
      if (runner?.voltar()) return true;
      if (selecionada) {
        const i = bif.opcoes.indexOf(selecionada);
        ctx.navegar(i > 0 ? bif.opcoes[i - 1] : "ato2");
        return true;
      }
      return false;
    },
    destruir() {}
  };
}
