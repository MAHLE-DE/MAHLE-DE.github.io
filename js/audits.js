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
  activeContext: null,
  view: "home",
  homeSearch: "",
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
const AUDIT_PRODUCT_IMAGE_MAX_BYTES = 1_000_000;

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

function _repairMojibake(value) {
  let text = String(value ?? "");
  if (!/[ÃÂ]/.test(text)) return text;

  const replacements = {
    "Ã¡": "á", "Ã ": "à", "Ã£": "ã", "Ã¢": "â", "Ã¤": "ä",
    "Ã©": "é", "Ã¨": "è", "Ãª": "ê", "Ã«": "ë",
    "Ã­": "í", "Ã¬": "ì", "Ã®": "î", "Ã¯": "ï",
    "Ã³": "ó", "Ã²": "ò", "Ãµ": "õ", "Ã´": "ô", "Ã¶": "ö",
    "Ãº": "ú", "Ã¹": "ù", "Ã»": "û", "Ã¼": "ü",
    "Ã§": "ç", "Ã±": "ñ",
    "Ã": "Á", "Ã€": "À", "Ãƒ": "Ã", "Ã‚": "Â", "Ã„": "Ä",
    "Ã‰": "É", "Ãˆ": "È", "ÃŠ": "Ê", "Ã‹": "Ë",
    "Ã": "Í", "ÃŒ": "Ì", "ÃŽ": "Î", "Ã": "Ï",
    "Ã“": "Ó", "Ã’": "Ò", "Ã•": "Õ", "Ã”": "Ô", "Ã–": "Ö",
    "Ãš": "Ú", "Ã™": "Ù", "Ã›": "Û", "Ãœ": "Ü",
    "Ã‡": "Ç", "Âº": "º", "Âª": "ª", "Â°": "°", "Â®": "®"
  };

  Object.entries(replacements).forEach(([bad, good]) => {
    text = text.replaceAll(bad, good);
  });

  return text.replace(/Â(?=[\s.,;:!?])/g, "");
}

function _escapeHtml(value) {
  return _repairMojibake(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function _formatAuditDate(value) {
  if (!value) return "Not defined";
  const text = String(value).trim();
  const date = _parseAuditDateLocal(text);
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit"
  });
}

