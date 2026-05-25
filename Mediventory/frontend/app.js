const state = {
  token: localStorage.getItem("mims_token"),
  user: JSON.parse(localStorage.getItem("mims_user") || "null"),
  view: "dashboard",
  meta: { categories: [], locations: [] },
  cache: {},
  editing: { medicineId: null, inventoryId: null, userId: null }
};

const views = [
  ["dashboard", "Dashboard"],
  ["medicines", "Medicines"],
  ["inventory", "Inventory"],
  ["sales", "Sales"],
  ["procurement", "Procurement"],
  ["suppliers", "Suppliers"],
  ["users", "Users"],
  ["reports", "Reports"],
  ["audit", "Audit"]
];

const app = document.querySelector("#app");

function money(value) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function date(value) {
  return value ? new Date(value).toLocaleDateString("en-IN") : "-";
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(state.token ? { Authorization: `Bearer ${state.token}` } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== "/api/auth/login") {
    logout();
    throw new Error("Session expired. Please log in again.");
  }
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function html(strings, ...values) {
  return strings.reduce((out, item, index) => out + item + (values[index] ?? ""), "");
}

function setMessage(target, text, type = "success") {
  const node = document.querySelector(target);
  if (node) node.innerHTML = text ? `<div class="notice ${type}">${text}</div>` : "";
}

function render() {
  if (!state.token || !state.user) return renderLogin();
  const visibleViews = state.user?.role === "Admin"
    ? views
    : views.filter(([key]) => key !== "users");
  app.innerHTML = html`
    <div class="shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 48 48" role="img">
              <rect x="7" y="9" width="34" height="30" rx="8"></rect>
              <path d="M17 24h14"></path>
              <path d="M24 17v14"></path>
              <path d="M15 34h18"></path>
            </svg>
          </div>
          <span>Mediventory</span>
        </div>
        <nav class="nav">
          ${visibleViews.map(([key, label]) => `<button class="${state.view === key ? "active" : ""}" data-view="${key}">${label}</button>`).join("")}
        </nav>
        <div class="userbox">
          <strong>${state.user.name}</strong>
          <span>${state.user.role}</span>
          <button class="secondary" id="logout">Logout</button>
        </div>
      </aside>
      <main class="main">
        <div class="topbar">
          <div class="page-title">
            <h1>${views.find(([key]) => key === state.view)?.[1] || "Dashboard"}</h1>
            <p>Batch-level stock, expiry monitoring, procurement, sales, and audit control.</p>
          </div>
          <button class="secondary" id="refresh">Refresh</button>
        </div>
        <div id="content"></div>
      </main>
    </div>
  `;
  document.querySelectorAll("[data-view]").forEach(button => {
    button.addEventListener("click", () => {
      navigateTo(button.dataset.view);
    });
  });
  document.querySelector("#logout").addEventListener("click", logout);
  document.querySelector("#refresh").addEventListener("click", loadView);
  loadView();
}

function navigateTo(view) {
  if (state.view === view) return;
  state.view = view;
  document.querySelectorAll("[data-view]").forEach(button => {
    button.classList.toggle("active", button.dataset.view === view);
  });
  const title = document.querySelector(".page-title h1");
  if (title) title.textContent = views.find(([key]) => key === view)?.[1] || "Dashboard";
  loadView();
}

function renderLogin() {
  app.innerHTML = html`
    <div class="login">
      <section class="login-panel">
        <h1>Mediventory</h1>
        <p>Medicine Inventory Management System</p>
        <form class="login-form" id="loginForm">
          <label>Email <input name="email" value="admin@mims.local" autocomplete="username" /></label>
          <label>Password <input name="password" type="password" value="admin123" autocomplete="current-password" /></label>
          <button>Login</button>
          <div id="loginMessage"></div>
        </form>
        <div class="demo-note">Demo users: admin@mims.local / admin123, pharmacist@mims.local / pharma123</div>
      </section>
    </div>
  `;
  document.querySelector("#loginForm").addEventListener("submit", async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target).entries());
    try {
      const data = await api("/api/auth/login", { method: "POST", body: JSON.stringify(body) });
      state.token = data.token;
      state.user = data.user;
      localStorage.setItem("mims_token", data.token);
      localStorage.setItem("mims_user", JSON.stringify(data.user));
      await loadMeta();
      render();
    } catch (error) {
      setMessage("#loginMessage", error.message, "error");
    }
  });
}

