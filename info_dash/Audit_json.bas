Option Explicit

Private Const LAST_UPDATE_TOKEN As String = "__LAST_UPDATE__"
Private Const PRODUCT_IMAGE_BASE64_CELL As String = "A1"
Private Const PRODUCT_IMAGE_MAX_BYTES As Long = 1000000

Private Const CHECK_SHEET_NAME As String = "Check"

Private Const DOC_ROW_STEP As Long = 12
Private Const DOC_NAME_COL As String = "D"
Private Const DOC_SHORT_NAME_COL As String = "D"
Private Const DOC_SCORE_COL As String = "E"
Private Const DOC_NA_COL As String = "F"
Private Const DOC_DATE_COL As String = "J"

Sub Exportar_JSON_Audits()

    Dim ws As Worksheet

    On Error Resume Next
    Set ws = ThisWorkbook.Worksheets(CHECK_SHEET_NAME)
    On Error GoTo 0

    If ws Is Nothing Then
        MsgBox "A aba '" & CHECK_SHEET_NAME & "' não foi encontrada neste arquivo.", vbCritical
        Exit Sub
    End If

    Dim pastaDestino As String
    Dim caminhoArquivo As String

    pastaDestino = "C:\Users\M0242198\cauaferrari\site\"
    caminhoArquivo = pastaDestino & "audits.json"

    If Dir(pastaDestino, vbDirectory) = "" Then
        MkDir pastaDestino
    End If

    Dim projectName As String
    Dim completionDate As String
    Dim developmentEngineer As String
    Dim projectScore As Double
    Dim currentGate As String
    Dim nextGate As String
    Dim nextGateDate As String
    Dim productImageBase64 As String
    Dim naJustifications As String
    Dim importantDates As String
    Dim specialCharacteristics As String

    projectName = TextoCelula(ws.Range("C3"))
    completionDate = DataISOOuTexto(ws.Range("H4").Value2, ws.Range("H4").Text)
    developmentEngineer = TextoCelula(ws.Range("E3"))
    projectScore = NormalizarScoreProjeto(ws.Range("S9").Value2)
    currentGate = UCase(Trim(TextoCelula(ws.Range("E4"))))
    nextGate = ProximoGate(currentGate)
    nextGateDate = DataDoGateDia23(ws, nextGate)
    productImageBase64 = TextoCelula(ws.Range(PRODUCT_IMAGE_BASE64_CELL))


    naJustifications = TextoCelula(ws.Range("O9"))
    importantDates = TextoCelula(ws.Range("O10"))
    specialCharacteristics = TextoCelula(ws.Range("O11"))

    If projectName = "" Then
        MsgBox "Project name is required in cell C3.", vbCritical
        Exit Sub
    End If

    Dim projectId As String
    projectId = CriarID(projectName)

    

    Dim gates As Collection
    Set gates = GatesAuditaveis(currentGate)

    If gates.Count = 0 Then
        MsgBox "Actual gate not recognized: " & currentGate, vbCritical
        Exit Sub
    End If

    If TamanhoUtf8(productImageBase64) > PRODUCT_IMAGE_MAX_BYTES Then
        MsgBox "Product image base64 is too large." & vbCrLf & _
            "Cell: " & PRODUCT_IMAGE_BASE64_CELL & vbCrLf & _
            "Limit: " & PRODUCT_IMAGE_MAX_BYTES & " bytes", vbCritical
        Exit Sub
    End If

    Dim baseProjectJson As String
    baseProjectJson = MontarProjetoAuditJson( _
        ws, _
        gates, _
        projectId, _
        projectName, _
        LAST_UPDATE_TOKEN, _
        completionDate, _
        developmentEngineer, _
        projectScore, _
        currentGate, _
        nextGate, _
        nextGateDate, _
        productImageBase64, _
        naJustifications, _
        importantDates, _
        specialCharacteristics _
    )

    Dim existingJson As String
    existingJson = LerArquivoTexto(caminhoArquivo)

    Dim oldProjectJson As String
    oldProjectJson = EncontrarProjetoJson(existingJson, projectId)

    Dim oldLastUpdate As String
    oldLastUpdate = ExtrairStringJson(oldProjectJson, "lastUpdate")

    Dim finalLastUpdate As String

    If oldProjectJson = "" Then
        finalLastUpdate = IsoNowLocal()
    ElseIf NormalizarProjetoParaComparacao(oldProjectJson) = baseProjectJson Then
        finalLastUpdate = oldLastUpdate
    Else
        finalLastUpdate = IsoNowLocal()
    End If

    If finalLastUpdate = "" Then
        finalLastUpdate = IsoNowLocal()
    End If

    Dim projectJson As String
    projectJson = Replace(baseProjectJson, LAST_UPDATE_TOKEN, EscapeJSON(finalLastUpdate))

    Dim mergedProjects As String
    mergedProjects = AtualizarProjetoNoArray(existingJson, projectId, projectJson)

    Dim finalJson As String
    finalJson = "{""version"":""audit-v1""," & _
        """lastGlobalUpdate"":""" & EscapeJSON(IsoNowLocal()) & """," & _
        """projects"":[" & mergedProjects & "]}"

    EscreverArquivoTexto caminhoArquivo, finalJson

    MsgBox "Audits JSON exported successfully!" & vbCrLf & vbCrLf & caminhoArquivo, vbInformation

