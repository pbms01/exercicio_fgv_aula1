# Exercícios da Aula II (22/10/2026)

Dois artefatos autocontidos, publicados como páginas do claude.ai, montados a partir de uma fonte única para que o gabarito do exercício e o painel nunca divirjam.

O exercício do aluno (A) está em https://claude.ai/artifact/RPeXoRC9RSNtCFsaHewRc2 e precisa ser compartilhado com "qualquer pessoa com o link". O painel do professor (B) está em https://claude.ai/artifact/QWxVsFZehFnScyM2L98zM6 e fica privado.

`src/conteudo.json` guarda todo o texto jurídico, os cartões, o gabarito, o placar do Tema 1148 e as pendências de conferência. `src/logica.js` tem as funções puras (medidores, sinais de coerência, dispositivo, cartão). `src/base.css` traz os tokens de tema. `src/aluno.html` e `src/professor.html` são os modelos; `node montar.mjs` injeta conteúdo, lógica e CSS e grava `dist/aula2-aluno.html` e `dist/aula2-professor.html`, que são exatamente os arquivos publicados. `node montar.mjs --checar` falha se `dist/` estiver desatualizado.

Nenhum dos dois declara capacidades de execução nem faz chamada de rede, salvo a biblioteca do QR no painel (`qrcode-generator@1.4.4` pelo jsDelivr); sem ela, o painel mostra o link no lugar do código. O estado fica no `localStorage` do próprio navegador, com falha silenciosa quando o armazenamento está bloqueado. Nenhuma resposta de aluno sai do aparelho.

Testes, a partir desta pasta:

```
node --test "test/*.test.mjs"                       # lógica e integridade do conteúdo
node test/e2e-aluno.mjs [pasta-de-screenshots]      # percurso completo a 360 px, claro e escuro, e 1280 px
node test/e2e-professor.mjs [pasta-de-screenshots]  # sete blocos a 390 e 1280 px, claro e escuro
```

Os testes de navegador usam Playwright. O do painel serve a biblioteca do QR a partir de `vendor/pkg/package/qrcode.js` (fora do git); para obtê-la, `mkdir -p vendor/pkg && cd vendor/pkg && npm pack qrcode-generator@1.4.4 && tar xzf qrcode-generator-1.4.4.tgz`.

Para atualizar o placar do Tema 1148 na véspera, edite `placar_1148` e `conferido_em` em `src/conteudo.json`, rode `node montar.mjs` e os testes, e republique os dois arquivos de `dist/` nos mesmos links.
