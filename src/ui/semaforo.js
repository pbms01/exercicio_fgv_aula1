// Semáforo de tipicidade.
//
// Decisão de acessibilidade: a cor nunca é o único canal. Cada estado tem
// rótulo textual e posição própria (vermelho em cima, âmbar no meio, verde
// embaixo, como num semáforo real), porque parte da turma não distingue
// vermelho de verde e o projetor desbota cores.

export const ROTULOS = Object.freeze({
  tipico: { titulo: "TÍPICO", legenda: "a lei alcança" },
  fronteira: { titulo: "FRONTEIRA", legenda: "teses em disputa" },
  atipico: { titulo: "ATÍPICO", legenda: "a lei não alcança" },
  nenhum: { titulo: "SEM TIPO", legenda: "nenhum tipo vigente na data" }
});

export function criarSemaforo(status, { compacto = false } = {}) {
  const chave = ROTULOS[status] ? status : "nenhum";
  const el = document.createElement("div");
  el.className = `semaforo semaforo-${chave}${compacto ? " semaforo-compacto" : ""}`;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.innerHTML = `
    <div class="semaforo-caixa" aria-hidden="true">
      <span class="luz luz-tipico"></span>
      <span class="luz luz-fronteira"></span>
      <span class="luz luz-atipico"></span>
    </div>
    <div class="semaforo-texto">
      <strong class="semaforo-titulo"></strong>
      <span class="semaforo-legenda"></span>
    </div>`;
  el.querySelector(".semaforo-titulo").textContent = ROTULOS[chave].titulo;
  el.querySelector(".semaforo-legenda").textContent = ROTULOS[chave].legenda;
  el.dataset.status = chave;
  return el;
}
