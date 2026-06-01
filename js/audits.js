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

const AUDIT_SEQUENCE_SYMBOL = "\u27F2";

function normalizarAuditProjectId(id) {
  return String(id || "")
    .trim()
    .toLowerCase()
    .replace(/[{}\[\]]/g, "")
    .replace(/^-+|-+$/g, "")
    .replace(/--+/g, "-");
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

  if (Array.isArray(raw.audits)) {
    return raw.audits;
  }

  if (Array.isArray(raw.projetos)) {
    return raw.projetos;
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
        <span>Create audits/audits with jsonCompleto when the data model is defined.</span>
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
          <h3>Projects ready for audit pages</h3>
          <span>${projetos.length} linked project(s)</span>
        </div>
        <div class="audit-project-list">
          ${projetos.length ? projetos.map(_renderAuditProjectRow).join("") : _renderAuditEmptyState()}
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
}

function _renderAuditProjectRow(projeto) {
  const audit = _getAuditRecord(projeto.canonicalId);
  const anos = [...new Set(projeto.ocorrencias.map(item => item.ano))].sort();
  const sequencias = projeto.ocorrencias.filter(item => item.auditSequence).length;

  return `
    <button
      class="audit-project-row"
      type="button"
      data-audit-id="${projeto.canonicalId}"
      data-audit-name="${projeto.nome}"
      data-audit-years="${anos.join(", ")}"
      data-audit-sequence="${sequencias ? "true" : "false"}"
    >
      <span class="audit-project-main">
        <strong>${projeto.nome}</strong>
        <small>${projeto.canonicalId}</small>
      </span>
      <span class="audit-project-meta">
        <span>${anos.join(", ")}</span>
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

  const isSequence =
    normalizarAuditProjectId(contexto.originalId) !== contexto.canonicalId ||
    contexto.meta.auditSequence;

  sec.innerHTML = `
    <div class="audits-shell">
      <button class="auditoria-back-btn" id="auditoriaBackBtn" type="button">
        <i class="fa-solid fa-arrow-left"></i> Back to audits
      </button>

      <div class="audit-detail-hero">
        <div>
          <span class="audit-eyebrow">Project audit</span>
          <h2>${contexto.nome}</h2>
          <div class="audit-detail-meta">
            <span>ID: ${contexto.canonicalId}</span>
            ${contexto.ano ? `<span>Dashboard year: ${contexto.ano}</span>` : ""}
            ${isSequence ? `<span class="audit-sequence-pill">${AUDIT_SEQUENCE_SYMBOL} Audit Sequence route</span>` : ""}
          </div>
        </div>
        <span class="${audit ? "audit-data-pill ok" : "audit-data-pill"}">
          ${contexto.loading ? "Loading..." : audit ? "Audit data ready" : "Pending JSON"}
        </span>
      </div>

      <div class="audit-detail-grid">
        ${_renderAuditDetailCard("Overview", "Project summary, audit scope, responsible people and current status.", audit?.overview || audit?.resumo)}
        ${_renderAuditDetailCard("Checklist", "Gate-specific requirements, answers, scores and evidence status.", audit?.checklist)}
        ${_renderAuditDetailCard("Findings", "Open issues, non-conformities, risks and notes found during the audit.", audit?.findings || audit?.pendencias)}
        ${_renderAuditDetailCard("Action Plan", "Owners, due dates, containment actions and closure evidence.", audit?.actionPlan || audit?.planoAcao)}
      </div>

      <div class="audit-json-panel">
        <div>
          <h3>Future data contract</h3>
          <p>This page already routes by project ID. When jsonCompleto is defined, fields can populate the cards above.</p>
        </div>
        <code>audits / audits / jsonCompleto</code>
      </div>
    </div>
  `;

  const backBtn =
    document.getElementById("auditoriaBackBtn");

  if (backBtn) {
    backBtn.addEventListener("click", voltarAuditorias);
  }
}

function _renderAuditDetailCard(titulo, descricao, conteudo) {
  return `
    <section class="audit-detail-card">
      <h3>${titulo}</h3>
      <p>${descricao}</p>
      <div class="audit-card-body">
        ${_renderAuditContent(conteudo)}
      </div>
    </section>
  `;
}

function _renderAuditContent(conteudo) {
  if (!conteudo) {
    return `<span class="audit-placeholder">Waiting for audit JSON mapping.</span>`;
  }

  if (Array.isArray(conteudo)) {
    return `
      <ul class="audit-data-list">
        ${conteudo.map(item => `<li>${typeof item === "object" ? JSON.stringify(item) : item}</li>`).join("")}
      </ul>
    `;
  }

  if (typeof conteudo === "object") {
    return `
      <dl class="audit-data-dl">
        ${Object.entries(conteudo).map(([key, value]) => `
          <div>
            <dt>${key}</dt>
            <dd>${typeof value === "object" ? JSON.stringify(value) : value}</dd>
          </div>
        `).join("")}
      </dl>
    `;
  }

  return `<span>${conteudo}</span>`;
}

function abrirAuditsHome() {
  carregarAudits().then(renderAuditsHome);
  renderAuditsHome();
}

function voltarAuditorias() {
  abrirAuditsHome();
}
