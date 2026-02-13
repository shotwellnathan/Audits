// app.js — local, private audit storage for GitHub Pages
const AUDIT_KEY = "bt_3158_audits_v1";

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

function saveAudits(audits){
  localStorage.setItem(AUDIT_KEY, JSON.stringify(audits));
}

function clearAllAudits(){
  saveAudits([]);
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
function yn(label){
  const id = uid();
  // no default selection: neither radio checked
  return `
    <div class="q">
      <div class="qHead">
        <div class="qTitle">${escapeHtml(label)}</div>
        <div class="yn">
          <label class="ynOpt">
            <input type="radio" name="${id}_yn" value="Yes">
            <span>Yes</span>
          </label>
          <label class="ynOpt">
            <input type="radio" name="${id}_yn" value="No">
            <span>No</span>
          </label>
        </div>
      </div>

      <div class="field">
        <label class="small">Notes</label>
        <textarea name="${id}_notes" placeholder="Comment..."></textarea>
      </div>

      <input type="hidden" name="${id}_label" value="${escapeHtml(label)}">
      <input type="hidden" name="${id}_type" value="yn">
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
  metaBits.push(fmtDT(audit.created_at));

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
    return `
      <div class="detailRow">
        <div class="detailLabel">${escapeHtml(i.label)}</div>
        ${i.notes ? `<div class="detailNotes">${escapeHtml(i.notes)}</div>` : `<div class="detailNotes muted">—</div>`}
      </div>
    `;
  }).join("");

  return `
    <details class="item">
      <summary class="itemSummary">
        <div>
          <div class="itemTitle">${escapeHtml(audit.audit_type)} Audit</div>
          <div class="muted">${escapeHtml(metaBits.join(" • "))}</div>
          <div class="muted">Yes: ${yes} • No: ${no} • Blank: ${missing}</div>
        </div>
        <button class="btn danger smallBtn" type="button" onclick="event.preventDefault(); event.stopPropagation(); deleteAudit('${audit.id}')">Delete</button>
      </summary>
      <div class="detailsBody">
        ${audit.header_notes ? `<div class="panel" style="margin-bottom:10px;"><div class="itemTitle">Header Notes</div><div style="white-space:pre-wrap;margin-top:6px;">${escapeHtml(audit.header_notes)}</div></div>` : ``}
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
