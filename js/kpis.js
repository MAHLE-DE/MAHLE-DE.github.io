/* ==========================
   KPI CHART
========================== */
let deOverviewChart = null;
let kpiAuditScoresRequested = false;
let deOverviewChartSignature = "";
let deOverviewScope = "current";
let pendingClassifierState = {
  loading: false,
  loaded: false,
  raw: null,
  scope: "current",
  detailMode: "classified",
  selectedCategory: "",
  filters: {
    gate: "all",
    de: "all",
    category: "all",
    query: ""
  },
  charts: {}
};

const PENDING_CATEGORY_LABELS = {
  missing_signature_or_signoff: "Missing signature/sign-off",
  repository_record_missing: "Missing in repository",
  missing_or_incomplete_information: "Missing information",
  analysis_or_check_not_completed: "Analysis/check not completed",
  missing_objective_evidence: "Missing objective evidence",
  required_document_or_artifact_unavailable: "Document unavailable",
  template_noncompliance: "Template issue",
  late_submission_or_update: "Late submission/update",
  workflow_status_not_released: "Document not released",
  activity_not_completed: "Activity not completed",
  customer_alignment_missing: "Customer alignment missing",
  gate_progression_issue: "Gate progression issue",
  revision_information_missing: "Revision information missing",
  information_inconsistency: "Information inconsistency",
  action_tracking_missing: "Action tracking missing",
  open_actions_not_closed: "Open actions not closed",
  needs_review: "Needs review"
};

const DOCUMENT_RECOVERY_WEIGHTS = {
  "mahle perf specif ms0": 3,
  "bom ms0": 5,
  "crm cam": 5,
  "advp r ms0": 3,
  "r d costs ms0": 3,
  "2d dl3": 1,
  "3d dl3": 1,
  "patent check": 3,
  "mahle perf specif ms1": 5,
  "special caracteristic list ms1": 5,
  "bom ms1 pn workflow": 5,
  "dvp r": 3,
  "stack up mockup": 3,
  "numerical simulation": 1,
  "traceability": 5,
  "dfmea": 5,
  "raw material release": 3,
  "drm dam": 5,
  "2d dl4": 5,
  "3d dl4": 5,
  "rapid proto control plan": 3,
  "special caracteristic list qg2": 5,
  "2d dl5": 5,
  "3d dl5": 5,
  "bom qg2": 5,
  "design approved by customer": 5,
  "dam qg2 signoff": 5,
  "dvp r concluded": 5,
  "patent check issues concluded": 5,
  "dfmea concluded": 5,
  "pv validation concluded": 5,
  "dfmea signoff": 5
};

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
  ordenarBlocosKpi();
  bindDeOverviewScopeControls();

  if (typeof dados === "undefined" || !dados || typeof dados !== "object") {
    return;
  }

  let stats = Object.entries(dados)
    .map(([de, info]) => {
      const projetos = Object.entries(info.projetos || {})
        .filter(([nomeProjeto]) => projectMatchesDeOverviewScope(nomeProjeto));
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
  const nextSignature = JSON.stringify({
    deOverviewScope,
    labels,
    scoringData,
    amountReal,
    chartWidth
  });

  if (deOverviewChart && deOverviewChartSignature === nextSignature) {
    deOverviewChart.resize();
    return;
  }

  const existingChart = typeof Chart !== "undefined" && typeof Chart.getChart === "function"
    ? Chart.getChart(canvas)
    : null;

  if (existingChart) {
    existingChart.destroy();
  } else if (deOverviewChart) {
    deOverviewChart.destroy();
  }
  deOverviewChart = null;
  deOverviewChartSignature = nextSignature;

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
            formatter: (_, ctx) => {
              const value = amountReal[ctx.dataIndex];
              return Number.isFinite(Number(value)) ? String(value) : "";
            }
          }
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 120,
      animation: {
        duration: 320
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
    plugins: [createDeOverviewLabelsPlugin(scoringData, amountReal, amountVisual)]
  });
}

function createDeOverviewLabelsPlugin(scoringData, amountReal, amountVisual) {
  return {
    id: "deOverviewValueLabels",
    afterDatasetsDraw(chart) {
      const { ctx, chartArea } = chart;
      if (!ctx || !chartArea) return;

      const scoreMeta = chart.getDatasetMeta(0);
      const amountMeta = chart.getDatasetMeta(1);

      ctx.save();
      scoreMeta.data.forEach((bar, index) => {
        const score = Number(scoringData[index]);
        if (!Number.isFinite(score) || !bar) return;

        const amount = Number(amountVisual[index] || 0);
        const lift = score < 8 || Math.abs(score - amount) < 12 ? 30 : 16;
        drawDeOverviewLabel(
          ctx,
          `${Math.round(score)}%`,
          bar.x,
          Math.max(chartArea.top + 12, bar.y - lift),
          {
            textColor: "#10233f",
            background: "rgba(255, 255, 255, 0.96)",
            border: "rgba(0, 42, 143, 0.2)"
          }
        );
      });

      amountMeta.data.forEach((point, index) => {
        const value = Number(amountReal[index]);
        if (!Number.isFinite(value) || !point) return;

        drawDeOverviewLabel(
          ctx,
          String(value),
          point.x,
          point.y,
          {
            textColor: "#ffffff",
            background: "#18a8ff",
            border: "#18a8ff"
          }
        );
      });
      ctx.restore();
    }
  };
}