function logout() {
  localStorage.removeItem("mims_token");
  localStorage.removeItem("mims_user");
  state.token = null;
  state.user = null;
  render();
}

async function loadMeta() {
  if (!state.token) return;
  state.meta = await api("/api/meta");
}

async function loadView() {
  const content = document.querySelector("#content");
  content.classList.remove("is-ready");
  content.classList.add("is-loading");
  content.innerHTML = `<div class="notice">Loading ${state.view}...</div>`;
  try {
    await loadMeta();
    if (state.view === "dashboard") return renderDashboard(await api("/api/dashboard"));
    if (state.view === "medicines") return renderMedicines(await api("/api/medicines"));
    if (state.view === "inventory") return renderInventory(await api("/api/inventory"));
    if (state.view === "sales") return renderSales(await api("/api/sales"));
    if (state.view === "procurement") return renderProcurement(await api("/api/purchases"));
    if (state.view === "suppliers") return renderSuppliers(await api("/api/suppliers"));
    if (state.view === "users") return renderUsers(await api("/api/users"));
    if (state.view === "reports") return renderReports(await api("/api/reports"));
    if (state.view === "audit") return renderAudit(await api("/api/audit"));
  } catch (error) {
    content.innerHTML = `<div class="notice error">${error.message}</div>`;
    finishViewTransition();
  }
}

function finishViewTransition() {
  const content = document.querySelector("#content");
  if (!content) return;
  content.classList.remove("is-loading");
  requestAnimationFrame(() => content.classList.add("is-ready"));
}

function renderDashboard(data) {
  const s = data.summary;
  const metricIcon = name => {
    const icons = {
      medicines: `<svg viewBox="0 0 24 24"><rect x="5" y="4" width="14" height="16" rx="4"></rect><path d="M9 12h6"></path><path d="M12 9v6"></path></svg>`,
      stock: `<svg viewBox="0 0 24 24"><path d="M4 8l8-4 8 4-8 4-8-4z"></path><path d="M4 12l8 4 8-4"></path><path d="M4 16l8 4 8-4"></path></svg>`,
      low: `<svg viewBox="0 0 24 24"><path d="M12 4v12"></path><path d="M7 11l5 5 5-5"></path><path d="M5 20h14"></path></svg>`,
      expiry: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"></circle><path d="M12 7v5l3 2"></path></svg>`
    };
    return `<div class="metric-icon ${name}">${icons[name]}</div>`;
  };
  document.querySelector("#content").innerHTML = html`
    <section class="card command-panel">
      <div class="command-copy">
        <span class="pill good">Live inventory command center</span>
        <h2>${s.totalUnits} stock units across ${s.batches} tracked batches</h2>
        <p>Critical stock, expiry risk, valuation, and dispensing activity are surfaced together so the pharmacy team can act from one operational view.</p>
        <div class="command-actions">
          <button data-view="inventory">Review batches</button>
          <button class="secondary" data-view="sales">Open POS</button>
          <button class="secondary" data-view="reports">View reports</button>
        </div>
      </div>
      <div class="command-visual" aria-hidden="true"></div>
    </section>
    <section class="grid stats">
      <div class="card metric">${metricIcon("medicines")}<span>Total medicines</span><strong>${s.medicines}</strong></div>
      <div class="card metric good">${metricIcon("stock")}<span>Stock units</span><strong>${s.totalUnits}</strong></div>
      <div class="card metric warn">${metricIcon("low")}<span>Low stock</span><strong>${s.lowStockCount}</strong></div>
      <div class="card metric danger">${metricIcon("expiry")}<span>Near expiry</span><strong>${s.nearExpiryCount}</strong></div>
    </section>
    <section class="grid split" style="margin-top:14px">
      <div class="card chart-card">
        <div class="section-head"><h2>Inventory value</h2><span class="pill good">${money(s.stockValue)}</span></div>
        <div class="chart">
          ${[
            ["Medicines", s.medicines * 12],
            ["Batches", s.batches * 16],
            ["Stock", Math.min(s.totalUnits / 5, 112)],
            ["Sales", Math.max(8, s.revenue / 18 || 12)]
          ].map(([label, value]) => `<div class="bar" style="height:${Math.min(112, Math.max(18, value))}px"><span>${label}</span></div>`).join("")}
        </div>
      </div>
      <div class="card">
        <div class="section-head"><h2>Active alerts</h2><span class="pill warn">${s.lowStockCount + s.nearExpiryCount + s.expiredCount}</span></div>
        <div class="list">
          ${data.alerts.lowStock.map(row => `<div class="list-item"><strong>${row.medicine.name}</strong><span>Low stock: ${row.quantity} units, reorder at ${row.medicine.reorderLevel}</span></div>`).join("") || `<div class="notice">No low stock alerts.</div>`}
          ${data.alerts.nearExpiry.map(row => `<div class="list-item"><strong>${row.medicine.name}</strong><span>Batch ${row.batchNumber} expires on ${date(row.expiryDate)}</span></div>`).join("")}
        </div>
      </div>
    </section>
  `;
  document.querySelectorAll(".command-actions [data-view]").forEach(button => {
    button.addEventListener("click", () => navigateTo(button.dataset.view));
  });
  finishViewTransition();
}

