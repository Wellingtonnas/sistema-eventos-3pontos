/* ================== AUTH ================== */
async function requireAuth() {
  const { data } = await window.supabaseClient.auth.getSession();
  if (!data.session) {
    window.location.href = "login.html";
    return null;
  }
  return data.session.user;
}

/* ================== HELPERS ================== */
function getNivel() {
  return localStorage.getItem("nivelAcesso");
}
function getUsuario() {
  return localStorage.getItem("usuarioLogado");
}
function isAdmin() {
  return getNivel() === "admin";
}
function ymd(v) {
  return v ? String(v).slice(0, 10) : null;
}
function safeText(v) {
  return v == null || v === "" ? "—" : v;
}

/* ================== CONFIG ================== */
const BUCKET_PDFS = "pdfs";

/** senha do botão "Limpar Histórico" (reset geral) */
const MASTER_CLEAR_PASSWORD = "megasena777";

/** realtime do cronograma */
let realtimeChannel = null;

/* ================== EVENT_HISTORY (colunas reais) ==================
   Pelo seu erro, a tabela usa PT-BR:
   - acao (NOT NULL)
   - usuario (provável)
   - created_at
*/
const EVENT_HISTORY_TABLE = "event_history";
const EH_COL_EVENT_ID = "event_id";
const EH_COL_ACAO = "acao"; // <-- principal
const EH_COL_USUARIO = "usuario"; // <-- principal
const EH_COL_CREATED_AT = "created_at";

// fallbacks (caso exista no seu banco)
const EH_COL_ACTION_FALLBACK = "action";
const EH_COL_CREATED_BY_FALLBACK = "created_by";

/* ================== INIT ================== */
document.addEventListener("DOMContentLoaded", async () => {
  const user = await requireAuth();
  if (!user) return;

  const userEl = document.getElementById("currentUser");
  if (userEl) userEl.innerText = getUsuario() || "";

  aplicarPermissoes();

  carregarSelectMeses(); // importante
  renderMeses();
  await renderCards();

  // realtime
  setupRealtimeCronograma();

  document
    .getElementById("btnAddEvento")
    ?.addEventListener("click", openModalForNew);
  document
    .getElementById("btnSalvarEvento")
    ?.addEventListener("click", saveEventFromModal);
  document
    .getElementById("btnCancelarEvento")
    ?.addEventListener("click", closeModal);

  document.getElementById("btnCloseConflict")?.addEventListener("click", () => {
    document.getElementById("modalConflict")?.classList.add("hidden");
  });

  document.getElementById("btnCloseHistory")?.addEventListener("click", () => {
    document.getElementById("modalHistoricoEvento")?.classList.add("hidden");
  });

  document.getElementById("btnLogout")?.addEventListener("click", async () => {
    try {
      if (realtimeChannel)
        await window.supabaseClient.removeChannel(realtimeChannel);
    } catch {}
    await window.supabaseClient.auth.signOut();
    localStorage.clear();
    window.location.href = "login.html";
  });

  // RESET GERAL com senha
  document
    .getElementById("btnClearHistory")
    ?.addEventListener("click", resetGeralComSenha);
});

/* ================== UI / PERMISSÕES ================== */
function aplicarPermissoes() {
  const nivel = getNivel();
  if (nivel !== "admin") {
    document.getElementById("btnAddEvento")?.remove();
    document.getElementById("btnClearHistory")?.remove();
  }
}

function renderMeses() {
  const meses = [
    "JANEIRO",
    "FEVEREIRO",
    "MARÇO",
    "ABRIL",
    "MAIO",
    "JUNHO",
    "JULHO",
    "AGOSTO",
    "SETEMBRO",
    "OUTUBRO",
    "NOVEMBRO",
    "DEZEMBRO",
  ];
  const container = document.getElementById("listaMeses");
  if (!container) return;

  container.innerHTML = "";
  meses.forEach((m, i) => {
    container.innerHTML += `
      <div class="linha-mes">
        <div class="mes-nome">${m}</div>
        <div class="eventos-mes" id="mes-${i + 1}"></div>
      </div>
    `;
  });
}