End Sub

Private Function MontarProjetoAuditJson( _
    ByVal ws As Worksheet, _
    ByVal gates As Collection, _
    ByVal projectId As String, _
    ByVal projectName As String, _
    ByVal lastUpdate As String, _
    ByVal completionDate As String, _
    ByVal developmentEngineer As String, _
    ByVal projectScore As Double, _
    ByVal currentGate As String, _
    ByVal nextGate As String, _
    ByVal nextGateDate As String, _
    ByVal productImageBase64 As String, _
    ByVal naJustifications As String, _
    ByVal importantDates As String, _
    ByVal specialCharacteristics As String _
) As String

    Dim json As String
    json = "{"

    json = json & """id"":""" & EscapeJSON(projectId) & ""","
    json = json & """projectName"":""" & EscapeJSON(projectName) & ""","
    json = json & """lastUpdate"":""" & EscapeJSON(lastUpdate) & ""","
    json = json & """completionDate"":" & JsonStringOrNull(completionDate) & ","
    json = json & """developmentEngineer"":{""name"":" & JsonStringOrNull(developmentEngineer) & "},"
    json = json & """projectScore"":" & JsonNumber(projectScore) & ","

    json = json & """gates"":{"
    json = json & """current"":" & JsonStringOrNull(currentGate) & ","
    json = json & """next"":" & JsonStringOrNull(nextGate) & ","
    json = json & """nextGateDate"":" & JsonStringOrNull(nextGateDate)
    json = json & "},"

    json = json & """productImage"":{"
    json = json & CampoImagem(productImageBase64, projectName)
    json = json & "},"

    json = json & """backlogProjectName"":null,"
    json = json & """dashboardName"":null,"
    json = json & """aliases"":[],"

    json = json & """importantInfo"":{"
    json = json & """naJustifications"":" & JsonNAJustifications(naJustifications) & ","
    json = json & """importantDates"":" & JsonImportantDates(importantDates) & ","
    json = json & """specialCharacteristics"":" & JsonSpecialCharacteristics(specialCharacteristics)
    json = json & "},"

    json = json & """documents"":["

    Dim gate As Variant
    Dim gateName As String
    Dim gateDocCount As Long
    Dim i As Long
    Dim docGlobalOrder As Long
    Dim docRow As Long
    Dim docName As String
    Dim docShortName As String
    Dim docScore As Variant
    Dim docStatus As Long

    docGlobalOrder = 1

    For Each gate In gates

        gateName = CStr(gate)
        gateDocCount = QuantidadeDocumentosGate(gateName)

        For i = 1 To gateDocCount

            docRow = LinhaDocumentoGate(gateName, i)

            docName = Trim(CStr(ws.Cells(docRow, DOC_NAME_COL).Value2))
            docShortName = Trim(CStr(ws.Cells(docRow, DOC_SHORT_NAME_COL).Value2))
            docScore = ws.Cells(docRow, DOC_SCORE_COL).Value2
            docStatus = CalcularStatusDocumento(ws, gateName, docRow)

            If docName = "" Then
                docName = gateName & " Document " & CStr(i)
            End If

            If docShortName = "" Then
                docShortName = docName
            End If

            json = json & "{"
            json = json & """id"":""" & EscapeJSON(CriarID(gateName & "-" & Format(i, "00") & "-" & docName)) & ""","
            json = json & """order"":" & CStr(docGlobalOrder) & ","
            json = json & """gate"":""" & EscapeJSON(gateName) & ""","
            json = json & """name"":""" & EscapeJSON(docName) & ""","
            json = json & """shortName"":""" & EscapeJSON(docShortName) & ""","
            json = json & """score"":" & JsonScoreDocumento(docScore, docStatus) & ","
            json = json & """status"":" & CStr(docStatus)
            json = json & "},"

            docGlobalOrder = docGlobalOrder + 1

        Next i

    Next gate

    json = RemoverUltimaVirgula(json)
    json = json & "]}"

    MontarProjetoAuditJson = json

