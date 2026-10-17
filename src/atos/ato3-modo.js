// Ato 3: o modo. Intuição desfeita: "tirar dinheiro de conta alheia é
// estelionato". Data do fato fixa em hoje; a mudança de 2026 aparece na
// linha do tempo do painel.
//
// Também exporta o fecho, que põe os dois ramos lado a lado: mesmo prejuízo,
// outro crime, outra pena máxima, outro juiz.

import { PseudocodeRunner } from "../pseudocode-runner.js";
import { proximaOpcao, estado } from "../state-machine.js";
import { criarSemaforo } from "../ui/semaforo.js";
import { formatarBR } from "../ui/datas.js";
import { el, cabecalhoAto, botaoSeguir, criarPainelVivo } from "./comum.js";

// Foro concreto no cenário fictício. O alvo-fake.json põe domicílio e agência
// em cidades diferentes justamente para este contraste aparecer.
export function foroNoCenario(alvo, idRamo) {
  const v = alvo.vitima;
  if (idRamo === "ato3_maquina") {
    return `${v.conta_alvo.cidade_da_agencia}/${v.conta_alvo.uf_da_agencia}, onde fica a agência ${v.conta_alvo.agencia} da conta da vítima`;
  }
  return `${v.domicilio.cidade}/${v.domicilio.uf}, domicílio da vítima`;
}

const RAMOS = [
  { id: "ato3_maquina", rotulo: "A máquina foi enganada", desc: "Com a senha capturada, o agente faz a transferência. A vítima não sabe e não consente." },
  { id: "ato3_vitima", rotulo: "A vítima foi enganada", desc: "Convencida por uma história falsa, a própria vítima autoriza e faz a transferência." }
];

export function render(container, ctx, est) {
  const bif = estado("ato3");
  let selecionado = est.pai === "ato3" ? est.id : null;
  let runner = null;

  container.innerHTML = "";
  container.append(cabecalhoAto(bif.titulo, ctx.base.ato3_maquina.intuicao_desfeita));

  const corte = el("section", "pergunta-corte");
  corte.append(el("p", "pergunta-texto", bif.pergunta));
  corte.append(el("p", "pergunta-data", `Data do fato: hoje, ${formatarBR(ctx.hoje)}.`));
  const escolhas = el("div", "escolhas");
  const botoes = new Map();
  for (const r of RAMOS) {
    const b = el("button", "escolha");
    b.type = "button";
    b.append(el("span", "escolha-titulo", r.rotulo), el("span", "escolha-desc", r.desc));
    b.addEventListener("click", () => ctx.navegar(r.id));
    escolhas.append(b);
    botoes.set(r.id, b);
  }
  corte.append(escolhas);
  container.append(corte);

  const detalhe = el("div", "detalhe-ramo");
  container.append(detalhe);

  const rodape = el("div", "ato-rodape");
  rodape.append(botaoSeguir("Ver o fecho ▶", () => ctx.navegar("fecho")));
  container.append(rodape);

  function abrir() {
    botoes.forEach((b, id) => {
      b.classList.toggle("aberta", id === selecionado);
      b.setAttribute("aria-pressed", String(id === selecionado));
    });
    detalhe.innerHTML = "";
    runner = null;
    if (!selecionado) {
      detalhe.append(el("p", "dica", "Escolha um dos dois modos. O prejuízo é o mesmo; observe o que muda."));
      return;
    }
    const st = estado(selecionado);
    const grade = el("div", "grade-ato");
    const colRunner = el("div", "col-runner");
    const colPainel = el("aside", "col-painel");
    grade.append(colRunner, colPainel);
    detalhe.append(grade);
    runner = new PseudocodeRunner(colRunner, ctx.roteiros[st.roteiro]);
    const painel = criarPainelVivo(colPainel, ctx, { foroNoCenario: foroNoCenario(ctx.alvo, selecionado) });
    painel.atualizar({ no: selecionado, data_fato: ctx.hoje, fatos: st.fatos });
  }

  abrir();

  return {
    aoRotear(novo) {
      if (novo.id !== "ato3" && novo.pai !== "ato3") return false;
      selecionado = novo.pai === "ato3" ? novo.id : null;
      abrir();
      return true;
    },
    avancar() {
      if (!selecionado) {
        ctx.navegar(proximaOpcao("ato3", null));
        return true;
      }
      if (runner?.avancar()) return true;
      const prox = proximaOpcao("ato3", selecionado);
      if (prox) {
        ctx.navegar(prox);
        return true;
      }
      return false;
    },
    voltar() {
      if (runner?.voltar()) return true;
      if (selecionado) {
        const i = bif.opcoes.indexOf(selecionado);
        ctx.navegar(i > 0 ? bif.opcoes[i - 1] : "ato3");
        return true;
      }
      return false;
    },
    destruir() {}
  };
}