function drawDeOverviewLabel(ctx, text, centerX, centerY, options) {
  const label = String(text || "");
  if (!label) return;

  ctx.font = "900 12px Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const width = Math.max(24, ctx.measureText(label).width + 12);
  const height = 22;
  const x = centerX - width / 2;
  const y = centerY - height / 2;

  ctx.fillStyle = options.background;
  ctx.strokeStyle = options.border;
  ctx.lineWidth = 1;
  roundedRectPath(ctx, x, y, width, height, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = options.textColor;
  ctx.fillText(label, centerX, centerY + 0.5);
}

function roundedRectPath(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function ordenarBlocosKpi() {
  const section = document.getElementById("kpis-section");
  const dashboard = section?.querySelector(".dashboard-card");
  const classifier = section?.querySelector("#pendingClassifierKpi");
  const overall = section?.querySelector(".kpi-chart-card");
  if (!section || !dashboard || !classifier || !overall) return;

  if (section.firstElementChild !== dashboard) {
    section.insertBefore(dashboard, section.firstElementChild);
  }

  if (overall.previousElementSibling !== classifier) {
    section.insertBefore(overall, classifier.nextElementSibling);
  }
}

function bindDeOverviewScopeControls() {
  document.querySelectorAll("[data-de-overview-scope]").forEach(button => {
    if (button.dataset.boundDeOverviewScope === "true") return;
    button.dataset.boundDeOverviewScope = "true";
    button.addEventListener("click", () => {
      const scope = button.dataset.deOverviewScope || "current";
      if (scope === deOverviewScope) return;
      deOverviewScope = scope;
      refreshDeOverviewChartSafe();
      if (!pendingClassifierState.loaded && typeof carregarPendingClassifierKpis === "function") {
        carregarPendingClassifierKpis().then(() => {
          refreshDeOverviewChartSafe();
        });
      }
    });
  });

  document.querySelectorAll("[data-de-overview-scope]").forEach(button => {
    button.classList.toggle("active", button.dataset.deOverviewScope === deOverviewScope);
  });
}

function refreshDeOverviewChartSafe() {
  try {
    deOverviewChartSignature = "";
    gerarGraficoDEs();
  } catch (error) {
    console.error("KPI overview chart error:", error);
  }
}

function projectMatchesDeOverviewScope(nomeProjeto) {
  if (deOverviewScope === "overall") return true;

  const classifierStatus = getKpiClassifierProjectStatus(nomeProjeto);
  if (classifierStatus) {
    return deOverviewScope === "completed"
      ? classifierStatus === "completed"
      : classifierStatus !== "completed";
  }

  const auditProject = getKpiAuditProjectByName(nomeProjeto);
  const completed = Boolean(
    auditProject && (
      auditProject.auditEndDate ||
      auditProject.completionDate ||
      auditProject.completedDate ||
      auditProject.endDate
    )
  );

  return deOverviewScope === "completed" ? completed : !completed;
}

function getKpiClassifierProjectStatus(nomeProjeto) {
  const raw = pendingClassifierState.raw;
  if (!raw || typeof normalizarBacklogAuditName !== "function") return "";

  const key = normalizarBacklogAuditName(nomeProjeto);
  if (!key) return "";

  const candidates = [
    ...(Array.isArray(raw.projects) ? raw.projects : []),
    ...(Array.isArray(raw.classifiedPending) ? raw.classifiedPending : [])
  ];

  const match = candidates.find(item => {
    const itemKey = normalizarBacklogAuditName(item.project || item.projectName || item.nome);
    return itemKey && (itemKey === key || itemKey.includes(key) || key.includes(itemKey));
  });

  return match?.status || "";
}

function getKpiAuditProjectByName(nomeProjeto) {
  if (typeof extrairBacklogAuditProjects !== "function" || typeof normalizarBacklogAuditName !== "function") {
    return null;
  }

  const rawAudits = typeof auditState !== "undefined" ? auditState.raw : null;
  const key = normalizarBacklogAuditName(nomeProjeto);
  if (!rawAudits || !key) return null;

  return extrairBacklogAuditProjects(rawAudits).find(project => {
    const names = [
      project.projectName,
      project.nome,
      project.backlogProjectName,
      project.dashboardName,
      project.id,
      ...(Array.isArray(project.aliases) ? project.aliases : [])
    ].map(normalizarBacklogAuditName).filter(Boolean);

    return names.some(auditName =>
      auditName === key ||
      auditName.includes(key) ||
      key.includes(auditName)
    );
  }) || null;
}

function carregarPendingClassifierKpis() {
  const container = document.getElementById("pendingClassifierKpi");
  if (!container) return Promise.resolve(null);

  if (pendingClassifierState.loaded) {
    renderizarPendingClassifierKpis();
    return Promise.resolve(pendingClassifierState.raw);
  }

  if (pendingClassifierState.loading) {
    return Promise.resolve(null);
  }

  pendingClassifierState.loading = true;

  return firebase.firestore()
    .collection("classificado")
    .doc("classificador")
    .get()
    .then(doc => {
      pendingClassifierState.loading = false;
      if (!doc.exists) {
        pendingClassifierState.raw = null;
        pendingClassifierState.loaded = true;
        renderizarPendingClassifierKpis();
        return null;
      }

      const data = doc.data();
      pendingClassifierState.raw = parsePendingClassifierJson(data.jsonCompleto || data);
      pendingClassifierState.loaded = true;
      renderizarPendingClassifierKpis();
      if (typeof gerarGraficoDEs === "function") {
        refreshDeOverviewChartSafe();
      }
      return pendingClassifierState.raw;
    })
    .catch(error => {
      pendingClassifierState.loading = false;
      console.error("Pending classifier KPI load error:", error);
      container.innerHTML = `
        <section class="pending-kpi-empty">
          <i class="fa-solid fa-triangle-exclamation"></i>
          <strong>Classified KPI data could not be loaded</strong>
          <span>${escapeHtml(error.message || "Firestore read failed.")}</span>
        </section>
      `;
      return null;
    });
}

function parsePendingClassifierJson(value) {
  if (!value) return null;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return JSON.parse(value.replace(/'/g, '"'));
  }
}

function renderizarPendingClassifierKpis() {
  const container = document.getElementById("pendingClassifierKpi");
  const raw = pendingClassifierState.raw;
  if (!container) return;

  destroyPendingClassifierCharts();

  if (!raw) {
    container.innerHTML = `
      <section class="pending-kpi-empty">
        <i class="fa-solid fa-database"></i>
        <strong>No classified pending KPI loaded</strong>
        <span>Create classificado/classificador with jsonCompleto generated by the classifier.</span>
      </section>
    `;
    return;
  }

  const scope = pendingClassifierState.scope;
  const scopedItems = getPendingScopeItems(raw.classifiedPending || [], scope);
  const filteredItems = filterPendingItems(scopedItems);
  const summary = buildPendingSummary(filteredItems);
  const kpis = buildPendingAggregates(filteredItems);
  const generatedAt = formatClassifierDate(raw.metadata?.generatedAt);

  container.innerHTML = `
    <section class="pending-kpi-header">
      <div>
        <span class="pending-kpi-eyebrow">Pending Classifier KPI</span>
        <h2>Backlog Intelligence</h2>
        <p>${generatedAt ? `Last generated: ${generatedAt}` : "Firestore source: classificado/classificador"}</p>
      </div>
      <div class="pending-kpi-header-stats">
        <button class="export-png-btn pending-kpi-export-btn" type="button" data-export-selector="#pendingClassifierKpi" data-export-name="pending-classifier-kpis">
          <i class="fa-regular fa-image"></i>
        </button>
        ${renderHeaderStat("Items", summary.rows)}
        ${renderHeaderStat("Projects", summary.projects)}
        ${renderHeaderStat("Review", summary.needs_review_rows)}
      </div>
      <div class="pending-kpi-scope-tabs" role="tablist">
        ${renderScopeButton("current", "Current")}
        ${renderScopeButton("overall", "Overall")}
        ${renderScopeButton("completed", "Completed")}
      </div>
    </section>

    <section class="pending-kpi-toolbar">
      ${renderPendingFilters(scopedItems)}
    </section>

    <section class="pending-kpi-grid">
      ${renderPendingTypesPanel(kpis.by_category || {}, summary.rows)}
      ${renderGateExplorer(filteredItems, scopedItems)}
    </section>

    <section class="pending-kpi-secondary-grid">
      ${renderDeWorkloadPanel(kpis.pending_by_de || {})}
      ${renderImpactInsightPanel(kpis.estimated_score_impact_by_category || {})}
    </section>

    <section class="pending-kpi-wide">
      <div class="pending-kpi-panel">
        <div class="pending-kpi-panel-head">
          <div>
            <h3>Documents with most pending items</h3>
            <span>Top documents in the selected scope.</span>
          </div>
        </div>
        <div class="pending-kpi-document-list">
          ${renderDocumentRanking(kpis.pending_by_document || {})}
        </div>
      </div>

      <div class="pending-kpi-panel pending-kpi-detail-panel">
        ${renderClassifierDetailPanel(filteredItems, raw.classifiedPending || [])}
      </div>
    </section>
  `;

  container.querySelectorAll("[data-pending-scope]").forEach(button => {
    button.addEventListener("click", () => {
      pendingClassifierState.scope = button.dataset.pendingScope;
      pendingClassifierState.filters = {
        gate: "all",
        de: "all",
        category: "all",
        query: ""
      };
      renderizarPendingClassifierKpis();
    });
  });

  container.querySelectorAll("[data-pending-filter]").forEach(control => {
    control.addEventListener("change", () => {
      pendingClassifierState.filters[control.dataset.pendingFilter] = control.value;
      renderizarPendingClassifierKpis();
    });
  });

  const searchInput = container.querySelector("[data-pending-search]");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      pendingClassifierState.filters.query = searchInput.value;
      renderizarPendingClassifierKpis();
    });
    searchInput.focus({ preventScroll: true });
    searchInput.setSelectionRange(searchInput.value.length, searchInput.value.length);
  }

  container.querySelectorAll("[data-pending-gate-chip]").forEach(button => {
    button.addEventListener("click", () => {
      pendingClassifierState.filters.gate = button.dataset.pendingGateChip;
      renderizarPendingClassifierKpis();
    });
  });

  const resetButton = container.querySelector("[data-pending-reset]");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      pendingClassifierState.filters = {
        gate: "all",
        de: "all",
        category: "all",
        query: ""
      };
      renderizarPendingClassifierKpis();
    });
  }

  container.querySelectorAll("[data-pending-detail-mode]").forEach(button => {
    button.addEventListener("click", () => {
      pendingClassifierState.detailMode = button.dataset.pendingDetailMode || "review";
      renderizarPendingClassifierKpis();
    });
  });

  const categorySelector = container.querySelector("[data-classified-category]");
  if (categorySelector) {
    categorySelector.addEventListener("change", () => {
      pendingClassifierState.selectedCategory = categorySelector.value;
      renderizarPendingClassifierKpis();
    });
  }

  requestAnimationFrame(() => desenharPendingClassifierCharts(kpis));
}

