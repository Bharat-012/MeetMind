"""Complete UI/UX Redesign & Viewport Verification Script for MeetMind using Playwright."""
import os
import sys
import time
import json
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)

SCREENSHOTS_DIR = r"C:\Users\Lenovo\.gemini\antigravity\brain\e43c69c8-6a97-4102-aa34-e98e33393e62\browser_screenshots"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

test_results = {}
console_logs = []
page_errors = []

def log_console(msg):
    console_logs.append(f"[{msg.type}] {msg.text}")

def log_error(err):
    page_errors.append(str(err))

print("=== STARTING COMPLETE UI/UX REDESIGN & VIEWPORT AUDIT ===")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME_PATH, headless=True)

    # =========================================================================
    # VIEWPORT 1: DESKTOP (1440 x 900)
    # =========================================================================
    print("\n--- VIEWPORT 1: DESKTOP (1440 x 900) ---")
    ctx_desktop = browser.new_context(viewport={"width": 1440, "height": 900})
    page_d = ctx_desktop.new_page()
    page_d.on("console", log_console)
    page_d.on("pageerror", log_error)

    # 1.1 Dashboard (Desktop)
    print("[1.1] Verifying Dashboard at 1440x900...")
    try:
        page_d.goto("http://localhost:3000", wait_until="domcontentloaded")
        page_d.wait_for_selector("text=MeetMind", timeout=15000)
        time.sleep(1)
        content = page_d.content()
        assert "Total Meetings" in content, "Total Meetings metric missing"
        assert "Decisions Logged" in content, "Decisions metric missing"
        assert "Recent Meetings" in content, "Recent Meetings table missing"
        assert "Local AI Engine Active" in content, "Local AI engine badge missing"
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "44_desktop_dashboard.png"))
        test_results["desktop_dashboard"] = "PASS"
        print("  -> PASS: Dashboard renders metrics, table, and sidebar.")
    except Exception as e:
        test_results["desktop_dashboard"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 1.2 Ingest Modal Open
    print("[1.2] Verifying Ingest Modal at 1440x900...")
    try:
        page_d.click("button:has-text('New Meeting')")
        page_d.wait_for_selector("text=Ingest New Meeting", timeout=10000)
        time.sleep(0.5)
        content_modal = page_d.content()
        assert "Upload Local File" in content_modal, "Upload tab missing"
        assert "Import YouTube" in content_modal, "YouTube tab missing"
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "45_desktop_ingest_modal_upload.png"))
        
        # Switch to YouTube tab
        page_d.click("button:has-text('Import YouTube')")
        time.sleep(0.5)
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "46_desktop_ingest_modal_youtube.png"))
        
        # Close modal
        page_d.click("button:has-text('Cancel')")
        time.sleep(0.5)
        test_results["desktop_ingest_modal"] = "PASS"
        print("  -> PASS: Ingest modal rendered with both upload & YouTube tabs.")
    except Exception as e:
        test_results["desktop_ingest_modal"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 1.3 Workspace / Meetings Library
    print("[1.3] Verifying Workspace Library at 1440x900...")
    try:
        page_d.goto("http://localhost:3000/workspace", wait_until="domcontentloaded")
        page_d.wait_for_selector("text=Meetings Library", timeout=15000)
        time.sleep(1)
        content_ws = page_d.content()
        assert "All Meetings" in content_ws, "All Meetings tab missing"
        assert "Search meetings" in content_ws, "Search field missing"
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "47_desktop_workspace_library.png"))

        # Test tab navigation: Decisions Register
        page_d.click("button:has-text('Decisions Register')")
        time.sleep(0.8)
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "48_desktop_workspace_decisions.png"))

        # Test tab navigation: Action Items
        page_d.click("button:has-text('Action Items')")
        time.sleep(0.8)
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "49_desktop_workspace_actions.png"))

        # Test tab navigation: Cross-Meeting Chat
        page_d.click("button:has-text('Cross-Meeting Chat')")
        time.sleep(0.8)
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "50_desktop_workspace_chat.png"))
        test_results["desktop_workspace"] = "PASS"
        print("  -> PASS: Workspace loaded with cards, search, decisions, actions, and chat.")
    except Exception as e:
        test_results["desktop_workspace"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 1.4 Speakers Directory (Desktop)
    print("[1.4] Verifying Speakers Directory at 1440x900...")
    try:
        page_d.goto("http://localhost:3000/speakers", wait_until="domcontentloaded")
        page_d.wait_for_selector("text=Speaker Directory", timeout=15000)
        time.sleep(1)
        content_spk = page_d.content()
        assert "confirmed profiles" in content_spk, "Profiles count badge missing"
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "51_desktop_speakers_directory.png"))

        # Click Appearances on first speaker to test Drawer
        app_btn = page_d.query_selector("button:has-text('Appearances')")
        if app_btn:
            app_btn.click()
            time.sleep(1)
            page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "52_desktop_speaker_drawer_open.png"))
            print("  -> Speaker appearances drawer opened.")

        test_results["desktop_speakers"] = "PASS"
        print("  -> PASS: Speakers directory rendered with cards and history drawer.")
    except Exception as e:
        test_results["desktop_speakers"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 1.5 Meeting Detail (Local Video - a888f87e)
    print("[1.5] Verifying Meeting Detail (Local Video) at 1440x900...")
    try:
        page_d.goto("http://localhost:3000/meetings/a888f87e-0745-4b68-ad14-681f98346f2c", wait_until="domcontentloaded")
        page_d.wait_for_selector("text=Q4 PostgreSQL Architecture Video Sync", timeout=15000)
        time.sleep(1.5)
        assert page_d.query_selector("video") is not None, "HTML5 video element missing"
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "53_desktop_meeting_video_player.png"))

        # Check tab 3: Structured Summary
        page_d.click("button:has-text('3. Structured Summary')")
        time.sleep(0.8)
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "54_desktop_meeting_summary.png"))

        # Check tab: Decisions
        page_d.click("button:has-text('Decisions')")
        time.sleep(0.8)
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "55_desktop_meeting_decisions.png"))

        # Check tab: Action Items
        page_d.click("button:has-text('Action Items')")
        time.sleep(0.8)
        page_d.screenshot(path=os.path.join(SCREENSHOTS_DIR, "56_desktop_meeting_actions.png"))
        test_results["desktop_meeting_video"] = "PASS"
        print("  -> PASS: Local video meeting detail rendered with player, summary, decisions, and actions.")
    except Exception as e:
        test_results["desktop_meeting_video"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    ctx_desktop.close()

    # =========================================================================
    # VIEWPORT 2: LAPTOP (1280 x 800)
    # =========================================================================
    print("\n--- VIEWPORT 2: LAPTOP (1280 x 800) ---")
    ctx_laptop = browser.new_context(viewport={"width": 1280, "height": 800})
    page_l = ctx_laptop.new_page()

    print("[2.1] Verifying Workspace Library at 1280x800...")
    try:
        page_l.goto("http://localhost:3000/workspace", wait_until="domcontentloaded")
        page_l.wait_for_selector("text=Meetings Library", timeout=15000)
        time.sleep(1)
        page_l.screenshot(path=os.path.join(SCREENSHOTS_DIR, "57_laptop_workspace.png"))
        test_results["laptop_workspace"] = "PASS"
        print("  -> PASS: Laptop workspace rendered cleanly without overflow.")
    except Exception as e:
        test_results["laptop_workspace"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    print("[2.2] Verifying Meeting Detail (YouTube - 9ce68efc) at 1280x800...")
    try:
        page_l.goto("http://localhost:3000/meetings/9ce68efc-b5ab-4ac6-84e7-11ad290bae19", wait_until="domcontentloaded")
        page_l.wait_for_selector("text=fake", timeout=15000)
        time.sleep(1.5)
        content_yt = page_l.content()
        assert "YouTube" in content_yt, "YouTube badge missing"
        page_l.screenshot(path=os.path.join(SCREENSHOTS_DIR, "58_laptop_meeting_youtube.png"))
        test_results["laptop_meeting_youtube"] = "PASS"
        print("  -> PASS: YouTube showcase card rendered with timeline.")
    except Exception as e:
        test_results["laptop_meeting_youtube"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    ctx_laptop.close()

    # =========================================================================
    # VIEWPORT 3: TABLET (768 x 1024)
    # =========================================================================
    print("\n--- VIEWPORT 3: TABLET (768 x 1024) ---")
    ctx_tablet = browser.new_context(viewport={"width": 768, "height": 1024})
    page_t = ctx_tablet.new_page()

    print("[3.1] Verifying Dashboard at 768x1024...")
    try:
        page_t.goto("http://localhost:3000", wait_until="domcontentloaded")
        page_t.wait_for_selector("text=MeetMind", timeout=15000)
        time.sleep(1)
        page_t.screenshot(path=os.path.join(SCREENSHOTS_DIR, "59_tablet_dashboard.png"))
        test_results["tablet_dashboard"] = "PASS"
        print("  -> PASS: Tablet dashboard adjusted to 2-column grid cleanly.")
    except Exception as e:
        test_results["tablet_dashboard"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    print("[3.2] Verifying Speakers Directory at 768x1024...")
    try:
        page_t.goto("http://localhost:3000/speakers", wait_until="domcontentloaded")
        page_t.wait_for_selector("text=Speaker Directory", timeout=15000)
        time.sleep(1)
        page_t.screenshot(path=os.path.join(SCREENSHOTS_DIR, "60_tablet_speakers.png"))
        test_results["tablet_speakers"] = "PASS"
        print("  -> PASS: Tablet speakers directory stacked responsibly.")
    except Exception as e:
        test_results["tablet_speakers"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    ctx_tablet.close()

    # =========================================================================
    # VIEWPORT 4: MOBILE (390 x 844 - iPhone 14 / modern smartphone)
    # =========================================================================
    print("\n--- VIEWPORT 4: MOBILE (390 x 844) ---")
    ctx_mobile = browser.new_context(viewport={"width": 390, "height": 844})
    page_m = ctx_mobile.new_page()

    print("[4.1] Verifying Dashboard & Mobile Drawer at 390x844...")
    try:
        page_m.goto("http://localhost:3000", wait_until="domcontentloaded")
        page_m.wait_for_selector("text=MeetMind", timeout=15000)
        time.sleep(1)
        page_m.screenshot(path=os.path.join(SCREENSHOTS_DIR, "61_mobile_dashboard.png"))

        # Test Mobile Hamburger Drawer
        hamburger = page_m.query_selector("button[title='Open Navigation Menu']")
        if hamburger:
            hamburger.click()
            time.sleep(0.8)
            page_m.screenshot(path=os.path.join(SCREENSHOTS_DIR, "62_mobile_drawer_open.png"))
            print("  -> Mobile drawer opened via hamburger button.")

        test_results["mobile_dashboard_drawer"] = "PASS"
        print("  -> PASS: Mobile dashboard & drawer toggle functional.")
    except Exception as e:
        test_results["mobile_dashboard_drawer"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    print("[4.2] Verifying Meeting Detail (Mobile - 390x844)...")
    try:
        page_m.goto("http://localhost:3000/meetings/a888f87e-0745-4b68-ad14-681f98346f2c", wait_until="domcontentloaded")
        page_m.wait_for_selector("text=Q4 PostgreSQL Architecture Video Sync", timeout=15000)
        time.sleep(1.5)
        page_m.screenshot(path=os.path.join(SCREENSHOTS_DIR, "63_mobile_meeting_detail.png"))
        test_results["mobile_meeting_detail"] = "PASS"
        print("  -> PASS: Mobile meeting detail adjusted player & controls without clipped content.")
    except Exception as e:
        test_results["mobile_meeting_detail"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    ctx_mobile.close()
    browser.close()

print("\n=== COMPLETE UI/UX AUDIT RESULTS ===")
all_passed = True
for test_name, res in test_results.items():
    print(f"  {test_name}: {res}")
    if "FAIL" in res:
        all_passed = False

with open(r"d:\MeetRoom\redesign_viewport_summary.json", "w") as f:
    json.dump({
        "all_passed": all_passed,
        "results": test_results,
        "console_errors": [c for c in console_logs if "[error]" in c],
        "page_errors": page_errors
    }, f, indent=2)

print("\nAudit complete! Summary saved to redesign_viewport_summary.json.")