function renderMedicines(rows) {
  state.cache.medicines = rows;
  const editing = state.editing.medicineId;
  document.querySelector("#content").innerHTML = html`
    <section class="card">
      <div class="section-head">
        <h2>Medicine catalog</h2>
        <div class="toolbar"><input id="medicineSearch" placeholder="Search medicine, brand, manufacturer" /></div>
      </div>
      <div id="medicineMessage"></div>
      <form id="medicineForm" class="form-grid" style="margin-bottom:16px">
        <label>Name <input name="name" required /></label>
        <label>Generic <input name="genericName" required /></label>
        <label>Brand <input name="brand" /></label>
        <label>Category <select name="categoryId">${options(state.meta.categories)}</select></label>
        <label>Dosage form <input name="dosageForm" required /></label>
        <label>Strength <input name="strength" required /></label>
        <label>MRP <input name="mrp" type="number" min="0" required /></label>
        <label>Purchase price <input name="purchasePrice" type="number" min="0" required /></label>
        <label>Reorder level <input name="reorderLevel" type="number" min="0" value="10" /></label>
        <label>Manufacturer <input name="manufacturer" /></label>
        <div class="full">
          <button>${editing ? "Update medicine" : "Add medicine"}</button>
          ${editing ? "<button type=\"button\" class=\"secondary\" id=\"medicineCancel\">Cancel</button>" : ""}
        </div>
      </form>
      ${medicineTable(rows)}
    </section>
  `;
  document.querySelector("#medicineSearch").addEventListener("input", async event => {
    renderMedicines(await api(`/api/medicines?q=${encodeURIComponent(event.target.value)}`));
  });
  document.querySelector("#medicineForm").addEventListener("submit", async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target).entries());
    coerceNumbers(body, ["mrp", "purchasePrice", "reorderLevel"]);
    const path = editing ? `/api/medicines/${editing}` : "/api/medicines";
    const method = editing ? "PUT" : "POST";
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setMessage("#medicineMessage", editing ? "Medicine updated." : "Medicine added.");
      state.editing.medicineId = null;
      event.target.reset();
      setTimeout(loadView, 500);
    } catch (error) {
      setMessage("#medicineMessage", error.message, "error");
    }
  });
  const medicineTableNode = document.querySelector("#medicineTable");
  if (medicineTableNode) {
    medicineTableNode.addEventListener("click", async event => {
      const action = event.target?.dataset?.action;
      const id = event.target?.dataset?.id;
      if (!action || !id) return;
      if (action === "edit-medicine") {
        state.editing.medicineId = id;
        renderMedicines(state.cache.medicines);
        return;
      }
      if (action === "delete-medicine") {
        if (!confirm("Deactivate this medicine? Existing inventory will keep working.")) return;
        try {
          await api(`/api/medicines/${id}`, { method: "DELETE" });
          setMessage("#medicineMessage", "Medicine deactivated.");
          state.editing.medicineId = null;
          setTimeout(loadView, 500);
        } catch (error) {
          setMessage("#medicineMessage", error.message, "error");
        }
      }
    });
  }
  if (editing) {
    const current = rows.find(row => row.id === editing);
    if (current) fillMedicineForm(current);
  }
  const cancel = document.querySelector("#medicineCancel");
  if (cancel) {
    cancel.addEventListener("click", () => {
      state.editing.medicineId = null;
      renderMedicines(state.cache.medicines);
    });
  }
  finishViewTransition();
}