function carregarSelectMeses() {
  const select = document.getElementById("evtMes");
  if (!select) return;

  const meses = [
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  select.innerHTML = meses
    .map((m, i) => `<option value="${i + 1}">${m}</option>`)
    .join("");
}

/* ================== REALTIME ================== */
function setupRealtimeCronograma() {
  try {
    if (realtimeChannel) return;

    realtimeChannel = window.supabaseClient
      .channel("rt-cronograma")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "events" },
        async () => {
          await renderCards();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_files" },
        async () => {
          await renderCards();
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "event_history" },
        async () => {
          // se quiser, dá pra atualizar o modal de histórico aberto (opcional)
        },
      )
      .subscribe();
  } catch (e) {
    console.warn("Realtime não iniciou:", e);
  }
}

/* ================== DATA LOAD / RENDER ================== */
async function renderCards() {
  document.querySelectorAll(".eventos-mes").forEach((e) => (e.innerHTML = ""));

  const { data: eventos, error } = await window.supabaseClient
    .from("events")
    .select("*")
    .order("periodo_inicio", { ascending: true });

  if (error) {
    alert("Erro ao carregar eventos: " + error.message);
    console.error(error);
    return;
  }

  (eventos || []).forEach((evt) => {
    const col = document.getElementById(`mes-${evt.mes}`);
    if (!col) return;

    const card = document.createElement("div");
    card.className = "card-evento";

    // estilos por status
    if (evt.cancelado) card.classList.add("cancelado");
    if (evt.oficial) card.classList.add("organizadora");
    if (evt.nao_oficial) card.classList.add("not-organizadora");

    const topIcons = `
      <div class="card-top-icons">
        ${
          isAdmin()
            ? `<button class="icon-btn" title="Anexar PDF" onclick="uploadPDFForEvent(${evt.id})">📥</button>`
            : ``
        }
        <button class="icon-btn" title="Visualizar PDF" onclick="viewPDFForEvent(${evt.id})">📄</button>
        <button class="icon-btn" title="Histórico" onclick="abrirHistoricoEvento(${evt.id})">🕘</button>
      </div>
    `;

    const cancelLabel = evt.cancelado
      ? `<div style="color:#ffd1d1;font-weight:700;margin-bottom:6px;">CANCELADO</div>`
      : "";

    const oficialLabel = evt.oficial
      ? `<div style="margin-top:6px;font-weight:700;color:#eaeaea;">OFICIAL</div>`
      : evt.nao_oficial
        ? `<div style="margin-top:6px;font-weight:700;color:#111;background:#ffd54f;padding:6px;border-radius:6px;display:inline-block;">NÃO-OFICIAL</div>`
        : "";

    const footerAdmin = `
      <div class="card-footer">
        ${isAdmin() ? `<button onclick="editarEvento(${evt.id})">✏️ Editar</button>` : ""}
        ${isAdmin() ? `<button onclick="toggleCancel(${evt.id})">${evt.cancelado ? "↺ Desfazer" : "❌ Cancelar"}</button>` : ""}
        <button onclick="goToProjetos(${evt.id})">➡ Projetos</button>
        ${isAdmin() ? `<button onclick="toggleOficial(${evt.id})">${evt.oficial ? "✅ OFICIAL" : "⚠ NÃO-OFICIAL"}</button>` : ""}
      </div>
    `;

    card.innerHTML = `
      ${topIcons}
      <strong>${evt.nome}</strong>
      ${cancelLabel}
      ${oficialLabel}
      <div class="meta">
        <div><b>Local:</b> ${safeText(evt.endereco)}</div>
        <div><b>Período:</b> ${safeText(ymd(evt.periodo_inicio))} a ${safeText(ymd(evt.periodo_fim))}</div>
        <div><b>Montagem:</b> ${safeText(ymd(evt.mont_inicio))} a ${safeText(ymd(evt.mont_fim))}</div>
        <div><b>Desmontagem:</b> ${safeText(ymd(evt.desm_inicio))} a ${safeText(ymd(evt.desm_fim))}</div>
      </div>
      ${footerAdmin}
    `;

    col.appendChild(card);
  });

  // “Nenhum evento”
  document.querySelectorAll(".eventos-mes").forEach((div) => {
    if (!div.children.length)
      div.innerHTML = `<span class="no-event">Nenhum evento</span>`;
  });
}

