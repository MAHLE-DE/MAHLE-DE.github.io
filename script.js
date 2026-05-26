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

  if (user) {
    document.getElementById("login-container").style.display = "none";
    document.getElementById("app").style.display = "block";

    iniciarSite(); // chama Firestore agora
  } else {
    document.getElementById("login-container").style.display = "block";
    document.getElementById("app").style.display = "none";
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
          jsonCompleto = JSON.parse(item.jsonCompleto);
        } catch (e) {
          console.error("Erro ao parsear JSON:", e);
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