function renderScopeButton(scope, label) {
  const active = pendingClassifierState.scope === scope ? "active" : "";
  return `<button type="button" class="${active}" data-pending-scope="${scope}">${label}</button>`;
}

function renderHeaderStat(label, value) {
  return `
    <div class="pending-kpi-head-stat">
      <span>${label}</span>
      <strong>${formatNumber(value)}</strong>
    </div>
  `;
}

function renderPendingFilters(scopedItems) {
  const filters = pendingClassifierState.filters;
  const gates = sortPendingGates(uniqueValues(scopedItems, "gate"));
  const des = uniqueValues(scopedItems, "de").sort((a, b) => a.localeCompare(b, "pt-BR"));
  const categories = uniqueValues(scopedItems, "category")
    .filter(category => category !== "needs_review")
    .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), "en-US"));
  const hasFilters = filters.gate !== "all" || filters.de !== "all" || filters.category !== "all" || filters.query.trim();

  return `
    <label class="pending-kpi-filter">
      <span>Gate</span>
      <select data-pending-filter="gate">
        ${renderOption("all", "All gates", filters.gate)}
        ${gates.map(gate => renderOption(gate, gate, filters.gate)).join("")}
      </select>
    </label>
    <label class="pending-kpi-filter">
      <span>DE</span>
      <select data-pending-filter="de">
        ${renderOption("all", "All DEs", filters.de)}
        ${des.map(de => renderOption(de, de, filters.de)).join("")}
      </select>
    </label>
    <label class="pending-kpi-filter pending-kpi-filter-wide">
      <span>Type</span>
      <select data-pending-filter="category">
        ${renderOption("all", "All pending types", filters.category)}
        ${categories.map(category => renderOption(category, categoryLabel(category), filters.category)).join("")}
      </select>
    </label>
    <label class="pending-kpi-search">
      <span>Search</span>
      <div>
        <i class="fa-solid fa-magnifying-glass"></i>
        <input type="text" data-pending-search value="${escapeHtml(filters.query)}" placeholder="Project, document, DE or text...">
      </div>
    </label>
    <button class="pending-kpi-reset" type="button" data-pending-reset ${hasFilters ? "" : "disabled"}>
      <i class="fa-solid fa-rotate-left"></i>
    </button>
  `;
}

