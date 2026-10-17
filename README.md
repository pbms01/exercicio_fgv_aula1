# Cibercrimes, Aula 1: furto informático e a fronteira da tipicidade

Artefato interativo para projeção em aula. Um alvo bancário fictício atravessa três atos, e em cada um uma intuição de leigo cai:

1. **Ato 1, o momento.** "Mexer já é crime?" Reconhecimento por fonte pública é atípico; nota sobre o art. 154-A, §1º, CP.
2. **Ato 2, o acesso.** Duas portas (com e sem mecanismo de segurança) e um controle de data com três regimes: antes de 02/04/2013, Lei 12.737/2012 e Lei 14.155/2021. Na porta sem cadeado, depois de 2021, o painel mostra as duas teses sem carimbar gabarito.
3. **Corredor do phishing.** O acesso com a credencial capturada é crime-meio, absorvido pelo crime-fim (consunção).
4. **Ato 3, o modo.** Máquina enganada (furto, art. 155, §4º-B) ou vítima enganada (estelionato, art. 171, §2º-A). Muda o tipo, a pena máxima e o juiz.
5. **Fecho.** Os dois ramos lado a lado, com o foro concreto no cenário fictício.

Tudo é fictício e roda no navegador. O "pseudocódigo" é teatro narrativo: não executa nem descreve técnica de ataque. O plano completo, com as decisões e o que mudou da v1, está em [PLANO.md](PLANO.md).

## Na sala de aula

Abra o endereço publicado **uma vez antes da aula, com internet**. A partir daí o service worker guarda o artefato e ele funciona inteiro sem rede.

| Ação | Tecla |
|---|---|
| Avançar linha do roteiro, abrir a próxima porta ou modo, ir para a próxima etapa | `PageDown`, `→`, `Espaço` |
| Voltar | `PageUp`, `←` |

`PageDown` e `PageUp` são as teclas que os passadores de slide emitem, então dá para conduzir a aula inteira pelo passador. Com o foco no controle de data, o passador não mexe na data: só as setas do teclado a movem.

No Ato 2, os atalhos "2012", "2015" e "hoje" saltam entre os três regimes. Cada etapa tem endereço próprio (por exemplo `…/#/ato2/sem-cadeado`), útil para abrir direto num ponto. O botão **Reiniciar** limpa as marcas de visitado e volta ao mapa para a turma seguinte.

Para reproduzir exatamente uma aula passada, acrescente `?hoje=AAAA-MM-DD` ao endereço.

## Revisar o conteúdo jurídico

Todo o direito do artefato está em [`data/oraculo.local.json`](data/oraculo.local.json), a base canônica. Cada nó tem regimes temporais (`de`, `ate`) com enquadramento, pena, fundamento, competência, ação penal, teses e explicações para leigo e técnica. O código não contém texto jurídico.

Campos marcados com `"conferir": true` dependem de conferência no DOU. Hoje isso cobre a **Lei 15.397/2026**: as fontes secundárias divergem entre publicação em edição extra de 30/04/2026 e no DOU de 04/05/2026 (a base usa 04/05/2026 provisoriamente), e a pena do art. 155, §4º-B (4 a 10 anos) veio de fontes secundárias. Depois de conferir, ajuste as datas e remova o `conferir` do nó; o selo "pendente de conferência" some do painel.

Ao alterar a base, rode `npm test`: os testes falham se os regimes de um nó tiverem lacuna ou sobreposição de datas, se faltar campo que o painel exibe, ou se um marco mudar de dia.

## Publicar no GitHub Pages

1. Em *Settings → Pages*: *Deploy from a branch*, branch `main`, pasta `/ (root)`.
2. Endereço: `https://pbms01.github.io/exercicio_fgv_aula1/`.
3. Não há build: o push publica. O `.nojekyll` desliga o processamento Jekyll.
4. A cada publicação, incremente `CACHE_VERSION` em [`sw.js`](sw.js). Se esquecer, a correção ainda chega a partir da segunda abertura, porque o service worker atualiza o cache em segundo plano; incrementar força a troca completa.

## Ligar a API do oráculo

O padrão é `MODE: "local"` em [`config.js`](config.js). Para usar uma API, defina `MODE` (`"real"` ou `"proxy"`) e `BASE_URL`; o contrato do `POST /classificar` está no PLANO, seção 5.1. Se a API exigir chave, ela fica num proxy separado, nunca neste repositório público.

A resposta da API só é aceita se chegar a tempo, passar na validação de schema e concordar com o status canônico do nó para a mesma data. Caso contrário, o artefato usa a base local e sinaliza "modo offline" ou "API descartada" no topo da tela.

## Desenvolvimento

Sem dependências e sem build. Para rodar localmente:

```bash
npm run serve        # http://localhost:8080 (ou qualquer servidor estático)
npm test             # unitários: máquina de estados, base canônica, adaptador, precache
npm run e2e          # aceite em Chromium: três atos, offline, API fora do ar, celular
```

Abrir `index.html` com duplo clique (`file://`) não funciona: os navegadores bloqueiam módulos ES e `fetch` nesse modo.

O e2e usa o Playwright instalado no ambiente (`npm i -g playwright` e `npx playwright install chromium`, se necessário). Com `SHOTS=pasta npm run e2e`, ele salva screenshots de cada tela.

| Caminho | Papel |
|---|---|
| `src/state-machine.js` | estados, rotas e transições (dado puro, testável) |
| `src/api/oraculo.js` | adaptador local/proxy/real, resolução temporal, validação e fallback |
| `src/pseudocode-runner.js` | teatro determinístico, avanço por passo |
| `src/atos/` | telas dos atos, corredor e fecho |
| `src/ui/` | mapa SVG, semáforo, painel jurídico, controle de data |
| `data/` | cenário fictício, roteiros e base canônica |
| `sw.js` | cache offline |