End Function

Private Function CalcularStatusDocumento( _
    ByVal ws As Worksheet, _
    ByVal gateName As String, _
    ByVal docRow As Long _
) As Long

    If EhNA(ws.Cells(docRow, DOC_NA_COL).Value2) Then
        CalcularStatusDocumento = 4
        Exit Function
    End If

    Dim docDate As Date
    Dim gateDate As Date

    If Not TentarConverterData(ws.Cells(docRow, DOC_DATE_COL).Value2, docDate) Then
        CalcularStatusDocumento = 3
        Exit Function
    End If

    If Not TentarConverterData(DataDoGate(ws, gateName), gateDate) Then
        CalcularStatusDocumento = 3
        Exit Function
    End If

    docDate = SomenteData(docDate)
    gateDate = SomenteData(gateDate)

    If docDate < gateDate Then
        CalcularStatusDocumento = 1
    ElseIf docDate = gateDate Then
        CalcularStatusDocumento = 2
    Else
        CalcularStatusDocumento = 3
    End If

End Function

Private Function EhNA(ByVal value As Variant) As Boolean

    Dim texto As String
    texto = UCase(Trim(CStr(value)))

    EhNA = (texto = "N/A" Or texto = "NA")

End Function

Private Function DataDoGate(ByVal ws As Worksheet, ByVal gateName As String) As Variant

    Dim targetGate As String
    targetGate = UCase(Trim(gateName))

    Dim cell As Range

    For Each cell In ws.Range("C7:J7").Cells
        If UCase(Trim(CStr(cell.Value2))) = targetGate Then
            DataDoGate = ws.Cells(8, cell.Column).Value2
            Exit Function
        End If
    Next cell

    If UCase(Trim(CStr(ws.Range("O7").Value2))) = targetGate Then
        DataDoGate = ws.Range("O8").Value2
        Exit Function
    End If

    DataDoGate = Empty

End Function

Private Function LinhaDocumentoGate(ByVal gateName As String, ByVal docIndex As Long) As Long

    Dim startRow As Long
    startRow = PrimeiraLinhaGate(gateName)

    If startRow = 0 Then
        LinhaDocumentoGate = 0
    Else
        LinhaDocumentoGate = startRow + ((docIndex - 1) * DOC_ROW_STEP)
    End If

End Function

Private Function PrimeiraLinhaGate(ByVal gateName As String) As Long

    Select Case UCase(Trim(gateName))
        Case "MS0"
            PrimeiraLinhaGate = 16
        Case "MS1"
            PrimeiraLinhaGate = 112
        Case "QG2"
            PrimeiraLinhaGate = 268
        Case "QG3"
            PrimeiraLinhaGate = 376
        Case Else
            PrimeiraLinhaGate = 0
    End Select

End Function

Private Function GatesAuditaveis(ByVal currentGate As String) As Collection

    Dim gates As New Collection

    Select Case UCase(Trim(currentGate))
        Case "MS0"
            gates.Add "MS0"

        Case "QG1"
            gates.Add "MS0"

        Case "MS1"
            gates.Add "MS0"
            gates.Add "MS1"

        Case "QG2"
            gates.Add "MS0"
            gates.Add "MS1"
            gates.Add "QG2"

        Case "MS2"
            gates.Add "MS0"
            gates.Add "MS1"
            gates.Add "QG2"

        Case "QG3"
            gates.Add "MS0"
            gates.Add "MS1"
            gates.Add "QG2"
            gates.Add "QG3"
    End Select

    Set GatesAuditaveis = gates

