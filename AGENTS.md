<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## UI Components

- Use `@heroui/react` (HeroUI, formerly NextUI) as the default for visible UI components and controls. Check the installed package version and available components before building a UI element.
- Prefer HeroUI components over native visible controls or custom UI when HeroUI provides a suitable option.
- If HeroUI has no suitable component, or adapting it would be difficult or compromise the experience, ask the user before implementing a non-HeroUI alternative. Explain the limitation and proposed alternative.
- Native elements may be used for browser plumbing that requires them, such as a hidden file input or canvas, while keeping the visible control in HeroUI.

กฎการทำงาน:

- ทำเฉพาะสิ่งที่ prompt ระบุ ห้ามแก้ไฟล์นอกขอบเขต ห้ามเปลี่ยนพฤติกรรมของภาพที่ได้ (refactor ล้วน)
- ก่อนเริ่มรัน git status แล้วรายงาน ถ้ามีไฟล์ค้างให้หยุดถาม
- ห้ามเพิ่ม dependency นอกรายการที่ระบุ ห้าม commit เอง
- ตัวเลขที่รายงานต้องมาจากการรันจริง ถ้าวัดไม่ได้ให้บอกว่าวัดไม่ได้ ห้ามเดา
- ห้ามทิ้ง debug code/flag ชั่วคราว จบงานต้องรัน
  git grep -nE "console\.debug|forceCpu|__run|TODO\(tmp\)" src/ แล้วรายงานผล
- ถ้า patch ล้มเหลว ห้ามลองแก้ซ้ำแบบเดาจนไฟล์ซ้อนกัน ให้ git diff ดูสถานะก่อน
- ปิดงานทุกครั้งด้วย npx tsc --noEmit && npm run format:check && npm run lint && npm run build

กฎการทำงาน (งาน UI):

- แก้เฉพาะ presentation (JSX/CSS/Tailwind/tokens/ข้อความแบรนด์) ห้ามแก้ src/lib/ ที่เป็น engine
  ห้ามเปลี่ยนพฤติกรรม ลำดับ หรือชื่อ state ของการปรับภาพ
- ห้ามเปลี่ยน aria-label, role, data-slot และข้อความ label ของ control เดิม (e2e/test พึ่งพา)
  slider ใหม่ต้องคง [data-slot="thumb"] และ [data-slot="track"] ของ HeroUI
- ห้ามเพิ่ม dependency ห้าม commit เอง ห้ามทิ้ง debug code
- ทุกรอบถ่ายภาพหน้าจอ "ก่อนและหลัง" ด้วย Playwright ที่ viewport 1440x900, 1024x768, 390x844
  เก็บใน test-output/ui/ ชื่อ <หน้า>-<viewport>-before/after.png แล้วรายงาน path
- ใช้ test-assets/DSCF1865.JPG ถ้ามี ไม่งั้นใช้ภาพตัวอย่างในแอป
- ปิดงานด้วย npx tsc --noEmit && npm run format:check && npm run lint && npm run build และรายงาน git diff --stat
- ถ้า patch ล้มเหลว ห้ามลองซ้ำแบบเดา ให้ git diff ดูสถานะก่อน
- ตัวเลขที่รายงานต้องมาจากการรันจริง ถ้าวัดไม่ได้ให้บอกว่าวัดไม่ได้
