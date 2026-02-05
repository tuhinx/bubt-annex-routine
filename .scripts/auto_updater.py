import subprocess
import time
import schedule
import os
import sys

def run_sync():
    """Executes the routine update pipeline."""
    print(f"\n[{time.strftime('%Y-%m-%d %H:%M:%S')}] Starting Auto-Update...")
    
    try:
        # Step 1: Download new routines from BUBT website
        print("[*] Checking for new PDFs on BUBT website...")
        script_dir = os.path.dirname(os.path.abspath(__file__))
        sniper_path = os.path.join(script_dir, "routine_sniper.py")
        indexer_path = os.path.join(script_dir, "routine_indexer.py")
        
        subprocess.run([sys.executable, sniper_path], check=True)
        
        # Step 2: Index and process new data
        print("[*] Processing and re-indexing routines...")
        subprocess.run([sys.executable, indexer_path], check=True)
        
        print(f"[+] Update Successful! {time.strftime('%Y-%m-%d %H:%M:%S')}")
    except Exception as e:
        print(f"[!] Update Failed: {e}")

def main():
    print("="*50)
    print(" BUBT ROUTINE AUTO-UPDATE SERVICE ")
    print("="*50)
    print("[*] Service is running in background.")
    print("[*] Checking for updates every 24 hours.")
    print("[*] Press Ctrl+C to stop.")
    
    # Run once immediately on start
    run_sync()
    
    # Schedule to run every day at 04:00 AM (or every 24 hours from now)
    schedule.every(24).hours.do(run_sync)
    
    while True:
        schedule.run_pending()
        time.sleep(60)

if __name__ == "__main__":
    # Ensure dependencies are installed
    try:
        import schedule
    except ImportError:
        print("[*] Installing schedule library...")
        subprocess.run([sys.executable, "-m", "pip", "install", "schedule"], check=True)
        import schedule
        
    main()
