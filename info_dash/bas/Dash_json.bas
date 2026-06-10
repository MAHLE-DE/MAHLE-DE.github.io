Attribute VB_Name = "Dash_json"
Option Explicit

Sub Exportar_JSON_Dashboard()

    Dim ws As Worksheet
    Set ws = ActiveSheet

    Dim ultimaLinha As Long
    ultimaLinha = ws.Cells(ws.Rows.Count, "CF").End(xlUp).Row

    Dim json As String
    Dim linha As Long

    Dim nomeProjeto As String
    Dim nomeGrafico As String
    Dim gate As String

    Dim score As Double
    Dim target As Double

    Dim anoAtual As String
    Dim averageAtual As Double

    Dim erros As String
    erros = ""

    Dim ordem As Long
    ordem = 1

    Dim iniciouAno As Boolean
    iniciouAno = False

    Dim pastaDestino As String
    Dim caminhoArquivo As String

    pastaDestino = "C:\PC\sitemahle\"
    caminhoArquivo = pastaDestino & "dashboard.json"

    '==========================
    ' CRIA PASTA
    '==========================

    If Dir(pastaDestino, vbDirectory) = "" Then
        MkDir pastaDestino
    End If

    json = "{""anos"":{"

    '==========================
    ' LOOP PRINCIPAL
    '==========================

    For linha = 2 To ultimaLinha

        ' Nome completo do projeto
        nomeProjeto = _
            Trim(ws.Cells(linha, "CF").Text)

        If nomeProjeto = "" Then
            GoTo ProximaLinha
        End If

        '==========================
        ' SCORE / TARGET
        '==========================

        If IsNumeric(ws.Cells(linha, "CG").Value) Then
            score = CDbl(ws.Cells(linha, "CG").Value)
        Else
            score = 0
        End If

        If IsNumeric(ws.Cells(linha, "CH").Value) Then
            target = CDbl(ws.Cells(linha, "CH").Value)
        Else
            target = 0
        End If

        '==========================
        ' AVERAGE (FECHA O ANO)
        '==========================

        If InStr(1, nomeProjeto, _
            "Average - ", _
            vbTextCompare) > 0 Then

            averageAtual = score

            json = RemoverUltimaVirgula(json)

            json = json & _
                "]," & _
                """average"":" & _
                Replace(CStr(averageAtual), ",", ".") & _
                "},"

            iniciouAno = False

            GoTo ProximaLinha
        End If

        '==========================
        ' DADOS DO PROJETO
        '==========================

        nomeGrafico = _
            Trim(ws.Cells(linha, "CE").Text)

        gate = _
            Trim(ws.Cells(linha, "CN").Text)

        '==========================
        ' VALIDA NOME GR?FICO
        '==========================

        If nomeGrafico = "" Then

            erros = erros & _
                "Linha " & linha & _
                " ? " & nomeProjeto & _
                vbCrLf

            GoTo ProximaLinha
        End If

        '==========================
        ' IN?CIO DE NOVO ANO
        '==========================

        If iniciouAno = False Then

            anoAtual = _
                DescobrirAno(ws, linha)

            json = json & _
                """" & anoAtual & """:{" & _
                """target"":" & _
                Replace(CStr(target), ",", ".") & "," & _
                """projetos"":["

            iniciouAno = True
        End If

        '==========================
        ' MONTA PROJETO
        '==========================

        json = json & "{"

        json = json & _
            """ordem"":" & ordem & "," & _
            """id"":""" & _
            CriarID(nomeProjeto) & """," & _
            """nome"":""" & _
            EscapeJSON(nomeProjeto) & """," & _
            """nomeGrafico"":""" & _
            EscapeJSON(nomeGrafico) & """," & _
            """score"":" & _
            Replace(CStr(score), ",", ".") & "," & _
            """gate"":""" & _
            EscapeJSON(gate) & """"

        json = json & "},"

        ordem = ordem + 1

ProximaLinha:
    Next linha

    json = RemoverUltimaVirgula(json)

    json = json & "}}"

    '==========================
    ' ERROS
    '==========================

    If erros <> "" Then

        MsgBox _
            "ERRO DE EXPORTA??O" & _
            vbCrLf & vbCrLf & _
            "Projetos sem nome resumido na coluna CE:" & _
            vbCrLf & vbCrLf & _
            erros, _
            vbCritical

        Exit Sub
    End If

    '==========================
    ' SALVAR JSON
    '==========================

    Dim fileNum As Integer
    fileNum = FreeFile

    Open caminhoArquivo _
    For Output As #fileNum

    Print #fileNum, json

    Close #fileNum

    MsgBox _
        "Dashboard exportado com sucesso!" & _
        vbCrLf & vbCrLf & _
        caminhoArquivo, _
        vbInformation

End Sub


Function DescobrirAno( _
    ByVal ws As Worksheet, _
    ByVal linhaAtual As Long _
) As String

    Dim i As Long
    Dim texto As String

    For i = linhaAtual To ws.Rows.Count

        texto = ws.Cells(i, "CF").Text

        If InStr(1, texto, _
            "Average - ", _
            vbTextCompare) > 0 Then

            DescobrirAno = _
                Trim(Replace( _
                texto, _
                "Average - ", _
                ""))

            Exit Function

        End If

    Next i

    DescobrirAno = _
        "Ano_Desconhecido"

End Function


Function RemoverUltimaVirgula( _
    ByVal texto As String _
) As String

    If Right(texto, 1) = "," Then

        texto = Left( _
            texto, _
            Len(texto) - 1)

    End If

    RemoverUltimaVirgula = texto

End Function


Function EscapeJSON( _
    ByVal texto As String _
) As String

    texto = Replace(texto, "\", "\\")
    texto = Replace(texto, """", "\""")
    texto = Replace(texto, vbCrLf, " ")
    texto = Replace(texto, vbLf, " ")

    EscapeJSON = texto

End Function


Function CriarID( _
    ByVal nome As String _
) As String

    nome = LCase(nome)

    nome = Replace(nome, " ", "-")
    nome = Replace(nome, "/", "-")
    nome = Replace(nome, "\", "-")
    nome = Replace(nome, "_", "-")
    nome = Replace(nome, ".", "")
    nome = Replace(nome, "(", "")
    nome = Replace(nome, ")", "")
    nome = Replace(nome, "&", "e")
    nome = Replace(nome, ",", "")

    Do While InStr(nome, "--") > 0
        nome = Replace(nome, "--", "-")
    Loop

    CriarID = nome

End Function
