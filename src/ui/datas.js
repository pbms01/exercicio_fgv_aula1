// Utilitários de data. Decisão: trabalhamos sempre com strings ISO
// "AAAA-MM-DD" e aritmética em UTC, para que o controle de data e os marcos
// legais não sofram deslocamento de um dia conforme o fuso da máquina.

const DIA_MS = 86400000;

export function isoParaDias(iso) {
  return Math.round(Date.parse(iso + "T00:00:00Z") / DIA_MS);
}

export function diasParaIso(dias) {
  return new Date(dias * DIA_MS).toISOString().slice(0, 10);
}

export function formatarBR(iso) {
  if (!iso) return "";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

// "Hoje" do fuso local do navegador (a data que o professor vê no relógio),
// convertido para ISO. Aceita ?hoje=AAAA-MM-DD na URL para testes e para
// reproduzir exatamente uma aula passada.
export function hojeIso(search = globalThis.location?.search ?? "") {
  const param = new URLSearchParams(search).get("hoje");
  if (param && /^\d{4}-\d{2}-\d{2}$/.test(param)) return param;
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function descreverIntervalo(de, ate) {
  if (!de && !ate) return "em qualquer data";
  if (!de) return `até ${formatarBR(ate)}`;
  if (!ate) return `de ${formatarBR(de)} em diante`;
  return `de ${formatarBR(de)} a ${formatarBR(ate)}`;
}
