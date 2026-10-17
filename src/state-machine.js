// Máquina de estados declarativa do exercício.
//
// Decisão: a tabela é dado puro, sem DOM nem fetch, para ser testável em Node
// (test/state-machine.test.mjs) e para que a ordem pedagógica fique legível num
// único lugar. Cada estado tem uma rota de hash; o roteador só converte
// hash ↔ id, e as telas (src/atos/*) decidem o que desenhar.
//
// Tipos de estado:
//   "indice"      tela-mapa
//   "roteiro"     um roteiro de pseudocódigo + painel jurídico
//   "bifurcacao"  tela com escolhas (as portas do Ato 2, o modo do Ato 3)
//   "fecho"       comparação final do Ato 3

export const ESTADOS = Object.freeze({
  indice: {
    id: "indice",
    rota: "/",
    tipo: "indice",
    titulo: "Mapa dos três atos",
    proximo: "ato1"
  },
  ato1: {
    id: "ato1",
    rota: "/ato1",
    tipo: "roteiro",
    ato: 1,
    titulo: "Ato 1: o momento",
    roteiro: "ato1_reconhecimento",
    oraculo: "ato1_reconhecimento",
    proximo: "ato2"
  },
  ato2: {
    id: "ato2",
    rota: "/ato2",
    tipo: "bifurcacao",
    ato: 2,
    titulo: "Ato 2: o acesso",
    // A ordem das opções é também a ordem em que o passador (PageDown)
    // percorre as portas quando o professor não clica em nenhuma.
    opcoes: ["ato2_com_cadeado", "ato2_sem_cadeado"],
    proximo: "corredor"
  },
  ato2_com_cadeado: {
    id: "ato2_com_cadeado",
    rota: "/ato2/com-cadeado",
    tipo: "roteiro",
    ato: 2,
    pai: "ato2",
    titulo: "Porta com cadeado",
    roteiro: "ato2_com_cadeado",
    oraculo: "ato2_com_cadeado"
  },
  ato2_sem_cadeado: {
    id: "ato2_sem_cadeado",
    rota: "/ato2/sem-cadeado",
    tipo: "roteiro",
    ato: 2,
    pai: "ato2",
    titulo: "Porta sem cadeado",
    roteiro: "ato2_sem_cadeado",
    oraculo: "ato2_sem_cadeado"
  },
  corredor: {
    id: "corredor",
    rota: "/corredor",
    tipo: "roteiro",
    ato: 2,
    titulo: "Corredor: o phishing",
    roteiro: "corredor_phishing",
    oraculo: "corredor_phishing",
    proximo: "ato3"
  },
  ato3: {
    id: "ato3",
    rota: "/ato3",
    tipo: "bifurcacao",
    ato: 3,
    titulo: "Ato 3: o modo",
    pergunta: "A vítima clicou e transferiu, ou a máquina foi enganada?",
    opcoes: ["ato3_maquina", "ato3_vitima"],
    proximo: "fecho"
  },
  ato3_maquina: {
    id: "ato3_maquina",
    rota: "/ato3/maquina",
    tipo: "roteiro",
    ato: 3,
    pai: "ato3",
    titulo: "A máquina foi enganada",
    roteiro: "ato3_maquina",
    oraculo: "ato3_maquina",
    fatos: { vitima_executou_a_transferencia: false }
  },
  ato3_vitima: {
    id: "ato3_vitima",
    rota: "/ato3/vitima",
    tipo: "roteiro",
    ato: 3,
    pai: "ato3",
    titulo: "A vítima transferiu",
    roteiro: "ato3_vitima",
    oraculo: "ato3_vitima",
    fatos: { vitima_executou_a_transferencia: true }
  },
  fecho: {
    id: "fecho",
    rota: "/fecho",
    tipo: "fecho",
    ato: 3,
    titulo: "Fecho: mesmo prejuízo, outro crime, outro juiz",
    proximo: null
  }
});

// Sequência principal (sem os filhos das bifurcações), usada pelo mapa e
// pela navegação linear do passador.
export const SEQUENCIA = Object.freeze(["indice", "ato1", "ato2", "corredor", "ato3", "fecho"]);

export function estado(id) {
  const e = ESTADOS[id];
  if (!e) throw new Error(`Estado desconhecido: ${id}`);
  return e;
}

export function estadoPorRota(rota) {
  const limpa = normalizarRota(rota);
  return Object.values(ESTADOS).find((e) => e.rota === limpa) ?? ESTADOS.indice;
}

export function normalizarRota(rota) {
  if (!rota) return "/";
  let r = String(rota).trim();
  if (r.startsWith("#")) r = r.slice(1);
  if (!r.startsWith("/")) r = "/" + r;
  if (r.length > 1 && r.endsWith("/")) r = r.slice(0, -1);
  return r;
}

// Estado "de tela": os filhos de uma bifurcação são desenhados dentro da tela
// do pai (as duas portas ficam lado a lado), então a tela é a do pai.
export function telaDe(id) {
  const e = estado(id);
  return e.pai ? estado(e.pai) : e;
}

// Próximo estado na sequência principal a partir de qualquer estado.
export function proximoDe(id) {
  const tela = telaDe(id);
  return tela.proximo ?? null;
}

export function anteriorDe(id) {
  const tela = telaDe(id);
  const i = SEQUENCIA.indexOf(tela.id);
  return i > 0 ? SEQUENCIA[i - 1] : null;
}

// Para uma bifurcação, dada a opção atualmente aberta (ou nenhuma), qual a
// próxima opção que o passador deve abrir. Devolve null quando todas já foram
// percorridas, sinalizando que o próximo passo é sair da tela.
export function proximaOpcao(idBifurcacao, opcaoAtual) {
  const b = estado(idBifurcacao);
  if (b.tipo !== "bifurcacao") return null;
  if (!opcaoAtual) return b.opcoes[0];
  const i = b.opcoes.indexOf(opcaoAtual);
  return i >= 0 && i < b.opcoes.length - 1 ? b.opcoes[i + 1] : null;
}
