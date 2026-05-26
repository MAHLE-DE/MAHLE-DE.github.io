
let dados = {};

// CONFIG FIREBASE (SEU CONFIG)
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

  if (user) {
    // entrou
    document.getElementById("login-container").style.display = "none";
    document.getElementById("app").style.display = "block";

    iniciarSite(); // inicia seu código atual
  } else {
    // bloqueado
    document.getElementById("login-container").style.display = "block";
    document.getElementById("app").style.display = "none";
  }

});

// SISTEMA ORIGINAL (SEM ALTERAÇÃO)
function iniciarSite() {

  fetch("/dados.json?v=" + Date.now())
    .then(res => res.json())
    .then(json => {
      console.log("Chaves:", Object.keys(json));
      dados = json;
      preencherLista();
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

// SUA LÓGICA ORIGINAL DE EVENTO
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
