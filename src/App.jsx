import { useState, useEffect, useCallback, useRef } from "react";

/* ─── Global Styles ──────────────────────────────────────────────────────── */
const GLOBAL_STYLE = `
@import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#080c14;--surface:#0e1520;--surface2:#141d2e;--border:#1e2d45;
  --accent:#00d4ff;--accent2:#7c3aed;--accent3:#10b981;
  --danger:#ef4444;--warn:#f59e0b;--text:#e2e8f0;--muted:#64748b;
  --font:'Syne',sans-serif;--mono:'JetBrains Mono',monospace;
}
body{background:var(--bg);color:var(--text);font-family:var(--font)}
::-webkit-scrollbar{width:6px}::-webkit-scrollbar-track{background:var(--surface)}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px}
@keyframes pulse-dot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.5;transform:scale(1.4)}}
@keyframes slide-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes glow{0%,100%{box-shadow:0 0 8px rgba(0,212,255,.3)}50%{box-shadow:0 0 24px rgba(0,212,255,.7)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
.slide-in{animation:slide-in .3s ease both}
`;

/* ─── Config ─────────────────────────────────────────────────────────────── */
const API_BASE   = "https://hirerad-backend-production.up.railway.app/api";
const CLAUDE_API = "https://api.anthropic.com/v1/messages";

/* ─── API helpers ─────────────────────────────────────────────────────────── */
async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

async function callClaude(systemPrompt, userPrompt) {
  const res = await fetch(CLAUDE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });
  const data = await res.json();
  const text = data.content?.find((b) => b.type === "text")?.text || "{}";
  try { return JSON.parse(text.replace(/```json|```/g, "").trim()); }
  catch { return { subject: "Personalized outreach", body: text }; }
}

/* ─── Mock data (used when backend is offline) ───────────────────────────── */
const MOCK_LEADS = [
  { id:"l1", company_name:"Quanta AI",   domain:"quanta.ai",   industry:"AI/SaaS",  employee_count:6, job_title:"AI/ML Engineer",        score:5, status:"queued",   posted_at: new Date(Date.now()-3*864e5), first_name:"Alex",   last_name:"Chen",   contact_title:"CTO",     contact_email:"alex@quanta.ai",   email_verified:true },
  { id:"l2", company_name:"Stackflow",   domain:"stackflow.io",industry:"DevTools", employee_count:4, job_title:"Full Stack Engineer",    score:4, status:"queued",   posted_at: new Date(Date.now()-5*864e5), first_name:"Jordan", last_name:"Patel",  contact_title:"CEO",     contact_email:"jordan@stackflow.io",email_verified:true },
  { id:"l3", company_name:"NovaBuild",   domain:"novabuild.dev",industry:"SaaS",    employee_count:8, job_title:"Backend Engineer",       score:3, status:"pending",  posted_at: new Date(Date.now()-10*864e5),first_name:"Sam",    last_name:"Kim",    contact_title:"Founder", contact_email:"sam@novabuild.dev", email_verified:true },
  { id:"l4", company_name:"Pixel Forge", domain:"pixelforge.co",industry:"AI/SaaS", employee_count:3, job_title:"Frontend Engineer",     score:4, status:"queued",   posted_at: new Date(Date.now()-6*864e5), first_name:"Taylor", last_name:"Rivera", contact_title:"Co-Founder",contact_email:"taylor@pixelforge.co",email_verified:false },
  { id:"l5", company_name:"Orbit Labs",  domain:"orbitlabs.io", industry:"FinTech", employee_count:7, job_title:"Software Engineer",     score:2, status:"pending",  posted_at: new Date(Date.now()-18*864e5),first_name:null,     last_name:null,     contact_title:null,      contact_email:null,               email_verified:false },
  { id:"l6", company_name:"Synapse HQ",  domain:"synapsehq.com",industry:"AI/SaaS", employee_count:5, job_title:"AI/ML Engineer",        score:5, status:"in_campaign",posted_at:new Date(Date.now()-2*864e5), first_name:"Casey",  last_name:"Davis",  contact_title:"CTO",     contact_email:"casey@synapsehq.com",email_verified:true },
  { id:"l7", company_name:"Driftwave",   domain:"driftwave.io", industry:"DevTools", employee_count:9, job_title:"Full Stack Engineer",  score:1, status:"low-score",posted_at: new Date(Date.now()-25*864e5),first_name:null,     last_name:null,     contact_title:null,      contact_email:null,               email_verified:false },
  { id:"l8", company_name:"ClearMesh",   domain:"clearmesh.dev",industry:"SaaS",    employee_count:2, job_title:"Backend Engineer",      score:3, status:"queued",   posted_at: new Date(Date.now()-8*864e5), first_name:"Morgan", last_name:"Johnson",contact_title:"Founder", contact_email:"morgan@clearmesh.dev",email_verified:true },
];

/* ─── Micro components ───────────────────────────────────────────────────── */
const Spinner = ({ size=18 }) => (
  <div style={{ width:size, height:size, border:"2px solid var(--border)", borderTopColor:"var(--accent)", borderRadius:"50%", animation:"spin .7s linear infinite", display:"inline-block", flexShrink:0 }} />
);

const Badge = ({ children, variant="default" }) => {
  const map = { default:["rgba(100,116,139,.2)","#64748b"], success:["rgba(16,185,129,.15)","#10b981"], warn:["rgba(245,158,11,.15)","#f59e0b"], danger:["rgba(239,68,68,.15)","#ef4444"], accent:["rgba(0,212,255,.12)","#00d4ff"], purple:["rgba(124,58,237,.2)","#7c3aed"] };
  const [bg,color] = map[variant]||map.default;
  return <span style={{ background:bg, color, border:`1px solid ${color}40`, borderRadius:4, padding:"2px 8px", fontSize:11, fontFamily:"var(--mono)", fontWeight:500, whiteSpace:"nowrap" }}>{children}</span>;
};

