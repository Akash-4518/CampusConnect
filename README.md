# CampusConnect – Full-Stack Campus Recruitment Management System

A working academic full-stack project with three role-based portals:
- Student
- Recruiter
- Placement Administrator

## Technology
- Frontend: HTML, CSS, vanilla JavaScript
- Backend: Node.js + Express
- Database: SQLite (`better-sqlite3`)
- Authentication: bcrypt password hashing + server-side sessions

## Requirements
- Node.js 18 or newer
- npm
- Internet connection for the first dependency installation

## Run on Windows (VS Code)
1. Extract `CampusConnect_FullStack.zip`.
2. Open the extracted `CampusConnect_FullStack` folder in VS Code.
3. Open Terminal → New Terminal.
4. Run:
   ```bash
   npm install
   ```
5. Start the server:
   ```bash
   npm start
   ```
6. Open this address in Chrome:
   `http://localhost:3000`

The SQLite database file `campusconnect.db` is created automatically on first start. Demo users and sample records are seeded only when the database is empty.

## Demo Login Credentials

| Role | Email | Password |
|---|---|---|
| Student | student@campusconnect.demo | Student@123 |
| Recruiter | recruiter@campusconnect.demo | Recruiter@123 |
| Placement Admin | admin@campusconnect.demo | Admin@123 |

You can also create a new Student account from the registration tab. Recruiter and Admin accounts are created by the institution/admin in a real deployment; public registration is intentionally restricted to Student.

## Features

### Student
- Student account registration and login
- Academic profile: roll number, department, CGPA, graduation year, skills and contact
- View approved job openings
- Eligibility check based on CGPA, department and graduation year
- Apply once per job
- Track application status

### Recruiter
- Login using seeded recruiter account
- Submit job openings for admin approval
- View own job postings and approval state
- View applicants for own jobs
- Update applicant status: Under Review, Shortlisted, Interview Scheduled, Selected, Rejected

### Placement Admin
- Dashboard statistics
- Approve, reject or close job postings
- View registered users
- Create placement drives
- View reports by application status, department and company

## Important project notes
- This is a local academic project starter, not a production-hosted service.
- Demo data is illustrative. Do not use real student personal data until institutional approval and security review.
- The application uses SQLite for local persistence. The database file is created in the project folder.
- The default session secret is for local development only. Before deployment, set a long random `SESSION_SECRET` environment variable.
- For production, configure HTTPS, secure session storage (not Express MemoryStore), rate limiting, CSRF protection, backups, audit logging, password reset, and institutional privacy controls.
- Job eligibility is checked on the server using the student's profile values. Recruiter job posts remain pending until an admin approves them.
- Passwords are hashed with bcrypt; they are never stored as plain text.

## Troubleshooting
- If `npm` is not recognized, install Node.js LTS and restart VS Code.
- If port 3000 is busy, run PowerShell:
  ```powershell
  $env:PORT=3001; npm start
  ```
  Then visit `http://localhost:3001`.
- If the native SQLite package fails to install, install the current Node.js LTS release and Windows build tools, then retry `npm install`.
- To reset demo data, stop the server and delete `campusconnect.db`; the next start recreates the database and demo accounts.

## Suggested review demonstration
1. Sign in as Student, update CGPA and browse jobs.
2. Apply for a job for which the student meets the criteria.
3. Sign out and sign in as Recruiter; post a new job.
4. Sign out and sign in as Admin; approve the pending job.
5. Return as Student and show the approved job in the listing.
6. As Recruiter, view applicants and update application status.
7. As Admin, show dashboard, placement drives and reports.

## Project structure
```text
CampusConnect_FullStack/
  server.js
  package.json
  .env.example
  README.md
  public/
    index.html
    styles.css
    app.js
```
