// Bootstrap do artefato: carrega dados, monta o contexto compartilhado pelas
// telas, liga roteador e teclado, registra o service worker.

import { ORACULO } from "../config.js";
import { classificar, carregarBase } from "./api/oraculo.js";
import { estado, telaDe, proximoDe, anteriorDe, SEQUENCIA } from "./state-machine.js";
import { estadoAtual, irPara, aoMudarRota } from "./router.js";
// irPara só sincroniza a URL; quem desenha é navegar(), definida em iniciar().
import { hojeIso } from "./ui/datas.js";
import { renderMapa } from "./ui/mapa.js";
import * as ato1 from "./atos/ato1-momento.js";
import * as ato2 from "./atos/ato2-acesso.js";
import * as corredor from "./atos/corredor.js";
import * as ato3 from "./atos/ato3-modo.js";

// Tela → renderizador. Os filhos das bifurcações usam a tela do pai.
const TELAS = {
  indice: (c, ctx) => {
    renderMapa(c, { visitados: ctx.sessao.visitados });
    return { avancar: () => false, voltar: () => false, destruir() {} };
  },
  ato1: ato1.render,
  ato2: ato2.render,
  corredor: corredor.render,
  ato3: ato3.render,
  fecho: ato3.renderFecho
};

async function carregarJson(caminho) {
  const res = await fetch(new URL(caminho, import.meta.url));
  if (!res.ok) throw new Error(`Falha ao carregar ${caminho}: ${res.status}`);
  return res.json();
}