function medicineTable(rows) {
  return html`
    <table id="medicineTable">
      <thead><tr><th>Name</th><th>Category</th><th>Form</th><th>Stock</th><th>MRP</th><th>Status</th><th class="actions">Actions</th></tr></thead>
      <tbody>
        ${rows.map(row => html`
          <tr>
            <td><strong>${row.name}</strong><br><span>${row.genericName} - ${row.brand || "No brand"}</span></td>
            <td>${row.category || "-"}</td>
            <td>${row.dosageForm} ${row.strength}</td>
            <td>${row.stock}</td>
            <td>${money(row.mrp)}</td>
            <td><span class="pill ${row.active ? "good" : "danger"}">${row.active ? "Active" : "Inactive"}</span></td>
            <td class="actions">
              <div class="row-actions">
                <button class="secondary" data-action="edit-medicine" data-id="${row.id}">Edit</button>
                <button class="danger" data-action="delete-medicine" data-id="${row.id}">Delete</button>
              </div>
            </td>
          </tr>`).join("")}
      </tbody>
    </table>
  `;
}

function renderInventory(rows) {
  state.cache.inventory = rows;
  const editing = state.editing.inventoryId;
  document.querySelector("#content").innerHTML = html`
    <section class="grid split">
      <div class="card">
        <div class="section-head"><h2>${editing ? "Update batch" : "Add batch"}</h2></div>
        <div id="inventoryMessage"></div>
        <form id="inventoryForm" class="form-grid">
          <label class="full">Medicine <select name="medicineId" id="inventoryMedicine"></select></label>
          <label>Batch number <input name="batchNumber" required /></label>
          <label>Location <select name="locationId">${options(state.meta.locations)}</select></label>
          <label>Quantity <input name="quantity" type="number" min="0" required /></label>
          <label>Expiry <input name="expiryDate" type="date" required /></label>
          <div class="full">
            <button>${editing ? "Update batch" : "Add inventory"}</button>
            ${editing ? "<button type=\"button\" class=\"secondary\" id=\"inventoryCancel\">Cancel</button>" : ""}
          </div>
        </form>
      </div>
      <div class="card">
        <div class="section-head"><h2>Batch inventory</h2><span class="pill">${rows.length} batches</span></div>
        <table>
          <thead><tr><th>Medicine</th><th>Batch</th><th>Location</th><th>Qty</th><th>Expiry</th><th>Alert</th><th class="actions">Actions</th></tr></thead>
          <tbody>
            ${rows.map(row => {
              const days = (new Date(row.expiryDate) - new Date()) / 86400000;
              const cls = days < 0 ? "danger" : days <= 60 ? "warn" : "good";
              const label = days < 0 ? "Expired" : days <= 60 ? "Near expiry" : "OK";
              return `<tr><td>${row.medicine?.name || "-"}</td><td>${row.batchNumber}</td><td>${row.location?.name || "-"}</td><td>${row.quantity}</td><td>${date(row.expiryDate)}</td><td><span class="pill ${cls}">${label}</span></td><td class="actions"><div class="row-actions"><button class="secondary" data-action="edit-inventory" data-id="${row.id}">Edit</button><button class="danger" data-action="delete-inventory" data-id="${row.id}">Delete</button></div></td></tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
  const inventoryRow = editing ? rows.find(row => row.id === editing) : null;
  fillMedicineSelect("#inventoryMedicine", inventoryRow?.medicineId || inventoryRow?.medicine?.id || "");
  document.querySelector("#inventoryForm").addEventListener("submit", async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target).entries());
    coerceNumbers(body, ["quantity"]);
    const path = editing ? `/api/inventory/${editing}` : "/api/inventory";
    const method = editing ? "PUT" : "POST";
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setMessage("#inventoryMessage", editing ? "Batch updated." : "Batch added.");
      state.editing.inventoryId = null;
      event.target.reset();
      setTimeout(loadView, 500);
    } catch (error) {
      setMessage("#inventoryMessage", error.message, "error");
    }
  });
  const inventoryTable = document.querySelector("#content table");
  if (inventoryTable) {
    inventoryTable.addEventListener("click", async event => {
      const action = event.target?.dataset?.action;
      const id = event.target?.dataset?.id;
      if (!action || !id) return;
      if (action === "edit-inventory") {
        state.editing.inventoryId = id;
        renderInventory(state.cache.inventory);
        return;
      }
      if (action === "delete-inventory") {
        if (!confirm("Delete this batch?")) return;
        try {
          await api(`/api/inventory/${id}`, { method: "DELETE" });
          setMessage("#inventoryMessage", "Batch deleted.");
          state.editing.inventoryId = null;
          setTimeout(loadView, 500);
        } catch (error) {
          setMessage("#inventoryMessage", error.message, "error");
        }
      }
    });
  }
  if (editing && inventoryRow) fillInventoryForm(inventoryRow);
  const inventoryCancel = document.querySelector("#inventoryCancel");
  if (inventoryCancel) {
    inventoryCancel.addEventListener("click", () => {
      state.editing.inventoryId = null;
      renderInventory(state.cache.inventory);
    });
  }
  finishViewTransition();
}

