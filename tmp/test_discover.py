"""Discover UI elements in stepped mode panel."""
from playwright.sync_api import sync_playwright
import time

def discover_panel():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        
        page.goto("http://localhost:3000")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        
        # Click stepped tab
        page.locator("text=自定义阶梯底座").click()
        time.sleep(1)
        
        # Get all visible button text
        buttons = page.locator("button").all()
        print(f"Total buttons found: {len(buttons)}")
        for i, btn in enumerate(buttons[:30]):
            try:
                text = btn.inner_text(timeout=1000)
                visible = btn.is_visible()
                if text.strip():
                    print(f"  Button {i}: '{text.strip()[:50]}' visible={visible}")
            except:
                pass
        
        # Get all labels  
        labels = page.locator("label, span, p, h3, h4").all()
        print(f"\nTotal text elements: {len(labels)}")
        for i, el in enumerate(labels[:40]):
            try:
                text = el.inner_text(timeout=1000)
                visible = el.is_visible()
                if text.strip() and visible:
                    print(f"  Label {i}: '{text.strip()[:60]}'")
            except:
                pass
        
        # Look at the panel area specifically - the left side
        # Check if there's a scrollable panel
        panel = page.locator("[class*='overflow-y-auto']").first
        if panel.count() > 0:
            print("\nScrollable panel found, scrolling down...")
            panel.evaluate("el => el.scrollTop = 500")
            time.sleep(0.5)
            page.screenshot(path="/tmp/10_scrolled.png", full_page=False)
        
        # Take a full-page screenshot with higher viewport
        page.set_viewport_size({"width": 1440, "height": 2000})
        time.sleep(0.5)
        page.screenshot(path="/tmp/11_full.png", full_page=True)
        
        browser.close()

if __name__ == "__main__":
    discover_panel()