async function iniciar() {
  const raiz = document.getElementById("app");
  const statusModo = document.getElementById("status-modo");
  const statusRede = document.getElementById("status-rede");

  let base, roteiros, alvo;
  try {
    [base, roteiros, alvo] = await Promise.all([
      carregarBase(),
      carregarJson("../data/pseudocodigos.json"),
      carregarJson("../data/alvo-fake.json")
    ]);
  } catch (err) {
    raiz.innerHTML = "";
    const p = document.createElement("p");
    p.className = "aviso aviso-offline";
    p.textContent = `Não foi possível carregar os dados do exercício (${err.message}). Abra o artefato pelo endereço publicado ou por um servidor local; arquivos abertos com duplo clique (file://) são bloqueados pelo navegador.`;
    raiz.append(p);
    return;
  }

  const hoje = hojeIso();
  // Decisão: todo o estado da sessão vive só na memória da página. Nada vai
  // para localStorage, cookies ou rede; recarregar ou fechar apaga tudo.
  const sessao = {
    dataFato: hoje,
    modoExplicacao: "leigo",
    visitados: new Set()
  };

  // Indicador de modo: o professor vê de relance de onde vem o direito.
  function marcarModo(aviso) {
    if (aviso === "offline") {
      statusModo.textContent = "modo offline · base local";
      statusModo.dataset.tipo = "offline";
    } else if (aviso === "descartada") {
      statusModo.textContent = "API descartada · base local";
      statusModo.dataset.tipo = "offline";
    } else if (ORACULO.MODE === "local" || !ORACULO.BASE_URL) {
      statusModo.textContent = "base local revisada";
      statusModo.dataset.tipo = "local";
    } else {
      statusModo.textContent = `oráculo: ${ORACULO.MODE}`;
      statusModo.dataset.tipo = "remoto";
    }
  }
  marcarModo(null);

  const ctx = {
    base,
    roteiros,
    alvo,
    hoje,
    sessao,
    async classificar(evento) {
      const r = await classificar(evento, { config: ORACULO, base });
      marcarModo(r.aviso);
      return r;
    },
    navegar: (id) => navegar(id),
    definirModoExplicacao(m) {
      sessao.modoExplicacao = m;
    },
    reiniciar() {
      sessao.dataFato = hoje;
      sessao.visitados.clear();
      // Força o redesenho mesmo se já estiver no mapa (marcas de visitado).
      mostrado = null;
      navegar("indice");
    }
  };

  // --- Navegação ----------------------------------------------------------
  // Decisão: a navegação disparada pelo app é síncrona. A URL muda na hora
  // em que o hash é atribuído, mas o evento hashchange só chega depois; se a
  // tela esperasse por ele, um segundo toque rápido no passador encontraria
  // o estado velho e seria processado em dobro ou perdido. Por isso
  // navegar() desenha já, e o hashchange que vem em seguida para o mesmo
  // estado é ignorado. Voltar/avançar do navegador e links continuam
  // chegando pelo hashchange normalmente.
  let telaAtual = null;
  let controlador = null;
  let mostrado = null;
  const nav = document.getElementById("nav-passos");

  function navegar(id) {
    mostrar(estado(id));
    irPara(id);
  }

  function desenharNav(idTela) {
    nav.innerHTML = "";
    for (const id of SEQUENCIA) {
      const e = estado(id);
      const a = document.createElement("a");
      a.href = "#" + e.rota;
      a.className = "passo" + (id === idTela ? " atual" : "") + (sessao.visitados.has(id) ? " visitado" : "");
      if (id === idTela) a.setAttribute("aria-current", "step");
      a.textContent = id === "indice" ? "Mapa" : e.titulo.split(":")[0];
      nav.append(a);
    }
  }

  function mostrar(est) {
    if (mostrado === est.id) return;
    mostrado = est.id;
    const tela = telaDe(est.id);
    sessao.visitados.add(tela.id);
    sessao.visitados.add(est.id);
    desenharNav(tela.id);
    document.title = `${est.titulo} · Cibercrimes, Aula 1`;

    // Mesma tela (ex.: trocar de porta): a tela decide se resolve sozinha.
    if (telaAtual === tela.id && controlador?.aoRotear?.(est)) return;

    controlador?.destruir?.();
    telaAtual = tela.id;
    raiz.innerHTML = "";
    const conteudo = document.createElement("div");
    conteudo.className = `tela tela-${tela.id}`;
    raiz.append(conteudo);
    controlador = TELAS[tela.id](conteudo, ctx, est);
    // Foco no título da tela para leitores de tela e para o passador não
    // ficar preso num botão da tela anterior.
    const h = conteudo.querySelector("h2");
    if (h) {
      h.tabIndex = -1;
      h.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0 });
  }

  aoMudarRota(mostrar);
  mostrar(estadoAtual());

  // --- Teclado e passador -------------------------------------------------
  // PageDown/PageUp são as teclas que os passadores de slide emitem; setas e
  // espaço servem ao teclado. Em campos de formulário (o controle de data),
  // setas e espaço pertencem ao campo; só PageDown/PageUp são interceptadas,
  // para o passador nunca mexer na data por acidente.
  const AVANCAR = new Set(["PageDown", "ArrowRight", " "]);
  const VOLTAR = new Set(["PageUp", "ArrowLeft"]);

  document.addEventListener("keydown", (ev) => {
    if (ev.altKey || ev.ctrlKey || ev.metaKey) return;
    const alvoEv = ev.target;
    const emCampo = alvoEv instanceof HTMLElement && alvoEv.matches("input, select, textarea, [contenteditable]");
    const ehPagina = ev.key === "PageDown" || ev.key === "PageUp";
    if (emCampo && !ehPagina) return;
    // Espaço num botão deve acionar o botão, não avançar o roteiro.
    if (ev.key === " " && alvoEv instanceof HTMLElement && alvoEv.matches("button, a, summary")) return;

    const est = estadoAtual();
    if (AVANCAR.has(ev.key)) {
      ev.preventDefault();
      if (!controlador?.avancar?.()) {
        const prox = proximoDe(est.id);
        if (prox) navegar(prox);
      }
    } else if (VOLTAR.has(ev.key)) {
      ev.preventDefault();
      if (!controlador?.voltar?.()) {
        const ant = anteriorDe(est.id);
        if (ant) navegar(ant);
      }
    }
  });

  document.getElementById("btn-reiniciar").addEventListener("click", () => ctx.reiniciar());

  // --- Rede ----------------------------------------------------------------
  function marcarRede() {
    statusRede.hidden = navigator.onLine;
  }
  window.addEventListener("online", marcarRede);
  window.addEventListener("offline", marcarRede);
  marcarRede();

  // --- Service worker ------------------------------------------------------
  // Só em contexto seguro (https ou localhost). Com ele, depois de uma visita
  // online o artefato abre inteiro sem rede (invariante 4).
  // Num quadro protegido (o claude.ai serve a página assim), ler
  // navigator.serviceWorker pode lançar em vez de rejeitar; o try cobre
  // os dois casos. Sem SW, o artefato funciona online normalmente.
  if ("serviceWorker" in navigator && window.isSecureContext) {
    try {
      navigator.serviceWorker.register(new URL("../sw.js", import.meta.url), { scope: "./" }).catch(() => {});
    } catch {
      /* sem SW neste host */
    }
  }
}

iniciar();
