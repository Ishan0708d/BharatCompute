import multer from "multer"
import path from "path"

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, "uploads/")
  },
  filename: (_req, file, cb) => {
    // Basic filename with timestamp
    cb(null, `${Date.now()}-${file.originalname}`)
  },
})

export const upload = multer({ storage })