function renderOption(value, label, selectedValue) {
  const selected = String(value) === String(selectedValue) ? "selected" : "";
  return `<option value="${escapeHtml(value)}" ${selected}>${escapeHtml(label)}</option>`;
}

function renderChartCard(title, canvasId, subtitle) {
  const total = canvasId === "pendingCategoryChart"
    ? buildPendingSummary(filterPendingItems(getPendingScopeItems(pendingClassifierState.raw?.classifiedPending || [], pendingClassifierState.scope))).rows
    : null;

  return `
    <div class="pending-kpi-panel pending-kpi-chart-panel">
      <div class="pending-kpi-panel-head">
        <div>
          <h3>${title}</h3>
          <span>${subtitle}</span>
        </div>
        ${total !== null ? `<div class="pending-kpi-chart-total"><span>Total</span><strong>${formatNumber(total)}</strong></div>` : ""}
      </div>
      <div class="pending-kpi-chart-wrap">
        <canvas id="${canvasId}"></canvas>
      </div>
    </div>
  `;
}

function renderPendingTypesPanel(source, total) {
  const entries = topEntries(source, 10);
  const max = Math.max(...entries.map(item => item.value), 1);

  return `
    <div class="pending-kpi-panel pending-kpi-types-panel">
      <div class="pending-kpi-panel-head">
        <div>
          <h3>Main pending types</h3>
          <span>Share of classified causes after the active filters.</span>
        </div>
        <div class="pending-kpi-chart-total"><span>Total</span><strong>${formatNumber(total)}</strong></div>
      </div>
      <div class="pending-type-list">
        ${entries.length ? entries.map(item => {
          const percent = total ? Math.round((item.value / total) * 100) : 0;
          const width = Math.max(6, Math.round((item.value / max) * 100));
          return `
            <div class="pending-type-row">
              <strong>${escapeHtml(categoryLabel(item.label))}</strong>
              <div><i style="width:${width}%"></i></div>
              <span>${percent}%</span>
            </div>
          `;
        }).join("") : `<div class="pending-kpi-muted">No pending type data for the active filters.</div>`}
      </div>
    </div>
  `;
}