End Function

Private Function ProximoGate(ByVal currentGate As String) As String

    Select Case UCase(Trim(currentGate))
        Case "MS0"
            ProximoGate = "QG1"
        Case "QG1"
            ProximoGate = "MS1"
        Case "MS1"
            ProximoGate = "QG2"
        Case "QG2"
            ProximoGate = "MS2"
        Case "MS2"
            ProximoGate = "QG3"
        Case Else
            ProximoGate = "QG4"
    End Select

End Function

Private Function QuantidadeDocumentosGate(ByVal gateName As String) As Long

    Select Case UCase(Trim(gateName))
        Case "MS0"
            QuantidadeDocumentosGate = 8
        Case "MS1"
            QuantidadeDocumentosGate = 13
        Case "QG2"
            QuantidadeDocumentosGate = 9
        Case "QG3"
            QuantidadeDocumentosGate = 2
        Case Else
            QuantidadeDocumentosGate = 0
    End Select

End Function

Private Function JsonNAJustifications(ByVal texto As String) As String

    texto = NormalizarQuebrasLinha(texto)

    If Trim(texto) = "" Then
        JsonNAJustifications = "[]"
        Exit Function
    End If

    Dim linhas() As String
    linhas = Split(texto, vbLf)

    Dim json As String
    Dim i As Long
    Dim linha As String
    Dim gate As String
    Dim documentName As String
    Dim justification As String

    json = "["

    For i = LBound(linhas) To UBound(linhas)

        linha = Trim(linhas(i))

        If linha <> "" Then

            gate = ValorCampoBloco(linha, "gate")
            documentName = ValorCampoBloco(linha, "document")
            justification = ValorCampoBloco(linha, "justification")

            If gate = "" And documentName = "" And justification = "" Then
                justification = linha
            End If

            If Trim(justification) = "" Then
                justification = "No justification provided"
            End If

            json = json & "{"
            json = json & """gate"":" & JsonStringOrNull(gate) & ","
            json = json & """documentName"":" & JsonStringOrNull(documentName) & ","
            json = json & """justification"":" & JsonStringOrNull(justification)
            json = json & "},"

        End If

    Next i

    json = RemoverUltimaVirgula(json)
    json = json & "]"

    JsonNAJustifications = json

End Function
Private Function JsonImportantDates(ByVal texto As String) As String

    texto = NormalizarQuebrasLinha(texto)

    If Trim(texto) = "" Then
        JsonImportantDates = "[]"
        Exit Function
    End If

    Dim linhas() As String
    linhas = Split(texto, vbLf)

    Dim json As String
    Dim i As Long
    Dim linha As String
    Dim gate As String
    Dim dateValue As String

    json = "["

    For i = LBound(linhas) To UBound(linhas)

        linha = Trim(linhas(i))

        If linha <> "" Then

            gate = ValorCampoBloco(linha, "gate")
            dateValue = ValorCampoBloco(linha, "date")

            If gate = "" And dateValue = "" Then
                dateValue = linha
            End If

            If Trim(dateValue) <> "" Then
                json = json & "{"
                json = json & """gate"":" & JsonStringOrNull(gate) & ","
                json = json & """date"":" & JsonStringOrNull(dateValue)
                json = json & "},"
            End If

        End If

    Next i

    json = RemoverUltimaVirgula(json)
    json = json & "]"

    JsonImportantDates = json

End Function

Private Function JsonSpecialCharacteristics(ByVal texto As String) As String

    texto = NormalizarQuebrasLinha(texto)

    If Trim(texto) = "" Then
        JsonSpecialCharacteristics = "[]"
        Exit Function
    End If

    Dim linhas() As String
    linhas = Split(texto, vbLf)

    Dim json As String
    Dim i As Long
    Dim linha As String
    Dim characteristic As String

    json = "["

    For i = LBound(linhas) To UBound(linhas)

        linha = Trim(linhas(i))

        If linha <> "" Then

            characteristic = ValorCampoBloco(linha, "characteristic")

            If characteristic = "" Then
                characteristic = linha
            End If

            json = json & """" & EscapeJSON(characteristic) & ""","

        End If

    Next i

    json = RemoverUltimaVirgula(json)
    json = json & "]"

    JsonSpecialCharacteristics = json

