# Contrato sugerido para pendencias classificaveis

O formato antigo continua aceito:

```json
{
  "pendencias": [
    "BOM nao esta no Easy"
  ]
}
```

Para melhorar a classificacao, a macro deve passar cada pendencia como objeto:

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

Campos:

- `text`: pendencia escrita pelo auditor na coluna G.
- `criterion`: criterio da coluna D correspondente aquela pendencia.
- `criterionWeight`: quantidade de setas `->` vinculadas ao criterio. Use `0`
  quando nao houver seta.

O classificador usa o texto contextual:

```text
Document: BOM MS1. Criterion: BOM uploaded in EasyDMS. Finding: BOM nao esta no Easy.
```

Isso preserva inteligencia mesmo quando os criterios mudarem com o tempo, desde
que o formato da planilha continue estavel.

## KPI de impacto potencial na nota

Para estimar quais tipos de pendencia mais aumentariam a nota ao serem
resolvidos, usar:

- `document score`: nota atual do documento.
- `criterionWeight`: peso local do criterio.
- `category`: tipo classificado da pendencia.
- `gate`, `document`, `DE` e `project`: dimensoes de filtro.

Regra inicial sugerida:

```text
impacto_estimado = (10 - nota_documento) * (1 + criterionWeight)
```

Depois, quando a macro exportar a quantidade total de criterios avaliaveis por
documento, esse calculo pode ser refinado para distribuir o impacto entre as
pendencias reais do documento.
