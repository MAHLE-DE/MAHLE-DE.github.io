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