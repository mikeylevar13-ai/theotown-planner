const $ = (id) => document.getElementById(id);

const STORAGE_KEY = "tt_planner_v1";

const SERVICE_ITEMS = [
  "Power", "Water", "Garbage",
  "Fire", "Police", "Health",
  "Education", "Parks", "Transport",
  "Road upgrades", "Industry buffer", "Flood plan"
];

const state = load() || { plans: [] };

let currentTags = new Set();

function load() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }
  catch { return null; }
}
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function makeChecks() {
  const wrap = $("checks");
  wrap.innerHTML = "";
  SERVICE_ITEMS.forEach((label) => {
    const div = document.createElement("label");
    div.className = "check";
    div.innerHTML = `<input type="checkbox" data-svc="${escapeHtml(label)}">
                     <span>${escapeHtml(label)}</span>`;
    wrap.appendChild(div);
  });
}

function escapeHtml(s){
  return s.replace(/[&<>"']/g, (c) => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}

function clearForm() {
  $("name").value = "";
  $("style").value = "curvy";
  $("size").value = "medium";
  $("goal").value = "fast-growth";
  $("notes").value = "";
  currentTags = new Set();
  document.querySelectorAll(".pill").forEach(b => b.classList.remove("on"));
  document.querySelectorAll('#checks input[type="checkbox"]').forEach(cb => cb.checked = false);
}

function getFormData() {
  const services = {};
  document.querySelectorAll('#checks input[type="checkbox"]').forEach(cb => {
    services[cb.dataset.svc] = cb.checked;
  });

  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
    ts: Date.now(),
    name: ($("name").value || "").trim() || "Untitled plan",
    style: $("style").value,
    size: $("size").value,
    goal: $("goal").value,
    tags: Array.from(currentTags),
    notes: ($("notes").value || "").trim(),
    services
  };
}

function badgeText(key, val){
  if (key === "goal") {
    if (val === "fast-growth") return "Fast growth";
    if (val === "low-traffic") return "Low traffic";
    if (val === "pretty") return "Pretty";
    return "Money";
  }
  if (key === "size") return val[0].toUpperCase() + val.slice(1);
  if (key === "style") return val[0].toUpperCase() + val.slice(1);
  return val;
}

function render() {
  $("planCount").textContent = state.plans.length;

  const list = $("list");
  const empty = $("empty");
  list.innerHTML = "";

  if (!state.plans.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  state.plans
    .slice()
    .sort((a,b) => b.ts - a.ts)
    .forEach((p) => {
      const div = document.createElement("div");
      div.className = "plan";

      const tags = (p.tags || []).map(t => `<span class="badge">${escapeHtml(t)}</span>`).join("");

      const svcDone = Object.values(p.services || {}).filter(Boolean).length;
      const svcTotal = SERVICE_ITEMS.length;

      div.innerHTML = `
        <div class="planTop">
          <div>
            <div class="planName">${escapeHtml(p.name)}</div>
            <div class="badges" style="margin-top:6px;">
              <span class="badge style">${escapeHtml(badgeText("style", p.style))}</span>
              <span class="badge size">${escapeHtml(badgeText("size", p.size))}</span>
              <span class="badge goal">${escapeHtml(badgeText("goal", p.goal))}</span>
              <span class="badge" title="Services checked">${svcDone}/${svcTotal} services</span>
            </div>
          </div>
          <div class="badges">${tags}</div>
        </div>

        <div class="planNotes">${escapeHtml(p.notes || "")}</div>

        <div class="planFooter">
          <button class="small ghost" data-act="copy" data-id="${p.id}">Copy</button>
          <button class="small ghost" data-act="edit" data-id="${p.id}">Edit</button>
          <button class="small danger" data-act="del" data-id="${p.id}">Delete</button>
        </div>
      `;

      list.appendChild(div);
    });
}

function exportData() {
  const payload = { version: 1, exportedAt: new Date().toISOString(), plans: state.plans };
  const text = JSON.stringify(payload, null, 2);

  // Try to copy to clipboard; fallback to prompt
  navigator.clipboard?.writeText(text).then(() => {
    alert("Export copied to clipboard.");
  }).catch(() => {
    prompt("Copy this export JSON:", text);
  });
}

function importData(text) {
  let parsed;
  try { parsed = JSON.parse(text); } catch { alert("That isn’t valid JSON."); return; }
  const plans = parsed.plans;
  if (!Array.isArray(plans)) { alert("Import must contain { plans: [...] }."); return; }

  // Merge without duplicates by id
  const existing = new Set(state.plans.map(p => p.id));
  let added = 0;
  plans.forEach(p => {
    if (p && p.id && !existing.has(p.id)) {
      state.plans.push(p);
      added++;
    }
  });

  save();
  render();
  alert(`Imported ${added} plan(s).`);
}

function fillFormForEdit(plan) {
  $("name").value = plan.name || "";
  $("style").value = plan.style || "curvy";
  $("size").value = plan.size || "medium";
  $("goal").value = plan.goal || "fast-growth";
  $("notes").value = plan.notes || "";

  currentTags = new Set(plan.tags || []);
  document.querySelectorAll(".pill").forEach(b => {
    const tag = b.dataset.tag;
    b.classList.toggle("on", currentTags.has(tag));
  });

  const services = plan.services || {};
  document.querySelectorAll('#checks input[type="checkbox"]').forEach(cb => {
    cb.checked = !!services[cb.dataset.svc];
  });
}

function upsertPlan(updated) {
  const idx = state.plans.findIndex(p => p.id === updated.id);
  if (idx >= 0) state.plans[idx] = updated;
  else state.plans.push(updated);
  save();
  render();
}

function copyPlan(plan) {
  const copy = structuredClone ? structuredClone(plan) : JSON.parse(JSON.stringify(plan));
  copy.id = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random());
  copy.ts = Date.now();
  copy.name = (copy.name || "Plan") + " (copy)";
  state.plans.push(copy);
  save();
  render();
}

function init() {
  makeChecks();
  render();

  document.querySelectorAll(".pill").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.dataset.tag;
      if (currentTags.has(tag)) currentTags.delete(tag);
      else currentTags.add(tag);
      btn.classList.toggle("on");
    });
  });

  let editId = null;

  $("saveBtn").addEventListener("click", () => {
    const data = getFormData();
    if (editId) data.id = editId; // keep same id when editing
    upsertPlan(data);
    editId = null;
    clearForm();
  });

  $("clearBtn").addEventListener("click", () => {
    editId = null;
    clearForm();
  });

  $("list").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const id = btn.dataset.id;
    const act = btn.dataset.act;
    const plan = state.plans.find(p => p.id === id);
    if (!plan) return;

    if (act === "del") {
      if (!confirm("Delete this plan?")) return;
      state.plans = state.plans.filter(p => p.id !== id);
      save(); render();
    }
    if (act === "edit") {
      editId = id;
      fillFormForEdit(plan);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    if (act === "copy") {
      copyPlan(plan);
    }
  });

  $("exportBtn").addEventListener("click", exportData);

  $("importBtn").addEventListener("click", () => {
    $("importText").value = "";
    $("importDialog").showModal();
  });

  $("doImport").addEventListener("click", (e) => {
    e.preventDefault();
    const text = $("importText").value;
    $("importDialog").close();
    importData(text);
  });

  $("resetBtn").addEventListener("click", () => {
    if (!confirm("Reset everything? This deletes all saved plans on this device.")) return;
    localStorage.removeItem(STORAGE_KEY);
    location.reload();
  });

  // PWA SW register
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

init();
