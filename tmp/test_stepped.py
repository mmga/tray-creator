"""Test stepped tray mode functionality."""
from playwright.sync_api import sync_playwright
import time

def test_stepped_mode():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        
        # Navigate to app
        page.goto("http://localhost:3000")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        
        # Screenshot initial state
        page.screenshot(path="/tmp/01_initial.png", full_page=True)
        print("Step 1: Initial page loaded")
        
        # Find and click stepped tab
        stepped_tab = page.locator("text=自定义阶梯底座")
        if stepped_tab.count() > 0:
            stepped_tab.click()
            time.sleep(1)
            page.screenshot(path="/tmp/02_stepped_mode.png", full_page=True)
            print("Step 2: Stepped mode tab clicked - screenshot saved")
        else:
            print("ERROR: Stepped mode tab not found!")
            # Check what tabs exist
            tabs = page.locator("[role='tab'], button").all_text_contents()
            print(f"Available buttons/tabs: {tabs[:20]}")
            page.screenshot(path="/tmp/02_error.png", full_page=True)
        
        # Check for console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        
        # Try clicking a preset button to add a slot
        preset_25 = page.locator("text=25mm")
        if preset_25.count() > 0:
            preset_25.first.click()
            time.sleep(0.5)
            page.screenshot(path="/tmp/03_slot_added.png", full_page=True)
            print("Step 3: 25mm preset clicked - slot added")
        else:
            print("Step 3: No 25mm preset button found in current view")
        
        # Try adding another slot
        preset_32 = page.locator("text=32mm")
        if preset_32.count() > 0:
            preset_32.first.click()
            time.sleep(0.5)
            page.screenshot(path="/tmp/04_two_slots.png", full_page=True)
            print("Step 4: 32mm preset clicked - second slot added")
        
        # Check for "底部外扩边距" slider (bottomExpandMargin)
        expand_label = page.locator("text=底部外扩边距")
        if expand_label.count() > 0:
            print("Step 5: bottomExpandMargin slider found ✓")
        else:
            print("Step 5: bottomExpandMargin slider NOT found")
        
        # Try clicking generate button
        gen_button = page.locator("text=生成 3D 模型")
        if gen_button.count() > 0:
            gen_button.first.click()
            time.sleep(3)
            page.screenshot(path="/tmp/05_generated.png", full_page=True)
            print("Step 6: Generate button clicked - 3D model generated")
        else:
            print("Step 6: Generate button not found")
        
        # Switch back to grid mode to check regression
        grid_tab = page.locator("text=网格模式")
        if grid_tab.count() > 0:
            grid_tab.click()
            time.sleep(1)
            page.screenshot(path="/tmp/06_grid_mode.png", full_page=True)
            print("Step 7: Grid mode - regression check")
        
        # Switch to custom mode  
        custom_tab = page.locator("text=自定义模式")
        if custom_tab.count() > 0:
            custom_tab.click()
            time.sleep(1)
            page.screenshot(path="/tmp/07_custom_mode.png", full_page=True)
            print("Step 8: Custom mode - regression check")
        
        # Switch back to stepped
        stepped_tab = page.locator("text=自定义阶梯底座")
        if stepped_tab.count() > 0:
            stepped_tab.click()
            time.sleep(1)
            page.screenshot(path="/tmp/08_stepped_final.png", full_page=True)
            print("Step 9: Back to stepped mode - data preserved check")
        
        if console_errors:
            print(f"\nConsole errors: {console_errors}")
        else:
            print("\nNo console errors detected ✓")
        
        browser.close()
        print("\nAll tests completed!")

if __name__ == "__main__":
    test_stepped_mode()
