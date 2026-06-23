# Classificador de pendencias de auditoria

Esta pasta e a versao simples do classificador. A ideia e baixar do Git, instalar
as dependencias e rodar um unico script Python.

## O que ele faz

O classificador le os JSONs da colecao `projetos`, encontra as pendencias dos
documentos auditados e classifica cada uma em um tipo padrao de pendencia.

Ele gera JSONs prontos para KPI, por exemplo:

- quantidade de pendencias por tipo;
- quantidade de pendencias por DE;
- quantidade de pendencias por gate;
- quantidade de pendencias por documento;
- impacto estimado de cada tipo de pendencia na nota dos documentos.

## O que e o modelo

Este classificador nao usa um arquivo unico de treino como `.pkl`.

O "modelo" e formado por tres partes:

1. `config/taxonomy.local.json`
   - Lista oficial de categorias.
   - Guarda exemplos aprovados de cada tipo de pendencia.
   - E o principal arquivo de inteligencia do classificador.

2. `data/human_labels.json`
   - Guarda decisoes humanas ja revisadas.
   - Se uma pendencia ja foi revisada, o classificador usa essa decisao direto.

3. Modelo de embeddings do Sentence Transformers
   - Baixado automaticamente na primeira execucao.
   - Modelo usado: `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2`.
   - Ele compara a pendencia nova com os exemplos aprovados.

## Como a classificacao funciona

1. O script le todos os JSONs de `input/projetos_json`.
2. Para cada pendencia, ele normaliza o texto.
3. Se o texto ja existe em `human_labels.json`, usa a categoria revisada.
4. Se o texto foi marcado como exclusao humana, ele nao ensina o modelo.
5. Se for texto novo, ele calcula similaridade semantica com os exemplos da
   taxonomia.
6. Se a confianca for baixa, marca como `needs_review`.

## Formato atual aceito

O formato antigo continua funcionando:

```json
{
  "pendencias": [
    "BOM nao esta no Easy"
  ]
}
```

## Formato recomendado para o futuro

Para deixar a IA mais inteligente, a macro deve exportar a pendencia com o
criterio correspondente:

```json
{
  "pendencias": [
    {
      "text": "BOM nao esta no Easy",
      "criterion": "BOM uploaded in EasyDMS",
      "criterionWeight": 1
    }
  ]
}
```

Assim o classificador entende o contexto:

```text
Document: BOM MS1. Criterion: BOM uploaded in EasyDMS. Finding: BOM nao esta no Easy.
```

Mesmo se o criterio mudar no futuro, o classificador continua lendo o criterio
daquela auditoria especifica.

## Como instalar em outra maquina

Na pasta `classificador_pendencias`, rode:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Na primeira execucao, o Python pode baixar o modelo de embeddings da internet.
Depois disso, o modelo fica salvo na pasta `models`.

## Como rodar localmente

Coloque os JSONs de projetos em:

```text
input/projetos_json
```

Depois rode:

```powershell
python run_classifier.py
```

Ou escolha pastas manualmente:

```powershell
python run_classifier.py --input input/projetos_json --output output
```

## Como rodar direto pelo Firebase

Este e o fluxo recomendado para alimentar o KPI do site.

O script baixa todos os documentos da colecao `projetos`, classifica tudo e
envia um JSON unico para:

```text
classificado/classificador
```

O campo enviado e:

```text
jsonCompleto
```

Comando:

```powershell
python run_classifier.py --from-firebase --upload-firebase --firebase-api-key "SUA_API_KEY" --firebase-project-id "site-mahle" --firebase-email "SEU_EMAIL" --firebase-password "SUA_SENHA"
```

Por padrao, no modo Firebase ele tambem le:

```text
audits/audits
```

Isso serve para encontrar `completionDate` ou `auditEndDate` e separar os KPIs
entre:

- projetos em andamento;
- projetos finalizados;
- historico completo.

Se quiser desativar esse cruzamento temporariamente:

```powershell
python run_classifier.py --from-firebase --upload-firebase --skip-audit-status
```

Tambem e possivel configurar por variaveis de ambiente:

```powershell
$env:FIREBASE_API_KEY="SUA_API_KEY"
$env:FIREBASE_PROJECT_ID="site-mahle"
$env:FIREBASE_EMAIL="SEU_EMAIL"
$env:FIREBASE_PASSWORD="SUA_SENHA"
python run_classifier.py --from-firebase --upload-firebase
```

Existe uma macro pronta para chamar esse comando:

```text
info_dash/bas/Classificador_firebase.txt
```

## Arquivos gerados

O script gera:

```text
output/classified_pending.json
output/classified_projects.json
output/pending_type_kpis.json
output/summary.json
output/classificador_completo.json
```

### `classified_pending.json`

Lista cada pendencia classificada linha por linha.

### `classified_projects.json`

Agrupa as pendencias classificadas por projeto, documento e gate.

### `pending_type_kpis.json`

Contem agregacoes prontas para montar KPIs no site.

### `summary.json`

Mostra um resumo da execucao:

- total de pendencias;
- textos unicos;
- pendencias que precisam revisao;
- pendencias excluidas manualmente;
- contagem por categoria.

### `classificador_completo.json`

JSON unico usado para alimentar o Firestore. Ele contem:

```json
{
  "metadata": {},
  "summary": {},
  "kpis": {},
  "projects": [],
  "classifiedPending": []
}
```

Esse e o conteudo que vai para `classificado/classificador/jsonCompleto`.

## Visoes dos KPIs

Todos os KPIs principais sao gerados com tres escopos:

- `overall`: historico completo, incluindo projetos em andamento e finalizados.
- `current`: apenas projetos sem `auditEndDate` ou `completionDate`.
- `completed`: apenas projetos com `auditEndDate` ou `completionDate`.

Isso permite alternar o site entre status atual e historico completo sem
reprocessar os dados.

## O que deve ir para o Git

Para rodar em outra maquina, envie esta pasta inteira:

```text
classificador_pendencias
```

Arquivos essenciais:

```text
run_classifier.py
requirements.txt
config/taxonomy.local.json
data/human_labels.json
input/projetos_json/*.json
COMO_USAR.md
CONTRATO_JSON.md
```

Opcionalmente, pode deixar fora do Git:

```text
models/
.venv/
output/
```

Essas tres pastas podem ser recriadas automaticamente.

## Como atualizar a inteligencia depois

Quando aparecerem pendencias novas marcadas como `needs_review`, o ideal e:

1. Revisar manualmente os textos novos.
2. Atualizar `data/human_labels.json`.
3. Rodar o classificador novamente.

Assim o sistema melhora com o tempo sem precisar treinar um modelo complexo.

## KPI de impacto estimado na nota

O arquivo `pending_type_kpis.json` ja inclui:

```text
estimated_score_impact_by_category
```

A formula inicial usada e:

```text
impacto_estimado = (10 - nota_documento) * (1 + criterionWeight)
```

Quando a macro exportar todos os criterios e pesos do documento, esse calculo
pode ser refinado para estimar melhor quais tipos de pendencia mais aumentariam
a nota do projeto se fossem resolvidos.