/* ================== MODAL (NEW / EDIT) ================== */
let editingId = null;

function openModalForNew() {
  if (!isAdmin()) return;
  editingId = null;
  document.getElementById("modalTitle").innerText = "Novo Evento";
  resetModal();
  document.getElementById("modalEvento")?.classList.remove("hidden");
}

function closeModal() {
  document.getElementById("modalEvento")?.classList.add("hidden");
  resetModal();
  editingId = null;
}

function resetModal() {
  const ids = [
    "evtNome",
    "evtEndereco",
    "evtMes",
    "evtPeriodoInicio",
    "evtPeriodoFim",
    "evtMontInicio",
    "evtMontFim",
    "evtDesmInicio",
    "evtDesmFim",
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === "evtMes") el.value = "1";
    else el.value = "";
  });

  const f = document.getElementById("evtPDF");
  if (f) f.value = "";
}

async function editarEvento(id) {
  if (!isAdmin()) return;

  const { data, error } = await window.supabaseClient
    .from("events")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) {
    alert(
      "Erro ao abrir evento: " + (error?.message || "Evento não encontrado"),
    );
    return;
  }

  editingId = id;
  document.getElementById("modalTitle").innerText = "Editar Evento";

  document.getElementById("evtNome").value = data.nome || "";
  document.getElementById("evtEndereco").value = data.endereco || "";
  document.getElementById("evtMes").value = String(data.mes || 1);

  document.getElementById("evtPeriodoInicio").value =
    ymd(data.periodo_inicio) || "";
  document.getElementById("evtPeriodoFim").value = ymd(data.periodo_fim) || "";

  document.getElementById("evtMontInicio").value = ymd(data.mont_inicio) || "";
  document.getElementById("evtMontFim").value = ymd(data.mont_fim) || "";

  document.getElementById("evtDesmInicio").value = ymd(data.desm_inicio) || "";
  document.getElementById("evtDesmFim").value = ymd(data.desm_fim) || "";

  const f = document.getElementById("evtPDF");
  if (f) f.value = "";

  document.getElementById("modalEvento")?.classList.remove("hidden");
}

/* ================== CONFLITO DE DATAS ================== */
async function checarConflitoDeDatas(payload, editingIdLocal) {
  const ini = payload?.periodo_inicio;
  const fim = payload?.periodo_fim;
  if (!ini || !fim) return [];

  let q = window.supabaseClient
    .from("events")
    .select("id, nome, periodo_inicio, periodo_fim")
    .lte("periodo_inicio", fim)
    .gte("periodo_fim", ini);

  if (editingIdLocal) q = q.neq("id", editingIdLocal);

  const { data, error } = await q;
  if (error) {
    console.warn("Falha ao checar conflito:", error.message);
    return [];
  }
  return data || [];
}

function mostrarModalConflito(conflitos, payload) {
  const modal = document.getElementById("modalConflict");
  const msgEl = document.getElementById("conflictMessage");

  const texto =
    `Conflito de período detectado!\n\n` +
    `Evento que você está salvando:\n` +
    `• ${payload.nome}\n• ${safeText(ymd(payload.periodo_inicio))} a ${safeText(ymd(payload.periodo_fim))}\n\n` +
    `Conflita com:\n` +
    conflitos
      .map(
        (c) =>
          `• [${c.id}] ${c.nome} (${safeText(ymd(c.periodo_inicio))} a ${safeText(ymd(c.periodo_fim))})`,
      )
      .join("\n");

  if (modal) {
    if (msgEl) msgEl.innerText = texto;
    modal.classList.remove("hidden");
  } else {
    alert(texto);
  }
}

