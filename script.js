let dados = {};

/* ==========================
   FIREBASE
========================== */

const firebaseConfig = {
  apiKey: "AIzaSyBreppRJPaHXwz3K_QB_79EU2C4rGEF9Gk",
  authDomain: "site-mahle.firebaseapp.com",
  projectId: "site-mahle",
  storageBucket: "site-mahle.firebasestorage.app",
  messagingSenderId: "726211952088",
  appId: "1:726211952088:web:383864b51bc9f703b406ad"
};

firebase.initializeApp(firebaseConfig);

/* ==========================
   LOGIN
========================== */

function login() {

  const email =
    document.getElementById("email").value;

  const senha =
    document.getElementById("senha").value;

  firebase.auth()
    .signInWithEmailAndPassword(
      email,
      senha
    )
    .catch(error => {
      alert(error.message);
    });
}

/* ==========================
   LOGOUT
========================== */

function logout() {
  firebase.auth().signOut();
}

/* ==========================
   AUTH CONTROL
========================== */

firebase.auth().onAuthStateChanged(user => {

  const loginContainer =
    document.getElementById("login-container");

  const loginBackground =
    document.getElementById("login-background");

  const loginLogo =
    document.getElementById("login-logo");

  const app =
    document.getElementById("app");

  if (user) {

    loginContainer.classList.add("hidden");
    loginBackground.classList.add("hidden");
    loginLogo.classList.add("hidden");

    app.style.display = "flex";

    iniciarSite();

  } else {

    loginContainer.classList.remove("hidden");
    loginBackground.classList.remove("hidden");
    loginLogo.classList.remove("hidden");

    app.style.display = "none";
  }
});

/* ==========================
   INICIAR SITE
========================== */

