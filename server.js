import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = 3001

// Middleware
app.use(cors())
app.use(express.json())

// Security: Prevent direct browser access
const API_KEY = 'bubt_2026_XR8fKQ9P1MZ6E4JHdA'

const requireAuth = (req, res, next) => {
    // Check custom header
    const apiKey = req.headers['x-api-key']

    // Check if it's a view request (images need to load in <img> tags without headers)
    // We allow /api/view to be accessed without header because <img> tags can't send headers
    if (req.path.startsWith('/api/view/')) {
        return next()
    }

    if (apiKey === API_KEY) {
        next()
    } else {
        res.status(403).json({ error: 'Access Denied: Direct browser access is not allowed' })
    }
}

// Apply security middleware to specific routes
// app.use(['/api/routines/db', '/api/download'], requireAuth) <--- This can be flaky depending on order

// Encrypt file path (using base64 encoding)
function encryptPath(filePath) {
    try {
        return Buffer.from(filePath).toString('base64')
    } catch (error) {
        console.error('Encryption error:', error)
        return null
    }
}

// Decrypt file path
function decryptPath(encryptedPath) {
    try {
        return Buffer.from(encryptedPath, 'base64').toString('utf8')
    } catch (error) {
        console.error('Decryption error:', error)
        return null
    }
}

// API endpoint to get routine database (PROTECTED)
app.get('/api/routines/db', requireAuth, (req, res) => {
    try {
        // Prevent caching
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
        res.setHeader('Pragma', 'no-cache')
        res.setHeader('Expires', '0')

        const dbPath = path.join(__dirname, 'storage', 'routines', 'routine_db.json')
        const data = fs.readFileSync(dbPath, 'utf8')
        const routines = JSON.parse(data)

        // Encrypt file paths before sending to frontend
        const encryptedRoutines = routines.map(routine => ({
            ...routine,
            image: encryptPath(routine.image),
            pdf: encryptPath(routine.pdf)
        }))

        // Obfuscate the entire response so it's not readable in Network tab
        // We convert the JSON to a Base64 string
        const jsonString = JSON.stringify(encryptedRoutines)
        const obfuscatedPayload = Buffer.from(jsonString).toString('base64')

        // Return as a wrapped payload
        res.json({ payload: obfuscatedPayload })

    } catch (error) {
        console.error('Error reading database:', error)
        res.status(500).json({ error: 'Failed to load routines', details: error.message })
    }
})

// API endpoint to view/display files (for img src)
app.get('/api/view/:type/:encryptedPath', (req, res) => {
    // ... existing view logic ...
    try {
        const { encryptedPath, type } = req.params

        // Decrypt the file path
        const filePath = decryptPath(encryptedPath)

        if (!filePath) {
            return res.status(400).json({ error: 'Invalid file reference' })
        }

        // Validate file type
        if (!['image', 'pdf'].includes(type)) {
            return res.status(400).json({ error: 'Invalid file type' })
        }

        // Construct full file path
        const fullPath = path.join(__dirname, 'storage', 'routines', filePath)

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' })
        }

        // Security check: ensure file is within storage directory
        const resolvedPath = path.resolve(fullPath)
        const storageDir = path.resolve(path.join(__dirname, 'storage', 'routines'))

        if (!resolvedPath.startsWith(storageDir)) {
            return res.status(403).json({ error: 'Access denied' })
        }

        // Set appropriate content type (NO download header)
        const ext = path.extname(fullPath).toLowerCase()
        const contentTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.pdf': 'application/pdf'
        }

        res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream')
        // NO Content-Disposition header - this allows inline viewing

        // Stream file to response
        const fileStream = fs.createReadStream(fullPath)
        fileStream.pipe(res)

    } catch (error) {
        console.error('View error:', error)
        res.status(500).json({ error: 'View failed' })
    }
})

// API endpoint to download files (PROTECTED)
app.get('/api/download/:type/:encryptedPath', requireAuth, (req, res) => {
    try {
        const { encryptedPath, type } = req.params

        // Decrypt the file path
        const filePath = decryptPath(encryptedPath)

        if (!filePath) {
            return res.status(400).json({ error: 'Invalid file reference' })
        }

        // Validate file type
        if (!['image', 'pdf'].includes(type)) {
            return res.status(400).json({ error: 'Invalid file type' })
        }

        // Construct full file path
        const fullPath = path.join(__dirname, 'storage', 'routines', filePath)

        // Check if file exists
        if (!fs.existsSync(fullPath)) {
            return res.status(404).json({ error: 'File not found' })
        }

        // Security check: ensure file is within storage directory
        const resolvedPath = path.resolve(fullPath)
        const storageDir = path.resolve(path.join(__dirname, 'storage', 'routines'))

        if (!resolvedPath.startsWith(storageDir)) {
            return res.status(403).json({ error: 'Access denied' })
        }

        // Set appropriate content type
        const ext = path.extname(fullPath).toLowerCase()
        const contentTypes = {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.pdf': 'application/pdf'
        }

        res.setHeader('Content-Type', contentTypes[ext] || 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(fullPath)}"`)

        // Stream file to response
        const fileStream = fs.createReadStream(fullPath)
        fileStream.pipe(res)

    } catch (error) {
        console.error('Download error:', error)
        res.status(500).json({ error: 'Download failed' })
    }
})

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Server is running' })
})

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`🚀 Backend server running on http://localhost:${PORT}`)
        console.log(`📁 Serving files from: ${path.join(__dirname, 'storage', 'routines')}`)
    })
}

export default app
