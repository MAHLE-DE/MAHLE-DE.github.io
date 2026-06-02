/* ==============================================
   AUDITS - BASE STRUCTURE
============================================== */

const auditState = {
  loaded: false,
  loading: false,
  error: null,
  raw: null,
  byProjectId: new Map()
};

const auditDetailState = {
  projectId: null,
  visibleGatesByProject: new Map()
};

const AUDIT_SEQUENCE_SYMBOL = "\u27F2";
const AUDIT_GATE_ORDER = ["MS0", "MS1", "QG2", "QG3"];
const AUDIT_STATUS = {
  1: { label: "Schedule in advance", className: "status-advance" },
  2: { label: "Schedule at maturity", className: "status-maturity" },
  3: { label: "Schedule overdue", className: "status-overdue" },
  4: { label: "N/A", className: "status-na" }
};

function normalizarAuditProjectId(id) {
  return String(id || "")
    .trim()
    .toLowerCase()
    .replace(/[{}\[\]]/g, "")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
}

function _normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[{}\[\]]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function _escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function _formatAuditDate(value) {
  if (!value) return "Not defined";
  const text = String(value);
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function _formatAuditDateTime(value) {
  if (!value) return "Not defined";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function _formatAuditPercent(value) {
  if (value === null || value === undefined || value === "") return "N/A";
  const numeric = Math.max(0, Math.min(1, Number(value)));
  if (Number.isNaN(numeric)) return "N/A";
  return `${Math.round(numeric * 100)}%`;
}

function _auditScoreColor(score) {
  const numeric = Math.max(0, Math.min(1, Number(score || 0)));
  const hue = numeric * 120;
  return `hsl(${hue}, 76%, 43%)`;
}

function _parseAuditJsonString(jsonCompleto) {
  if (!jsonCompleto) return null;

  if (typeof jsonCompleto !== "string") {
    return jsonCompleto;
  }

  try {
    return JSON.parse(jsonCompleto);
  } catch (erroOriginal) {
    try {
      return JSON.parse(jsonCompleto.replace(/'/g, '"'));
    } catch (erroCorrigido) {
      throw erroOriginal;
    }
  }
}

function _extrairAuditsLista(raw) {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw;
  }

  if (Array.isArray(raw.projects)) {
    return raw.projects;
  }

  if (Array.isArray(raw.audits)) {
    return raw.audits;
  }

  if (Array.isArray(raw.projetos)) {
    return raw.projetos;
  }

  if (raw.projects && typeof raw.projects === "object") {
    return Object.entries(raw.projects).map(([id, value]) => ({
      id,
      ...value
    }));
  }

  if (raw.projetos && typeof raw.projetos === "object") {
    return Object.entries(raw.projetos).map(([id, value]) => ({
      id,
      ...value
    }));
  }

  if (raw.audits && typeof raw.audits === "object") {
    return Object.entries(raw.audits).map(([id, value]) => ({
      id,
      ...value
    }));
  }

  return Object.entries(raw)
    .filter(([, value]) => value && typeof value === "object")
    .map(([id, value]) => ({
      id,
      ...value
    }));
}

function _indexarAudits(raw) {
  const mapa = new Map();

  _extrairAuditsLista(raw).forEach(item => {
    const canonicalId =
      normalizarAuditProjectId(
        item.id ||
        item.projectId ||
        item.projetoId ||
        item.dashboardId
      );

    if (!canonicalId) return;

    mapa.set(canonicalId, {
      ...item,
      canonicalId
    });
  });

  return mapa;
}

function carregarAudits() {
  if (auditState.loaded || auditState.loading) {
    return Promise.resolve(auditState);
  }

  auditState.loading = true;
  auditState.error = null;

  return firebase.firestore()
    .collection("audits")
    .doc("audits")
    .get()
    .then(doc => {
      auditState.loading = false;
      auditState.loaded = true;

      if (!doc.exists) {
        auditState.raw = null;
        auditState.byProjectId = new Map();
        return auditState;
      }

      const item = doc.data();
      auditState.raw = _parseAuditJsonString(item.jsonCompleto);
      auditState.byProjectId = _indexarAudits(auditState.raw);

      return auditState;
    })
    .catch(error => {
      auditState.loading = false;
      auditState.loaded = true;
      auditState.error = error;
      auditState.raw = null;
      auditState.byProjectId = new Map();
      console.error("Audits load error:", error);
      return auditState;
    });
}

function _getDashboardProjetosUnicos() {
  if (!dashboardDados || !dashboardDados.anos) return [];

  const projetos = new Map();

  Object.entries(dashboardDados.anos).forEach(([ano, dadosAno]) => {
    (dadosAno.projetos || []).forEach(proj => {
      const canonicalId = normalizarAuditProjectId(proj.id);
      if (!canonicalId) return;

      const existente = projetos.get(canonicalId);
      const ocorrencia = {
        ano,
        idOriginal: proj.id,
        gate: proj.gate,
        score: proj.score,
        auditSequence: ehAuditSequence(proj.nomeGrafico || proj.nome || "")
      };

      if (existente) {
        existente.ocorrencias.push(ocorrencia);
        return;
      }

      projetos.set(canonicalId, {
        canonicalId,
        nome: nomeExibicao(proj.nome || proj.nomeGrafico || canonicalId),
        nomeGrafico: nomeExibicao(proj.nomeGrafico || proj.nome || canonicalId),
        ocorrencias: [ocorrencia]
      });
    });
  });

  return [...projetos.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function _getAuditRecord(canonicalId) {
  return auditState.byProjectId.get(canonicalId) || null;
}

function _renderAuditStatusCard() {
  if (auditState.loading) {
    return `
      <div class="audit-status-card">
        <i class="fa-solid fa-spinner"></i>
        <strong>Loading audit database</strong>
        <span>Reading audits/audits from Firestore.</span>
      </div>
    `;
  }

  if (auditState.error) {
    return `
      <div class="audit-status-card audit-status-warning">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <strong>Audit database unavailable</strong>
        <span>The Audits workspace is ready, but the Firestore document could not be loaded.</span>
      </div>
    `;
  }

  if (!auditState.raw) {
    return `
      <div class="audit-status-card">
        <i class="fa-solid fa-database"></i>
        <strong>Waiting for audit JSON</strong>
        <span>Create audits/audits with jsonCompleto using the projects array.</span>
      </div>
    `;
  }

  return `
    <div class="audit-status-card audit-status-ok">
      <i class="fa-solid fa-circle-check"></i>
      <strong>Audit database loaded</strong>
      <span>${auditState.byProjectId.size} project audit record(s) indexed by project ID.</span>
    </div>
  `;
}

function renderAuditsHome() {
  const sec = document.getElementById("auditorias-section");
  if (!sec) return;

  const projetos = _getDashboardProjetosUnicos();

  sec.innerHTML = `
    <div class="audits-shell">
      <div class="audits-home-header">
        <div>
          <h2>Audits</h2>
          <p>Project-specific audit pages linked to Dashboard project IDs.</p>
        </div>
        <button class="audit-refresh-btn" id="auditRefreshBtn" type="button">
          <i class="fa-solid fa-rotate-right"></i>
          Refresh data
        </button>
      </div>

      <div class="audit-status-grid">
        ${_renderAuditStatusCard()}
        <div class="audit-status-card">
          <i class="fa-solid fa-link"></i>
          <strong>Audit Sequence mapping</strong>
          <span>Repeated dashboard bars use a normalized project ID and open the same audit page.</span>
        </div>
      </div>

      <div class="audit-index-panel">
        <div class="audit-index-header">
          <div>
            <h3>Projects ready for audit pages</h3>
            <span>${projetos.length} linked project(s)</span>
          </div>
          <label class="audit-index-search">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input
              id="auditProjectSearch"
              type="search"
              placeholder="Search audit project..."
              autocomplete="off"
            >
          </label>
        </div>
        <div class="audit-project-list">
          ${projetos.length ? projetos.map(_renderAuditProjectRow).join("") : _renderAuditEmptyState()}
          <div class="audit-empty-state audit-search-empty" id="auditSearchEmpty">
            <i class="fa-solid fa-magnifying-glass"></i>
            <strong>No audit project found</strong>
            <span>Try another project name, ID or year.</span>
          </div>
        </div>
      </div>
    </div>
  `;

  sec.querySelectorAll(".audit-project-row").forEach(row => {
    row.addEventListener("click", () => {
      abrirAuditoria(
        row.dataset.auditId,
        row.dataset.auditName,
        row.dataset.auditYears,
        {
          canonicalId: row.dataset.auditId,
          auditSequence: row.dataset.auditSequence === "true"
        }
      );
    });
  });

  const refreshBtn = document.getElementById("auditRefreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      auditState.loaded = false;
      auditState.loading = false;
      carregarAudits().then(renderAuditsHome);
      renderAuditsHome();
    });
  }

  const searchInput = document.getElementById("auditProjectSearch");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      _filtrarAuditProjectRows(searchInput.value);
    });
  }
}