function iniciarSite() {

  mostrarLoading();

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
    '<option value="">Selecione um DE</option>';

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

  nota = Number(nota);

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

  nota = Number(nota);
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

  const notas =
    documentos.map(
      ([_, doc]) =>
        Number(doc.pontuacao || 0)
    );

  const media =
    notas.length
      ? (
          notas.reduce(
            (a, b) => a + b,
            0
          ) / notas.length
        ).toFixed(1)
      : 0;

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
          style="
            background:${getCorNota(media)};
            box-shadow:
              0 14px 28px
              ${getCorSombra(media)};
          "
        >

          ${media}

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

/* ==========================
   MENU SPA
========================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const menuItems =
      document.querySelectorAll(
        ".menu-item"
      );

    const title =
      document.getElementById(
        "section-title"
      );

    menuItems.forEach(item => {

      item.addEventListener(
        "click",
        () => {

          menuItems.forEach(btn =>
            btn.classList.remove(
              "active"
            )
          );

          item.classList.add(
            "active"
          );

          const section =
            item.dataset.section;

          document
            .querySelectorAll(
              ".page-section"
            )
            .forEach(sec => {
              sec.classList.remove(
                "active-section"
              );
            });

          document
            .getElementById(
              `${section}-section`
            )
            .classList.add(
              "active-section"
            );

          const nomes = {
			  pendencias:
				"Pendências de Projetos",
			  kpis:
				"KPIs",
			  auditorias:
				"Auditorias"
			};
			title.textContent =
			  nomes[section];

			if (section === "kpis") {
			  setTimeout(() => {
				gerarGraficoDEs();
				carregarDashboard();
			  }, 50);
			}
        }
      );
    });
  });

/* ==========================
   ENTER LOGIN
========================== */

document.addEventListener(
  "keydown",
  function (e) {

    if (e.key === "Enter") {

      const email =
        document.getElementById(
          "email"
        );

      const senha =
        document.getElementById(
          "senha"
        );

      if (
        document.activeElement ===
          email ||

        document.activeElement ===
          senha
      ) {

        e.preventDefault();
        login();
      }
    }
  }
);

/* ==========================
   TOGGLE SENHA
========================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const senhaInput =
      document.getElementById(
        "senha"
      );

    const toggleSenha =
      document.getElementById(
        "toggleSenha"
      );

    if (
      !senhaInput ||
      !toggleSenha
    ) return;

    toggleSenha.addEventListener(
      "click",
      () => {

        const visivel =
          senhaInput.type ===
          "text";

        senhaInput.type =
          visivel
            ? "password"
            : "text";

        toggleSenha.className =
          visivel

            ? "fa-regular fa-eye-slash password-toggle"

            : "fa-regular fa-eye password-toggle";
      }
    );
  }
);

/* ==========================
   LOADING
========================== */

function mostrarLoading() {

  const container =
    document.getElementById(
      "projetos"
    );

  container.innerHTML = `
    <div style="
      width:100%;
      text-align:center;
      padding:60px;
      font-size:20px;
      color:#6f7d96;
    ">
      Carregando projetos...
    </div>
  `;
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

/* ==========================
   DASHBOARD - SCORE OF PROJECTS
========================== */

let dashboardDados        = null;
let dashboardAnosVisiveis = new Set(); // anos atualmente exibidos

/* ---------- constantes de layout ---------- */
const BAR_HEIGHT_MAX = 500; // px — altura da barra para score=100%
const BAR_W          = 42;  // px — largura de cada barra
const BAR_GAP        = 10;  // px — gap entre barras
const GROUP_PAD_H    = 16;  // px — padding horizontal do year-group
const CHART_PAD_TOP  = 46;  // px — espaço acima das barras (score-label)
const CHART_PAD_BOT  = 165; // px — espaço abaixo (nomes na diagonal)

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
  return "rgba(80, 100, 140, 0.16)";
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

  firebase.firestore()
    .collection("dashboard").doc("scores").get()
    .then(doc => {
      dashboardDados = doc.exists ? doc.data() : _dashboardFallback;
      renderizarDashboard();
    })
    .catch(() => {
      dashboardDados = _dashboardFallback;
      renderizarDashboard();
    });
}

/* ---------- fallback embutido ---------- */
const _dashboardFallback = {"anos":{"2024":{"target":0.5,"projetos":[{"ordem":1,"id":"vw-cc678-orvr-pl7","nome":"VW CC678 ORVR PL7","nomeGrafico":"VW CC678","score":0.745192307692308,"gate":"EOA"},{"ordem":2,"id":"horse-ox1413-hr10-13-ddt","nome":"Horse OX1413 HR10/13 DDT","nomeGrafico":"Horse OX1413","score":0.528,"gate":"QG3"},{"ordem":3,"id":"bmw-lx5620-k09","nome":"BMW LX5620 K09","nomeGrafico":"BMW LX5620","score":0.483413461538462,"gate":"EOA"},{"ordem":4,"id":"vw-cc691-saveiro","nome":"VW CC691 Saveiro","nomeGrafico":"VW CC691","score":0.640865384615385,"gate":"EOA"},{"ordem":5,"id":"bmw-oc619-spin-on","nome":"BMW OC619 Spin-On","nomeGrafico":"BMW OC619","score":0.546514423076923,"gate":"EOA"},{"ordem":6,"id":"vw-cc678-1-orvr-pl8-atld","nome":"VW CC678/1 ORVR PL8 ATLD","nomeGrafico":"VW CC678/1","score":0.803846153846154,"gate":"EOA"},{"ordem":7,"id":"rochling-lx5801-ea211-10-mpi","nome":"Rochling LX5801 EA211 1.0 MPI","nomeGrafico":"Rochiling LX5801","score":0.812980769230769,"gate":"MS2"},{"ordem":8,"id":"honda-lp-28my-ap2di-next-ffv","nome":"Honda LP 28MY AP2Di NEXT FFV","nomeGrafico":"Honda LP 28MY","score":0.675,"gate":"MS1"},{"ordem":9,"id":"porsche-oc1049-2-spin-on","nome":"Porsche OC1049/2 Spin-on","nomeGrafico":"Porsche OC1049/2","score":0.425,"gate":"MS2"}],"average":0.628979166666667},"2025":{"target":0.75,"projetos":[{"ordem":10,"id":"volvo-oc1818-oes","nome":"Volvo OC1818 OES","nomeGrafico":"Volvo OC1818","score":0.82,"gate":"QG2"},{"ordem":11,"id":"volvo-oc1817-oes","nome":"Volvo OC1817 OES","nomeGrafico":"Volvo OC1817","score":0.82,"gate":"QG2"},{"ordem":12,"id":"volvo-kc800-oes","nome":"Volvo KC800 OES","nomeGrafico":"Volvo KC800","score":0.83,"gate":"QG2"},{"ordem":13,"id":"honda-lp-28my-ap2di-next-ffv","nome":"Honda LP 28MY AP2Di NEXT FFV","nomeGrafico":"[ Honda LP 28MY ]","score":0.828,"gate":"MS1"},{"ordem":14,"id":"hyundai-kia-lm852-4-kappa-10-ffv","nome":"Hyundai Kia LM852/4 Kappa 1.0 FFV","nomeGrafico":"Hyundai","score":0.741,"gate":"EOA"},{"ordem":15,"id":"bmw-oc619-2-spin-on","nome":"BMW OC619/2 Spin-On","nomeGrafico":"BMW OC619/2","score":0.772,"gate":"MS2"},{"ordem":16,"id":"bmw-oc306-2-spin-on","nome":"BMW OC306/2 Spin-On","nomeGrafico":"BMW OC306/2","score":0.764,"gate":"MS2"},{"ordem":17,"id":"horse-oil-filler-zh568-hr10-13","nome":"Horse Oil Filler ZH568 HR10/13","nomeGrafico":"Horse ZH568","score":0.802764423076923,"gate":"EOA"},{"ordem":18,"id":"renault-bracket-h1312","nome":"Renault Bracket H1312","nomeGrafico":"Renault H1312","score":0.825,"gate":"EOA"},{"ordem":19,"id":"stellantis-cc717-mhev","nome":"Stellantis CC717 MHEV","nomeGrafico":"Stellantis CC717","score":0.895192307692308,"gate":"MS2"},{"ordem":20,"id":"john-deere-la2093-tractor-5000","nome":"John Deere LA2093 Tractor 5000","nomeGrafico":"John Deere LA2093","score":0.598,"gate":"QG2"},{"ordem":21,"id":"toyota-oc1735-nextb","nome":"Toyota OC1735 NextB","nomeGrafico":"Toyota OC1735","score":0.819711538461539,"gate":"MS1"},{"ordem":22,"id":"{-porsche-oc1049-2-spin-on-}","nome":"{ Porsche OC1049/2 Spin-on }","nomeGrafico":"[ Porsche OC1049/2 ]","score":0.478659188034188,"gate":"EOA"},{"ordem":23,"id":"{-horse-ox1413-hr10-13-ddt-}","nome":"{ Horse OX1413 HR10/13 DDT }","nomeGrafico":"[ Horse OX1413 ]","score":0.725,"gate":"EOA"}],"average":0.765666246947497},"2026":{"target":0.75,"projetos":[{"ordem":24,"id":"nissan-lm682-4-p02-l02dg-aim","nome":"Nissan LM682/4 P02/L02DG AIM","nomeGrafico":"Nissan LM682/4","score":0.836858974358974,"gate":"MS2"},{"ordem":25,"id":"vw-cc731-cc731-1-e-cc732-mqb37","nome":"VW CC731, CC731/1 & CC732 MQB37","nomeGrafico":"VW CC731, 731/1 & 732","score":0.577457264957265,"gate":"QG2"},{"ordem":26,"id":"vw-ccd0013-mqb-37-pl8","nome":"VW CCD0013 MQB 37 PL8","nomeGrafico":"VW CCD0013","score":0.421794871794872,"gate":"QG2"},{"ordem":27,"id":"horse-llr0122-hr10","nome":"Horse LLR0122 HR10","nomeGrafico":"Horse LLR0122","score":0.760683760683761,"gate":"MS2"},{"ordem":28,"id":"horse-llr0123-hr13","nome":"Horse LLR0123 HR13","nomeGrafico":"Horse LLR0123","score":0.760683760683761,"gate":"MS2"},{"ordem":29,"id":"honda-zh250-9-28my-ap2di","nome":"Honda ZH250/9 28MY AP2Di","nomeGrafico":"Honda ZH250/9","score":0.408404558404558,"gate":"QG2"},{"ordem":30,"id":"honda-los169-1-28my-ap2di","nome":"Honda LOS169/1 28MY AP2Di","nomeGrafico":"Honda LOS169/1","score":0.41798433048433,"gate":"QG2"},{"ordem":31,"id":"ford-lma0024-tank-shield-ranger","nome":"Ford LMA0024 Tank Shield Ranger","nomeGrafico":"Ford LMA0024","score":0.630555555555556,"gate":"QG1"},{"ordem":32,"id":"polaris-oil-filter-spin-on-oc1799","nome":"POLARIS Oil Filter Spin On OC1799","nomeGrafico":"Polaris OC1799","score":0.659650997150997,"gate":"MS2"},{"ordem":33,"id":"horse-zh624-bsg-protector","nome":"Horse ZH624 BSG Protector","nomeGrafico":"Horse ZH624 BSG","score":0.768055555555556,"gate":"QG2"},{"ordem":34,"id":"[-john-deere-la2093-tractor-5000-]","nome":"[ John Deere LA2093 Tractor 5000 ]","nomeGrafico":"[ John Deere LA2093 ]","score":0.454594017094017,"gate":"QG3"},{"ordem":35,"id":"honda-lm1093-e-lm1093-1-ap2di","nome":"Honda LM1093 & LM1093/1 AP2Di","nomeGrafico":"Honda LM1093 & 1093/1","score":0.596331908831909,"gate":"QG2"}],"average":0.608793058793059}}};

/* ----------  ----------*/

function _clamp(valor, min, max) {
  return Math.max(min, Math.min(max, valor));
}

function _getAnosVisiveisOrdenados(todosAnos) {
  return todosAnos.filter(ano =>
    dashboardAnosVisiveis.has(ano)
  );
}

function _contarBarrasVisiveis(anosVisiveis) {
  let total = 0;

  anosVisiveis.forEach(ano => {
    const dadosAno = dashboardDados.anos[ano];
    if (!dadosAno || !Array.isArray(dadosAno.projetos)) return;

    // projetos + barra AVG
    total += dadosAno.projetos.length + 1;
  });

  return total;
}

function _aplicarLayoutDashboard(todosAnos) {
  const chart =
    document.getElementById("dashboardChart");

  const area =
    document.querySelector(".chart-area-container");

  if (!chart || !area || !dashboardDados) return;

  const anosVisiveis =
    _getAnosVisiveisOrdenados(todosAnos);

  const qtdAnos =
    anosVisiveis.length;

  const qtdBarras =
    _contarBarrasVisiveis(anosVisiveis);

  if (!qtdAnos || !qtdBarras) return;

  chart.classList.toggle(
    "dashboard-one-year",
    qtdAnos === 1
  );

  const larguraDisponivel =
    area.clientWidth || 1000;

  let sidePad;
  let groupPad;
  let barW;
  let gap;

  if (qtdAnos === 1) {
    sidePad = 24;
    groupPad = 24;

    const larguraUtil =
      larguraDisponivel
      - (sidePad * 2)
      - (groupPad * 2);

    barW =
      larguraUtil /
      (qtdBarras + (qtdBarras - 1) * 0.55);

    barW = _clamp(barW, 42, 72);

    gap =
      _clamp(barW * 0.55, 18, 38);

  } else {
    sidePad =
      qtdAnos === 2 ? 24 : 26;

    groupPad =
      qtdAnos === 2 ? 14 : 12;

    const gapsInternos =
      qtdBarras - qtdAnos;

    const larguraUtil =
      larguraDisponivel
      - (sidePad * 2)
      - (groupPad * 2 * qtdAnos);

    barW =
      larguraUtil /
      (qtdBarras + gapsInternos * 0.28);

    barW = _clamp(barW, 30, 58);

    gap =
      _clamp(barW * 0.28, 8, 16);
  }

  /*
    Escala controlada para nomes:
    - cresce quando o gráfico tem menos anos
    - mas não fica exagerado
  */
  const fontSize =
    _clamp(barW * 0.24, 11, 15.5);

  chart.style.setProperty(
    "--dash-bar-w",
    `${barW}px`
  );

  chart.style.setProperty(
    "--dash-bar-gap",
    `${gap}px`
  );

  chart.style.setProperty(
    "--dash-group-pad",
    `${groupPad}px`
  );

  chart.style.setProperty(
    "--dash-side-pad",
    `${sidePad}px`
  );

  chart.style.setProperty(
    "--dash-name-size",
    `${fontSize}px`
  );
}

function _getDashVar(nome, fallback) {
  const chart =
    document.getElementById("dashboardChart");

  if (!chart) return fallback;

  const valor =
    getComputedStyle(chart)
      .getPropertyValue(nome)
      .trim();

  return valor || fallback;
}


/* ---------- renderizar dashboard ---------- */
function renderizarDashboard() {
  if (!dashboardDados || !dashboardDados.anos) return;

  const anos =
    Object.keys(dashboardDados.anos).sort();

  if (dashboardAnosVisiveis.size === 0) {
    anos.forEach(a =>
      dashboardAnosVisiveis.add(a)
    );
  }

  _configurarDropdown(anos);
  _preencherDropdownOpcoes(anos);
  _aplicarLayoutDashboard(anos);
  _renderizarTudo(anos);

  requestAnimationFrame(() => {
    const wrapper =
      document.querySelector(
        "#kpis-section .chart-scroll-wrapper"
      );

    if (wrapper) {
      wrapper.scrollLeft = 0;
    }

    _aplicarLayoutDashboard(anos);

    requestAnimationFrame(() => {
      _desenharTargetLines(
        [...dashboardAnosVisiveis].sort()
      );

      _atualizarSeparadores(anos);
    });
  });
}

/* ==============================================
   DROPDOWN CHECKBOX
============================================== */
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

  // fechar ao clicar fora
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
        // atualiza visual deste item
        const cb  = item.querySelector(".time-checkbox");
        const ico = item.querySelector(".fa-check");
        if (dashboardAnosVisiveis.has(ano)) {
          cb.classList.add("checked");
          ico.style.display = "";
        } else {
          cb.classList.remove("checked");
          ico.style.display = "none";
        }
        _atualizarLabelBtn(anos);
      });

      dd.appendChild(item);
    });
  });
}

