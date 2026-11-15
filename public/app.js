const $ = s => document.querySelector(s);
const state = { user:null, page:"", jobs:[], profile:null };
const navItems = {
  student:[["dashboard","▦","Dashboard"],["jobs","⌕","Find Jobs"],["applications","▤","My Applications"],["profile","◎","My Profile"]],
  recruiter:[["dashboard","▦","Dashboard"],["post-job","＋","Post a Job"],["manage-jobs","▤","My Job Posts"]],
  admin:[["dashboard","▦","Overview"],["approvals","✓","Job Approvals"],["users","♙","Users"],["drives","▣","Placement Drives"],["reports","▥","Reports"]]
};
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2800)}
async function api(url, options={}) {
  const res=await fetch(url,{credentials:"same-origin",headers:{"Content-Type":"application/json",...(options.headers||{})},...options});
  let data={}; try{data=await res.json()}catch{}
  if(!res.ok) throw new Error(data.error||"Something went wrong.");
  return data;
}
function esc(v){return String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function money(v){return Number(v||0).toLocaleString("en-IN",{maximumFractionDigits:1})}
function pill(v){return `<span class="pill ${String(v).toLowerCase().replaceAll(" ","-")}">${esc(v)}</span>`}
function showAuth(mode="login"){
  $("#authView").classList.remove("hidden");$("#appView").classList.add("hidden");
  document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.auth===mode));
  $("#loginForm").classList.toggle("hidden",mode!=="login");$("#registerForm").classList.toggle("hidden",mode!=="register");
}
function showApp(){
  $("#authView").classList.add("hidden");$("#appView").classList.remove("hidden");
  $("#sideName").textContent=state.user.name;$("#sideRole").textContent=state.user.role;
  $("#avatar").textContent=state.user.name.charAt(0).toUpperCase();$("#topUser").textContent=state.user.name;
  $("#nav").innerHTML=navItems[state.user.role].map(([id,icon,label])=>`<button class="nav-btn ${state.page===id?"active":""}" data-page="${id}"><span>${icon}</span>${label}</button>`).join("");
  $("#nav").querySelectorAll("button").forEach(b=>b.onclick=()=>navigate(b.dataset.page));
}
function setPage(title,eyebrow="CAMPUSCONNECT WORKSPACE"){ $("#pageTitle").textContent=title;$("#pageEyebrow").textContent=eyebrow; }
function welcome(title,sub){return `<div class="welcome"><div><p class="eyebrow">CAMPUSCONNECT</p><h2>${title}</h2><p>${sub}</p></div><div class="welcome-icon">✦</div></div>`}
function stat(label,num,sub="Updated from project database"){return `<div class="stat"><div class="label">${label}</div><div class="num">${num}</div><div class="sub">${sub}</div></div>`}
function panel(title,body,sub=""){return `<section class="panel"><div class="panel-head"><div><h3>${title}</h3>${sub?`<p>${sub}</p>`:""}</div></div>${body}</section>`}
async function navigate(page){
  state.page=page;showApp();
  const titles={dashboard:"Dashboard",jobs:"Find Opportunities",applications:"My Applications",profile:"My Profile","post-job":"Post a Job","manage-jobs":"My Job Posts",approvals:"Job Approvals",users:"User Management",drives:"Placement Drives",reports:"Placement Reports"};
  setPage(titles[page]||"Dashboard");
  try{
    if(state.user.role==="student") await renderStudent(page);
    if(state.user.role==="recruiter") await renderRecruiter(page);
    if(state.user.role==="admin") await renderAdmin(page);
  }catch(e){$("#content").innerHTML=`<div class="panel notice">${esc(e.message)}</div>`;toast(e.message)}
  $("#nav").querySelectorAll("button").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
}
async function renderStudent(page){
  if(page==="dashboard"){
    const [p,a,j]=await Promise.all([api("/api/student/profile"),api("/api/student/applications"),api("/api/jobs")]);
    state.profile=p.profile;
    $("#content").innerHTML=welcome(`Welcome, ${esc(state.user.name.split(" ")[0])}!`,"Your placement journey starts here. Discover opportunities and keep your profile ready.")+
      `<div class="stats">${stat("Available jobs",j.jobs.length)}${stat("Applications",a.applications.length)}${stat("Shortlisted",a.applications.filter(x=>x.status==="Shortlisted"||x.status==="Interview Scheduled").length)}${stat("CGPA",Number(p.profile.cgpa).toFixed(1),"Your academic profile")}</div>`+
      `<div class="grid-2">${panel("Recent opportunities",jobTable(j.jobs.slice(0,4),false),"Latest approved openings")}${panel("Recent applications",applicationTable(a.applications.slice(0,5)),"Track your application progress")}</div>`;
  } else if(page==="jobs"){
    const {jobs}=await api("/api/jobs");state.jobs=jobs;
    $("#content").innerHTML=`<div class="toolbar" style="margin-bottom:16px"><input id="jobSearch" placeholder="Search job title or company"><select id="jobDept"><option value="">All departments</option><option>CSE</option><option>ECE</option><option>EEE</option><option>IT</option></select></div><div id="jobCards" class="jobs-grid"></div>`;
    const draw=()=>{const q=$("#jobSearch").value.toLowerCase(),d=$("#jobDept").value;const list=jobs.filter(j=>(j.title+" "+j.company).toLowerCase().includes(q)&&(!d||j.eligible_department==="All"||j.eligible_department===d));$("#jobCards").innerHTML=list.length?list.map(jobCard).join(""):`<div class="panel empty">No matching opportunities found.</div>`;$("#jobCards").querySelectorAll("[data-apply]").forEach(b=>b.onclick=()=>apply(b.dataset.apply));};
    $("#jobSearch").oninput=draw;$("#jobDept").onchange=draw;draw();
  } else if(page==="applications"){
    const {applications}=await api("/api/student/applications");
    $("#content").innerHTML=panel("Application history",applicationTable(applications),"Your submitted applications and latest status");
  } else if(page==="profile"){
    const {profile:p}=await api("/api/student/profile");state.profile=p;
    $("#content").innerHTML=panel("Academic and personal details",`<form id="profileForm" class="form-grid">
      ${field("Full name","name",p.name,"text")}${field("Roll number","roll_no",p.roll_no)}
      ${field("Department","department",p.department)}${field("CGPA (out of 10)","cgpa",p.cgpa,"number","0.1")}
      ${field("Graduation year","graduation_year",p.graduation_year,"number","1")}${field("Phone","phone",p.phone)}
      <label class="field wide">Skills<input name="skills" value="${esc(p.skills)}" placeholder="Java, Python, HTML, CSS"></label>
      <label class="field wide">Resume link<input name="resume_link" value="${esc(p.resume_link)}" placeholder="https://..."></label>
      <div class="wide"><button class="btn primary">Save profile</button></div></form>`);
    $("#profileForm").onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{await api("/api/student/profile",{method:"PUT",body:JSON.stringify(data)});toast("Profile updated.");}catch(err){toast(err.message)}};
  }
}
function field(label,name,value="",type="text",step=""){return `<label class="field">${label}<input name="${name}" type="${type}" ${step?`step="${step}"`:""} value="${esc(value)}" required></label>`}
function jobCard(j){return `<article class="job-card"><div class="job-top"><div class="company-logo">${esc((j.company||"C").slice(0,1).toUpperCase())}</div>${j.applied?pill("Applied"):j.eligible?pill("Eligible"):pill("Check criteria")}</div><h3>${esc(j.title)}</h3><div class="company">${esc(j.company)}</div><p class="desc">${esc(j.description)}</p><div class="meta"><span>⌖ ${esc(j.location)}</span><span>₹${money(j.package_lpa)} LPA</span><span>CGPA ${esc(j.min_cgpa)}+</span></div><div class="meta"><span>${esc(j.eligible_department)} · Batch ${esc(j.graduation_year)}</span><span>Deadline: ${esc(j.deadline||"Not specified")}</span></div><div class="job-actions"><small class="muted">${j.eligible?"You meet the listed criteria":"Review eligibility criteria"}</small>${j.applied?`<button class="btn secondary small-btn" disabled>Applied</button>`:`<button class="btn ${j.eligible?"primary":"secondary"} small-btn" data-apply="${j.id}" ${j.eligible?"":"disabled"}>Apply now</button>`}</div></article>`}
async function apply(id){try{const r=await api(`/api/jobs/${id}/apply`,{method:"POST",body:"{}"});toast(r.message);navigate("jobs")}catch(e){toast(e.message)}}
function jobTable(jobs,showStatus=true){if(!jobs.length)return `<div class="empty">No records available yet.</div>`;return `<div class="table-wrap"><table><thead><tr><th>POSITION</th><th>COMPANY</th><th>PACKAGE</th>${showStatus?"<th>STATUS</th>":""}</tr></thead><tbody>${jobs.map(j=>`<tr><td><strong>${esc(j.title)}</strong></td><td>${esc(j.company)}</td><td>₹${money(j.package_lpa)} LPA</td>${showStatus?`<td>${pill(j.status)}</td>`:""}</tr>`).join("")}</tbody></table></div>`}
function applicationTable(rows){if(!rows.length)return `<div class="empty">You have not applied to any jobs yet.</div>`;return `<div class="table-wrap"><table><thead><tr><th>POSITION</th><th>COMPANY</th><th>APPLIED ON</th><th>STATUS</th></tr></thead><tbody>${rows.map(a=>`<tr><td><strong>${esc(a.title)}</strong></td><td>${esc(a.company)}</td><td>${esc(a.applied_at)}</td><td>${pill(a.status)}</td></tr>`).join("")}</tbody></table></div>`}