function _filtrarAuditProjectRows(searchValue) {
  const term = _normalizeText(searchValue);
  const rows = [...document.querySelectorAll(".audit-project-row")];
  const empty = document.getElementById("auditSearchEmpty");
  let visibleCount = 0;

  rows.forEach(row => {
    const haystack = _normalizeText([
      row.dataset.auditName,
      row.dataset.auditId,
      row.dataset.auditYears,
      row.textContent
    ].join(" "));
    const visible = !term || haystack.includes(term);
    row.hidden = !visible;
    if (visible) visibleCount += 1;
  });

  if (empty) {
    empty.classList.toggle("show", rows.length > 0 && visibleCount === 0);
  }
}

function _renderAuditProjectRow(projeto) {
  const audit = _getAuditRecord(projeto.canonicalId);
  const anos = [...new Set(projeto.ocorrencias.map(item => item.ano))].sort();
  const sequencias = projeto.ocorrencias.filter(item => item.auditSequence).length;

  return `
    <button
      class="audit-project-row"
      type="button"
      data-audit-id="${_escapeHtml(projeto.canonicalId)}"
      data-audit-name="${_escapeHtml(projeto.nome)}"
      data-audit-years="${_escapeHtml(anos.join(", "))}"
      data-audit-sequence="${sequencias ? "true" : "false"}"
    >
      <span class="audit-project-main">
        <strong>${_escapeHtml(projeto.nome)}</strong>
        <small>${_escapeHtml(projeto.canonicalId)}</small>
      </span>
      <span class="audit-project-meta">
        <span>${_escapeHtml(anos.join(", "))}</span>
        ${sequencias ? `<span class="audit-sequence-pill">${AUDIT_SEQUENCE_SYMBOL} ${sequencias}</span>` : ""}
        <span class="${audit ? "audit-data-pill ok" : "audit-data-pill"}">
          ${audit ? "Data ready" : "Pending JSON"}
        </span>
      </span>
    </button>
  `;
}

