#!/usr/bin/env python3

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title URL to Markdown Converter
# @raycast.mode silent
# @raycast.packageName Clipboard Utils

# Optional parameters:
# @raycast.icon 📄
# @raycast.description Convert URL in clipboard to Markdown and copy back

# Documentation:
# @raycast.author lyohe
# @raycast.authorURL https://github.com/lyohe

import subprocess
import sys
import os
import re
from urllib.parse import urlparse

# Check if required packages are installed
try:
    import requests
    from bs4 import BeautifulSoup
    import html2text
except ImportError:
    print("Error: Required packages are not installed.", file=sys.stderr)
    print("Please run: pip install -r scripts/requirements.txt", file=sys.stderr)
    print("Or: pip install requests beautifulsoup4 html2text", file=sys.stderr)
    sys.exit(1)

def get_clipboard_content():
    """Get content from clipboard"""
    return subprocess.check_output(['pbpaste']).decode('utf-8').strip()

def set_clipboard_content(content):
    """Set content to clipboard"""
    process = subprocess.Popen(['pbcopy'], stdin=subprocess.PIPE)
    process.communicate(content.encode('utf-8'))

def is_valid_url(string):
    """Check if string is a valid URL"""
    try:
        result = urlparse(string)
        return all([result.scheme, result.netloc])
    except (ValueError, TypeError, AttributeError):
        # ValueError: Invalid URL format
        # TypeError: Input is not a string
        # AttributeError: Input lacks required attributes
        return False

def post_process_markdown(markdown):
    """Post-process markdown to fix common issues"""
    # Fix multiple consecutive blank lines
    markdown = re.sub(r'\n{3,}', '\n\n', markdown)
    
    # Fix data: URLs in markdown image syntax
    markdown = re.sub(r'!\[([^\]]*)\]\(data:[^)]+\)', r'[\1]', markdown)
    
    # Fix empty link texts [](url) -> [link](url)
    markdown = re.sub(r'\[\]\(([^)]+)\)', r'[link](\1)', markdown)
    
    # Fix malformed links like [text](</path>) -> [text](/path)
    markdown = re.sub(r'\]\(<(/[^>)]+)>\)', r'](\1)', markdown)
    
    # Remove any remaining data: URLs
    markdown = re.sub(r'data:image/[^;\s]+;base64,[^\s]+', '[inline image]', markdown)
    
    # Fix excessive underscore escaping
    # Replace escaped underscores with regular underscores
    markdown = markdown.replace(r'\_', '_')
    
    # Remove standalone numbers or special characters (likely from icons)
    markdown = re.sub(r'^[\s]*\d{1,3}[\s]*$', '', markdown, flags=re.MULTILINE)
    markdown = re.sub(r'^[\s]*[^\w\s]{1,3}[\s]*$', '', markdown, flags=re.MULTILINE)
    
    # Remove common icon patterns including underscores
    markdown = re.sub(r'[\s]*_{1,3}[\s]*(?:\d+)?[\s]*', ' ', markdown)
    markdown = re.sub(r'_{2,}', '', markdown)  # Remove multiple underscores
    
    # Fix SVG/encoded content in links
    # Pattern: [[text]%encoded_stuff)](/path) -> [text](/path)
    markdown = re.sub(r'\[\[([^\]]+)\][^\)]*\)\]\(([^)]+)\)', r'[\1](\2)', markdown)
    
    # Remove duplicate link patterns
    markdown = re.sub(r'\[link\]\(([^)]+)\)\s*\[link\]\(\1\)', r'[link](\1)', markdown)
    
    # Clean up extra blank lines again
    markdown = re.sub(r'\n{3,}', '\n\n', markdown)
    
    return markdown.strip()

def url_to_markdown(url):
    """Convert webpage at URL to Markdown"""
    try:
        # Set headers to avoid being blocked
        headers = {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        
        # Fetch the webpage
        response = requests.get(url, headers=headers, timeout=30)
        response.raise_for_status()
        
        # Parse HTML
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Remove script, style, and nav elements
        for element in soup(['script', 'style', 'nav', 'header', 'footer']):
            element.decompose()
        
        # Get page title
        title = soup.find('title')
        title_text = title.get_text(strip=True) if title else "Untitled"
        
        # Configure html2text
        h = html2text.HTML2Text()
        h.ignore_links = False
        h.ignore_images = False
        h.ignore_emphasis = False
        h.body_width = 0  # Don't wrap lines
        h.unicode_snob = True
        h.skip_internal_links = True
        h.ignore_tables = False
        
        # Try to find main content area
        main_content = None
        for selector in ['main', 'article', '[role="main"]', '.main-content', '#main-content', '.content', '#content']:
            if isinstance(selector, str) and selector.startswith(('.', '#', '[')):
                # CSS selector
                main_content = soup.select_one(selector)
            else:
                # Tag name
                main_content = soup.find(selector)
            
            if main_content:
                break
        
        # If no main content found, try to get body or use whole soup
        if not main_content:
            main_content = soup.find('body') or soup
        
        # Convert to markdown
        try:
            markdown = h.handle(str(main_content))
        except Exception as e:
            # Fallback: try with simpler approach
            markdown = h.handle(main_content.get_text())
        
        # Post-process the markdown
        markdown = post_process_markdown(markdown)
        
        # Add metadata at the top
        result = f"# {title_text}\n\n"
        result += f"**URL**: {url}\n\n"
        result += "---\n\n"
        result += markdown
        
        return result
        
    except requests.RequestException as e:
        return f"Error fetching URL: {str(e)}"
    except Exception as e:
        # Provide more detailed error information
        import traceback
        error_details = traceback.format_exc()
        return f"Error converting to Markdown: {str(e)}\n\nDetails:\n{error_details}"

def main():
    # Get clipboard content
    clipboard = get_clipboard_content()
    
    # Check if it's a valid URL
    if not is_valid_url(clipboard):
        print(f"Error: Clipboard does not contain a valid URL: '{clipboard}'", file=sys.stderr)
        sys.exit(1)
    
    # Convert URL to Markdown
    print(f"Converting {clipboard} to Markdown...")
    markdown = url_to_markdown(clipboard)
    
    # Check if conversion resulted in error
    if markdown.startswith("Error"):
        print(markdown, file=sys.stderr)
        sys.exit(1)
    
    # Set clipboard with Markdown content
    set_clipboard_content(markdown)
    print("✅ Markdown copied to clipboard")

if __name__ == "__main__":
    main()