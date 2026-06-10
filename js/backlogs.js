let dados = {};
let backlogAuditScores = new Map();

/* ==========================
   INICIAR SITE
========================== */

function iniciarSite() {

  mostrarLoading();

  carregarBacklogAuditScores();

  firebase.firestore()
    .collection("projetos")
    .get()

    .then(snapshot => {

      dados = {};

      snapshot.forEach(doc => {

        const item = doc.data();

        const DE = item.DE;
        const projeto = item.projeto;

        let jsonCompleto;

        try {

          const textoCorrigido =
            item.jsonCompleto
              .replace(/'/g, '"');

          jsonCompleto =
            JSON.parse(textoCorrigido);

        } catch (e) {

          console.error(
            "Erro JSON:",
            item.jsonCompleto
          );

          return;
        }

        if (!dados[DE]) {

          dados[DE] = {
            projetos: {}
          };
        }

        dados[DE].projetos[projeto] = {
          documentos:
            jsonCompleto.documentos
        };
      });

      preencherLista();

      esconderLoading();

    })

    .catch(err => {

      esconderLoading();

      console.error(err);
    });
}

/* ==========================
   DROPDOWN DE
========================== */

function preencherLista() {

  const select =
    document.getElementById("lista");

  select.innerHTML =
    '<option value="">Select a DE</option>';

  Object.keys(dados)
    .sort()
    .forEach(de => {

      const option =
        document.createElement("option");

      option.value = de;
      option.textContent = de;

      select.appendChild(option);
    });
}

/* ==========================
   FILTRO + SEARCH
========================== */

document.addEventListener(
  "change",
  function (e) {

    if (e.target.id === "lista") {
      renderizarProjetos();
    }
  }
);

document.addEventListener(
  "input",
  function (e) {

    if (
      e.target.id === "searchProjeto"
    ) {
      renderizarProjetos();
    }
  }
);

/* ==========================
   RENDER PROJETOS
========================== */

function renderizarProjetos() {

  const de =
    document.getElementById("lista")
      .value;

  const busca =
    document.getElementById(
      "searchProjeto"
    )
      .value
      .toLowerCase();

  const container =
    document.getElementById(
      "projetos"
    );

  container.innerHTML = "";

  if (!de || !dados[de]) return;

  let projetos =
    Object.entries(
      dados[de].projetos
    );

  projetos = projetos.filter(
    ([nome]) =>
      nome
        .toLowerCase()
        .includes(busca)
  );

  projetos.forEach(
    ([nomeProjeto, info], index) => {

      const card =
        criarCardProjeto(
          nomeProjeto,
          info
        );

      card.style.animationDelay =
        `${index * 0.08}s`;

      container.appendChild(card);
    }
  );
}

/* ==========================
   COR DAS NOTAS
========================== */

function getCorNota(nota) {

  if (
    nota === null ||
    nota === undefined ||
    nota === ""
  ) {
    return "#8ea2b8";
  }

  nota = Number(nota);
  if (!Number.isFinite(nota)) {
    return "#8ea2b8";
  }

  // limita entre 0 e 10
  nota = Math.max(0, Math.min(10, nota));

  // Hue:
  // 0 = vermelho
  // 60 = amarelo
  // 120 = verde
  const hue =
    (nota / 10) * 120;

  return `hsl(${hue}, 78%, 45%)`;
}

function getCorSombra(nota) {

  if (
    nota === null ||
    nota === undefined ||
    nota === ""
  ) {
    return "rgba(142, 162, 184, 0.28)";
  }

  nota = Number(nota);
  if (!Number.isFinite(nota)) {
    return "rgba(142, 162, 184, 0.28)";
  }

  nota = Math.max(0, Math.min(10, nota));

  const hue =
    (nota / 10) * 120;

  return `hsla(${hue}, 78%, 45%, 0.35)`;
}

/* ==========================
   CARD PROJETO
========================== */

function criarCardProjeto(
  nomeProjeto,
  info
) {

  const card =
    document.createElement("div");

  card.className = "card";

  const documentos =
    Object.entries(
      info.documentos
    );

  const auditScore =
    obterAuditScoreBacklog(
      nomeProjeto
    );

  const scoreNota =
    Number.isFinite(auditScore)
      ? auditScore * 10
      : null;

  const scoreTexto =
    Number.isFinite(auditScore)
      ? `${Math.round(auditScore * 100)}%`
      : "N/A";

  const gates = {};

  documentos.forEach(
    ([nomeDoc, doc]) => {

      const gate =
        doc.gate || "Outros";

      if (!gates[gate]) {
        gates[gate] = [];
      }

      gates[gate].push({
        nomeDoc,
        ...doc
      });
    }
  );

  let html = `

    <div class="project-header">

      <div>

        <h2 class="project-title">
          ${nomeProjeto}
        </h2>

      </div>

      <div
          class="project-score"
          title="Audit project score"
          style="
            background:${getCorNota(scoreNota)};
            box-shadow:
              0 14px 28px
              ${getCorSombra(scoreNota)};
          "
        >

          ${scoreTexto}

        </div>

    </div>
  `;

  Object.entries(gates)
    .forEach(
      ([gate, docs]) => {

        html += `

        <div class="gate">

          <button class="gate-header">

            <span>
              ${gate}
            </span>

            <i class="fa-solid fa-chevron-down"></i>

          </button>

          <div class="gate-content">
        `;

        docs.forEach(doc => {

          html += `

            <div class="documento">

              <div class="documento-topo">

                <strong>
                  ${doc.nomeDoc}
                </strong>

                <span
                  class="nota"
                  style="
                    background:
                      ${getCorNota(doc.pontuacao)};
                    box-shadow:
                      0 8px 18px
                      ${getCorSombra(doc.pontuacao)};
                  "
                >

                  Nota: ${doc.pontuacao}/10

                </span>

              </div>

              <ul>
          `;

          if (
            Array.isArray(
              doc.pendencias
            )
          ) {

            doc.pendencias
              .forEach(p => {

                html += `
                  <li>
                    ${p}
                  </li>
                `;
              });
          }

          html += `
              </ul>
            </div>
          `;
        });

        html += `
          </div>
        </div>
        `;
      }
    );

  card.innerHTML = html;

  setTimeout(() => {

    card.querySelectorAll(
      ".gate-header"
    )
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          const gate =
            button.parentElement;

          gate.classList.toggle(
            "open"
          );
        }
      );
    });

  }, 0);

  return card;
}