function _renderAuditEmptyState() {
  return `
    <div class="audit-empty-state">
      <i class="fa-solid fa-chart-column"></i>
      <strong>No dashboard data loaded yet</strong>
      <span>Open KPIs first or click a Dashboard bar to create a project audit route.</span>
    </div>
  `;
}

/* ==============================================
   NAVEGAR PARA AUDITORIA
============================================== */
function abrirAuditoria(projetoId, projetoNome, ano, meta = {}) {
  const canonicalId =
    meta.canonicalId ||
    normalizarAuditProjectId(projetoId);

  const menuItems = document.querySelectorAll(".menu-item");
  menuItems.forEach(btn => btn.classList.remove("active"));

  const btnAudit = [...menuItems].find(btn => btn.dataset.section === "auditorias");
  if (btnAudit) btnAudit.classList.add("active");

  document.querySelectorAll(".page-section")
    .forEach(sec => sec.classList.remove("active-section"));

  const secAudit = document.getElementById("auditorias-section");
  if (secAudit) secAudit.classList.add("active-section");

  const title = document.getElementById("section-title");
  if (title) title.textContent = "Audits";

  carregarAudits()
    .then(() => _carregarAuditoriaDetalhe({
      canonicalId,
      originalId: projetoId,
      nome: projetoNome,
      ano,
      meta
    }));

  _carregarAuditoriaDetalhe({
    canonicalId,
    originalId: projetoId,
    nome: projetoNome,
    ano,
    meta,
    loading: true
  });
}