function _toggleAno(ano, todosAnos) {
  if (
    dashboardAnosVisiveis.has(ano) &&
    dashboardAnosVisiveis.size === 1
  ) {
    return;
  }

  const svg =
    document.getElementById("targetSvg");

  if (svg) {
    svg.style.opacity = "0";
  }

  if (dashboardAnosVisiveis.has(ano)) {
    dashboardAnosVisiveis.delete(ano);
    _ocultarGrupo(ano);
  } else {
    dashboardAnosVisiveis.add(ano);
    _aplicarLayoutDashboard(todosAnos);
    _exibirGrupo(ano, todosAnos);
  }

  _aplicarLayoutDashboard(todosAnos);
  _atualizarSeparadores(todosAnos);

  setTimeout(() => {
    _aplicarLayoutDashboard(todosAnos);

    requestAnimationFrame(() => {
      _desenharTargetLines(
        [...dashboardAnosVisiveis].sort()
      );

      _atualizarSeparadores(todosAnos);

      const svgAtual =
        document.getElementById("targetSvg");

      if (svgAtual) {
        svgAtual.style.opacity = "1";
      }
    });
  }, 520);
}

function _atualizarLabelBtn(anos) {
  const visiveis = [...dashboardAnosVisiveis].sort();
  const label = visiveis.length === anos.length
    ? "Tempo"
    : visiveis.join(", ");

  document.querySelectorAll(".time-filter-btn").forEach(btn => {
    btn.innerHTML = `${label} <i class="fa-solid fa-chevron-down"></i>`;
  });
}

