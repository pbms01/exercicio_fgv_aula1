// Ato 1: o momento. Intuição desfeita: "mexer já é crime".
// O semáforo fica verde do início ao fim do roteiro: nada nesta fase toca
// dispositivo alheio. A exceção do art. 154-A, §1º, vem como nota no painel.

import { renderRoteiroSimples } from "./comum.js";

export function render(container, ctx, est) {
  return renderRoteiroSimples(container, ctx, est, { rotuloSeguir: "Seguir para o Ato 2 ▶" });
}