function _carregarAuditoriaDetalhe(contexto) {
  const sec = document.getElementById("auditorias-section");
  if (!sec) return;

  const audit = contexto.loading
    ? null
    : _getAuditRecord(contexto.canonicalId);

  const project = _normalizarAuditDetalhe(audit, contexto);
  const isSequence =
    normalizarAuditProjectId(contexto.originalId) !== contexto.canonicalId ||
    contexto.meta.auditSequence;

  const selectedGates = auditDetailState.visibleGatesByProject.get(project.canonicalId);
  if (
    project.gatesAvailable.length &&
    (!selectedGates || selectedGates.size === 0)
  ) {
    auditDetailState.visibleGatesByProject.set(
      project.canonicalId,
      new Set(project.gatesAvailable)
    );
  }

  sec.innerHTML = `
    <div class="audits-shell audit-detail-shell">
      <button class="auditoria-back-btn" id="auditoriaBackBtn" type="button">
        <i class="fa-solid fa-arrow-left"></i> Back to audits
      </button>

      ${_renderProjectAuditBlock(project, contexto, isSequence)}
      ${_renderAuditOverview(project, contexto.loading)}
      ${_renderAuditInfoPanel(project)}
    </div>
  `;

  const backBtn = document.getElementById("auditoriaBackBtn");
  if (backBtn) {
    backBtn.addEventListener("click", voltarAuditorias);
  }

  _attachAuditDetailEvents(project, contexto);
}

function _normalizarAuditDetalhe(audit, contexto) {
  const canonicalId = contexto.canonicalId;
  const documents = Array.isArray(audit?.documents)
    ? audit.documents.map((doc, index) => ({
        id: doc.id || `doc-${index + 1}`,
        order: Number(doc.order || index + 1),
        gate: String(doc.gate || "Other"),
        name: doc.name || doc.nome || `Document ${index + 1}`,
        shortName: doc.shortName || doc.name || doc.nome || `Doc ${index + 1}`,
        score: doc.status === 4 ? 1 : doc.score,
        rawScore: doc.score,
        status: Number(doc.status || 4)
      }))
    : [];

  const gatesAvailable = _ordenarAuditGates(
    [...new Set(documents.map(doc => doc.gate))]
  );

  return {
    canonicalId,
    id: audit?.id || canonicalId,
    projectName: audit?.projectName || contexto.nome || canonicalId,
    lastUpdate: audit?.lastUpdate || auditState.raw?.lastGlobalUpdate,
    completionDate: audit?.completionDate,
    developmentEngineer: audit?.developmentEngineer || {},
    projectScore: audit?.projectScore,
    gates: audit?.gates || {},
    productImage: audit?.productImage || {},
    documents,
    gatesAvailable,
    importantInfo:
      audit?.importantInfo ||
      audit?.generalInfo ||
      audit?.auditInfo ||
      audit?.naJustifications ||
      audit?.specialCharacteristics ||
      null,
    audit
  };
}

function _ordenarAuditGates(gates) {
  return gates
    .filter(Boolean)
    .sort((a, b) => {
      const ia = AUDIT_GATE_ORDER.indexOf(String(a).toUpperCase());
      const ib = AUDIT_GATE_ORDER.indexOf(String(b).toUpperCase());
      if (ia >= 0 && ib >= 0) return ia - ib;
      if (ia >= 0) return -1;
      if (ib >= 0) return 1;
      return String(a).localeCompare(String(b), "pt-BR");
    });
}

function _renderProjectAuditBlock(project, contexto, isSequence) {
  const scoreText = _formatAuditPercent(project.projectScore);
  const scoreColor = _auditScoreColor(project.projectScore);

  return `
    <section class="project-audit-card">
      <div class="project-audit-left">
        <span class="audit-eyebrow">Project Audit</span>
        <h2>${_escapeHtml(project.projectName)}</h2>
        <div class="audit-detail-meta">
          <span>ID: ${_escapeHtml(project.canonicalId)}</span>
          ${isSequence ? `<span class="audit-sequence-pill">${AUDIT_SEQUENCE_SYMBOL} Audit Sequence route</span>` : ""}
          ${project.completionDate ? `<span class="audit-completed-pill"><i class="fa-solid fa-circle-check"></i> Completed: ${_escapeHtml(_formatAuditDate(project.completionDate))}</span>` : ""}
          ${contexto.loading ? `<span class="audit-data-pill">Loading...</span>` : project.audit ? `<span class="audit-data-pill ok">Audit data ready</span>` : `<span class="audit-data-pill">Pending JSON</span>`}
        </div>
        <dl class="audit-project-facts">
          <div>
            <dt>Last update</dt>
            <dd>${_escapeHtml(_formatAuditDateTime(project.lastUpdate))}</dd>
          </div>
        </dl>
      </div>

      <div class="project-audit-right">
        <div class="audit-general-data">
          ${_renderAuditFact("Responsible", project.developmentEngineer.name || "Not defined")}
          ${_renderAuditFact("Actual Gate", project.gates.current || "Not defined")}
          ${_renderAuditFact("Next Gate", project.gates.next || "Not defined")}
          ${_renderAuditFact("Next Gate date", _formatAuditDate(project.gates.nextGateDate))}
        </div>
        <div class="audit-score-tile" style="background:${scoreColor}">
          <span>Project Score</span>
          <strong>${_escapeHtml(scoreText)}</strong>
        </div>
        ${_renderProductImage(project)}
      </div>
    </section>
  `;
}

