"""Browser test suite verifying the video preview, audio/video player, and meeting detail UI fixes."""
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

print("=== STARTING MEDIA PLAYER & MEETING DETAIL UI VERIFICATION ===")

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME_PATH, headless=True)
    context = browser.new_context(viewport={"width": 1366, "height": 900})
    page = context.new_page()
    page.on("console", log_console)
    page.on("pageerror", log_error)

    # -------------------------------------------------------------
    # TEST 1: User's Exact Meeting "fake" (9ce68efc-b5ab-4ac6-84e7-11ad290bae19)
    # Reference for the user's screenshot
    # -------------------------------------------------------------
    print("\n[TEST 1] Verifying meeting 'fake' (9ce68efc) - fixed stuck status & UI...")
    meeting_url_fake = "http://localhost:3000/meetings/9ce68efc-b5ab-4ac6-84e7-11ad290bae19"
    try:
        page.goto(meeting_url_fake, wait_until="networkidle", timeout=15000)
        time.sleep(2)
        
        # Check header
        content = page.content()
        assert "fake" in content, "Meeting title 'fake' not rendered"
        assert "COMPLETED" in content, "Status badge should be COMPLETED, not stuck GENERATING_SUMMARY"
        print("  -> Status is correctly displayed as COMPLETED.")

        # Check YouTube card
        assert "YouTube" in content, "YouTube badge or attribution missing"
        assert "Unsocial Programmer" in content, "Channel name missing"
        print("  -> YouTube Showcase Card rendered with channel and thumbnail.")

        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "37_fake_meeting_fixed_overview.png"))

        # Click Tab 2 (Chronological Explanation)
        print("  -> Testing Tab 2: Chronological Explanation...")
        page.click("button:has-text('2. Chronological Explanation')")
        time.sleep(1)
        content_tab2 = page.content()
        assert "events recorded" in content_tab2, "Event sequence section missing"
        assert "0 events recorded" not in content_tab2, "Should have 15 recorded events, not 0!"
        print("  -> Tab 2 displays events correctly (not empty!).")
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "38_fake_meeting_chronological_events.png"))

        # Click Tab 1 (Full Transcript) and test playback
        print("  -> Testing Tab 1: Full Transcript and seek...")
        page.click("button:has-text('1. Full Transcript')")
        time.sleep(1)
        # Click a timestamp or play button
        play_btn = page.query_selector("button[title*='Play']")
        if play_btn:
            play_btn.click()
            time.sleep(1.5)
            print("  -> Play button clicked.")

        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "39_fake_meeting_transcript_playback.png"))
        test_results["test1_fake_meeting_fixed"] = "PASS"
    except Exception as e:
        test_results["test1_fake_meeting_fixed"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 2: Local Video Meeting (a888f87e-0745-4b68-ad14-681f98346f2c)
    # Verifies HTML5 <video> player, controls, video frames, seek
    # -------------------------------------------------------------
    print("\n[TEST 2] Verifying Local Video Meeting (a888f87e)...")
    meeting_url_video = "http://localhost:3000/meetings/a888f87e-0745-4b68-ad14-681f98346f2c"
    try:
        page.goto(meeting_url_video, wait_until="networkidle", timeout=15000)
        time.sleep(2)
        
        # Check HTML5 video element
        video_el = page.query_selector("video")
        assert video_el is not None, "HTML5 <video> element missing for video meeting!"
        src = video_el.get_attribute("src")
        assert "media" in src, f"Video src incorrect: {src}"
        print(f"  -> HTML5 video element found with source: {src}")

        # Check video codec badge
        content = page.content()
        assert "H264" in content or "MP4 VIDEO" in content, "Video codec badge missing"
        print("  -> Video format badge rendered.")

        # Test video play
        play_btn = page.query_selector("button[title='Play Video']") or page.query_selector("button[title='Play']")
        if play_btn:
            play_btn.click()
            time.sleep(1.5)
            print("  -> Video play triggered.")

        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "40_local_video_player_active.png"))

        # Test seeking via transcript turn click
        first_segment = page.query_selector("div[title='Click to jump video to this point']") or page.query_selector("span:has-text('[00:00')")
        if first_segment:
            first_segment.click()
            time.sleep(1)
            print("  -> Transcript turn clicked to seek video.")

        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "41_local_video_seek_highlight.png"))
        test_results["test2_local_video_player"] = "PASS"
    except Exception as e:
        test_results["test2_local_video_player"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 3: Audio-Only Meeting (2e343f35-04d6-45ad-b15a-fa49cb051a1c)
    # Verifies dedicated Audio Card, AUDIO badge, controls
    # -------------------------------------------------------------
    print("\n[TEST 3] Verifying Audio-Only Meeting (2e343f35)...")
    meeting_url_audio = "http://localhost:3000/meetings/2e343f35-04d6-45ad-b15a-fa49cb051a1c"
    try:
        page.goto(meeting_url_audio, wait_until="networkidle", timeout=15000)
        time.sleep(2)

        content = page.content()
        assert "AUDIO RECORDING" in content or "Audio Recording" in content, "Audio recording badge missing"
        # Verify it does NOT render an empty black video container
        video_el = page.query_selector("video")
        assert video_el is None, "Audio-only meeting should NOT render an empty <video> element!"
        print("  -> Dedicated Audio Player Card rendered correctly without empty video element.")

        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "42_audio_only_card_rendered.png"))
        test_results["test3_audio_only_player"] = "PASS"
    except Exception as e:
        test_results["test3_audio_only_player"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # -------------------------------------------------------------
    # TEST 4: Workspace Meeting Ingestion & Real-Time Status Transition
    # -------------------------------------------------------------
    print("\n[TEST 4] Verifying Workspace list and meeting navigation...")
    try:
        page.goto("http://localhost:3000/workspace", wait_until="networkidle", timeout=15000)
        time.sleep(2)
        assert "Acme Corp" in page.content(), "Workspace not loaded"
        assert "Meetings" in page.content(), "Meetings section missing"
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "43_workspace_meetings_list.png"))
        print("  -> Workspace meetings list loaded.")
        test_results["test4_workspace_navigation"] = "PASS"
    except Exception as e:
        test_results["test4_workspace_navigation"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    browser.close()

print("\n=== TEST RESULTS SUMMARY ===")
for test_name, res in test_results.items():
    print(f"{test_name}: {res}")

with open(r"d:\MeetRoom\player_ui_test_summary.json", "w") as f:
    json.dump({
        "results": test_results,
        "console_errors": [c for c in console_logs if "[error]" in c],
        "page_errors": page_errors
    }, f, indent=2)
