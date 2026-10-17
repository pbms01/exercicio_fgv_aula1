# Plano de implementação (v2, estabilizado): exercicio_fgv_aula1

Artefato interativo da Aula 1 (Cibercrimes). Demonstra, para público leigo em computação, as fases de um furto informático e a fronteira entre o previsto na lei e o não alcançado. Construção: Claude Code. Hospedagem: GitHub Pages, repositório `exercicio_fgv_aula1`. Consome uma API externa no papel de oráculo jurídico, como camada opcional sobre uma base canônica local.

A v1 deste plano foi revisada contra a legislação vigente em outubro de 2026 e contra a jurisprudência do STJ. A seção 12 registra o que mudou e por quê.

## 1. Invariantes de design

1. Todos os alvos são fictícios e vivem no próprio cliente. Nenhum dado real, nenhum sistema real.
2. O "pseudocódigo em execução" é teatro determinístico: anima um roteiro narrativo, linha a linha, sobre dados fabricados em `/data`. Não realiza operação de rede, não descreve técnica operacional, não tem capacidade fora do sandbox. A única chamada de rede do artefato é ao oráculo jurídico, e só quando `config.js` a habilita.
3. O repositório é público. Zero credenciais versionadas, zero segredos em `config.js`, zero dados reais. Chave de API, se existir, mora em proxy (seção 5.3).
4. A aula não depende de conectividade. Um service worker guarda o app shell em cache após a primeira visita; a base canônica local responde sem rede; se a API falhar, o artefato cai para a base local e sinaliza "modo offline" sem interromper o exercício.
5. Cada ato desfaz uma única intuição leiga. A clareza do contraste vale mais que exaustividade técnica.
6. O conteúdo jurídico é a base canônica local, revisada pelo autor e datada. A API nunca substitui esse conteúdo: ela o complementa e, se divergir do status canônico de um nó, é descartada.

## 2. Mapeamento pedagógico

Narrativa de três atos sobre o mesmo alvo bancário fictício.

* Ato 1, o momento. Intuição desfeita: "mexer já é crime". O aluno percorre a aproximação ao alvo e vê que quase tudo é atípico até um instante. Nota embutida: atos preparatórios são impuníveis (art. 14, II, CP, a contrario sensu), salvo tipificação autônoma, como a do art. 154-A, §1º, CP.
* Ato 2, o acesso. Intuição desfeita: "invadir depende de haver cadeado, e isso é fixo". Duas portas lado a lado e um controle de data mostram que o critério legal migrou de barreira para autorização, e que a mesma conduta mudou de atípica para típica em 28/05/2021. Há três regimes, não dois (seção 6).
* Ato 3, o modo. Intuição desfeita: "tirar dinheiro de conta alheia é estelionato". A bifurcação mostra que em regra é furto, e que isso muda juiz competente e pena máxima.

O phishing não é um ato: é o corredor que liga o Ato 2 ao Ato 3 (a credencial capturada abre a conta). O corredor explica a consunção: o acesso é crime-meio absorvido pelo crime-fim.

## 3. Arquitetura e stack

Aplicação de página única, estática, sem framework e sem build. HTML, CSS e JavaScript ES modules servidos direto do branch pelo GitHub Pages.

Decisão comentada: evita-se React, Vite ou qualquer bundler porque (a) o Pages serve estático sem Action de build, o que torna o deploy trivial e o artefato reproduzível entre turmas, e (b) o professor precisa abrir na projeção sem etapa intermediária. Service worker entra sem build, em um arquivo.

Padrão interno: máquina de estados declarativa. Cada ato e cada nó de bifurcação é um estado em tabela pura (`src/state-machine.js`); as escolhas do aluno são transições; o roteador por hash (`#/ato2/sem-cadeado`) espelha o estado na URL, o que dá link direto a qualquer nó e reinício entre turmas sem configuração no Pages.

Peças desacopladas:

* `pseudocode-runner`: recebe um roteiro de `/data/pseudocodigos.json` e o executa como teatro, destacando linha a linha, avançando por clique ou teclado, operando apenas sobre `/data/alvo-fake.json`.
* `oraculo` (adaptador): recebe o evento de um nó resolvido com `data_fato` e devolve o enquadramento. Três back-ends intercambiáveis (`local`, `proxy`, `real`) selecionados por `config.js`. O resto do app nunca sabe qual respondeu.
* `painel-juridico`, `semaforo`, `controle-data`, `mapa`: componentes de UI.

## 4. Camada de dados fictícios

