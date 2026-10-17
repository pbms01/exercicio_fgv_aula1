// Tela-índice: mapa dos três atos em SVG inline.
//
// Decisão: SVG inline (gerado aqui), e não arquivo em assets/ via <img>,
// porque só o SVG no DOM aceita nós clicáveis e focáveis e herda as cores
// do CSS. Em telas estreitas o SVG ficaria ilegível; ali o CSS o esconde e
// mostra a lista ordenada equivalente, que também serve a leitores de tela.

const NS = "http://www.w3.org/2000/svg";

// Coordenadas no viewBox 1000 × 340.
const NOS = [
  { id: "ato1", rota: "#/ato1", x: 16, y: 125, w: 160, h: 90, titulo: "Ato 1", sub: "o momento", frase: "mexer já é crime?" },
  { id: "ato2_com_cadeado", rota: "#/ato2/com-cadeado", x: 236, y: 62, w: 170, h: 70, titulo: "com cadeado", sub: "tranca violada" },
  { id: "ato2_sem_cadeado", rota: "#/ato2/sem-cadeado", x: 236, y: 208, w: 170, h: 70, titulo: "sem cadeado", sub: "porta encostada" },
  { id: "corredor", rota: "#/corredor", x: 452, y: 125, w: 150, h: 90, titulo: "Corredor", sub: "phishing", frase: "a chave verdadeira" },
  { id: "ato3_maquina", rota: "#/ato3/maquina", x: 662, y: 62, w: 170, h: 70, titulo: "máquina enganada", sub: "furto" },
  { id: "ato3_vitima", rota: "#/ato3/vitima", x: 662, y: 208, w: 170, h: 70, titulo: "vítima transfere", sub: "estelionato" },
  { id: "fecho", rota: "#/fecho", x: 870, y: 125, w: 116, h: 90, titulo: "Fecho", sub: "outro juiz" }
];

const MOLDURAS = [
  { id: "ato2", rota: "#/ato2", x: 220, y: 18, w: 202, h: 304, titulo: "Ato 2: o acesso" },
  { id: "ato3", rota: "#/ato3", x: 646, y: 18, w: 202, h: 304, titulo: "Ato 3: o modo" }
];

const SETAS = [
  [176, 170, 220, 170],
  [422, 170, 452, 170],
  [602, 170, 646, 170],
  [848, 170, 870, 170]
];

function svg(tag, attrs = {}, texto) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  if (texto != null) e.textContent = texto;
  return e;
}

export function renderMapa(container, { visitados = new Set() } = {}) {
  container.innerHTML = "";
  container.classList.add("mapa");

  const intro = document.createElement("p");
  intro.className = "mapa-intro";
  intro.textContent =
    "Um alvo bancário fictício, três atos. Em cada um, uma intuição de leigo cai. Clique num nó ou use o passador (PageDown) para começar pelo Ato 1.";
  container.append(intro);

  const s = svg("svg", {
    viewBox: "0 0 1000 340",
    class: "mapa-svg",
    role: "img",
    "aria-labelledby": "mapa-titulo"
  });
  s.append(svg("title", { id: "mapa-titulo" }, "Mapa dos três atos: Ato 1, Ato 2 com duas portas, corredor do phishing, Ato 3 com dois modos, fecho"));

  const defs = svg("defs");
  const marker = svg("marker", { id: "seta", viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 8, markerHeight: 8, orient: "auto-start-reverse" });
  marker.append(svg("path", { d: "M0,0 L10,5 L0,10 z", class: "mapa-seta-ponta" }));
  defs.append(marker);
  s.append(defs);

  for (const [x1, y1, x2, y2] of SETAS) {
    s.append(svg("line", { x1, y1, x2, y2, class: "mapa-seta", "marker-end": "url(#seta)" }));
  }

  for (const m of MOLDURAS) {
    const a = svg("a", { href: m.rota, class: "mapa-moldura" });
    a.append(svg("rect", { x: m.x, y: m.y, width: m.w, height: m.h, rx: 14 }));
    a.append(svg("text", { x: m.x + m.w / 2, y: m.y + 30, "text-anchor": "middle", class: "mapa-moldura-titulo" }, m.titulo));
    s.append(a);
  }

  for (const n of NOS) {
    const visitado = visitados.has(n.id);
    // Nós dentro das molduras (portas e modos) são mais estreitos: título menor.
    const filho = n.id.startsWith("ato2_") || n.id.startsWith("ato3_");
    const a = svg("a", { href: n.rota, class: `mapa-no${filho ? " mapa-no-filho" : ""}${visitado ? " visitado" : ""}`, "data-no": n.id });
    a.append(svg("rect", { x: n.x, y: n.y, width: n.w, height: n.h, rx: 10 }));
    const cx = n.x + n.w / 2;
    const temFrase = Boolean(n.frase);
    const base = n.y + n.h / 2 + (temFrase ? -12 : -2);
    a.append(svg("text", { x: cx, y: base, "text-anchor": "middle", class: "mapa-no-titulo" }, n.titulo));
    a.append(svg("text", { x: cx, y: base + 22, "text-anchor": "middle", class: "mapa-no-sub" }, n.sub));
    if (temFrase) a.append(svg("text", { x: cx, y: base + 44, "text-anchor": "middle", class: "mapa-no-frase" }, `“${n.frase}”`));
    if (visitado) a.append(svg("text", { x: n.x + n.w - 12, y: n.y + 20, "text-anchor": "end", class: "mapa-no-check" }, "✓"));
    s.append(a);
  }
  container.append(s);

  // Equivalente textual (telas estreitas e leitores de tela).
  const ol = document.createElement("ol");
  ol.className = "mapa-lista";
  const itens = [
    ["#/ato1", "Ato 1: o momento", "mexer já é crime?"],
    ["#/ato2", "Ato 2: o acesso", "duas portas, três épocas"],
    ["#/corredor", "Corredor: o phishing", "a chave verdadeira"],
    ["#/ato3", "Ato 3: o modo", "furto ou estelionato?"],
    ["#/fecho", "Fecho", "mesmo prejuízo, outro juiz"]
  ];
  for (const [href, titulo, frase] of itens) {
    const li = document.createElement("li");
    const a = document.createElement("a");
    a.href = href;
    a.textContent = titulo;
    const sp = document.createElement("span");
    sp.textContent = ` · ${frase}`;
    li.append(a, sp);
    ol.append(li);
  }
  container.append(ol);

  const legenda = document.createElement("div");
  legenda.className = "mapa-legenda";
  legenda.innerHTML = `
    <span class="leg leg-atipico">ATÍPICO · a lei não alcança</span>
    <span class="leg leg-fronteira">FRONTEIRA · teses em disputa</span>
    <span class="leg leg-tipico">TÍPICO · a lei alcança</span>`;
  container.append(legenda);
}
