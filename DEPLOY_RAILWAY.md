# EasyLotto License Server — Phase 3.2B (Full Pack)

## 1) สิ่งที่ต้องมีบน Railway (Variables)
ตั้งค่าใน service `easylotto-license-server`:

- `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`  (เลือก reference จาก Postgres)
- `JWT_SECRET` = สุ่มยาวๆ (อย่างน้อย 32 ตัวอักษร)
- `LICENSE_MASTER_KEY` = สุ่มยาวๆ (อย่างน้อย 32 ตัวอักษร)
- `ADMIN_EMAIL` = อีเมลแอดมินเริ่มต้น
- `ADMIN_PASSWORD` = รหัสผ่านแอดมินเริ่มต้น

> จุดที่พลาดบ่อย: อย่าใส่ `${{DATABASE_URL}}` ของตัวเอง ให้เลือก `${{Postgres.DATABASE_URL}}`

## 2) สร้างตารางใน Postgres
เปิด Postgres service → Database / Query แล้วรันไฟล์ `src/schema.sql`

หรือถ้าเข้าคอนเทนเนอร์ได้:
- `npm run db:init`

## 3) สร้าง Admin แรกเริ่ม
- `npm run seed:admin` (รันได้หลัง db พร้อมแล้ว)

## 4) ตรวจว่า API ออนไลน์
- GET `/health` ต้องได้ `ok`

## 5) Notes
- ถ้า Deploy crash แล้ว error ว่า Missing env: DATABASE_URL ให้กลับไปเช็คข้อ 1
- ถ้า error ว่า Cannot find module แปลว่ายังอัพโค้ดไม่ครบ (ต้อง push ทั้งโฟลเดอร์ `src/` และ `scripts/`)
