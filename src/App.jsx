import { useState, useEffect, useCallback, useRef } from "react";

/* ─── Global Styles — Light Theme ────────────────────────────────────────── */
const GLOBAL_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#f0f4f8;--surface:#ffffff;--surface2:#f7f9fc;--border:#e2e8f0;
  --accent:#2563eb;--accent2:#7c3aed;--accent3:#059669;
  --danger:#dc2626;--warn:#d97706;--text:#0f172a;--muted:#64748b;
  --font:'Inter',sans-serif;--mono:'JetBrains Mono',monospace;
  --shadow:0 1px 3px rgba(0,0,0,.08),0 1px 2px rgba(0,0,0,.04);
  --shadow-md:0 4px 6px rgba(0,0,0,.07),0 2px 4px rgba(0,0,0,.05);
}
body{background:var(--bg);color:var(--text);font-family:var(--font)}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:var(--surface)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
@keyframes slide-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.slide-in{animation:slide-in .25s ease both}
select{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2364748b' d='M6 8L1 3h10z'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:28px!important}
`;

/* ─── Config ─────────────────────────────────────────────────────────────── */
const API_BASE = "https://hirerad-backend-production.up.railway.app/api";

/* ─── Storage helpers (persist across devices via backend) ───────────────── */
const LS = {
  get: (k, def="") => { try { return localStorage.getItem(k) ?? def; } catch { return def; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

async function callClaude(systemPrompt, userPrompt, azureSettings = null) {
  // If Azure OpenAI is configured, call it directly from the browser
  if (azureSettings?.azureOpenAiEndpoint && azureSettings?.azureOpenAiKey && azureSettings?.azureOpenAiDeployment) {
    const { azureOpenAiEndpoint, azureOpenAiKey, azureOpenAiDeployment, azureOpenAiApiVersion = "2024-02-01" } = azureSettings;
    const endpoint = azureOpenAiEndpoint.replace(/\/$/, "");
    const url = `${endpoint}/openai/deployments/${azureOpenAiDeployment}/chat/completions?api-version=${azureOpenAiApiVersion}`;

    // Modern Azure OpenAI models use max_completion_tokens (not max_tokens).
    // temperature must be omitted entirely — only the default (1) is supported.
    const requestBody = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userPrompt },
      ],
      max_completion_tokens: 2000,
    };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "api-key": azureOpenAiKey },
      body: JSON.stringify(requestBody),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || `Azure OpenAI error ${res.status}`);
    const text = data.choices?.[0]?.message?.content || "";
    // Parse JSON from the response
    const clean = text.replace(/```json|```/g, "").trim();
    return JSON.parse(clean);
  }

  // Fallback: Anthropic via backend
  const res = await fetch(`${API_BASE}/generate-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ systemPrompt, userPrompt }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Email generation failed");
  return data;
}

/* ─── Mock data ──────────────────────────────────────────────────────────── */
const MOCK_LEADS = [
  { id:"l1", company_name:"Quanta AI",   domain:"quanta.ai",   industry:"AI/SaaS",  employee_count:6, job_title:"AI/ML Engineer",     score:5, status:"queued",      posted_at:new Date(Date.now()-3*864e5),  first_name:"Alex",   last_name:"Chen",    contact_title:"CTO",       contact_email:"alex@quanta.ai",      email_verified:true },
  { id:"l2", company_name:"Stackflow",   domain:"stackflow.io",industry:"DevTools", employee_count:4, job_title:"Full Stack Engineer",  score:4, status:"queued",      posted_at:new Date(Date.now()-5*864e5),  first_name:"Jordan", last_name:"Patel",   contact_title:"CEO",       contact_email:"jordan@stackflow.io", email_verified:true },
  { id:"l3", company_name:"NovaBuild",   domain:"novabuild.dev",industry:"SaaS",    employee_count:8, job_title:"Backend Engineer",     score:3, status:"pending",     posted_at:new Date(Date.now()-10*864e5), first_name:"Sam",    last_name:"Kim",     contact_title:"Founder",   contact_email:"sam@novabuild.dev",   email_verified:true },
  { id:"l4", company_name:"Pixel Forge", domain:"pixelforge.co",industry:"AI/SaaS", employee_count:3, job_title:"Frontend Engineer",    score:4, status:"queued",      posted_at:new Date(Date.now()-6*864e5),  first_name:"Taylor", last_name:"Rivera",  contact_title:"Co-Founder",contact_email:"taylor@pixelforge.co",email_verified:false },
  { id:"l5", company_name:"Orbit Labs",  domain:"orbitlabs.io", industry:"FinTech", employee_count:7, job_title:"Software Engineer",    score:2, status:"pending",     posted_at:new Date(Date.now()-18*864e5), first_name:null,     last_name:null,      contact_title:null,        contact_email:null,                  email_verified:false },
  { id:"l6", company_name:"Synapse HQ",  domain:"synapsehq.com",industry:"AI/SaaS", employee_count:5, job_title:"AI/ML Engineer",       score:5, status:"in_campaign", posted_at:new Date(Date.now()-2*864e5),  first_name:"Casey",  last_name:"Davis",   contact_title:"CTO",       contact_email:"casey@synapsehq.com", email_verified:true },
];

/* ─── Micro components ───────────────────────────────────────────────────── */
const Spinner = ({ size=18 }) => (
  <div style={{ width:size, height:size, border:"2px solid var(--border)", borderTopColor:"var(--accent)", borderRadius:"50%", animation:"spin .7s linear infinite", display:"inline-block", flexShrink:0 }} />
);

const Badge = ({ children, variant="default" }) => {
  const map = {
    default:["#f1f5f9","#64748b"],
    success:["#dcfce7","#16a34a"],
    warn:["#fef3c7","#d97706"],
    danger:["#fee2e2","#dc2626"],
    accent:["#dbeafe","#2563eb"],
    purple:["#ede9fe","#7c3aed"],
  };
  const [bg,color] = map[variant]||map.default;
  return <span style={{ background:bg, color, border:`1px solid ${color}30`, borderRadius:4, padding:"2px 8px", fontSize:11, fontFamily:"var(--mono)", fontWeight:600, whiteSpace:"nowrap" }}>{children}</span>;
};

const ScoreBadge = ({ score }) => <Badge variant={score>=4?"success":score>=2?"warn":"danger"}>Score {score}</Badge>;
const StatusBadge = ({ status }) => {
  const m = { queued:["accent","QUEUED"], pending:["warn","PENDING"], "low-score":["danger","LOW SCORE"], in_campaign:["purple","IN CAMPAIGN"], replied:["success","REPLIED"] };
  const [v,l] = m[status]||["default",status?.toUpperCase()];
  return <Badge variant={v}>{l}</Badge>;
};

const StatCard = ({ label, value, sub, accent="var(--accent)", icon }) => (
  <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"18px 20px", boxShadow:"var(--shadow)", borderTop:`3px solid ${accent}` }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <span style={{ color:"var(--muted)", fontSize:11, textTransform:"uppercase", letterSpacing:.8, fontWeight:600 }}>{label}</span>
      <span style={{ fontSize:18 }}>{icon}</span>
    </div>
    <div style={{ fontSize:28, fontWeight:800, margin:"6px 0 2px", color:"var(--text)" }}>{value ?? "—"}</div>
    {sub && <div style={{ color:"var(--muted)", fontSize:11 }}>{sub}</div>}
  </div>
);

const Input = ({ ...props }) => (
  <input {...props} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 12px", color:"var(--text)", fontFamily:"var(--font)", fontSize:13, outline:"none", width:"100%", boxShadow:"var(--shadow)", transition:"border-color .15s", ...props.style }}
    onFocus={e => e.target.style.borderColor="var(--accent)"}
    onBlur={e => e.target.style.borderColor="var(--border)"}
  />
);

const Select = ({ children, ...props }) => (
  <select {...props} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 12px", color:"var(--text)", fontFamily:"var(--font)", fontSize:13, outline:"none", width:"100%", cursor:"pointer", boxShadow:"var(--shadow)", ...props.style }}
    onFocus={e => e.target.style.borderColor="var(--accent)"}
    onBlur={e => e.target.style.borderColor="var(--border)"}
  >
    {children}
  </select>
);

const Btn = ({ children, onClick, disabled, variant="primary", size="md", ...rest }) => {
  const styles = {
    primary: { background:"var(--accent)", color:"#fff" },
    success: { background:"var(--accent3)", color:"#fff" },
    danger:  { background:"var(--danger)",  color:"#fff" },
    ghost:   { background:"var(--surface)", color:"var(--muted)", border:"1px solid var(--border)" },
    outline: { background:"transparent", color:"var(--accent)", border:"1px solid var(--accent)" },
  };
  const s = styles[variant] || styles.primary;
  const pad = size==="sm" ? "5px 12px" : "9px 18px";
  return (
    <button onClick={onClick} disabled={disabled} style={{
      ...s, border:s.border||"none",
      borderRadius:8, padding:pad, cursor:disabled?"not-allowed":"pointer",
      fontFamily:"var(--font)", fontWeight:600, fontSize:size==="sm"?11:13,
      display:"inline-flex", alignItems:"center", gap:6,
      transition:"all .15s", opacity:disabled?.5:1,
      boxShadow:disabled?"none":"var(--shadow)",
      ...rest.style
    }} {...rest}>
      {children}
    </button>
  );
};

const Label = ({ children }) => (
  <div style={{ fontSize:11, fontWeight:600, color:"var(--muted)", textTransform:"uppercase", letterSpacing:.8, marginBottom:6 }}>{children}</div>
);

// Shows pending files Claude has pre-loaded for deployment
const PendingDeployStatus = () => {
  const [pending, setPending] = useState([]);
  useEffect(() => {
    const check = () => setPending(window.__HIRERAD_PENDING_DEPLOY__ || []);
    check();
    const t = setInterval(check, 1000);
    return () => clearInterval(t);
  }, []);
  if (!pending.length) return (
    <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, padding:"10px 14px", fontSize:12, color:"var(--muted)", marginBottom:12 }}>
      ⏳ No updates pending — Claude will pre-load files here before asking you to deploy
    </div>
  );
  return (
    <div style={{ background:"#dcfce7", border:"1px solid #16a34a40", borderRadius:8, padding:"10px 14px", marginBottom:12 }}>
      <div style={{ fontSize:12, fontWeight:700, color:"#16a34a", marginBottom:6 }}>✅ {pending.length} file(s) ready to deploy:</div>
      {pending.map((f,i) => (
        <div key={i} style={{ fontSize:11, fontFamily:"var(--mono)", color:"#166534" }}>
          📦 {f.repo} → {f.path}
        </div>
      ))}
    </div>
  );
};