/* ==============================================
   ANIMAÇÃO ENTRADA / SAÍDA DE GRUPOS
============================================== */
function _ocultarGrupo(ano) {
  const g =
    document.getElementById(`year-group-${ano}`);

  if (!g) return;

  const nomes =
    g.querySelectorAll(".project-name-wrap");

  /*
    Nomes saem junto com o grupo, usando o mesmo eixo/rotação
    da entrada para evitar salto visual.
  */
  nomes.forEach(nome => {
    nome.style.opacity = "0";
    nome.style.transform =
      "translateX(-100%) rotate(-40deg) translateY(8px)";
  });

  /*
    Trava largura atual antes de animar para zero.
    Isso evita colapso brusco.
  */
  g.style.display = "flex";
  g.style.maxWidth = g.scrollWidth + "px";
  g.style.overflow = "hidden";

  /*
    Força reflow para o navegador reconhecer o estado inicial
    antes da transição.
  */
  g.offsetHeight;

  g.style.transition =
    "max-width 0.45s cubic-bezier(.4,0,.2,1), opacity 0.35s ease, margin 0.45s ease, padding 0.45s ease";

  g.style.opacity = "0";
  g.style.maxWidth = "0";
  g.style.marginRight = "0";
  g.style.paddingLeft = "0";
  g.style.paddingRight = "0";

  /*
    Remove totalmente do layout depois da animação,
    evitando espaço branco entre anos.
  */
  setTimeout(() => {
    if (!dashboardAnosVisiveis.has(ano)) {
      g.style.display = "none";
    }
  }, 470);
}

