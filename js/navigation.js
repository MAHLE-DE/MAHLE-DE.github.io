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
				"Audits"
			};
			title.textContent =
			  nomes[section];

			if (section === "kpis") {
			  setTimeout(() => {
				gerarGraficoDEs();
				carregarDashboard();
			  }, 50);
			  setTimeout(() => {
				recalcularDashboard();
			  }, 120);
			}

            if (section === "auditorias") {
              abrirAuditsHome();
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
  }
);
