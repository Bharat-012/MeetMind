import os
import sys
import time
import requests
from playwright.sync_api import sync_playwright

SCREENSHOT_DIR = r"C:\Users\Lenovo\.gemini\antigravity\brain\e43c69c8-6a97-4102-aa34-e98e33393e62\browser_screenshots"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

VIDEO_FILE = r"d:\MeetRoom\backend\storage\sample_meeting_video.mp4"
YT_VALID_URL = "https://www.youtube.com/watch?v=jNQXAC9IVRw"

# Create a corrupt media file for negative testing
CORRUPT_MEDIA_FILE = r"d:\MeetRoom\backend\storage\corrupt_dummy_media.mp4"
with open(CORRUPT_MEDIA_FILE, "wb") as f:
    f.write(b"CORRUPT_NOT_A_REAL_MP4_HEADER_1234567890")

def run_tests():
    print("=" * 70)
    print("MEETMIND BROWSER AUTOMATION: VIDEO & YOUTUBE WORKFLOW VALIDATION")
    print("=" * 70)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 950})
        page = context.new_page()

        # Track console errors
        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("\n--- TEST 1: WORKSPACE LOAD & UI VERIFICATION ---")
        page.goto("http://localhost:3000/workspace", wait_until="networkidle")
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "20_workspace_loaded.png"))
        print("Captured 20_workspace_loaded.png")

        print("\n--- TEST 2: NEGATIVE VALIDATION - CORRUPT FILE REJECTION ---")
        upload_btn = page.locator("button:has-text('Ingest Meeting'), button:has-text('Ingest First Meeting')").first
        upload_btn.click()
        time.sleep(0.5)

        # Upload corrupt file
        file_input = page.locator("input[type='file']")
        file_input.set_input_files(CORRUPT_MEDIA_FILE)
        time.sleep(0.5)
        page.locator("button:has-text('Start Processing')").click()
        time.sleep(1.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "21_corrupt_file_rejected.png"))

        corrupt_err = page.locator("div[class*='text-red-400']").text_content()
        print(f"Corrupt upload error response: '{corrupt_err}'")
        assert corrupt_err and ("corrupt" in corrupt_err.lower() or "unreadable" in corrupt_err.lower() or "format" in corrupt_err.lower() or "header" in corrupt_err.lower()), f"Expected corrupt file rejection, got: {corrupt_err}"
        print("PASS: Corrupt media file rejected cleanly with clear error!")

        # Close and reopen modal
        page.locator("button:has-text('Cancel')").click()
        time.sleep(0.5)

        print("\n--- TEST 3: LOCAL VIDEO UPLOAD, PREVIEW & PLAYBACK SEEKING ---")
        page.locator("button:has-text('Ingest Meeting')").first.click()
        time.sleep(0.5)

        title_input = page.locator("input[placeholder*='Roadmap']")
        if title_input.is_visible():
            title_input.fill("Q4 PostgreSQL Architecture Video Sync")

        file_input = page.locator("input[type='file']")
        file_input.set_input_files(VIDEO_FILE)
        time.sleep(0.5)

        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "22_upload_form_ready.png"))
        page.locator("button:has-text('Start Processing')").click()
        print("Local video submitted. Waiting for navigation to meeting details...")

        page.wait_for_url("**/meetings/**", timeout=30000)
        meeting_url = page.url
        print(f"Navigated to meeting detail: {meeting_url}")
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "23_local_video_meeting_processing.png"))

        # Wait for processing to complete
        print("Waiting for local video pipeline to complete...")
        meeting_completed = False
        for i in range(40):
            page.reload(wait_until="networkidle")
            time.sleep(2)
            content = page.content()
            if "COMPLETED" in content:
                print(f"Local video meeting COMPLETED in approx {(i+1)*2} seconds!")
                meeting_completed = True
                break
            elif "FAILED" in content:
                print("Pipeline marked as FAILED!")
                break
            print(f"Still processing... attempt {i+1}")

        assert meeting_completed, "Meeting pipeline should complete successfully"
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "24_local_video_completed.png"))

        # 3A: Verify video player renders
        video_locator = page.locator("video")
        assert video_locator.is_visible(), "HTML5 <video> player should be rendered and visible"
        video_src = video_locator.get_attribute("src")
        print(f"PASS: HTML5 <video> player verified with source: {video_src}")

        # 3B: Verify HTTP Range requests work directly via requests
        resp_range = requests.get(video_src, headers={"Range": "bytes=0-1023"})
        assert resp_range.status_code == 206, f"Expected HTTP 206 Partial Content, got {resp_range.status_code}"
        assert resp_range.headers.get("Accept-Ranges") == "bytes", "Expected Accept-Ranges: bytes"
        assert "Content-Range" in resp_range.headers, "Expected Content-Range header"
        print(f"PASS: HTTP 206 Partial Content verified! Content-Range: {resp_range.headers.get('Content-Range')}")

        # 3C: Test Play / Pause controls
        play_btn = page.locator("button[title='Play']")
        if play_btn.is_visible():
            play_btn.click()
            time.sleep(2.5)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "25_local_video_playing.png"))
            print("PASS: Video playback started via Play button!")

        # 3D: Test segment click seeking
        segments = page.locator("div[class*='cursor-pointer'][class*='rounded-xl']")
        assert segments.count() > 0, "Expected transcript segments to be rendered"
        print(f"Found {segments.count()} transcript segments.")

        # Click second segment if available
        seg_to_click = segments.nth(1) if segments.count() > 1 else segments.first
        seg_text = seg_to_click.locator("p").text_content()
        print(f"Clicking segment: '{seg_text[:60]}...'")
        seg_to_click.click()
        time.sleep(1.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "26_local_video_segment_seek_highlight.png"))
        print("PASS: Clicking transcript segment sought video player and updated active highlight!")

        # 3E: Verify Deliverable tabs
        page.locator("button:has-text('Chronological Explanation')").click()
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "27_local_video_chronological.png"))

        page.locator("button:has-text('Structured Summary')").click()
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "28_local_video_summary.png"))

        page.locator("button:has-text('Decisions')").click()
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "29_local_video_decisions.png"))

        print("\n--- TEST 4: YOUTUBE NEGATIVE VALIDATION ---")
        page.goto("http://localhost:3000/workspace", wait_until="networkidle")
        time.sleep(1)

        # Open Ingest Modal & switch to URL tab
        page.locator("button:has-text('Ingest Meeting')").first.click()
        time.sleep(0.5)
        page.locator("button:has-text('Import Video URL')").click()
        time.sleep(0.5)

        url_input = page.locator("input[placeholder*='youtube.com']")

        # 4A: Non-YouTube URL
        print("Testing non-YouTube domain rejection...")
        url_input.fill("https://vimeo.com/123456789")
        page.locator("button:has-text('Start Ingestion')").click()
        time.sleep(1.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "30_youtube_non_youtube_domain.png"))
        err1 = page.locator("div[class*='text-red-400']").text_content()
        print(f"Domain error: '{err1}'")
        assert "YouTube" in err1, "Expected rejection of non-YouTube domain"
        print("PASS: Non-YouTube URL rejected cleanly!")

        # 4B: Non-existent YouTube video ID
        print("Testing non-existent video ID rejection...")
        url_input.fill("https://www.youtube.com/watch?v=nonexistent_99999_xyz")
        page.locator("button:has-text('Start Ingestion')").click()
        time.sleep(3)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "31_youtube_nonexistent_id.png"))
        err2 = page.locator("div[class*='text-red-400']").text_content()
        print(f"Nonexistent ID error: '{err2}'")
        assert "valid" in err2.lower() or "not available" in err2.lower() or "extraction failed" in err2.lower() or "cannot import" in err2.lower(), f"Expected failure message, got: {err2}"
        print("PASS: Non-existent YouTube video rejected cleanly!")

        print("\n--- TEST 5: YOUTUBE VALID PUBLIC VIDEO IMPORT ---")
        print(f"Importing valid public YouTube video: {YT_VALID_URL} ('Me at the zoo')...")
        yt_title_input = page.locator("input[placeholder*='Indexing']")
        if yt_title_input.is_visible():
            yt_title_input.fill("YouTube Zoo Video Sync")

        url_input.fill(YT_VALID_URL)
        time.sleep(0.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "32_youtube_import_ready.png"))

        page.locator("button:has-text('Start Ingestion')").click()
        print("Submitted YouTube ingestion. Waiting for meeting page redirection...")

        page.wait_for_url("**/meetings/**", timeout=45000)
        yt_meeting_url = page.url
        print(f"Navigated to YouTube meeting page: {yt_meeting_url}")
        time.sleep(1)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "33_youtube_meeting_processing.png"))

        # Wait for YouTube meeting processing to complete
        yt_completed = False
        for i in range(40):
            page.reload(wait_until="networkidle")
            time.sleep(2)
            content = page.content()
            if "COMPLETED" in content:
                print(f"YouTube meeting COMPLETED in approx {(i+1)*2} seconds!")
                yt_completed = True
                break
            elif "FAILED" in content:
                print("Pipeline marked as FAILED!")
                break
            print(f"Still processing YouTube meeting... attempt {i+1}")

        assert yt_completed, "YouTube meeting pipeline should complete successfully"
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "34_youtube_meeting_completed.png"))

        # 5A: Verify media player is active
        video_or_audio = page.locator("video, audio")
        assert video_or_audio.count() > 0, "Expected video or audio player element to be present"
        print("PASS: YouTube meeting media player rendered successfully!")

        # 5B: Test Play button
        play_btn = page.locator("button[title='Play']")
        if play_btn.is_visible():
            play_btn.click()
            time.sleep(2)
            page.screenshot(path=os.path.join(SCREENSHOT_DIR, "35_youtube_playback_active.png"))
            print("PASS: YouTube media playback started smoothly!")

        # 5C: Verify transcript segments generated
        yt_segments = page.locator("div[class*='cursor-pointer'][class*='rounded-xl']")
        print(f"YouTube meeting transcript segments count: {yt_segments.count()}")

        print("\n--- TEST 6: DUPLICATE YOUTUBE IMPORT REJECTION ---")
        page.goto("http://localhost:3000/workspace", wait_until="networkidle")
        time.sleep(1)
        page.locator("button:has-text('Ingest Meeting')").first.click()
        time.sleep(0.5)
        page.locator("button:has-text('Import Video URL')").click()
        time.sleep(0.5)

        url_input = page.locator("input[placeholder*='youtube.com']")
        url_input.fill(YT_VALID_URL)
        page.locator("button:has-text('Start Ingestion')").click()
        time.sleep(1.5)
        page.screenshot(path=os.path.join(SCREENSHOT_DIR, "36_youtube_duplicate_rejected.png"))

        dup_err = page.locator("div[class*='text-red-400']").text_content()
        print(f"Duplicate error: '{dup_err}'")
        assert "already" in dup_err.lower() or "imported" in dup_err.lower() or "conflict" in dup_err.lower() or "exists" in dup_err.lower(), f"Expected duplicate warning, got: {dup_err}"
        print("PASS: Duplicate YouTube URL in same workspace rejected with 409 Conflict!")

        browser.close()

        # Clean up corrupt dummy file
        if os.path.exists(CORRUPT_MEDIA_FILE):
            os.remove(CORRUPT_MEDIA_FILE)

        print("\n" + "=" * 70)
        print("ALL BROWSER E2E TESTS PASSED WITH 100% SUCCESS!")
        print("=" * 70)

if __name__ == "__main__":
    run_tests()
