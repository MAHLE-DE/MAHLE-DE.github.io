/* ==========================
   DASHBOARD - SCORE OF PROJECTS
========================== */

let dashboardDados        = null;
let dashboardAnosVisiveis = new Set(); // anos atualmente exibidos

/* ---------- constantes de layout ---------- */
const BAR_HEIGHT_MAX = 500; // px — altura da barra para score=100%
/* ---------- cores por ano ---------- */
const YEAR_COLORS = {
  "2024": "#355294",
  "2025": "#233675",
  "2026": "#121b56",
  "2027": "#000037",
  "2028": "#d2def4",
  "2029": "#cad8f2",
  "2030": "#c2d2f0",
};

/* ---------- helpers de cor ---------- */
function scorePct(score) { return Math.round(score * 100); }

function corBarra(score) {
  // Dashboard: barras fixas em cinza claro
  return "#d9e1ef";
}

function corBarraSombra(score) {
  // Sombra neutra para barras do Dashboard
  return "transparent";
}

/* ---------- detectar audit sequence e nomes ---------- */
function ehAuditSequence(nomeGrafico) {
  return /[{[\]}]/.test(nomeGrafico);
}
function nomeExibicao(nomeGrafico) {
  return nomeGrafico.replace(/[{[\]}]/g, "").trim();
}