/* ==========================
   LOADING
========================== */

function mostrarLoading() {

  const container =
    document.getElementById(
      "projetos"
    );

  container.innerHTML = `
    ${renderSiteLoading("Loading projects", "Fetching backlog documents from Firestore.")}
  `;
}

function carregarBacklogAuditScores() {
  if (typeof carregarAudits !== "function") {
    return Promise.resolve();
  }

  return carregarAudits()
    .then(state => {
      backlogAuditScores = montarIndiceBacklogAuditScores(state.raw);
      renderizarProjetos();
    })
    .catch(error => {
      backlogAuditScores = new Map();
      console.error("Erro ao carregar notas de audits para backlogs:", error);
    });
}

function montarIndiceBacklogAuditScores(rawAudits) {
  const map = new Map();

  extrairBacklogAuditProjects(rawAudits).forEach(project => {
    const score = Number(project.projectScore);
    if (!Number.isFinite(score)) return;

    [
      project.projectName,
      project.nome,
      project.backlogProjectName,
      project.dashboardName,
      project.id,
      ...(Array.isArray(project.aliases) ? project.aliases : [])
    ].forEach(name => {
      const key = normalizarBacklogAuditName(name);
      if (key && !map.has(key)) {
        map.set(key, score);
      }
    });
  });

  return map;
}

function extrairBacklogAuditProjects(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.projects)) return raw.projects;
  if (Array.isArray(raw.audits)) return raw.audits;
  if (Array.isArray(raw.projetos)) return raw.projetos;

  if (raw.projects && typeof raw.projects === "object") {
    return Object.entries(raw.projects).map(([id, value]) => ({ id, ...value }));
  }

  if (raw.audits && typeof raw.audits === "object") {
    return Object.entries(raw.audits).map(([id, value]) => ({ id, ...value }));
  }

  if (raw.projetos && typeof raw.projetos === "object") {
    return Object.entries(raw.projetos).map(([id, value]) => ({ id, ...value }));
  }

  return [];
}

function normalizarBacklogAuditName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[{}\[\]]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

function obterAuditScoreBacklog(nomeProjeto) {
  const key = normalizarBacklogAuditName(nomeProjeto);
  if (!key) return null;

  if (backlogAuditScores.has(key)) {
    return backlogAuditScores.get(key);
  }

  const fuzzy = [...backlogAuditScores.entries()].find(([auditName]) =>
    auditName.includes(key) || key.includes(auditName)
  );

  return fuzzy ? fuzzy[1] : null;
}

function renderSiteLoading(title, message, compact = false) {
  return `
    <div class="site-loading ${compact ? "compact" : ""}" data-loading="true">
      <div class="site-loader" aria-hidden="true"></div>
      <strong>${escapeLoadingText(title)}</strong>
      <span>${escapeLoadingText(message)}</span>
    </div>
  `;
}

function escapeLoadingText(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function esconderLoading() {

  const container =
    document.getElementById("projetos");

  if (
    container &&
    container.querySelector(
      "[data-loading]"
    )
  ) {
    container.innerHTML = "";
  }
}