function _renderAuditFact(label, value) {
  return `
    <div class="audit-fact">
      <span>${_escapeHtml(label)}</span>
      <strong>${_escapeHtml(value)}</strong>
    </div>
  `;
}

function _getProductImageSource(project) {
  const image = project.productImage || {};
  return image.url || image.assetPath || image.src || image.localPath || "";
}

function _renderProductImage(project) {
  const src = _getProductImageSource(project);
  const alt = project.productImage?.alt || `${project.projectName} product image`;

  if (!src) {
    return `
      <div class="audit-product-image audit-product-placeholder">
        <i class="fa-regular fa-image"></i>
        <span>Product image</span>
      </div>
    `;
  }

  return `
    <figure class="audit-product-image">
      <img src="${_escapeHtml(src)}" alt="${_escapeHtml(alt)}">
    </figure>
  `;
}

function _renderAuditOverview(project, loading) {
  const selected = auditDetailState.visibleGatesByProject.get(project.canonicalId) || new Set(project.gatesAvailable);
  const visibleGates = project.gatesAvailable.filter(gate => selected.has(gate));
  const visibleDocs = project.documents.filter(doc => selected.has(doc.gate));

  return `
    <section class="audit-overview-card">
      <div class="audit-overview-header">
        <div>
          <h3>Overview</h3>
          <p>Document scores grouped by audited gate.</p>
        </div>
        <div class="audit-gate-filter">
          <button class="audit-gate-filter-btn" id="auditGateFilterBtn" type="button">
            Gates
            <i class="fa-solid fa-chevron-down"></i>
          </button>
          <div class="audit-gate-dropdown" id="auditGateDropdown">
            ${project.gatesAvailable.map(gate => `
              <label>
                <input
                  type="checkbox"
                  value="${_escapeHtml(gate)}"
                  ${selected.has(gate) ? "checked" : ""}
                >
                <span>${_escapeHtml(gate)}</span>
              </label>
            `).join("")}
          </div>
        </div>
      </div>

      <div class="audit-doc-legend">
        <div><span class="audit-bar-legend"></span> Document score</div>
        ${Object.entries(AUDIT_STATUS).map(([status, config]) => `
          <div><span class="audit-doc-status-diamond ${config.className}"></span> ${_escapeHtml(config.label)}</div>
        `).join("")}
      </div>

      <div class="audit-doc-scroll">
        <div
          class="audit-doc-chart ${loading ? "is-loading" : ""}"
          id="auditDocChart"
          style="${_getAuditChartSizing(visibleDocs, visibleGates)}"
        >
          ${loading ? "" : _renderAuditYAxis()}
          ${loading ? _renderAuditChartEmpty("Loading audit data...") : _renderAuditGateGroups(project, visibleGates)}
        </div>
      </div>
    </section>
  `;
}

function _renderAuditYAxis() {
  return `
    <div class="audit-doc-y-axis" aria-hidden="true">
      <span>100%</span>
      <span>75%</span>
      <span>50%</span>
      <span>25%</span>
      <span>0%</span>
    </div>
  `;
}

function _getAuditChartSizing(docs, gates) {
  const docCount = Math.max(1, docs.length);
  const gateCount = Math.max(1, gates.length);
  const minWidth = Math.max(760, (docCount * 58) + (gateCount * 90));
  return `--audit-doc-min-width:${minWidth}px;`;
}

