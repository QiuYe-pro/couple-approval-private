/* eslint-disable no-alert */

const SETTINGS_KEY = "couple_approval_settings_v1";

async function apiJson(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function loadRequestsFromServer() {
  const r = await apiJson("/api/requests");
  return Array.isArray(r.items) ? r.items : [];
}

async function createRequestOnServer(item) {
  await apiJson("/api/requests", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item })
  });
}

async function updateRequestOnServer(item) {
  await apiJson("/api/requests", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ item })
  });
}

function getSessionUserId() {
  const v = window.__COUPLE_USER__;
  return v === "A" || v === "B" ? v : null;
}

function nowLocalInputValue() {
  const d = new Date();
  const tzOffsetMin = d.getTimezoneOffset();
  const local = new Date(d.getTime() - tzOffsetMin * 60 * 1000);
  return local.toISOString().slice(0, 16);
}

function formatLocal(dtIso) {
  if (!dtIso) return "-";
  const d = new Date(dtIso);
  if (Number.isNaN(d.getTime())) return dtIso;
  return d.toLocaleString(undefined, { hour12: false });
}

function randomId() {
  return `req_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function safeText(s) {
  return (s ?? "").toString();
}

// state.requests comes from server (public read); writes require login cookie

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { nameA: "秋叶", nameB: "Yael" };
    const parsed = JSON.parse(raw);
    const nameA = safeText(parsed.nameA).trim() || "秋叶";
    const nameB = safeText(parsed.nameB).trim() || "Yael";
    return { nameA, nameB };
  } catch {
    return { nameA: "秋叶", nameB: "Yael" };
  }
}

function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

function getDisplayName(userId, settings) {
  if (userId === "A") return settings.nameA?.trim() || "秋叶";
  if (userId === "B") return settings.nameB?.trim() || "Yael";
  return userId;
}

function otherUser(userId) {
  return userId === "A" ? "B" : "A";
}

function statusLabel(status) {
  switch (status) {
    case "pending":
      return "待审批";
    case "returned":
      return "打回修改";
    case "approved":
      return "已同意";
    case "rejected":
      return "已驳回";
    case "cancelled":
      return "已撤回";
    default:
      return status;
  }
}

function priorityLabel(p) {
  switch (p) {
    case "urgent":
      return "紧急";
    case "high":
      return "重要";
    case "normal":
      return "普通";
    default:
      return p || "-";
  }
}

function badgeClassForStatus(status) {
  if (status === "approved") return "ok";
  if (status === "rejected" || status === "cancelled") return "danger";
  if (status === "returned") return "warn";
  return "";
}

function ensureTimeline(request) {
  if (!Array.isArray(request.timeline)) request.timeline = [];
}

function pushTimeline(request, event) {
  ensureTimeline(request);
  request.timeline.unshift({
    id: `t_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    at: new Date().toISOString(),
    ...event
  });
}

function validateNewRequest(formData) {
  const title = safeText(formData.get("title")).trim();
  const applyAt = safeText(formData.get("applyAt")).trim();
  const executeAt = safeText(formData.get("executeAt")).trim();
  if (!title) return "请填写“申请事项”。";
  if (!applyAt) return "请填写“申请时间”。";
  if (!executeAt) return "请填写“事项实施时间”。";

  const applyDate = new Date(applyAt);
  const executeDate = new Date(executeAt);
  if (Number.isNaN(applyDate.getTime())) return "“申请时间”格式不正确。";
  if (Number.isNaN(executeDate.getTime())) return "“事项实施时间”格式不正确。";

  return null;
}

function createRequest(formData, applicantId) {
  const applyAt = safeText(formData.get("applyAt")).trim();
  const executeAt = safeText(formData.get("executeAt")).trim();
  const request = {
    id: randomId(),
    title: safeText(formData.get("title")).trim(),
    category: safeText(formData.get("category")).trim(),
    description: safeText(formData.get("description")).trim(),
    applyAt,
    executeAt,
    priority: safeText(formData.get("priority")) || "normal",
    applicantId,
    approverId: otherUser(applicantId),
    status: "pending",
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    timeline: []
  };
  pushTimeline(request, { type: "submit", by: applicantId, comment: "" });
  return request;
}

function canApprove(request, currentUserId) {
  return request.status === "pending" && request.approverId === currentUserId;
}

function canResubmit(request, currentUserId) {
  return request.status === "returned" && request.applicantId === currentUserId;
}

function canCancel(request, currentUserId) {
  return (request.status === "pending" || request.status === "returned") && request.applicantId === currentUserId;
}