function _exibirGrupo(ano, todosAnos) {
  const g =
    document.getElementById(`year-group-${ano}`);

  if (!g) {
    _renderizarTudo(todosAnos);
    return;
  }

  const nomes =
    g.querySelectorAll(".project-name-wrap");

  g.style.display = "flex";
  g.style.transition = "none";
  g.style.opacity = "0";
  g.style.maxWidth = "0";
  g.style.marginRight = "";

  const groupPad =
    _getDashVar("--dash-group-pad", "14px");

  g.style.paddingLeft = groupPad;
  g.style.paddingRight = groupPad;

  /*
    Mantém visible para o nome não aparecer atrasado.
  */
  g.style.overflow = "visible";

  nomes.forEach(nome => {
    nome.style.opacity = "0";
    nome.style.transform =
      "translateX(-100%) rotate(-40deg) translateY(8px)";
  });

  const natural =
    g.scrollWidth + "px";

  g.offsetHeight;

  requestAnimationFrame(() => {
    g.style.transition =
      "max-width 0.45s cubic-bezier(.4,0,.2,1), opacity 0.35s ease, padding 0.45s ease";

    g.style.maxWidth = natural;
    g.style.opacity = "1";

    nomes.forEach(nome => {
      nome.style.opacity = "1";
      nome.style.transform =
        "translateX(-100%) rotate(-40deg) translateY(0)";
    });

    setTimeout(() => {
      g.style.maxWidth = "";
      g.style.overflow = "visible";
      g.style.paddingLeft = "";
      g.style.paddingRight = "";
      g.style.marginRight = "";
    }, 470);
  });
}