function renderDeWorkloadPanel(source) {
  const entries = topEntries(source, 50);
  const max = Math.max(...entries.map(item => item.value), 1);
  const chartWidth = Math.max(500, entries.length * 54);

  return `
    <div class="pending-kpi-panel pending-kpi-de-panel">
      <div class="pending-kpi-panel-head">
        <div>
          <h3>Development Engineer workload</h3>
          <span>Pending concentration by responsible DE after the active filters.</span>
        </div>
      </div>
      <div class="pending-de-chart-scroll">
        <div class="pending-de-chart" style="min-width:${chartWidth}px">
          ${entries.map(item => {
            const height = Math.max(8, Math.round((item.value / max) * 94));
            return `
              <div class="pending-de-column">
                <div class="pending-de-bar-zone" style="--bar-height:${height}%">
                  <span>${formatNumber(item.value)}</span>
                  <i style="height:${height}%"></i>
                </div>
                <strong title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</strong>
              </div>
            `;
          }).join("")}
        </div>
      </div>
    </div>
  `;
}

function renderImpactInsightPanel(source) {
  const entries = topEntries(source, 7);
  const max = Math.max(...entries.map(item => item.value), 1);

  return `
    <div class="pending-kpi-panel pending-kpi-impact-panel">
      <div class="pending-kpi-panel-head">
        <div>
          <h3>Score recovery potential</h3>
          <span>Weighted by the criterion value and by the fixed document weight from the dashboard criteria.</span>
        </div>
      </div>
      <div class="pending-impact-list">
        ${entries.map((item, index) => {
          const width = Math.max(10, Math.round((item.value / max) * 100));
          return `
            <div class="pending-impact-row">
              <em>${String(index + 1).padStart(2, "0")}</em>
              <div>
                <strong>${escapeHtml(categoryLabel(item.label))}</strong>
                <span><i style="width:${width}%"></i></span>
              </div>
              <b>${formatNumber(item.value)}</b>
            </div>
          `;
        }).join("") || `<div class="pending-kpi-muted">No weighted recovery data for the active filters.</div>`}
      </div>
    </div>
  `;
}

function desenharPendingClassifierCharts(kpis) {
}

function getPendingScopeItems(items, scope) {
  return items.filter(item => scope === "overall" || item.status === scope);
}

function filterPendingItems(items, options = {}) {
  const filters = pendingClassifierState.filters;
  const query = normalizePendingText(filters.query);
  return items.filter(item => {
    if (filters.gate !== "all" && String(item.gate || "") !== filters.gate) return false;
    if (filters.de !== "all" && String(item.de || "") !== filters.de) return false;
    if (!options.ignoreCategory && filters.category !== "all" && String(item.category || "") !== filters.category) return false;
    if (!query) return true;

    return [
      item.project,
      item.de,
      item.gate,
      item.document,
      item.text,
      item.category,
      categoryLabel(item.category)
    ].some(value => normalizePendingText(value).includes(query));
  });
}

function buildPendingSummary(items) {
  return {
    rows: items.length,
    projects: new Set(items.map(item => item.project).filter(Boolean)).size,
    unique_texts: new Set(items.map(item => item.textHash || item.text).filter(Boolean)).size,
    needs_review_rows: items.filter(item => item.needsReview).length,
    human_exclusion_rows: items.filter(item => item.classifier === "human_exclusion").length
  };
}

function buildPendingAggregates(items) {
  return {
    pending_by_de: countBy(items, item => item.de || "No DE"),
    pending_by_gate: countBy(items, item => item.gate || "No gate"),
    pending_by_document: countBy(items, item => item.document || "No document"),
    by_category: countBy(items, item => item.category || "needs_review"),
    estimated_score_impact_by_category: sumBy(
      items.filter(item => !item.needsReview && item.category && item.category !== "needs_review"),
      item => item.category,
      item => calculatePendingRecoveryPotential(item)
    )
  };
}

