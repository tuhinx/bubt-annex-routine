import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search,
    Image as ImageIcon,
    FileText,
    Calendar
} from 'lucide-react'

// API Key for secure access
const API_KEY = 'bubt_2026_XR8fKQ9P1MZ6E4JHdA'

function App() {
    const [db, setDb] = useState([])
    const [initialLoading, setInitialLoading] = useState(true)
    const [isSwitching, setIsSwitching] = useState(false)
    const [error, setError] = useState(null)

    // Selection state
    const [routineType, setRoutineType] = useState('class') // 'class' or 'exam'
    const [program, setProgram] = useState('')
    const [intake, setIntake] = useState('')
    const [section, setSection] = useState('')
    const [result, setResult] = useState(null)

    useEffect(() => {
        setIsSwitching(true)
        setDb([]) // Clear current data immediately to avoid "same show" confusion
        setResult(null)
        setProgram('')
        setIntake('')
        setSection('')

        fetch(`/api/routines/db?type=${routineType}`, {
            headers: {
                'x-api-key': API_KEY
            }
        })
            .then(res => res.json())
            .then(data => {
                if (data.payload) {
                    try {
                        const jsonString = atob(data.payload)
                        const routines = JSON.parse(jsonString)
                        setDb(routines)
                    } catch (e) {
                        console.error('Decryption failed', e)
                        setError('Failed to process routine data.')
                    }
                } else if (Array.isArray(data)) {
                    setDb(data)
                } else {
                    console.error('Invalid data format', data)
                    setDb([])
                    if (data.error) setError(data.error)
                }
                setInitialLoading(false)
                setIsSwitching(false)
            })
            .catch(err => {
                console.error(err)
                setError('Failed to load routine database.')
                setInitialLoading(false)
                setIsSwitching(false)
            })
    }, [routineType])

    // Derived options
    const programs = useMemo(() => {
        if (!Array.isArray(db)) return []
        return [...new Set(db.map(x => x.program))].sort()
    }, [db])

    const intakes = useMemo(() => {
        if (!program || !Array.isArray(db)) return []
        return [...new Set(db.filter(x => x.program === program).map(x => x.intake))].sort((a, b) => b - a)
    }, [db, program])

    const sections = useMemo(() => {
        if (!program || !intake || !Array.isArray(db)) return []
        return [...new Set(db.filter(x => x.program === program && x.intake === intake).map(x => x.section))].sort((a, b) => a - b)
    }, [db, program, intake])

    const handleSearch = () => {
        const match = db.find(x => x.program === program && x.intake === intake && x.section === section)
        setResult(match)

        // Smooth scroll to results
        setTimeout(() => {
            document.querySelector('.result-container')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
    }

    const handleDownload = async (encryptedPath, filename, fileType) => {
        try {
            const response = await fetch(`/api/download/${routineType}/${fileType}/${encryptedPath}`, {
                headers: {
                    'x-api-key': API_KEY
                }
            })

            if (!response.ok) throw new Error('Download failed')

            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = filename
            document.body.appendChild(link)
            link.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(link)
        } catch (error) {
            console.error('Download error:', error)
            alert('Failed to download file. Please try again.')
        }
    }

    if (initialLoading) {
        return (
            <div className="loading-screen">
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="loading-state"
                >
                    <div className="loader"></div>
                    <p>Initializing Portal...</p>
                </motion.div>
            </div>
        )
    }

    return (
        <div className="app-container">
            <motion.header
                className="hero"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
            >
                <h1>BUBT Annex</h1>
                <p>The smartest way for BUBTians to access their {routineType === 'exam' ? 'exam' : 'class'} schedules with one click.</p>

                <div className="tab-container glass">
                    {['class', 'exam'].map((type) => (
                        <button
                            key={type}
                            className={`tab-btn ${routineType === type ? 'active' : ''}`}
                            onClick={() => setRoutineType(type)}
                        >
                            {routineType === type && (
                                <motion.span
                                    layoutId="activeTab"
                                    className="active-bg"
                                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                                />
                            )}
                            <span className="tab-text">
                                {type === 'class' ? 'Class Routine' : 'Exam Routine'}
                            </span>
                        </button>
                    ))}
                </div>
            </motion.header>

            <motion.div
                className={`search-card glass ${isSwitching ? 'switching' : ''}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                {isSwitching && (
                    <motion.div
                        className="switching-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                    >
                        <div className="loader-sm"></div>
                    </motion.div>
                )}
                <div className="form-group">
                    <label>Academic Program</label>
                    <select
                        className="form-select"
                        value={program}
                        onChange={(e) => { setProgram(e.target.value); setIntake(''); setSection(''); }}
                        disabled={isSwitching}
                    >
                        <option value="">Choose Program</option>
                        {programs.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label>Intake Batch</label>
                    <select
                        className="form-select"
                        value={intake}
                        disabled={!program || isSwitching}
                        onChange={(e) => { setIntake(e.target.value); setSection(''); }}
                    >
                        <option value="">Select Intake</option>
                        {intakes.map(i => <option key={i} value={i}>{i}</option>)}
                    </select>
                </div>

                <div className="form-group">
                    <label>Section</label>
                    <select
                        className="form-select"
                        value={section}
                        disabled={!intake || isSwitching}
                        onChange={(e) => setSection(e.target.value)}
                    >
                        <option value="">Select Section</option>
                        {sections.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <button
                    className="btn-search"
                    disabled={!section || isSwitching}
                    onClick={handleSearch}
                >
                    <Search size={20} />
                    Show Routine
                </button>
            </motion.div>

            <AnimatePresence mode="wait">
                {!result ? (
                    <motion.div
                        key="empty"
                        className="empty-state"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <Calendar size={64} style={{ margin: '0 auto 1.5rem', display: 'block' }} />
                        <h3>{routineType === 'exam' ? 'No Exam Routines Yet' : 'Ready to help!'}</h3>
                        <p>
                            {routineType === 'exam'
                                ? 'Exam schedules will appear here once they are released by the university.'
                                : 'Select your program details above to unlock your schedule.'}
                        </p>
                    </motion.div>
                ) : (
                    <motion.div
                        key="result"
                        className="result-container"
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ type: 'spring', damping: 20 }}
                    >
                        <div className="routine-header">
                            <div className="routine-title">
                                <h2>{result.program}</h2>
                                <p>Intake {result.intake} &bull; Section {result.section}</p>
                            </div>
                            <div className="action-buttons">
                                <button
                                    onClick={() => handleDownload(result.image, `${result.program}_${result.intake}_${result.section}.png`, 'image')}
                                    className="btn-secondary"
                                >
                                    <ImageIcon size={18} /> Image
                                </button>
                                <button
                                    onClick={() => handleDownload(result.pdf, `${result.program}_${result.intake}_${result.section}.pdf`, 'pdf')}
                                    className="btn-secondary"
                                >
                                    <FileText size={18} /> PDF
                                </button>
                            </div>
                        </div>



                        <div style={{ marginTop: '1.5rem' }}>
                            <div className="section-header">
                                <ImageIcon size={20} />
                                <span>Original Routine Reference</span>
                            </div>
                            <div className="glass" style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                                <img
                                    src={`/api/view/${routineType}/image/${result.image}`}
                                    alt="Official Routine"
                                    style={{ width: '100%', height: 'auto', borderRadius: 'var(--radius-md)' }}
                                />
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <footer style={{ marginTop: '4rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem', padding: '2rem 0' }}>
                <p>
                    &copy; {new Date().getFullYear()} {'  '}BUBT Routine Portal &bull; Developed by <a href="https://github.com/tuhinx" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: '500' }}>Tuhinx</a>
                </p>
            </footer>
        </div>
    )
}

export default App