function _garantirTargetSvg() {
  const chart =
    document.getElementById("dashboardChart");

  if (!chart) return null;

  let svg =
    document.getElementById("targetSvg");

  if (!svg || svg.parentElement !== chart) {
    svg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );

    svg.setAttribute("id", "targetSvg");
    svg.classList.add("target-svg");

    chart.prepend(svg);
  }

  return svg;
}


/* ==============================================
   RENDER COMPLETO
============================================== */
function _renderizarTudo(todosAnos) {
  const chart =
    document.getElementById("dashboardChart");

  if (!chart) return;

  _aplicarLayoutDashboard(todosAnos);

  chart.innerHTML = "";

  const svg = _garantirTargetSvg();

  if (svg) {
    svg.innerHTML = "";
  }

  todosAnos.forEach((ano, idx) => {
    const dadosAno =
      dashboardDados.anos[ano];

    if (!dadosAno) return;

    const grupo =
      _criarGrupoAno(
        ano,
        dadosAno,
        idx,
        todosAnos.length
      );

    chart.appendChild(grupo);

    if (!dashboardAnosVisiveis.has(ano)) {
      grupo.style.maxWidth = "0";
      grupo.style.opacity = "0";
      grupo.style.overflow = "hidden";
      grupo.style.marginRight = "0";
      grupo.style.display = "none";
    }
  });

  requestAnimationFrame(() => {
    _desenharTargetLines(
      [...dashboardAnosVisiveis].sort()
    );

    _atualizarSeparadores(todosAnos);
  });
}

function _criarGrupoAno(ano, dadosAno, idx, total) {
  const projetos = dadosAno.projetos;
  const average  = dadosAno.average;
  const bgColor  = YEAR_COLORS[ano] || "#eaf0fa";

  const grupo = document.createElement("div");
  grupo.className  = `year-group year-${ano}`;
  grupo.id         = `year-group-${ano}`;
  grupo.style.background = bgColor;

  // separador à direita (exceto último)
  if (idx < total - 1) {
    grupo.dataset.hasSep = "true";
  }

  /* rótulo do ano (centralizado, abaixo) */
  const anoLabel = document.createElement("div");
  anoLabel.className   = "year-label";
  anoLabel.textContent = ano;
  grupo.appendChild(anoLabel);

  /* barras de projeto */
  projetos.forEach(proj => {
    const barraWrap = _criarBarra(proj, ano);
    grupo.appendChild(barraWrap);
  });

  /* barra AVG */
  grupo.appendChild(_criarBarraAvg(average));

  return grupo;
}

