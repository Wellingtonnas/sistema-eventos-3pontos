/* ================== AUTH ================== */
async function requireAuth() {
  const { data } = await window.supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = "login.html";
    return null;
  }

  const userId = data.session.user.id;

  const { data: perfil, error } = await window.supabaseClient
    .from("profiles")
    .select("nome, role")
    .eq("id", userId)
    .single();

  if (error || !perfil) {
    window.location.href = "login.html";
    return null;
  }

  localStorage.setItem("usuarioLogado", perfil.nome);
  localStorage.setItem(
    "nivelAcesso",
    perfil.role === "superadmin" ? "admin" : perfil.role,
  );

  return perfil;
}

/* ================== HELPERS ================== */
function getNivel() {
  return localStorage.getItem("nivelAcesso") || "visual";
}
function getUsuario() {
  return localStorage.getItem("usuarioLogado") || "—";
}
function isAdmin() {
  return getNivel() === "admin";
}
function isProducao() {
  return getNivel() === "producao";
}
function safeText(v) {
  return v == null || v === "" ? "—" : v;
}
function ymd(v) {
  return v ? String(v).slice(0, 10) : null;
}
function getEventIdFromURL() {
  const params = new URLSearchParams(window.location.search);
  return Number(params.get("id"));
}

/** ✅ força dd/mm/aaaa (e hora) */
function fmtBRDateTime(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR");
}

/* ================== STORAGE / TABLES ================== */
const BUCKET_PDFS = "pdfs";
const PROJECT_FILES_TABLE = "project_files";
const STAGE_HISTORY_TABLE = "project_stage_history";

/* ================== LISTAS ================== */
const vendedores = ["ALEXANDRE", "LUCIANA", "VALERIA", "HUGO"];
const projetistas = ["BEATRIZ", "MAYARA", "MAURO", "JAILDO"];

const statusList = [
  { nome: "APROVADO", cor: "verde" },
  { nome: "CANCELADO", cor: "vermelho" },
  { nome: "EM APROVAÇÃO", cor: "amarelo" },
];

const operacionalList = [
  { nome: "PRODUÇÃO/ESPERA MATERIAL", cor: "vermelho" },
  { nome: "ESPERA MATERIAL", cor: "vermelho" },
  { nome: "REVESTIMENTO", cor: "vermelho" },
  { nome: "ESPERA DE IMPRESSÃO", cor: "vermelho" },
  { nome: "CONCLUÍDO", cor: "verde" },
  { nome: "PRODUÇÃO", cor: "amarelo" },
];

const impressaoList = [
  { nome: "ESPERA DE IMAGEM", cor: "vermelho" },
  { nome: "ESPERA DE IMAGEM E LOGO", cor: "vermelho" },
  { nome: "ESPERA DE LOGO", cor: "vermelho" },
  { nome: "ESPERA PRÉ MONTAGEM", cor: "vermelho" },
  { nome: "PRODUÇÃO", cor: "amarelo" },
  { nome: "CONCLUÍDO", cor: "verde" },
];

const cortesList = [
  { nome: "ESPERA DE LOGO CORTES", cor: "vermelho" },
  { nome: "ESPARA DE MATERIAL", cor: "vermelho" },
  { nome: "ESPERA PRÉ MONTAGEM", cor: "vermelho" },
  { nome: "PRODUÇÃO", cor: "amarelo" },
  { nome: "CONCLUÍDO", cor: "verde" },
];

const eletricaList = [
  { nome: "ESPERA MATERIAL", cor: "vermelho" },
  { nome: "PRODUÇÃO", cor: "amarelo" },
  { nome: "CONCLUÍDO", cor: "verde" },
];

const serralhariaList = [
  { nome: "PRODUÇÃO", cor: "amarelo" },
  { nome: "ESPERA MATERIAL", cor: "vermelho" },
  { nome: "CONCLUÍDO", cor: "verde" },
];