/* ================== SAVE EVENT + (optional) PDF via modal ================== */
async function saveEventFromModal() {
  if (!isAdmin()) return;

  const mesVal = Number(document.getElementById("evtMes")?.value || 0);

  const payload = {
    nome: document.getElementById("evtNome")?.value.trim(),
    endereco: document.getElementById("evtEndereco")?.value.trim(),
    mes: mesVal,
    periodo_inicio: document.getElementById("evtPeriodoInicio")?.value || null,
    periodo_fim: document.getElementById("evtPeriodoFim")?.value || null,
    mont_inicio: document.getElementById("evtMontInicio")?.value || null,
    mont_fim: document.getElementById("evtMontFim")?.value || null,
    desm_inicio: document.getElementById("evtDesmInicio")?.value || null,
    desm_fim: document.getElementById("evtDesmFim")?.value || null,
  };

  if (!payload.nome) return alert("Informe o nome do evento.");
  if (!payload.mes || payload.mes < 1 || payload.mes > 12) {
    return alert("Selecione um mês válido (1 a 12).");
  }

  // alerta de conflito (não bloqueia — pede confirmação)
  const conflitos = await checarConflitoDeDatas(payload, editingId);
  if (conflitos.length) {
    mostrarModalConflito(conflitos, payload);
    const ok = confirm(
      "Existe conflito de período com outro evento. Deseja SALVAR mesmo assim?",
    );
    if (!ok) return;
  }

  let savedEventId = editingId;

  if (editingId) {
    const { error } = await window.supabaseClient
      .from("events")
      .update(payload)
      .eq("id", editingId);
    if (error) {
      alert("Erro ao salvar evento: " + error.message);
      console.error(error);
      return;
    }
    await logHistory(editingId, "Editado");
  } else {
    const { data, error } = await window.supabaseClient
      .from("events")
      .insert(payload)
      .select("id")
      .single();

    if (error) {
      alert("Erro ao salvar evento: " + error.message);
      console.error(error);
      return;
    }

    savedEventId = data?.id;
    await logHistory(savedEventId, "Criado");
  }

  // PDF opcional no modal
  const fileInput = document.getElementById("evtPDF");
  const file = fileInput?.files?.[0];
  if (file && savedEventId) {
    await uploadPDFForEvent(savedEventId, file, { silentAlert: true });
    await logHistory(savedEventId, "PDF anexado (via modal)");
  }

  closeModal();
  await renderCards();
}

/* ================== HISTÓRICO (event_history) ================== */
async function logHistory(eventId, acaoTexto) {
  if (!eventId) return;

  const { data: sess } = await window.supabaseClient.auth.getSession();
  const userId = sess?.session?.user?.id || null;

  // ✅ Primeiro tenta no formato PT-BR: acao / usuario
  const payloadPT = {
    [EH_COL_EVENT_ID]: eventId,
    [EH_COL_ACAO]: acaoTexto, // <-- aqui resolve o NOT NULL em "acao"
    [EH_COL_USUARIO]: userId,
    [EH_COL_CREATED_AT]: new Date().toISOString(),
  };

  let { error } = await window.supabaseClient
    .from(EVENT_HISTORY_TABLE)
    .insert(payloadPT);

  if (!error) return;

  // Fallback 1: action / created_by
  const payloadEN = {
    event_id: eventId,
    action: acaoTexto,
    created_by: userId,
    created_at: new Date().toISOString(),
  };

  const res2 = await window.supabaseClient
    .from(EVENT_HISTORY_TABLE)
    .insert(payloadEN);
  if (!res2.error) return;

  // Se falhar, mostra o erro real (não assume RLS)
  console.warn("Falha ao registrar histórico:", res2.error.message);
  alert(
    "Não consegui gravar no histórico (event_history).\n\n" +
      "Erro: " +
      res2.error.message +
      "\n\n" +
      "Isso normalmente é:\n" +
      "• coluna diferente do esperado (acao/usuario vs action/created_by)\n" +
      "• ou policy RLS bloqueando INSERT.",
  );
}

