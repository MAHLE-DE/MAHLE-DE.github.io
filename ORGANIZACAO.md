# Organizacao do site

Este repositorio contem uma SPA estatica usada para acompanhar backlogs, KPIs, auditorias e acquisition. O site roda a partir de `index.html`, usa arquivos separados em `css/` e `js/`, autentica usuarios pelo Firebase Auth e carrega os dados principais do Firestore.

## Estrutura atual

- `.github/workflows/`: workflow do GitHub Pages.
- `assets/`: imagens e arquivos visuais usados pelo site.
- `css/`: folhas de estilo separadas por area da aplicacao.
- `js/`: scripts separados por area funcional.
- `info_dash/bas/macro_acquisition.txt`: macro final de Acquisition para aplicar na planilha real.
- `index.html`: estrutura principal da SPA.
- `ORGANIZACAO.md`: este guia de organizacao.

Pastas locais que nao devem ir para o Git:

- `backups/`: backups historicos criados antes de alteracoes grandes.
- `info_dash/excel/`: planilhas locais usadas para teste e referencia.
- demais arquivos soltos de teste dentro de `info_dash/`.

## Telas da SPA

- `Backlogs`: primeira aba operacional, com filtros e cards de pendencias dos projetos.
- `KPIs`: graficos de desempenho por DE e dashboard anual.
- `Audits`: lista, detalhe e overview de auditorias por projeto.
- `Audit Schedule`: aba reservada, ainda em construcao.
- `Acquisition`: acompanhamento de quotation follow-up, action board, KPIs e historico.
- `Benchmark`: aba reservada, ainda em construcao.

## Arquivos CSS

- `css/base.css`: variaveis, reset, loading global e estilos compartilhados.
- `css/login.css`: tela de login.
- `css/layout.css`: sidebar, topbar, secoes da SPA e layout base.
- `css/backlogs.css`: filtros, cards e visual dos projetos pendentes.
- `css/kpis.css`: cards gerais de KPI.
- `css/dashboard.css`: dashboard anual customizado da aba KPIs.
- `css/audits.css`: lista, detalhe, graficos e cards da aba Audits.
- `css/acquisition.css`: hero, KPIs, filtros, action board, historico e animacoes da aba Acquisition.

## Arquivos JavaScript

- `js/firebase-config.js`: configuracao do Firebase.
- `js/backlogs.js`: carregamento do JSON principal, filtros, cards de pendencias e busca.
- `js/kpis.js`: calculos e graficos basicos de KPI.
- `js/dashboard.js`: dashboard anual da aba KPIs, filtros, responsividade e animacoes.
- `js/audits.js`: carregamento das auditorias, tela inicial, detalhe do projeto e grafico de documentos.
- `js/acquisition.js`: leitura de `acquisition/acquisition`, filtros, KPIs, action board, historico e visualizacao de documentos.
- `js/navigation.js`: login/logout, troca de abas, inicializacao das secoes e listeners globais.

## Firestore

Colecoes/documentos utilizados pelo site:

- `dashboard/dashboard`: JSON do dashboard anual.
- `audits/audits`: JSON completo das auditorias.
- `acquisition/acquisition`: JSON completo de Acquisition.

Em todos os casos, o site espera o campo `jsonCompleto` como string contendo o JSON.

## Macro de Acquisition

Arquivo final para Git:

- `info_dash/bas/macro_acquisition.txt`

Essa macro substitui a versao temporaria baseada na aba `Cronograma`. Ela deve ser aplicada na planilha real `Acquisition template auto` e faz o fluxo completo:

- localiza a planilha semanal do PM na pasta configurada;
- le a aba `BU2F`;
- atualiza a aba `Cronograma`;
- cria ou atualiza as abas semanais conforme necessario;
- gera o arquivo `acquisition.json`;
- envia o `jsonCompleto` para `acquisition/acquisition` no Firestore.

Pontos de configuracao no inicio da macro:

- `PM_FOLDER`: pasta onde ficam as planilhas do PM.
- `ACQUISITION_JSON_OUTPUT_FOLDER`: pasta local onde o `acquisition.json` sera salvo.
- `FIREBASE_AUTH_EMAIL`: email autorizado no Firebase Auth.
- `FIREBASE_AUTH_PASSWORD`: senha do usuario acima.

Macros publicas principais:

- `AtualizarProjetosOnGoing`: fluxo completo da planilha, JSON e Firebase.
- `Exportar_JSON_Acquisition`: gera apenas o JSON local.
- `Enviar_JSON_Acquisition_Firebase`: gera o JSON local e envia ao Firestore.

## Gitignore

O `.gitignore` foi ajustado para manter fora do Git:

- backups;
- `site_atual`, que era uma pasta antiga e nao faz mais parte da versao ativa;
- planilhas locais e JSONs de teste em `info_dash`;
- macros auxiliares antigas.

No `info_dash`, apenas `info_dash/bas/macro_acquisition.txt` fica liberado para versionamento.