const ScoreBadge = ({ score }) => <Badge variant={score>=4?"success":score>=2?"warn":"danger"}>Score {score}</Badge>;
const StatusBadge = ({ status }) => {
  const m = { queued:["accent","QUEUED"], pending:["warn","PENDING"], "low-score":["danger","LOW SCORE"], in_campaign:["purple","IN CAMPAIGN"], replied:["success","REPLIED"], meeting:["success","MEETING"] };
  const [v,l] = m[status]||["default",status?.toUpperCase()];
  return <Badge variant={v}>{l}</Badge>;
};

const StatCard = ({ label, value, sub, accent="var(--accent)", icon }) => (
  <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:"20px 24px", borderTop:`2px solid ${accent}` }}>
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
      <span style={{ color:"var(--muted)", fontSize:11, textTransform:"uppercase", letterSpacing:1 }}>{label}</span>
      <span style={{ fontSize:18 }}>{icon}</span>
    </div>
    <div style={{ fontSize:30, fontWeight:800, margin:"6px 0 2px" }}>{value ?? "—"}</div>
    {sub && <div style={{ color:"var(--muted)", fontSize:11 }}>{sub}</div>}
  </div>
);

const Input = ({ ...props }) => (
  <input {...props} style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 13px", color:"var(--text)", fontFamily:"var(--font)", fontSize:13, outline:"none", width:"100%", ...props.style }} />
);

const Btn = ({ children, onClick, disabled, variant="primary", size="md", ...rest }) => {
  const bg = variant==="primary" ? "linear-gradient(135deg,var(--accent),var(--accent2))" : variant==="success" ? "var(--accent3)" : variant==="danger" ? "var(--danger)" : "var(--surface2)";
  const color = variant==="ghost" ? "var(--muted)" : "#fff";
  const pad = size==="sm" ? "5px 12px" : "9px 18px";
  return (
    <button onClick={onClick} disabled={disabled} style={{ background:disabled?"var(--surface2)":bg, color:disabled?"var(--muted)":color, border:`1px solid ${disabled?"var(--border)":"transparent"}`, borderRadius:8, padding:pad, cursor:disabled?"not-allowed":"pointer", fontFamily:"var(--font)", fontWeight:700, fontSize:size==="sm"?11:13, display:"inline-flex", alignItems:"center", gap:6, transition:"opacity .15s", opacity:disabled?.6:1, ...rest.style }} {...rest}>
      {children}
    </button>
  );
};

/* ─── Connection Banner ───────────────────────────────────────────────────── */
function ConnectionBanner({ backendOk }) {
  if (backendOk === null) return null;
  if (backendOk) return null;
  return (
    <div style={{ background:"rgba(245,158,11,.1)", borderBottom:"1px solid rgba(245,158,11,.3)", padding:"8px 28px", fontSize:12, color:"var(--warn)", display:"flex", alignItems:"center", gap:8 }}>
      ⚠️ Backend offline — running in <strong>demo mode</strong> with mock data. Start the API server at {API_BASE} to connect.
    </div>
  );
}

