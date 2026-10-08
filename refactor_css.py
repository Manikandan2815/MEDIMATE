import re
import sys

def refactor_css(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        css = f.read()

    # 1. Remove all backdrop-filter lines
    css = re.sub(r'([ \t]*-webkit-backdrop-filter:[^;]+;)', r'/* \1 */', css)
    css = re.sub(r'([ \t]*backdrop-filter:[^;]+;)', r'/* \1 */', css)
    
    # 2. Remove text-shadow that uses neon variables
    css = re.sub(r'([ \t]*text-shadow:[^;]*var\(--neon-[^;]+;)', r'/* \1 */', css)
    
    # 3. Remove box-shadow that uses neon variables
    css = re.sub(r'([ \t]*box-shadow:[^;]*var\(--neon-[^;]+;)', r'/* \1 */', css)
    
    # 4. Remove heavy glass-shadow
    css = re.sub(r'([ \t]*box-shadow:[^;]*var\(--glass-shadow\);)', r'/* \1 */\n  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1);', css)

    # 5. Overhaul SVG glow filters inside CSS
    css = re.sub(r'([ \t]*filter:[^;]*url\(#splashGlow\);)', r'/* \1 */', css)
    css = re.sub(r'([ \t]*filter:[^;]*drop-shadow[^;]+;)', r'/* \1 */', css)

    # 6. Make border radii more clinical
    css = css.replace('--radius-xl: 24px', '--radius-xl: 16px')
    css = css.replace('--radius-lg: 16px', '--radius-lg: 12px')
    css = css.replace('--radius-md: 12px', '--radius-md: 8px')
    css = css.replace('--radius-sm: 8px', '--radius-sm: 6px')
    
    # 7. Remove glow background colors for active states (replace with softer background)
    css = re.sub(r'([ \t]*background:[^;]*var\(--neon-[^;]+;)', r'/* \1 */', css)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(css)
    print("CSS refactored successfully.")

if __name__ == "__main__":
    refactor_css("public/css/styles.css")
