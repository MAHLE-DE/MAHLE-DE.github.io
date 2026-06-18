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

          resetarFiltrosDaSecao(
            section
          );

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
				"Project Backlogs",
			  kpis:
				"KPIs",
			  auditorias:
				"Audits",
        "audit-schedule":
        "Audit Schedule",
        acquisition:
        "Acquisition",
        benchmark:
        "Benchmark"
			};
			title.textContent =
			  nomes[section];

			if (section === "kpis") {
        if (typeof resetarFiltrosDashboard === "function") {
          resetarFiltrosDashboard();
        }
			  setTimeout(() => {
				gerarGraficoDEs();
				carregarDashboard();
			  }, 50);
			  setTimeout(() => {
				recalcularDashboard();
			  }, 120);
			}

            if (section === "auditorias") {
              abrirAuditsAtual();
            }

            if (section === "acquisition") {
              abrirAcquisition();
            }

            if (section === "audit-schedule") {
              abrirAuditSchedule();
            }
        }
      );
    });
  });

function resetarFiltrosDaSecao(section) {
  if (
    section === "pendencias" &&
    typeof resetarFiltrosBacklogs === "function"
  ) {
    resetarFiltrosBacklogs();
  }

  if (
    section === "acquisition" &&
    typeof resetarFiltrosAcquisition === "function"
  ) {
    resetarFiltrosAcquisition();
  }

  if (
    section === "auditorias" &&
    typeof resetarFiltrosAudits === "function"
  ) {
    resetarFiltrosAudits();
  }

  if (typeof aplicarBotoesLimparBusca === "function") {
    aplicarBotoesLimparBusca();
  }
}

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
   LOGIN / LOGOUT BUTTONS
========================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const loginBtn =
      document.getElementById("loginBtn");

    const logoutBtn =
      document.getElementById("logoutBtn");

    if (loginBtn) {
      loginBtn.addEventListener("click", login);
    }

    if (logoutBtn) {
      logoutBtn.addEventListener("click", logout);
    }

    configurarBotoesLimparBusca();
  }
);

/* ==========================
   CLEAR SEARCH BUTTONS
========================== */

function configurarBotoesLimparBusca() {
  aplicarBotoesLimparBusca();

  document.addEventListener("input", event => {
    if (_ehCampoBuscaLimpavel(event.target)) {
      _atualizarBotaoLimparBusca(event.target);
    }
  });

  const observer =
    new MutationObserver(() => {
      aplicarBotoesLimparBusca();
    });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function aplicarBotoesLimparBusca() {
  document
    .querySelectorAll("input[type='search'], #searchProjeto")
    .forEach(input => {
      if (!_ehCampoBuscaLimpavel(input)) return;

      const host =
        input.parentElement;

      if (!host) return;

      host.classList.add("search-clear-host");
      input.dataset.searchClear = "true";

      let button =
        host.querySelector(
          ".search-clear-btn"
        );

      if (!button) {
        button =
          document.createElement("button");

        button.type = "button";
        button.className = "search-clear-btn";
        button.setAttribute("aria-label", "Clear search");
        button.innerHTML = '<i class="fa-solid fa-xmark"></i>';

        button.addEventListener("click", event => {
          event.preventDefault();
          event.stopPropagation();

          input.value = "";
          input.dispatchEvent(
            new Event("input", {
              bubbles: true
            })
          );
          input.focus();
          _atualizarBotaoLimparBusca(input);
        });

        host.appendChild(button);
      }

      _atualizarBotaoLimparBusca(input);
    });
}

function _ehCampoBuscaLimpavel(input) {
  return (
    input &&
    input.tagName === "INPUT" &&
    (
      input.type === "search" ||
      input.id === "searchProjeto"
    )
  );
}

function _atualizarBotaoLimparBusca(input) {
  const button =
    input.parentElement?.querySelector(
      ".search-clear-btn"
    );

  if (!button) return;

  button.classList.toggle(
    "visible",
    Boolean(input.value)
  );
}
