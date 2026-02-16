// app.js — local, private audit storage for GitHub Pages
const AUDIT_KEY = "bt_3158_audits_v1";
const DEVICE_KEY = "bt_3158_device_name_v1";

function loadAudits(){
  try{
    const raw = localStorage.getItem(AUDIT_KEY);
    if(!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  }catch(e){
    return [];
  }
}

function getDeviceName(){
  try{
    return (localStorage.getItem(DEVICE_KEY) || "").trim();
  }catch(e){
    return "";
  }
}

function setDeviceName(name){
  const clean = (name || "").trim();
  localStorage.setItem(DEVICE_KEY, clean);
}

function saveAudits(audits){
  localStorage.setItem(AUDIT_KEY, JSON.stringify(audits));
}

function clearAllAudits(){
  saveAudits([]);
}

function exportAuditsJSON(opts = {}){
  const { auditType } = opts;

  const all = loadAudits();
  const filtered = auditType
    ? all.filter(a => (a.audit_type || "") === auditType)
    : all;

  const payload = {
    schema: "bt_audits_export_v2",
    exported_at: nowISO(),
    exported_from_device: getDeviceName(),
    filter: auditType ? { audit_type: auditType } : { audit_type: "ALL" },
    audits: filtered
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;

  const date = new Date().toISOString().slice(0,10);
  const suffix = auditType ? auditType.replace(/\s+/g, "_").toLowerCase() : "all";
  a.download = `3158_audits_${suffix}_${date}.json`;

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(url);
}

function importAuditsJSON(jsonText){
  const incoming = JSON.parse(jsonText);

  // Accept either our wrapped format or a raw audits array
  let incomingAudits = [];
  if(Array.isArray(incoming)){
    incomingAudits = incoming;
  }else if(incoming && Array.isArray(incoming.audits)){
    incomingAudits = incoming.audits;
  }else{
    throw new Error("Invalid import format");
  }

  const current = loadAudits();

  // Use ID to de-dupe. If no id exists, generate one.
  const existingIds = new Set(current.map(a => a.id).filter(Boolean));

  let added = 0;
  let skipped = 0;

  for(const a of incomingAudits){
    if(!a) continue;

    if(!a.id){
      a.id = uid();
    }

    if(existingIds.has(a.id)){
      skipped += 1;
      continue;
    }

    current.push(a);
    existingIds.add(a.id);
    added += 1;
  }

  // sort newest-first by created_at
  current.sort((x,y) => new Date(y.created_at || 0) - new Date(x.created_at || 0));

  saveAudits(current);

  return { added, skipped };
}

function uid(){
  return Math.random().toString(16).slice(2) + "-" + Date.now().toString(16);
}

function nowISO(){
  return new Date().toISOString();
}

function fmtDT(iso){
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

// ---------- Form UI builders ----------
function section(title){
  return `
    <div class="panel" style="margin:18px 0 6px;">
      <div class="qTitle" style="
        font-size:16px;
        font-weight:1000;
        color:#2f6cff;
      ">
        ${escapeHtml(title)}
      </div>
    </div>
  `;
}

function category(title){
  return `<div class="catTitle">${escapeHtml(title)}</div>`;
}

function section(title){
  return `
    <div class="auditSection">${escapeHtml(title)}</div>
  `;
}

function yn(label){
  const id = uid();
  return `
    <div class="auditItem">
      <div class="auditQuestion">${escapeHtml(label)}</div>

      <div class="yn">
        <div class="ynOptions">
          <label>
            <input type="radio" name="${id}_yn" value="Yes">
            Yes
          </label>

          <label>
            <input type="radio" name="${id}_yn" value="No">
            No
          </label>
        </div>

        <textarea class="notes" name="${id}_notes" placeholder="Comments"></textarea>

        <input type="hidden" name="${id}_label" value="${escapeHtml(label)}">
        <input type="hidden" name="${id}_type" value="yn">
      </div>
    </div>
  `;
}

function notesOnly(label){
  const id = uid();
  return `
    <div class="q">
      <div class="qHead">
        <div class="qTitle">${escapeHtml(label)}</div>
      </div>

      <div class="field">
        <label class="small">Notes</label>
        <textarea name="${id}_notes" placeholder="Comment..."></textarea>
      </div>

      <input type="hidden" name="${id}_label" value="${escapeHtml(label)}">
      <input type="hidden" name="${id}_type" value="notes">
    </div>
  `;
}

// Yes / No / N/A (no comments)
function yna(label){
  const id = uid();
  return `
    <div class="auditItem">
      <div class="auditQuestion">${escapeHtml(label)}</div>

      <div class="yn">
        <div class="ynOptions">
          <label><input type="radio" name="${id}_yn" value="Yes"> Yes</label>
          <label><input type="radio" name="${id}_yn" value="No"> No</label>
          <label><input type="radio" name="${id}_yn" value="N/A"> N/A</label>
        </div>
      </div>

      <input type="hidden" name="${id}_label" value="${escapeHtml(label)}">
      <input type="hidden" name="${id}_type" value="yn">
    </div>
  `;
}

function triOuts(){
  const id = uid();
  return `
    <div class="q">
      <div class="qHead">
        <div class="qTitle">Outs 10 or less?</div>
      </div>

      <div class="tri">
        ${triRow(`${id}_sf`, "Sales Floor outs 10 or less?")}
        ${triRow(`${id}_cool`, "Cooler outs 10 or less?")}
        ${triRow(`${id}_beer`, "Beer outs 10 or less?")}
      </div>

      <div class="field">
        <label class="small">Notes</label>
        <textarea name="${id}_notes" placeholder="Comment..."></textarea>
      </div>

      <input type="hidden" name="${id}_type" value="triOuts">
    </div>
  `;
}

function triRow(nameBase, label){
  return `
    <div class="triRow">
      <div class="triLabel">${escapeHtml(label)}</div>
      <div class="yn">
        <label class="ynOpt">
          <input type="radio" name="${nameBase}_yn" value="Yes"><span>Yes</span>
        </label>
        <label class="ynOpt">
          <input type="radio" name="${nameBase}_yn" value="No"><span>No</span>
        </label>
      </div>
      <input type="hidden" name="${nameBase}_label" value="${escapeHtml(label)}">
    </div>
  `;
}

// ---------- Save from form ----------
function saveAuditFromForm(form){
  const fd = new FormData(form);

  const audit = {
    id: uid(),
    created_at: nowISO(),
    audit_type: (fd.get("audit_type") || "").toString() || "Audit",
    auditor: (fd.get("auditor") || "").toString(),
    audit_date: (fd.get("audit_date") || "").toString(),
    audit_time: (fd.get("audit_time") || "").toString(),
    header_notes: (fd.get("header_notes") || "").toString(),
    device_name: getDeviceName(),
    items: []
  };

  // Parse dynamic items:
  // We stored hidden fields: *_type and *_label
  for (const [k, v] of fd.entries()){
    if(!k.endsWith("_type")) continue;
    const base = k.slice(0, -5); // remove "_type"
    const type = String(v);

    if(type === "yn"){
      const label = (fd.get(`${base}_label`) || "").toString();
      const ynVal = (fd.get(`${base}_yn`) || "").toString(); // could be "" if not selected
      const notes = (fd.get(`${base}_notes`) || "").toString();
      audit.items.push({ label, kind:"yn", value: ynVal, notes });
    }

    if(type === "notes"){
      const label = (fd.get(`${base}_label`) || "").toString();
      const notes = (fd.get(`${base}_notes`) || "").toString();
      audit.items.push({ label, kind:"notes", notes });
    }

    if(type === "triOuts"){
      const sf = (fd.get(`${base}_sf_yn`) || "").toString();
      const cool = (fd.get(`${base}_cool_yn`) || "").toString();
      const beer = (fd.get(`${base}_beer_yn`) || "").toString();
      const notes = (fd.get(`${base}_notes`) || "").toString();
      audit.items.push({
        label: "Sales Floor outs 10 or less?",
        kind:"yn",
        value: sf,
        notes:""
      });
      audit.items.push({
        label: "Cooler outs 10 or less?",
        kind:"yn",
        value: cool,
        notes:""
      });
      audit.items.push({
        label: "Beer outs 10 or less?",
        kind:"yn",
        value: beer,
        notes:""
      });
      audit.items.push({
        label: "Outs notes",
        kind:"notes",
        notes
      });
    }
  }

  // newest first
  const audits = loadAudits();
  audits.unshift(audit);
  saveAudits(audits);
}

// ---------- History rendering ----------
function groupByType(audits){
  const groups = {};
  for(const a of audits){
    const key = a.audit_type || "Audit";
    groups[key] = groups[key] || [];
    groups[key].push(a);
  }
  return groups;
}

function renderHistoryGroupedByType(container){
  const audits = loadAudits();
  if(audits.length === 0){
    container.innerHTML = `<div class="panel"><div class="muted">No audits submitted yet.</div></div>`;
    return;
  }

  const groups = groupByType(audits);
  const types = Object.keys(groups).sort((a,b)=>a.localeCompare(b));

  container.innerHTML = types.map(type => {
    const list = groups[type].map(a => historyItem(a)).join("");
    return `
      <div class="panel" style="margin-bottom:12px;">
        <div class="row">
          <div class="itemTitle">${escapeHtml(type)}</div>
          <div class="muted">${groups[type].length} item(s)</div>
        </div>
        <div style="height:10px"></div>
        <div class="list">${list}</div>
      </div>
    `;
  }).join("");
}

function historyItem(audit){
  const metaBits = [];
if(audit.audit_date) metaBits.push(audit.audit_date);
if(audit.audit_time) metaBits.push(audit.audit_time);
if(audit.auditor) metaBits.push(`Auditor: ${audit.auditor}`);
if(audit.device_name) metaBits.push(`Device: ${audit.device_name}`);
metaBits.push(fmtDT(audit.created_at));

  // --- Special summary line for Cigarette Count audits ---
  let extraSummary = "";
  if(audit.audit_type === "Cigarette Count" && audit.cig){
    const packsEq = audit.cig.packs_equiv ?? "";
    const inv = audit.cig.inventory_total ?? 0;
    const book = audit.cig.book_total ?? 0;
    const label = audit.cig.over_short_label ?? "";
    const os = audit.cig.over_short_value ?? 0;

    extraSummary = `
      <div class="muted">
        Packs: <b>${escapeHtml(String(packsEq))}</b>
        • Inventory: <b>${escapeHtml(fmtMoney(inv))}</b>
        • Book: <b>${escapeHtml(fmtMoney(book))}</b>
        • <b>${escapeHtml(label)}</b>: <b>${escapeHtml(fmtMoney(os))}</b>
      </div>
    `;
  }

function fmtMoney(x){
  try{
    const n = Number(x || 0);
    return n.toLocaleString(undefined, { style:"currency", currency:"USD" });
  }catch(e){
    return String(x ?? "");
  }
}
  
  const yes = audit.items.filter(i=>i.kind==="yn" && i.value==="Yes").length;
  const no  = audit.items.filter(i=>i.kind==="yn" && i.value==="No").length;
  const missing = audit.items.filter(i=>i.kind==="yn" && !i.value).length;

  const details = audit.items.map(i => {
  if(i.kind === "yn"){
    return `
      <div class="detailRow">
        <div class="detailLabel">${escapeHtml(i.label)}</div>
        <div class="detailVal">${escapeHtml(i.value || "—")}</div>
        ${i.notes ? `<div class="detailNotes">${escapeHtml(i.notes)}</div>` : ``}
      </div>
    `;
  }

  if(i.kind === "calc"){
    const v = (i.value === 0 || i.value) ? String(i.value) : "—";
    return `
      <div class="detailRow">
        <div class="detailLabel">${escapeHtml(i.label)}</div>
        <div class="detailVal">${escapeHtml(v)}</div>
      </div>
    `;
  }

  // notes (or anything else)
  return `
    <div class="detailRow">
      <div class="detailLabel">${escapeHtml(i.label)}</div>
      ${i.notes
        ? `<div class="detailNotes">${escapeHtml(i.notes)}</div>`
        : `<div class="detailNotes muted">—</div>`}
    </div>
  `;
}).join("");
  return `
    <details class="item">
      <summary class="itemSummary">
        <div>
          <div class="itemTitle">${escapeHtml(audit.audit_type)} Audit</div>
          <div class="muted">${escapeHtml(metaBits.join(" • "))}</div>
          ${extraSummary}
          ${audit.audit_type === "Cigarette Count"
  ? ""
  : `<div class="muted">Yes: ${yes} • No: ${no} • Blank: ${missing}</div>`
}
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
  <a class="btn smallBtn" href="print.html?id=${audit.id}" target="_blank"
     onclick="event.stopPropagation();">
     Print
  </a>

  <button class="btn danger smallBtn" type="button"
    onclick="event.preventDefault(); event.stopPropagation(); deleteAudit('${audit.id}')">
    Delete
  </button>
</div>
      </summary>
      <div class="detailsBody">
  <div class="row noPrint" style="justify-content:flex-end; gap:8px; margin: 10px 0;">
    <a class="btn smallBtn" href="print.html?id=${audit.id}" target="_blank">Print</a>
  </div>

  ${audit.header_notes ? `<div class="panel" style="margin-bottom:10px;">
    <div class="itemTitle">Header Notes</div>
    <div style="white-space:pre-wrap;margin-top:6px;">${escapeHtml(audit.header_notes)}</div>
  </div>` : ``}

  ${details}
</div>
    </details>
  `;
}

function deleteAudit(id){
  if(!confirm("Delete this audit?")) return;
  const audits = loadAudits().filter(a => a.id !== id);
  saveAudits(audits);
  // re-render if history page is open
  const el = document.getElementById("history");
  if(el) renderHistoryGroupedByType(el);
}