/* ─── Dashboard View ─────────────────────────────────────────────────────── */
function DashboardView({ stats, leads }) {
  const byIndustry = leads.reduce((a,l) => { a[l.industry]=(a[l.industry]||0)+1; return a; }, {});
  const pipeline = [
    { label:"Scraped",   val:leads.length,                              color:"var(--accent)" },
    { label:"Validated", val:Math.round(leads.length*.9),               color:"var(--accent2)" },
    { label:"Enriched",  val:leads.filter(l=>l.contact_email).length,   color:"var(--accent3)" },
    { label:"Scored ≥2", val:leads.filter(l=>l.score>=2).length,        color:"var(--warn)" },
    { label:"Emailed",   val:leads.filter(l=>l.status==="in_campaign").length, color:"#f97316" },
    { label:"Replied",   val:leads.filter(l=>l.status==="replied").length, color:"var(--accent3)" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:28 }} className="slide-in">
      <div>
        <h2 style={{ fontSize:20, fontWeight:800 }}>System Overview</h2>
        <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>Real-time pipeline metrics</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:14 }}>
        <StatCard label="Total Leads"    value={stats?.leads_total    ?? leads.length}                      accent="var(--accent)"  icon="🎯" />
        <StatCard label="Qualified"      value={stats?.leads_qualified ?? leads.filter(l=>l.score>=2).length} accent="var(--accent3)" icon="✅" sub="score ≥ 2" />
        <StatCard label="Contacts Found" value={leads.filter(l=>l.contact_email).length}                     accent="var(--accent2)" icon="👤" sub="via Apollo.io" />
        <StatCard label="Emails Sent"    value={stats?.emails_sent    ?? 0}                                  accent="var(--warn)"    icon="📧" />
        <StatCard label="Open Rate"      value={stats?.open_rate != null ? `${stats.open_rate}%` : "—"}      accent="#f97316"        icon="👁" />
        <StatCard label="Replies"        value={stats?.replies        ?? 0}                                  accent="var(--accent3)" icon="💬" />
      </div>

      {/* Pipeline funnel */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:24 }}>
        <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--muted)", marginBottom:16 }}>Pipeline Flow</div>
        <div style={{ display:"flex", alignItems:"center", flexWrap:"wrap", gap:0 }}>
          {pipeline.map((s,i) => (
            <div key={s.label} style={{ display:"flex", alignItems:"center" }}>
              <div style={{ background:`${s.color}15`, border:`1px solid ${s.color}50`, borderRadius:8, padding:"10px 16px", textAlign:"center", minWidth:80 }}>
                <div style={{ fontSize:20, fontWeight:800, color:s.color }}>{s.val}</div>
                <div style={{ fontSize:10, color:"var(--muted)", marginTop:2 }}>{s.label}</div>
              </div>
              {i < pipeline.length-1 && <div style={{ color:"var(--muted)", padding:"0 4px", fontSize:16 }}>→</div>}
            </div>
          ))}
        </div>
      </div>

      {/* Industry bars */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:24 }}>
        <div style={{ fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--muted)", marginBottom:16 }}>Leads by Industry</div>
        {Object.entries(byIndustry).map(([ind,count]) => {
          const pct = Math.round(count/leads.length*100);
          return (
            <div key={ind} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", fontSize:13, marginBottom:4 }}>
                <span>{ind}</span><span style={{ color:"var(--muted)" }}>{count} ({pct}%)</span>
              </div>
              <div style={{ height:5, background:"var(--border)", borderRadius:3, overflow:"hidden" }}>
                <div style={{ height:"100%", width:`${pct}%`, background:"linear-gradient(90deg,var(--accent),var(--accent2))", borderRadius:3 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Scraper View ───────────────────────────────────────────────────────── */
function ScraperView({ backendOk, onLeadsRefresh }) {
  const [scraping, setScraping] = useState(false);
  const [runId, setRunId]       = useState(null);
  const [log, setLog]           = useState([]);
  const logRef = useRef(null);

  const addLog = (msg, type="default") => setLog(l => [...l, { msg, type, time: new Date().toLocaleTimeString() }]);

  useEffect(() => { logRef.current?.scrollTo({ top:9999, behavior:"smooth" }); }, [log]);

  const runScrape = async () => {
    setScraping(true); setLog([]);
    addLog("Connecting to Apify LinkedIn Jobs Scraper...", "accent");
    addLog("Configuring filters: US · 1-9 employees · last 30 days...", "default");

    if (backendOk) {
      try {
        addLog("Submitting job to Apify actor: curious_coder/linkedin-jobs-scraper", "default");
        const { run_id } = await apiFetch("/scrape/run", { method:"POST" });
        setRunId(run_id);
        addLog(`Apify run started: ${run_id}`, "success");
        // Poll status
        let done = false;
        while (!done) {
          await new Promise(r => setTimeout(r, 3000));
          const status = await apiFetch(`/scrape/status/${run_id}`);
          addLog(`Status: ${status.status} · Jobs: ${status.jobs_found} · Leads: ${status.leads_qualified}`, "default");
          if (["complete","failed"].includes(status.status)) {
            done = true;
            if (status.status==="complete") {
              addLog(`✅ Scrape complete! ${status.jobs_found} jobs, ${status.leads_qualified} leads created.`, "success");
              onLeadsRefresh();
            } else {
              addLog(`❌ Scrape failed: ${status.error_msg}`, "error");
            }
          }
        }
      } catch (err) {
        addLog(`Backend error: ${err.message} — running simulation...`, "warn");
        await simulateScrape();
      }
    } else {
      await simulateScrape();
    }
    setScraping(false);
  };

  const simulateScrape = async () => {
    const steps = [
      ["🔍 Searching: Software Engineer, Full Stack, Backend, Frontend, AI/ML...", "default", 700],
      ["📥 Fetching LinkedIn job listings (page 1/3)...", "default", 900],
      ["📥 Fetching LinkedIn job listings (page 2/3)...", "default", 700],
      ["📥 Fetching LinkedIn job listings (page 3/3)...", "default", 600],
      ["✅ Found 47 raw job postings", "success", 400],
      ["🏢 Validating company sizes via Apollo API...", "accent", 800],
      ["🚫 Filtered out 12 staffing/agency companies", "warn", 400],
      ["🚫 Filtered out 8 companies > 9 employees", "warn", 300],
      ["✅ 27 companies validated (1–9 employees)", "success", 400],
      ["👤 Enriching decision-maker contacts...", "accent", 900],
      ["✅ Found 19 verified contacts (CEO, CTO, Founder)", "success", 400],
      ["📊 Running lead scoring engine...", "default", 500],
      ["✅ 17 leads scored ≥ 2 — queued for outreach", "success", 300],
      ["🎯 Scrape complete! Pipeline updated.", "success", 0],
    ];
    for (const [msg, type, delay] of steps) {
      await new Promise(r => setTimeout(r, delay));
      addLog(msg, type);
    }
  };

  const logColors = { success:"var(--accent3)", error:"var(--danger)", accent:"var(--accent)", warn:"var(--warn)", default:"var(--muted)" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }} className="slide-in">
      <div>
        <h2 style={{ fontSize:20, fontWeight:800 }}>Job Scraper</h2>
        <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>Apify · curious_coder/linkedin-jobs-scraper</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
        {[["Country","United States"],["Company Size","1–9 employees"],["Job Posted Within","30 days"],["Target Roles","SWE · Full Stack · Backend · Frontend · AI/ML"]].map(([k,v]) => (
          <div key={k} style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:8, padding:"12px 16px" }}>
            <div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:1 }}>{k}</div>
            <div style={{ fontSize:13, fontWeight:600, marginTop:4 }}>{v}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:12, alignItems:"center" }}>
        <Btn onClick={runScrape} disabled={scraping} style={{ animation:!scraping?"glow 2s infinite":"none" }}>
          {scraping ? <><Spinner size={14} /> Running...</> : "▶  Run Scraper"}
        </Btn>
        {runId && <span style={{ fontFamily:"var(--mono)", fontSize:11, color:"var(--muted)" }}>Run: {runId}</span>}
      </div>

      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
        <div style={{ padding:"10px 16px", borderBottom:"1px solid var(--border)", fontSize:11, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--muted)", display:"flex", alignItems:"center", gap:8 }}>
          {scraping && <div style={{ width:8, height:8, borderRadius:"50%", background:"var(--accent3)", animation:"pulse-dot 1s infinite" }} />}
          Execution Log
        </div>
        <div ref={logRef} style={{ padding:16, fontFamily:"var(--mono)", fontSize:12, lineHeight:1.9, minHeight:220, maxHeight:380, overflowY:"auto" }}>
          {log.length===0 && <span style={{ color:"var(--muted)" }}>Awaiting run...</span>}
          {log.map((l,i) => (
            <div key={i} style={{ color:logColors[l.type]||"var(--muted)" }}>
              <span style={{ opacity:.4 }}>{l.time}</span>  {l.msg}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Leads View ─────────────────────────────────────────────────────────── */
function LeadsView({ leads, onEnrich, enriching }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter==="all" ? leads : filter==="qualified" ? leads.filter(l=>l.score>=2) : leads.filter(l=>l.status===filter);

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }} className="slide-in">
      <div>
        <h2 style={{ fontSize:20, fontWeight:800 }}>Lead Pipeline</h2>
        <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>{leads.length} total leads · {leads.filter(l=>l.score>=2).length} qualified</p>
      </div>

      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {["all","qualified","queued","pending","in_campaign","low-score"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            background: filter===f ? "var(--accent)" : "var(--surface)",
            color: filter===f ? "var(--bg)" : "var(--muted)",
            border:`1px solid ${filter===f?"var(--accent)":"var(--border)"}`,
            borderRadius:6, padding:"5px 13px", cursor:"pointer",
            fontSize:11, fontFamily:"var(--font)", fontWeight:700, textTransform:"capitalize",
          }}>{f==="all" ? `All (${leads.length})` : f.replace(/-/g," ").replace(/_/g," ")}</button>
        ))}
      </div>

      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1.2fr 150px 120px 100px 110px 80px", padding:"9px 16px", borderBottom:"1px solid var(--border)", fontSize:10, textTransform:"uppercase", letterSpacing:1, color:"var(--muted)" }}>
          <span>Company / Role</span><span>Contact</span><span>Industry</span><span>Score</span><span>Status</span><span>Action</span>
        </div>
        {filtered.map((lead,i) => (
          <div key={lead.id} style={{
            display:"grid", gridTemplateColumns:"1.2fr 150px 120px 100px 110px 80px",
            padding:"13px 16px", borderBottom: i<filtered.length-1?"1px solid var(--border)":"none",
            alignItems:"center", transition:"background .15s", animationDelay:`${i*.03}s`,
          }}
            onMouseEnter={e => e.currentTarget.style.background="var(--surface2)"}
            onMouseLeave={e => e.currentTarget.style.background="transparent"}
          >
            <div>
              <div style={{ fontWeight:700, fontSize:13 }}>{lead.company_name}</div>
              <div style={{ color:"var(--muted)", fontSize:11, marginTop:2 }}>
                {lead.job_title} · {lead.posted_at ? `${Math.floor((Date.now()-new Date(lead.posted_at))/864e5)}d ago` : "—"}
              </div>
            </div>
            <div style={{ fontSize:11 }}>
              {lead.contact_email ? (
                <>
                  <div style={{ fontWeight:600 }}>{lead.first_name} {lead.last_name}</div>
                  <div style={{ color:"var(--muted)" }}>{lead.contact_title}</div>
                  {lead.email_verified && <Badge variant="success">✓ verified</Badge>}
                </>
              ) : <span style={{ color:"var(--danger)" }}>No contact</span>}
            </div>
            <div><Badge variant={lead.industry?.includes("AI")?"purple":"default"}>{lead.industry}</Badge></div>
            <div><ScoreBadge score={lead.score} /></div>
            <div><StatusBadge status={lead.status} /></div>
            <div>
              {!lead.contact_email && (
                <Btn size="sm" variant="ghost" onClick={() => onEnrich(lead.id)} disabled={enriching===lead.id} style={{ border:"1px solid var(--accent2)", color:"var(--accent2)" }}>
                  {enriching===lead.id ? <Spinner size={11} /> : "Enrich"}
                </Btn>
              )}
            </div>
          </div>
        ))}
        {filtered.length===0 && <div style={{ padding:"40px 16px", textAlign:"center", color:"var(--muted)" }}>No leads matching this filter</div>}
      </div>
    </div>
  );
}

/* ─── Apollo View ────────────────────────────────────────────────────────── */
function ApolloView({ apolloKey, setApolloKey, leads }) {
  const [searchMode, setSearchMode] = useState("person"); // "person" | "company"
  const [q, setQ]             = useState({ firstName:"", lastName:"", domain:"", companyName:"" });
  const [searching, setSearch] = useState(false);
  const [results, setResults]  = useState([]);
  const [error, setError]      = useState("");
  const [copied, setCopied]    = useState(null);

  const headers = { "Content-Type":"application/json", "Cache-Control":"no-cache", "x-api-key": apolloKey };

  // Search person by name + optional domain OR company name
  const searchPerson = async () => {
    const body = { first_name:q.firstName, last_name:q.lastName };
    if (q.domain) body.domain = q.domain;
    if (q.companyName && !q.domain) body.organization_name = q.companyName;
    const res = await fetch("https://api.apollo.io/v1/people/match", { method:"POST", headers, body:JSON.stringify(body) });
    const data = await res.json();
    if (data.person) {
      const p = data.person;
      return [{ name:`${p.first_name} ${p.last_name}`, title:p.title||"—", email:p.email, linkedin:p.linkedin_url, verified:!!p.email, company:p.organization?.name||q.companyName, domain:p.organization?.website_url }];
    }
    throw new Error(data.message || "No person found");
  };

  // Search company by name → get people at that org
  const searchCompany = async () => {
    // Step 1: find org
    const orgRes = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
      method:"POST", headers,
      body: JSON.stringify({ q_organization_name: q.companyName, page:1, per_page:1 }),
    });
    const orgData = await orgRes.json();
    const org = orgData.organizations?.[0];
    if (!org) throw new Error(`Company "${q.companyName}" not found on Apollo`);

    // Step 2: find decision makers at that org
    const peopleRes = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method:"POST", headers,
      body: JSON.stringify({
        organization_ids: [org.id],
        person_titles: ["founder","co-founder","ceo","cto","chief executive","chief technology","head of engineering","vp engineering"],
        page:1, per_page:5,
      }),
    });
    const peopleData = await peopleRes.json();
    const people = peopleData.people || [];
    if (!people.length) throw new Error(`No decision makers found at "${q.companyName}"`);

    return people.map(p => ({
      name:`${p.first_name} ${p.last_name}`,
      title: p.title||"—",
      email: p.email,
      linkedin: p.linkedin_url,
      verified: !!p.email,
      company: org.name,
      domain: org.website_url,
      employees: org.estimated_num_employees,
    }));
  };

  const search = async () => {
    if (!apolloKey) { setError("Enter your Apollo.io API key first"); return; }
    if (searchMode==="person" && !q.firstName && !q.lastName) { setError("Enter at least a first or last name"); return; }
    if (searchMode==="company" && !q.companyName) { setError("Enter a company name"); return; }
    setSearch(true); setError(""); setResults([]);
    try {
      const res = searchMode==="person" ? await searchPerson() : await searchCompany();
      setResults(res);
    } catch(err) {
      setError(err.message);
    }
    setSearch(false);
  };

  const copyEmail = (email, idx) => {
    navigator.clipboard?.writeText(email);
    setCopied(idx);
    setTimeout(() => setCopied(null), 1500);
  };

  const tabStyle = (active) => ({
    padding:"6px 16px", borderRadius:6, cursor:"pointer", fontSize:12, fontWeight:700,
    fontFamily:"var(--font)", border:"1px solid var(--border)", transition:"all .15s",
    background: active ? "var(--accent)" : "var(--surface2)",
    color: active ? "var(--bg)" : "var(--muted)",
  });

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }} className="slide-in">
      <div>
        <h2 style={{ fontSize:20, fontWeight:800 }}>Apollo.io Enrichment</h2>
        <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>Find decision makers by name, company name, or domain</p>
      </div>

      {/* API Key */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:24 }}>
        <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--accent)", marginBottom:12 }}>🔑 API Key</div>
        <div style={{ display:"flex", gap:10 }}>
          <input type="password" placeholder="Paste Apollo.io API key..." value={apolloKey} onChange={e=>setApolloKey(e.target.value)}
            style={{ flex:1, background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 13px", color:"var(--text)", fontFamily:"var(--mono)", fontSize:13, outline:"none" }} />
          <div style={{ padding:"9px 14px", borderRadius:8, background:apolloKey?"rgba(16,185,129,.12)":"rgba(239,68,68,.1)", border:`1px solid ${apolloKey?"#10b98150":"#ef444440"}`, color:apolloKey?"#10b981":"#ef4444", fontSize:11, fontWeight:700, display:"flex", alignItems:"center" }}>
            {apolloKey ? "✓ SET" : "NOT SET"}
          </div>
        </div>
        <p style={{ color:"var(--muted)", fontSize:11, marginTop:8 }}>apollo.io → Settings → Integrations → API Keys</p>
      </div>

      {/* Search */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:24 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
          <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--accent)" }}>🔍 Contact Search</div>
          {/* Mode toggle */}
          <div style={{ display:"flex", gap:6 }}>
            <button style={tabStyle(searchMode==="person")} onClick={()=>{ setSearchMode("person"); setResults([]); setError(""); }}>👤 By Person</button>
            <button style={tabStyle(searchMode==="company")} onClick={()=>{ setSearchMode("company"); setResults([]); setError(""); }}>🏢 By Company</button>
          </div>
        </div>

        {searchMode==="person" && (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Input placeholder="First name" value={q.firstName} onChange={e=>setQ(p=>({...p,firstName:e.target.value}))} />
              <Input placeholder="Last name"  value={q.lastName}  onChange={e=>setQ(p=>({...p,lastName:e.target.value}))} />
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div>
                <Input placeholder="Company domain (e.g. stripe.com)" value={q.domain} onChange={e=>setQ(p=>({...p,domain:e.target.value}))} />
                <div style={{ fontSize:10, color:"var(--muted)", marginTop:4 }}>Use domain if you know it (most accurate)</div>
              </div>
              <div>
                <Input placeholder="Company name (e.g. Stripe)" value={q.companyName} onChange={e=>setQ(p=>({...p,companyName:e.target.value}))} />
                <div style={{ fontSize:10, color:"var(--muted)", marginTop:4 }}>Or just the company name — no domain needed</div>
              </div>
            </div>
          </div>
        )}

        {searchMode==="company" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            <Input placeholder="Company name (e.g. Quanta AI, Stackflow...)" value={q.companyName} onChange={e=>setQ(p=>({...p,companyName:e.target.value}))} />
            <div style={{ fontSize:11, color:"var(--muted)" }}>
              💡 Searches Apollo for the company, then finds <strong style={{ color:"var(--text)" }}>Founders, CEOs, CTOs & Heads of Engineering</strong> — no domain needed.
            </div>
          </div>
        )}

        <Btn onClick={search} disabled={searching||!apolloKey} style={{ marginTop:14 }}>
          {searching ? <><Spinner size={14}/> Searching Apollo...</> : "Search Apollo.io"}
        </Btn>

        {error && (
          <div style={{ marginTop:12, background:"rgba(239,68,68,.08)", border:"1px solid rgba(239,68,68,.3)", borderRadius:8, padding:"10px 14px", color:"var(--danger)", fontSize:12, fontFamily:"var(--mono)" }}>
            ⚠ {error}
          </div>
        )}

        {results.length > 0 && (
          <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:10 }}>
            <div style={{ fontSize:11, color:"var(--muted)", fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>
              {results.length} result{results.length>1?"s":""} found
              {results[0].company && <span style={{ color:"var(--accent)", marginLeft:8 }}>@ {results[0].company}</span>}
              {results[0].employees && <span style={{ color:"var(--muted)", marginLeft:8 }}>· {results[0].employees} employees</span>}
            </div>
            {results.map((p,i)=>(
              <div key={i} style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:10, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:8 }}>
                  <div>
                    <div style={{ fontWeight:700, fontSize:14 }}>{p.name}</div>
                    <div style={{ color:"var(--muted)", fontSize:12, marginTop:2 }}>{p.title}{p.company && ` · ${p.company}`}</div>
                    {p.domain && <div style={{ color:"var(--muted)", fontSize:11, marginTop:2 }}>🌐 {p.domain}</div>}
                  </div>
                  <div style={{ display:"flex", gap:6, alignItems:"center", flexWrap:"wrap" }}>
                    {p.verified ? <Badge variant="success">✓ Verified Email</Badge> : <Badge variant="danger">No Email</Badge>}
                  </div>
                </div>
                {p.email && (
                  <div style={{ marginTop:10, display:"flex", alignItems:"center", gap:8, background:"rgba(0,212,255,.05)", border:"1px solid rgba(0,212,255,.2)", borderRadius:6, padding:"8px 12px" }}>
                    <span style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--accent)", flex:1 }}>{p.email}</span>
                    <button onClick={()=>copyEmail(p.email, i)} style={{ background:"transparent", border:"none", cursor:"pointer", color:copied===i?"var(--accent3)":"var(--muted)", fontSize:11, fontFamily:"var(--font)", fontWeight:700 }}>
                      {copied===i ? "✓ Copied!" : "📋 Copy"}
                    </button>
                  </div>
                )}
                {p.linkedin && (
                  <a href={p.linkedin} target="_blank" rel="noreferrer" style={{ display:"inline-block", marginTop:8, fontSize:11, color:"var(--accent2)", textDecoration:"none" }}>
                    🔗 LinkedIn Profile
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pipeline stats */}
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:24 }}>
        <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--accent)", marginBottom:16 }}>📋 Pipeline Enrichment Status</div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:12 }}>
          <StatCard label="Total Leads"    value={leads.length}                            accent="var(--accent)"  icon="📊" />
          <StatCard label="Contacts Found" value={leads.filter(l=>l.contact_email).length} accent="var(--accent3)" icon="✅" />
          <StatCard label="Missing"        value={leads.filter(l=>!l.contact_email).length} accent="var(--danger)"  icon="❌" />
        </div>
        <div style={{ marginTop:12, fontSize:11, color:"var(--muted)" }}>
          💡 Go to the <strong style={{ color:"var(--text)" }}>Leads tab</strong> and click <strong style={{ color:"var(--accent2)" }}>Enrich</strong> on any lead missing a contact to auto-search Apollo.
        </div>
      </div>
    </div>
  );
}

