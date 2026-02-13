# EasyLotto License Server (Railway)

## Deploy Steps
1) Push repo to GitHub
2) Railway -> New Project -> Deploy from GitHub Repo
3) Add Postgres plugin
4) Add ENV:
- JWT_SECRET=... (สุ่มยาวๆ)
- LICENSE_MASTER_KEY=... (สุ่มยาวๆ/เก็บเป็นความลับ)
- ADMIN_EMAIL=you@domain.com
- ADMIN_PASSWORD=strongpassword

Railway จะ inject DATABASE_URL ให้อัตโนมัติเมื่อเชื่อม Postgres

## API Quick Test
GET /health

### Admin Login
POST /admin/login
{ "email": "...", "password": "..." }

### Create License
POST /admin/licenses
Authorization: Bearer <adminToken>
{ "plan": "PRO", "years": 1, "seats": 3, "note": "customer A" }

### Activate (ครั้งแรก)
POST /license/activate
x-machine-fp: <fingerprint>
{ "licenseKey":"EL....", "orgName":"ร้าน A", "ownerEmail":"a@x.com", "ownerPassword":"123456" }

### Login
POST /auth/login
x-machine-fp: <fingerprint>
{ "email":"a@x.com", "password":"123456" }

### Owner create clerk
POST /users
Authorization: Bearer <ownerToken>
x-machine-fp: <fingerprint>
{ "email":"clerk@x.com", "password":"123456", "role":"clerk" }
