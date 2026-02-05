import pdfplumber
import fitz  # PyMuPDF
import os
import re
import json

def normalize_program_name(name, is_evening_file=False):
    if not name: return "Unknown"
    
    # Remove leading dots, numbers, underscores (e.g. 10_B.Sc)
    name = re.sub(r'^[\d_\.\s]+', '', name)
    
    # Standardize spaces and dots
    name = name.replace('_', ' ').replace('\n', ' ').strip()
    name = re.sub(r'\s+', ' ', name)
    
    # Mapping for strict normalization
    mapping = {
        r'B\.?\s*A\.?\s*\(?Hons\)?\s*in\s*English': 'B.A. (Hons) in English',
        r'B\.?\s*S\.?c\.?\s*\(?Hons\)?\s*in\s*Economics': 'B.Sc. (Hons) in Economics',
        r'B\.?\s*S\.?c\.?\s*(Engg\.?|Engineering)?\s*in\s*CSE(\s*\(?Evening\)?)?': 'B.Sc. in CSE',
        r'B\.?\s*S\.?c\.?\s*(Engg\.?|Engineering)?\s*in\s*EEE(\s*\(?Evening\)?)?': 'B.Sc. in EEE',
        r'B\.?S\.?c\.?\s*in\s*Civil\s*(Engg\.?|Engineering)?': 'B.Sc. in Civil Engineering',
        r'B\.?S\.?c\.?\s*in\s*Textile\s*(Engg\.?|Engineering)?': 'B.Sc. in Textile Engineering',
        r'BBA': 'BBA',
        r'MBA': 'MBA',
        r'Executive\s*MBA': 'Executive MBA',
        r'LL\.?\s*B\.?\s*\(?Hons\)?': 'LL.B (Hons)',
        r'M\.?S\.?c\.?\s*in\s*Economics': 'M.Sc. in Economics',
        r'MA\s*in\s*ELT': 'MA in ELT',
        r'MA\s*in\s*English': 'MA in English',
        r'M\.?B\.?A': 'MBA',
    }
    
    final_name = name
    matched_canonical = None
    for pattern, canonical in mapping.items():
        if re.search(pattern, name, re.I):
            final_name = canonical
            matched_canonical = canonical
            break
            
    if is_evening_file and matched_canonical:
        if any(x in matched_canonical for x in ["CSE", "EEE", "Civil", "Textile"]):
            if "Evening" not in final_name:
                final_name += " (Evening)"
                
    if "1 Year" in name and "MA in ELT" in final_name:
        final_name = "MA in ELT"
            
    return final_name.strip()

def process_pdf(filepath):
    data_list = []
    base_name = os.path.basename(filepath).replace('.pdf', '')
    is_evening = "evening" in base_name.lower()
    
    # Script is now in .scripts/, so go up to root, then to storage/routines
    base_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "routines")
    imgs_dir = os.path.join(base_dir, "routine_images")
    pages_dir = os.path.join(base_dir, "routine_pages")
    
    for d in [imgs_dir, pages_dir]:
        if not os.path.exists(d): os.makedirs(d)

    doc = fitz.open(filepath)
    with pdfplumber.open(filepath) as pdf:
        for i, page in enumerate(pdf.pages):
            text = page.extract_text() or ""
            meta_block = text[:600]
            
            prog_match = re.search(r"Program:\s*(.*?)(?=\s*Intake:|$)", meta_block, re.I | re.S)
            raw_prog = prog_match.group(1).strip() if prog_match else base_name
            prog = normalize_program_name(raw_prog, is_evening)
            
            itk_sec_pairs = re.findall(r"Intake:\s*(\d+)(?:\s*-\s*|\s+Section:\s*|\s+)(\d+)", meta_block, re.I)
            if not itk_sec_pairs:
                ints = re.findall(r"Intake:\s*(\d+)", meta_block, re.I)
                secs = re.findall(r"Section:\s*(\d+)", meta_block, re.I)
                itk_sec_pairs = [(ints[idx], secs[idx] if idx < len(secs) else "1") for idx in range(len(ints))]

            if not itk_sec_pairs: continue

            safe_base = re.sub(r'[^\w\-]', '_', base_name)
            
            # Save Image (For viewing)
            img_filename = f"{safe_base}_p{i+1}.png"
            img_path = os.path.join(imgs_dir, img_filename)
            if not os.path.exists(img_path):
                pix = doc[i].get_pixmap(matrix=fitz.Matrix(2.2, 2.2))
                pix.save(img_path)

            # Save Single-Page PDF (For download)
            pdf_filename = f"{safe_base}_p{i+1}.pdf"
            pdf_path = os.path.join(pages_dir, pdf_filename)
            if not os.path.exists(pdf_path):
                new_doc = fitz.open()
                new_doc.insert_pdf(doc, from_page=i, to_page=i)
                new_doc.save(pdf_path)
                new_doc.close()

            for itk, sec in itk_sec_pairs:
                data_list.append({
                    "program": prog,
                    "intake": itk,
                    "section": sec,
                    "image": f"routine_images/{img_filename}",
                    "pdf": f"routine_pages/{pdf_filename}",
                    "tables": page.extract_tables()
                })
    doc.close()
    return data_list

def main():
    # Script is now in .scripts/, so go up to root, then to storage/routines
    DOWNLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "storage", "routines")
    # Ensure sub-folders exist without clearing them
    for sub in ["routine_images", "routine_pages"]:
        d = os.path.join(DOWNLOAD_DIR, sub)
        if not os.path.exists(d):
            os.makedirs(d)
    
    all_results = []
    for f in os.listdir(DOWNLOAD_DIR):
        if f.lower().endswith(".pdf") and "_" in f: # Heuristic to ignore generated pdfs if they leak
            if "routine_pages" in f: continue
            print(f"[*] Parsing {f}...")
            path = os.path.join(DOWNLOAD_DIR, f)
            try:
                all_results.extend(process_pdf(path))
            except Exception as e:
                print(f"[!] Error: {e}")
            
    seen = set()
    final_db = []
    for item in all_results:
        key = (item['program'], item['intake'], item['section'], item['image'])
        if key not in seen:
            final_db.append(item)
            seen.add(key)
            
    final_db = [x for x in final_db if x['intake'] != "Unknown" and x['program'] != "Unknown"]
    final_db.sort(key=lambda x: (x['program'], int(x['intake']) if x['intake'].isdigit() else 0))

    db_path = os.path.join(DOWNLOAD_DIR, "routine_db.json")
    with open(db_path, "w", encoding="utf-8") as f:
        json.dump(final_db, f, indent=2)
    
    print(f"[+] Indexing complete. Total {len(final_db)} entries with image and pdf support.")

if __name__ == "__main__":
    main()
