// Teatro determinístico do pseudocódigo.
//
// Decisão: o avanço é por passo (clique, seta, PageDown do passador), não por
// temporizador. Isso dá ao professor o controle do ritmo e garante o critério
// de aceite 7: a mesma sequência de passos produz sempre a mesma tela. Não há
// Math.random, Date.now nem rede aqui; o runner só recebe linhas e um índice.

// Núcleo puro, testável em Node.
export function criarEstadoRunner(linhas) {
  return { linhas: linhas ?? [], indice: -1 };
}

// delta = +1 avança, -1 volta. Devolve novo estado (imutável) e se mudou.
export function passo(estadoRunner, delta) {
  const max = estadoRunner.linhas.length - 1;
  const novo = Math.min(max, Math.max(-1, estadoRunner.indice + delta));
  return {
    estado: { ...estadoRunner, indice: novo },
    mudou: novo !== estadoRunner.indice
  };
}

export function terminou(estadoRunner) {
  return estadoRunner.indice >= estadoRunner.linhas.length - 1;
}

// Componente de DOM. Desenha todas as linhas de uma vez e só alterna classes,
// para que o layout não salte durante a projeção.
export class PseudocodeRunner {
  constructor(container, roteiro, { aoMudar } = {}) {
    this.container = container;
    this.roteiro = roteiro;
    this.aoMudar = aoMudar ?? (() => {});
    this.estado = criarEstadoRunner(roteiro.linhas);
    this.render();
  }

  render() {
    const { linhas } = this.estado;
    this.container.innerHTML = "";
    this.container.classList.add("runner");

    const cab = document.createElement("div");
    cab.className = "runner-cab";
    cab.innerHTML = `<span class="runner-tag" aria-hidden="true">roteiro</span>
      <span class="runner-sub"></span>`;
    cab.querySelector(".runner-sub").textContent = this.roteiro.subtitulo ?? "";
    this.container.append(cab);

    const ol = document.createElement("ol");
    ol.className = "runner-linhas";
    ol.setAttribute("aria-live", "polite");
    linhas.forEach((l, i) => {
      const li = document.createElement("li");
      li.className = "runner-linha";
      li.dataset.i = String(i);
      const cod = document.createElement("code");
      cod.className = "runner-texto";
      cod.textContent = l.texto;
      const ef = document.createElement("span");
      ef.className = "runner-efeito";
      ef.textContent = l.efeito ? `→ ${l.efeito}` : "";
      li.append(cod, ef);
      if (l.nota) {
        const n = document.createElement("span");
        n.className = "runner-nota";
        n.textContent = l.nota;
        li.append(n);
      }
      ol.append(li);
    });
    this.container.append(ol);

    const ctrl = document.createElement("div");
    ctrl.className = "runner-ctrl";
    ctrl.innerHTML = `
      <button type="button" class="btn btn-sec" data-acao="voltar" aria-label="Linha anterior">◀ voltar</button>
      <span class="runner-contador" aria-live="polite"></span>
      <button type="button" class="btn" data-acao="avancar" aria-label="Próxima linha">avançar ▶</button>`;
    ctrl.addEventListener("click", (ev) => {
      const acao = ev.target.closest("button")?.dataset.acao;
      if (acao === "avancar") this.avancar();
      if (acao === "voltar") this.voltar();
    });
    this.container.append(ctrl);
    this.atualizar();
  }

  atualizar() {
    const { indice, linhas } = this.estado;
    this.container.querySelectorAll(".runner-linha").forEach((li) => {
      const i = Number(li.dataset.i);
      li.classList.toggle("executada", i < indice);
      li.classList.toggle("atual", i === indice);
      li.classList.toggle("pendente", i > indice);
    });
    const cont = this.container.querySelector(".runner-contador");
    if (cont) cont.textContent = `${Math.max(0, indice + 1)} / ${linhas.length}`;
    const atual = this.container.querySelector(".runner-linha.atual");
    // Rolagem suave só se o usuário não pediu movimento reduzido.
    if (atual && typeof atual.scrollIntoView === "function") {
      const reduzir = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      atual.scrollIntoView({ block: "nearest", behavior: reduzir ? "auto" : "smooth" });
    }
  }

  avancar() {
    const r = passo(this.estado, +1);
    this.estado = r.estado;
    if (r.mudou) {
      this.atualizar();
      this.aoMudar(this.estado);
    }
    return r.mudou;
  }

  voltar() {
    const r = passo(this.estado, -1);
    this.estado = r.estado;
    if (r.mudou) {
      this.atualizar();
      this.aoMudar(this.estado);
    }
    return r.mudou;
  }

  get terminou() {
    return terminou(this.estado);
  }

  get noInicio() {
    return this.estado.indice < 0;
  }
}