async function abrirHistoricoEvento(eventId) {
  const container = document.getElementById("conteudoHistoricoEvento");
  if (!container) return;

  container.innerHTML = "Carregando...";

  // 1) pega histórico do evento
  const { data, error } = await window.supabaseClient
    .from("event_history")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false });

  if (error) {
    container.innerHTML = "Erro ao carregar histórico.";
    console.error(error);
    return;
  }

  if (!data?.length) {
    container.innerHTML = "<div class='line'>Nenhum histórico.</div>";
    document.getElementById("modalHistoricoEvento")?.classList.remove("hidden");
    return;
  }

  // 2) coleta todos os UUIDs únicos (coluna usuario)
  const userIds = Array.from(
    new Set(data.map((h) => h.usuario).filter(Boolean)),
  );

  // 3) busca nomes no profiles
  let mapNomes = {};
  if (userIds.length) {
    const { data: perfis, error: pErr } = await window.supabaseClient
      .from("profiles")
      .select("id, nome")
      .in("id", userIds);

    if (!pErr && perfis?.length) {
      perfis.forEach((p) => (mapNomes[p.id] = p.nome));
    } else if (pErr) {
      console.warn("Não consegui buscar profiles:", pErr.message);
    }
  }

  // 4) renderiza
  container.innerHTML = "";
  data.forEach((h) => {
    const acao = h.acao ?? h.action ?? "—";
    const dt = h.created_at ? new Date(h.created_at).toLocaleString() : "—";

    const nome = h.usuario ? mapNomes[h.usuario] || "Usuário" : "Sistema";

    const div = document.createElement("div");
    div.className = "line";
    div.innerHTML = `
      <div style="font-weight:700;">${acao}</div>
      <div style="font-size:12px;color:#666;">
        ${dt} — <b>${nome}</b>
      </div>
    `;
    container.appendChild(div);
  });

  document.getElementById("modalHistoricoEvento")?.classList.remove("hidden");
}

/* ================== RESET GERAL (senha) ================== */
async function resetGeralComSenha() {
  if (!isAdmin()) return;

  const ok = confirm(
    "ATENÇÃO: Isso vai APAGAR TUDO (eventos, projetos, históricos e PDFs referenciados no banco). Deseja continuar?",
  );
  if (!ok) return;

  const senha = prompt("Digite a senha para limpar tudo:");
  if (!senha) return;

  if (senha !== MASTER_CLEAR_PASSWORD) {
    alert("Senha incorreta.");
    return;
  }

  try {
    const { data: evs, error: evErr } = await window.supabaseClient
      .from("events")
      .select("id");
    if (evErr) throw evErr;
    const eventIds = (evs || []).map((e) => e.id);

    const { data: projs, error: pErr } = await window.supabaseClient
      .from("projects")
      .select("id");
    if (pErr) throw pErr;
    const projectIds = (projs || []).map((p) => p.id);

    if (projectIds.length) {
      await window.supabaseClient
        .from("project_stage_history")
        .delete()
        .in("project_id", projectIds);
      await window.supabaseClient
        .from("project_files")
        .delete()
        .in("project_id", projectIds);
      await window.supabaseClient
        .from("projects")
        .delete()
        .in("id", projectIds);
    }

    if (eventIds.length) {
      await window.supabaseClient
        .from("event_files")
        .delete()
        .in("event_id", eventIds);
      await window.supabaseClient
        .from("event_history")
        .delete()
        .in("event_id", eventIds);
      await window.supabaseClient.from("events").delete().in("id", eventIds);
    } else {
      await window.supabaseClient.from("event_history").delete().neq("id", 0);
    }

    alert("Reset geral concluído com sucesso!");
    await renderCards();
  } catch (e) {
    console.error(e);
    alert("Erro ao limpar tudo: " + (e?.message || "desconhecido"));
  }
}