function _renderAuditGateGroups(project, visibleGates) {
  if (!project.documents.length) {
    return _renderAuditChartEmpty("Waiting for audit documents in jsonCompleto.");
  }

  if (!visibleGates.length) {
    return _renderAuditChartEmpty("Select at least one gate.");
  }

  return visibleGates.map((gate, index) => {
    const docs = project.documents
      .filter(doc => doc.gate === gate)
      .sort((a, b) => a.order - b.order);

    return `
      <div class="audit-gate-group audit-gate-tone-${index % 4}" data-gate="${_escapeHtml(gate)}">
        <div class="audit-gate-bars">
          ${docs.map(doc => _renderAuditDocumentBar(doc, project)).join("")}
        </div>
        <div class="audit-doc-gate-label">${_escapeHtml(gate)}</div>
      </div>
    `;
  }).join("");
}

function _renderAuditDocumentBar(doc, project) {
  const status = AUDIT_STATUS[doc.status] || AUDIT_STATUS[4];
  const effectiveScore = doc.status === 4
    ? 1
    : Math.max(0, Math.min(1, Number(doc.score || 0)));
  const height = Math.max(18, Math.round(effectiveScore * 360));

  return `
    <button
      class="audit-doc-bar-wrap"
      type="button"
      data-project-id="${_escapeHtml(project.canonicalId)}"
      data-project-name="${_escapeHtml(project.projectName)}"
      data-doc-id="${_escapeHtml(doc.id)}"
      title="${_escapeHtml(doc.name)}"
    >
      <span class="audit-doc-bar" style="height:${height}px;">
        <span class="audit-doc-status-diamond ${status.className}" aria-label="${_escapeHtml(status.label)}"></span>
      </span>
      <span class="audit-doc-name-wrap">
        <span class="audit-doc-name">${_escapeHtml(doc.shortName)}</span>
      </span>
    </button>
  `;
}

function _renderAuditChartEmpty(text) {
  return `
    <div class="audit-chart-empty">
      <i class="fa-solid fa-chart-column"></i>
      <span>${_escapeHtml(text)}</span>
    </div>
  `;
}

function _renderAuditInfoPanel(project) {
  return `
    <section class="audit-info-card">
      <div class="audit-info-header">
        <div>
          <h3>Audit Information</h3>
          <p>General notes, N/A justifications, dates and special audit characteristics.</p>
        </div>
      </div>
      <div class="audit-info-content">
        ${_renderAuditInfoContent(project.importantInfo)}
      </div>
    </section>
  `;
}

function _renderAuditInfoContent(info) {
  if (!info) {
    return `
      <div class="audit-info-placeholder">
        <div>
          <strong>N/A justifications</strong>
          <span>Documents marked as N/A can be explained here.</span>
        </div>
        <div>
          <strong>Important dates</strong>
          <span>Future JSON fields can expose audit milestones and relevant deadlines.</span>
        </div>
        <div>
          <strong>Special characteristics</strong>
          <span>Use this area for product or audit context that should stay visible.</span>
        </div>
      </div>
    `;
  }

  if (Array.isArray(info)) {
    return `
      <ul class="audit-info-list">
        ${info.map(item => `<li>${_escapeHtml(typeof item === "object" ? JSON.stringify(item) : item)}</li>`).join("")}
      </ul>
    `;
  }

  if (typeof info === "object") {
    return `
      <dl class="audit-info-dl">
        ${Object.entries(info).map(([key, value]) => `
          <div>
            <dt>${_escapeHtml(key)}</dt>
            <dd>${_escapeHtml(typeof value === "object" ? JSON.stringify(value) : value)}</dd>
          </div>
        `).join("")}
      </dl>
    `;
  }

  return `<p>${_escapeHtml(info)}</p>`;
}