function sortRequests(requests) {
  return [...requests].sort((a, b) => {
    const aT = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bT = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bT - aT;
  });
}

const els = {
  currentUser: document.getElementById("currentUser"),
  requestForm: document.getElementById("requestForm"),
  resetForm: document.getElementById("resetForm"),
  formError: document.getElementById("formError"),
  requestList: document.getElementById("requestList"),
  listEmpty: document.getElementById("listEmpty"),
  filterStatus: document.getElementById("filterStatus"),
  filterMine: document.getElementById("filterMine"),
  exportData: document.getElementById("exportData"),
  importData: document.getElementById("importData"),
  nameA: document.getElementById("nameA"),
  nameB: document.getElementById("nameB"),
  saveNames: document.getElementById("saveNames"),
  wipeAll: document.getElementById("wipeAll"),
  detailDialog: document.getElementById("detailDialog"),
  detailTitle: document.getElementById("detailTitle"),
  detailMeta: document.getElementById("detailMeta"),
  d_title: document.getElementById("d_title"),
  d_category: document.getElementById("d_category"),
  d_description: document.getElementById("d_description"),
  d_applyAt: document.getElementById("d_applyAt"),
  d_executeAt: document.getElementById("d_executeAt"),
  d_applicant: document.getElementById("d_applicant"),
  d_approver: document.getElementById("d_approver"),
  d_status: document.getElementById("d_status"),
  d_priority: document.getElementById("d_priority"),
  d_timeline: document.getElementById("d_timeline"),
  approvalPanel: document.getElementById("approvalPanel"),
  approveComment: document.getElementById("approveComment"),
  btnApprove: document.getElementById("btnApprove"),
  btnReject: document.getElementById("btnReject"),
  btnReturn: document.getElementById("btnReturn"),
  approvalError: document.getElementById("approvalError"),
  editPanel: document.getElementById("editPanel"),
  btnEdit: document.getElementById("btnEdit"),
  btnCancelReq: document.getElementById("btnCancelReq"),
  editHint: document.getElementById("editHint"),
  editError: document.getElementById("editError"),
  formModeHint: document.getElementById("formModeHint"),
  submitBtn: document.getElementById("submitBtn"),
  editingRequestId: document.getElementById("editingRequestId")
};

let state = loadState();
let settings = loadSettings();
let selectedRequestId = null;

function setEditing(requestId) {
  els.editingRequestId.value = requestId || "";
  if (requestId) {
    els.submitBtn.textContent = "保存并重新提交";
    els.formModeHint.textContent = "编辑模式：保存后会覆盖原申请并重新提交（进入待审批）。";
  } else {
    els.submitBtn.textContent = "提交申请";
    els.formModeHint.textContent = "提交后将进入“待审批”。审批人 = 另一方。";
  }
}

function setDefaultTimes() {
  const applyAt = els.requestForm.querySelector("#applyAt");
  const executeAt = els.requestForm.querySelector("#executeAt");
  if (applyAt && !applyAt.value) applyAt.value = nowLocalInputValue();
  if (executeAt && !executeAt.value) {
    const d = new Date();
    d.setHours(d.getHours() + 2);
    const tzOffsetMin = d.getTimezoneOffset();
    const local = new Date(d.getTime() - tzOffsetMin * 60 * 1000);
    executeAt.value = local.toISOString().slice(0, 16);
  }
}

function persist() {
  saveState(state);
}

function getCurrentUserId() {
  return els.currentUser.value;
}

function applyFilters(requests, currentUserId) {
  const status = els.filterStatus.value;
  const mine = els.filterMine.value;

  return requests.filter((r) => {
    if (status !== "all" && r.status !== status) return false;
    if (mine === "mine" && r.applicantId !== currentUserId) return false;
    if (mine === "toApprove") {
      if (r.approverId !== currentUserId) return false;
      if (r.status !== "pending") return false;
    }
    return true;
  });
}