function renderSales(rows) {
  document.querySelector("#content").innerHTML = html`
    <section class="grid split">
      <div class="card">
        <div class="section-head"><h2>Sales transactions</h2><span class="pill">${rows.length} invoices</span></div>
        <table>
          <thead><tr><th>Invoice</th><th>Customer</th><th>Items</th><th>Total</th><th>Date</th></tr></thead>
          <tbody>
            ${rows.map(row => `<tr><td>${row.invoiceNumber}</td><td>${row.customerName}<br><span>${row.customerType}</span></td><td>${row.items.length}</td><td>${money(row.totalAmount)}</td><td>${date(row.createdAt)}</td></tr>`).join("") || `<tr><td colspan="5">No sales yet.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="section-head"><h2>Fast POS</h2></div>
        <div id="salesMessage"></div>
        <form id="salesForm" class="form-grid">
          <label>Customer <input name="customerName" value="Walk-in Customer" required /></label>
          <label>Type <select name="customerType"><option>Retail</option><option>Hospital</option><option>Clinic</option></select></label>
          <label>Location <select name="locationId">${options(state.meta.locations)}</select></label>
          <label>Medicine <select name="medicineId" id="saleMedicine"></select></label>
          <label>Quantity <input name="quantity" type="number" min="1" value="1" required /></label>
          <div class="full"><button>Create invoice</button></div>
        </form>
      </div>
    </section>
  `;
  fillMedicineSelect("#saleMedicine");
  document.querySelector("#salesForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api("/api/sales", {
        method: "POST",
        body: JSON.stringify({
          customerName: form.customerName,
          customerType: form.customerType,
          locationId: form.locationId,
          items: [{ medicineId: form.medicineId, quantity: Number(form.quantity) }]
        })
      });
      setMessage("#salesMessage", "Invoice generated and stock deducted.");
      event.target.reset();
      setTimeout(loadView, 500);
    } catch (error) {
      setMessage("#salesMessage", error.message, "error");
    }
  });
  finishViewTransition();
}

function renderProcurement(rows) {
  document.querySelector("#content").innerHTML = html`
    <section class="grid split">
      <div class="card">
        <div class="section-head"><h2>Purchase orders</h2><span class="pill">${rows.length} orders</span></div>
        <table>
          <thead><tr><th>PO</th><th>Status</th><th>Items</th><th>Total</th><th>Date</th></tr></thead>
          <tbody>
            ${rows.map(row => `<tr><td>${row.poNumber}</td><td><span class="pill">${row.status}</span></td><td>${row.items.length}</td><td>${money(row.totalAmount)}</td><td>${date(row.createdAt)}</td></tr>`).join("") || `<tr><td colspan="5">No purchase orders yet.</td></tr>`}
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="section-head"><h2>Create purchase order</h2></div>
        <div id="purchaseMessage"></div>
        <form id="purchaseForm" class="form-grid">
          <label>Supplier <select name="supplierId" id="purchaseSupplier"></select></label>
          <label>Medicine <select name="medicineId" id="purchaseMedicine"></select></label>
          <label>Quantity <input name="quantity" type="number" min="1" value="10" /></label>
          <label>Unit cost <input name="unitCost" type="number" min="0" value="10" /></label>
          <div class="full"><button>Create PO</button></div>
        </form>
      </div>
    </section>
  `;
  fillMedicineSelect("#purchaseMedicine");
  fillSupplierSelect("#purchaseSupplier");
  document.querySelector("#purchaseForm").addEventListener("submit", async event => {
    event.preventDefault();
    const form = Object.fromEntries(new FormData(event.target).entries());
    try {
      await api("/api/purchases", {
        method: "POST",
        body: JSON.stringify({
          supplierId: form.supplierId,
          items: [{ medicineId: form.medicineId, quantity: Number(form.quantity), unitCost: Number(form.unitCost) }]
        })
      });
      setMessage("#purchaseMessage", "Purchase order created.");
      setTimeout(loadView, 500);
    } catch (error) {
      setMessage("#purchaseMessage", error.message, "error");
    }
  });
  finishViewTransition();
}

function renderSuppliers(rows) {
  document.querySelector("#content").innerHTML = html`
    <section class="grid split">
      <div class="card">
        <div class="section-head"><h2>Suppliers</h2><span class="pill">${rows.length} suppliers</span></div>
        <table>
          <thead><tr><th>Name</th><th>Contact</th><th>GSTIN</th><th>Rating</th></tr></thead>
          <tbody>${rows.map(row => `<tr><td>${row.name}</td><td>${row.contactPerson}<br><span>${row.phone}</span></td><td>${row.gstin || "-"}</td><td>${row.rating || 0}</td></tr>`).join("")}</tbody>
        </table>
      </div>
      <div class="card">
        <div class="section-head"><h2>Add supplier</h2></div>
        <div id="supplierMessage"></div>
        <form id="supplierForm" class="form-grid">
          <label>Name <input name="name" required /></label>
          <label>Contact person <input name="contactPerson" required /></label>
          <label>Phone <input name="phone" required /></label>
          <label>Email <input name="email" type="email" /></label>
          <label class="full">GSTIN <input name="gstin" /></label>
          <div class="full"><button>Add supplier</button></div>
        </form>
      </div>
    </section>
  `;
  document.querySelector("#supplierForm").addEventListener("submit", submitJson("/api/suppliers", "#supplierMessage"));
  finishViewTransition();
}

function renderUsers(rows) {
  if (state.user?.role !== "Admin") {
    document.querySelector("#content").innerHTML = html`
      <section class="card"><div class="notice error">Admin access required.</div></section>
    `;
    finishViewTransition();
    return;
  }
  state.cache.users = rows;
  const editing = state.editing.userId;
  document.querySelector("#content").innerHTML = html`
    <section class="grid split">
      <div class="card">
        <div class="section-head"><h2>Users</h2><span class="pill">${rows.length} accounts</span></div>
        <table id="usersTable">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th class="actions">Actions</th></tr></thead>
          <tbody>
            ${rows.map(row => `
              <tr>
                <td>${row.name}</td>
                <td>${row.email}</td>
                <td>${row.role}</td>
                <td><span class="pill ${row.active ? "good" : "danger"}">${row.active ? "Active" : "Inactive"}</span></td>
                <td class="actions">
                  <div class="row-actions">
                    <button class="secondary" data-action="edit-user" data-id="${row.id}">Edit</button>
                    <button class="danger" data-action="delete-user" data-id="${row.id}">Delete</button>
                  </div>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div class="card">
        <div class="section-head"><h2>${editing ? "Update user" : "Add user"}</h2></div>
        <div id="userMessage"></div>
        <form id="userForm" class="form-grid">
          <label>Name <input name="name" required /></label>
          <label>Email <input name="email" type="email" required /></label>
          <label>Role <select name="role">${options(state.meta.roles.map(role => ({ id: role, name: role })))}</select></label>
          <label>Password <input name="password" type="password" ${editing ? "" : "required"} /></label>
          <label>Active <select name="active"><option value="true">Active</option><option value="false">Inactive</option></select></label>
          <div class="full">
            <button>${editing ? "Update user" : "Add user"}</button>
            ${editing ? "<button type=\"button\" class=\"secondary\" id=\"userCancel\">Cancel</button>" : ""}
          </div>
        </form>
      </div>
    </section>
  `;
  document.querySelector("#userForm").addEventListener("submit", async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target).entries());
    body.active = body.active === "true";
    if (!editing && !body.password) {
      setMessage("#userMessage", "Password is required for new users.", "error");
      return;
    }
    if (editing && !body.password) delete body.password;
    const path = editing ? `/api/users/${editing}` : "/api/users";
    const method = editing ? "PUT" : "POST";
    try {
      await api(path, { method, body: JSON.stringify(body) });
      setMessage("#userMessage", editing ? "User updated." : "User created.");
      state.editing.userId = null;
      event.target.reset();
      setTimeout(loadView, 500);
    } catch (error) {
      setMessage("#userMessage", error.message, "error");
    }
  });
  const usersTable = document.querySelector("#usersTable");
  if (usersTable) {
    usersTable.addEventListener("click", async event => {
      const action = event.target?.dataset?.action;
      const id = event.target?.dataset?.id;
      if (!action || !id) return;
      if (action === "edit-user") {
        state.editing.userId = id;
        renderUsers(state.cache.users);
        return;
      }
      if (action === "delete-user") {
        if (!confirm("Deactivate this user?")) return;
        try {
          await api(`/api/users/${id}`, { method: "DELETE" });
          setMessage("#userMessage", "User deactivated.");
          state.editing.userId = null;
          setTimeout(loadView, 500);
        } catch (error) {
          setMessage("#userMessage", error.message, "error");
        }
      }
    });
  }
  if (editing) {
    const current = rows.find(row => row.id === editing);
    if (current) fillUserForm(current);
  }
  const userCancel = document.querySelector("#userCancel");
  if (userCancel) {
    userCancel.addEventListener("click", () => {
      state.editing.userId = null;
      renderUsers(state.cache.users);
    });
  }
  finishViewTransition();
}

