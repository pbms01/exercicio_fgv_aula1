// Peças compartilhadas pelas telas dos atos.

import { PseudocodeRunner } from "../pseudocode-runner.js";
import { renderPainel } from "../ui/painel-juridico.js";

export function el(tag, classe, texto) {
  const e = document.createElement(tag);
  if (classe) e.className = classe;
  if (texto != null) e.textContent = texto;
  return e;
}

export function cabecalhoAto(titulo, intuicao) {
  const h = el("header", "ato-cab");
  h.append(el("h2", "ato-titulo", titulo));
  if (intuicao) {
    const p = el("p", "ato-intuicao");
    p.append(el("span", "ato-intuicao-rotulo", "Intuição a desfazer "), el("q", null, intuicao.replace(/^"|"$/g, "")));
    h.append(p);
  }
  return h;
}

export function botaoSeguir(rotulo, aoClicar) {
  const b = el("button", "btn btn-seguir", rotulo);
  b.type = "button";
  b.addEventListener("click", aoClicar);
  return b;
}

// Painel "vivo": reclassifica quando o evento muda e redesenha quando o
// modo de explicação muda. O contador de sequência descarta respostas que
// chegam fora de ordem (relevante quando a API remota está ligada e o
// professor arrasta a data rápido).
export function criarPainelVivo(container, ctx, { foroNoCenario } = {}) {
  let seq = 0;
  let ultimo = null;

  function desenhar() {
    if (!ultimo) return;
    renderPainel(container, ultimo, {
      modoExplicacao: ctx.sessao.modoExplicacao,
      foroNoCenario,
      aoTrocarModo: (m) => {
        ctx.definirModoExplicacao(m);
        desenhar();
      }
    });
  }

  return {
    async atualizar(evento) {
      const meu = ++seq;
      const r = await ctx.classificar(evento);
      if (meu !== seq) return;
      ultimo = r;
      desenhar();
    },
    redesenhar: desenhar
  };
}

// Tela de roteiro simples (Ato 1 e corredor): roteiro à esquerda, painel à
// direita, botão de seguir. Data do fato fixa em "hoje".
export function renderRoteiroSimples(container, ctx, est, { rotuloSeguir }) {
  const no = ctx.base[est.oraculo];
  const roteiro = ctx.roteiros[est.roteiro];
  container.innerHTML = "";
  container.append(cabecalhoAto(est.titulo, no?.intuicao_desfeita));

  const grade = el("div", "grade-ato");
  const colRunner = el("div", "col-runner");
  const colPainel = el("aside", "col-painel");
  grade.append(colRunner, colPainel);
  container.append(grade);

  const runner = new PseudocodeRunner(colRunner, roteiro);
  const painel = criarPainelVivo(colPainel, ctx);
  painel.atualizar({ no: est.oraculo, data_fato: ctx.hoje, fatos: est.fatos ?? {} });

  const rodape = el("div", "ato-rodape");
  rodape.append(botaoSeguir(rotuloSeguir, () => ctx.navegar(est.proximo)));
  container.append(rodape);

  return {
    avancar: () => runner.avancar(),
    voltar: () => runner.voltar(),
    destruir() {}
  };
}
