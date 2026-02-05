# BUBT Routine Scripts

This hidden folder contains all the Python scripts used for scraping and processing BUBT routine data.

## Scripts

### `routine_sniper.py`
Downloads PDF routines from the BUBT website using Playwright.
- **Usage**: `python routine_sniper.py` (incremental) or `python routine_sniper.py --clean` (fresh start)
- **Output**: PDFs saved to `storage/routines/class/`

### `routine_indexer.py`
Processes downloaded PDFs and generates the searchable JSON database.
- **Usage**: `python routine_indexer.py`
- **Output**: 
  - `storage/routines/class/class_db.json` (main database)
  - `storage/routines/class/class_images/` (PNG previews)
  - `storage/routines/class/class_pages/` (individual PDF pages)

### `auto_updater.py`
Runs both sniper and indexer on a schedule (every 24 hours).
- **Usage**: `python auto_updater.py`
- **Note**: Runs continuously in the background

### `run_ui.py`
Starts a simple HTTP server for the legacy HTML interface.
- **Usage**: `python run_ui.py`
- **Server**: http://localhost:8000

## Requirements

Install dependencies with:
```bash
pip install -r requirements.txt
```

## GitHub Actions

These scripts are automatically run by GitHub Actions workflows:
- **Daily Update**: Runs `routine_sniper.py` and `routine_indexer.py` daily
- **Seasonal Reset**: Runs with `--clean` flag every 4 months to purge old data
