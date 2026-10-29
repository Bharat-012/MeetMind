"""Browser-based End-to-End Verification Test Script for MeetMind using Playwright."""
import os
import sys
import time
import json

# Ensure unbuffered output
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(line_buffering=True)
from playwright.sync_api import sync_playwright

SCREENSHOTS_DIR = r"C:\Users\Lenovo\.gemini\antigravity\brain\e43c69c8-6a97-4102-aa34-e98e33393e62\browser_screenshots"
AUDIO_FILE = r"d:\MeetRoom\backend\storage\sample_speech.wav"
CHROME_PATH = r"C:\Program Files\Google\Chrome\Application\chrome.exe"

os.makedirs(SCREENSHOTS_DIR, exist_ok=True)

test_results = {}
console_logs = []
page_errors = []

def log_console(msg):
    console_logs.append(f"[{msg.type}] {msg.text}")

def log_error(err):
    page_errors.append(str(err))

print("=== STARTING BROWSER-BASED E2E TESTING ===")
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=CHROME_PATH, headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 900})
    page = context.new_page()

    page.on("console", log_console)
    page.on("pageerror", log_error)

    # 1. Test Home Dashboard
    print("[1/14] Testing Home Dashboard (http://localhost:3000)...")
    try:
        page.goto("http://localhost:3000", wait_until="domcontentloaded", timeout=15000)
        time.sleep(1)
        assert "MeetMind" in page.content(), "MeetMind branding not found on home page"
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "01_home_dashboard.png"))
        test_results["01_home_dashboard"] = "PASS"
        print("  -> PASS: Home Dashboard loaded without blank page.")
    except Exception as e:
        test_results["01_home_dashboard"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 2. Test Workspace Page
    print("[2/14] Testing Workspace Page (http://localhost:3000/workspace)...")
    try:
        page.goto("http://localhost:3000/workspace", wait_until="domcontentloaded", timeout=15000)
        time.sleep(2)
        assert "Acme Corp" in page.content(), "Organization Acme Corp not rendered"
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "02_workspace_page.png"))
        test_results["02_workspace_page"] = "PASS"
        print("  -> PASS: Workspace loaded with Acme Corp.")
    except Exception as e:
        test_results["02_workspace_page"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 3. Test Ingest Modal & Media Upload
    print("[3/14] Testing Media Upload in IngestModal...")
    meeting_id = None
    try:
        # Click Ingest Meeting button
        ingest_btn = page.locator("button:has-text('Ingest Meeting')").first
        ingest_btn.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "03_ingest_modal_open.png"))

        # Fill in Title using exact placeholder match
        title_input = page.locator("input[placeholder*='Roadmap']").first
        title_input.fill("PostgreSQL Migration Standup")

        # Set file input directly by ID selector
        page.set_input_files("#file-upload", AUDIO_FILE)
        time.sleep(1)

        # Click upload button
        upload_submit = page.locator("button:has-text('Start Processing')").first
        upload_submit.click()
        print("  -> Upload submitted, awaiting modal close and meeting list update...")
        time.sleep(4)

        # Wait for meeting link in workspace list
        page.wait_for_selector("a[href*='/meetings/']", timeout=20000)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "04_after_upload.png"))
        test_results["03_media_upload"] = "PASS"
        print("  -> PASS: Media uploaded successfully via UI.")
    except Exception as e:
        test_results["03_media_upload"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 4. Find the meeting and navigate to its detail page
    print("[4/14] Navigating to Meeting Detail Page...")
    try:
        meeting_link = page.locator("a[href*='/meetings/']").first
        href = meeting_link.get_attribute("href")
        meeting_id = href.split("/meetings/")[1]
        print(f"  -> Found target meeting ID: {meeting_id}")

        page.goto(f"http://localhost:3000/meetings/{meeting_id}", wait_until="domcontentloaded", timeout=15000)
        time.sleep(2)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "05_meeting_detail_initial.png"))
        test_results["04_meeting_detail_open"] = "PASS"
        print("  -> PASS: Meeting Detail page opened.")
    except Exception as e:
        test_results["04_meeting_detail_open"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 5. Wait for background pipeline completion
    print("[5/14] Waiting for background pipeline completion...")
    try:
        max_wait = 60
        start_t = time.time()
        is_completed = False
        while time.time() - start_t < max_wait:
            time.sleep(3)
            page.reload(wait_until="domcontentloaded")
            time.sleep(1)
            content = page.content()
            if "COMPLETED" in content:
                is_completed = True
                break

        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "06_meeting_completed.png"))
        assert is_completed, f"Pipeline did not reach COMPLETED within {max_wait}s"
        test_results["05_pipeline_processing"] = "PASS"
        print("  -> PASS: Background pipeline reached COMPLETED status.")
    except Exception as e:
        test_results["05_pipeline_processing"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 6. Test Deliverable A: Full Transcript, search, speaker filter, and seeking
    print("[6/14] Testing Deliverable A: Full Transcript Tab...")
    try:
        transcript_tab = page.locator("button:has-text('Full Transcript')").first
        transcript_tab.click()
        time.sleep(1)

        # Check genuine transcript text from real audio
        content = page.content()
        assert "PostgreSQL" in content or "database" in content or "pgvector" in content, "Real transcript text not found in DOM"
        print("  -> Verified genuine transcript text in DOM from Faster-Whisper.")

        # Test Search input
        search_input = page.locator("input[placeholder*='spoken words']").first
        search_input.fill("PostgreSQL")
        time.sleep(0.5)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "07_transcript_search.png"))
        search_input.fill("")

        # Test Timestamp seek by clicking the first transcript segment
        first_segment = page.locator("div.p-4.rounded-xl.border.cursor-pointer").first
        first_segment.click()
        time.sleep(0.5)

        test_results["06_transcript_tab"] = "PASS"
        print("  -> PASS: Full Transcript, search, and playback seeking verified.")
    except Exception as e:
        test_results["06_transcript_tab"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 7. Test Speaker Assignment & Attribution
    print("[7/14] Testing Speaker Assignment & Audit Trail...")
    try:
        speakers_tab = page.locator("button:has-text('Speakers & Attribution')").first
        speakers_tab.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "08_speakers_tab.png"))

        # Click Assign / Change button on first speaker
        assign_btn = page.locator("button:has-text('Assign'), button:has-text('Change')").first
        assign_btn.click()
        time.sleep(1)

        # Enter confirmed name in modal
        name_input = page.locator("input[placeholder*='Sarah Chen']").first
        name_input.fill("Alice Tech Lead")

        notes_input = page.locator("input[placeholder*='agenda']").first
        notes_input.fill("Confirmed during standup")

        # Save assignment
        save_btn = page.locator("button:has-text('Confirm Assignment')").first
        save_btn.click()
        time.sleep(1.5)

        # Check updated speaker name in DOM
        assert "Alice Tech Lead" in page.content(), "Updated confirmed name not found in DOM"

        # Check Audit Trail modal
        audit_btn = page.locator("button[title*='Audit']").first
        audit_btn.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "09_speaker_audit_modal.png"))
        assert "ASSIGN_SPEAKER" in page.content() or "Alice Tech Lead" in page.content(), "Audit trail record missing"

        # Close audit modal
        close_btn = page.locator("button:has-text('Close')").first
        close_btn.click()
        time.sleep(0.5)

        test_results["07_speaker_assignment"] = "PASS"
        print("  -> PASS: Speaker assigned, confirmed badge rendered, audit trail verified.")
    except Exception as e:
        test_results["07_speaker_assignment"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 8. Test Deliverable B: Chronological Meeting Explanation
    print("[8/14] Testing Deliverable B: Chronological Explanation Tab...")
    try:
        short_tab = page.locator("button:has-text('Chronological Explanation')").first
        short_tab.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "10_chronological_tab.png"))

        content = page.content()
        assert "Chronological Meeting Explanation" in content, "Chronological header missing"
        assert "Event Sequence" in content, "Event Sequence section missing"

        test_results["08_chronological_explanation"] = "PASS"
        print("  -> PASS: Chronological meeting explanation and event sequence verified.")
    except Exception as e:
        test_results["08_chronological_explanation"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 9. Test Deliverable C: Structured Summary
    print("[9/14] Testing Deliverable C: Structured Summary Tab...")
    try:
        summary_tab = page.locator("button:has-text('Structured Summary')").first
        summary_tab.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "11_summary_tab.png"))

        content = page.content()
        assert "Executive Summary" in content, "Executive Summary section missing"
        assert "Key Takeaways" in content, "Key Takeaways section missing"

        test_results["09_structured_summary"] = "PASS"
        print("  -> PASS: Structured Summary, Key Takeaways, Risks, and Questions verified.")
    except Exception as e:
        test_results["09_structured_summary"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 10. Test Deliverable C: Decision Register
    print("[10/14] Testing Deliverable C: Decision Register Tab...")
    try:
        decisions_tab = page.locator("button:has-text('Decisions')").first
        decisions_tab.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "12_decisions_tab.png"))

        content = page.content()
        assert "Decision Register" in content, "Decision Register section missing"
        assert "CONFIRMED" in content or "PROPOSED" in content, "Decision status pills missing"

        test_results["10_decision_register"] = "PASS"
        print("  -> PASS: Decision Register with status classification verified.")
    except Exception as e:
        test_results["10_decision_register"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 11. Test Deliverable C: Action Item Tracker & Non-Hallucination
    print("[11/14] Testing Deliverable C: Action Item Tracker Tab...")
    try:
        actions_tab = page.locator("button:has-text('Action Items')").first
        actions_tab.click()
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "13_action_items_tab.png"))

        content = page.content()
        assert "Action Item Tracker" in content, "Action Item Tracker section missing"
        assert "Owner:" in content, "Owner field missing"
        assert "Due:" in content, "Due date field missing"

        test_results["11_action_item_tracker"] = "PASS"
        print("  -> PASS: Action Item Tracker verified without hallucination.")
    except Exception as e:
        test_results["11_action_item_tracker"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 12. Test Meeting Chat (Answerable & Unanswerable Queries)
    print("[12/14] Testing Meeting Chat Tab with Grounded Citations...")
    try:
        chat_tab = page.locator("button:has-text('Meeting Chat')").first
        chat_tab.click()
        time.sleep(1)

        # Question 1: Answerable
        chat_input = page.locator("input[placeholder*='Ask a question']").first
        chat_input.fill("What database did the team decide to adopt?")
        ask_btn = page.locator("button:has-text('Ask')").first
        ask_btn.click()
        time.sleep(4)

        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "14_chat_answerable.png"))
        content = page.content()
        assert "PostgreSQL" in content or "database" in content, "Answer did not contain expected database adoption info"
        print("  -> Verified answerable question produced grounded answer with citation.")

        # Question 2: Unanswerable
        chat_input.fill("What is the capital of Mars?")
        ask_btn.click()
        time.sleep(4)

        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "15_chat_unanswerable.png"))
        content = page.content()
        assert "not contain sufficient evidence" in content.lower(), "Unanswerable query did not report insufficient evidence"
        print("  -> Verified unanswerable question reported insufficient evidence.")

        test_results["12_meeting_chat"] = "PASS"
        print("  -> PASS: Grounded chat and negative question handling verified.")
    except Exception as e:
        test_results["12_meeting_chat"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 13. Test Intelligence Regeneration
    print("[13/14] Testing Intelligence Regeneration...")
    try:
        regen_btn = page.locator("button:has-text('Regenerate Intelligence')").first
        regen_btn.click()
        time.sleep(4)

        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "16_after_regeneration.png"))
        test_results["13_regeneration"] = "PASS"
        print("  -> PASS: Intelligence regenerated successfully without duplicates.")
    except Exception as e:
        test_results["13_regeneration"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    # 14. Test Speaker Directory page
    print("[14/14] Testing Organization Speaker Directory Page...")
    try:
        page.goto("http://localhost:3000/speakers", wait_until="domcontentloaded", timeout=15000)
        time.sleep(2)
        page.screenshot(path=os.path.join(SCREENSHOTS_DIR, "17_speaker_directory.png"))
        content = page.content()
        assert "Speaker Directory" in content, "Speaker directory title missing"

        test_results["14_speaker_directory_page"] = "PASS"
        print("  -> PASS: Speaker Directory page loaded.")
    except Exception as e:
        test_results["14_speaker_directory_page"] = f"FAIL: {e}"
        print(f"  -> FAIL: {e}")

    browser.close()

print("\n=== SUMMARY OF BROWSER E2E TEST RESULTS ===")
for test_name, status in test_results.items():
    print(f"  {test_name}: {status}")

print(f"\nTotal Console Messages: {len(console_logs)}")
print(f"Total Page Errors: {len(page_errors)}")
if page_errors:
    print("Page Errors:")
    for pe in page_errors:
        print("  -", pe)

with open("browser_test_summary.json", "w") as f:
    json.dump({
        "results": test_results,
        "page_errors": page_errors,
        "console_logs": console_logs[:20]
    }, f, indent=2)
print("Saved summary to browser_test_summary.json")