const Card = ({ children, style }) => (
  <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:24, boxShadow:"var(--shadow)", ...style }}>
    {children}
  </div>
);

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
function DashboardView({ stats, leads }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 60000); return () => clearInterval(t); }, []);
  const byIndustry = leads.reduce((a,l) => { a[l.industry]=(a[l.industry]||0)+1; return a; }, {});
  const pipeline = [
    { label:"Scraped",   val:leads.length,                                    color:"#2563eb" },
    { label:"Enriched",  val:leads.filter(l=>l.contact_email).length,         color:"#7c3aed" },
    { label:"Scored ≥2", val:leads.filter(l=>l.score>=2).length,              color:"#d97706" },
    { label:"Emailed",   val:leads.filter(l=>l.status==="in_campaign").length, color:"#ea580c" },
    { label:"Replied",   val:leads.filter(l=>l.status==="replied").length,     color:"#059669" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }} className="slide-in">
      <div>
        <h2 style={{ fontSize:22, fontWeight:800, color:"var(--text)" }}>System Overview</h2>
        <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>Real-time pipeline metrics · <span style={{ fontFamily:"var(--mono)" }}>{now.toLocaleTimeString()}</span></p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))", gap:14 }}>
        <StatCard label="Total Leads"    value={stats?.leads_total    ?? leads.length}                       accent="#2563eb" icon="🎯" />
        <StatCard label="Qualified"      value={stats?.leads_qualified ?? leads.filter(l=>l.score>=2).length} accent="#059669" icon="✅" sub="score ≥ 2" />
        <StatCard label="Contacts Found" value={leads.filter(l=>l.contact_email).length}                      accent="#7c3aed" icon="👤" />
        <StatCard label="Emails Sent"    value={stats?.emails_sent    ?? 0}                                   accent="#d97706" icon="📧" />
        <StatCard label="Open Rate"      value={stats?.open_rate != null ? `${stats.open_rate}%` : "—"}       accent="#ea580c" icon="👁" />
        <StatCard label="Replies"        value={stats?.replies        ?? 0}                                   accent="#059669" icon="💬" />
      </div>

      <Card>
        <Label>Pipeline Flow</Label>
        <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:0, marginTop:8 }}>
          {pipeline.map((s,i) => (
            <div key={s.label} style={{ display:"flex", alignItems:"center" }}>
              <div style={{ background:`${s.color}12`, border:`1px solid ${s.color}40`, borderRadius:8, padding:"10px 16px", textAlign:"center", minWidth:80 }}>
                <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:10, color:"var(--muted)", marginTop:2, fontWeight:600 }}>{s.label}</div>
              </div>
              {i < pipeline.length-1 && <div style={{ color:"var(--border)", padding:"0 6px", fontSize:18 }}>›</div>}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <Label>Leads by Industry</Label>
        <div style={{ marginTop:8 }}>
          {Object.entries(byIndustry).map(([ind,count]) => {
            const pct = Math.round(count/leads.length*100);
            return (
              <div key={ind} style={{ marginBottom:12 }}>
                <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:5, fontWeight:500 }}>
                  <span>{ind}</span><span style={{ color:"var(--muted)" }}>{count} ({pct}%)</span>
                </div>
                <div style={{ height:6, background:"var(--surface2)", borderRadius:3, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background:`linear-gradient(90deg,var(--accent),var(--accent2))`, borderRadius:3, transition:"width .5s" }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ─── Scraper View (with selectable params + stop button) ────────────────── */
const COUNTRIES = ["United States","United Kingdom","Canada","Australia","Germany","India","Singapore","Netherlands","France","Sweden"];
const COMPANY_SIZES = ["1–9 employees","10–50 employees","51–200 employees","1–50 employees","Any size"];
const POSTED_WITHIN = [1,3,7,14,30];
const DEFAULT_ROLES = ["Software Engineer","Full Stack Engineer","Backend Engineer","Frontend Engineer","AI/ML Engineer","DevOps Engineer","Mobile Engineer"];

function ScraperView({ backendOk, onLeadsRefresh, settings }) {
  const [params, setParams] = useState({
    country: "United States",
    companySize: "1–9 employees",
    postedWithin: 30,
    roles: [...DEFAULT_ROLES],
    customRole: "",
  });
  const [scraping, setScraping] = useState(false);
  const [stopped,  setStopped]  = useState(false);
  const [runId,    setRunId]    = useState(null);
  const [log,      setLog]      = useState([]);
  const logRef  = useRef(null);
  const stopRef = useRef(false);

  const addLog = (msg, type="default") => setLog(l => [...l, { msg, type, time:new Date().toLocaleTimeString() }]);

  useEffect(() => { logRef.current?.scrollTo({ top:9999, behavior:"smooth" }); }, [log]);

  const toggleRole = (role) => {
    setParams(p => ({
      ...p,
      roles: p.roles.includes(role) ? p.roles.filter(r=>r!==role) : [...p.roles, role],
    }));
  };

  const addCustomRole = () => {
    if (!params.customRole.trim()) return;
    setParams(p => ({ ...p, roles:[...p.roles, p.customRole.trim()], customRole:"" }));
  };

  const stopScrape = () => {
    stopRef.current = true;
    setStopped(true);
    addLog("⛔ Stop requested — halting after current step...", "warn");
  };

  const runScrape = async () => {
    setScraping(true); setStopped(false); stopRef.current = false; setLog([]);
    addLog(`🌍 Target: ${params.country} · ${params.companySize} · Last ${params.postedWithin} days`, "accent");
    addLog(`🎯 Roles: ${params.roles.join(", ")}`, "default");

    if (backendOk && settings.apifyKey) {
      try {
        addLog("Submitting job to Apify actor...", "default");
        const { run_id } = await apiFetch("/scrape/run", { method:"POST", body:JSON.stringify({ ...params, apifyKey:settings.apifyKey }) });
        setRunId(run_id);
        addLog(`Apify run started: ${run_id}`, "success");
        let done = false;
        while (!done && !stopRef.current) {
          await new Promise(r => setTimeout(r, 3000));
          const status = await apiFetch(`/scrape/status/${run_id}`);
          addLog(`Status: ${status.status} · Jobs: ${status.jobs_found} · Leads: ${status.leads_qualified}`, "default");
          if (["complete","failed"].includes(status.status)) {
            done = true;
            if (status.status==="complete") {
              const jobsMsg = status.jobs_found > 0 ? `${status.jobs_found} jobs scraped` : "Scrape finished";
              const leadsMsg = status.leads_qualified > 0 ? `, ${status.leads_qualified} leads qualified (score ≥ 2)` : " — no leads matched filters (try broader settings)";
              addLog(`✅ ${jobsMsg}${leadsMsg}`, "success");
              onLeadsRefresh();
            } else {
              addLog(`❌ Failed: ${status.error_msg}`, "error");
            }
          }
        }
        if (stopRef.current) addLog("⛔ Scrape stopped by user.", "warn");
      } catch (err) {
        addLog(`Error: ${err.message} — running simulation...`, "warn");
        await simulateScrape(stopRef);
      }
    } else {
      if (!settings.apifyKey) addLog("⚠ No Apify key set — running demo simulation", "warn");
      await simulateScrape(stopRef);
    }
    setScraping(false);
  };

  const simulateScrape = async (stopRef) => {
    const steps = [
      [`🔍 Searching LinkedIn for: ${params.roles.slice(0,3).join(", ")}...`, "default", 700],
      [`📥 Fetching job listings (${params.country})...`, "default", 900],
      ["✅ Found 47 raw job postings", "success", 400],
      ["🏢 Validating company sizes via Apollo...", "accent", 800],
      ["🚫 Filtered 12 staffing/agency companies", "warn", 400],
      ["✅ 27 companies validated", "success", 400],
      ["👤 Enriching decision-maker contacts...", "accent", 900],
      ["✅ Found 19 verified contacts", "success", 400],
      ["📊 Running lead scoring engine...", "default", 500],
      ["✅ 17 leads scored ≥ 2 — queued for outreach", "success", 300],
      ["🎯 Scrape complete! Pipeline updated.", "success", 0],
    ];
    for (const [msg, type, delay] of steps) {
      if (stopRef.current) { addLog("⛔ Stopped.", "warn"); return; }
      await new Promise(r => setTimeout(r, delay));
      addLog(msg, type);
    }
  };

  const logColors = { success:"var(--accent3)", error:"var(--danger)", accent:"var(--accent)", warn:"var(--warn)", default:"var(--muted)" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }} className="slide-in">
      <div>
        <h2 style={{ fontSize:22, fontWeight:800 }}>Job Scraper</h2>
        <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>Configure and run LinkedIn job scraping via Apify</p>
      </div>

      <Card>
        <Label>Scraper Parameters</Label>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginTop:8 }}>
          <div>
            <Label>Country</Label>
            <Select value={params.country} onChange={e=>setParams(p=>({...p,country:e.target.value}))}>
              {COUNTRIES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <Label>Company Size</Label>
            <Select value={params.companySize} onChange={e=>setParams(p=>({...p,companySize:e.target.value}))}>
              {COMPANY_SIZES.map(c => <option key={c}>{c}</option>)}
            </Select>
          </div>
          <div>
            <Label>Job Posted Within (days)</Label>
            <Select value={params.postedWithin} onChange={e=>setParams(p=>({...p,postedWithin:+e.target.value}))}>
              {POSTED_WITHIN.map(d => <option key={d} value={d}>Last {d} day{d>1?"s":""}</option>)}
            </Select>
          </div>
        </div>

        <div style={{ marginTop:16 }}>
          <Label>Target Roles (select all that apply)</Label>
          <div style={{ display:"flex", flexWrap:"wrap", gap:8, marginTop:6 }}>
            {DEFAULT_ROLES.map(role => {
              const active = params.roles.includes(role);
              return (
                <button key={role} onClick={()=>toggleRole(role)} style={{
                  background:active?"var(--accent)":"var(--surface2)",
                  color:active?"#fff":"var(--muted)",
                  border:`1px solid ${active?"var(--accent)":"var(--border)"}`,
                  borderRadius:20, padding:"5px 13px", cursor:"pointer",
                  fontSize:12, fontFamily:"var(--font)", fontWeight:600, transition:"all .15s",
                }}>
                  {active && "✓ "}{role}
                </button>
              );
            })}
          </div>
          <div style={{ display:"flex", gap:8, marginTop:10 }}>
            <Input placeholder="Add custom role..." value={params.customRole} onChange={e=>setParams(p=>({...p,customRole:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&addCustomRole()} style={{ flex:1 }} />
            <Btn onClick={addCustomRole} variant="outline" size="sm">+ Add</Btn>
          </div>
          {params.roles.filter(r=>!DEFAULT_ROLES.includes(r)).length > 0 && (
            <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginTop:8 }}>
              {params.roles.filter(r=>!DEFAULT_ROLES.includes(r)).map(r => (
                <span key={r} style={{ background:"#ede9fe", color:"var(--accent2)", border:"1px solid #ddd6fe", borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:600, display:"flex", alignItems:"center", gap:6 }}>
                  {r}
                  <button onClick={()=>toggleRole(r)} style={{ background:"none", border:"none", cursor:"pointer", color:"var(--accent2)", fontSize:14, lineHeight:1 }}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ display:"flex", gap:10, marginTop:20, alignItems:"center" }}>
          <Btn onClick={runScrape} disabled={scraping||params.roles.length===0} style={{ minWidth:140 }}>
            {scraping ? <><Spinner size={14}/>Running...</> : "▶  Run Scraper"}
          </Btn>
          {scraping && !stopped && (
            <Btn onClick={stopScrape} variant="danger">⛔ Stop</Btn>
          )}
          {runId && <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--muted)" }}>Run: {runId}</span>}
        </div>
      </Card>

      <Card>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          {scraping && <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--accent3)", animation:"pulse-dot 1s infinite" }} />}
          <Label>Execution Log</Label>
        </div>
        <div ref={logRef} style={{ fontFamily:"var(--mono)", fontSize:12, lineHeight:2, minHeight:180, maxHeight:320, overflowY:"auto", background:"var(--surface2)", borderRadius:8, padding:14 }}>
          {log.length===0 && <span style={{ color:"var(--muted)" }}>Awaiting run...</span>}
          {log.map((l,i) => (
            <div key={i} style={{ color:logColors[l.type]||"var(--muted)" }}>
              <span style={{ opacity:.4 }}>{l.time}</span>{"  "}{l.msg}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─── Leads View ─────────────────────────────────────────────────────────── */
function LeadsView({ leads, onEnrich, enriching, onClearDb, backendOk }) {
  const [filter, setFilter]         = useState("all");
  const [clearing, setClearing]     = useState(false);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [sortBy, setSortBy]         = useState("created");
  const [sortDir, setSortDir]       = useState("desc");
  const [dateFilter, setDateFilter] = useState("all");
  const [showAll, setShowAll]       = useState(false);
  const [selected, setSelected]     = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const toggleSort = (col) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const filtered = leads
    .filter(l => {
      if (filter === "qualified") return l.score >= 2;
      if (filter === "enriched") return !!l.contact_email;
      if (filter === "no_contact") return !l.contact_email;
      if (["queued","pending","in_campaign","low-score"].includes(filter)) return l.status === filter;
      return true;
    })
    .filter(l => {
      if (dateFilter === "all") return true;
      const days = l.posted_at ? Math.floor((Date.now() - new Date(l.posted_at)) / 864e5) : 999;
      if (dateFilter === "today") return days === 0;
      if (dateFilter === "3d") return days <= 3;
      if (dateFilter === "7d") return days <= 7;
      if (dateFilter === "14d") return days <= 14;
      return true;
    })
    .sort((a, b) => {
      let av, bv;
      if (sortBy === "date")    { av = new Date(a.posted_at||0);  bv = new Date(b.posted_at||0); }
      else if (sortBy === "created") { av = new Date(a.created_at||a.id||0); bv = new Date(b.created_at||b.id||0); }
      else if (sortBy === "score")   { av = a.score; bv = b.score; }
      else if (sortBy === "company") { av = a.company_name?.toLowerCase(); bv = b.company_name?.toLowerCase(); }
      else { av = a[sortBy]; bv = b[sortBy]; }
      if (av < bv) return sortDir === "asc" ? -1 : 1;
      if (av > bv) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

  const displayed = showAll ? filtered : filtered.slice(0, 50);

  // Selection helpers
  const allDisplayedIds = displayed.map(l => l.id);
  const allSelected = allDisplayedIds.length > 0 && allDisplayedIds.every(id => selected.has(id));
  const someSelected = allDisplayedIds.some(id => selected.has(id));

  const toggleSelect = (id) => {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (allSelected) setSelected(s => { const n = new Set(s); allDisplayedIds.forEach(id => n.delete(id)); return n; });
    else setSelected(s => { const n = new Set(s); allDisplayedIds.forEach(id => n.add(id)); return n; });
  };

  // Delete single lead
  const deleteLead = async (id) => {
    if (!window.confirm("Delete this lead?")) return;
    setDeletingId(id);
    try {
      await apiFetch(`/leads/${id}`, { method:"DELETE" });
      onClearDb(); // refresh leads
    } catch(err) { alert("Delete failed: " + err.message); }
    setDeletingId(null);
    setSelected(s => { const n = new Set(s); n.delete(id); return n; });
  };

  // Bulk delete selected
  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} selected lead(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await apiFetch("/leads/bulk-delete", { method:"DELETE", body: JSON.stringify({ ids }) });
      onClearDb();
      setSelected(new Set());
    } catch(err) { alert("Bulk delete failed: " + err.message); }
    setBulkDeleting(false);
  };

  const clearDatabase = async () => {
    if (!window.confirm("Clear ALL leads from the database? This cannot be undone.")) return;
    setClearing(true);
    try {
      await apiFetch("/leads/clear", { method:"DELETE" });
      onClearDb();
      setSelected(new Set());
    } catch(err) { alert("Clear failed: " + err.message); }
    setClearing(false);
  };

  const enrichAll = async () => {
    const unenriched = leads.filter(l => !l.contact_email && l.score >= 2);
    if (!unenriched.length) { alert("No unenriched leads found."); return; }
    setEnrichingAll(true);
    for (const lead of unenriched) {
      await onEnrich(lead.id, lead.company_name);
      await new Promise(r => setTimeout(r, 500));
    }
    setEnrichingAll(false);
  };

  const SortBtn = ({ col, label }) => (
    <button onClick={() => toggleSort(col)} style={{
      background: sortBy===col ? "#d97706" : "var(--surface)",
      color: sortBy===col ? "#fff" : "var(--muted)",
      border: `1px solid ${sortBy===col?"#d97706":"var(--border)"}`,
      borderRadius:20, padding:"4px 12px", cursor:"pointer",
      fontSize:11, fontFamily:"var(--font)", fontWeight:600, transition:"all .15s",
    }}>{label} {sortBy===col ? (sortDir==="asc"?"↑":"↓") : ""}</button>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }} className="slide-in">
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800 }}>Lead Pipeline</h2>
          <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>
            {leads.length} total · {leads.filter(l=>l.score>=2).length} qualified
            {selected.size > 0 && <span style={{ color:"var(--accent)", marginLeft:8, fontWeight:700 }}>· {selected.size} selected</span>}
          </p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {selected.size > 0 && backendOk && (
            <Btn variant="danger" size="sm" onClick={bulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <><Spinner size={12}/>Deleting...</> : `🗑 Delete Selected (${selected.size})`}
            </Btn>
          )}
          {backendOk && (
            <Btn variant="outline" size="sm" onClick={enrichAll} disabled={enrichingAll || !!enriching}>
              {enrichingAll ? <><Spinner size={12}/>Enriching...</> : "⚡ Enrich All"}
            </Btn>
          )}
          {backendOk && (
            <Btn variant="danger" size="sm" onClick={clearDatabase} disabled={clearing}>
              {clearing ? <><Spinner size={12}/>Clearing...</> : "🗑 Clear Database"}
            </Btn>
          )}
        </div>
      </div>

      {/* Status filters */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        {[
          { key:"all",        label:`All (${leads.length})` },
          { key:"qualified",  label:`Qualified (${leads.filter(l=>l.score>=2).length})` },
          { key:"enriched",   label:`Enriched (${leads.filter(l=>l.contact_email).length})` },
          { key:"no_contact", label:`No Contact (${leads.filter(l=>!l.contact_email).length})` },
          { key:"queued",     label:"Queued" },
          { key:"pending",    label:"Pending" },
          { key:"in_campaign",label:"In Campaign" },
        ].map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)} style={{
            background: filter===f.key ? "var(--accent)" : "var(--surface)",
            color:      filter===f.key ? "#fff" : "var(--muted)",
            border:`1px solid ${filter===f.key?"var(--accent)":"var(--border)"}`,
            borderRadius:20, padding:"5px 14px", cursor:"pointer",
            fontSize:12, fontFamily:"var(--font)", fontWeight:600,
            boxShadow:"var(--shadow)", transition:"all .15s",
          }}>{f.label}</button>
        ))}
      </div>

      {/* Date + Sort filters */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:11, color:"var(--muted)", fontWeight:600 }}>POSTED:</span>
        {[{k:"all",l:"Any time"},{k:"today",l:"Today"},{k:"3d",l:"≤ 3d"},{k:"7d",l:"≤ 7d"},{k:"14d",l:"≤ 14d"}].map(d => (
          <button key={d.k} onClick={() => setDateFilter(d.k)} style={{
            background: dateFilter===d.k ? "#7c3aed" : "var(--surface)",
            color:      dateFilter===d.k ? "#fff" : "var(--muted)",
            border:`1px solid ${dateFilter===d.k?"#7c3aed":"var(--border)"}`,
            borderRadius:20, padding:"4px 12px", cursor:"pointer",
            fontSize:11, fontFamily:"var(--font)", fontWeight:600, transition:"all .15s",
          }}>{d.l}</button>
        ))}
        <span style={{ fontSize:11, color:"var(--muted)", fontWeight:600, marginLeft:8 }}>SORT:</span>
        <SortBtn col="created" label="Created" />
        <SortBtn col="date"    label="Posted" />
        <SortBtn col="score"   label="Score" />
        <SortBtn col="company" label="Company" />
      </div>

      {/* Table */}
      <Card style={{ padding:0, overflow:"hidden" }}>
        {/* Header row */}
        <div style={{ display:"grid", gridTemplateColumns:"36px 44px 1.2fr 160px 110px 80px 110px 90px", padding:"10px 16px", borderBottom:"1px solid var(--border)", fontSize:10, textTransform:"uppercase", letterSpacing:.8, color:"var(--muted)", fontWeight:700, background:"var(--surface2)", alignItems:"center" }}>
          <input type="checkbox" checked={allSelected} ref={el => { if (el) el.indeterminate = someSelected && !allSelected; }}
            onChange={toggleSelectAll} style={{ cursor:"pointer", width:14, height:14 }} />
          <span>#</span>
          <span>Company / Role</span>
          <span>Contact</span>
          <span>Industry</span>
          <span>Score</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {displayed.map((lead, i) => {
          const isSelected = selected.has(lead.id);
          return (
            <div key={lead.id} style={{
              display:"grid", gridTemplateColumns:"36px 44px 1.2fr 160px 110px 80px 110px 90px",
              padding:"11px 16px",
              borderBottom: i < displayed.length-1 ? "1px solid var(--border)" : "none",
              alignItems:"center", transition:"background .12s",
              background: isSelected ? "#eff6ff" : "transparent",
            }}
              onMouseEnter={e=>{ if (!isSelected) e.currentTarget.style.background="var(--surface2)"; }}
              onMouseLeave={e=>{ if (!isSelected) e.currentTarget.style.background="transparent"; }}
            >
              {/* Checkbox */}
              <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(lead.id)}
                style={{ cursor:"pointer", width:14, height:14 }} />

              {/* Serial number */}
              <span style={{ fontSize:11, color:"var(--muted)", fontWeight:600 }}>{i + 1}</span>

              {/* Company / Role */}
              <div>
                <div style={{ fontWeight:700, fontSize:13 }}>{lead.company_name}</div>
                <div style={{ color:"var(--muted)", fontSize:11, marginTop:2 }}>
                  {lead.job_title} · {lead.posted_at ? `${Math.floor((Date.now()-new Date(lead.posted_at))/864e5)}d ago` : "—"}
                  {lead.job_url && (
                    <a href={lead.job_url} target="_blank" rel="noopener noreferrer" style={{
                      marginLeft:6, fontSize:10, color:"var(--accent)", textDecoration:"none",
                      background:"#dbeafe", borderRadius:4, padding:"1px 5px", fontWeight:600,
                    }}>JD ↗</a>
                  )}
                </div>
                {lead.created_at && (
                  <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>
                    Added {new Date(lead.created_at).toLocaleDateString()}
                  </div>
                )}
              </div>

              {/* Contact */}
              <div style={{ fontSize:11 }}>
                {lead.contact_email ? (
                  <>
                    <div style={{ fontWeight:600 }}>{lead.first_name} {lead.last_name}</div>
                    <div style={{ color:"var(--muted)" }}>{lead.contact_title}</div>
                    <div style={{ color:"var(--accent)", fontSize:10, marginTop:2, wordBreak:"break-all" }}>{lead.contact_email}</div>
                    {lead.email_verified && <Badge variant="success">✓ verified</Badge>}
                  </>
                ) : <span style={{ color:"var(--danger)", fontSize:11 }}>No contact</span>}
              </div>

              {/* Industry */}
              <div><Badge variant={lead.industry?.includes("AI")?"purple":"default"}>{lead.industry}</Badge></div>

              {/* Score */}
              <div><ScoreBadge score={lead.score} /></div>

              {/* Status */}
              <div><StatusBadge status={lead.status} /></div>

              {/* Actions */}
              <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                {!lead.contact_email && (
                  <Btn size="sm" variant="outline" onClick={()=>onEnrich(lead.id, lead.company_name)} disabled={enriching===lead.id}>
                    {enriching===lead.id ? <Spinner size={11}/> : "Enrich"}
                  </Btn>
                )}
                <Btn size="sm" variant="danger" onClick={()=>deleteLead(lead.id)} disabled={deletingId===lead.id}
                  style={{ padding:"4px 8px", fontSize:11 }}>
                  {deletingId===lead.id ? <Spinner size={10}/> : "🗑"}
                </Btn>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div style={{ padding:"40px 16px", textAlign:"center", color:"var(--muted)" }}>No leads matching this filter</div>
        )}

        {/* Pagination footer */}
        {filtered.length > 50 && (
          <div style={{ padding:"12px 16px", textAlign:"center", borderTop:"1px solid var(--border)", background:"var(--surface2)", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
            <span style={{ fontSize:12, color:"var(--muted)" }}>
              Showing {showAll ? filtered.length : Math.min(50, filtered.length)} of {filtered.length} leads
            </span>
            <button onClick={() => setShowAll(s=>!s)} style={{
              fontSize:12, color:"var(--accent)", background:"none", border:"none", cursor:"pointer", fontWeight:600,
            }}>
              {showAll ? "Show less" : `Show all ${filtered.length}`}
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}

/* ─── Apollo View ────────────────────────────────────────────────────────── */
function ApolloView({ settings, leads }) {
  const [searchMode, setSearchMode] = useState("company");
  const [q, setQ]         = useState({ firstName:"", lastName:"", domain:"", companyName:"" });
  const [searching, setSearch] = useState(false);
  const [results, setResults]  = useState([]);
  const [error, setError]      = useState("");
  const [copied, setCopied]    = useState(null);

  const apolloKey = settings.apolloKey;
  const proxyHeaders = { "Content-Type":"application/json", "x-apollo-key": apolloKey };

  const searchPerson = async () => {
    const body = { first_name:q.firstName, last_name:q.lastName };
    if (q.domain) body.domain = q.domain;
    else if (q.companyName) body.organization_name = q.companyName;
    const res = await fetch(`${API_BASE}/apollo/person`, { method:"POST", headers:proxyHeaders, body:JSON.stringify(body) });
    const data = await res.json();
    if (data.person) {
      const p = data.person;
      return [{ name:`${p.first_name} ${p.last_name}`, title:p.title||"—", email:p.email, linkedin:p.linkedin_url, verified:!!p.email, company:p.organization?.name||q.companyName, domain:p.organization?.website_url }];
    }
    throw new Error(data.error || "No person found");
  };

  const searchCompany = async () => {
    const res = await fetch(`${API_BASE}/apollo/company`, {
      method:"POST", headers:proxyHeaders,
      body:JSON.stringify({ company_name:q.companyName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Company not found");
    return data.people.map(p => ({
      name:p.name, title:p.title, email:p.email,
      linkedin:p.linkedin, verified:p.verified,
      company:data.org.name, domain:data.org.domain, employees:data.org.employees,
    }));
  };

  const search = async () => {
    if (!apolloKey) { setError("Add your Apollo.io API key in Settings first"); return; }
    if (searchMode==="person" && !q.firstName && !q.lastName) { setError("Enter at least a first or last name"); return; }
    if (searchMode==="company" && !q.companyName) { setError("Enter a company name"); return; }
    setSearch(true); setError(""); setResults([]);
    try {
      const res = searchMode==="person" ? await searchPerson() : await searchCompany();
      setResults(res);
    } catch(err) { setError(err.message); }
    setSearch(false);
  };

  const copyEmail = (email, idx) => {
    navigator.clipboard?.writeText(email);
    setCopied(idx);
    setTimeout(()=>setCopied(null), 1500);
  };

  const modeBtn = (mode, label) => (
    <button onClick={()=>{ setSearchMode(mode); setResults([]); setError(""); }} style={{
      padding:"7px 18px", borderRadius:8, cursor:"pointer", fontSize:13, fontWeight:600,
      fontFamily:"var(--font)", transition:"all .15s", border:"1px solid var(--border)",
      background:searchMode===mode?"var(--accent)":"var(--surface)",
      color:searchMode===mode?"#fff":"var(--muted)",
      boxShadow:"var(--shadow)",
    }}>{label}</button>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }} className="slide-in">
      <div>
        <h2 style={{ fontSize:22, fontWeight:800 }}>Apollo.io Enrichment</h2>
        <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>Find decision makers by name or company</p>
      </div>

      {!apolloKey && (
        <div style={{ background:"#fef3c7", border:"1px solid #f59e0b40", borderRadius:10, padding:"12px 16px", color:"#92400e", fontSize:13 }}>
          ⚠️ No Apollo.io API key set. Go to <strong>Settings</strong> to add your key — it'll be saved automatically.
        </div>
      )}

      <Card>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <Label>Contact Search</Label>
          <div style={{ display:"flex", gap:8 }}>
            {modeBtn("person","👤 By Person")}
            {modeBtn("company","🏢 By Company")}
          </div>
        </div>

        {searchMode==="person" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><Label>First Name</Label><Input placeholder="e.g. John" value={q.firstName} onChange={e=>setQ(p=>({...p,firstName:e.target.value}))} /></div>
              <div><Label>Last Name</Label><Input placeholder="e.g. Smith" value={q.lastName} onChange={e=>setQ(p=>({...p,lastName:e.target.value}))} /></div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div><Label>Company Domain (most accurate)</Label><Input placeholder="e.g. stripe.com" value={q.domain} onChange={e=>setQ(p=>({...p,domain:e.target.value}))} /></div>
              <div><Label>Or Company Name</Label><Input placeholder="e.g. Stripe" value={q.companyName} onChange={e=>setQ(p=>({...p,companyName:e.target.value}))} /></div>
            </div>
          </div>
        )}

        {searchMode==="company" && (
          <div>
            <Label>Company Name</Label>
            <Input placeholder="e.g. Quanta AI, Stackflow, Techstern..." value={q.companyName} onChange={e=>setQ(p=>({...p,companyName:e.target.value}))}
              onKeyDown={e=>e.key==="Enter"&&search()} />
            <p style={{ fontSize:11, color:"var(--muted)", marginTop:6 }}>
              💡 Finds Founders, CEOs, CTOs & Heads of Engineering — no domain needed
            </p>
          </div>
        )}

        <div style={{ marginTop:16 }}>
          <button onClick={search} disabled={searching||!apolloKey} style={{
            background:searching||!apolloKey?"var(--border)":"var(--accent)",
            color:searching||!apolloKey?"var(--muted)":"#fff",
            border:"none", borderRadius:8, padding:"10px 24px",
            cursor:searching||!apolloKey?"not-allowed":"pointer",
            fontFamily:"var(--font)", fontWeight:700, fontSize:14,
            display:"inline-flex", alignItems:"center", gap:8,
            boxShadow:searching||!apolloKey?"none":"0 2px 8px rgba(37,99,235,.35)",
            transition:"all .15s",
          }}>
            {searching ? <><Spinner size={15}/>Searching Apollo...</> : "🔍  Search Apollo.io"}
          </button>
        </div>

        {error && (
          <div style={{ marginTop:14, background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:8, padding:"10px 14px", color:"var(--danger)", fontSize:12 }}>
            ⚠ {error}
          </div>
        )}

        {results.length > 0 && (
          <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:12, color:"var(--muted)", fontWeight:600 }}>
              {results.length} result{results.length>1?"s":""} found
              {results[0].company && <span style={{ color:"var(--accent)", marginLeft:8 }}>@ {results[0].company}</span>}
              {results[0].employees && <span style={{ color:"var(--muted)", marginLeft:8 }}>· {results[0].employees} employees</span>}
            </div>
            {results.map((p,i) => (
              <div key={i} style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{p.name}</div>
                    <div style={{ color:"var(--muted)", fontSize:12, marginTop:2 }}>{p.title}{p.company && ` · ${p.company}`}</div>
                    {p.domain && <div style={{ color:"var(--muted)", fontSize:11, marginTop:2 }}>🌐 {p.domain}</div>}
                  </div>
                  <div>{p.verified ? <Badge variant="success">✓ Verified Email</Badge> : <Badge variant="danger">No Email</Badge>}</div>
                </div>
                {p.email && (
                  <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:8, background:"#dbeafe", border:"1px solid #93c5fd", borderRadius:6, padding:"8px 12px" }}>
                    <span style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--accent)", flex:1 }}>{p.email}</span>
                    <button onClick={()=>copyEmail(p.email,i)} style={{ background:"transparent", border:"none", cursor:"pointer", color:copied===i?"var(--accent3)":"var(--muted)", fontSize:11, fontFamily:"var(--font)", fontWeight:700 }}>
                      {copied===i ? "✓ Copied!" : "📋 Copy"}
                    </button>
                  </div>
                )}
                {p.linkedin && (
                  <a href={p.linkedin} target="_blank" rel="noreferrer" style={{ display:"inline-block", marginTop:8, fontSize:11, color:"var(--accent2)", textDecoration:"none", fontWeight:600 }}>
                    🔗 LinkedIn Profile
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <Label>Pipeline Enrichment Status</Label>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12, marginTop:8 }}>
          <StatCard label="Total Leads"    value={leads.length}                             accent="#2563eb" icon="📊" />
          <StatCard label="Contacts Found" value={leads.filter(l=>l.contact_email).length}  accent="#059669" icon="✅" />
          <StatCard label="Missing"        value={leads.filter(l=>!l.contact_email).length} accent="#dc2626" icon="❌" />
        </div>
      </Card>
    </div>
  );
}

/* ─── Campaign View ──────────────────────────────────────────────────────── */
function CampaignView({ leads, backendOk, settings }) {
  const [selected, setSelected]       = useState(null);
  const [sequence, setSequence]       = useState(null);
  const [generating, setGenerating]   = useState(false);
  const [regenStep, setRegenStep]     = useState(null); // which step is being individually regenerated
  const [activeStep, setActiveStep]   = useState(0);
  const [tone, setTone]               = useState("casual");
  const [edited, setEdited]           = useState({});
  const [copied, setCopied]           = useState(null);
  const [launching, setLaunching]     = useState(false);
  const [launchResult, setLaunch]     = useState(null);
  const [genError, setGenError]       = useState(null);
  const [viewMode, setViewMode]       = useState("edit"); // "edit" | "preview"
  const [showConfig, setShowConfig]   = useState(false);
  const [senderConfig, setSenderConfig] = useState({
    senderName:   LS.get("hr_sender_name",  ""),
    companyName:  LS.get("hr_company_name", "our dev staffing firm"),
    valueProps:   LS.get("hr_value_props",  "pre-vetted offshore engineers · placed in under 2 weeks · 60% cheaper than local hires · no long-term contracts"),
    callToAction: LS.get("hr_cta",          "open to a 15-min call this week?"),
  });

  const saveSenderConfig = (cfg) => {
    setSenderConfig(cfg);
    LS.set("hr_sender_name",  cfg.senderName);
    LS.set("hr_company_name", cfg.companyName);
    LS.set("hr_value_props",  cfg.valueProps);
    LS.set("hr_cta",          cfg.callToAction);
  };

  const qualified = leads.filter(l => l.score >= 2 && l.contact_email);

  const toneGuides = {
    casual:       "Warm, friendly, like a peer. Conversational. Use contractions. No marketing-speak.",
    professional: "Polished but human. Respectful, clear. Slightly more formal but not stiff.",
    direct:       "Ultra-brief. No fluff. State the value, ask one thing, stop. Respect their time.",
    bold:         "Confident and slightly provocative. Make them feel they're missing out. Direct but not rude.",
  };

  const STEPS = [
    { day: "Day 1",  label: "Initial Outreach", icon: "🚀", color: "#2563eb",
      instruction: "First cold email. Reference their SPECIFIC open role by name. Show you noticed one specific thing about their company or role. One soft question at the end. Zero hard selling. Under 65 words body." },
    { day: "Day 3",  label: "Value Follow-up",  icon: "💡", color: "#7c3aed",
      instruction: "They haven't replied. Ultra-short nudge. Reference your first email in one casual clause. Add the single most compelling stat from value props. End with a yes/no question. Under 50 words body." },
    { day: "Day 6",  label: "Social Proof",     icon: "⭐", color: "#d97706",
      instruction: "Social proof angle. Mention that other [industry] startups we worked with had the same hiring need. One concrete credibility line. One very low-friction ask (15-min call or just reply yes/no). Under 55 words body." },
    { day: "Day 10", label: "Final Nudge",      icon: "🎯", color: "#059669",
      instruction: "Final breakup email. 3 sentences max. Acknowledge timing might be off. Leave door completely open with zero pressure. End on a warm human note. Under 40 words body." },
  ];

  const buildLeadContext = (lead) => {
    const daysPosted = lead.posted_at
      ? Math.floor((Date.now() - new Date(lead.posted_at)) / 864e5)
      : null;
    const urgency = daysPosted !== null && daysPosted <= 5
      ? `URGENCY: They posted "${lead.job_title}" only ${daysPosted} day(s) ago — fresh & actively hiring.`
      : daysPosted !== null
      ? `They posted "${lead.job_title}" ${daysPosted} days ago.`
      : "";
    return `
Prospect: ${lead.first_name || "Founder"} ${lead.last_name || ""}
Title: ${lead.contact_title || "Founder/CTO"}
Company: ${lead.company_name} (${lead.employee_count || "small"} employees)
Industry: ${lead.industry || "Tech"}
Hiring for: ${lead.job_title}
${lead.domain ? `Website: ${lead.domain}` : ""}
${urgency}
    `.trim();
  };

  const buildSystemPrompt = () => {
    const senderLine = senderConfig.senderName
      ? `You are writing as ${senderConfig.senderName} from ${senderConfig.companyName}.`
      : `You are writing on behalf of ${senderConfig.companyName}.`;
    return `You are an elite B2B cold email copywriter. ${senderLine}

VALUE PROPS (weave these in naturally, don't list them robotically):
${senderConfig.valueProps}

PREFERRED CTA: "${senderConfig.callToAction}"

TONE: ${tone.toUpperCase()} — ${toneGuides[tone]}

GOLDEN RULES:
- Sound like a real human, never a marketer
- Forbidden words/phrases: leverage, synergy, circle back, hope this finds you, touching base, I wanted to reach out, game-changer, cutting-edge, streamline, revolutionary, innovative solution
- Use first name naturally (once max, in opener or subject only)
- Subject lines: lowercase preferred, no clickbait, specific > generic, under 8 words
- Always give an ALTERNATIVE subject that takes a completely different angle
- Body: max word counts strictly enforced per step
- Respond ONLY with valid JSON — no markdown, no code blocks, no preamble`;
  };

  const generateSequence = async () => {
    if (!selected) return;
    setGenerating(true); setSequence(null); setGenError(null); setEdited({});

    const systemPrompt = buildSystemPrompt() + `
Return exactly 4 email objects as a JSON array:
[{"subject":"...","altSubject":"...","body":"...","psLine":"..."},...]
psLine is an optional P.S. line for Step 1 only (empty string for other steps). No other text outside the JSON.`;

    const userPrompt = `Write all 4 emails for this lead:

${buildLeadContext(selected)}

Step instructions:
${STEPS.map((s, i) => `Step ${i + 1} (${s.label}, ${s.day}): ${s.instruction}`).join("\n")}

Return exactly 4 email objects. No other text.`;

    try {
      const result = await callClaude(systemPrompt, userPrompt, settings);
      let emails = result;
      if (result && result.content) {
        const text = Array.isArray(result.content)
          ? result.content.filter(b => b.type === "text").map(b => b.text).join("")
          : result.content;
        emails = JSON.parse(text.replace(/```json|```/g, "").trim());
      }
      if (!Array.isArray(emails)) throw new Error("Expected array of 4 emails");
      setSequence(emails);
      setActiveStep(0);
    } catch (err) {
      setGenError(err.message);
    }
    setGenerating(false);
  };

  const regenerateStep = async (stepIdx) => {
    if (!selected || !sequence) return;
    setRegenStep(stepIdx);

    const s = STEPS[stepIdx];
    const systemPrompt = buildSystemPrompt() + `
Return exactly 1 email object as a JSON object (not an array):
{"subject":"...","altSubject":"...","body":"...","psLine":"..."}
No other text outside the JSON.`;

    const userPrompt = `Rewrite Step ${stepIdx + 1} (${s.label}) for this lead:

${buildLeadContext(selected)}

Step instruction: ${s.instruction}

Return exactly 1 email object. No other text.`;

    try {
      const result = await callClaude(systemPrompt, userPrompt, settings);
      let email = result;
      if (result && result.content) {
        const text = Array.isArray(result.content)
          ? result.content.filter(b => b.type === "text").map(b => b.text).join("")
          : result.content;
        email = JSON.parse(text.replace(/```json|```/g, "").trim());
      }
      if (typeof email !== "object" || Array.isArray(email)) throw new Error("Expected single email object");
      // Merge into sequence
      const newSeq = [...sequence];
      newSeq[stepIdx] = email;
      setSequence(newSeq);
      // Clear any edits for this step
      setEdited(e => { const n = {...e}; delete n[stepIdx]; return n; });
    } catch (err) {
      setGenError(`Step ${stepIdx + 1} regen: ${err.message}`);
    }
    setRegenStep(null);
  };

  const getEmail = (i) => {
    const base = sequence?.[i] || {};
    return { ...base, ...edited[i] };
  };

  const updateEmail = (i, field, val) => {
    setEdited(e => ({ ...e, [i]: { ...e[i], [field]: val } }));
  };

  const copyAll = () => {
    if (!sequence) return;
    const text = STEPS.map((s, i) => {
      const e = getEmail(i);
      return `--- ${s.label} (${s.day}) ---\nSubject: ${e.subject}\n\n${e.body}`;
    }).join("\n\n");
    navigator.clipboard?.writeText(text);
    setCopied("all");
    setTimeout(() => setCopied(null), 2000);
  };

  const copyStep = (i) => {
    const e = getEmail(i);
    navigator.clipboard?.writeText(`Subject: ${e.subject}\n\n${e.body}`);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
  };

  const useAltSubject = (i) => {
    const e = getEmail(i);
    const main = e.subject; const alt = e.altSubject;
    updateEmail(i, "subject", alt);
    updateEmail(i, "altSubject", main);
  };

  const wordCount = (text) => text?.trim().split(/\s+/).filter(Boolean).length || 0;

  const launchCampaign = async () => {
    if (!qualified.length) return;
    setLaunching(true);
    if (backendOk && settings.instantlyKey) {
      try {
        const result = await apiFetch("/campaign/launch", { method: "POST", body: JSON.stringify({ lead_ids: qualified.map(l => l.id), instantlyKey: settings.instantlyKey }) });
        setLaunch({ success: true, msg: `Launched ${result.results.filter(r => r.status === "launched").length} leads` });
      } catch (err) { setLaunch({ success: false, msg: err.message }); }
    } else {
      await new Promise(r => setTimeout(r, 1500));
      setLaunch({ success: true, msg: `Demo: Would launch ${qualified.length} leads (add Instantly key in Settings)` });
    }
    setLaunching(false);
  };

  const activeEmail = sequence ? getEmail(activeStep) : null;
  const step = STEPS[activeStep];

  // Email preview renderer
  const renderPreview = (email, stepIdx) => {
    const s = STEPS[stepIdx];
    return (
      <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", boxShadow: "var(--shadow)" }}>
        {/* Email client chrome */}
        <div style={{ background: "var(--surface2)", borderBottom: "1px solid var(--border)", padding: "10px 16px" }}>
          <div style={{ fontSize: 11, color: "var(--muted)", display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span><strong style={{ color: "var(--text)" }}>To:</strong> {selected?.first_name} {selected?.last_name} &lt;{selected?.contact_email}&gt;</span>
            {senderConfig.senderName && <span><strong style={{ color: "var(--text)" }}>From:</strong> {senderConfig.senderName}</span>}
          </div>
          <div style={{ marginTop: 6, fontSize: 14, fontWeight: 700, color: "var(--text)" }}>
            {email.subject || "(no subject)"}
          </div>
          <div style={{ marginTop: 2, fontSize: 11, color: "var(--muted)" }}>{s.day} · {wordCount(email.body)} words</div>
        </div>
        <div style={{ padding: "20px 24px", fontSize: 14, lineHeight: 1.85, color: "var(--text)", whiteSpace: "pre-wrap", fontFamily: "Georgia, serif" }}>
          {email.body}
          {email.psLine && <div style={{ marginTop: 16, fontStyle: "italic", color: "var(--muted)", fontSize: 13 }}>P.S. {email.psLine}</div>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }} className="slide-in">
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 800 }}>Email Campaigns</h2>
          <p style={{ color: "var(--muted)", fontSize: 13, marginTop: 4 }}>AI-generated 4-touch sequence · Instantly.ai</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {launchResult && <div style={{ fontSize: 12, color: launchResult.success ? "var(--accent3)" : "var(--danger)", fontWeight: 600 }}>{launchResult.success ? "✅" : "❌"} {launchResult.msg}</div>}
          <Btn variant="ghost" size="sm" onClick={() => setShowConfig(c => !c)}>
            ⚙️ {showConfig ? "Hide" : "Sender Setup"}
          </Btn>
          <Btn variant="success" onClick={launchCampaign} disabled={launching || !qualified.length}>
            {launching ? <><Spinner size={14} />Launching...</> : `🚀 Launch (${qualified.length} leads)`}
          </Btn>
        </div>
      </div>

      {/* Sender Config Panel */}
      {showConfig && (
        <Card style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: "#1d4ed8" }}>⚙️ Sender & Company Config <span style={{ fontSize: 11, fontWeight: 400, color: "var(--muted)" }}>(saved to browser)</span></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <Label>Your Name (optional)</Label>
              <Input placeholder="e.g. Alex Chen" value={senderConfig.senderName}
                onChange={e => saveSenderConfig({...senderConfig, senderName: e.target.value})} />
            </div>
            <div>
              <Label>Company Name</Label>
              <Input placeholder="e.g. TalentBridge" value={senderConfig.companyName}
                onChange={e => saveSenderConfig({...senderConfig, companyName: e.target.value})} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>Value Props (bullet-point style, Claude will weave in naturally)</Label>
              <Input placeholder="e.g. pre-vetted engineers · placed in 2 weeks · 60% cheaper · no contracts" value={senderConfig.valueProps}
                onChange={e => saveSenderConfig({...senderConfig, valueProps: e.target.value})} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <Label>Preferred Call-to-Action</Label>
              <Input placeholder="e.g. open to a 15-min call?" value={senderConfig.callToAction}
                onChange={e => saveSenderConfig({...senderConfig, callToAction: e.target.value})} />
            </div>
          </div>
        </Card>
      )}

      {/* Step tabs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {STEPS.map((s, i) => (
          <div key={i} onClick={() => setActiveStep(i)} style={{
            background: activeStep === i ? `${s.color}12` : "var(--surface)",
            border: `1px solid ${activeStep === i ? s.color : sequence ? `${s.color}60` : "var(--border)"}`,
            borderRadius: 10, padding: 16, cursor: "pointer", transition: "all .2s",
            boxShadow: "var(--shadow)", position: "relative",
          }}>
            {sequence && <div style={{ position: "absolute", top: 8, right: 10, width: 8, height: 8, borderRadius: "50%", background: s.color }} />}
            <div style={{ fontSize: 20, marginBottom: 6 }}>{s.icon}</div>
            <div style={{ fontSize: 11, color: s.color, fontWeight: 700 }}>{s.day}</div>
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 16 }}>
        {/* Lead list */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", background: "var(--surface2)" }}>
            <Label>Qualified Leads ({qualified.length})</Label>
          </div>
          <div style={{ maxHeight: 460, overflowY: "auto" }}>
            {qualified.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "var(--muted)", fontSize: 12 }}>No qualified leads with contacts yet</div>}
            {qualified.map(l => (
              <div key={l.id} onClick={() => { setSelected(l); setSequence(null); setGenError(null); setEdited({}); }} style={{
                padding: "11px 14px", cursor: "pointer", borderBottom: "1px solid var(--border)",
                background: selected?.id === l.id ? "#dbeafe" : "transparent",
                borderLeft: `3px solid ${selected?.id === l.id ? "var(--accent)" : "transparent"}`,
                transition: "all .15s",
              }}>
                <div style={{ fontWeight: 700, fontSize: 12 }}>{l.company_name}</div>
                <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 1 }}>{l.first_name} {l.last_name} · {l.contact_title}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 1, fontStyle: "italic" }}>{l.job_title}</div>
                <div style={{ marginTop: 4 }}><ScoreBadge score={l.score} /></div>
              </div>
            ))}
          </div>
        </Card>

        {/* Generator panel */}
        <Card style={{ display: "flex", flexDirection: "column", gap: 0, padding: 0, overflow: "hidden" }}>
          {/* Toolbar */}
          <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", background: "var(--surface2)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {selected
                  ? <span>✍️ {selected.first_name || selected.company_name} <span style={{ color: "var(--muted)", fontWeight: 400, fontSize: 12 }}>· {selected.company_name}</span></span>
                  : "AI Email Generator"}
              </div>
              {selected && <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 2 }}>Hiring: {selected.job_title} · {selected.contact_title || "Decision maker"}</div>}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              {/* Tone selector */}
              <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                {["casual", "professional", "direct", "bold"].map(t => (
                  <button key={t} onClick={() => setTone(t)} style={{
                    padding: "5px 10px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                    background: tone === t ? "var(--accent)" : "transparent",
                    color: tone === t ? "#fff" : "var(--muted)",
                    fontFamily: "var(--font)", transition: "all .15s",
                  }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
                ))}
              </div>
              {/* View mode */}
              {sequence && (
                <div style={{ display: "flex", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
                  {[["edit", "✏️ Edit"], ["preview", "👁 Preview"]].map(([m, label]) => (
                    <button key={m} onClick={() => setViewMode(m)} style={{
                      padding: "5px 10px", fontSize: 11, fontWeight: 600, border: "none", cursor: "pointer",
                      background: viewMode === m ? "var(--accent)" : "transparent",
                      color: viewMode === m ? "#fff" : "var(--muted)",
                      fontFamily: "var(--font)", transition: "all .15s",
                    }}>{label}</button>
                  ))}
                </div>
              )}
              {sequence && (
                <Btn variant="ghost" size="sm" onClick={copyAll}>
                  {copied === "all" ? "✅ Copied!" : "📋 Copy All 4"}
                </Btn>
              )}
              <Btn onClick={generateSequence} disabled={!selected || generating} style={{ minWidth: 155 }}>
                {generating ? <><Spinner size={14} />Writing all 4...</> : sequence ? "🔄 Regenerate All" : "✨ Generate Sequence"}
              </Btn>
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: "18px 20px", flex: 1 }}>
            {!selected && (
              <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>👈</div>
                <div style={{ fontWeight: 600 }}>Select a lead to get started</div>
                <div style={{ fontSize: 12, marginTop: 6 }}>Generates all 4 emails at once, personalized to their role</div>
              </div>
            )}

            {selected && !sequence && !generating && !genError && (
              <div style={{ textAlign: "center", padding: "50px 20px", color: "var(--muted)" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>✨</div>
                <div style={{ fontWeight: 700, fontSize: 15, color: "var(--text)", marginBottom: 8 }}>Ready to generate for {selected.first_name || selected.company_name}</div>
                <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                  All 4 emails personalized to their <strong>{selected.job_title}</strong> hire at <strong>{selected.company_name}</strong><br/>
                  Tone: <strong>{tone}</strong> · Use the selector above to change
                </div>
                <div style={{ marginTop: 20 }}>
                  <Btn onClick={generateSequence} style={{ minWidth: 200 }}>✨ Generate 4-Email Sequence</Btn>
                </div>
              </div>
            )}

            {generating && (
              <div style={{ textAlign: "center", padding: "60px 20px" }}>
                <Spinner size={32} />
                <div style={{ color: "var(--muted)", marginTop: 14, fontWeight: 600 }}>Writing your 4-email sequence...</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>Personalizing for {selected?.company_name} · Tone: {tone}</div>
              </div>
            )}

            {genError && !generating && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#dc2626", marginBottom: 12 }}>❌ {genError}</div>
            )}

            {activeEmail && !generating && (
              <div style={{ display: "flex", flexDirection: "column", gap: 14, animation: "fadeIn .25s ease" }}>

                {viewMode === "preview" ? (
                  // Preview mode — show email as it would appear
                  renderPreview(activeEmail, activeStep)
                ) : (
                  // Edit mode
                  <>
                    {/* Step header with regen button */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 18 }}>{step.icon}</span>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13, color: step.color }}>{step.label}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>{step.day} · {wordCount(activeEmail.body)} words</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6 }}>
                        <Btn variant="ghost" size="sm" onClick={() => regenerateStep(activeStep)} disabled={regenStep === activeStep}>
                          {regenStep === activeStep ? <><Spinner size={12} />Rewriting...</> : "🔄 Regen Step"}
                        </Btn>
                        <Btn variant="ghost" size="sm" onClick={() => copyStep(activeStep)}>
                          {copied === activeStep ? "✅ Copied!" : "📋 Copy"}
                        </Btn>
                      </div>
                    </div>

                    {/* Subject */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <Label>Subject Line</Label>
                        {activeEmail.altSubject && (
                          <button onClick={() => useAltSubject(activeStep)} style={{
                            fontSize: 11, color: "var(--accent)", background: "none", border: "none",
                            cursor: "pointer", fontFamily: "var(--font)", fontWeight: 600, padding: 0,
                          }}>⇄ Try alt: "{activeEmail.altSubject}"</button>
                        )}
                      </div>
                      <input
                        value={activeEmail.subject || ""}
                        onChange={e => updateEmail(activeStep, "subject", e.target.value)}
                        style={{
                          width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                          borderRadius: 7, padding: "9px 12px", fontSize: 13, fontWeight: 600,
                          color: "var(--text)", fontFamily: "var(--font)", outline: "none", boxSizing: "border-box",
                        }}
                      />
                    </div>

                    {/* Body */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <Label>Email Body</Label>
                        <span style={{ fontSize: 11, color: wordCount(activeEmail.body) > 80 ? "var(--warn)" : "var(--accent3)", fontWeight: 600 }}>
                          {wordCount(activeEmail.body)} words
                        </span>
                      </div>
                      <textarea
                        value={activeEmail.body || ""}
                        onChange={e => updateEmail(activeStep, "body", e.target.value)}
                        rows={8}
                        style={{
                          width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                          borderRadius: 7, padding: "12px 14px", fontSize: 13, lineHeight: 1.75,
                          color: "var(--text)", fontFamily: "var(--font)", outline: "none",
                          resize: "vertical", boxSizing: "border-box",
                        }}
                      />
                    </div>

                    {/* PS Line (step 1 only) */}
                    {activeStep === 0 && (
                      <div>
                        <Label>P.S. Line (optional — shown at bottom of email)</Label>
                        <input
                          value={activeEmail.psLine || ""}
                          onChange={e => updateEmail(activeStep, "psLine", e.target.value)}
                          placeholder="e.g. P.S. We can have a shortlist ready for you in 48h..."
                          style={{
                            width: "100%", background: "var(--surface2)", border: "1px solid var(--border)",
                            borderRadius: 7, padding: "9px 12px", fontSize: 12, fontStyle: "italic",
                            color: "var(--text)", fontFamily: "var(--font)", outline: "none", boxSizing: "border-box",
                          }}
                        />
                      </div>
                    )}
                  </>
                )}

                {/* Step nav */}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingTop: 4, borderTop: "1px solid var(--border)", marginTop: 4 }}>
                  {STEPS.map((s, i) => (
                    <button key={i} onClick={() => setActiveStep(i)} style={{
                      padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 600,
                      border: `1px solid ${activeStep === i ? s.color : "var(--border)"}`,
                      background: activeStep === i ? `${s.color}15` : "var(--surface)",
                      color: activeStep === i ? s.color : "var(--muted)",
                      cursor: "pointer", fontFamily: "var(--font)", transition: "all .15s",
                    }}>{s.icon} {s.label}</button>
                  ))}
                  <Btn variant="success" size="sm" style={{ marginLeft: "auto" }}>📤 Add to Instantly</Btn>
                </div>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── Settings View (with all API keys + save) ───────────────────────────── */
function SettingsView({ settings, onSave, settingsLoaded }) {
  const [local, setLocal] = useState({ ...settings });
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Sync if settings loaded from DB after mount
  useEffect(() => {
    setLocal({ ...settings });
  }, [settingsLoaded]);
  const [deploying, setDeploying] = useState(false);
  const [deployLog, setDeployLog] = useState([]);
  const [deployResult, setDeployResult] = useState(null);
  // Track what's actually persisted in localStorage (for status indicator)
  const save = async () => {
    setSaveError(null);
    try {
      await onSave(local);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError("Save failed: " + err.message);
    }
  };

  const deployToGitHub = async () => {
    const githubToken = local.githubToken;
    const owner = "csharptek";

    if (!githubToken) {
      alert("Add your GitHub token in Settings → Deploy section first.");
      return;
    }

    const pendingFiles = window.__HIRERAD_PENDING_DEPLOY__ || [];
    if (!pendingFiles.length) {
      alert("No updates pending. Claude will pre-load files before asking you to deploy.");
      return;
    }

    setDeploying(true);
    setDeployLog([]);
    setDeployResult(null);
    const log = (msg, type="default") => setDeployLog(l => [...l, { msg, type, time: new Date().toLocaleTimeString() }]);

    log(`🚀 Deploying ${pendingFiles.length} file(s) directly to GitHub...`, "accent");
    pendingFiles.forEach(f => log(`📦 ${f.repo}/${f.path}`, "default"));

    const results = [];
    for (const file of pendingFiles) {
      const { repo, path, branch = "main", content } = file;
      const apiBase = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
      const headers = {
        "Authorization": `token ${githubToken}`,
        "Accept": "application/vnd.github+json",
        "Content-Type": "application/json",
      };
      try {
        // Get current SHA
        let sha = null;
        const getRes = await fetch(`${apiBase}?ref=${branch}`, { headers });
        if (getRes.ok) { const d = await getRes.json(); sha = d.sha; }

        // Commit
        const body = {
          message: `deploy: update ${path} [${new Date().toISOString()}]`,
          content: btoa(unescape(encodeURIComponent(content))),
          branch,
          ...(sha ? { sha } : {}),
        };
        const putRes = await fetch(apiBase, { method: "PUT", headers, body: JSON.stringify(body) });
        const putData = await putRes.json();
        if (!putRes.ok) throw new Error(putData.message || putRes.status);

        const commit = putData.commit?.sha?.slice(0, 7);
        log(`✅ ${repo}/${path} → committed ${commit}`, "success");
        results.push({ path, status: "success", commit });
      } catch (err) {
        log(`❌ ${repo}/${path}: ${err.message}`, "error");
        results.push({ path, status: "error", error: err.message });
      }
    }

    const allOk = results.every(r => r.status === "success");
    if (allOk) {
      log("🎉 All files committed! Vercel + Railway deploying in ~60s", "success");
      window.__HIRERAD_PENDING_DEPLOY__ = [];
    }
    setDeployResult({ success: allOk, results });
    setDeploying(false);
  };

  const KeyField = ({ label, hint, field, type="password" }) => (
    <div style={{ marginBottom:16 }}>
      <Label>{label}</Label>
      <div style={{ display:"flex", gap:10 }}>
        <input type={type} placeholder={hint} value={local[field]||""} onChange={e=>setLocal(p=>({...p,[field]:e.target.value}))}
          style={{ flex:1, background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 12px", color:"var(--text)", fontFamily:"var(--mono)", fontSize:13, outline:"none", boxShadow:"var(--shadow)" }}
          onFocus={e=>e.target.style.borderColor="var(--accent)"}
          onBlur={e=>e.target.style.borderColor="var(--border)"}
        />
        <div style={{ padding:"9px 12px", borderRadius:8, background:local[field]?"#dcfce7":"#fee2e2", border:`1px solid ${local[field]?"#16a34a30":"#dc262630"}`, color:local[field]?"#16a34a":"var(--danger)", fontSize:11, fontWeight:700, display:"flex", alignItems:"center", whiteSpace:"nowrap" }}>
          {local[field] ? "✓ SET" : "NOT SET"}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }} className="slide-in">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800 }}>Settings</h2>
          <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>API keys are saved to the database and sync across devices</p>
        </div>
        {!settingsLoaded && (
          <div style={{ display:"flex", alignItems:"center", gap:8, fontSize:12, color:"var(--muted)" }}>
            <Spinner size={14} /> Loading from database...
          </div>
        )}
      </div>

      <Card>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>🔑 API Keys</div>
        <p style={{ color:"var(--muted)", fontSize:12, marginBottom:20 }}>Keys are stored locally in your browser. They'll be remembered when you return.</p>
        <KeyField label="Apollo.io API Key" hint="Paste from apollo.io → Settings → Integrations → API Keys" field="apolloKey" />
        <KeyField label="Apify API Token"   hint="Paste from console.apify.com → Settings → Integrations" field="apifyKey" />
        <KeyField label="Instantly API Key" hint="Paste from app.instantly.ai → Settings → API" field="instantlyKey" />
        <Btn onClick={save} style={{ marginTop:4 }}>
          {saved ? "✅ Saved!" : "💾 Save API Keys"}
        </Btn>
        {saveError && <div style={{ marginTop:8, color:"var(--danger)", fontSize:12 }}>{saveError}</div>}
      </Card>

      <Card style={{ border: "1px solid #bfdbfe", background: "#f0f7ff" }}>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:4, color:"#1d4ed8" }}>🤖 Azure OpenAI — Email Generator</div>
        <p style={{ color:"var(--muted)", fontSize:12, marginBottom:16 }}>
          When configured, email sequences will be generated using your Azure OpenAI deployment directly from the browser.
          Leave blank to use the Anthropic backend instead.
        </p>

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
          <div style={{ gridColumn:"1 / -1" }}>
            <Label>Azure OpenAI Endpoint</Label>
            <input
              type="text"
              placeholder="https://YOUR-RESOURCE.openai.azure.com"
              value={local.azureOpenAiEndpoint || ""}
              onChange={e => setLocal(p => ({ ...p, azureOpenAiEndpoint: e.target.value }))}
              style={{ width:"100%", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 12px", color:"var(--text)", fontFamily:"var(--mono)", fontSize:13, outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderColor="var(--accent)"}
              onBlur={e=>e.target.style.borderColor="var(--border)"}
            />
            <div style={{ fontSize:11, color:"var(--muted)", marginTop:3 }}>
              Found in Azure Portal → Your OpenAI resource → Keys and Endpoint
            </div>
          </div>

          <div>
            <Label>API Key</Label>
            <input
              type="password"
              placeholder="Azure OpenAI Key 1 or Key 2"
              value={local.azureOpenAiKey || ""}
              onChange={e => setLocal(p => ({ ...p, azureOpenAiKey: e.target.value }))}
              style={{ width:"100%", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 12px", color:"var(--text)", fontFamily:"var(--mono)", fontSize:13, outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderColor="var(--accent)"}
              onBlur={e=>e.target.style.borderColor="var(--border)"}
            />
          </div>

          <div>
            <Label>Deployment Name</Label>
            <input
              type="text"
              placeholder="e.g. gpt-4o or gpt-35-turbo"
              value={local.azureOpenAiDeployment || ""}
              onChange={e => setLocal(p => ({ ...p, azureOpenAiDeployment: e.target.value }))}
              style={{ width:"100%", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 12px", color:"var(--text)", fontFamily:"var(--mono)", fontSize:13, outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderColor="var(--accent)"}
              onBlur={e=>e.target.style.borderColor="var(--border)"}
            />
            <div style={{ fontSize:11, color:"var(--muted)", marginTop:3 }}>
              Azure Portal → Your OpenAI resource → Model deployments
            </div>
          </div>

          <div>
            <Label>API Version</Label>
            <input
              type="text"
              placeholder="2024-02-01"
              value={local.azureOpenAiApiVersion || "2024-02-01"}
              onChange={e => setLocal(p => ({ ...p, azureOpenAiApiVersion: e.target.value }))}
              style={{ width:"100%", background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 12px", color:"var(--text)", fontFamily:"var(--mono)", fontSize:13, outline:"none", boxSizing:"border-box" }}
              onFocus={e=>e.target.style.borderColor="var(--accent)"}
              onBlur={e=>e.target.style.borderColor="var(--border)"}
            />
            <div style={{ fontSize:11, color:"var(--muted)", marginTop:3 }}>
              Default: 2024-02-01 — check Azure docs for latest
            </div>
          </div>
        </div>

        {/* Status indicator */}
        <div style={{ marginTop:16, padding:"10px 14px", borderRadius:8, background: local.azureOpenAiEndpoint && local.azureOpenAiKey && local.azureOpenAiDeployment ? "#dcfce7" : "#fef9c3", border: `1px solid ${local.azureOpenAiEndpoint && local.azureOpenAiKey && local.azureOpenAiDeployment ? "#16a34a30" : "#ca8a0430"}`, fontSize:12, fontWeight:600, color: local.azureOpenAiEndpoint && local.azureOpenAiKey && local.azureOpenAiDeployment ? "#16a34a" : "#92400e" }}>
          {local.azureOpenAiEndpoint && local.azureOpenAiKey && local.azureOpenAiDeployment
            ? `✅ Azure OpenAI configured — using deployment "${local.azureOpenAiDeployment}"`
            : "⚠️ Fill in all 3 fields above to enable Azure OpenAI. Missing fields will fall back to Anthropic backend."}
        </div>

        <Btn onClick={save} style={{ marginTop:14 }}>
          {saved ? "✅ Saved!" : "💾 Save Azure Settings"}
        </Btn>
      </Card>

      <Card>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>🔗 System Status</div>
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[
            ["Backend API",       `${API_BASE.replace("/api","")}`,                                               "🟢"],
            ["Apollo.io",         local.apolloKey          ? "Key configured ✓"  : "Not configured",             local.apolloKey          ? "🟢" : "🔴"],
            ["Apify",             local.apifyKey           ? "Key configured ✓"  : "Not configured",             local.apifyKey           ? "🟢" : "🔴"],
            ["Instantly",         local.instantlyKey       ? "Key configured ✓"  : "Not configured",             local.instantlyKey       ? "🟢" : "🔴"],
            ["Azure OpenAI",      local.azureOpenAiEndpoint && local.azureOpenAiKey && local.azureOpenAiDeployment ? `Deployment: ${local.azureOpenAiDeployment} ✓` : "Not configured — will use Anthropic", local.azureOpenAiEndpoint && local.azureOpenAiKey && local.azureOpenAiDeployment ? "🟢" : "🟡"],
            ["GitHub Token",      local.githubToken        ? "Token configured ✓": "Not configured",             local.githubToken        ? "🟢" : "🔴"],
          ].map(([name,val,icon])=>(
            <div key={name} style={{ display:"flex", justifyContent:"space-between", padding:"10px 14px", background:"var(--surface2)", borderRadius:8, fontSize:13 }}>
              <span style={{ fontWeight:600 }}>{icon} {name}</span>
              <span style={{ color:"var(--muted)", fontFamily:"var(--mono)", fontSize:12 }}>{val}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:4 }}>🚀 GitHub Auto-Deploy</div>
        <p style={{ color:"var(--muted)", fontSize:12, marginBottom:16 }}>
          Claude pushes code directly to GitHub → triggers Vercel & Railway auto-deploy
        </p>

        <div style={{ marginBottom:16 }}>
          <Label>GitHub Personal Access Token</Label>
          <Input
            type="password"
            placeholder="github_pat_... (needs repo scope)"
            value={local.githubToken||""}
            onChange={e=>setLocal(p=>({...p,githubToken:e.target.value}))}
          />
          <div style={{ fontSize:11, color:"var(--muted)", marginTop:4 }}>
            Generate at github.com/settings/tokens → Fine-grained or Classic with <code>repo</code> scope
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20, paddingBottom:20, borderBottom:"1px solid var(--border)" }}>
          <Btn variant="outline" onClick={save} style={{ minWidth:180 }}>
            {saved ? "✅ Saved!" : "💾 Save Settings"}
          </Btn>
          <div style={{ fontSize:12 }}>
            {local.githubToken
              ? <span style={{ color:"#16a34a", fontWeight:600 }}>✓ Token saved · deploy ready</span>
              : <span style={{ color:"var(--danger)" }}>⚠ Add GitHub token above to enable deploy</span>}
          </div>
        </div>

        <PendingDeployStatus />

        <div style={{ display:"flex", gap:10, alignItems:"center", marginBottom:16 }}>
          <Btn onClick={deployToGitHub} disabled={deploying||!local.githubToken} variant="success" style={{ minWidth:180 }}>
            {deploying
              ? <><Spinner size={14}/>Deploying...</>
              : "🚀 Deploy to GitHub"}
          </Btn>
          {deployResult && (
            <span style={{ fontSize:12, fontWeight:700, color: deployResult.success ? "var(--accent3)" : "var(--danger)" }}>
              {deployResult.success ? "✅ Deployed successfully!" : "❌ Deploy failed"}
            </span>
          )}
        </div>

        {deployLog.length > 0 && (
          <div style={{ fontFamily:"var(--mono)", fontSize:11, lineHeight:2, background:"var(--surface2)", borderRadius:8, padding:12, maxHeight:200, overflowY:"auto" }}>
            {deployLog.map((l,i) => (
              <div key={i} style={{ color: l.type==="success"?"var(--accent3)":l.type==="error"?"var(--danger)":l.type==="accent"?"var(--accent)":l.type==="warn"?"var(--warn)":"var(--muted)" }}>
                <span style={{ opacity:.4 }}>{l.time}</span>{"  "}{l.msg}
              </div>
            ))}
          </div>
        )}

        {deployResult?.results?.length > 0 && (
          <div style={{ marginTop:12, display:"flex", flexDirection:"column", gap:6 }}>
            {deployResult.results.map((r,i) => r.url && (
              <a key={i} href={r.url} target="_blank" rel="noreferrer"
                style={{ fontSize:11, color:"var(--accent)", fontFamily:"var(--mono)" }}>
                🔗 {r.repo}/{r.path} @ {r.commit}
              </a>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div style={{ fontWeight:700, fontSize:15, marginBottom:12 }}>🚀 Backend Setup</div>
        <div style={{ fontFamily:"var(--mono)", fontSize:12, lineHeight:2, color:"var(--muted)", background:"var(--surface2)", borderRadius:8, padding:14 }}>
          {["cd hirerad-backend","npm install","cp env.example .env   # fill in your keys","npm run dev              # start API on :4000"].map((cmd,i)=>(
            <div key={i}><span style={{ color:"var(--accent3)", marginRight:8 }}>$</span>{cmd}</div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ─── App Shell ──────────────────────────────────────────────────────────── */
export default function App() {
  const [view, setView]       = useState("dashboard");
  const [leads, setLeads]     = useState(MOCK_LEADS);
  const [stats, setStats]     = useState(null);
  const [enriching, setEnrich] = useState(null);
  const [backendOk, setBackend] = useState(null);

  // Load API keys from database (with localStorage fallback while loading)
  const [settings, setSettings] = useState(() => ({
    apolloKey:             LS.get("hr_apollo"),
    apifyKey:              LS.get("hr_apify"),
    instantlyKey:          LS.get("hr_instantly"),
    githubToken:           LS.get("hr_github_token"),
    azureOpenAiEndpoint:   LS.get("hr_azure_oai_endpoint"),
    azureOpenAiKey:        LS.get("hr_azure_oai_key"),
    azureOpenAiDeployment: LS.get("hr_azure_oai_deployment"),
    azureOpenAiApiVersion: LS.get("hr_azure_oai_api_version") || "2024-02-01",
  }));
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load settings from DB on mount
  useEffect(() => {
    apiFetch("/settings")
      .then(data => {
        const merged = {
          apolloKey:             data.apolloKey             || "",
          apifyKey:              data.apifyKey              || "",
          instantlyKey:          data.instantlyKey          || "",
          githubToken:           data.githubToken           || "",
          azureOpenAiEndpoint:   data.azureOpenAiEndpoint   || "",
          azureOpenAiKey:        data.azureOpenAiKey        || "",
          azureOpenAiDeployment: data.azureOpenAiDeployment || "",
          azureOpenAiApiVersion: data.azureOpenAiApiVersion || "2024-02-01",
        };
        setSettings(merged);
        // Also mirror to localStorage for offline/fast-load
        LS.set("hr_apollo",                merged.apolloKey);
        LS.set("hr_apify",                 merged.apifyKey);
        LS.set("hr_instantly",             merged.instantlyKey);
        LS.set("hr_github_token",          merged.githubToken);
        LS.set("hr_azure_oai_endpoint",    merged.azureOpenAiEndpoint);
        LS.set("hr_azure_oai_key",         merged.azureOpenAiKey);
        LS.set("hr_azure_oai_deployment",  merged.azureOpenAiDeployment);
        LS.set("hr_azure_oai_api_version", merged.azureOpenAiApiVersion);
      })
      .catch(() => { /* backend down — use localStorage values */ })
      .finally(() => setSettingsLoaded(true));
  }, []);

  const saveSettings = async (s) => {
    // Save to DB first
    try {
      await apiFetch("/settings", {
        method: "PUT",
        body: JSON.stringify(s),
      });
    } catch (err) {
      console.warn("Could not save settings to DB:", err.message);
    }
    // Mirror to localStorage as fallback
    LS.set("hr_apollo",                s.apolloKey              || "");
    LS.set("hr_apify",                 s.apifyKey               || "");
    LS.set("hr_instantly",             s.instantlyKey           || "");
    LS.set("hr_github_token",          s.githubToken            || "");
    LS.set("hr_azure_oai_endpoint",    s.azureOpenAiEndpoint    || "");
    LS.set("hr_azure_oai_key",         s.azureOpenAiKey         || "");
    LS.set("hr_azure_oai_deployment",  s.azureOpenAiDeployment  || "");
    LS.set("hr_azure_oai_api_version", s.azureOpenAiApiVersion  || "2024-02-01");
    setSettings(s);
  };

  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = GLOBAL_STYLE;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  useEffect(() => {
    apiFetch("/health")
      .then(() => { setBackend(true); loadData(); })
      .catch(() => setBackend(false));
  }, []);

  const loadData = async () => {
    try {
      const [leadsData, statsData] = await Promise.all([apiFetch("/leads"), apiFetch("/dashboard")]);
      if (leadsData.leads?.length) setLeads(leadsData.leads);
      setStats(statsData);
    } catch {}
  };

  const handleEnrich = useCallback(async (leadId, companyName) => {
    setEnrich(leadId);
    if (backendOk) {
      try {
        const apolloKey = LS.get("hr_apollo");
        if (!apolloKey) { alert("Add your Apollo.io API key in Settings first!"); setEnrich(null); return; }
        if (!companyName) { setEnrich(null); return; }

        const companyRes = await fetch(`${API_BASE}/apollo/company`, {
          method:"POST",
          headers: { "Content-Type":"application/json", "x-apollo-key": apolloKey },
          body: JSON.stringify({ company_name: companyName }),
        });
        const companyData = await companyRes.json();

        if (!companyRes.ok || !companyData.people?.length) {
          // No contact found - leave lead unchanged
          setEnrich(null);
          return;
        }

        const person = companyData.people[0];

        // Save to backend DB
        const saveRes = await fetch(`${API_BASE}/leads/${leadId}/enrich`, {
          method:"POST",
          headers: { "Content-Type":"application/json" },
          body: JSON.stringify({ contact: person }),
        });
        const saveData = await saveRes.json().catch(() => ({}));
        if (!saveRes.ok) { setEnrich(null); return; }

        // Update UI immediately
        setLeads(ls => ls.map(l => l.id !== leadId ? l : {
          ...l,
          first_name: person.name?.split(" ")[0],
          last_name: person.name?.split(" ").slice(1).join(" "),
          contact_title: person.title || "Decision Maker",
          contact_email: person.email,
          email_verified: !!person.email,
          score: person.email ? Math.max(l.score, 4) : l.score,
          status: "queued",
        }));
        await loadData();
      } catch(err) {
        console.error("Enrich failed:", err.message);
      }
    } else {
      await new Promise(r=>setTimeout(r,1500));
      fallbackEnrich(leadId);
    }
    setEnrich(null);
  }, [backendOk]);

  const fallbackEnrich = (leadId) => {
    setLeads(ls => ls.map(l => l.id!==leadId ? l : {
      ...l, first_name:"Alex", last_name:"Chen", contact_title:"CTO",
      contact_email:`alex@${l.domain}`, email_verified:true, score:l.score+2, status:"queued",
    }));
  };

  const handleClearDb = () => setLeads([]);

  const NAV = [
    { id:"dashboard", label:"Dashboard", icon:"📊" },
    { id:"scraper",   label:"Scraper",   icon:"🔍" },
    { id:"leads",     label:"Leads",     icon:"🎯" },
    { id:"apollo",    label:"Apollo.io", icon:"🚀" },
    { id:"campaigns", label:"Campaigns", icon:"📧" },
    { id:"settings",  label:"Settings",  icon:"⚙️" },
  ];

  return (
    <div style={{ minHeight:"100vh", display:"flex", flexDirection:"column" }}>
      {/* Header */}
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"0 24px", height:56, display:"flex", alignItems:"center", gap:16, position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 3px rgba(0,0,0,.06)" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:8 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:"linear-gradient(135deg,var(--accent),var(--accent2))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>⚡</div>
          <span style={{ fontWeight:800, fontSize:15, letterSpacing:-.3, color:"var(--text)" }}>HireRadar</span>
          <span style={{ fontSize:10, fontWeight:700, background:"var(--accent)", color:"#fff", borderRadius:4, padding:"1px 5px", fontFamily:"var(--mono)", marginLeft:2 }}>v1.1</span>
        </div>
        <nav style={{ display:"flex", gap:2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={()=>setView(n.id)} style={{
              background:view===n.id?"#dbeafe":"transparent",
              color:view===n.id?"var(--accent)":"var(--muted)",
              border:`1px solid ${view===n.id?"#93c5fd":"transparent"}`,
              borderRadius:6, padding:"4px 12px", cursor:"pointer",
              fontFamily:"var(--font)", fontWeight:600, fontSize:12,
              display:"flex", alignItems:"center", gap:4, transition:"all .15s",
            }}>{n.icon} {n.label}</button>
          ))}
        </nav>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:10 }}>
          {backendOk!==null && (
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:20, background:backendOk?"#dcfce7":"#fef3c7", border:`1px solid ${backendOk?"#16a34a30":"#d9770630"}` }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:backendOk?"var(--accent3)":"var(--warn)", animation:"pulse-dot 2s infinite" }} />
              <span style={{ fontSize:10, color:backendOk?"var(--accent3)":"var(--warn)", fontWeight:700 }}>{backendOk?"BACKEND LIVE":"DEMO MODE"}</span>
            </div>
          )}
        </div>
      </div>

      {!backendOk && backendOk!==null && (
        <div style={{ background:"#fef3c7", borderBottom:"1px solid #f59e0b30", padding:"8px 24px", fontSize:12, color:"#92400e" }}>
          ⚠️ Backend offline — running in demo mode. Deploy the backend to Railway to connect live data.
        </div>
      )}

      <main style={{ flex:1, padding:"28px 24px 60px", maxWidth:1200, width:"100%", margin:"0 auto" }}>
        {view==="dashboard" && <DashboardView stats={stats} leads={leads} />}
        {view==="scraper"   && <ScraperView backendOk={backendOk} onLeadsRefresh={loadData} settings={settings} />}
        {view==="leads"     && <LeadsView leads={leads} onEnrich={handleEnrich} enriching={enriching} onClearDb={handleClearDb} backendOk={backendOk} />}
        {view==="apollo"    && <ApolloView settings={settings} leads={leads} />}
        {view==="campaigns" && <CampaignView leads={leads} backendOk={backendOk} settings={settings} />}
        {view==="settings"  && <SettingsView settings={settings} onSave={saveSettings} settingsLoaded={settingsLoaded} />}
      </main>
    </div>
  );
}
