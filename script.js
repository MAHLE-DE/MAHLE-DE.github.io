let dados = {};

fetch("/dados.json?v=" + Date.now())
  .then(res => res.json())
  .then(json => {
    console.log("Chaves:", Object.keys(json));
    dados = json;
    preencherLista();
  });

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

document.getElementById("lista").addEventListener("change", function () {
  const de = this.value;
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
