import multer from "multer"
import path from "path"
import fs from "fs"

// Ensure the uploads directory always exists before multer tries to write to it.
// Without this, a fresh clone or deleted folder causes a 500 ENOENT crash.
const UPLOAD_DIR = path.resolve("uploads")
fs.mkdirSync(UPLOAD_DIR, { recursive: true })

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, UPLOAD_DIR)
  },
  filename: (_req, file, cb) => {
    // Basic filename with timestamp
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})

export const upload = multer({ storage })

