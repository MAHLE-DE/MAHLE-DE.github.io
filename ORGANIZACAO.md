# Organizacao do site

Este repositorio contem uma SPA estatica usada para acompanhar backlogs, KPIs, auditorias e acquisition. O site roda a partir de `index.html`, usa arquivos separados em `css/` e `js/`, autentica usuarios pelo Firebase Auth e carrega os dados principais do Firestore pelo campo `jsonCompleto`.

## Estrutura versionada

- `.github/workflows/`: workflow do GitHub Pages.
- `assets/`: imagens e arquivos visuais usados pelo site.
- `css/`: folhas de estilo separadas por area da aplicacao.
- `js/`: scripts separados por area funcional.
- `info_dash/bas/Audit_json.bas`: macro para gerar o JSON de auditorias.
- `info_dash/bas/Dash_json.bas`: macro para gerar o JSON do dashboard.
- `info_dash/bas/macro_acquisition.txt`: macro final de Acquisition para aplicar na planilha real.
- `index.html`: estrutura principal da SPA.
- `ORGANIZACAO.md`: este guia de organizacao.

## Estrutura local ignorada

- `backups/`: backups historicos criados antes de alteracoes grandes.
- `site_atual/`: pasta antiga, nao usada pela versao ativa.
- `info_dash/excel/`: planilhas locais de teste e referencia.
- arquivos JSON soltos e planilhas dentro de `info_dash/`.
- `audit_schedule.json`: JSON local temporario usado apenas nos testes da futura aba Schedule.

## Telas da SPA

- `Backlogs`: primeira aba operacional, com filtros, busca, cards independentes por coluna e pendencias por projeto.
- `KPIs`: graficos de desempenho por DE, dashboard anual, responsividade e recalculos ao trocar filtros/abas.
- `Audits`: lista de projetos, busca, detalhe de auditoria, overview por documentos, leitura de imagem base64 e informacoes gerais do projeto.
- `Audit Schedule`: aba reservada, ainda em construcao neste commit.
- `Acquisition`: acompanhamento de quotation follow-up, action board, KPIs, filtros, historico e documentos atrasados inativos separados.
- `Benchmark`: aba reservada, ainda em construcao.

## Arquivos CSS

- `css/base.css`: variaveis, reset, loading global e estilos compartilhados.
- `css/login.css`: tela de login.
- `css/layout.css`: sidebar, topbar, secoes da SPA e layout base.
- `css/backlogs.css`: filtros, cards e visual dos projetos pendentes.
- `css/kpis.css`: grafico Overall Analysis by Development Engineer.
- `css/dashboard.css`: dashboard anual customizado da aba KPIs.
- `css/audits.css`: lista, detalhe, graficos e cards da aba Audits.
- `css/acquisition.css`: hero, KPIs, filtros, action board, historico e animacoes da aba Acquisition.

## Arquivos JavaScript

- `js/firebase-config.js`: configuracao do Firebase.
- `js/backlogs.js`: carregamento do JSON principal, filtros, cards de pendencias e score real vindo das auditorias quando disponivel.
- `js/kpis.js`: calculos e graficos basicos de KPI usando scores reais de projeto quando a auditoria existe.
- `js/dashboard.js`: dashboard anual da aba KPIs, filtros, responsividade, linhas de target e animacoes.
- `js/audits.js`: carregamento das auditorias, tela inicial, detalhe do projeto, imagem base64 e grafico de documentos.
- `js/acquisition.js`: leitura de `acquisition/acquisition`, filtros, KPIs, action board, historico, overdue ativo e overdue inativo.
- `js/navigation.js`: login/logout, troca de abas, inicializacao das secoes e listeners globais.

## Firestore

Colecoes/documentos utilizados pelo site neste commit:

- `dashboard/dashboard`: JSON do dashboard anual.
- `audits/audits`: JSON completo das auditorias.
- `acquisition/acquisition`: JSON completo de Acquisition.

Em todos os casos, o site espera o campo `jsonCompleto` como string contendo o JSON completo.

## Macros versionadas

### Dashboard

Arquivo:

- `info_dash/bas/Dash_json.bas`

Responsavel por gerar o JSON que alimenta `dashboard/dashboard`.

### Audits

Arquivo:

- `info_dash/bas/Audit_json.bas`

Responsavel por gerar o JSON que alimenta `audits/audits`, incluindo os dados de projeto, gates auditados, documentos, datas e imagem em base64 quando configurada.

### Acquisition

Arquivo:

- `info_dash/bas/macro_acquisition.txt`

Essa macro deve ser aplicada na planilha real `Acquisition template auto` e faz o fluxo completo:

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

O `.gitignore` mantem fora do Git:

- backups;
- `site_atual`;
- planilhas locais e JSONs de teste;
- arquivos soltos de `info_dash`;
- JSON temporario da futura aba Schedule.

Dentro de `info_dash/bas`, apenas as macros oficiais versionadas ficam liberadas.