End Function

Private Function ValorCampoBloco(ByVal bloco As String, ByVal campo As String) As String

    Dim partes() As String
    partes = Split(bloco, "|")

    Dim i As Long
    Dim parte As String
    Dim p As Long
    Dim chave As String
    Dim valor As String

    For i = LBound(partes) To UBound(partes)

        parte = Trim(partes(i))
        p = InStr(1, parte, "=", vbTextCompare)

        If p > 0 Then
            chave = LCase(Trim(Left(parte, p - 1)))
            valor = Trim(Mid(parte, p + 1))

            If chave = LCase(Trim(campo)) Then
                ValorCampoBloco = valor
                Exit Function
            End If
        End If

    Next i

    ValorCampoBloco = ""

End Function

Private Function NormalizarQuebrasLinha(ByVal texto As String) As String

    texto = Replace(texto, vbCrLf, vbLf)
    texto = Replace(texto, vbCr, vbLf)

    NormalizarQuebrasLinha = texto

End Function

Private Function AtualizarProjetoNoArray( _
    ByVal existingJson As String, _
    ByVal projectId As String, _
    ByVal projectJson As String _
) As String

    Dim projectsBody As String
    projectsBody = ExtrairProjectsBody(existingJson)

    Dim objects As Collection
    Set objects = SplitTopLevelObjects(projectsBody)

    Dim output As String
    Dim replaced As Boolean
    Dim obj As Variant

    output = ""
    replaced = False

    For Each obj In objects

        If CriarID(ExtrairStringJson(CStr(obj), "id")) = projectId Then
            output = output & projectJson & ","
            replaced = True
        Else
            output = output & CStr(obj) & ","
        End If

    Next obj

    If replaced = False Then
        output = output & projectJson & ","
    End If

    AtualizarProjetoNoArray = RemoverUltimaVirgula(output)

End Function

Private Function EncontrarProjetoJson(ByVal existingJson As String, ByVal projectId As String) As String

    Dim projectsBody As String
    projectsBody = ExtrairProjectsBody(existingJson)

    Dim objects As Collection
    Set objects = SplitTopLevelObjects(projectsBody)

    Dim obj As Variant

    For Each obj In objects
        If CriarID(ExtrairStringJson(CStr(obj), "id")) = projectId Then
            EncontrarProjetoJson = CStr(obj)
            Exit Function
        End If
    Next obj

    EncontrarProjetoJson = ""

End Function

Private Function NormalizarProjetoParaComparacao(ByVal projectJson As String) As String
    NormalizarProjetoParaComparacao = SubstituirCampoStringJson(projectJson, "lastUpdate", LAST_UPDATE_TOKEN)
End Function

Private Function SubstituirCampoStringJson( _
    ByVal json As String, _
    ByVal propName As String, _
    ByVal newValue As String _
) As String

    Dim key As String
    key = """" & propName & """:"""

    Dim p As Long
    p = InStr(1, json, key, vbTextCompare)

    If p = 0 Then
        SubstituirCampoStringJson = json
        Exit Function
    End If

    Dim valueStart As Long
    valueStart = p + Len(key)

    Dim i As Long
    Dim escaped As Boolean
    Dim ch As String

    For i = valueStart To Len(json)

        ch = Mid(json, i, 1)

        If escaped Then
            escaped = False
        ElseIf ch = "\" Then
            escaped = True
        ElseIf ch = """" Then
            SubstituirCampoStringJson = Left(json, valueStart - 1) & _
                EscapeJSON(newValue) & _
                Mid(json, i)
            Exit Function
        End If

    Next i

    SubstituirCampoStringJson = json

End Function