/* ================== PERMISSÕES ================== */
function podeEditarCampo(campo) {
  const nivel = getNivel();

  if (nivel === "admin") {
    // ✅ vendedor2 incluído
    return ["nome_projeto", "vendedor", "vendedor2", "projetista", "status"].includes(campo);
  }

  if (nivel === "producao") {
    return ["operacional", "impressao", "cortes", "eletrica", "serralharia"].includes(campo);
  }

  return false;
}

/* ================== STATE ================== */
let currentProjects = [];
let lastStageTimeByProject = {};
let hasPdfByProject = {};

/* ================== INIT ================== */
document.addEventListener("DOMContentLoaded", async () => {
  const perfil = await requireAuth();
  if (!perfil) return;

  const eventId = getEventIdFromURL();
  if (!eventId) {
    alert("Evento inválido.");
    history.back();
    return;
  }

  if (!isAdmin()) {
    document.getElementById("btnAddProjeto")?.remove();
  }

  await carregarResumoEvento(eventId);
  await renderProjetos(eventId);

  document.getElementById("btnAddProjeto")?.addEventListener("click", () => {
    if (!isAdmin()) return alert("Somente ADMIN pode adicionar projetos.");
    document.getElementById("modal")?.classList.remove("hidden");
  });
});

/* ================== RESUMO EVENTO ================== */
async function carregarResumoEvento(eventId) {
  const { data, error } = await window.supabaseClient
    .from("events")
    .select("nome, endereco, periodo_inicio, periodo_fim")
    .eq("id", eventId)
    .single();

  if (error) {
    console.error(error);
    alert("Sem permissão para ler o evento (verifique RLS).");
    return;
  }

  document.getElementById("evNome").innerText = safeText(data?.nome);
  document.getElementById("evEndereco").innerText = safeText(data?.endereco);

  // (aqui é só data, não hora)
  const pi = data?.periodo_inicio ? new Date(data.periodo_inicio).toLocaleDateString("pt-BR") : "—";
  const pf = data?.periodo_fim ? new Date(data.periodo_fim).toLocaleDateString("pt-BR") : "—";
  document.getElementById("evPeriodo").innerText = `${pi} a ${pf}`;
}

/* ================== MODAL ADD PROJECT ================== */
function fecharModal() {
  document.getElementById("modal")?.classList.add("hidden");
  const i = document.getElementById("projNome");
  if (i) i.value = "";
}

async function adicionarProjeto() {
  if (!isAdmin()) return alert("Somente ADMIN pode adicionar projetos.");

  const eventId = getEventIdFromURL();
  const nome = document.getElementById("projNome")?.value?.trim();
  if (!nome) return alert("Digite o nome do projeto");

  const payload = {
    event_id: eventId,
    nome_projeto: nome,
    vendedor: null,
    vendedor2: null, // ✅ novo campo
    projetista: null,
    status: null,
    operacional: null,
    impressao: null,
    cortes: null,
    eletrica: null,
    serralharia: null,
  };

  const { error } = await window.supabaseClient.from("projects").insert(payload);

  if (error) {
    console.error(error);
    alert("Erro ao adicionar projeto: " + error.message);
    return;
  }

  fecharModal();
  await renderProjetos(eventId);
}