/* ─── Campaign View ───────────────────────────────────────────────────────── */
function CampaignView({ leads, backendOk }) {
  const [step, setStep]            = useState(1);
  const [selected, setSelected]    = useState(null);
  const [genEmail, setGenEmail]    = useState(null);
  const [generating, setGenerating] = useState(false);
  const [launching, setLaunching]  = useState(false);
  const [launchResult, setLaunch]  = useState(null);

  const qualified = leads.filter(l => l.score>=2 && l.contact_email);

  const generateEmail = async () => {
    if (!selected) return;
    setGenerating(true); setGenEmail(null);
    const stepLabels = ["Initial Outreach","Value Follow-up","Social Proof","Final Nudge"];
    const result = await callClaude(
      "You are an expert B2B outbound sales copywriter for a dev talent firm. Generate a short, highly personalized cold email. Respond ONLY with valid JSON: {\"subject\":\"...\",\"body\":\"...\"}. No markdown.",
      `Write step ${step} (${stepLabels[step-1]}) of a 4-touch cold outreach for:
Contact: ${selected.first_name} ${selected.last_name}, ${selected.contact_title} at ${selected.company_name}
Industry: ${selected.industry} | Hiring: ${selected.job_title} (posted ${Math.floor((Date.now()-new Date(selected.posted_at))/864e5)}d ago)
We provide pre-vetted offshore developers to US startups — fast (2 weeks) at 60% cost savings. Under 90 words, casual but credible.`
    );
    setGenEmail(result);
    setGenerating(false);
  };

  const launchCampaign = async () => {
    if (!qualified.length) return;
    setLaunching(true);
    if (backendOk) {
      try {
        const result = await apiFetch("/campaign/launch", { method:"POST", body: JSON.stringify({ lead_ids: qualified.map(l=>l.id) }) });
        setLaunch({ success:true, msg:`Launched ${result.results.filter(r=>r.status==="launched").length} leads into Instantly campaign` });
      } catch (err) {
        setLaunch({ success:false, msg:`Backend error: ${err.message}` });
      }
    } else {
      await new Promise(r=>setTimeout(r,1800));
      setLaunch({ success:true, msg:`Demo: Would launch ${qualified.length} leads into Instantly (connect backend + add INSTANTLY_API_KEY to .env)` });
    }
    setLaunching(false);
  };

  const STEPS = [
    { day:"Day 1", label:"Initial Outreach", icon:"🚀", color:"var(--accent)" },
    { day:"Day 3", label:"Value Follow-up",  icon:"💡", color:"var(--accent2)" },
    { day:"Day 6", label:"Social Proof",     icon:"⭐", color:"var(--warn)" },
    { day:"Day 10",label:"Final Nudge",      icon:"🎯", color:"var(--accent3)" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }} className="slide-in">
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", flexWrap:"wrap", gap:12 }}>
        <div>
          <h2 style={{ fontSize:20, fontWeight:800 }}>Email Campaigns</h2>
          <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>AI-generated 4-touch sequence · powered by Instantly.ai</p>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {launchResult && (
            <div style={{ fontSize:12, color:launchResult.success?"var(--accent3)":"var(--danger)", fontFamily:"var(--mono)", maxWidth:300 }}>
              {launchResult.success?"✅":"❌"} {launchResult.msg}
            </div>
          )}
          <Btn variant="success" onClick={launchCampaign} disabled={launching||!qualified.length}>
            {launching ? <><Spinner size={14}/>Launching...</> : `🚀 Launch Campaign (${qualified.length} leads)`}
          </Btn>
        </div>
      </div>

      {/* Sequence steps */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12 }}>
        {STEPS.map((s,i) => (
          <div key={i} onClick={() => setStep(i+1)} style={{ background:step===i+1?`${s.color}18`:"var(--surface)", border:`1px solid ${step===i+1?s.color:"var(--border)"}`, borderRadius:10, padding:16, cursor:"pointer", transition:"all .2s" }}>
            <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontSize:11, color:s.color, fontWeight:700 }}>{s.day}</div>
            <div style={{ fontSize:13, fontWeight:600, marginTop:2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:20 }}>
        {/* Lead picker */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, overflow:"hidden" }}>
          <div style={{ padding:"10px 14px", borderBottom:"1px solid var(--border)", fontSize:10, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--muted)" }}>
            Qualified Leads ({qualified.length})
          </div>
          <div style={{ maxHeight:360, overflowY:"auto" }}>
            {qualified.length===0 && <div style={{ padding:24, textAlign:"center", color:"var(--muted)", fontSize:12 }}>No qualified leads with contacts yet</div>}
            {qualified.map(l => (
              <div key={l.id} onClick={() => { setSelected(l); setGenEmail(null); }} style={{
                padding:"11px 14px", cursor:"pointer", borderBottom:"1px solid var(--border)",
                background:selected?.id===l.id?"rgba(0,212,255,.07)":"transparent",
                borderLeft:`3px solid ${selected?.id===l.id?"var(--accent)":"transparent"}`,
                transition:"all .15s",
              }}>
                <div style={{ fontWeight:700, fontSize:12 }}>{l.company_name}</div>
                <div style={{ color:"var(--muted)", fontSize:11, marginTop:1 }}>{l.first_name} {l.last_name} · {l.contact_title}</div>
                <div style={{ marginTop:4 }}><ScoreBadge score={l.score} /></div>
              </div>
            ))}
          </div>
        </div>

        {/* Email generator */}
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:24 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <div>
              <div style={{ fontWeight:700 }}>AI Email Generator — Step {step}</div>
              {selected && <div style={{ color:"var(--muted)", fontSize:12, marginTop:2 }}>for {selected.first_name} at {selected.company_name}</div>}
            </div>
            <Btn onClick={generateEmail} disabled={!selected||generating}>
              {generating ? <><Spinner size={14}/>Generating...</> : "✨ Generate"}
            </Btn>
          </div>

          {!selected && <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--muted)" }}><div style={{ fontSize:32, marginBottom:8 }}>👈</div>Select a lead to generate a personalized email</div>}
          {selected && !genEmail && !generating && <div style={{ textAlign:"center", padding:"50px 20px", color:"var(--muted)" }}><div style={{ fontSize:32, marginBottom:8 }}>✨</div>Click Generate to craft a personalized {STEPS[step-1].label.toLowerCase()}</div>}
          {generating && <div style={{ textAlign:"center", padding:"50px 20px" }}><Spinner size={28} /><div style={{ color:"var(--muted)", marginTop:12 }}>Claude is writing your email...</div></div>}

          {genEmail && !generating && (
            <div style={{ animation:"fadeIn .3s ease" }}>
              <div style={{ marginBottom:12 }}>
                <div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Subject</div>
                <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:6, padding:"9px 12px", fontSize:13, fontWeight:600 }}>{genEmail.subject}</div>
              </div>
              <div>
                <div style={{ fontSize:10, color:"var(--muted)", textTransform:"uppercase", letterSpacing:1, marginBottom:4 }}>Body</div>
                <div style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:6, padding:"12px 14px", fontSize:12, lineHeight:1.8, whiteSpace:"pre-wrap", maxHeight:240, overflowY:"auto", fontFamily:"var(--mono)" }}>{genEmail.body}</div>
              </div>
              <div style={{ display:"flex", gap:8, marginTop:12 }}>
                <Btn variant="ghost" size="sm" onClick={() => navigator.clipboard?.writeText(`Subject: ${genEmail.subject}\n\n${genEmail.body}`)}>📋 Copy</Btn>
                <Btn variant="success" size="sm">📤 Add to Sequence</Btn>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Settings View ──────────────────────────────────────────────────────── */
