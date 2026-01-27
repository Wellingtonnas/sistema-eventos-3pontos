// ===========================
//  USUÁRIOS
// ===========================

const admins = {
    "ALEXANDRE": "alex123",
    "LUCIANA": "luciana123",
    "VALERIA": "valeria123",
    "HUGO": "hugo123",
    "JOÃO": "joao123"
};

const producao = {
    "MAURO": "mauro123"
};

// ===========================
//  LOGIN
// ===========================

function login() {
    const user = document.getElementById("user").value.trim().toUpperCase();
    const pass = document.getElementById("pass").value.trim();
    const erro = document.getElementById("erro");

    erro.innerText = "";

    // ADMIN
    if (admins[user] && admins[user] === pass) {
        localStorage.setItem("nivelAcesso", "admin");
        localStorage.setItem("usuarioLogado", user);
        window.location.href = "cronograma.html";
        return;
    }

    // PRODUÇÃO
    if (producao[user] && producao[user] === pass) {
        localStorage.setItem("nivelAcesso", "producao");
        localStorage.setItem("usuarioLogado", user);
        window.location.href = "cronograma.html";
        return;
    }

    erro.innerText = "Usuário ou senha incorretos!";
}

// ===========================
//  VISUALIZADOR (sem login)
// ===========================

function entrarVisualizador() {
    localStorage.setItem("nivelAcesso", "visual");
    localStorage.setItem("usuarioLogado", "VISUALIZADOR");
    window.location.href = "cronograma.html";
}