/* ================== RENDER ================== */
async function renderProjetos(eventId) {
  const tbody = document.getElementById("listaProjetos");
  if (!tbody) return;
  tbody.innerHTML = "";

  const { data, error } = await window.supabaseClient
    .from("projects")
    .select("*")
    .eq("event_id", eventId)
    .order("id", { ascending: true });

  if (error) {
    console.error(error);
    alert("Erro ao carregar projetos: " + error.message);
    return;
  }

  currentProjects = data || [];

  if (!currentProjects.length) {
    const tr = document.createElement("tr");
    // ✅ se você adicionou Vendedor 2, ajuste o colspan no HTML também
    tr.innerHTML = `<td colspan="12" style="color:#aaa;padding:14px;">Nenhum projeto cadastrado.</td>`;
    tbody.appendChild(tr);
    return;
  }

  const projectIds = currentProjects.map((p) => p.id);

  await carregarUltimasHoras(projectIds);
  await carregarStatusPdf(projectIds);

  currentProjects.forEach((proj) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>
        <div style="display:flex; gap:6px; align-items:center; justify-content:center;">
          <b>${proj.id}</b>

          ${isAdmin() ? `<button title="Anexar PDF" style="${btnIconStyle()}" onclick="uploadPDFProjeto(${proj.id})">📥</button>` : ""}

          ${
            hasPdfByProject[proj.id]
              ? `<button title="Visualizar PDF" style="${btnIconStyle()}" onclick="visualizarPDFProjeto(${proj.id})">📄</button>`
              : ""
          }
        </div>
      </td>

      <td>${renderInputNomeProjeto(proj)}</td>

      <td>${renderSelectSimple(vendedores, proj, "vendedor")}</td>
      <td>${renderSelectVendedor2(vendedores, proj)}</td>
      <td>${renderSelectSimple(projetistas, proj, "projetista")}</td>

      ${renderColunaStage(proj, "status", statusList)}
      ${renderColunaStage(proj, "operacional", operacionalList)}
      ${renderColunaStage(proj, "impressao", impressaoList)}
      ${renderColunaStage(proj, "cortes", cortesList)}
      ${renderColunaStage(proj, "eletrica", eletricaList)}
      ${renderColunaStage(proj, "serralharia", serralhariaList)}

      <td>—</td>
    `;

    tbody.appendChild(tr);
  });
}

/* ================== UI BUILDERS ================== */
function btnIconStyle() {
  return "background:transparent;border:1px solid #333;color:#fff;padding:4px 8px;border-radius:6px;cursor:pointer;";
}

function corClassStage(valor) {
  const lista = [
    ...statusList,
    ...operacionalList,
    ...impressaoList,
    ...cortesList,
    ...eletricaList,
    ...serralhariaList,
  ];
  const item = lista.find((i) => i.nome === valor);
  return item ? item.cor : "";
}

function renderInputNomeProjeto(proj) {
  const disabled = !podeEditarCampo("nome_projeto") ? "disabled" : "";
  const value = safeText(proj.nome_projeto) === "—" ? "" : proj.nome_projeto;

  return `
    <input
      style="width: 95%; padding:6px; border-radius:6px; border:1px solid #333; background:#111; color:#fff;"
      ${disabled}
      value="${escapeHtml(value || "")}"
      onchange="atualizarCampo(${proj.id}, 'nome_projeto', this.value, false)"
      placeholder="Nome do projeto"
    />
  `;
}

function renderSelectSimple(lista, proj, campo) {
  const disabled = !podeEditarCampo(campo) ? "disabled" : "";

  return `
    <select ${disabled}
      style="width: 95%; padding:6px; border-radius:6px; border:1px solid #333; background:#111; color:#fff;"
      onchange="atualizarCampo(${proj.id}, '${campo}', this.value, false)">
      <option value="">--</option>
      ${lista
        .map((v) => {
          const selected = proj[campo] === v ? "selected" : "";
          return `<option value="${escapeHtml(v)}" ${selected}>${escapeHtml(v)}</option>`;
        })
        .join("")}
    </select>
  `;
}

/** ✅ Vendedor2 sem repetir o vendedor1 */
function renderSelectVendedor2(lista, proj) {
  const campo = "vendedor2";
  const disabled = !podeEditarCampo(campo) ? "disabled" : "";

  const vendedor1 = proj.vendedor || "";
  const opcoes = lista.filter((v) => v !== vendedor1);

  return `
    <select ${disabled}
      style="width: 95%; padding:6px; border-radius:6px; border:1px solid #333; background:#111; color:#fff;"
      onchange="atualizarCampo(${proj.id}, '${campo}', this.value, false)">
      <option value="">--</option>
      ${opcoes
        .map((v) => {
          const selected = proj[campo] === v ? "selected" : "";
          return `<option value="${escapeHtml(v)}" ${selected}>${escapeHtml(v)}</option>`;
        })
        .join("")}
    </select>
  `;
}

function renderColunaStage(proj, campo, lista) {
  const disabled = !podeEditarCampo(campo) ? "disabled" : "";
  const cor = corClassStage(proj[campo]);
  const hora = lastStageTimeByProject?.[proj.id]?.[campo] || "";

  return `
    <td class="${cor}">
      <select ${disabled}
        style="width: 95%; padding:6px; border-radius:6px; border:1px solid #333; background:#111; color:#fff;"
        onchange="atualizarCampo(${proj.id}, '${campo}', this.value, true)">
        <option value="">--</option>
        ${lista
          .map((item) => {
            const selected = proj[campo] === item.nome ? "selected" : "";
            return `<option value="${escapeHtml(item.nome)}" ${selected}>${escapeHtml(item.nome)}</option>`;
          })
          .join("")}
      </select>

      <div style="font-size:12px; color:#ddd; margin-top:4px; min-height:14px;">
        ${hora ? `🕒 ${escapeHtml(hora)}` : ""}
      </div>

      <div style="margin-top:6px;">
        <button
          style="background:#222;color:#fff;border:1px solid #333;padding:6px 10px;border-radius:6px;cursor:pointer;"
          onclick="abrirHistoricoStage(${proj.id}, '${campo}')">
          Histórico
        </button>
      </div>
    </td>
  `;
}

/* ================== LOAD last hours (stage history) ================== */
async function carregarUltimasHoras(projectIds) {
  lastStageTimeByProject = {};
  if (!projectIds?.length) return;

  const { data, error } = await window.supabaseClient
    .from(STAGE_HISTORY_TABLE)
    .select("project_id, stage, created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.warn("Falha ao carregar última hora dos stages:", error.message);
    return;
  }

  for (const h of data || []) {
    const pid = h.project_id;
    const stage = h.stage;
    const dt = fmtBRDateTime(h.created_at);

    if (!pid || !stage || dt === "—") continue;
    if (!lastStageTimeByProject[pid]) lastStageTimeByProject[pid] = {};
    if (lastStageTimeByProject[pid][stage]) continue;
    lastStageTimeByProject[pid][stage] = dt;
  }
}

/* ================== UPDATE + HISTORY ================== */
async function atualizarCampo(projectId, campo, valor, isStage) {
  if (!podeEditarCampo(campo)) {
    alert("Você não tem permissão para editar este campo.");
    return;
  }

  const { error } = await window.supabaseClient
    .from("projects")
    .update({ [campo]: valor || null })
    .eq("id", projectId);

  if (error) {
    console.error(error);
    alert("Erro ao atualizar: " + error.message);
    return;
  }

  if (isStage) {
    await registrarHistoricoStage(projectId, campo, valor || "");
  }

  await renderProjetos(getEventIdFromURL());
}

async function registrarHistoricoStage(projectId, stage, valor) {
  const payload = {
    project_id: projectId,
    stage: stage,
    valor: valor,
    usuario: getUsuario(),
    created_at: new Date().toISOString(),
  };

  const { error } = await window.supabaseClient
    .from(STAGE_HISTORY_TABLE)
    .insert(payload);

  if (error) {
    console.warn("Histórico não foi gravado:", error.message);
  }
}

/* ================== HISTÓRICO MODAL ================== */
async function abrirHistoricoStage(projectId, stage) {
  const modal = document.getElementById("modalHistorico");
  const corpo = document.getElementById("conteudoHistorico");
  const titulo = document.getElementById("tituloHistorico");

  if (!modal || !corpo || !titulo) {
    alert("Modal de histórico não encontrado no HTML.");
    return;
  }

  titulo.innerText = `Histórico — ${stage.toUpperCase()}`;
  corpo.innerHTML = `<p style="color:#666;">Carregando...</p>`;

  const { data, error } = await window.supabaseClient
    .from(STAGE_HISTORY_TABLE)
    .select("valor, usuario, created_at")
    .eq("project_id", projectId)
    .eq("stage", stage)
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error(error);
    corpo.innerHTML = `<p style="color:#b50000;">Erro ao carregar histórico: ${escapeHtml(error.message)}</p>`;
    modal.classList.remove("hidden");
    return;
  }

  if (!data?.length) {
    corpo.innerHTML = `<p style="color:#888;">Nenhum histórico registrado ainda.</p>`;
    modal.classList.remove("hidden");
    return;
  }

  corpo.innerHTML = data
    .map((h) => {
      const dt = fmtBRDateTime(h.created_at);
      const val = h.valor ?? "—";
      const user = h.usuario ?? "—";
      return `<div style="padding:8px;border-bottom:1px solid #ddd;">
        <b>${escapeHtml(dt)}</b> — ${escapeHtml(String(val))}<br/>
        <span style="font-size:12px;color:#555;">por: ${escapeHtml(String(user))}</span>
      </div>`;
    })
    .join("");

  modal.classList.remove("hidden");
}

function fecharHistorico() {
  document.getElementById("modalHistorico")?.classList.add("hidden");
}

/* ================== PDF ================== */
async function carregarStatusPdf(projectIds) {
  hasPdfByProject = {};
  if (!projectIds?.length) return;

  const { data, error } = await window.supabaseClient
    .from(PROJECT_FILES_TABLE)
    .select("project_id")
    .in("project_id", projectIds)
    .limit(500);

  if (error) {
    console.warn("Falha ao verificar PDFs:", error.message);
    return;
  }

  (data || []).forEach((r) => {
    if (r.project_id) hasPdfByProject[r.project_id] = true;
  });
}

async function uploadPDFProjeto(projectId) {
  if (!isAdmin()) {
    alert("Somente ADMIN pode anexar PDF.");
    return;
  }

  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/pdf";

  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const storagePath = `projects/${projectId}/${Date.now()}_${safeName}`;

    const { error: upErr } = await window.supabaseClient.storage
      .from(BUCKET_PDFS)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: "application/pdf",
      });

    if (upErr) {
      console.error(upErr);
      alert("Erro ao enviar PDF: " + upErr.message);
      return;
    }

    const { data: sess } = await window.supabaseClient.auth.getSession();
    const userId = sess?.session?.user?.id || null;

    const { error: dbErr } = await window.supabaseClient
      .from(PROJECT_FILES_TABLE)
      .insert({
        project_id: projectId,
        file_path: storagePath,
        uploaded_by: userId,
        uploaded_at: new Date().toISOString(),
      });

    if (dbErr) {
      console.error(dbErr);
      alert("PDF enviado, mas falhou ao salvar no banco: " + dbErr.message);
      return;
    }

    alert("PDF anexado com sucesso!");
    await renderProjetos(getEventIdFromURL());
  };

  input.click();
}

async function visualizarPDFProjeto(projectId) {
  const { data, error } = await window.supabaseClient
    .from(PROJECT_FILES_TABLE)
    .select("file_path, uploaded_at")
    .eq("project_id", projectId)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    alert("Erro ao buscar PDF: " + error.message);
    return;
  }

  const row = data?.[0];
  if (!row?.file_path) {
    alert("Nenhum PDF anexado para este projeto.");
    return;
  }

  const { data: signed, error: signErr } = await window.supabaseClient.storage
    .from(BUCKET_PDFS)
    .createSignedUrl(row.file_path, 60 * 10);

  if (signErr) {
    console.error(signErr);
    alert("Erro ao gerar link do PDF: " + signErr.message);
    return;
  }

  window.open(signed.signedUrl, "_blank");
}

/* ================== UTILS ================== */
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
