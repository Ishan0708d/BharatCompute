import multer from "multer"
import path from "path"
import fs from "fs"

// Use __dirname so the path is always relative to THIS file's location,
// not process.cwd() — which differs between localhost and Render/Railway.
// __dirname here = backend/src/middleware  →  ../../uploads = backend/uploads/
const UPLOAD_DIR = path.join(__dirname, "..", "..", "uploads")
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (_req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})

export const upload = multer({ storage })
export { UPLOAD_DIR }

