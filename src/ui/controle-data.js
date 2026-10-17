// Controle de data do fato (Ato 2).
//
// É a materialização do tema da aula: arrastar a data e ver a mesma conduta
// atravessar a fronteira entre o "não alcançado" e o "previsto". Os marcos são
// as datas de vigência na base canônica, para nunca divergir dela.

import { isoParaDias, diasParaIso, formatarBR } from "./datas.js";

export function criarControleData({ inicio, fim, valor, marcos = [], atalhos = [], aoMudar }) {
  const min = isoParaDias(inicio);
  const max = isoParaDias(fim);

  const el = document.createElement("section");
  el.className = "controle-data";
  el.setAttribute("aria-label", "Data do fato");
  el.innerHTML = `
    <div class="cd-topo">
      <label class="cd-rotulo" for="cd-range">Data do fato</label>
      <output class="cd-valor" for="cd-range"></output>
    </div>
    <div class="cd-trilho">
      <input id="cd-range" class="cd-range" type="range" step="1" />
      <div class="cd-marcos" aria-hidden="true"></div>
    </div>
    <div class="cd-atalhos" role="group" aria-label="Atalhos de data"></div>`;

  const range = el.querySelector(".cd-range");
  range.min = String(min);
  range.max = String(max);
  range.value = String(isoParaDias(valor));
  const saida = el.querySelector(".cd-valor");

  // Marcos posicionados em porcentagem do trilho.
  const caixaMarcos = el.querySelector(".cd-marcos");
  for (const m of marcos) {
    const pos = ((isoParaDias(m.data) - min) / (max - min)) * 100;
    if (pos < 0 || pos > 100) continue;
    const mk = document.createElement("span");
    mk.className = "cd-marco";
    mk.style.left = `${pos}%`;
    mk.innerHTML = `<span class="cd-marco-traco"></span><span class="cd-marco-rotulo"></span>`;
    mk.querySelector(".cd-marco-rotulo").textContent = `${formatarBR(m.data)} · ${m.rotulo}`;
    caixaMarcos.append(mk);
  }

  const caixaAtalhos = el.querySelector(".cd-atalhos");
  for (const a of atalhos) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-sec btn-peq";
    b.textContent = a.rotulo;
    b.dataset.data = a.data;
    b.addEventListener("click", () => definir(a.data, true));
    caixaAtalhos.append(b);
  }

  function atual() {
    return diasParaIso(Number(range.value));
  }

  function mostrar() {
    const iso = atual();
    saida.textContent = formatarBR(iso);
    range.setAttribute("aria-valuetext", formatarBR(iso));
    caixaAtalhos.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.data === iso)));
  }

  function definir(iso, notificar) {
    range.value = String(isoParaDias(iso));
    mostrar();
    if (notificar) aoMudar?.(atual());
  }

  range.addEventListener("input", () => {
    mostrar();
    aoMudar?.(atual());
  });

  mostrar();
  return { el, definir, atual };
}
