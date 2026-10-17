// Corredor do phishing: liga o Ato 2 ao Ato 3. O painel explica que o acesso
// com a credencial capturada é crime-meio, absorvido pelo crime-fim
// (consunção), para o aluno não sair com dois crimes em concurso.

import { renderRoteiroSimples } from "./comum.js";

export function render(container, ctx, est) {
  return renderRoteiroSimples(container, ctx, est, { rotuloSeguir: "Seguir para o Ato 3 ▶" });
}