/* ---------- carregar dados ---------- */
function carregarDashboard() {
  if (dashboardDados) { renderizarDashboard(); return; }

  const chart = document.getElementById("dashboardChart");
  if (chart && typeof renderSiteLoading === "function") {
    chart.innerHTML = renderSiteLoading(
      "Loading dashboard",
      "Fetching score data and targets from Firestore.",
      true
    );
  }

  firebase.firestore()
    .collection("dashboard")
    .doc("dashboard")
    .get()
    .then(doc => {
      if (!doc.exists) {
        console.error("Dashboard doc not found.");
        renderizarDashboard();
        return;
      }

      const item = doc.data();

      try {
        // campo jsonCompleto e uma string — mesmo padrao de projetos
        const textoCorrigido = item.jsonCompleto.replace(/'/g, '"');
        dashboardDados = JSON.parse(textoCorrigido);
      } catch (e) {
        console.error("Dashboard JSON parse error:", e);
        dashboardDados = null;
      }

      renderizarDashboard();
    })
    .catch(err => {
      console.error("Dashboard load error:", err);
      dashboardDados = null;
      renderizarDashboard();
    });
}

/* fallback removido por segurança — dados vêm exclusivamente do Firestore */

/* ----------  ----------*/


function _clamp(valor, min, max) {
  return Math.max(min, Math.min(max, valor));
}

function _getTodosAnosDashboard() {
  return dashboardDados && dashboardDados.anos
    ? Object.keys(dashboardDados.anos).sort()
    : [];
}

function _getAnosVisiveisOrdenados(todosAnos = _getTodosAnosDashboard()) {
  return todosAnos.filter(ano => dashboardAnosVisiveis.has(ano));
}

function _contarBarrasAno(ano) {
  const dadosAno = dashboardDados?.anos?.[ano];
  if (!dadosAno || !Array.isArray(dadosAno.projetos)) return 0;
  return dadosAno.projetos.length + 1;
}

function _calcularLayoutDashboard(todosAnos = _getTodosAnosDashboard()) {
  const wrapper = document.querySelector("#kpis-section .chart-scroll-wrapper");
  const chart = document.getElementById("dashboardChart");
  const anosVisiveis = _getAnosVisiveisOrdenados(todosAnos);

  if (!wrapper || !chart || !dashboardDados || !anosVisiveis.length) {
    return null;
  }

  const available = Math.max(320, Math.floor(wrapper.clientWidth || chart.parentElement?.clientWidth || 1000));
  const yearCount = anosVisiveis.length;
  const barCounts = anosVisiveis.map(_contarBarrasAno);
  const totalBars = barCounts.reduce((acc, value) => acc + value, 0);
  const innerGaps = barCounts.reduce((acc, value) => acc + Math.max(0, value - 1), 0);

  const sidePad = yearCount <= 3 ? 8 : 22;
  const groupPad = yearCount === 1 ? 22 : yearCount <= 3 ? 14 : 16;
  const minBar = yearCount <= 3 ? 4 : 26;
  const maxBar = yearCount === 1 ? 72 : yearCount === 2 ? 58 : yearCount === 3 ? 46 : 40;
  const gapRatio = yearCount <= 3 ? 0.28 : 0.34;
  const minGap = yearCount <= 3 ? 4 : 8;
  const maxGap = yearCount <= 3 ? 14 : 16;

  const contentAvailable = Math.max(180, available - (sidePad * 2));
  const fixedWidth = groupPad * 2 * yearCount;
  const denominator = totalBars + (innerGaps * gapRatio);
  let barW = denominator > 0
    ? (contentAvailable - fixedWidth) / denominator
    : maxBar;

  if (yearCount <= 3) {
    barW = _clamp(barW, minBar, maxBar);
  } else {
    barW = _clamp(barW, minBar, maxBar);
  }

  let gap = _clamp(barW * gapRatio, minGap, maxGap);
  let groupsWidth = Math.ceil(fixedWidth + (barW * totalBars) + (gap * innerGaps));

  if (yearCount <= 3) {
    const spare = contentAvailable - groupsWidth;

    if (spare > 0 && innerGaps > 0) {
      gap += spare / innerGaps;
      groupsWidth = contentAvailable;
    } else if (spare > 0 && totalBars > 0) {
      barW += spare / totalBars;
      groupsWidth = contentAvailable;
    } else if (spare < 0 && totalBars > 0) {
      barW = Math.max(
        minBar,
        (contentAvailable - fixedWidth - (gap * innerGaps)) / totalBars
      );
      groupsWidth = Math.ceil(fixedWidth + (barW * totalBars) + (gap * innerGaps));

      if (groupsWidth > contentAvailable && innerGaps > 0) {
        gap = Math.max(
          1,
          (contentAvailable - fixedWidth - (barW * totalBars)) / innerGaps
        );
        groupsWidth = contentAvailable;
      }
    } else {
      groupsWidth = contentAvailable;
    }
  } else {
    groupsWidth = Math.max(contentAvailable, groupsWidth);
  }

  const nameSize = _clamp(barW * 0.34, 9, 14.5);
  const nameMax = _clamp(barW * 3.25, 46, yearCount <= 3 ? 130 : 112);

  return {
    available,
    anosVisiveis,
    barW,
    gap,
    groupPad,
    sidePad,
    nameSize,
    nameMax,
    chartWidth: Math.ceil(groupsWidth + (sidePad * 2)),
    scroll: yearCount > 3
  };
}

function _aplicarLayoutDashboard(todosAnos = _getTodosAnosDashboard()) {
  const chart = document.getElementById("dashboardChart");
  const wrapper = document.querySelector("#kpis-section .chart-scroll-wrapper");
  const area = document.querySelector("#kpis-section .chart-area-container");
  const layout = _calcularLayoutDashboard(todosAnos);

  if (!chart || !wrapper || !area || !layout) return null;

  chart.classList.toggle("dashboard-one-year", layout.anosVisiveis.length === 1);
  chart.style.width = `${layout.chartWidth}px`;
  chart.style.minWidth = `${layout.chartWidth}px`;
  chart.style.setProperty("--dash-bar-w", `${layout.barW}px`);
  chart.style.setProperty("--dash-bar-gap", `${layout.gap}px`);
  chart.style.setProperty("--dash-group-pad", `${layout.groupPad}px`);
  chart.style.setProperty("--dash-side-pad", `${layout.sidePad}px`);
  chart.style.setProperty("--dash-name-size", `${layout.nameSize}px`);
  chart.style.setProperty("--dash-name-max", `${layout.nameMax}px`);
  chart.style.paddingLeft = `${layout.sidePad}px`;
  chart.style.paddingRight = `${layout.sidePad}px`;
  area.style.width = `${layout.chartWidth}px`;
  area.style.minWidth = layout.scroll ? `${layout.chartWidth}px` : "100%";

  wrapper.style.overflowX = layout.scroll ? "auto" : "hidden";

  if (!layout.scroll) {
    wrapper.scrollLeft = 0;
  }

  return layout;
}

function _resetDashboardCard() {
  const card = document.querySelector(".dashboard-card");
  if (!card) return;

  card.style.transform = "";
  card.style.transformOrigin = "";
  card.style.width = "";
  card.style.height = "";
}

function _scheduleDashboardMeasure(todosAnos = _getTodosAnosDashboard(), delay = 0) {
  if (!todosAnos.length) return;

  window.setTimeout(() => {
    requestAnimationFrame(() => {
      try {
        _aplicarLayoutDashboard(todosAnos);

        requestAnimationFrame(() => {
          try {
            _aplicarLayoutDashboard(todosAnos);

            requestAnimationFrame(() => {
              try {
                _desenharTargetLines(_getAnosVisiveisOrdenados(todosAnos));
                _atualizarSeparadores(todosAnos);
              } catch (error) {
                console.error("Dashboard measure error:", error);
              } finally {
                _finalizarDashboardReady();
              }
            });
          } catch (error) {
            console.error("Dashboard layout error:", error);
            _finalizarDashboardReady();
          }
        });
      } catch (error) {
        console.error("Dashboard schedule error:", error);
        _finalizarDashboardReady();
      }
    });
  }, delay);
}

function _finalizarDashboardReady() {
  const chart = document.getElementById("dashboardChart");
  if (chart) {
    chart.classList.remove("is-entering", "is-changing");
    chart.classList.add("is-ready");
  }
}

function renderizarDashboard() {
  _resetDashboardCard();

  const chart = document.getElementById("dashboardChart");

  if (!dashboardDados || !dashboardDados.anos) {
    if (chart) {
      chart.innerHTML = '<div style="padding:40px;color:#7a8caa;font-size:15px;font-weight:600;">Unable to load dashboard data. Check your connection and try again.</div>';
    }
    return;
  }

  const anos = _getTodosAnosDashboard();

  if (dashboardAnosVisiveis.size === 0) {
    anos.forEach(ano => dashboardAnosVisiveis.add(ano));
  }

  _configurarDropdown(anos);
  _preencherDropdownOpcoes(anos);
  _atualizarLabelBtn(anos);
  _renderizarTudo(anos);
}

function resetarFiltrosDashboard() {
  const anos =
    _getTodosAnosDashboard();

  dashboardAnosVisiveis =
    new Set(anos);

  if (anos.length) {
    _preencherDropdownOpcoes(anos);
    _atualizarLabelBtn(anos);
  }
}

let _dropdownConfigurado = false;

function _configurarDropdown(anos) {
  if (_dropdownConfigurado) return;
  _dropdownConfigurado = true;

  document.querySelectorAll(".time-filter-btn").forEach(btn => {
    const novo = btn.cloneNode(true);
    btn.parentNode.replaceChild(novo, btn);

    novo.addEventListener("click", e => {
      e.stopPropagation();
      const dd = novo.parentElement.querySelector(".time-dropdown");
      document.querySelectorAll(".time-dropdown.open")
        .forEach(d => { if (d !== dd) d.classList.remove("open"); });
      dd.classList.toggle("open");
    });
  });

  document.addEventListener("click", e => {
    if (!e.target.closest(".time-filter")) {
      document.querySelectorAll(".time-dropdown.open")
        .forEach(d => d.classList.remove("open"));
    }
  });
}

function _preencherDropdownOpcoes(anos) {
  document.querySelectorAll(".time-dropdown").forEach(dd => {
    dd.innerHTML = "";

    anos.forEach(ano => {
      const checked = dashboardAnosVisiveis.has(ano);
      const item = document.createElement("div");
      item.className = "time-option";
      item.dataset.ano = ano;
      item.innerHTML = `
        <span class="time-checkbox ${checked ? "checked" : ""}">
          <i class="fa-solid fa-check" style="font-size:10px;${checked ? "" : "display:none;"}"></i>
        </span>
        <span class="time-option-label">${ano}</span>
      `;

      item.addEventListener("click", e => {
        e.stopPropagation();
        _toggleAno(ano, anos);
      });

      dd.appendChild(item);
    });
  });
}

function _capturarAnimacaoDashboard(anosSaindo = []) {
  const chart = document.getElementById("dashboardChart");
  if (!chart) return null;

  const rects = new Map();
  const exiting = [];

  chart.querySelectorAll(".year-group").forEach(grupo => {
    const ano = grupo.id.replace("year-group-", "");
    const rect = grupo.getBoundingClientRect();

    rects.set(ano, {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    });

    if (anosSaindo.includes(ano)) {
      exiting.push({
        ano,
        rect: {
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height
        },
        clone: grupo.cloneNode(true)
      });
    }
  });

  return rects.size || exiting.length
    ? { rects, exiting }
    : null;
}

function _toggleAno(ano, todosAnos = _getTodosAnosDashboard()) {
  if (dashboardAnosVisiveis.has(ano) && dashboardAnosVisiveis.size === 1) {
    return;
  }

  const removendoAno =
    dashboardAnosVisiveis.has(ano);

  const animacao =
    _capturarAnimacaoDashboard(removendoAno ? [ano] : []);

  if (dashboardAnosVisiveis.has(ano)) {
    dashboardAnosVisiveis.delete(ano);
  } else {
    dashboardAnosVisiveis.add(ano);
  }

  _preencherDropdownOpcoes(todosAnos);
  _atualizarLabelBtn(todosAnos);
  _renderizarTudo(todosAnos, animacao);
}

function _atualizarLabelBtn(anos) {
  const visiveis = _getAnosVisiveisOrdenados(anos);
  const label = visiveis.length === anos.length
    ? "Years"
    : visiveis.join(", ");

  document.querySelectorAll(".time-filter-btn").forEach(btn => {
    btn.innerHTML = `${label} <i class="fa-solid fa-chevron-down"></i>`;
  });
}

function _garantirTargetSvg() {
  const chart = document.getElementById("dashboardChart");
  if (!chart) return null;

  let svg = document.getElementById("targetSvg");

  if (!svg || svg.parentElement !== chart) {
    svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("id", "targetSvg");
    svg.classList.add("target-svg");
    chart.prepend(svg);
  }

  svg.setAttribute("width", chart.offsetWidth);
  svg.setAttribute("height", chart.offsetHeight);
  svg.setAttribute("viewBox", `0 0 ${chart.offsetWidth} ${chart.offsetHeight}`);

  return svg;
}

function _aplicarAnimacaoLayout(animacao) {
  if (!animacao) return false;

  const chart = document.getElementById("dashboardChart");
  if (!chart) return false;

  const chartRect = chart.getBoundingClientRect();

  chart.querySelectorAll(".year-group").forEach(grupo => {
    const ano = grupo.id.replace("year-group-", "");
    const anterior = animacao.rects.get(ano);
    const atual = grupo.getBoundingClientRect();

    grupo.style.transition = "none";
    grupo.style.transformOrigin = "top left";

    if (anterior) {
      const dx = anterior.left - atual.left;
      const dy = anterior.top - atual.top;
      const sx = anterior.width / Math.max(1, atual.width);
      const sy = anterior.height / Math.max(1, atual.height);

      grupo.style.transform =
        `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`;
      grupo.style.opacity = "1";
    } else {
      grupo.style.transform =
        "translateY(16px) scale(0.98)";
      grupo.style.opacity = "0";
    }
  });

  animacao.exiting.forEach(item => {
    const clone = item.clone;
    const rect = item.rect;

    clone.id = `${clone.id}-exit`;
    clone.classList.add("year-group-exit");
    clone.style.position = "absolute";
    clone.style.left = `${rect.left - chartRect.left}px`;
    clone.style.top = `${rect.top - chartRect.top}px`;
    clone.style.width = `${rect.width}px`;
    clone.style.height = `${rect.height}px`;
    clone.style.margin = "0";
    clone.style.pointerEvents = "none";
    clone.style.transformOrigin = "top left";
    clone.style.transition =
      "opacity 0.34s ease, transform 0.42s cubic-bezier(.22,1,.36,1)";

    chart.appendChild(clone);

    requestAnimationFrame(() => {
      clone.style.opacity = "0";
      clone.style.transform = "translateY(10px) scale(0.96)";
    });

    window.setTimeout(() => clone.remove(), 520);
  });

  requestAnimationFrame(() => {
    chart.querySelectorAll(".year-group:not(.year-group-exit)").forEach(grupo => {
      grupo.style.transition =
        "opacity 0.34s ease, transform 0.48s cubic-bezier(.22,1,.36,1)";
      grupo.style.transform = "";
      grupo.style.opacity = "";
    });
  });

  return true;
}

function _renderizarTudo(todosAnos = _getTodosAnosDashboard(), animacao = null) {
  const chart = document.getElementById("dashboardChart");
  if (!chart || !dashboardDados) return;

  chart.classList.remove("is-ready", "is-entering", "is-changing");
  chart.classList.add(animacao ? "is-changing" : "is-entering");
  chart.innerHTML = "";
  _garantirTargetSvg();

  const anosVisiveis = _getAnosVisiveisOrdenados(todosAnos);

  if (!anosVisiveis.length && todosAnos.length) {
    dashboardAnosVisiveis = new Set(todosAnos);
    _preencherDropdownOpcoes(todosAnos);
    _atualizarLabelBtn(todosAnos);
    _renderizarTudo(todosAnos, animacao);
    return;
  }

  anosVisiveis.forEach((ano, idx) => {
    const dadosAno = dashboardDados.anos[ano];
    if (!dadosAno) return;

    const grupo = _criarGrupoAno(ano, dadosAno, idx, anosVisiveis.length);
    chart.appendChild(grupo);
  });

  _aplicarLayoutDashboard(todosAnos);

  const animouLayout =
    _aplicarAnimacaoLayout(animacao);

  _scheduleDashboardMeasure(todosAnos, animouLayout ? 520 : 0);
}

function _criarGrupoAno(ano, dadosAno, idx, total) {
  const projetos = Array.isArray(dadosAno.projetos) ? dadosAno.projetos : [];
  const average = Number(dadosAno.average || 0);
  const bgColor = YEAR_COLORS[ano] || "#eaf0fa";

  const grupo = document.createElement("div");
  grupo.className = `year-group year-${ano}`;
  grupo.id = `year-group-${ano}`;
  grupo.style.background = bgColor;

  if (idx < total - 1) {
    grupo.dataset.hasSep = "true";
  }

  const anoLabel = document.createElement("div");
  anoLabel.className = "year-label";

  const anoText = document.createElement("span");
  anoText.className = "year-label-ano";
  anoText.textContent = ano;
  anoLabel.appendChild(anoText);

  const targetPct = Math.round((dadosAno.target || 0) * 100);
  const targetText = document.createElement("span");
  targetText.className = "year-label-target";
  targetText.textContent = `Target: ${targetPct}%`;
  anoLabel.appendChild(targetText);

  grupo.appendChild(anoLabel);

  projetos.forEach(proj => {
    grupo.appendChild(_criarBarra(proj, ano));
  });

  grupo.appendChild(_criarBarraAvg(average));

  return grupo;
}

function _criarBarra(proj, ano) {
  const auditSeq = ehAuditSequence(proj.nomeGrafico || "");
  const nomeCurto = nomeExibicao(proj.nomeGrafico || proj.nome || "");
  const nomeCompl = nomeExibicao(proj.nome || proj.nomeGrafico || "");
  const pct = scorePct(Number(proj.score || 0));
  const alturaPx = Math.max(20, Math.round((pct / 100) * BAR_HEIGHT_MAX));

  const wrap = document.createElement("div");
  wrap.className = "bar-wrap";

  const scoreLabel = document.createElement("span");
  scoreLabel.className = "score-label";
  scoreLabel.textContent = `${pct}%`;

  const barra = document.createElement("div");
  barra.className = "project-bar";
  barra.dataset.id = proj.id || "";
  barra.dataset.ano = ano;
  barra.style.height = `${alturaPx}px`;
  barra.style.background = corBarra(proj.score);
  barra.style.boxShadow = "none";

  const gateWrap = document.createElement("span");
  gateWrap.className = "gate-wrap";

  const gateLabel = document.createElement("span");
  gateLabel.className = "gate-label";
  gateLabel.textContent = proj.gate || "";

  gateWrap.appendChild(gateLabel);
  barra.appendChild(gateWrap);

  const nameWrap = document.createElement("div");
  nameWrap.className = "project-name-wrap";

  const nameEl = document.createElement("span");
  nameEl.className = "project-name";
  nameEl.dataset.curto = nomeCurto;
  nameEl.dataset.completo = nomeCompl;
  nameEl.textContent = nomeCurto;
  nameEl.title = nomeCompl;

  nameWrap.appendChild(nameEl);

  if (auditSeq) {
    const seqBadge = document.createElement("span");
    seqBadge.className = "audit-seq-badge";
    seqBadge.title = "Audit Sequence";
    seqBadge.textContent = "\u27F2";
    nameWrap.appendChild(seqBadge);
  }

  wrap.appendChild(scoreLabel);
  wrap.appendChild(barra);
  wrap.appendChild(nameWrap);

  barra.addEventListener("mouseenter", () => {
    wrap.classList.add("is-hovered");
    nameEl.textContent = nomeCompl;
    nameEl.style.fontWeight = "800";
    nameEl.style.color = "#0a2a6e";
    barra.style.transform = "translateY(-6px)";
    barra.style.zIndex = "10";
  });

  barra.addEventListener("mouseleave", () => {
    wrap.classList.remove("is-hovered");
    nameEl.textContent = nomeCurto;
    nameEl.style.fontWeight = "";
    nameEl.style.color = "";
    barra.style.transform = "";
    barra.style.zIndex = "";
  });

  barra.addEventListener("click", () => {
    abrirAuditoria(proj.id, nomeCompl, ano, {
      auditSequence: auditSeq,
      dashboardId: proj.id,
      dashboardName: nomeCompl,
      dashboardChartName: nomeCurto,
      gate: proj.gate,
      score: proj.score
    });
  });

  return wrap;
}

function _criarBarraAvg(average) {
  const pct = scorePct(Number(average || 0));
  const altura = Math.max(20, Math.round((pct / 100) * BAR_HEIGHT_MAX));

  const wrap = document.createElement("div");
  wrap.className = "bar-wrap";

  const scoreLabel = document.createElement("span");
  scoreLabel.className = "score-label";
  scoreLabel.textContent = `${pct}%`;

  const barra = document.createElement("div");
  barra.className = "project-bar avg-bar";
  barra.style.height = `${altura}px`;

  const avgLabel = document.createElement("span");
  avgLabel.className = "avg-label";
  avgLabel.textContent = "AVG";
  barra.appendChild(avgLabel);

  const nameWrap = document.createElement("div");
  nameWrap.className = "project-name-wrap";

  const nameEl = document.createElement("span");
  nameEl.className = "project-name avg-name";
  nameEl.textContent = "Annual Average";
  nameEl.title = "Annual Average";
  nameWrap.appendChild(nameEl);

  wrap.appendChild(scoreLabel);
  wrap.appendChild(barra);
  wrap.appendChild(nameWrap);

  return wrap;
}

function _atualizarSeparadores(todosAnos = _getTodosAnosDashboard()) {
  const anosVisiveis = _getAnosVisiveisOrdenados(todosAnos);

  anosVisiveis.forEach((ano, idx) => {
    const g = document.getElementById(`year-group-${ano}`);
    if (!g) return;

    if (idx < anosVisiveis.length - 1) {
      g.dataset.hasSep = "true";
    } else {
      delete g.dataset.hasSep;
    }
  });
}

function _desenharTargetLines(anosVisiveis = _getAnosVisiveisOrdenados()) {
  const chart = document.getElementById("dashboardChart");
  const svg = _garantirTargetSvg();

  if (!chart || !svg || !dashboardDados || !dashboardDados.anos) return;

  svg.innerHTML = "";

  const chartRect = chart.getBoundingClientRect();
  const targetColor = "#ca221f";
  const suavizacao = 14;
  const bars = Array.from(chart.querySelectorAll(".project-bar"));
  const baselineY = bars.length
    ? Math.max(...bars.map(bar => bar.getBoundingClientRect().bottom - chartRect.top))
    : (parseFloat(getComputedStyle(chart).paddingTop) || 76) + BAR_HEIGHT_MAX;
  const plotHeight = BAR_HEIGHT_MAX;

  const pontos = anosVisiveis
    .filter(ano => dashboardDados.anos[ano])
    .map(ano => {
      const dadosAno = dashboardDados.anos[ano];
      const grupo = document.getElementById(`year-group-${ano}`);
      if (!grupo) return null;

      const target = _clamp(Number(dadosAno.target || 0), 0, 1);
      const grupoRect = grupo.getBoundingClientRect();

      return {
        ano,
        x1: grupoRect.left - chartRect.left,
        x2: grupoRect.right - chartRect.left,
        y: baselineY - (target * plotHeight)
      };
    })
    .filter(Boolean);

  pontos.forEach((atual, i) => {
    const proximo = pontos[i + 1];
    const anterior = pontos[i - 1];
    const temMudanca = proximo && Math.abs(atual.y - proximo.y) > 1;

    let xStart = atual.x1;
    let xEnd = atual.x2;

    if (temMudanca) xEnd = atual.x2 - suavizacao;
    if (anterior && Math.abs(anterior.y - atual.y) > 1) xStart = atual.x1 + suavizacao;

    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", xStart);
    line.setAttribute("y1", atual.y);
    line.setAttribute("x2", xEnd);
    line.setAttribute("y2", atual.y);
    line.setAttribute("stroke", targetColor);
    line.setAttribute("stroke-width", "3");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("opacity", "0.95");
    svg.appendChild(line);

    if (temMudanca) {
      const diagonal = document.createElementNS("http://www.w3.org/2000/svg", "line");
      diagonal.setAttribute("x1", atual.x2 - suavizacao);
      diagonal.setAttribute("y1", atual.y);
      diagonal.setAttribute("x2", proximo.x1 + suavizacao);
      diagonal.setAttribute("y2", proximo.y);
      diagonal.setAttribute("stroke", targetColor);
      diagonal.setAttribute("stroke-width", "3");
      diagonal.setAttribute("stroke-linecap", "round");
      diagonal.setAttribute("opacity", "0.9");
      svg.appendChild(diagonal);
    }
  });
}

function recalcularDashboard() {
  const anos = _getTodosAnosDashboard();
  if (!anos.length) return;

  _resetDashboardCard();
  _aplicarLayoutDashboard(anos);
  _scheduleDashboardMeasure(anos);
}

let _dashboardResizeTimer = null;

window.addEventListener("resize", () => {
  if (!document.getElementById("kpis-section")?.classList.contains("active-section")) {
    return;
  }

  window.clearTimeout(_dashboardResizeTimer);
  _dashboardResizeTimer = window.setTimeout(recalcularDashboard, 80);
});