function _attachAuditDetailEvents(project, contexto) {
  const filterBtn = document.getElementById("auditGateFilterBtn");
  const dropdown = document.getElementById("auditGateDropdown");

  if (filterBtn && dropdown) {
    filterBtn.addEventListener("click", () => {
      dropdown.classList.toggle("open");
    });

    dropdown.querySelectorAll("input[type='checkbox']").forEach(input => {
      input.addEventListener("change", () => {
        _toggleAuditGate(project.canonicalId, input.value, project.gatesAvailable);
        _animarAuditOverviewRerender(contexto);
      });
    });

    document.removeEventListener("click", _fecharAuditGateDropdown);
    document.addEventListener("click", _fecharAuditGateDropdown);
  }

  document.querySelectorAll(".audit-doc-bar-wrap").forEach(bar => {
    bar.addEventListener("click", () => {
      abrirBacklogsDoProjeto(project);
    });
  });
}

function _fecharAuditGateDropdown(event) {
  if (!event.target.closest(".audit-gate-filter")) {
    const dropdown = document.getElementById("auditGateDropdown");
    if (dropdown) dropdown.classList.remove("open");
  }
}

function _toggleAuditGate(projectId, gate, gatesAvailable) {
  const current = auditDetailState.visibleGatesByProject.get(projectId) || new Set(gatesAvailable);

  if (current.has(gate) && current.size === 1) {
    return;
  }

  if (current.has(gate)) {
    current.delete(gate);
  } else {
    current.add(gate);
  }

  auditDetailState.visibleGatesByProject.set(projectId, current);
}

function _animarAuditOverviewRerender(contexto) {
  const chart = document.getElementById("auditDocChart");
  if (chart) {
    chart.classList.add("audit-doc-chart-exit");
  }

  window.setTimeout(() => {
    _carregarAuditoriaDetalhe(contexto);
    const nextChart = document.getElementById("auditDocChart");
    if (nextChart) {
      nextChart.classList.add("audit-doc-chart-enter");
      window.setTimeout(() => {
        nextChart.classList.remove("audit-doc-chart-enter");
      }, 380);
    }
  }, 170);
}

function abrirBacklogsDoProjeto(project) {
  const projectName = project.audit?.backlogProjectName || project.projectName;
  const aliases = [
    projectName,
    project.projectName,
    project.audit?.dashboardName,
    ...(Array.isArray(project.audit?.aliases) ? project.audit.aliases : [])
  ].filter(Boolean);
  const responsible = project.developmentEngineer?.name || "";
  const fallback = _encontrarProjetoBacklog(aliases, responsible);
  const deFinal = fallback.de || responsible;
  const nomeFinal = fallback.projectName || projectName;

  document.querySelectorAll(".menu-item").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.section === "pendencias");
  });

  document.querySelectorAll(".page-section")
    .forEach(sec => sec.classList.remove("active-section"));

  const pendencias = document.getElementById("pendencias-section");
  if (pendencias) pendencias.classList.add("active-section");

  const title = document.getElementById("section-title");
  if (title) title.textContent = "Project Backlogs";

  const select = document.getElementById("lista");
  const search = document.getElementById("searchProjeto");

  if (select && deFinal) {
    const option = [...select.options].find(item =>
      _normalizeText(item.value) === _normalizeText(deFinal)
    );
    if (option) select.value = option.value;
  }

  if (search) {
    search.value = nomeFinal;
  }

  if (typeof renderizarProjetos === "function") {
    renderizarProjetos();
  }
}

function _encontrarProjetoBacklog(projectNames, responsible) {
  if (!dados || typeof dados !== "object") return {};

  const targetNames = (Array.isArray(projectNames) ? projectNames : [projectNames])
    .map(_normalizeText)
    .filter(Boolean);
  const targetResponsible = _normalizeText(responsible);
  const candidates = [];

  Object.entries(dados).forEach(([de, group]) => {
    Object.keys(group.projetos || {}).forEach(nomeProjeto => {
      const name = _normalizeText(nomeProjeto);
      const deScore = targetResponsible && _normalizeText(de) === targetResponsible ? 2 : 0;
      const exactScore = targetNames.some(targetName => name === targetName) ? 4 : 0;
      const containsScore = targetNames.some(targetName =>
        name.includes(targetName) || targetName.includes(name)
      ) ? 1 : 0;

      candidates.push({
        de,
        projectName: nomeProjeto,
        score: deScore + exactScore + containsScore
      });
    });
  });

  return candidates
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)[0] || {};
}

function abrirAuditsHome() {
  carregarAudits().then(renderAuditsHome);
  renderAuditsHome();
}

function voltarAuditorias() {
  abrirAuditsHome();
}
