/* ==========================
   KPI CHART
========================== */
let deOverviewChart = null;

function calcularMediaProjeto(info) {
  const documentos = Object.values(info.documentos || {});
  const notas = documentos
    .map(doc => Number(doc.pontuacao || 0))
    .filter(nota => !isNaN(nota));

  if (!notas.length) return 0;

  const media = notas.reduce((acc, valor) => acc + valor, 0) / notas.length;
  return media; // escala 0–10
}

function normalizarQuantidadeProjetos(valores) {
  if (!valores.length) return [];

  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);

  // caso especial: só 1 DE (ou todos com mesma quantidade)
  if (minimo === maximo) {
    return valores.map(() => 45);
  }

  return valores.map(valor => {
    return 10 + ((valor - minimo) / (maximo - minimo)) * 70;
  });
}

function gerarGraficoDEs() {
  const canvas = document.getElementById("deOverviewChart");
  if (!canvas) return;

  // monta estatísticas por DE
  let stats = Object.entries(dados)
    .map(([de, info]) => {
      const projetos = Object.entries(info.projetos || {});
      if (!projetos.length) return null;

      const mediasProjetos = projetos.map(([_, projetoInfo]) =>
        calcularMediaProjeto(projetoInfo)
      );

      const mediaDE = mediasProjetos.length
        ? mediasProjetos.reduce((a, b) => a + b, 0) / mediasProjetos.length
        : 0;

      return {
        de,
        scoring: Math.round(mediaDE * 10), // 0–100
        amount: projetos.length
      };
    })
    .filter(Boolean);

  // remove DE sem projeto (regra que você pediu)
  stats = stats.filter(item => item.amount > 0);

  // ordenação: maior scoring à esquerda, depois decrescente
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
            color: "#ffffff",
            anchor: "center",
            align: "center",
            font: {
              weight: "700",
              size: 14
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
          pointRadius: 15,
          pointHoverRadius: 15,
          pointStyle: "rectRounded",
          pointBackgroundColor: "#18a8ff",
          pointBorderColor: "#18a8ff",
          pointBorderWidth: 0,
          order: 0,
          datalabels: {
            color: "#ffffff",
            anchor: "center",
            align: "center",
            font: {
              weight: "700",
              size: 12
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
          top: 10,
          right: 18,
          bottom: 8,
          left: 8
        }
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#203554",
            boxWidth: 18,
            boxHeight: 8,
            usePointStyle: false,
            font: {
              size: 13,
              weight: "600"
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
            color: "#203554",
            font: {
              size: 12,
              weight: "600"
            },
            maxRotation: 0,
            minRotation: 0
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
            display: false
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

