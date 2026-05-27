let dados = {};

// CONFIG FIREBASE
const firebaseConfig = {
  apiKey: "AIzaSyBreppRJPaHXwz3K_QB_79EU2C4rGEF9Gk",
  authDomain: "site-mahle.firebaseapp.com",
  projectId: "site-mahle",
  storageBucket: "site-mahle.firebasestorage.app",
  messagingSenderId: "726211952088",
  appId: "1:726211952088:web:383864b51bc9f703b406ad"
};

// INICIA FIREBASE
firebase.initializeApp(firebaseConfig);

// LOGIN
function login() {
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  firebase.auth().signInWithEmailAndPassword(email, senha)
    .catch(error => alert(error.message));
}

// LOGOUT
function logout() {
  firebase.auth().signOut();
}

// CONTROLE DE ACESSO
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

    // ESCONDE LOGIN
    loginContainer.classList.add("hidden");

    loginBackground.style.display = "block";
    loginBackground.classList.add("hidden");

    loginLogo.style.display = "block";
    loginLogo.classList.add("hidden");

    // MOSTRA APP
    app.style.display = "block";

    iniciarSite();

  } else {

    // MOSTRA LOGIN
    loginContainer.classList.remove("hidden");

    // RELIGA SLIDESHOW
    loginBackground.style.display = "block";
    loginBackground.classList.remove("hidden");

    // RELIGA LOGO
    loginLogo.style.display = "block";
    loginLogo.classList.remove("hidden");

    // ESCONDE APP
    app.style.display = "none";
  }

});

// ✅ NOVO: CARREGAR DO FIRESTORE (SUBSTITUI FETCH)
function iniciarSite() {

  firebase.firestore().collection("projetos").get()
    .then(snapshot => {

      dados = {};

      snapshot.forEach(doc => {

        const item = doc.data();

        const DE = item.DE;
        const projeto = item.projeto;

        // JSON salvo pelo VBA
        let jsonCompleto;
        
        try {
        
          const textoCorrigido = item.jsonCompleto
            .replace(/'/g, '"'); // corrige aspas simples
        
          jsonCompleto = JSON.parse(textoCorrigido);
        
        } catch (e) {
          console.error("Erro ao parsear JSON:", item.jsonCompleto);
          return;
        }


        if (!dados[DE]) {
          dados[DE] = { projetos: {} };
        }

        dados[DE].projetos[projeto] = {
          documentos: jsonCompleto.documentos
        };

      });

      console.log("Dados carregados do Firestore:", dados);

      preencherLista();
    })
    .catch(err => {
      console.error("Erro ao carregar Firestore:", err);
    });

}

// LISTA ORIGINAL
function preencherLista() {
  const select = document.getElementById("lista");

  select.innerHTML = '<option value="">Selecione um DE</option>';

  Object.keys(dados).forEach(de => {
    const option = document.createElement("option");
    option.value = de;
    option.textContent = de;
    select.appendChild(option);
  });
}

// EVENTO ORIGINAL (INALTERADO)
document.addEventListener("change", function (e) {

  if (e.target.id !== "lista") return;

  const de = e.target.value;
  const container = document.getElementById("projetos");

  container.innerHTML = "";

  if (!de || !dados[de]) return;

  const projetos = Object.entries(dados[de].projetos);

  projetos.forEach(([nomeProjeto, info], index) => {
    const card = document.createElement("div");
    card.className = "card";

    let html = `<h3>${nomeProjeto}</h3>`;

    const docs = Object.entries(info.documentos);

    docs.forEach(([docNome, doc]) => {

      if (typeof doc !== "object") return;

      html += `
        <div style="margin-top:10px;">
          <strong>${docNome}</strong> (${doc.gate} | ${doc.pontuacao})
          <ul>
      `;

      if (Array.isArray(doc.pendencias)) {
        doc.pendencias.forEach(p => {
          html += `<li>${p}</li>`;
        });
      }

      html += "</ul></div>";
    });

    card.innerHTML = html;

    if (projetos.length % 2 !== 0 && index === projetos.length - 1) {
      card.classList.add("full");
    }

    container.appendChild(card);
  });
  

});


document.addEventListener("keydown", function (e) {

  if (e.key === "Enter") {

    const email = document.getElementById("email");
    const senha = document.getElementById("senha");

    // se o campo ativo for email ou senha → faz login
    if (document.activeElement === email || document.activeElement === senha) {
      e.preventDefault(); // evita comportamento padrão
      login();
    }

  }

});

// MOSTRAR/ESCONDER SENHA
document.addEventListener("DOMContentLoaded", () => {

  const senhaInput =
    document.getElementById("senha");

  const toggleSenha =
    document.getElementById("toggleSenha");

  if (!senhaInput || !toggleSenha) return;

  toggleSenha.addEventListener("click", () => {

    const senhaVisivel =
      senhaInput.type === "text";

    senhaInput.type =
      senhaVisivel ? "password" : "text";

    toggleSenha.className =
      senhaVisivel
        ? "fa-regular fa-eye-slash password-toggle"
        : "fa-regular fa-eye password-toggle";
  });

});