function escapeHtml(s) {
  return safeText(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderList() {
  const currentUserId = getCurrentUserId();
  const requests = sortRequests(state.requests);
  const filtered = applyFilters(requests, currentUserId);

  els.requestList.innerHTML = "";
  els.listEmpty.style.display = filtered.length ? "none" : "block";

  for (const r of filtered) {
    const item = document.createElement("div");
    item.className = "item";

    const top = document.createElement("div");
    top.className = "item-top";

    const left = document.createElement("div");
    const title = document.createElement("p");
    title.className = "item-title";
    title.textContent = r.title;
    left.appendChild(title);

    const badges = document.createElement("div");
    badges.className = "badges";

    const bStatus = document.createElement("span");
    bStatus.className = `badge ${badgeClassForStatus(r.status)}`;
    bStatus.textContent = statusLabel(r.status);
    badges.appendChild(bStatus);

    const bPriority = document.createElement("span");
    bPriority.className = "badge";
    bPriority.textContent = priorityLabel(r.priority);
    badges.appendChild(bPriority);

    if (r.category) {
      const bCat = document.createElement("span");
      bCat.className = "badge";
      bCat.textContent = r.category;
      badges.appendChild(bCat);
    }

    top.appendChild(left);
    top.appendChild(badges);

    const meta = document.createElement("div");
    meta.className = "item-meta";
    const applicant = getDisplayName(r.applicantId, settings);
    const approver = getDisplayName(r.approverId, settings);
    meta.innerHTML = `
      <div>申请人：${escapeHtml(applicant)}</div>
      <div>审批人：${escapeHtml(approver)}</div>
      <div>申请时间：${escapeHtml(formatLocal(r.applyAt))}</div>
      <div>实施时间：${escapeHtml(formatLocal(r.executeAt))}</div>
    `;

    const actions = document.createElement("div");
    actions.className = "item-actions";
    const btnDetail = document.createElement("button");
    btnDetail.className = "btn";
    btnDetail.type = "button";
    btnDetail.textContent = "查看 / 操作";
    btnDetail.addEventListener("click", () => openDetail(r.id));
    actions.appendChild(btnDetail);

    item.appendChild(top);
    item.appendChild(meta);
    item.appendChild(actions);

    els.requestList.appendChild(item);
  }
}

function findRequestById(id) {
  return state.requests.find((r) => r.id === id);
}

function openDetail(id) {
  selectedRequestId = id;
  renderDetail();
  els.detailDialog.showModal();
}

function renderTimeline(timeline) {
  els.d_timeline.innerHTML = "";
  if (!timeline?.length) {
    const div = document.createElement("div");
    div.className = "help";
    div.textContent = "暂无记录";
    els.d_timeline.appendChild(div);
    return;
  }

  for (const t of timeline) {
    const item = document.createElement("div");
    item.className = "t-item";
    const byName = getDisplayName(t.by, settings);
    const typeLabel =
      t.type === "submit"
        ? "提交申请"
        : t.type === "approve"
          ? "同意"
          : t.type === "reject"
            ? "驳回"
            : t.type === "return"
              ? "打回修改"
              : t.type === "resubmit"
                ? "重新提交"
                : t.type === "cancel"
                  ? "撤回"
                  : t.type;

    item.innerHTML = `
      <div class="t-top">
        <div>${escapeHtml(typeLabel)} · ${escapeHtml(byName)}</div>
        <div>${escapeHtml(formatLocal(t.at))}</div>
      </div>
    `;
    if (t.comment) {
      const c = document.createElement("div");
      c.className = "t-comment";
      c.textContent = t.comment;
      item.appendChild(c);
    }
    els.d_timeline.appendChild(item);
  }
}

function renderDetail() {
  const currentUserId = getCurrentUserId();
  const r = findRequestById(selectedRequestId);
  if (!r) return;

  els.approvalError.textContent = "";
  els.editError.textContent = "";
  els.approveComment.value = "";

  const applicant = getDisplayName(r.applicantId, settings);
  const approver = getDisplayName(r.approverId, settings);

  els.detailTitle.textContent = "申请详情";
  els.detailMeta.textContent = `编号：${r.id} · 版本：v${r.version}`;
  els.d_title.textContent = r.title || "-";
  els.d_category.textContent = r.category || "-";
  els.d_description.textContent = r.description || "-";
  els.d_applyAt.textContent = formatLocal(r.applyAt);
  els.d_executeAt.textContent = formatLocal(r.executeAt);
  els.d_applicant.textContent = applicant;
  els.d_approver.textContent = approver;
  els.d_status.textContent = statusLabel(r.status);
  els.d_priority.textContent = priorityLabel(r.priority);
  renderTimeline(r.timeline || []);

  const showApproval = canApprove(r, currentUserId);
  els.approvalPanel.style.display = showApproval ? "block" : "none";

  const showEdit = canResubmit(r, currentUserId) || canCancel(r, currentUserId);
  els.editPanel.style.display = showEdit ? "block" : "none";
  if (els.editPanel.style.display === "block") {
    const hints = [];
    if (r.status === "returned") hints.push("当前状态为“打回修改”，可进入修改后在顶部表单保存并重新提交。");
    if (canCancel(r, currentUserId)) hints.push("也可以撤回该申请。");
    els.editHint.textContent = hints.join(" ");
  }

  els.btnEdit.style.display = canResubmit(r, currentUserId) ? "inline-block" : "none";
  els.btnCancelReq.style.display = canCancel(r, currentUserId) ? "inline-block" : "none";
}

function updateRequestAndPersist(r) {
  r.updatedAt = new Date().toISOString();
  // persist via server (async) handled by callers
  renderList();
  if (els.detailDialog.open) renderDetail();
}

async function doApprove(action) {
  const currentUserId = getCurrentUserId();
  const r = findRequestById(selectedRequestId);
  if (!r) return;
  const sessionUser = getSessionUserId();
  if (!sessionUser) {
    els.approvalError.textContent = "当前为只读模式：请先登录后再审批。";
    return;
  }
  if (currentUserId !== sessionUser) {
    els.approvalError.textContent = "审批失败：当前身份与登录身份不一致（请切换身份）。";
    return;
  }
  if (!canApprove(r, currentUserId)) {
    els.approvalError.textContent = "当前身份不可审批该申请（只能由审批人审批，且必须为待审批）。";
    return;
  }

  const comment = safeText(els.approveComment.value).trim();

  if (action === "approve") {
    r.status = "approved";
    pushTimeline(r, { type: "approve", by: currentUserId, comment });
  } else if (action === "reject") {
    r.status = "rejected";
    pushTimeline(r, { type: "reject", by: currentUserId, comment });
  } else if (action === "return") {
    r.status = "returned";
    pushTimeline(r, { type: "return", by: currentUserId, comment });
  }
  try {
    await updateRequestOnServer(r);
    updateRequestAndPersist(r);
  } catch (e) {
    els.approvalError.textContent = `审批失败：${e.message || e}`;
  }
}

function fillFormFromRequest(r) {
  els.requestForm.querySelector("#title").value = r.title || "";
  els.requestForm.querySelector("#category").value = r.category || "";
  els.requestForm.querySelector("#description").value = r.description || "";
  els.requestForm.querySelector("#applyAt").value = (r.applyAt || "").slice(0, 16);
  els.requestForm.querySelector("#executeAt").value = (r.executeAt || "").slice(0, 16);
  els.requestForm.querySelector("#priority").value = r.priority || "normal";
}

function doEnterEdit() {
  const currentUserId = getCurrentUserId();
  const r = findRequestById(selectedRequestId);
  if (!r) return;
  if (!canResubmit(r, currentUserId)) {
    els.editError.textContent = "当前身份不可修改该申请（仅申请人且状态为打回修改可编辑）。";
    return;
  }
  fillFormFromRequest(r);
  setEditing(r.id);
  els.detailDialog.close();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function doCancelRequest() {
  const currentUserId = getCurrentUserId();
  const r = findRequestById(selectedRequestId);
  if (!r) return;
  const sessionUser = getSessionUserId();
  if (!sessionUser) {
    els.editError.textContent = "当前为只读模式：请先登录后再撤回。";
    return;
  }
  if (currentUserId !== sessionUser) {
    els.editError.textContent = "撤回失败：当前身份与登录身份不一致（请切换身份）。";
    return;
  }
  if (!canCancel(r, currentUserId)) {
    els.editError.textContent = "当前身份不可撤回该申请。";
    return;
  }
  const ok = confirm("确定要撤回这条申请吗？");
  if (!ok) return;
  r.status = "cancelled";
  pushTimeline(r, { type: "cancel", by: currentUserId, comment: "" });
  try {
    await updateRequestOnServer(r);
    updateRequestAndPersist(r);
  } catch (e) {
    els.editError.textContent = `撤回失败：${e.message || e}`;
  }
}

function mergeImportedState(imported) {
  if (!imported || !Array.isArray(imported.requests)) return false;
  const existingById = new Map(state.requests.map((r) => [r.id, r]));
  for (const r of imported.requests) {
    if (!r?.id) continue;
    if (!existingById.has(r.id)) {
      state.requests.push(r);
      existingById.set(r.id, r);
      continue;
    }
    const cur = existingById.get(r.id);
    const curT = new Date(cur.updatedAt || cur.createdAt || 0).getTime();
    const newT = new Date(r.updatedAt || r.createdAt || 0).getTime();
    if (newT > curT) {
      const idx = state.requests.findIndex((x) => x.id === r.id);
      if (idx >= 0) state.requests[idx] = r;
      existingById.set(r.id, r);
    }
  }
  return true;
}

function downloadJson(filename, dataObj) {
  const blob = new Blob([JSON.stringify(dataObj, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function init() {
  els.nameA.value = settings.nameA || "";
  els.nameB.value = settings.nameB || "";
  setEditing("");
  setDefaultTimes();

  els.requestForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    els.formError.textContent = "";

    const sessionUser = getSessionUserId();
    if (!sessionUser) {
      els.formError.textContent = "当前为只读模式：请先点击右上角“登录”，登录后才能提交/修改/审批。";
      return;
    }

    const formData = new FormData(els.requestForm);
    const err = validateNewRequest(formData);
    if (err) {
      els.formError.textContent = err;
      return;
    }

    const currentUserId = getCurrentUserId();
    if (currentUserId !== sessionUser) {
      els.formError.textContent = "提交失败：当前身份与登录身份不一致（请先切换到与登录一致的身份）。";
      return;
    }
    const editingId = safeText(formData.get("editingRequestId")).trim();

    try {
      if (editingId) {
      const r = findRequestById(editingId);
      if (!r) {
        els.formError.textContent = "编辑失败：找不到原申请（可能已被清空/导入覆盖）。";
        return;
      }
      if (!canResubmit(r, currentUserId)) {
        els.formError.textContent = "编辑失败：只有申请人且状态为“打回修改”时才能编辑并重新提交。";
        return;
      }

      r.title = safeText(formData.get("title")).trim();
      r.category = safeText(formData.get("category")).trim();
      r.description = safeText(formData.get("description")).trim();
      r.applyAt = safeText(formData.get("applyAt")).trim();
      r.executeAt = safeText(formData.get("executeAt")).trim();
      r.priority = safeText(formData.get("priority")) || "normal";
      r.status = "pending";
      r.version = (r.version || 1) + 1;
      pushTimeline(r, { type: "resubmit", by: currentUserId, comment: "" });
      await updateRequestOnServer(r);
      updateRequestAndPersist(r);
      } else {
      const req = createRequest(formData, currentUserId);
      await createRequestOnServer(req);
      state.requests.push(req);
      }
    } catch (e2) {
      els.formError.textContent = `提交失败：${e2.message || e2}`;
      return;
    }

    els.requestForm.reset();
    setEditing("");
    setDefaultTimes();
    renderList();
  });

  els.resetForm.addEventListener("click", () => {
    els.requestForm.reset();
    els.formError.textContent = "";
    setEditing("");
    setDefaultTimes();
  });

  els.currentUser.addEventListener("change", () => {
    renderList();
    if (els.detailDialog.open) renderDetail();
  });
  els.filterStatus.addEventListener("change", renderList);
  els.filterMine.addEventListener("change", renderList);

  els.btnApprove.addEventListener("click", () => doApprove("approve"));
  els.btnReject.addEventListener("click", () => doApprove("reject"));
  els.btnReturn.addEventListener("click", () => doApprove("return"));

  els.btnEdit.addEventListener("click", doEnterEdit);
  els.btnCancelReq.addEventListener("click", doCancelRequest);

  els.saveNames.addEventListener("click", () => {
    settings = { nameA: safeText(els.nameA.value), nameB: safeText(els.nameB.value) };
    saveSettings(settings);
    renderList();
    if (els.detailDialog.open) renderDetail();
  });

  els.wipeAll.addEventListener("click", () => {
    const ok = confirm("确定清空全部数据吗？此操作不可撤销。");
    if (!ok) return;
    alert("出于安全考虑，公网版不提供“一键清空服务器数据”。如需清空我可以帮你加“仅登录可执行的清空接口”。");
    renderList();
  });

  els.exportData.addEventListener("click", () => {
    downloadJson("couple-approval-export.json", { requests: state.requests });
  });

  els.importData.addEventListener("change", async () => {
    const file = els.importData.files?.[0];
    if (!file) return;
    try {
      alert("公网版暂不支持导入到服务器（避免误操作）。需要的话我可以做成“仅登录可导入/合并”的功能。");
      const text = await file.text();
      const imported = JSON.parse(text);
      const ok = mergeImportedState(imported);
      if (!ok) alert("导入失败：文件结构不正确。");
      else {
        renderList();
        alert("导入成功（已合并）。");
      }
    } catch {
      alert("导入失败：无法解析 JSON。");
    } finally {
      els.importData.value = "";
    }
  });

  // initial load from server
  (async () => {
    try {
      state.requests = await loadRequestsFromServer();
      renderList();
    } catch (e3) {
      els.listEmpty.textContent = `加载失败：${e3.message || e3}`;
      els.listEmpty.style.display = "block";
    }
  })();
}

init();
