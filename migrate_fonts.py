import os
import re

SRC_DIR = r'd:\OLD BACKUP\Desktop\vibem\vibemap-frontend\vibemap-frontend\src'

def migrate_fonts():
    modified_files = []
    
    for root, _, files in os.walk(SRC_DIR):
        for file in files:
            if file.endswith(('.jsx', '.tsx', '.js', '.ts', '.css')):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                orig_content = content
                
                # Replace font import URLs
                content = re.sub(
                    r"@import url\('https://fonts\.googleapis\.com/css2\?[^']+'\);",
                    "@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap');",
                    content
                )
                
                # Replace fontFamily usages
                content = re.sub(
                    r"fontFamily:\s*['\"]Syne(?:,\s*Inter)?,\s*sans-serif['\"]",
                    "fontFamily: \"'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif\"",
                    content
                )
                content = re.sub(
                    r"font-family:\s*['\"]Syne['\"],\s*sans-serif;",
                    "font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;",
                    content
                )
                content = re.sub(
                    r"fontFamily:\s*['\"]Syne['\"]",
                    "fontFamily: \"'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Inter', sans-serif\"",
                    content
                )

                if content != orig_content:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    modified_files.append(file_path)
                    print(f"Updated font in: {file}")

    print(f"\nDone! Updated {len(modified_files)} files.")

if __name__ == '__main__':
    migrate_fonts()
