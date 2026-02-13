# EasyLotto License Server (Phase 3.2)

License + Login server for EasyLotto (Annual license, machine bind, multi-user roles).

## Quick Start
1) `cp .env.example .env` แล้วใส่ `DATABASE_URL`, `JWT_SECRET`, `LICENSE_MASTER_KEY`
2) `npm i`
3) `npm run db:init`
4) `npm run seed:admin`
5) `npm start`

## Railway
- Create service from repo
- Variables: `DATABASE_URL` (ref Postgres), `JWT_SECRET`, `LICENSE_MASTER_KEY`
- Health: `GET /health`

## API
- POST /auth/login
- GET /me (Bearer)
- POST /admin/licenses (admin) ออก license
- POST /admin/users (admin) เพิ่ม user ตาม seat
- POST /license/activate ผูกเครื่องครั้งแรก
- POST /license/validate ตรวจ + feature gate
