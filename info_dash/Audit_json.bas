Attribute VB_Name = "Audit_json"
Option Explicit

Private Const LAST_UPDATE_TOKEN As String = "__LAST_UPDATE__"

Sub Exportar_JSON_Audits()

    Dim ws As Worksheet
    Set ws = ActiveSheet

    Dim pastaDestino As String
    Dim caminhoArquivo As String

    pastaDestino = "C:\PC\sitemahle\"
    caminhoArquivo = pastaDestino & "audits.json"

    If Dir(pastaDestino, vbDirectory) = "" Then
        MkDir pastaDestino
    End If

    Dim row As Long
    row = 1

    Dim projectName As String
    Dim completionDate As String
    Dim developmentEngineer As String
    Dim projectScore As Double
    Dim currentGate As String
    Dim nextGate As String
    Dim nextGateDate As String
    Dim productImagePath As String
    Dim naJustifications As String
    Dim importantDates As String
    Dim specialCharacteristics As String

    projectName = Trim(ws.Cells(row, "A").Text): row = row + 1
    completionDate = Trim(ws.Cells(row, "A").Text): row = row + 1
    developmentEngineer = Trim(ws.Cells(row, "A").Text): row = row + 1
    projectScore = NormalizarScoreProjeto(ws.Cells(row, "A").Value): row = row + 1
    currentGate = UCase(Trim(ws.Cells(row, "A").Text)): row = row + 1
    nextGateDate = Trim(ws.Cells(row, "A").Text): row = row + 1
    productImagePath = Trim(ws.Cells(row, "A").Text): row = row + 1
    naJustifications = Trim(ws.Cells(row, "A").Text): row = row + 1
    importantDates = Trim(ws.Cells(row, "A").Text): row = row + 1
    specialCharacteristics = Trim(ws.Cells(row, "A").Text): row = row + 1

    If projectName = "" Then
        MsgBox "Project name is required in column A.", vbCritical
        Exit Sub
    End If

    Dim projectId As String
    projectId = CriarID(projectName)
    nextGate = ProximoGate(currentGate)

    Dim gates As Collection
    Set gates = GatesAuditaveis(currentGate)

    If gates.Count = 0 Then
        MsgBox "Actual gate not recognized: " & currentGate, vbCritical
        Exit Sub
    End If

    Dim baseProjectJson As String
    baseProjectJson = MontarProjetoAuditJson( _
        ws, _
        row, _
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
        productImagePath, _
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
    ByVal firstDocRow As Long, _
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
    ByVal productImagePath As String, _
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
    json = json & CampoImagem(productImagePath) & ","
    json = json & """alt"":""" & EscapeJSON(projectName & " product image") & """"
    json = json & "},"
    json = json & """backlogProjectName"":null,"
    json = json & """dashboardName"":null,"
    json = json & """aliases"":[],"
    json = json & """importantInfo"":{"
    json = json & """naJustifications"":" & JsonStringOrNull(naJustifications) & ","
    json = json & """importantDates"":" & JsonStringOrNull(importantDates) & ","
    json = json & """specialCharacteristics"":" & JsonStringOrNull(specialCharacteristics)
    json = json & "},"
    json = json & """documents"":["

    Dim r As Long
    r = firstDocRow

    Dim gate As Variant
    Dim gateName As String
    Dim gateDocCount As Long
    Dim i As Long
    Dim docGlobalOrder As Long
    Dim docName As String
    Dim docShortName As String
    Dim docScore As Variant
    Dim docStatus As Long

    docGlobalOrder = 1

    For Each gate In gates

        gateName = CStr(gate)
        gateDocCount = QuantidadeDocumentosGate(gateName)

        For i = 1 To gateDocCount

            docName = Trim(ws.Cells(r, "A").Text): r = r + 1
            docShortName = Trim(ws.Cells(r, "A").Text): r = r + 1
            docScore = ws.Cells(r, "A").Value: r = r + 1

            If IsNumeric(ws.Cells(r, "A").Value) Then
                docStatus = CLng(ws.Cells(r, "A").Value)
            Else
                docStatus = 4
            End If
            r = r + 1

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
            ProximoGate = ""
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

    For i = valueStart To Len(json)

        Dim ch As String
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

    For i = startPos To Len(json)

        Dim ch As String
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

    startPos = 0

    For i = 1 To Len(body)

        Dim ch As String
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
    output = ""

    For i = p To Len(json)

        Dim ch As String
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

Private Function CampoImagem(ByVal path As String) As String

    If path = "" Then
        CampoImagem = """src"":null"
        Exit Function
    End If

    If InStr(1, path, "http://", vbTextCompare) = 1 Or _
       InStr(1, path, "https://", vbTextCompare) = 1 Then
        CampoImagem = """url"":""" & EscapeJSON(path) & """"
    Else
        CampoImagem = """assetPath"":""" & EscapeJSON(path) & """"
    End If

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

Private Function IsoNowLocal() As String
    IsoNowLocal = Format(Now, "yyyy-mm-dd\Thh:nn:ss") & "-03:00"
End Function

Private Function LerArquivoTexto(ByVal caminho As String) As String

    If Dir(caminho) = "" Then
        LerArquivoTexto = ""
        Exit Function
    End If

    Dim fileNum As Integer
    fileNum = FreeFile

    Open caminho For Binary As #fileNum
    LerArquivoTexto = Space(LOF(fileNum))
    Get #fileNum, , LerArquivoTexto
    Close #fileNum

End Function

Private Sub EscreverArquivoTexto(ByVal caminho As String, ByVal texto As String)

    Dim fileNum As Integer
    fileNum = FreeFile

    Open caminho For Output As #fileNum
    Print #fileNum, texto
    Close #fileNum

End Sub

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

    nome = LCase(Trim(nome))

    nome = Replace(nome, " ", "-")
    nome = Replace(nome, "/", "-")
    nome = Replace(nome, "\", "-")
    nome = Replace(nome, "_", "-")
    nome = Replace(nome, ".", "")
    nome = Replace(nome, "(", "")
    nome = Replace(nome, ")", "")
    nome = Replace(nome, "{", "")
    nome = Replace(nome, "}", "")
    nome = Replace(nome, "[", "")
    nome = Replace(nome, "]", "")
    nome = Replace(nome, "&", "e")
    nome = Replace(nome, ",", "")

    Do While InStr(nome, "--") > 0
        nome = Replace(nome, "--", "-")
    Loop

    CriarID = nome

End Function
