// Roteador por hash. Decisão: hash em vez de History API porque o GitHub
// Pages não tem fallback para SPA; com hash, qualquer link direto
// (…/exercicio_fgv_aula1/#/ato2/sem-cadeado) abre sem 404 e sem configuração.

import { estadoPorRota, normalizarRota, estado } from "./state-machine.js";

export function rotaAtual() {
  return normalizarRota(window.location.hash || "/");
}

export function estadoAtual() {
  return estadoPorRota(rotaAtual());
}

export function irPara(id) {
  const destino = "#" + estado(id).rota;
  if (window.location.hash === destino) {
    // Mesmo hash não dispara hashchange; força o redesenho.
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  } else {
    window.location.hash = destino;
  }
}

export function aoMudarRota(callback) {
  const handler = () => callback(estadoAtual());
  window.addEventListener("hashchange", handler);
  return () => window.removeEventListener("hashchange", handler);
}