function calculatePendingRecoveryPotential(item) {
  return getCriterionRecoveryWeight(item) * getDocumentRecoveryWeight(item.document);
}

function getCriterionRecoveryWeight(item) {
  const value = Number(item?.criterionWeight);
  return Number.isFinite(value) && value > 0 ? value : 1;
}

function getDocumentRecoveryWeight(documentName) {
  const key = normalizePendingText(documentName);
  if (!key) return 1;
  if (DOCUMENT_RECOVERY_WEIGHTS[key]) return DOCUMENT_RECOVERY_WEIGHTS[key];

  const matchedKey = Object.keys(DOCUMENT_RECOVERY_WEIGHTS).find(weightKey =>
    weightKey === key || weightKey.includes(key) || key.includes(weightKey)
  );

  return matchedKey ? DOCUMENT_RECOVERY_WEIGHTS[matchedKey] : 1;
}

function renderGateExplorer(items, scopedItems) {
  const gates = sortPendingGates(uniqueValues(scopedItems, "gate"));
  const selectedGate = pendingClassifierState.filters.gate;
  const gateCounts = gates.map(gate => ({
    gate,
    count: items.filter(item => item.gate === gate).length
  }));
  const maxGateCount = Math.max(...gateCounts.map(item => item.count), 1);
  const selectedGateItems = selectedGate === "all"
    ? items
    : items.filter(item => item.gate === selectedGate);
  const topCategories = topEntries(countBy(selectedGateItems, item => item.category || "needs_review"), 7);
  const total = selectedGateItems.length;

  return `
    <div class="pending-kpi-panel pending-kpi-gate-panel">
      <div class="pending-kpi-panel-head">
        <div>
          <h3>Gate concentration</h3>
          <span>${selectedGate === "all" ? "General top types with gate distribution." : `Top types normalized inside ${escapeHtml(selectedGate)}.`}</span>
        </div>
      </div>
      <div class="pending-gate-chip-row">
        ${renderGateChip("all", "All", selectedGate, items.length, Math.max(items.length, 1), 0)}
        ${gateCounts.map((item, index) => renderGateChip(item.gate, item.gate, selectedGate, item.count, maxGateCount, index + 1)).join("")}
      </div>
      <div class="pending-gate-focus ${selectedGate === "all" ? "all-mode" : "single-mode"}">
        <div class="pending-gate-top-list">
          ${selectedGate !== "all" ? `
            <div class="pending-gate-total-card">
              <span>Total in ${escapeHtml(selectedGate)}</span>
              <strong>${formatNumber(total)}</strong>
            </div>
          ` : ""}
          ${topCategories.length ? topCategories.map(item => renderGateTopRow(item, total)).join("") : `<div class="pending-kpi-muted">No gate data for the active filters.</div>`}
        </div>
        ${selectedGate === "all" ? renderGateDistributionMatrix(topCategories.map(item => item.label), gates, items) : ""}
      </div>
    </div>
  `;
}

function renderGateChip(value, label, selected, count, max, toneIndex = 0) {
  const active = String(value) === String(selected) ? "active" : "";
  const isAll = value === "all";
  return `
    <button type="button" class="pending-gate-chip ${active} ${isAll ? "is-all" : ""}" data-tone="${toneIndex % 6}" data-pending-gate-chip="${escapeHtml(value)}">
      <span>${escapeHtml(label)}</span>
      ${isAll ? "" : `<strong>${formatNumber(count)}</strong>`}
    </button>
  `;
}

function renderGateTopRow(item, total) {
  const percent = total ? Math.round((item.value / total) * 100) : 0;
  return `
    <div class="pending-gate-top-row">
      <strong>${escapeHtml(categoryLabel(item.label))}</strong>
      <span>${formatNumber(item.value)} items</span>
      <em>${total ? `${percent}%` : "0%"}</em>
    </div>
  `;
}