`/data/alvo-fake.json`: a "Loja do Zé" e o "Banco Fictício" (instituição privada, para não abrir a discussão do art. 109, IV, CF). Vítima com domicílio e agência em cidades distintas, para que o contraste de foro do Ato 3 apareça na tela. Valores obviamente fabricados.

`/data/pseudocodigos.json`: um roteiro por nó, em português, em pseudocódigo estilizado e legível por leigo. Narrativa, não técnica.

`/data/oraculo.local.json`: a base canônica. Para cada nó, uma lista de regimes temporais (`vigencia_inicio`, `vigencia_fim`) com enquadramento, pena, fundamento, divergência, competência, explicações e fontes. Mesmo schema de saída da API (seção 5).

## 5. O oráculo jurídico: contrato, adaptador, fallback

### 5.1 Contrato

Endpoint: `POST /classificar`. Ajuste de nomes de campo ao schema real toca só `src/api/oraculo.js`.

Request. Envia fatos e data, não só o id do nó; o `no` vai como correlação.

```json
{
  "no": "ato2_sem_cadeado",
  "data_fato": "2026-10-17",
  "fatos": {
    "havia_mecanismo_seguranca": false,
    "mecanismo_violado": false,
    "autorizacao": "nenhuma",
    "finalidade": "obter_dados",
    "vitima_executou_a_transferencia": null
  },
  "nivel_explicacao": "ambos"
}
```

Response.

```json
{
  "no": "ato2_sem_cadeado",
  "data_fato": "2026-10-17",
  "enquadramento": {
    "status": "fronteira",
    "tipo_penal": "art. 154-A, caput, CP",
    "rubrica": "Invasão de dispositivo informático",
    "pena": "reclusão, de 1 a 4 anos, e multa",
    "fundamento": "art. 154-A, CP (Lei 12.737/2012, red. Lei 14.155/2021)"
  },
  "divergencia": {
    "majoritaria": { "conclusao": "típico", "razao": "..." },
    "contraria":   { "conclusao": "atípico", "razao": "..." }
  },
  "competencia": null,
  "acao_penal": "pública incondicionada",
  "linha_do_tempo": [
    { "de": null, "ate": "2013-04-01", "status": "atipico", "resumo": "..." },
    { "de": "2013-04-02", "ate": "2021-05-27", "status": "atipico", "resumo": "..." },
    { "de": "2021-05-28", "ate": null, "status": "fronteira", "resumo": "..." }
  ],
  "explicacao_leigo": "...",
  "explicacao_tecnica": "...",
  "fontes": [ { "rotulo": "...", "url": "..." } ]
}
```

`status` assume `atipico`, `tipico` ou `fronteira`. `divergencia` só vem quando `status` é `fronteira`. `competencia` só vem no Ato 3.

### 5.2 Adaptador e fallback

`config.js` (sem segredos, versionado):

```js
export const ORACULO = {
  MODE: "local",           // "local" | "proxy" | "real"
  BASE_URL: "",            // URL da API real ou do proxy, conforme MODE
  TIMEOUT_MS: 6000
};
```

`src/api/oraculo.js` expõe `classificar(evento)`. Em `local`, resolve pela base canônica, escolhendo o regime pela `data_fato`. Em `proxy`/`real`, faz `fetch` ao `BASE_URL` com timeout; em erro de rede, status não-2xx, resposta fora do schema ou `status` divergente do canônico, cai para `local` e emite o aviso "modo offline" (ou "resposta descartada", conforme o caso).

### 5.3 Proxy (apenas se a API exigir chave)

Cloudflare Worker ou função Vercel, em projeto separado do repositório público. Guarda a chave como secret, limita requisições por IP, libera CORS para `https://<user>.github.io`, e repassa o `POST /classificar`. Conferir `Origin` bloqueia navegadores de outros sites, mas não autentica nada; o limite de requisições é o que protege a cota. A chave nunca toca o front.

## 6. Especificação de UI, ato a ato

Tela-índice: o mapa dos três atos, SVG inline no `index.html` com nós clicáveis (um SVG via `<img>` não recebe clique nem CSS).

Teclado: `→`, `Espaço`, `PageDown` avançam uma linha do roteiro; `←`, `PageUp` voltam. PageDown/PageUp são as teclas emitidas pelos passadores de slide, o que permite conduzir a aula pelo passador.

Ato 1, o momento. Reconhecimento por fonte pública. Oráculo: `atipico`, sem tipo penal. Semáforo verde. Explicação: não se tocou dispositivo alheio; nota sobre o art. 154-A, §1º. Transição para o Ato 2.