/* ================== CANCELAR ================== */
async function toggleCancel(eventId) {
  if (!isAdmin()) return;

  const { data: row, error: gErr } = await window.supabaseClient
    .from("events")
    .select("cancelado")
    .eq("id", eventId)
    .single();

  if (gErr) {
    alert("Erro: " + gErr.message);
    return;
  }

  const next = !row.cancelado;

  const { error } = await window.supabaseClient
    .from("events")
    .update({ cancelado: next })
    .eq("id", eventId);
  if (error) {
    alert("Erro ao cancelar: " + error.message);
    return;
  }

  await logHistory(eventId, next ? "Cancelado" : "Cancelamento desfeito");
  await renderCards();
}

/* ================== OFICIAL / NÃO-OFICIAL ================== */
async function toggleOficial(eventId) {
  if (!isAdmin()) return;

  const { data: row, error: gErr } = await window.supabaseClient
    .from("events")
    .select("oficial, nao_oficial")
    .eq("id", eventId)
    .single();

  if (gErr) {
    alert("Erro: " + gErr.message);
    return;
  }

  let oficial = !!row.oficial;
  let nao_oficial = !!row.nao_oficial;
  let action = "";

  if (oficial) {
    oficial = false;
    nao_oficial = true;
    action = "Marcado como NÃO-OFICIAL";
  } else if (nao_oficial) {
    nao_oficial = false;
    oficial = true;
    action = "Marcado como OFICIAL";
  } else {
    oficial = true;
    nao_oficial = false;
    action = "Marcado como OFICIAL";
  }

  const { error } = await window.supabaseClient
    .from("events")
    .update({ oficial, nao_oficial })
    .eq("id", eventId);
  if (error) {
    alert("Erro ao alterar status: " + error.message);
    return;
  }

  await logHistory(eventId, action);
  await renderCards();
}

/* ================== PROJETOS ================== */
function goToProjetos(eventId) {
  window.location.href = `evento.html?id=${eventId}`;
}

/* ================== PDF (Storage + event_files) ================== */
async function uploadPDFForEvent(eventId, fileOptional = null, opts = {}) {
  if (!isAdmin()) {
    alert("Somente ADMIN pode anexar PDF.");
    return;
  }

  let file = fileOptional;

  if (!file) {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "application/pdf";
    input.onchange = async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      await uploadPDFForEvent(eventId, f, opts);
    };
    input.click();
    return;
  }

  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `events/${eventId}/${Date.now()}_${safeName}`;

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

  const { data: sessionData } = await window.supabaseClient.auth.getSession();
  const userId = sessionData?.session?.user?.id || null;

  const { error: dbErr } = await window.supabaseClient
    .from("event_files")
    .insert({
      event_id: eventId,
      file_path: storagePath,
      uploaded_by: userId,
      uploaded_at: new Date().toISOString(),
    });

  if (dbErr) {
    console.error(dbErr);
    alert("PDF enviado, mas falhou ao salvar no banco: " + dbErr.message);
    return;
  }

  await logHistory(eventId, "PDF anexado");
  if (!opts.silentAlert) alert("PDF anexado com sucesso!");
}

async function viewPDFForEvent(eventId) {
  const { data, error } = await window.supabaseClient
    .from("event_files")
    .select("file_path, uploaded_at")
    .eq("event_id", eventId)
    .order("uploaded_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error(error);
    alert("Erro ao buscar PDF: " + error.message);
    return;
  }

  const row = data?.[0];
  if (!row) {
    alert("Nenhum PDF anexado para este evento.");
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