function _formatAuditDateTime(value) {
  if (!value) return "Not defined";
  const date = _parseAuditDateLocal(value, true);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function _parseAuditDateLocal(value, allowTime = false) {
  if (!value) return new Date(NaN);
  if (value instanceof Date) {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      allowTime ? value.getHours() : 0,
      allowTime ? value.getMinutes() : 0
    );
  }

  if (typeof value === "number") {
    // Excel serial date, using the 1900 date system.
    const excelEpoch = new Date(1899, 11, 30);
    excelEpoch.setDate(excelEpoch.getDate() + Math.floor(value));
    return excelEpoch;
  }

  const text = String(value).trim();
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2}):(\d{2}))?/);
  if (iso) {
    return new Date(
      Number(iso[1]),
      Number(iso[2]) - 1,
      Number(iso[3]),
      allowTime ? Number(iso[4] || 0) : 0,
      allowTime ? Number(iso[5] || 0) : 0
    );
  }

  const br = text.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?(?:\s+(\d{1,2}):(\d{2}))?/);
  if (br) {
    const yearText = br[3] || String(new Date().getFullYear());
    const year = yearText.length === 2 ? Number(`20${yearText}`) : Number(yearText);
    return new Date(
      year,
      Number(br[2]) - 1,
      Number(br[1]),
      allowTime ? Number(br[4] || 0) : 0,
      allowTime ? Number(br[5] || 0) : 0
    );
  }

  return new Date(text);
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
  const projetos = new Map();

  _getAuditProjetosUnicos().forEach(proj => {
    projetos.set(proj.canonicalId, proj);
  });

  if (dashboardDados && dashboardDados.anos) {
    Object.entries(dashboardDados.anos).forEach(([ano, dadosAno]) => {
      (dadosAno.projetos || []).forEach(proj => {
        const canonicalId = normalizarAuditProjectId(proj.id);
        if (!canonicalId) return;

        const existente =
          projetos.get(canonicalId) ||
          _encontrarProjetoAuditEquivalente(projetos, proj);
        const ocorrencia = {
          ano,
          idOriginal: proj.id,
          gate: proj.gate,
          score: proj.score,
          auditSequence: ehAuditSequence(proj.nomeGrafico || proj.nome || "")
        };

        if (existente) {
          if (!existente.auditLinked) {
            existente.nome = nomeExibicao(proj.nome || proj.nomeGrafico || existente.nome);
            existente.nomeGrafico = nomeExibicao(proj.nomeGrafico || proj.nome || existente.nomeGrafico);
          }
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
  }

  return [...projetos.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

function _getAuditProjetosUnicos() {
  return [...auditState.byProjectId.values()].map(audit => ({
    canonicalId: audit.canonicalId || normalizarAuditProjectId(audit.id),
    nome: audit.projectName || audit.nome || audit.canonicalId || audit.id,
    nomeGrafico: audit.projectName || audit.nome || audit.canonicalId || audit.id,
    auditLinked: true,
    ocorrencias: []
  })).filter(proj => proj.canonicalId);
}

function _encontrarProjetoAuditEquivalente(projetos, dashboardProject) {
  const dashboardNames = [
    dashboardProject.nome,
    dashboardProject.nomeGrafico,
    dashboardProject.projectName,
    dashboardProject.id
  ].filter(Boolean);

  return [...projetos.values()].find(projeto => {
    const audit = _getAuditRecord(projeto.canonicalId);
    if (!audit) return false;

    const auditNames = [
      projeto.nome,
      projeto.nomeGrafico,
      audit.projectName,
      audit.nome,
      audit.backlogProjectName,
      audit.dashboardName,
      ...(Array.isArray(audit.aliases) ? audit.aliases : [])
    ].filter(Boolean);

    return dashboardNames.some(dashName =>
      auditNames.some(auditName =>
        _nomesProjetosEquivalentes(dashName, auditName)
      )
    );
  });
}

function _nomesProjetosEquivalentes(a, b) {
  const tokensA = _tokensProjeto(a);
  const tokensB = _tokensProjeto(b);
  if (tokensA.length < 2 || tokensB.length < 2) return false;

  const shorter = tokensA.length <= tokensB.length ? tokensA : tokensB;
  const longer = tokensA.length <= tokensB.length ? tokensB : tokensA;
  const matches = shorter.filter(token => longer.includes(token)).length;

  return matches >= Math.max(2, Math.ceil(shorter.length * 0.75));
}

function _tokensProjeto(value) {
  const tokens = _normalizeText(value)
    .split(" ")
    .filter(token => token.length >= 2)
    .filter(token => !["oes", "oem", "the", "and", "for"].includes(token));

  const expanded = [];
  tokens.forEach(token => {
    expanded.push(token);

    const numeric = token.match(/\d{2,}/g);
    if (numeric) expanded.push(...numeric);

    const alpha = token.match(/[a-z]{2,}/g);
    if (alpha) expanded.push(...alpha);
  });

  return [...new Set(expanded)];
}

function _getAuditRecord(canonicalId) {
  return auditState.byProjectId.get(canonicalId) || null;
}

function _renderAuditStatusCard() {
  if (auditState.loading) {
    return `
      <div class="audit-status-card">
        ${_renderSiteLoading("Loading audit database", "Reading audits/audits from Firestore.", true)}
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
              value="${_escapeHtml(auditDetailState.homeSearch)}"
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
      auditDetailState.homeSearch = searchInput.value;
      _filtrarAuditProjectRows(searchInput.value);
    });
    _filtrarAuditProjectRows(auditDetailState.homeSearch);
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
      row.dataset.auditDe,
      row.textContent
    ].join(" "));
    const visible = !term || haystack.includes(term);
    row.hidden = !visible;
    row.classList.toggle("audit-project-row-hidden", !visible);
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
  const yearText = anos.length ? anos.join(", ") : "Audit JSON";
  const responsible = audit?.developmentEngineer?.name || audit?.de || audit?.responsible || "";

  return `
    <button
      class="audit-project-row"
      type="button"
      data-audit-id="${_escapeHtml(projeto.canonicalId)}"
      data-audit-name="${_escapeHtml(projeto.nome)}"
      data-audit-years="${_escapeHtml(yearText)}"
      data-audit-de="${_escapeHtml(responsible)}"
      data-audit-sequence="${sequencias ? "true" : "false"}"
    >
      <span class="audit-project-main">
        <strong>${_escapeHtml(projeto.nome)}</strong>
        <small>${_escapeHtml(responsible)}</small>
      </span>
      <span class="audit-project-meta">
        <span>${_escapeHtml(yearText)}</span>
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

  const detailContext = {
    canonicalId,
    originalId: projetoId,
    nome: projetoNome,
    ano,
    meta
  };

  auditDetailState.projectId = canonicalId;
  auditDetailState.activeContext = detailContext;
  auditDetailState.view = "detail";

  carregarAudits()
    .then(() => {
      const resolvedContext =
        _resolverContextoAuditoria(detailContext);

      auditDetailState.projectId = resolvedContext.canonicalId;
      auditDetailState.activeContext = resolvedContext;
      _carregarAuditoriaDetalhe(resolvedContext);
    });

  _carregarAuditoriaDetalhe({
    ...detailContext,
    loading: true
  });
}

function _resolverContextoAuditoria(contexto) {
  const resolvedId =
    _resolverCanonicalAuditId(
      contexto.originalId,
      contexto.nome,
      contexto.meta
    );

  if (!resolvedId || resolvedId === contexto.canonicalId) {
    return contexto;
  }

  return {
    ...contexto,
    canonicalId: resolvedId,
    meta: {
      ...contexto.meta,
      resolvedFromDashboard: true
    }
  };
}

function _resolverCanonicalAuditId(projetoId, projetoNome, meta = {}) {
  const directId = normalizarAuditProjectId(meta.canonicalId || projetoId);

  if (directId && _getAuditRecord(directId)) {
    return directId;
  }

  const dashboardNames = [
    projetoNome,
    meta.dashboardName,
    meta.dashboardChartName,
    meta.projectName,
    meta.dashboardId,
    projetoId
  ].filter(Boolean);

  for (const audit of auditState.byProjectId.values()) {
    const auditNames = [
      audit.canonicalId,
      audit.id,
      audit.projectId,
      audit.projetoId,
      audit.dashboardId,
      audit.projectName,
      audit.nome,
      audit.backlogProjectName,
      audit.dashboardName,
      ...(Array.isArray(audit.aliases) ? audit.aliases : [])
    ].filter(Boolean);

    const equivalent = dashboardNames.some(dashName =>
      auditNames.some(auditName =>
        _normalizeText(dashName) === _normalizeText(auditName) ||
        normalizarAuditProjectId(dashName) === normalizarAuditProjectId(auditName) ||
        _nomesProjetosEquivalentes(dashName, auditName)
      )
    );

    if (equivalent) {
      return audit.canonicalId || normalizarAuditProjectId(audit.id);
    }
  }

  return directId;
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
        status: Number(doc.status || 4),
        naJustification:
          doc.naJustification ||
          doc.justification ||
          doc.naReason ||
          doc.reason ||
          doc.observation ||
          ""
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
    lastAuditedGate:
      audit?.ultimo_gate_audit ||
      audit?.lastAuditedGate ||
      audit?.last_audited_gate ||
      audit?.gates?.lastAudited ||
      audit?.gates?.lastAudit ||
      "",
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
          ${project.developmentEngineer.name ? `<span>${_escapeHtml(project.developmentEngineer.name)}</span>` : ""}
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
          ${_renderAuditFact("Responsible", project.developmentEngineer.name || "Not defined", "audit-fact-wide")}
          ${_renderAuditFact("Actual Gate", project.gates.current || "Not defined", "audit-fact-wide")}
          ${_renderAuditFact("Next Gate", project.gates.next || "Not defined", "audit-fact-third")}
          ${_renderAuditFact("Next Gate date", _formatAuditDate(project.gates.nextGateDate), "audit-fact-third")}
          ${_renderAuditFact("Last Audited Gate", project.lastAuditedGate || "Not informed", "audit-fact-third")}
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

function _renderAuditFact(label, value, className = "") {
  const icons = {
    "Responsible": "fa-user-tie",
    "Actual Gate": "fa-location-dot",
    "Next Gate": "fa-route",
    "Next Gate date": "fa-calendar-check",
    "Last Audited Gate": "fa-clipboard-check"
  };

  return `
    <div class="audit-fact ${_escapeHtml(className)}">
      <div class="audit-fact-icon">
        <i class="fa-solid ${icons[label] || "fa-circle-info"}"></i>
      </div>
      <div>
        <span>${_escapeHtml(label)}</span>
        <strong>${_escapeHtml(value)}</strong>
      </div>
    </div>
  `;
}

function _renderSiteLoading(title, message, compact = false) {
  return `
    <div class="site-loading ${compact ? "compact" : ""}" data-loading="true">
      <div class="site-loader" aria-hidden="true"></div>
      <strong>${_escapeHtml(title)}</strong>
      <span>${_escapeHtml(message)}</span>
    </div>
  `;
}

function _getProductImageSource(project) {
  const image = project.productImage || {};
  const src = image.dataUrl || image.url || image.assetPath || image.src || image.localPath || "";
  if (!src) return "";
  if (
    String(src).startsWith("data:image/") &&
    new Blob([String(src)]).size > AUDIT_PRODUCT_IMAGE_MAX_BYTES
  ) {
    console.warn("Audit product image ignored: base64 data URL is larger than 1 MB.");
    return "";
  }
  return src;
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
        <button class="export-png-btn" type="button" data-export-selector="#auditDocChart" data-export-name="${_escapeHtml(project.canonicalId)}-audit-documents">
          <i class="fa-regular fa-image"></i>
        </button>
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
          ${loading ? _renderSiteLoading("Loading audit data", "Preparing document scores and gate groups.", true) : _renderAuditGateGroups(project, visibleGates)}
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
  return `--audit-doc-count:${docCount};--audit-gate-count:${gateCount};`;
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
      <div
        class="audit-gate-group audit-gate-tone-${index % 4}"
        data-gate="${_escapeHtml(gate)}"
        style="--audit-gate-flex:${Math.max(1, docs.length)};"
      >
        <div class="audit-doc-gridlines" aria-hidden="true">
          <span></span>
          <span></span>
          <span></span>
          <span></span>
          <span></span>
        </div>
        <div class="audit-doc-gate-label">${_escapeHtml(gate)}</div>
        <div class="audit-gate-bars">
          ${docs.map(doc => _renderAuditDocumentBar(doc, project)).join("")}
        </div>
      </div>
    `;
  }).join("");
}

function _renderAuditDocumentBar(doc, project) {
  const status = AUDIT_STATUS[doc.status] || AUDIT_STATUS[4];
  const effectiveScore = doc.status === 4
    ? 1
    : Math.max(0, Math.min(1, Number(doc.score || 0)));
  const isZeroScore = effectiveScore === 0;
  const height = isZeroScore
    ? 0
    : Math.max(18, Math.round(effectiveScore * 360));
  const chartName = _compactAuditDocName(doc.shortName || doc.name);
  const tooltip =
    _getAuditDocumentTooltip(project, doc, effectiveScore);

  return `
    <button
      class="audit-doc-bar-wrap"
      type="button"
      data-project-id="${_escapeHtml(project.canonicalId)}"
      data-project-name="${_escapeHtml(project.projectName)}"
      data-doc-id="${_escapeHtml(doc.id)}"
      aria-label="${_escapeHtml(doc.name)}"
      style="--audit-bar-w:${_getAuditBarWidth(project.documents.length)}px;--audit-bar-visible-h:${height}px;"
    >
      <span class="audit-doc-bar ${isZeroScore ? "audit-doc-bar-zero" : ""}" style="height:${height}px;">
        <span class="audit-doc-status-diamond ${status.className}" aria-label="${_escapeHtml(status.label)}"></span>
      </span>
      <span class="audit-doc-name-wrap">
        <span class="audit-doc-name">${_escapeHtml(chartName)}</span>
      </span>
      ${_renderAuditBacklogTooltip(tooltip)}
    </button>
  `;
}

function _renderAuditBacklogTooltip(tooltip) {
  return `
    <span class="audit-backlog-tooltip ${_escapeHtml(tooltip.tone || "")}" role="tooltip">
      <span class="audit-backlog-tooltip-head">
        <span class="audit-backlog-tooltip-kicker">${_escapeHtml(tooltip.kicker)}</span>
        ${tooltip.scoreLabel ? `<span class="audit-backlog-tooltip-score">${_escapeHtml(tooltip.scoreLabel)}</span>` : ""}
      </span>
      <strong>${_escapeHtml(tooltip.title)}</strong>
      <span class="audit-backlog-tooltip-list">
        ${tooltip.items.slice(0, 5).map(item => `
          <span>${_escapeHtml(item)}</span>
        `).join("")}
      </span>
      ${tooltip.items.length > 5 ? `<em>+${tooltip.items.length - 5} additional item(s)</em>` : ""}
    </span>
  `;
}

function _getAuditDocumentTooltip(project, auditDoc, effectiveScore) {
  const scoreLabel =
    _formatAuditTooltipScore(auditDoc);

  if (Number(auditDoc.status) === 4) {
    const justification =
      _getAuditNAJustification(project, auditDoc);

    return {
      kicker: "N/A justification",
      title: "Reason registered for this document",
      tone: "is-na",
      scoreLabel,
      items: [
        justification ||
        "N/A justification has not been specified for this document."
      ]
    };
  }

  if (effectiveScore >= 1) {
    return {
      kicker: "Backlog findings",
      title: "Document fully resolved",
      tone: "is-resolved",
      scoreLabel,
      items: [
        "All backlog findings for this document are resolved."
      ]
    };
  }

  const findings =
    _getAuditBacklogFindings(project, auditDoc);

  return {
    kicker: "Backlog findings",
    title: "Open items for this document",
    tone: "is-open",
    scoreLabel,
    items: findings.length
      ? findings
      : ["Backlog finding not specified for this document."]
  };
}

function _formatAuditTooltipScore(auditDoc) {
  const rawScore = Number.isFinite(Number(auditDoc.rawScore))
    ? Number(auditDoc.rawScore)
    : Number(auditDoc.score);

  if (!Number.isFinite(rawScore)) return "";

  const normalized = Math.max(0, Math.min(1, rawScore));
  return `Score: ${Math.round(normalized * 100)}%`;
}

function _getAuditNAJustification(project, auditDoc) {
  if (auditDoc.naJustification) {
    return auditDoc.naJustification;
  }

  const justifications =
    _extractAuditNAJustifications(project.importantInfo);

  if (!justifications.length) return "";

  const targetNames = [
    auditDoc.name,
    auditDoc.shortName,
    auditDoc.id
  ].filter(Boolean);
  const targetGate =
    _normalizeText(auditDoc.gate || "");

  const candidates = justifications
    .map(item => {
      const itemGate =
        _normalizeText(item.gate || "");
      const itemDoc =
        _normalizeText(item.document || item.documentName || item.name || item.doc || "");

      let score = 0;
      if (targetGate && itemGate === targetGate) score += 4;

      targetNames
        .map(_normalizeText)
        .filter(Boolean)
        .forEach(target => {
          if (itemDoc && itemDoc === target) score += 12;
          if (itemDoc && (itemDoc.includes(target) || target.includes(itemDoc))) score += 8;
          if (itemDoc && _nomesProjetosEquivalentes(itemDoc, target)) score += 6;
        });

      return {
        justification: item.justification || item.reason || item.text || "",
        score
      };
    })
    .filter(item => item.score > 0 && item.justification)
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.justification || "";
}

function _extractAuditNAJustifications(info) {
  if (!info) return [];
  if (Array.isArray(info)) return info;
  if (Array.isArray(info.naJustifications)) return info.naJustifications;
  if (Array.isArray(info.justifications)) return info.justifications;
  if (Array.isArray(info.items)) return info.items;
  return [];
}

function _getAuditBacklogFindings(project, auditDoc) {
  const backlogProject =
    _findAuditBacklogProject(project);

  if (!backlogProject?.info?.documentos) {
    return [];
  }

  const targetDocNames = [
    auditDoc.name,
    auditDoc.shortName,
    auditDoc.id
  ].filter(Boolean);

  const candidates =
    Object.entries(backlogProject.info.documentos)
      .map(([nomeDoc, backlogDoc]) => ({
        nomeDoc,
        backlogDoc,
        score: _scoreAuditBacklogDocumentMatch(
          targetDocNames,
          auditDoc.gate,
          nomeDoc,
          backlogDoc
        )
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  if (!best || !Array.isArray(best.backlogDoc.pendencias)) {
    return [];
  }

  return best.backlogDoc.pendencias
    .map(item => {
      if (typeof getBacklogPendingText === "function") {
        return getBacklogPendingText(item);
      }
      return String(item || "").trim();
    })
    .filter(Boolean);
}

function _findAuditBacklogProject(project) {
  if (!dados || typeof dados !== "object") return null;

  const projectNames = [
    project.audit?.backlogProjectName,
    project.projectName,
    project.audit?.dashboardName,
    project.id,
    project.canonicalId,
    ...(Array.isArray(project.audit?.aliases) ? project.audit.aliases : [])
  ].filter(Boolean);

  const targetNames = projectNames
    .map(_normalizeText)
    .filter(Boolean);

  const targetResponsible =
    _normalizeText(project.developmentEngineer?.name || "");

  const candidates = [];

  Object.entries(dados).forEach(([de, group]) => {
    Object.entries(group.projetos || {}).forEach(([nomeProjeto, info]) => {
      const name = _normalizeText(nomeProjeto);
      const deScore = targetResponsible && _normalizeText(de) === targetResponsible ? 3 : 0;
      const exactScore = targetNames.some(target => name === target) ? 8 : 0;
      const containsScore = targetNames.some(target =>
        name.includes(target) || target.includes(name)
      ) ? 3 : 0;
      const fuzzyScore = targetNames.some(target =>
        _nomesProjetosEquivalentes(target, name)
      ) ? 4 : 0;

      candidates.push({
        de,
        projectName: nomeProjeto,
        info,
        score: deScore + exactScore + containsScore + fuzzyScore
      });
    });
  });

  return candidates
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function _scoreAuditBacklogDocumentMatch(targetDocNames, auditGate, backlogDocName, backlogDoc) {
  const backlogName =
    _normalizeText(backlogDocName);
  const backlogGate =
    _normalizeText(backlogDoc?.gate || "");
  const targetGate =
    _normalizeText(auditGate || "");

  let score = 0;

  targetDocNames
    .map(_normalizeText)
    .filter(Boolean)
    .forEach(target => {
      if (backlogName === target) score = Math.max(score, 12);
      if (backlogName.includes(target) || target.includes(backlogName)) {
        score = Math.max(score, 8);
      }
      if (_nomesProjetosEquivalentes(backlogName, target)) {
        score = Math.max(score, 6);
      }
    });

  if (score > 0 && targetGate && backlogGate === targetGate) {
    score += 3;
  }

  return score;
}

function _getAuditBarWidth(docCount) {
  if (docCount <= 8) return 42;
  if (docCount <= 21) return 34;
  if (docCount <= 30) return 28;
  return 24;
}

function _compactAuditDocName(value) {
  let text = _repairMojibake(value)
    .replace(/\bMAHLE\s+/gi, "")
    .replace(/\bPerf\.?\s*Specif\b/gi, "Perf. Spec")
    .replace(/\bSpecial\s+Caracteristic\s+list\b/gi, "Special Char")
    .replace(/\bSpecial\s+Characteristic\s+List\b/gi, "Special Char")
    .replace(/\s*\(PN workflow\)/gi, "")
    .replace(/\bapproved by customer\b/gi, "approved")
    .replace(/\bconcluded\b/gi, "")
    .replace(/\bissues\b/gi, "")
    .replace(/\s*\/\s*/g, "/")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= 24) return text;

  return text
    .replace(/\bPrototype\b/gi, "Proto")
    .replace(/\bNumerical Simulation\b/gi, "Simulation")
    .replace(/\bMaterial Release\b/gi, "Mat. Release")
    .replace(/\bControl Plan\b/gi, "Ctrl Plan")
    .replace(/\bDesign approved\b/gi, "Design OK")
    .replace(/\s+/g, " ")
    .trim();
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

  if (_isStructuredAuditInfo(info)) {
    return _renderStructuredAuditInfo(info);
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

function _isStructuredAuditInfo(info) {
  return info &&
    typeof info === "object" &&
    (
      Array.isArray(info.naJustifications) ||
      Array.isArray(info.importantDates) ||
      Array.isArray(info.specialCharacteristics)
    );
}

function _renderStructuredAuditInfo(info) {
  return `
    <div class="audit-info-sections">
      ${_renderNaJustifications(info.naJustifications || [])}
      <div class="audit-info-side-stack">
        ${_renderImportantDates(info.importantDates || [])}
        ${_renderSpecialCharacteristics(info.specialCharacteristics || [])}
      </div>
    </div>
  `;
}

function _renderNaJustifications(items) {
  return `
    <section class="audit-info-section">
      <h4>N/A justifications</h4>
      ${items.length ? `
        <div class="audit-info-items">
          ${items.map(item => `
            <article class="audit-info-item">
              <span>${_escapeHtml(item.gate || "N/A")}</span>
              <strong>${_escapeHtml(item.documentName || "Document not specified")}</strong>
              <p>${_escapeHtml(item.justification || "No justification provided")}</p>
            </article>
          `).join("")}
        </div>
      ` : `<p class="audit-info-muted">No N/A justifications registered.</p>`}
    </section>
  `;
}

function _renderImportantDates(items) {
  return `
    <section class="audit-info-section">
      <h4>Important dates</h4>
      ${items.length ? `
        <div class="audit-date-grid">
          ${items.map(item => `
            <div class="audit-date-pill">
              <span>${_escapeHtml(item.gate || "Date")}</span>
              <strong>${_escapeHtml(_formatAuditDate(item.date))}</strong>
            </div>
          `).join("")}
        </div>
      ` : `<p class="audit-info-muted">No important dates registered.</p>`}
    </section>
  `;
}

function _renderSpecialCharacteristics(items) {
  return `
    <section class="audit-info-section">
      <h4>Audit highlights</h4>
      ${items.length ? `
        <div class="audit-characteristic-list">
          ${items.map(item => `<span>${_escapeHtml(item)}</span>`).join("")}
        </div>
      ` : `<p class="audit-info-muted">No audit highlights registered.</p>`}
    </section>
  `;
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
        _animarAuditOverviewRerender(contexto, true);
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

function _animarAuditOverviewRerender(contexto, keepGateDropdownOpen = false) {
  const chart = document.getElementById("auditDocChart");
  if (chart) {
    chart.classList.add("audit-doc-chart-exit");
  }

  window.setTimeout(() => {
    _carregarAuditoriaDetalhe(contexto);
    if (keepGateDropdownOpen) {
      const dropdown = document.getElementById("auditGateDropdown");
      if (dropdown) dropdown.classList.add("open");
    }
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
  auditDetailState.view = "home";
  auditDetailState.activeContext = null;
  carregarAudits().then(renderAuditsHome);
  renderAuditsHome();
}

function resetarFiltrosAudits() {
  auditDetailState.homeSearch = "";
  auditDetailState.visibleGatesByProject = new Map();
}

function abrirAuditsAtual() {
  resetarFiltrosAudits();
  abrirAuditsHome();
}

function voltarAuditorias() {
  abrirAuditsHome();
}
