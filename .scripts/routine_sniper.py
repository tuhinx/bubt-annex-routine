import os
import time
import re
import shutil
from playwright.sync_api import sync_playwright

# Configuration
BASE_URL = "https://www.bubt.edu.bd/routines"
# Script is now in .scripts/, so go up to root, then to public/.routines
DOWNLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", ".routines")
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"

def ensure_dir(directory, clear=False):
    if clear and os.path.exists(directory):
        print(f"[*] Clearing old downloads in {directory}...")
        shutil.rmtree(directory)
    if not os.path.exists(directory):
        os.makedirs(directory, exist_ok=True)
    print(f"[*] Ensured directory exists: {directory}")

def sanitize_filename(name):
    s = re.sub(r'[^a-zA-Z0-9._-]', '_', name)
    s = re.sub(r'_+', '_', s)
    return s.strip('_')[:80]

def wait_for_challenge(page):
    print("[*] Waiting for Cloudflare challenge...")
    try:
        page.wait_for_function(
            "() => !document.title.includes('One moment') && !document.title.includes('Just a moment')", 
            timeout=30000
        )
        time.sleep(2)
        page.wait_for_load_state("networkidle")
        print("[*] Challenge passed.")
    except Exception as e:
        print(f"[!] Cloudflare wait warning: {e}")

import argparse

def main():
    parser = argparse.ArgumentParser(description="BUBT Routine Downloader")
    parser.add_argument("--clean", action="store_true", help="Clear downloads directory before starting")
    args = parser.parse_args()

    # DO NOT clear directory anymore, to allow "Incremental" updates
    ensure_dir(DOWNLOAD_DIR, clear=args.clean)
    
    with sync_playwright() as p:
        print("[*] Launching browser (Headless mode for PDF Generation)...")
        browser = p.chromium.launch(headless=True, args=["--disable-blink-features=AutomationControlled"])
        context = browser.new_context(
            user_agent=USER_AGENT,
            viewport={'width': 1280, 'height': 800},
            ignore_https_errors=True
        )
        
        page = context.new_page()
        page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined})")
        
        print(f"[*] Navigating to Routines page: {BASE_URL}")
        try:
            page.goto(BASE_URL, timeout=60000)
            wait_for_challenge(page)
        except Exception as e:
            print(f"[-] Navigation failed: {e}")
            return

        # --- Extraction ---
        print("[*] Extracting routines from table...")
        routines_data = page.evaluate("""
            () => {
                const rows = Array.from(document.querySelectorAll('tr'));
                const results = [];
                
                rows.forEach(row => {
                    const links = Array.from(row.querySelectorAll('a'));
                    if (links.length === 0) return;
                    
                    const cellsText = Array.from(row.cells).map(c => c.innerText.trim());
                    if (cellsText.length < 2) return;
                    
                    // Filter out rows that are clearly just headers or notices
                    if (cellsText[0].toLowerCase().includes('sl') || cellsText[0].toLowerCase().includes('no')) return;

                    const rowDescription = cellsText.join(' ');
                    
                    const routineLinks = links.filter(a => {
                        const h = a.href.toLowerCase();
                        const t = a.innerText.toLowerCase();
                        return h.includes('.pdf') || h.includes('routine.php') || t.includes('view') || t.includes('download');
                    });
                    
                    if (routineLinks.length > 0) {
                        const bestLink = routineLinks.find(a => a.href.toLowerCase().endsWith('.pdf')) || routineLinks[0];
                        results.push({
                            description: rowDescription,
                            href: bestLink.href
                        });
                    }
                });
                return results;
            }
        """)
        
        print(f"[*] Identified {len(routines_data)} unique routines.")

        used_names = set()
        
        for routine in routines_data:
            url = routine['href']
            desc = routine['description']
            
            if not url.startswith("http"): continue
            
            # Name generation
            clean_desc = re.sub(r'(View|Download|Click|Here)', '', desc, flags=re.I).strip()
            clean_desc = re.sub(r'\s+', ' ', clean_desc)
            clean_name = sanitize_filename(clean_desc) or "routine"
            
            fname = f"{clean_name}.pdf"
            base, ext = os.path.splitext(fname)
            c = 1
            while fname in used_names:
                fname = f"{base}_{c}{ext}"
                c += 1
            used_names.add(fname)
            
            pdf_path = os.path.join(DOWNLOAD_DIR, fname)
            if os.path.exists(pdf_path) and os.path.getsize(pdf_path) > 5000:
                print(f"    [=] Already exists: {fname} (Skipping)")
                continue

            print(f"[>] Processing: {fname}")
            try:
                if "routine.php" in url:
                    print("    [*] Rendering Annex Routine Page...")
                    sub_page = context.new_page()
                    # Use a long timeout and wait for load
                    sub_page.goto(url, timeout=90000, wait_until="load")
                    
                    # --- VITAL: Wait for actual content to appear ---
                    # Annex pages are often empty until an AJAX call finishes.
                    # We check for a table that has more than just the header or a "Not Found" message.
                    try:
                        # Wait for a table with rows that aren't empty
                        # Better: Wait for any text related to a schedule (e.g., 'Saturday', '08:30', etc.)
                        # Or just wait for the loading spinner to disappear if it exists.
                        # For now, let's wait specifically for a 'table' to exist and have content.
                        sub_page.wait_for_selector("table tr td", timeout=15000)
                        
                        # Check if it says "No data found" or similar
                        content = sub_page.content().lower()
                        if "no data found" in content or "routine not found" in content or "no routine found" in content:
                            print(f"    [-] Skipping: Page says 'No data found'.")
                            sub_page.close()
                            continue
                            
                        # Extra stability wait for rendering
                        time.sleep(2)
                        
                        pdf_path = os.path.join(DOWNLOAD_DIR, fname)
                        # We use screen media to ensure we see what a user sees, 
                        # as some 'print' CSS might be broken or hide things.
                        sub_page.emulate_media(media="screen")
                        sub_page.pdf(path=pdf_path, format="A4", print_background=True)
                        
                        # Check file size. If < 5KB, it's likely a blank/error page.
                        if os.path.exists(pdf_path) and os.path.getsize(pdf_path) < 5000:
                             print(f"    [!] Warning: Generated PDF is very small ({os.path.getsize(pdf_path)} bytes). Possibly blank.")
                        else:
                             print(f"    [+] Saved ({os.path.getsize(pdf_path)} bytes).")
                    except Exception as wait_err:
                        print(f"    [-] Skipping: Content did not load in time (Timeout).")
                    
                    sub_page.close()
                else:
                    # Standard PDF Download
                    resp = context.request.get(url)
                    if resp.status == 200:
                        body = resp.body()
                        if body.startswith(b"%PDF-"):
                            with open(os.path.join(DOWNLOAD_DIR, fname), "wb") as f:
                                f.write(body)
                            print(f"    [+] Downloaded direct PDF ({len(body)} bytes).")
                        else:
                            print(f"    [-] Skipping: URL did not return a valid PDF signature.")
                    else:
                        print(f"    [-] Failed download: status {resp.status}")
            except Exception as e:
                print(f"    [-] Error: {e}")

        print("\n[*] Scrape finished. Files are in 'downloads' folder.")
        browser.close()

if __name__ == "__main__":
    main()