async function renderRecruiter(page){
  if(page==="dashboard"){
    const {jobs}=await api("/api/recruiter/jobs");const total=jobs.reduce((n,j)=>n+j.applicant_count,0);
    $("#content").innerHTML=welcome("Recruiter workspace","Create opportunities and manage candidate applications.")+
      `<div class="stats">${stat("Your job posts",jobs.length)}${stat("Total applicants",total)}${stat("Approved",jobs.filter(j=>j.status==="approved").length)}${stat("Pending approval",jobs.filter(j=>j.status==="pending").length)}</div>`+
      panel("Recent job posts",recruiterJobTable(jobs.slice(0,6)),"Track approval status and applicant volume");
  }else if(page==="post-job"){
    $("#content").innerHTML=panel("Create a job opportunity",`<div class="notice">New job posts are sent to the placement administrator for approval before students can view them.</div><form id="jobForm" class="form-grid">
      ${field("Job title","title")}${field("Company name","company","")}
      <label class="field wide">Job description<textarea name="description" required placeholder="Describe responsibilities and required skills"></textarea></label>
      ${field("Location","location","Hyderabad")}${field("Package (LPA)","package_lpa","4","number","0.1")}
      ${field("Minimum CGPA","min_cgpa","6","number","0.1")}
      <label class="field">Eligible department<select name="eligible_department"><option>All</option><option>CSE</option><option>ECE</option><option>EEE</option><option>IT</option><option>ME</option><option>CE</option></select></label>
      ${field("Graduation year","graduation_year","2027","number","1")}${field("Application deadline","deadline","","date")}
      <div class="wide"><button class="btn primary">Submit for approval</button></div></form>`);
    $("#jobForm").onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target));try{const r=await api("/api/recruiter/jobs",{method:"POST",body:JSON.stringify(data)});toast(r.message);navigate("manage-jobs")}catch(err){toast(err.message)}};
  }else if(page==="manage-jobs"){
    const {jobs}=await api("/api/recruiter/jobs");
    $("#content").innerHTML=panel("Your job postings",recruiterJobTable(jobs),"Open a job to view applicants and update their recruitment status");
    $("#content").querySelectorAll("[data-applicants]").forEach(b=>b.onclick=()=>showApplicants(b.dataset.applicants));
  }
}
function recruiterJobTable(jobs){if(!jobs.length)return `<div class="empty">You have not posted any jobs.</div>`;return `<div class="table-wrap"><table><thead><tr><th>JOB</th><th>PACKAGE</th><th>APPLICANTS</th><th>APPROVAL</th><th>ACTION</th></tr></thead><tbody>${jobs.map(j=>`<tr><td><strong>${esc(j.title)}</strong><br><small>${esc(j.company)}</small></td><td>₹${money(j.package_lpa)} LPA</td><td>${j.applicant_count}</td><td>${pill(j.status)}</td><td><button class="action-link" data-applicants="${j.id}">View applicants</button></td></tr>`).join("")}</tbody></table></div>`}
async function showApplicants(id){try{const {applicants}=await api(`/api/recruiter/jobs/${id}/applicants`);const html=applicants.length?`<div class="table-wrap"><table><thead><tr><th>STUDENT</th><th>ACADEMICS</th><th>SKILLS</th><th>STATUS</th><th>UPDATE</th></tr></thead><tbody>${applicants.map(a=>`<tr><td><strong>${esc(a.name)}</strong><br>${esc(a.email)}<br>${esc(a.roll_no)}</td><td>${esc(a.department)} · CGPA ${esc(a.cgpa)}</td><td>${esc(a.skills)}</td><td>${pill(a.status)}</td><td><select data-status="${a.id}"><option>${esc(a.status)}</option>${["Under Review","Shortlisted","Interview Scheduled","Selected","Rejected"].filter(x=>x!==a.status).map(x=>`<option>${x}</option>`).join("")}</select></td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No applications received for this job yet.</div>`;
    $("#content").innerHTML=panel("Applicants",html,"Change a candidate's recruitment stage using the dropdown.");
    $("#content").querySelectorAll("[data-status]").forEach(sel=>sel.onchange=async()=>{try{await api(`/api/recruiter/applications/${sel.dataset.status}`,{method:"PATCH",body:JSON.stringify({status:sel.value})});toast("Application status updated.");}catch(e){toast(e.message)}});
  }catch(e){toast(e.message)}}

async function renderAdmin(page){
  if(page==="dashboard"){
    const {stats}=await api("/api/admin/overview");
    $("#content").innerHTML=welcome("Placement administration","Monitor recruitment activity and keep the campus placement process organized.")+
      `<div class="stats">${stat("Students",stats.students)}${stat("Recruiters",stats.recruiters)}${stat("Job postings",stats.jobs)}${stat("Applications",stats.applications)}</div>
      <div class="stats">${stat("Pending approvals",stats.pendingJobs)}${stat("Selected candidates",stats.selected)}</div>`+
      `<div class="notice">Review pending recruiter submissions regularly. Only approved job posts are visible to students.</div>`;
  }else if(page==="approvals"){
    const {jobs}=await api("/api/admin/jobs");
    $("#content").innerHTML=panel("Review job postings",adminJobTable(jobs),"Approve or reject recruiter-submitted opportunities");
    $("#content").querySelectorAll("[data-job-action]").forEach(b=>b.onclick=async()=>{try{await api(`/api/admin/jobs/${b.dataset.id}`,{method:"PATCH",body:JSON.stringify({status:b.dataset.jobAction})});toast(`Job ${b.dataset.jobAction}.`);navigate("approvals")}catch(e){toast(e.message)}});
  }else if(page==="users"){
    const {users}=await api("/api/admin/users");
    $("#content").innerHTML=panel("Registered users",`<div class="table-wrap"><table><thead><tr><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>CREATED</th></tr></thead><tbody>${users.map(u=>`<tr><td><strong>${esc(u.name)}</strong></td><td>${esc(u.email)}</td><td>${pill(u.role)}</td><td>${esc(u.created_at)}</td></tr>`).join("")}</tbody></table></div>`,"Users registered in CampusConnect");
  }else if(page==="drives"){
    const {drives}=await api("/api/admin/drives");
    $("#content").innerHTML=panel("Schedule a placement drive",`<form id="driveForm" class="form-grid">
      ${field("Drive title","title")}${field("Company","company")}
      ${field("Date","drive_date","","date")}${field("Venue / link","venue")}
      <label class="field">Mode<select name="mode"><option>On Campus</option><option>Online</option></select></label>
      <label class="field wide">Instructions<textarea name="notes"></textarea></label>
      <div class="wide"><button class="btn primary">Create drive</button></div></form>`) +
      panel("Upcoming and scheduled drives",drives.length?`<div class="table-wrap"><table><thead><tr><th>DRIVE</th><th>COMPANY</th><th>DATE</th><th>VENUE</th><th>MODE</th></tr></thead><tbody>${drives.map(d=>`<tr><td><strong>${esc(d.title)}</strong></td><td>${esc(d.company)}</td><td>${esc(d.drive_date)}</td><td>${esc(d.venue)}</td><td>${esc(d.mode)}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No placement drives scheduled.</div>`);
    $("#driveForm").onsubmit=async e=>{e.preventDefault();try{await api("/api/admin/drives",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});toast("Placement drive created.");navigate("drives")}catch(err){toast(err.message)}};
  }else if(page==="reports"){
    const r=await api("/api/admin/reports");
    const rows=(title,arr,key)=>panel(title,arr.length?`<div class="table-wrap"><table><tbody>${arr.map(x=>`<tr><td><strong>${esc(x[key])}</strong></td><td>${x.count??x.applications}</td></tr>`).join("")}</tbody></table></div>`:`<div class="empty">No data available.</div>`);
    $("#content").innerHTML=`<div class="grid-2">${rows("Applications by status",r.byStatus,"status")}${rows("Applications by department",r.byDepartment,"department")}</div>${rows("Applications by company",r.byCompany,"company")}`;
  }
}
function adminJobTable(jobs){if(!jobs.length)return `<div class="empty">No job submissions yet.</div>`;return `<div class="table-wrap"><table><thead><tr><th>POSITION</th><th>RECRUITER</th><th>COMPANY</th><th>STATUS</th><th>REVIEW</th></tr></thead><tbody>${jobs.map(j=>`<tr><td><strong>${esc(j.title)}</strong></td><td>${esc(j.recruiter_name)}</td><td>${esc(j.company)}</td><td>${pill(j.status)}</td><td><div class="action-row">${j.status==="pending"?`<button class="btn primary small-btn" data-id="${j.id}" data-job-action="approved">Approve</button><button class="btn danger small-btn" data-id="${j.id}" data-job-action="rejected">Reject</button>`:`<button class="btn secondary small-btn" data-id="${j.id}" data-job-action="closed">Close</button>`}</div></td></tr>`).join("")}</tbody></table></div>`}

document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>showAuth(b.dataset.auth));
$("#loginForm").onsubmit=async e=>{e.preventDefault();try{const r=await api("/api/login",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});state.user=r.user;showApp();navigate("dashboard")}catch(err){toast(err.message)}};
$("#registerForm").onsubmit=async e=>{e.preventDefault();try{const r=await api("/api/register",{method:"POST",body:JSON.stringify(Object.fromEntries(new FormData(e.target)))});state.user=r.user;showApp();navigate("profile")}catch(err){toast(err.message)}};
$("#logoutBtn").onclick=async()=>{await api("/api/logout",{method:"POST",body:"{}"});state.user=null;showAuth("login")};
(async()=>{try{const r=await api("/api/me");if(r.user){state.user=r.user;showApp();navigate("dashboard")}else showAuth("login")}catch{showAuth("login")}})();