function renderGateDistributionMatrix(categories, gates, items) {
  if (!categories.length || !gates.length) return "";
  const max = Math.max(
    ...categories.flatMap(category => gates.map(gate =>
      items.filter(item => item.gate === gate && item.category === category).length
    )),
    1
  );

  return `
    <div class="pending-gate-matrix">
      <div class="pending-gate-matrix-head">
        <span>Pending type</span>
        ${gates.map(gate => `<button type="button" data-pending-gate-chip="${escapeHtml(gate)}">${escapeHtml(gate)}</button>`).join("")}
      </div>
      ${categories.map(category => `
        <div class="pending-gate-matrix-row">
          <strong title="${escapeHtml(categoryLabel(category))}">${escapeHtml(categoryLabel(category))}</strong>
          ${gates.map(gate => {
            const count = items.filter(item => item.gate === gate && item.category === category).length;
            const intensity = count ? Math.max(12, Math.round((count / max) * 100)) : 0;
            const shade = getGateHeatColor(intensity);
            const textColor = intensity >= 65 ? "#ffffff" : "#10233f";
          return `
            <button type="button" class="pending-gate-cell" data-pending-gate-chip="${escapeHtml(gate)}" style="--cell-bg:${shade};--cell-text:${textColor};">
              <strong>${count ? formatNumber(count) : ""}</strong>
            </button>
          `;
          }).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

function getGateHeatColor(intensity) {
  if (!intensity) return "#f4f7fc";
  if (intensity < 25) return "#dbe8f8";
  if (intensity < 45) return "#b9d1ef";
  if (intensity < 65) return "#7fa9dc";
  if (intensity < 85) return "#3f76bd";
  return "#0b3d91";
}

function criarBarChart(canvasId, entries, options = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === "undefined") return;

  const labels = entries.map(item => options.labelFormatter ? options.labelFormatter(item.label) : item.label);
  const rawValues = entries.map(item => item.value);
  const values = options.percentBase
    ? rawValues.map(value => options.percentBase ? (value / options.percentBase) * 100 : 0)
    : rawValues;
  const axis = options.horizontal ? "y" : "x";

  pendingClassifierState.charts[canvasId] = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: options.valueLabel || "Pending items",
        data: values,
        backgroundColor: options.color || "#002a8f",
        borderRadius: 0,
        barPercentage: 0.68,
        categoryPercentage: 0.72
      }]
    },
    options: {
      indexAxis: axis,
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 360 },
      plugins: {
        legend: { display: false },
        datalabels: {
          anchor: "end",
          align: "end",
          offset: 4,
          color: "#17233d",
          font: { weight: "900", size: 11 },
          formatter: value => options.percentBase ? `${Math.round(value)}%` : formatNumber(value)
        },
        tooltip: {
          callbacks: {
            label: context => {
              const raw = rawValues[context.dataIndex] || 0;
              if (options.percentBase) {
                return `${options.valueLabel || "Pending items"}: ${formatNumber(context.raw)}% (${formatNumber(raw)} items)`;
              }
              return `${options.valueLabel || "Pending items"}: ${formatNumber(context.raw)}`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          max: options.percentBase ? 100 : undefined,
          grid: { color: "rgba(95, 113, 139, 0.11)" },
          ticks: {
            color: "#5e6f8f",
            precision: 0,
            font: { weight: "700" },
            callback: value => options.percentBase ? `${value}%` : value
          }
        },
        y: {
          beginAtZero: true,
          grid: { display: !options.horizontal, color: "rgba(95, 113, 139, 0.11)" },
          ticks: { color: "#223553", autoSkip: false, font: { weight: "800", size: 11 } }
        }
      }
    },
    plugins: typeof ChartDataLabels !== "undefined" ? [ChartDataLabels] : []
  });
}

function destroyPendingClassifierCharts() {
  Object.values(pendingClassifierState.charts).forEach(chart => {
    if (chart && typeof chart.destroy === "function") chart.destroy();
  });
  pendingClassifierState.charts = {};
}