Ato 2, o acesso (coração do exercício). Duas portas lado a lado e, abaixo, um controle de data com marcos em 02/04/2013 (vigência da Lei 12.737/2012, após vacatio de 120 dias) e 28/05/2021 (Lei 14.155/2021, datada de 27/05/2021 e vigente desde a publicação no DOU de 28/05/2021) e atalhos "2012", "2015", "hoje". Ao mover a data, o semáforo de cada porta muda no dia exato.

* Porta com cadeado (mecanismo de segurança violado). Antes de 02/04/2013: atípico (não havia tipo). De 02/04/2013 a 27/05/2021: típico, art. 154-A, detenção de 3 meses a 1 ano e multa. De 28/05/2021 em diante: típico, reclusão de 1 a 4 anos e multa. A tipicidade não mudou, a pena sim.
* Porta sem cadeado (serviço exposto, sem mecanismo de segurança). Antes de 28/05/2021: atípico, porque a redação original exigia "violação indevida de mecanismo de segurança". De 28/05/2021 em diante: `fronteira`. Tese majoritária: típico, porque a Lei 14.155/2021 suprimiu a exigência de barreira e o critério passou a ser a falta de autorização expressa ou tácita. Tese contrária: atípico, porque um serviço que responde a qualquer pedido na rede pública traria autorização tácita de acesso. O painel exibe as duas teses e indica qual é majoritária, sem carimbar gabarito.

Corredor do phishing. A credencial verdadeira capturada por engano abre a conta e conduz ao Ato 3. Enquadramento do acesso: art. 154-A em tese; como crime-meio do furto ou estelionato que se segue, é absorvido (consunção). Não há concurso.

Ato 3, o modo (clímax). Data fixa em hoje. Pergunta de corte: a vítima clicou e transferiu, ou a máquina foi enganada? Bifurcação por `vitima_executou_a_transferencia`:

* Máquina iludida, sem consentimento da vítima: furto qualificado mediante fraude eletrônica. `art. 155, §4º-B, CP`, reclusão de 4 a 10 anos e multa (Lei 15.397/2026; de 28/05/2021 a 2026 era 4 a 8). Competência: local da consumação (art. 70, caput, CPP), fixada pelo STJ no juízo da agência em que a vítima mantém a conta (CC 145.576/MA, Terceira Seção, 2016), com registro de que para o §4º-B há decisões pelo local das contas beneficiárias (CC 181.538/SP, 2021). Ação penal pública incondicionada.
* Vítima induzida a transferir ela mesma: estelionato por fraude eletrônica. `art. 171, §2º-A, CP`, reclusão de 4 a 8 anos e multa. Competência: domicílio da vítima (art. 70, §4º, CPP, incluído pela Lei 14.155/2021). Ação penal: condicionada à representação de 23/01/2020 a 2026 (art. 171, §5º, Lei 13.964/2019); pública incondicionada após a Lei 15.397/2026, que revogou o §5º.

O painel antecipa a objeção do aluno atento: o §2º-A fala em "informações fornecidas pela vítima", o que descreve o phishing. Resposta pelo critério do STJ (CC 67.343/GO; CC 181.538/SP): a fraude que burla a vigilância para subtrair é furto; a que colhe consentimento viciado para a entrega é estelionato. A vítima entregou a chave, não o dinheiro.

Fecho: o mesmo resultado econômico, conforme o modo da fraude, muda tipo, pena máxima e foro.

## 7. Estrutura de arquivos

```
exercicio_fgv_aula1/
├── index.html
├── README.md
├── PLANO.md
├── config.js                     # modo da API e base url; sem segredos
├── sw.js                         # service worker: cache versionado do app shell
├── .nojekyll
├── package.json                  # só scripts de teste; sem dependências
├── assets/
│   └── styles.css
├── src/
│   ├── app.js                    # bootstrap, roteador, teclado, service worker
│   ├── router.js                 # hash → estado
│   ├── state-machine.js          # tabela declarativa de atos, nós e transições
│   ├── pseudocode-runner.js      # teatro determinístico linha a linha
│   ├── atos/
│   │   ├── ato1-momento.js
│   │   ├── ato2-acesso.js
│   │   └── ato3-modo.js
│   ├── api/
│   │   └── oraculo.js            # adaptador local/proxy/real + fallback + validação
│   └── ui/
│       ├── mapa.js               # SVG inline da tela-índice
│       ├── semaforo.js           # cor + rótulo textual
│       ├── painel-juridico.js
│       └── controle-data.js
├── data/
│   ├── alvo-fake.json
│   ├── pseudocodigos.json
│   └── oraculo.local.json        # base canônica, com regimes temporais
└── test/
    ├── state-machine.test.mjs
    ├── oraculo.test.mjs
    └── e2e.mjs                   # Playwright: três atos, 1280x720, online e offline
```