/* ==============================================
   BARRA INDIVIDUAL
============================================== */
function _criarBarra(proj, ano) {
  const auditSeq  = ehAuditSequence(proj.nomeGrafico);
  const nomeCurto = nomeExibicao(proj.nomeGrafico);
  const nomeCompl = nomeExibicao(proj.nome); // remove colchetes do nome completo também
  const pct       = scorePct(proj.score);
  const alturaPx  = Math.max(20, Math.round((pct / 100) * BAR_HEIGHT_MAX));
  const cor       = corBarra(proj.score);
  const sombra    = corBarraSombra(proj.score);

  /* wrapper principal */
  const wrap = document.createElement("div");
  wrap.className = "bar-wrap";

  /* score acima da barra */
  const scoreLabel = document.createElement("span");
  scoreLabel.className = "score-label";
  scoreLabel.textContent = `${pct}%`;

  /* barra */
  const barra = document.createElement("div");
  barra.className = "project-bar";
  barra.dataset.id = proj.id;
  barra.dataset.ano = ano;

  barra.style.height = `${alturaPx}px`;
  barra.style.background = cor;
  barra.style.boxShadow = `0 8px 22px ${sombra}`;

  /* gate no centro da barra */
  const gateWrap = document.createElement("span");
  gateWrap.className = "gate-wrap";

  const gateLabel = document.createElement("span");
  gateLabel.className = "gate-label";
  gateLabel.textContent = proj.gate;

  gateWrap.appendChild(gateLabel);
  barra.appendChild(gateWrap);

  /* nome diagonal abaixo da barra */
  const nameWrap = document.createElement("div");
  nameWrap.className = "project-name-wrap";

  const nameEl = document.createElement("span");
  nameEl.className = "project-name";
  nameEl.dataset.curto = nomeCurto;
  nameEl.dataset.completo = nomeCompl;
  nameEl.textContent = nomeCurto;

  nameWrap.appendChild(nameEl);

  /* símbolo de audit sequence */
  if (auditSeq) {
    const seqBadge = document.createElement("span");
    seqBadge.className = "audit-seq-badge";
    seqBadge.title = "Audit Sequence";
    seqBadge.textContent = "⟲";

    nameWrap.appendChild(seqBadge);
  }

  /* monta estrutura final */
  wrap.appendChild(scoreLabel);
  wrap.appendChild(barra);
  wrap.appendChild(nameWrap);

  /* hover */
  barra.addEventListener("mouseenter", () => {
    nameEl.textContent = nomeCompl;
    nameEl.style.fontWeight = "800";
    nameEl.style.color = "#0a2a6e";

    barra.style.transform = "translateY(-6px) scaleX(1.1)";
    barra.style.filter = "brightness(1.07)";
    barra.style.zIndex = "10";
  });

  barra.addEventListener("mouseleave", () => {
    nameEl.textContent = nomeCurto;
    nameEl.style.fontWeight = "";
    nameEl.style.color = "";

    barra.style.transform = "";
    barra.style.filter = "";
    barra.style.zIndex = "";
  });

  /* clique → auditoria */
  barra.addEventListener("click", () => {
    abrirAuditoria(proj.id, nomeCompl, ano);
  });

  return wrap;
}


/* ==============================================
   BARRA AVG
============================================== */
function _criarBarraAvg(average) {
  const pct = scorePct(average);
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
  nameWrap.appendChild(nameEl);

  wrap.appendChild(scoreLabel);
  wrap.appendChild(barra);
  wrap.appendChild(nameWrap);

  return wrap;
}


/* ==============================================
   SEPARADORES ENTRE ANOS
============================================== */
function _atualizarSeparadores(todosAnos) {
  const visiveis = new Set(dashboardAnosVisiveis);
  const anosVis  = todosAnos.filter(a => visiveis.has(a));

  todosAnos.forEach(ano => {
    const g = document.getElementById(`year-group-${ano}`);
    if (!g) return;
    // separador existe se este ano é visível e não é o último visível
    const idxVis = anosVis.indexOf(ano);
    if (visiveis.has(ano) && idxVis < anosVis.length - 1) {
      g.dataset.hasSep = "true";
    } else {
      delete g.dataset.hasSep;
    }
  });
}

/* ==============================================
   LINHA TARGET (SVG)
============================================== */

function _atualizarTargetLabel(anosVisiveis) {
  const el = document.getElementById("target-legend-values");
  if (!el || !dashboardDados) return;

  const anosOrdenados = [...anosVisiveis].sort();

  const linhas = anosOrdenados.map(ano => {
    const target = dashboardDados.anos[ano]?.target || 0;
    return `${ano}: ${Math.round(target * 100)}%`;
  });

  el.innerHTML = linhas.join("<br>");
}


