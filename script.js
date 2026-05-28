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

function esconderLoading() {}