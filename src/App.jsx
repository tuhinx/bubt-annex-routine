import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search,
    Image as ImageIcon,
    FileText,
    Calendar
} from 'lucide-react'

function App() {
    const [db, setDb] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    // Selection state
    const [program, setProgram] = useState('')
    const [intake, setIntake] = useState('')
    const [section, setSection] = useState('')
    const [result, setResult] = useState(null)

    useEffect(() => {
        fetch('/.routines/routine_db.json')
            .then(res => res.json())
            .then(data => {
                setDb(data)
                setLoading(false)
            })
            .catch(err => {
                console.error(err)
                setError('Failed to load routine database.')
                setLoading(false)
            })
    }, [])

    // Derived options
    const programs = useMemo(() => [...new Set(db.map(x => x.program))].sort(), [db])

    const intakes = useMemo(() => {
        if (!program) return []
        return [...new Set(db.filter(x => x.program === program).map(x => x.intake))].sort((a, b) => b - a)
    }, [db, program])

    const sections = useMemo(() => {
        if (!program || !intake) return []
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



    if (loading) {
        return (
            <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
                <p>Initializing Portal...</p>
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
                <p>The smartest way for BUBTians to access their class schedules with one click.</p>
            </motion.header>

            <motion.div
                className="search-card glass"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
            >
                <div className="form-group">
                    <label>Academic Program</label>
                    <select
                        className="form-select"
                        value={program}
                        onChange={(e) => { setProgram(e.target.value); setIntake(''); setSection(''); }}
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
                        disabled={!program}
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
                        disabled={!intake}
                        onChange={(e) => setSection(e.target.value)}
                    >
                        <option value="">Select Section</option>
                        {sections.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                </div>

                <button
                    className="btn-search"
                    disabled={!section}
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
                        <h3>Ready to help!</h3>
                        <p>Select your program details above to unlock your schedule.</p>
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
                                <a href={`/.routines/${result.image}`} download className="btn-secondary">
                                    <ImageIcon size={18} /> Image
                                </a>
                                <a href={`/.routines/${result.pdf}`} download className="btn-secondary">
                                    <FileText size={18} /> PDF
                                </a>
                            </div>
                        </div>



                        <div style={{ marginTop: '1.5rem' }}>
                            <div className="section-header">
                                <ImageIcon size={20} />
                                <span>Original Routine Reference</span>
                            </div>
                            <div className="glass" style={{ padding: '0.5rem', borderRadius: 'var(--radius-sm)' }}>
                                <img
                                    src={`/.routines/${result.image}`}
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
