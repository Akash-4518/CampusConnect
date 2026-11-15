const express = require("express");
const session = require("express-session");
const helmet = require("helmet");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, "campusconnect.db");
const db = new Database(DB_PATH);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('student','recruiter','admin')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS student_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  roll_no TEXT DEFAULT '',
  department TEXT DEFAULT 'CSE',
  cgpa REAL DEFAULT 0,
  graduation_year INTEGER DEFAULT 2027,
  skills TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  resume_link TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS recruiter_profiles (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  contact_person TEXT DEFAULT '',
  website TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recruiter_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT DEFAULT 'Not specified',
  package_lpa REAL DEFAULT 0,
  min_cgpa REAL DEFAULT 0,
  eligible_department TEXT DEFAULT 'All',
  graduation_year INTEGER DEFAULT 2027,
  deadline TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL REFERENCES users(id),
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  status TEXT NOT NULL DEFAULT 'Submitted'
    CHECK(status IN ('Submitted','Under Review','Shortlisted','Interview Scheduled','Selected','Rejected')),
  applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(student_id, job_id)
);
CREATE TABLE IF NOT EXISTS drives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  drive_date TEXT NOT NULL,
  venue TEXT DEFAULT '',
  mode TEXT DEFAULT 'On Campus',
  notes TEXT DEFAULT '',
  created_by INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`);

const count = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
if (count === 0) {
  const insertUser = db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,?)");
  const insertStudent = db.prepare("INSERT INTO student_profiles(user_id,roll_no,department,cgpa,graduation_year,skills,phone) VALUES(?,?,?,?,?,?,?)");
  const insertRecruiter = db.prepare("INSERT INTO recruiter_profiles(user_id,company_name,contact_person,website) VALUES(?,?,?,?)");
  const adminId = insertUser.run("Placement Admin","admin@campusconnect.demo",bcrypt.hashSync("Admin@123",10),"admin").lastInsertRowid;
  const recruiterId = insertUser.run("Demo Recruiter","recruiter@campusconnect.demo",bcrypt.hashSync("Recruiter@123",10),"recruiter").lastInsertRowid;
  insertRecruiter.run(recruiterId,"TechNova Solutions","Demo Recruiter","https://example.com");
  const studentId = insertUser.run("Demo Student","student@campusconnect.demo",bcrypt.hashSync("Student@123",10),"student").lastInsertRowid;
  insertStudent.run(studentId,"CSE001","CSE",8.2,2027,"Java, Python, HTML, CSS","9000000000");
  const addJob = db.prepare(`INSERT INTO jobs(recruiter_id,title,company,description,location,package_lpa,min_cgpa,eligible_department,graduation_year,deadline,status)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)`);
  addJob.run(recruiterId,"Graduate Software Engineer","TechNova Solutions","Work with the engineering team to build and maintain web applications. Knowledge of programming fundamentals and problem solving is expected.","Hyderabad",6.5,7.0,"CSE",2027,"2027-02-28","approved");
  addJob.run(recruiterId,"Frontend Developer Intern","TechNova Solutions","Assist in developing responsive user interfaces using HTML, CSS and JavaScript.","Remote",3.0,6.0,"All",2027,"2027-03-15","approved");
  db.prepare("INSERT INTO drives(title,company,drive_date,venue,mode,notes,created_by) VALUES(?,?,?,?,?,?,?)")
    .run("Graduate Engineer Recruitment Drive","TechNova Solutions","2027-03-20","CSE Seminar Hall","On Campus","Bring updated resume and college ID.",adminId);
}

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  name: "campusconnect.sid",
  secret: process.env.SESSION_SECRET || "development-only-change-this-secret-before-deployment",
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000*60*60*8 }
}));
app.use(express.static(path.join(__dirname, "public")));

const safeUser = u => ({ id:u.id, name:u.name, email:u.email, role:u.role });
const requireAuth = (req,res,next) => req.session.user ? next() : res.status(401).json({error:"Please sign in first."});
const requireRole = (...roles) => (req,res,next) => {
  if (!req.session.user) return res.status(401).json({error:"Please sign in first."});
  if (!roles.includes(req.session.user.role)) return res.status(403).json({error:"You do not have permission for this action."});
  next();
};
const clean = v => String(v ?? "").trim();
const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

app.get("/api/health", (req,res) => res.json({ok:true, service:"CampusConnect API"}));
app.get("/api/me", (req,res) => {
  if (!req.session.user) return res.json({user:null});
  res.json({user:req.session.user});
});

app.post("/api/register", (req,res) => {
  const name=clean(req.body.name), email=clean(req.body.email).toLowerCase(), password=String(req.body.password||"");
  if (!name || !validEmail(email) || password.length < 8) return res.status(400).json({error:"Enter a name, valid email and password with at least 8 characters."});
  try {
    const info=db.prepare("INSERT INTO users(name,email,password_hash,role) VALUES(?,?,?,'student')")
      .run(name,email,bcrypt.hashSync(password,10));
    db.prepare("INSERT INTO student_profiles(user_id) VALUES(?)").run(info.lastInsertRowid);
    const user=safeUser(db.prepare("SELECT * FROM users WHERE id=?").get(info.lastInsertRowid));
    req.session.user=user; res.status(201).json({user});
  } catch(e) { res.status(409).json({error:"An account with this email already exists."}); }
});

app.post("/api/login", (req,res) => {
  const email=clean(req.body.email).toLowerCase(), password=String(req.body.password||"");
  const user=db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!user || !bcrypt.compareSync(password,user.password_hash)) return res.status(401).json({error:"Incorrect email or password."});
  req.session.user=safeUser(user); res.json({user:req.session.user});
});
app.post("/api/logout", (req,res) => req.session.destroy(()=>res.json({ok:true})));

app.get("/api/student/profile", requireRole("student"), (req,res) => {
  const p=db.prepare(`SELECT u.name,u.email,p.roll_no,p.department,p.cgpa,p.graduation_year,p.skills,p.phone,p.resume_link
    FROM users u JOIN student_profiles p ON p.user_id=u.id WHERE u.id=?`).get(req.session.user.id);
  res.json({profile:p});
});
app.put("/api/student/profile", requireRole("student"), (req,res) => {
  const b=req.body, cgpa=Number(b.cgpa), year=Number(b.graduation_year);
  if (!Number.isFinite(cgpa) || cgpa<0 || cgpa>10 || !Number.isInteger(year) || year<2020 || year>2100)
    return res.status(400).json({error:"Enter a valid CGPA (0–10) and graduation year."});
  db.prepare(`UPDATE users SET name=? WHERE id=?`).run(clean(b.name)||req.session.user.name,req.session.user.id);
  db.prepare(`UPDATE student_profiles SET roll_no=?,department=?,cgpa=?,graduation_year=?,skills=?,phone=?,resume_link=? WHERE user_id=?`)
    .run(clean(b.roll_no),clean(b.department)||"CSE",cgpa,year,clean(b.skills),clean(b.phone),clean(b.resume_link),req.session.user.id);
  req.session.user.name=clean(b.name)||req.session.user.name;
  res.json({ok:true});
});

app.get("/api/jobs", requireAuth, (req,res) => {
  const jobs=db.prepare(`SELECT j.*,u.name AS recruiter_name,
    (SELECT COUNT(*) FROM applications a WHERE a.job_id=j.id) AS applicant_count
    FROM jobs j JOIN users u ON u.id=j.recruiter_id
    WHERE j.status='approved' ORDER BY j.created_at DESC`).all();
  if (req.session.user.role==="student") {
    const p=db.prepare("SELECT * FROM student_profiles WHERE user_id=?").get(req.session.user.id);
    const applied=new Set(db.prepare("SELECT job_id FROM applications WHERE student_id=?").all(req.session.user.id).map(x=>x.job_id));
    res.json({jobs:jobs.map(j=>({...j,applied:applied.has(j.id),eligible:!!p && p.cgpa>=j.min_cgpa && (j.eligible_department==="All"||j.eligible_department===p.department) && p.graduation_year===j.graduation_year}))});
  } else res.json({jobs});
});
app.post("/api/jobs/:id/apply", requireRole("student"), (req,res) => {
  const job=db.prepare("SELECT * FROM jobs WHERE id=? AND status='approved'").get(req.params.id);
  if (!job) return res.status(404).json({error:"Job not found or not open."});
  const p=db.prepare("SELECT * FROM student_profiles WHERE user_id=?").get(req.session.user.id);
  const eligible=p && p.cgpa>=job.min_cgpa && (job.eligible_department==="All"||job.eligible_department===p.department) && p.graduation_year===job.graduation_year;
  if (!eligible) return res.status(400).json({error:"Your profile does not meet this job's CGPA, department or graduation-year criteria."});
  try {
    db.prepare("INSERT INTO applications(student_id,job_id) VALUES(?,?)").run(req.session.user.id,job.id);
    res.status(201).json({ok:true,message:"Application submitted successfully."});
  } catch(e) { res.status(409).json({error:"You have already applied for this job."}); }
});
app.get("/api/student/applications", requireRole("student"), (req,res) => {
  const applications=db.prepare(`SELECT a.id,a.status,a.applied_at,j.title,j.company,j.location,j.package_lpa
    FROM applications a JOIN jobs j ON j.id=a.job_id WHERE a.student_id=? ORDER BY a.applied_at DESC`).all(req.session.user.id);
  res.json({applications});
});

app.get("/api/recruiter/jobs", requireRole("recruiter"), (req,res) => {
  const jobs=db.prepare(`SELECT j.*,(SELECT COUNT(*) FROM applications a WHERE a.job_id=j.id) applicant_count
    FROM jobs j WHERE recruiter_id=? ORDER BY created_at DESC`).all(req.session.user.id);
  res.json({jobs});
});
app.post("/api/recruiter/jobs", requireRole("recruiter"), (req,res) => {
  const b=req.body;
  const title=clean(b.title), company=clean(b.company), description=clean(b.description);
  const packageLpa=Number(b.package_lpa||0), minCgpa=Number(b.min_cgpa||0), year=Number(b.graduation_year);
  if (!title||!company||!description||!Number.isFinite(packageLpa)||packageLpa<0||!Number.isFinite(minCgpa)||minCgpa<0||minCgpa>10||!Number.isInteger(year))
    return res.status(400).json({error:"Complete all required fields with valid values."});
  const info=db.prepare(`INSERT INTO jobs(recruiter_id,title,company,description,location,package_lpa,min_cgpa,eligible_department,graduation_year,deadline,status)
    VALUES(?,?,?,?,?,?,?,?,?,?,'pending')`).run(req.session.user.id,title,company,description,clean(b.location),packageLpa,minCgpa,clean(b.eligible_department)||"All",year,clean(b.deadline)||null);
  res.status(201).json({ok:true,id:info.lastInsertRowid,message:"Job submitted for placement-admin approval."});
});
app.get("/api/recruiter/jobs/:id/applicants", requireRole("recruiter"), (req,res) => {
  const job=db.prepare("SELECT id FROM jobs WHERE id=? AND recruiter_id=?").get(req.params.id,req.session.user.id);
  if (!job) return res.status(404).json({error:"Job not found."});
  const applicants=db.prepare(`SELECT a.id,a.status,a.applied_at,u.name,u.email,p.roll_no,p.department,p.cgpa,p.skills
    FROM applications a JOIN users u ON u.id=a.student_id JOIN student_profiles p ON p.user_id=u.id
    WHERE a.job_id=? ORDER BY a.applied_at DESC`).all(job.id);
  res.json({applicants});
});
app.patch("/api/recruiter/applications/:id", requireRole("recruiter"), (req,res) => {
  const allowed=["Under Review","Shortlisted","Interview Scheduled","Selected","Rejected"];
  const status=clean(req.body.status);
  if (!allowed.includes(status)) return res.status(400).json({error:"Invalid application status."});
  const appRow=db.prepare(`SELECT a.id FROM applications a JOIN jobs j ON j.id=a.job_id
    WHERE a.id=? AND j.recruiter_id=?`).get(req.params.id,req.session.user.id);
  if (!appRow) return res.status(404).json({error:"Application not found."});
  db.prepare("UPDATE applications SET status=? WHERE id=?").run(status,appRow.id);
  res.json({ok:true});
});

app.get("/api/admin/overview", requireRole("admin"), (req,res) => {
  const count=table=>db.prepare(`SELECT COUNT(*) n FROM ${table}`).get().n;
  res.json({stats:{students:db.prepare("SELECT COUNT(*) n FROM users WHERE role='student'").get().n,
    recruiters:db.prepare("SELECT COUNT(*) n FROM users WHERE role='recruiter'").get().n,
    jobs:count("jobs"),applications:count("applications"),pendingJobs:db.prepare("SELECT COUNT(*) n FROM jobs WHERE status='pending'").get().n,
    selected:db.prepare("SELECT COUNT(*) n FROM applications WHERE status='Selected'").get().n}});
});
app.get("/api/admin/jobs", requireRole("admin"), (req,res) => {
  const jobs=db.prepare("SELECT j.*,u.name recruiter_name FROM jobs j JOIN users u ON u.id=j.recruiter_id ORDER BY j.created_at DESC").all();
  res.json({jobs});
});
app.patch("/api/admin/jobs/:id", requireRole("admin"), (req,res) => {
  const status=clean(req.body.status);
  if (!["approved","rejected","closed"].includes(status)) return res.status(400).json({error:"Invalid job status."});
  const result=db.prepare("UPDATE jobs SET status=? WHERE id=?").run(status,req.params.id);
  if (!result.changes) return res.status(404).json({error:"Job not found."});
  res.json({ok:true});
});
app.get("/api/admin/users", requireRole("admin"), (req,res) => {
  const users=db.prepare("SELECT id,name,email,role,created_at FROM users ORDER BY created_at DESC").all();
  res.json({users});
});
app.get("/api/admin/drives", requireRole("admin"), (req,res) => res.json({drives:db.prepare("SELECT * FROM drives ORDER BY drive_date").all()}));
app.post("/api/admin/drives", requireRole("admin"), (req,res) => {
  const b=req.body;
  if (!clean(b.title)||!clean(b.company)||!clean(b.drive_date)) return res.status(400).json({error:"Title, company and date are required."});
  db.prepare("INSERT INTO drives(title,company,drive_date,venue,mode,notes,created_by) VALUES(?,?,?,?,?,?,?)")
    .run(clean(b.title),clean(b.company),clean(b.drive_date),clean(b.venue),clean(b.mode)||"On Campus",clean(b.notes),req.session.user.id);
  res.status(201).json({ok:true});
});
app.get("/api/admin/reports", requireRole("admin"), (req,res) => {
  const byStatus=db.prepare("SELECT status,COUNT(*) count FROM applications GROUP BY status").all();
  const byDepartment=db.prepare(`SELECT p.department,COUNT(*) applications FROM applications a
    JOIN student_profiles p ON p.user_id=a.student_id GROUP BY p.department ORDER BY applications DESC`).all();
  const byCompany=db.prepare(`SELECT j.company,COUNT(a.id) applications FROM jobs j LEFT JOIN applications a ON a.job_id=j.id
    GROUP BY j.company ORDER BY applications DESC`).all();
  res.json({byStatus,byDepartment,byCompany});
});

app.get("*", (req,res) => res.sendFile(path.join(__dirname,"public","index.html")));
app.listen(PORT, () => console.log(`CampusConnect running at http://localhost:${PORT}`));
