/* ==========================
   KPI CHART
========================== */
let deOverviewChart = null;
let kpiAuditScoresRequested = false;

function calcularMediaProjeto(info, nomeProjeto) {
  if (typeof obterAuditScoreBacklog !== "function") {
    return null;
  }

  const auditScore = obterAuditScoreBacklog(nomeProjeto);
  return Number.isFinite(auditScore) ? auditScore * 10 : null;
}

function normalizarQuantidadeProjetos(valores) {
  if (!valores.length) return [];

  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);

  // caso especial: sÃ³ 1 DE (ou todos com mesma quantidade)
  if (minimo === maximo) {
    return valores.map(() => 48);
  }

  return valores.map(valor => {
    return 18 + ((valor - minimo) / (maximo - minimo)) * 54;
  });
}

function gerarGraficoDEs() {
  const canvas = document.getElementById("deOverviewChart");
  if (!canvas) return;

  if (
    !kpiAuditScoresRequested &&
    typeof carregarBacklogAuditScores === "function"
  ) {
    kpiAuditScoresRequested = true;
    carregarBacklogAuditScores().then(() => {
      const kpiSection = document.getElementById("kpis-section");
      if (kpiSection && kpiSection.classList.contains("active-section")) {
        gerarGraficoDEs();
      }
    });
  }

  // monta estatÃ­sticas por DE
  let stats = Object.entries(dados)
    .map(([de, info]) => {
      const projetos = Object.entries(info.projetos || {});
      if (!projetos.length) return null;

      const mediasProjetos = projetos
        .map(([nomeProjeto, projetoInfo]) =>
          calcularMediaProjeto(projetoInfo, nomeProjeto)
        )
        .filter(media => Number.isFinite(media));

      const mediaDE = mediasProjetos.length
        ? mediasProjetos.reduce((a, b) => a + b, 0) / mediasProjetos.length
        : 0;

      return {
        de,
        scoring: Math.round(mediaDE * 10), // 0â€“100
        amount: projetos.length
      };
    })
    .filter(Boolean);

  // remove DE sem projeto (regra que vocÃª pediu)
  stats = stats.filter(item => item.amount > 0);

  // ordenaÃ§Ã£o: maior scoring Ã  esquerda, depois decrescente
  // se empatar, maior quantidade primeiro
  stats.sort((a, b) => {
    if (b.scoring !== a.scoring) return b.scoring - a.scoring;
    if (b.amount !== a.amount) return b.amount - a.amount;
    return a.de.localeCompare(b.de, "pt-BR");
  });

  const labels = stats.map(item => item.de);
  const scoringData = stats.map(item => item.scoring);
  const amountReal = stats.map(item => item.amount);
  const amountVisual = normalizarQuantidadeProjetos(amountReal);
  const chartWrap = canvas.parentElement;
  const chartWidth = Math.max(chartWrap?.clientWidth || 0, labels.length * 70, 540);
  canvas.style.setProperty("--de-overview-width", `${chartWidth}px`);

  if (deOverviewChart) {
    deOverviewChart.destroy();
  }

  deOverviewChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          type: "bar",
          label: "Scoring",
          data: scoringData,
          backgroundColor: "#0a57b5",
          borderRadius: 0,
          barPercentage: 0.62,
          categoryPercentage: 0.72,
          order: 1,
          datalabels: {
            color: "#10233f",
            anchor: "end",
            align: context => {
              const idx = context.dataIndex;
              const score = Number(context.dataset.data[idx] || 0);
              const amount = Number(amountVisual[idx] || 0);
              return score < 8 || Math.abs(score - amount) < 12 ? "top" : "end";
            },
            offset: context => {
              const idx = context.dataIndex;
              const score = Number(context.dataset.data[idx] || 0);
              const amount = Number(amountVisual[idx] || 0);
              return score < 8 || Math.abs(score - amount) < 12 ? 18 : 7;
            },
            backgroundColor: "rgba(255, 255, 255, 0.96)",
            borderColor: "rgba(0, 42, 143, 0.2)",
            borderWidth: 1,
            borderRadius: 6,
            padding: {
              top: 3,
              right: 6,
              bottom: 3,
              left: 6
            },
            font: {
              weight: "900",
              size: 12
            },
            formatter: value => `${Math.round(value)}%`
          }
        },
        {
          type: "line",
          label: "Amount of projects",
          data: amountVisual,
          borderColor: "#18a8ff",
          backgroundColor: "#18a8ff",
          borderWidth: 3,
          tension: 0,
          fill: false,
          pointRadius: 13,
          pointHoverRadius: 14,
          pointStyle: "rectRounded",
          pointBackgroundColor: "#18a8ff",
          pointBorderColor: "#18a8ff",
          pointBorderWidth: 0,
          order: 0,
          datalabels: {
            color: "#ffffff",
            anchor: "center",
            align: "center",
            backgroundColor: "#18a8ff",
            borderColor: "#18a8ff",
            borderRadius: 7,
            padding: {
              top: 4,
              right: 7,
              bottom: 4,
              left: 7
            },
            font: {
              weight: "900",
              size: 11
            },
            formatter: (_, ctx) => amountReal[ctx.dataIndex]
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: {
        duration: 800
      },
      layout: {
        padding: {
          top: 18,
          right: 16,
          bottom: 24,
          left: 6
        }
      },
      plugins: {
        legend: {
          position: "top",
          align: "end",
          labels: {
            color: "#203554",
            boxWidth: 16,
            boxHeight: 7,
            usePointStyle: false,
            padding: 10,
            font: {
              size: 12,
              weight: "700"
            }
          }
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              if (context.dataset.label === "Scoring") {
                return `Scoring: ${context.raw}%`;
              }
              const idx = context.dataIndex;
              return `Amount of projects: ${amountReal[idx]}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false
          },
          ticks: {
            color: "#314562",
            autoSkip: false,
            padding: 8,
            font: {
              size: 11,
              weight: "700"
            },
            maxRotation: 50,
            minRotation: 50
          },
          border: {
            color: "#0a3f8c"
          }
        },
        y: {
          position: "right",
          min: 0,
          max: 100,
          ticks: {
            stepSize: 10,
            color: "#5e6f8f",
            callback: value => `${value}%`,
            font: {
              size: 11
            }
          },
          grid: {
            color: "rgba(95, 113, 139, 0.12)",
            drawBorder: false
          },
          border: {
            display: false
          }
        }
      }
    },
    plugins: [ChartDataLabels]
  });
}