Private Function ExtrairProjectsBody(ByVal json As String) As String

    Dim keyPos As Long
    keyPos = InStr(1, json, """projects""", vbTextCompare)

    If keyPos = 0 Then
        ExtrairProjectsBody = ""
        Exit Function
    End If

    Dim startPos As Long
    startPos = InStr(keyPos, json, "[")

    If startPos = 0 Then
        ExtrairProjectsBody = ""
        Exit Function
    End If

    Dim i As Long
    Dim depth As Long
    Dim inString As Boolean
    Dim escaped As Boolean
    Dim ch As String

    For i = startPos To Len(json)

        ch = Mid(json, i, 1)

        If inString Then
            If escaped Then
                escaped = False
            ElseIf ch = "\" Then
                escaped = True
            ElseIf ch = """" Then
                inString = False
            End If
        Else
            If ch = """" Then
                inString = True
            ElseIf ch = "[" Then
                depth = depth + 1
            ElseIf ch = "]" Then
                depth = depth - 1

                If depth = 0 Then
                    ExtrairProjectsBody = Mid(json, startPos + 1, i - startPos - 1)
                    Exit Function
                End If
            End If
        End If

    Next i

    ExtrairProjectsBody = ""

End Function

Private Function SplitTopLevelObjects(ByVal body As String) As Collection

    Dim result As New Collection
    Dim i As Long
    Dim depth As Long
    Dim startPos As Long
    Dim inString As Boolean
    Dim escaped As Boolean
    Dim ch As String

    startPos = 0

    For i = 1 To Len(body)

        ch = Mid(body, i, 1)

        If inString Then
            If escaped Then
                escaped = False
            ElseIf ch = "\" Then
                escaped = True
            ElseIf ch = """" Then
                inString = False
            End If
        Else
            If ch = """" Then
                inString = True
            ElseIf ch = "{" Then
                If depth = 0 Then startPos = i
                depth = depth + 1
            ElseIf ch = "}" Then
                depth = depth - 1

                If depth = 0 And startPos > 0 Then
                    result.Add Mid(body, startPos, i - startPos + 1)
                    startPos = 0
                End If
            End If
        End If

    Next i

    Set SplitTopLevelObjects = result

End Function

Private Function ExtrairStringJson( _
    ByVal json As String, _
    ByVal propName As String _
) As String

    Dim key As String
    key = """" & propName & """:"""

    Dim p As Long
    p = InStr(1, json, key, vbTextCompare)

    If p = 0 Then
        ExtrairStringJson = ""
        Exit Function
    End If

    p = p + Len(key)

    Dim i As Long
    Dim escaped As Boolean
    Dim output As String
    Dim ch As String

    output = ""

    For i = p To Len(json)

        ch = Mid(json, i, 1)

        If escaped Then
            output = output & ch
            escaped = False
        ElseIf ch = "\" Then
            escaped = True
        ElseIf ch = """" Then
            Exit For
        Else
            output = output & ch
        End If

    Next i

    ExtrairStringJson = output

End Function