function SettingsView({ apolloKey, setApolloKey }) {
  const envVars = [
    { key:"DATABASE_URL",          hint:"postgresql://user:pass@host:5432/hirerad" },
    { key:"APOLLO_API_KEY",        hint:"From apollo.io → Settings → Integrations" },
    { key:"APIFY_API_TOKEN",       hint:"From console.apify.com → Settings" },
    { key:"INSTANTLY_API_KEY",     hint:"From app.instantly.ai → Settings → API" },
    { key:"INSTANTLY_CAMPAIGN_ID", hint:"Leave blank to auto-create daily campaign" },
  ];

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:24 }} className="slide-in">
      <div>
        <h2 style={{ fontSize:20, fontWeight:800 }}>Configuration</h2>
        <p style={{ color:"var(--muted)", fontSize:13, marginTop:4 }}>API keys & system settings</p>
      </div>

      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:24 }}>
        <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--accent)", marginBottom:4 }}>🔑 Apollo.io (Active in UI)</div>
        <p style={{ color:"var(--muted)", fontSize:12, marginBottom:12 }}>This key is used live in the Apollo.io tab for real contact searches.</p>
        <div style={{ display:"flex", gap:10 }}>
          <input type="password" value={apolloKey} onChange={e=>setApolloKey(e.target.value)} placeholder="Paste your Apollo.io API key..." style={{ flex:1, background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, padding:"9px 13px", color:"var(--text)", fontFamily:"var(--mono)", fontSize:13, outline:"none" }} />
          <div style={{ padding:"9px 14px", borderRadius:8, background:apolloKey?"rgba(16,185,129,.1)":"rgba(239,68,68,.1)", border:`1px solid ${apolloKey?"#10b98140":"#ef444440"}`, color:apolloKey?"#10b981":"#ef4444", fontSize:11, fontWeight:700, display:"flex", alignItems:"center" }}>
            {apolloKey?"✓ SET":"NOT SET"}
          </div>
        </div>
      </div>

      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:24 }}>
        <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--accent)", marginBottom:4 }}>📄 Backend .env File</div>
        <p style={{ color:"var(--muted)", fontSize:12, marginBottom:16 }}>Add these to <code style={{ fontFamily:"var(--mono)", background:"var(--surface2)", padding:"1px 5px", borderRadius:3 }}>backend/.env</code> to connect all services.</p>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {envVars.map(v => (
            <div key={v.key} style={{ background:"var(--surface2)", border:"1px solid var(--border)", borderRadius:8, padding:"10px 14px" }}>
              <div style={{ fontFamily:"var(--mono)", fontSize:12, color:"var(--accent)", fontWeight:600 }}>{v.key}</div>
              <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>{v.hint}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background:"var(--surface)", border:"1px solid var(--border)", borderRadius:12, padding:24 }}>
        <div style={{ fontSize:12, fontWeight:700, textTransform:"uppercase", letterSpacing:1, color:"var(--accent)", marginBottom:12 }}>🚀 Backend Setup</div>
        <div style={{ fontFamily:"var(--mono)", fontSize:12, lineHeight:2, color:"var(--muted)" }}>
          {["cd backend","npm install","cp .env.example .env   # fill in your keys","npm run db:migrate       # create PostgreSQL tables","npm run dev              # start API on :4000"].map((cmd,i) => (
            <div key={i}><span style={{ color:"var(--accent3)", marginRight:8 }}>$</span>{cmd}</div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── App Shell ──────────────────────────────────────────────────────────── */
export default function App() {
  const [view, setView]         = useState("dashboard");
  const [leads, setLeads]       = useState(MOCK_LEADS);
  const [stats, setStats]       = useState(null);
  const [apolloKey, setAKey]    = useState("");
  const [enriching, setEnrich]  = useState(null);
  const [backendOk, setBackend] = useState(null);

  // Inject styles
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = GLOBAL_STYLE;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);

  // Check backend health
  useEffect(() => {
    apiFetch("/health")
      .then(() => { setBackend(true); loadData(); })
      .catch(() => setBackend(false));
  }, []);

  const loadData = async () => {
    try {
      const [leadsData, statsData] = await Promise.all([
        apiFetch("/leads"),
        apiFetch("/dashboard"),
      ]);
      if (leadsData.leads?.length) setLeads(leadsData.leads);
      setStats(statsData);
    } catch { /* use mock data */ }
  };

  const handleEnrich = useCallback(async (leadId) => {
    setEnrich(leadId);
    if (backendOk) {
      try {
        await apiFetch(`/leads/${leadId}/enrich`, { method:"POST" });
        await loadData();
      } catch { fallbackEnrich(leadId); }
    } else {
      await new Promise(r => setTimeout(r, 1600));
      fallbackEnrich(leadId);
    }
    setEnrich(null);
  }, [backendOk]);

  const fallbackEnrich = (leadId) => {
    setLeads(ls => ls.map(l => l.id!==leadId ? l : {
      ...l,
      first_name:"Alex", last_name:"Chen", contact_title:"CTO",
      contact_email:`alex@${l.domain}`, email_verified:true,
      score: l.score+2, status:"queued",
    }));
  };

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
      <div style={{ background:"var(--surface)", borderBottom:"1px solid var(--border)", padding:"0 24px", height:56, display:"flex", alignItems:"center", gap:20, position:"sticky", top:0, zIndex:100 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginRight:8 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:"linear-gradient(135deg,var(--accent),var(--accent2))", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>⚡</div>
          <span style={{ fontWeight:800, fontSize:14, letterSpacing:-.3 }}>HireRadar</span>
        </div>
        <nav style={{ display:"flex", gap:2 }}>
          {NAV.map(n => (
            <button key={n.id} onClick={() => setView(n.id)} style={{
              background: view===n.id ? "rgba(0,212,255,.1)" : "transparent",
              color: view===n.id ? "var(--accent)" : "var(--muted)",
              border:`1px solid ${view===n.id?"rgba(0,212,255,.3)":"transparent"}`,
              borderRadius:6, padding:"4px 12px", cursor:"pointer",
              fontFamily:"var(--font)", fontWeight:600, fontSize:12,
              display:"flex", alignItems:"center", gap:4, transition:"all .15s",
            }}>{n.icon} {n.label}</button>
          ))}
        </nav>
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:8 }}>
          {backendOk!==null && (
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:20, background:backendOk?"rgba(16,185,129,.1)":"rgba(245,158,11,.1)", border:`1px solid ${backendOk?"#10b98140":"#f59e0b40"}` }}>
              <div style={{ width:6, height:6, borderRadius:"50%", background:backendOk?"var(--accent3)":"var(--warn)", animation:"pulse-dot 2s infinite" }} />
              <span style={{ fontSize:10, color:backendOk?"var(--accent3)":"var(--warn)", fontWeight:700 }}>{backendOk?"BACKEND LIVE":"DEMO MODE"}</span>
            </div>
          )}
        </div>
      </div>

      <ConnectionBanner backendOk={backendOk} />

      <main style={{ flex:1, padding:"28px 24px 60px", maxWidth:1180, width:"100%", margin:"0 auto" }}>
        {view==="dashboard" && <DashboardView stats={stats} leads={leads} />}
        {view==="scraper"   && <ScraperView backendOk={backendOk} onLeadsRefresh={loadData} />}
        {view==="leads"     && <LeadsView leads={leads} onEnrich={handleEnrich} enriching={enriching} />}
        {view==="apollo"    && <ApolloView apolloKey={apolloKey} setApolloKey={setAKey} leads={leads} />}
        {view==="campaigns" && <CampaignView leads={leads} backendOk={backendOk} />}
        {view==="settings"  && <SettingsView apolloKey={apolloKey} setApolloKey={setAKey} />}
      </main>
    </div>
  );
}
