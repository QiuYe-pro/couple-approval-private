async function fetchJson(url, init) {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data?.error || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

async function ensureLoggedInUI() {
  const top = document.querySelector(".app-header .header-inner");
  if (!top) return;

  const bar = document.createElement("div");
  bar.style.display = "flex";
  bar.style.gap = "10px";
  bar.style.alignItems = "center";

  const me = document.createElement("span");
  me.className = "badge";
  me.textContent = "未登录（只读）";

  const btnLogin = document.createElement("button");
  btnLogin.className = "btn btn-primary";
  btnLogin.type = "button";
  btnLogin.textContent = "登录";

  const btnLogout = document.createElement("button");
  btnLogout.className = "btn btn-ghost";
  btnLogout.type = "button";
  btnLogout.textContent = "退出";
  btnLogout.style.display = "none";

  bar.appendChild(me);
  bar.appendChild(btnLogin);
  bar.appendChild(btnLogout);
  top.appendChild(bar);

  async function refreshMe() {
    const r = await fetchJson("/api/me");
    const userId = r.userId;
    if (userId === "A" || userId === "B") {
      me.textContent = `已登录：${userId === "A" ? "秋叶" : "Yael"}`;
      btnLogout.style.display = "inline-block";
    } else {
      me.textContent = "未登录（只读）";
      btnLogout.style.display = "none";
    }
    window.__COUPLE_USER__ = userId;
  }

  btnLogin.addEventListener("click", async () => {
    const username = prompt("用户名：");
    if (username == null) return;
    const password = prompt("密码：");
    if (password == null) return;
    try {
      await fetchJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
      });
      await refreshMe();
      location.reload();
    } catch (e) {
      alert(`登录失败：${e.message || e}`);
    }
  });

  btnLogout.addEventListener("click", async () => {
    try {
      await fetchJson("/api/auth/logout", { method: "POST" });
      await refreshMe();
      location.reload();
    } catch (e) {
      alert(`退出失败：${e.message || e}`);
    }
  });

  await refreshMe();
}

// Keep bootstrap isolated; app.js will read window.__COUPLE_USER__ when it needs to write.
ensureLoggedInUI().catch(() => {});