Private Function CampoImagem(ByVal base64Text As String, ByVal projectName As String) As String

    base64Text = Trim(base64Text)

    If base64Text = "" Then
        CampoImagem = ""
        Exit Function
    End If

    If InStr(1, base64Text, "data:image/", vbTextCompare) = 1 Then
        CampoImagem = """dataUrl"":""" & EscapeJSON(base64Text) & """," & _
            """alt"":""" & EscapeJSON(projectName & " product image") & """"
    Else
        CampoImagem = """dataUrl"":""data:image/jpeg;base64," & EscapeJSON(base64Text) & """," & _
            """alt"":""" & EscapeJSON(projectName & " product image") & """"
    End If

End Function

Private Function TamanhoUtf8(ByVal texto As String) As Long

    Dim stream As Object
    Set stream = CreateObject("ADODB.Stream")

    stream.Type = 2
    stream.Charset = "utf-8"
    stream.Open
    stream.WriteText texto
    stream.Position = 0
    stream.Type = 1
    TamanhoUtf8 = stream.Size
    stream.Close

End Function

Private Function JsonScoreDocumento(ByVal value As Variant, ByVal status As Long) As String

    If status = 4 Then
        JsonScoreDocumento = "null"
        Exit Function
    End If

    JsonScoreDocumento = JsonNumber(NormalizarNotaDocumento(value))

End Function

Private Function JsonNumber(ByVal value As Double) As String
    JsonNumber = Replace(CStr(value), ",", ".")
End Function

Private Function JsonStringOrNull(ByVal value As String) As String

    value = Trim(value)

    If value = "" Then
        JsonStringOrNull = "null"
    Else
        JsonStringOrNull = """" & EscapeJSON(value) & """"
    End If

End Function

Private Function NormalizarScoreProjeto(ByVal value As Variant) As Double

    If IsNumeric(value) Then
        NormalizarScoreProjeto = CDbl(value)
    Else
        NormalizarScoreProjeto = 0
    End If

    If NormalizarScoreProjeto > 1 Then
        NormalizarScoreProjeto = NormalizarScoreProjeto / 100
    End If

    If NormalizarScoreProjeto < 0 Then NormalizarScoreProjeto = 0
    If NormalizarScoreProjeto > 1 Then NormalizarScoreProjeto = 1

End Function

Private Function NormalizarNotaDocumento(ByVal value As Variant) As Double

    If IsNumeric(value) Then
        NormalizarNotaDocumento = CDbl(value)
    Else
        NormalizarNotaDocumento = 0
    End If

    If NormalizarNotaDocumento > 1 Then
        NormalizarNotaDocumento = NormalizarNotaDocumento / 10
    End If

    If NormalizarNotaDocumento < 0 Then NormalizarNotaDocumento = 0
    If NormalizarNotaDocumento > 1 Then NormalizarNotaDocumento = 1

End Function

Private Function DataISOOuTexto(ByVal valor As Variant, ByVal fallbackText As String) As String

    Dim dataConvertida As Date

    If TentarConverterData(valor, dataConvertida) Then
        DataISOOuTexto = Format(dataConvertida, "yyyy-mm-dd")
    Else
        If IsError(valor) Then
            DataISOOuTexto = Trim(fallbackText)
        ElseIf Trim(CStr(valor)) <> "" Then
            DataISOOuTexto = Trim(CStr(valor))
        Else
            DataISOOuTexto = Trim(fallbackText)
        End If
    End If

End Function

Private Function TentarConverterData(ByVal value As Variant, ByRef outputDate As Date) As Boolean

    On Error GoTo Falhou

    If IsError(value) Then GoTo Falhou
    If IsEmpty(value) Then GoTo Falhou
    If Trim(CStr(value)) = "" Then GoTo Falhou

    If IsDate(value) Then
        outputDate = CDate(value)
        TentarConverterData = True
        Exit Function
    End If

    If IsNumeric(value) Then
        outputDate = CDate(CDbl(value))
        TentarConverterData = True
        Exit Function
    End If

Falhou:
    TentarConverterData = False

End Function

Private Function SomenteData(ByVal value As Date) As Date
    SomenteData = DateSerial(Year(value), Month(value), Day(value))
End Function

Private Function IsoNowLocal() As String
    IsoNowLocal = Format(Now, "yyyy-mm-dd\Thh:nn:ss") & "-03:00"
End Function

Private Function LerArquivoTexto(ByVal caminho As String) As String

    If Dir(caminho) = "" Then
        LerArquivoTexto = ""
        Exit Function
    End If

    Dim stream As Object
    Set stream = CreateObject("ADODB.Stream")

    stream.Type = 2
    stream.Charset = "utf-8"
    stream.Open
    stream.LoadFromFile caminho
    LerArquivoTexto = stream.ReadText
    stream.Close

End Function

Private Sub EscreverArquivoTexto(ByVal caminho As String, ByVal texto As String)

    Dim textStream As Object
    Dim binaryStream As Object

    Set textStream = CreateObject("ADODB.Stream")
    Set binaryStream = CreateObject("ADODB.Stream")

    textStream.Type = 2
    textStream.Charset = "utf-8"
    textStream.Open
    textStream.WriteText texto
    textStream.Position = 3

    binaryStream.Type = 1
    binaryStream.Open
    textStream.CopyTo binaryStream
    binaryStream.SaveToFile caminho, 2

    binaryStream.Close
    textStream.Close

End Sub

Private Function TextoCelula(ByVal cell As Range) As String

    If IsError(cell.Value2) Then
        TextoCelula = ""
    Else
        TextoCelula = Trim(CStr(cell.Value2))
    End If

End Function

Private Function RemoverUltimaVirgula(ByVal texto As String) As String

    If Right(texto, 1) = "," Then
        texto = Left(texto, Len(texto) - 1)
    End If

    RemoverUltimaVirgula = texto

End Function

Private Function EscapeJSON(ByVal texto As String) As String

    texto = Replace(texto, "\", "\\")
    texto = Replace(texto, """", "\""")
    texto = Replace(texto, vbCrLf, " ")
    texto = Replace(texto, vbCr, " ")
    texto = Replace(texto, vbLf, " ")
    texto = Replace(texto, vbTab, " ")

    EscapeJSON = texto

End Function

Private Function CriarID(ByVal nome As String) As String

    nome = LCase(Trim(RemoverAcentos(nome)))

    Dim re As Object
    Set re = CreateObject("VBScript.RegExp")

    re.Global = True
    re.Pattern = "[^a-z0-9]+"
    nome = re.Replace(nome, "-")

    re.Pattern = "-+"
    nome = re.Replace(nome, "-")

    re.Pattern = "^-+|-+$"
    nome = re.Replace(nome, "")

    CriarID = nome

End Function

Private Function RemoverAcentos(ByVal texto As String) As String

    texto = Replace(texto, "á", "a")
    texto = Replace(texto, "à", "a")
    texto = Replace(texto, "ã", "a")
    texto = Replace(texto, "â", "a")
    texto = Replace(texto, "ä", "a")
    texto = Replace(texto, "Á", "A")
    texto = Replace(texto, "À", "A")
    texto = Replace(texto, "Ã", "A")
    texto = Replace(texto, "Â", "A")
    texto = Replace(texto, "Ä", "A")

    texto = Replace(texto, "é", "e")
    texto = Replace(texto, "è", "e")
    texto = Replace(texto, "ê", "e")
    texto = Replace(texto, "ë", "e")
    texto = Replace(texto, "É", "E")
    texto = Replace(texto, "È", "E")
    texto = Replace(texto, "Ê", "E")
    texto = Replace(texto, "Ë", "E")

    texto = Replace(texto, "í", "i")
    texto = Replace(texto, "ì", "i")
    texto = Replace(texto, "î", "i")
    texto = Replace(texto, "ï", "i")
    texto = Replace(texto, "Í", "I")
    texto = Replace(texto, "Ì", "I")
    texto = Replace(texto, "Î", "I")
    texto = Replace(texto, "Ï", "I")

    texto = Replace(texto, "ó", "o")
    texto = Replace(texto, "ò", "o")
    texto = Replace(texto, "õ", "o")
    texto = Replace(texto, "ô", "o")
    texto = Replace(texto, "ö", "o")
    texto = Replace(texto, "Ó", "O")
    texto = Replace(texto, "Ò", "O")
    texto = Replace(texto, "Õ", "O")
    texto = Replace(texto, "Ô", "O")
    texto = Replace(texto, "Ö", "O")

    texto = Replace(texto, "ú", "u")
    texto = Replace(texto, "ù", "u")
    texto = Replace(texto, "û", "u")
    texto = Replace(texto, "ü", "u")
    texto = Replace(texto, "Ú", "U")
    texto = Replace(texto, "Ù", "U")
    texto = Replace(texto, "Û", "U")
    texto = Replace(texto, "Ü", "U")

    texto = Replace(texto, "ç", "c")
    texto = Replace(texto, "Ç", "C")

    RemoverAcentos = texto

End Function

Private Function DataDoGateDia23(ByVal ws As Worksheet, ByVal gateName As String) As String

    Dim gateDateValue As Variant
    gateDateValue = DataDoGate(ws, gateName)

    Dim gateDate As Date

    If TentarConverterData(gateDateValue, gateDate) Then
        DataDoGateDia23 = Format(DateSerial(Year(gateDate), Month(gateDate), 23), "yyyy-mm-dd")
    Else
        DataDoGateDia23 = ""
    End If

End Function