export function renderFecho(container, ctx, est) {
  container.innerHTML = "";
  container.append(cabecalhoAto(est.titulo, null));

  const v = ctx.alvo.vitima;
  const lead = el("p", "fecho-lead");
  lead.textContent = `O prejuízo é o mesmo nos dois modos: ${v.conta_alvo.saldo_ficticio} saem da conta de ${v.nome}. O que muda é quem faz o dinheiro sair, e com que vontade.`;
  container.append(lead);

  const tabela = el("table", "fecho-tabela");
  tabela.innerHTML = `<caption>Fato praticado hoje (${formatarBR(ctx.hoje)})</caption>
    <thead><tr><th scope="col"><span class="sr">Aspecto</span></th>
    <th scope="col">A máquina foi enganada</th><th scope="col">A vítima foi enganada</th></tr></thead>
    <tbody></tbody>`;
  const tbody = tabela.querySelector("tbody");
  container.append(tabela);

  const fim = el("p", "fecho-fim", "Mesmo resultado econômico. Conforme o modo da fraude, muda o crime, a pena máxima e o juiz.");
  container.append(fim);

  const rodape = el("div", "ato-rodape");
  rodape.append(botaoSeguir("Voltar ao mapa", () => ctx.navegar("indice")));
  const reiniciar = el("button", "btn btn-sec", "Reiniciar para nova turma");
  reiniciar.type = "button";
  reiniciar.addEventListener("click", () => ctx.reiniciar());
  rodape.append(reiniciar);
  container.append(rodape);

  Promise.all([
    ctx.classificar({ no: "ato3_maquina", data_fato: ctx.hoje, fatos: estado("ato3_maquina").fatos }),
    ctx.classificar({ no: "ato3_vitima", data_fato: ctx.hoje, fatos: estado("ato3_vitima").fatos })
  ]).then(([furto, estel]) => {
    const f = furto.resposta;
    const s = estel.resposta;
    const linhas = [
      ["Quem faz o dinheiro sair", "o agente, sem consentimento", "a própria vítima, enganada"],
      ["Crime", `${f.enquadramento.rubrica} (${f.enquadramento.tipo_penal})`, `${s.enquadramento.rubrica} (${s.enquadramento.tipo_penal})`],
      ["Pena", f.enquadramento.pena, s.enquadramento.pena],
      ["Juiz competente", f.competencia, s.competencia],
      ["Foro no cenário", foroNoCenario(ctx.alvo, "ato3_maquina"), foroNoCenario(ctx.alvo, "ato3_vitima")],
      ["Ação penal", f.acao_penal, s.acao_penal]
    ];
    for (const [rot, a, b] of linhas) {
      const tr = document.createElement("tr");
      const th = el("th", null, rot);
      th.scope = "row";
      // data-col alimenta o rótulo de cada célula quando, em tela estreita,
      // o CSS desmonta a tabela em cartões e o cabeçalho some.
      const tdA = el("td", null, a);
      tdA.dataset.col = "Máquina enganada";
      const tdB = el("td", null, b);
      tdB.dataset.col = "Vítima enganada";
      tr.append(th, tdA, tdB);
      tbody.append(tr);
    }
    // Semáforos no cabeçalho da tabela: os dois são típicos; a aula não é
    // sobre "crime ou não", e sim "qual crime".
    const ths = tabela.querySelectorAll("thead th");
    ths[1].append(criarSemaforo(f.enquadramento.status, { compacto: true }));
    ths[2].append(criarSemaforo(s.enquadramento.status, { compacto: true }));
  });

  return { avancar: () => false, voltar: () => false, destruir() {} };
}
