"""Test 2D canvas interaction and 3D generation in stepped mode."""
from playwright.sync_api import sync_playwright
import time

def test_canvas():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        
        errors = []
        page.on("console", lambda msg: errors.append(msg.text) if msg.type == "error" else None)
        
        page.goto("http://localhost:3000")
        page.wait_for_load_state("networkidle")
        time.sleep(2)
        
        # Switch to stepped mode
        page.locator("text=自定义阶梯底座").click()
        time.sleep(1)
        
        # Make sure we're on 2D edit view
        tab_2d = page.locator("text=2D 编辑")
        if tab_2d.count() > 0:
            tab_2d.first.click()
            time.sleep(0.5)
        
        # Add slots
        page.locator("button:text-is('25')").first.click()
        time.sleep(0.3)
        page.locator("button:text-is('32')").first.click()
        time.sleep(0.3)
        page.locator("button:text-is('60x35.5')").first.click()
        time.sleep(0.5)
        
        page.screenshot(path="/tmp/canvas_2d_slots.png")
        print("Added 3 slots to canvas")

        # Find the canvas element
        canvas = page.locator("canvas").first
        if canvas.count() > 0:
            box = canvas.bounding_box()
            if box:
                print(f"Canvas found: {box['width']}x{box['height']} at ({box['x']}, {box['y']})")
                
                # Click on canvas to try selecting a slot
                center_x = box['x'] + box['width'] / 2
                center_y = box['y'] + box['height'] / 2
                page.mouse.click(center_x, center_y)
                time.sleep(0.5)
                page.screenshot(path="/tmp/canvas_click.png")
                print("Clicked center of canvas")
                
                # Check if slot selection appeared
                wall_height = page.locator("text=墙高")
                if wall_height.count() > 0:
                    print("Slot selected - wallHeight editor visible! ✓")
                else:
                    print("No slot selected at center (may need to click on exact slot position)")
        else:
            print("No canvas element found!")
        
        # Generate 3D model
        page.locator("text=开始锻造").first.click()
        time.sleep(5)
        page.screenshot(path="/tmp/canvas_3d_result.png")
        
        # Check if 3D viewer is now showing
        # The app should auto-switch to 3D after generation
        tab_3d_active = page.locator("[data-state='active']:has-text('3D 预览')")
        if tab_3d_active.count() > 0:
            print("3D view auto-activated after generation ✓")
        else:
            print("3D view status unclear - checking tab state")
            # Try clicking 3D preview
            page.locator("text=3D 预览").first.click()
            time.sleep(1)
            page.screenshot(path="/tmp/canvas_3d_manual.png")
            print("Manually switched to 3D view")
        
        # Check pricing info appeared
        price_el = page.locator("text=¥")
        if price_el.count() > 0:
            texts = price_el.all_text_contents()
            print(f"Price elements: {texts[:3]}")
        
        weight_el = page.locator("text=估重")
        if weight_el.count() > 0:
            texts = weight_el.all_text_contents()
            print(f"Weight elements: {texts[:3]}")
        
        if errors:
            print(f"\n❌ Console errors: {errors[:3]}")
        else:
            print("\n✓ No console errors")
        
        browser.close()

if __name__ == "__main__":
    test_canvas()