function topEntries(source, limit) {
  if (!source) return [];
  const entries = Array.isArray(source)
    ? source.map(item => ({ label: item.keys?.join(" / ") || item.label || "", value: Number(item.count ?? item.impact ?? item.value ?? 0) }))
    : Object.entries(source).map(([label, value]) => ({ label, value: Number(value || 0) }));
  return entries
    .filter(item => item.label && Number.isFinite(item.value))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function countBy(items, getKey) {
  return items.reduce((acc, item) => {
    const key = String(getKey(item) || "Not informed");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function sumBy(items, getKey, getValue) {
  return items.reduce((acc, item) => {
    const key = String(getKey(item) || "Not informed");
    acc[key] = (acc[key] || 0) + Number(getValue(item) || 0);
    return acc;
  }, {});
}

function uniqueValues(items, key) {
  return [...new Set(items.map(item => String(item[key] || "").trim()).filter(Boolean))];
}

function sortPendingGates(gates) {
  const order = ["MS0", "QG1", "MS1", "QG2", "MS2", "QG3", "QG4"];
  return [...gates].sort((a, b) => {
    const indexA = order.indexOf(a);
    const indexB = order.indexOf(b);
    if (indexA !== -1 || indexB !== -1) {
      return (indexA === -1 ? 99 : indexA) - (indexB === -1 ? 99 : indexB);
    }
    return a.localeCompare(b, "en-US");
  });
}

function normalizePendingText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function renderDocumentRanking(source) {
  const entries = topEntries(source, 12);
  if (!entries.length) {
    return `<div class="pending-kpi-muted">No document data for this scope.</div>`;
  }
  const max = Math.max(...entries.map(item => item.value), 1);
  return entries.map((item, index) => `
    <div class="pending-kpi-rank-row">
      <span>${String(index + 1).padStart(2, "0")}</span>
      <strong>${escapeHtml(item.label)}</strong>
      <div><i style="width:${Math.max(6, (item.value / max) * 100)}%"></i></div>
      <em>${formatNumber(item.value)}</em>
    </div>
  `).join("");
}

function renderNeedsReviewListLegacy(items) {
  const filtered = items
    .filter(item => item.needsReview)
    .slice(0, 12);

  if (!filtered.length) {
    return `
      <div class="pending-kpi-review-empty">
        <i class="fa-solid fa-circle-check"></i>
        <strong>No review queue for this scope</strong>
        <span>The classifier handled all current findings with approved rules or semantic confidence.</span>
      </div>
    `;
  }

  return filtered.map(item => `
    <article class="pending-kpi-review-item">
      <div>
        <strong>${escapeHtml(item.project || "Unnamed project")}</strong>
        <span>${escapeHtml(item.de || "No DE")} · ${escapeHtml(item.gate || "No gate")} · ${escapeHtml(item.document || "No document")}</span>
      </div>
      <p>${escapeHtml(item.text || "")}</p>
    </article>
  `).join("");
}

function renderClassifierDetailPanel(items, overallItems) {
  const mode = pendingClassifierState.detailMode || "review";
  const categories = uniqueValues(items.filter(item => !item.needsReview), "category")
    .filter(category => category !== "needs_review")
    .sort((a, b) => categoryLabel(a).localeCompare(categoryLabel(b), "en-US"));
  const reviewItems = (overallItems || []).filter(item => item.needsReview);

  if (!pendingClassifierState.selectedCategory || !categories.includes(pendingClassifierState.selectedCategory)) {
    pendingClassifierState.selectedCategory = categories[0] || "";
  }

  return `
    <div class="pending-kpi-detail-head">
      <div class="pending-kpi-detail-toggle" data-mode="${escapeHtml(mode)}">
        <span></span>
        <button type="button" class="${mode === "classified" ? "active" : ""}" data-pending-detail-mode="classified">
          Classified items
        </button>
        <button type="button" class="${mode === "review" ? "active" : ""}" data-pending-detail-mode="review">
          Items requiring review
        </button>
      </div>
      <small>${mode === "review" ? "Ambiguous findings for classifier memory." : "Original findings grouped by standard pending type."}</small>
    </div>
    ${
      mode === "classified"
        ? `<div class="pending-kpi-detail-body">${renderClassifiedItemsPanel(items, categories)}</div>`
        : `<div class="pending-kpi-detail-body pending-kpi-review-list">${renderNeedsReviewList(reviewItems)}</div>`
    }
  `;
}

function renderClassifiedItemsPanel(items, categories) {
  if (!categories.length) {
    return `
      <div class="pending-kpi-review-empty">
        <i class="fa-solid fa-layer-group"></i>
        <strong>No classified item for this filter</strong>
        <span>Change the filters to inspect standard pending groups.</span>
      </div>
    `;
  }

  const selected = pendingClassifierState.selectedCategory;
  const classifiedItems = items
    .filter(item => !item.needsReview && item.category === selected)
    .sort((a, b) => String(a.project || "").localeCompare(String(b.project || ""), "pt-BR"))
    .slice(0, 80);

  return `
    <label class="pending-kpi-category-picker">
      <span>Standard pending type</span>
      <select data-classified-category>
        ${categories.map(category => renderOption(category, `${categoryLabel(category)} (${items.filter(item => !item.needsReview && item.category === category).length})`, selected)).join("")}
      </select>
    </label>
    <div class="pending-kpi-classified-summary">
      <strong>${escapeHtml(categoryLabel(selected))}</strong>
      <span>${classifiedItems.length} finding(s) shown from the active filters.</span>
    </div>
    <div class="pending-kpi-review-list pending-kpi-scroll-list">
      ${classifiedItems.map(renderPendingFindingItem).join("")}
    </div>
  `;
}

function renderNeedsReviewList(items) {
  const filtered = items
    .slice(0, 80);

  if (!filtered.length) {
    return `
      <div class="pending-kpi-review-empty">
        <i class="fa-solid fa-circle-check"></i>
        <strong>No review queue for this scope</strong>
        <span>The classifier handled all current findings with approved rules or semantic confidence.</span>
      </div>
    `;
  }

  return `<div class="pending-kpi-scroll-list">${filtered.map(renderPendingFindingItem).join("")}</div>`;
}

function renderPendingFindingItem(item) {
  return `
    <article class="pending-kpi-review-item">
      <div>
        <strong>${escapeHtml(item.project || "Unnamed project")}</strong>
        <span>${escapeHtml(item.de || "No DE")} - ${escapeHtml(item.gate || "No gate")} - ${escapeHtml(item.document || "No document")}</span>
      </div>
      <p>${escapeHtml(item.text || "")}</p>
    </article>
  `;
}

function categoryLabel(category) {
  return PENDING_CATEGORY_LABELS[category] || String(category || "").replace(/_/g, " ");
}

function formatNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(1);
}

function formatClassifierDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