function _desenharTargetLines(anosVisiveis) {
  const chart = document.getElementById("dashboardChart");
  const svg = _garantirTargetSvg();

  if (!chart || !svg || !dashboardDados || !dashboardDados.anos) {
    return;
  }

  svg.innerHTML = "";

  const chartRect = chart.getBoundingClientRect();
  const chartH = chart.offsetHeight;

  const targetColor = "#ca221f";
  const suavizacao = 14; // controle da inclinação

  const anosOrdenados = anosVisiveis
    .filter(ano => dashboardDados.anos[ano])
    .sort();

  // pré-calcula posições Y para evitar erro na conexão
  const pontos = anosOrdenados.map(ano => {
    const dadosAno = dashboardDados.anos[ano];
    const grupo = document.getElementById(`year-group-${ano}`);

    if (!dadosAno || !grupo || grupo.style.display === "none") {
      return null;
    }

    const target = Number(dadosAno.target || 0);
    const targetPx = Math.round(target * BAR_HEIGHT_MAX);

    const y = chartH - CHART_PAD_BOT - targetPx;

    const grupoRect = grupo.getBoundingClientRect();

    const x1 = grupoRect.left - chartRect.left;
    const x2 = grupoRect.right - chartRect.left;

    return { ano, x1, x2, y };
  }).filter(Boolean);

  pontos.forEach((ponto, i) => {
    const atual = ponto;
    const proximo = pontos[i + 1];

    let xStart = atual.x1;
    let xEnd   = atual.x2;

    const temMudanca =
      proximo && Math.abs(atual.y - proximo.y) > 1;

    // se tiver mudança, corta a linha horizontal
    if (temMudanca) {
      xEnd = atual.x2 - suavizacao;
    }

    // se veio de uma mudança anterior, inicia recuado
    const anterior = pontos[i - 1];
    if (anterior && Math.abs(anterior.y - atual.y) > 1) {
      xStart = atual.x1 + suavizacao;
    }

    /*
      LINHA HORIZONTAL (JA COM TRIM)
    */
    const line = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "line"
    );

    line.setAttribute("x1", xStart);
    line.setAttribute("y1", atual.y);
    line.setAttribute("x2", xEnd);
    line.setAttribute("y2", atual.y);

    line.setAttribute("stroke", targetColor);
    line.setAttribute("stroke-width", "3");
    line.setAttribute("stroke-linecap", "round");
    line.setAttribute("opacity", "0.95");

    svg.appendChild(line);

    /*
      CONEXÃO INCLINADA (SEM SOBRA)
    */
    if (temMudanca) {
      const diagonal = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "line"
      );

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
  _atualizarTargetLabel(anosVisiveis);
}


/* ==============================================
   NAVEGAR PARA AUDITORIA
============================================== */
function abrirAuditoria(projetoId, projetoNome, ano) {
  const menuItems = document.querySelectorAll(".menu-item");
  menuItems.forEach(btn => btn.classList.remove("active"));

  const btnAudit = [...menuItems].find(btn => btn.dataset.section === "auditorias");
  if (btnAudit) btnAudit.classList.add("active");

  document.querySelectorAll(".page-section")
    .forEach(sec => sec.classList.remove("active-section"));

  const secAudit = document.getElementById("auditorias-section");
  if (secAudit) secAudit.classList.add("active-section");

  const title = document.getElementById("section-title");
  if (title) title.textContent = "Auditorias";

  _carregarAuditoriaDetalhe(projetoId, projetoNome, ano);
}

function _carregarAuditoriaDetalhe(id, nome, ano) {
  const sec = document.getElementById("auditorias-section");
  if (!sec) return;

  sec.innerHTML = `
    <div class="auditoria-detalhe-card" id="auditoria-detalhe">
      <button class="auditoria-back-btn" onclick="voltarAuditorias()">
        <i class="fa-solid fa-arrow-left"></i> Voltar
      </button>
      <div class="auditoria-detalhe-header">
        <div class="auditoria-detalhe-titulo">${nome}</div>
        <span class="auditoria-detalhe-ano">${ano}</span>
      </div>
      <div class="coming-soon-card" style="margin-top:32px;">
        <i class="fa-solid fa-folder-open"></i>
        <h2>Auditoria em desenvolvimento</h2>
        <p>Os detalhes da auditoria do projeto <strong>${nome}</strong> (${ano}) serão exibidos aqui em breve.</p>
        <p style="margin-top:8px;font-size:13px;color:#aab;">ID: ${id}</p>
      </div>
    </div>
  `;
}

function voltarAuditorias() {
  const sec = document.getElementById("auditorias-section");
  if (!sec) return;
  sec.innerHTML = `
    <div class="coming-soon-card">
      <i class="fa-solid fa-folder-open"></i>
      <h2>Auditorias</h2>
      <p>Em breve esta seção reunirá histórico, comparativos e análises detalhadas.</p>
    </div>
  `;
}