## 8. Repositório e deploy

1. O repositório `pbms01/exercicio_fgv_aula1` existe e está público.
2. Desenvolvimento na branch `claude/tender-pascal-gigtdf`. Para o Pages publicar de `main`, criar `main` a partir dela.
3. Settings, Pages: source `Deploy from a branch`, branch `main`, pasta `/ (root)`. Sem build, não há o que separar em `/docs`. O `.nojekyll` evita o processamento Jekyll.
4. URL resultante: `https://pbms01.github.io/exercicio_fgv_aula1/`.
5. A cada publicação, incrementar `CACHE_VERSION` em `sw.js`, para a turma seguinte não receber conteúdo velho.

## 9. Segurança e conformidade

Alvos e dados 100% fabricados no cliente. Roteiros sem técnica operacional. Nenhum segredo no repositório público. Se a API tiver chave, proxy obrigatório. O propósito é expositivo e jurídico; o artefato não entrega técnica de ataque, apenas a representação estilizada das fases e o enquadramento legal de cada uma.

## 10. Critérios de aceite

1. Os três atos são navegáveis a partir da tela-índice e reiniciáveis entre turmas (URL com hash; botão "reiniciar").
2. Ato 2 mostra as duas portas; o controle de data exibe os três regimes e, na porta sem cadeado, as duas teses após 2021, sem carimbar gabarito.
3. O corredor do phishing liga o Ato 2 ao Ato 3 e explica a consunção.
4. Ato 3 bifurca por participação da vítima e exibe tipo penal, pena, fundamento, competência e ação penal em cada ramo.
5. Com a rede desligada após uma visita, o artefato carrega e os três atos funcionam; o aviso "modo offline" aparece quando `MODE` não é `local`.
6. Nenhuma credencial no front; se há chave, ela está só no proxy.
7. O roteiro roda de forma determinística, sempre igual, sobre os dados fictícios, por clique e por teclado.
8. Layout legível em projeção a 1280×720: alto contraste, tipografia grande, sem rolagem horizontal; respeita `prefers-reduced-motion`.
9. `node --test` passa; o e2e em Playwright percorre os três atos online e offline.

## 11. Pendências

1. Forma da API real (URL, método, autenticação, CORS, schema). Único ponto de encaixe: `src/api/oraculo.js` e `config.js`. Não bloqueia nada: o padrão é `local`.
2. Conferência pelo autor, no DOU, da data de publicação da Lei 15.397/2026 (as fontes divergem entre edição extra de 30/04/2026 e DOU de 04/05/2026) e da pena do art. 155, §4º-B (4 a 10 anos). A base canônica marca esses campos com `conferir: true`.
3. Criação da branch `main` e ativação do Pages (seção 8).

## 12. O que mudou da v1 para a v2

* Lei 15.397/2026 incorporada ao Ato 3: pena do art. 155, §4º-B elevada para 4 a 10 anos; §2º-A do art. 171 ampliado ("duplicação de dispositivo eletrônico ou aplicação de internet"); §5º do art. 171 revogado, estelionato de volta à ação pública incondicionada. O art. 154-A e o art. 70, §4º, CPP não foram alterados.
* Ato 2 com três regimes, não dois: antes de 02/04/2013 (sem tipo), 02/04/2013 a 27/05/2021 (Lei 12.737/2012: detenção de 3 meses a 1 ano, barreira exigida), 28/05/2021 em diante (Lei 14.155/2021: reclusão de 1 a 4 anos, barreira dispensada). A porta com cadeado ganhou linha do tempo própria.
* Na porta sem cadeado, a "corrente minoritária" baseada no verbo "invadir" foi substituída por "tese contrária" centrada em autorização tácita, porque a doutrina posterior a 2021 converge na dispensa da barreira e não se localizou autor identificável para a tese anterior.
* Corredor do phishing explica a consunção, para o aluno não sair com dois crimes em concurso.
* Ato 3 antecipa a objeção literal do §2º-A e a responde com o critério do STJ; registra competência com os precedentes e a não uniformidade para o §4º-B; registra a ação penal.
* Ato 1 ganhou a nota do art. 154-A, §1º.
* Precedência invertida: base canônica local é o conteúdo; API é camada opcional validada. Request envia fatos e `data_fato`.
* Offline de verdade com service worker; mapa SVG inline; roteamento por hash; teclas de passador; semáforo com rótulo textual; tema claro de alto contraste.
* `alvo-fake.json` separa domicílio da vítima e agência da conta, e o banco é privado, para o contraste de foro aparecer sem desvio para a Justiça Federal.