function renderReports(data) {
  document.querySelector("#content").innerHTML = html`
    <section class="grid stats">
      <div class="card metric good"><span>Inventory valuation</span><strong>${money(data.valuation)}</strong></div>
      <div class="card metric"><span>Sales reports</span><strong>${data.sales.length}</strong></div>
      <div class="card metric warn"><span>Expiry alerts</span><strong>${data.alerts.nearExpiry.length}</strong></div>
      <div class="card metric danger"><span>Expired stock</span><strong>${data.alerts.expired.length}</strong></div>
    </section>
    <section class="card" style="margin-top:14px">
      <div class="section-head">
        <h2>Exportable report data</h2>
        <button id="downloadReport">Download JSON</button>
      </div>
      <table>
        <thead><tr><th>Report</th><th>Rows</th><th>Notes</th></tr></thead>
        <tbody>
          <tr><td>Inventory</td><td>${data.inventory.length}</td><td>Batch, location, expiry, valuation</td></tr>
          <tr><td>Sales</td><td>${data.sales.length}</td><td>Invoices and transaction history</td></tr>
          <tr><td>Procurement</td><td>${data.purchases.length}</td><td>Purchase order status tracking</td></tr>
        </tbody>
      </table>
    </section>
  `;
  document.querySelector("#downloadReport").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `mims-report-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  });
  finishViewTransition();
}

function renderAudit(rows) {
  document.querySelector("#content").innerHTML = html`
    <section class="card">
      <div class="section-head"><h2>Audit logs</h2><span class="pill">${rows.length} events</span></div>
      <table>
        <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
        <tbody>${rows.map(row => `<tr><td>${date(row.createdAt)}</td><td>${row.actor}</td><td>${row.action}</td><td>${row.details}</td></tr>`).join("")}</tbody>
      </table>
    </section>
  `;
  finishViewTransition();
}

function options(rows) {
  return rows.map(row => `<option value="${row.id}">${row.name}</option>`).join("");
}

async function fillMedicineSelect(selector, selectedId = "") {
  const rows = await api("/api/medicines");
  const node = document.querySelector(selector);
  if (node) {
    node.innerHTML = options(rows);
    if (selectedId) node.value = selectedId;
  }
}

async function fillSupplierSelect(selector) {
  const rows = await api("/api/suppliers");
  const node = document.querySelector(selector);
  if (node) node.innerHTML = options(rows);
}

function submitJson(path, messageTarget) {
  return async event => {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.target).entries());
    coerceNumbers(body, ["mrp", "purchasePrice", "reorderLevel", "quantity"]);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body) });
      setMessage(messageTarget, "Saved successfully.");
      event.target.reset();
      setTimeout(loadView, 500);
    } catch (error) {
      setMessage(messageTarget, error.message, "error");
    }
  };
}

function coerceNumbers(body, keys) {
  for (const key of keys) {
    if (body[key] !== "" && !Number.isNaN(Number(body[key]))) body[key] = Number(body[key]);
  }
}

function fillMedicineForm(row) {
  const form = document.querySelector("#medicineForm");
  if (!form) return;
  form.name.value = row.name || "";
  form.genericName.value = row.genericName || "";
  form.brand.value = row.brand || "";
  form.categoryId.value = row.categoryId || "";
  form.dosageForm.value = row.dosageForm || "";
  form.strength.value = row.strength || "";
  form.mrp.value = row.mrp ?? "";
  form.purchasePrice.value = row.purchasePrice ?? "";
  form.reorderLevel.value = row.reorderLevel ?? "";
  form.manufacturer.value = row.manufacturer || "";
}

function fillInventoryForm(row) {
  const form = document.querySelector("#inventoryForm");
  if (!form) return;
  form.medicineId.value = row.medicineId || row.medicine?.id || "";
  form.batchNumber.value = row.batchNumber || "";
  form.locationId.value = row.locationId || row.location?.id || "";
  form.quantity.value = row.quantity ?? "";
  form.expiryDate.value = row.expiryDate ? new Date(row.expiryDate).toISOString().slice(0, 10) : "";
}

function fillUserForm(row) {
  const form = document.querySelector("#userForm");
  if (!form) return;
  form.name.value = row.name || "";
  form.email.value = row.email || "";
  form.role.value = row.role || "";
  form.password.value = "";
  form.active.value = row.active ? "true" : "false";
}

loadMeta().catch(() => logout()).finally(render);
