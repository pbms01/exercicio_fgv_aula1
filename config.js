// Configuração pública do oráculo jurídico. Este arquivo é versionado num
// repositório público: nunca coloque chave, token ou URL com credencial aqui.
//
// MODE:
//   "local"  → resolve pela base canônica em data/oraculo.local.json (padrão)
//   "proxy"  → POST {BASE_URL}/classificar via proxy que guarda a chave
//   "real"   → POST {BASE_URL}/classificar direto na API (só se ela não exigir chave)
//
// Em "proxy" e "real", qualquer falha (rede, timeout, status não-2xx, resposta
// fora do schema ou status divergente do canônico) cai para "local" e a UI
// sinaliza o modo degradado. O resto do app não sabe qual back-end respondeu.
export const ORACULO = {
  MODE: "local",
  BASE_URL: "",
  TIMEOUT_MS: 6000
};
