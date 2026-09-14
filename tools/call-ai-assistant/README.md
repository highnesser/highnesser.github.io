# WhatsApp Call AI Assistant (reference source)

A small FastAPI app that accepts an uploaded/recorded audio file, sends it to
Gemini for transcription + analysis, and returns a summary, action items,
reminders, and a full transcript. Built as a mobile-friendly single-page
web app (record-in-browser or upload a file).

**This code is stored here for reference only.** `highnesser.github.io` is a
static GitHub Pages site — it cannot execute Python/FastAPI, so this app
will not run as part of the published site. Deploy it separately on a
Python host (Replit, Render, Fly.io, etc.) to actually use it.

## Deploying on Replit

1. Create a new Python Repl and copy `main.py` and `requirements.txt` into it.
2. In Replit, go to **Tools → Secrets** and add:
   - Key: `GEMINI_API_KEY`
   - Value: your Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

   Never hardcode the key in `main.py` or commit it anywhere — Secrets keeps
   it out of your code and out of git history.
3. Press **Run**. Replit opens a webview URL (e.g. `https://your-repl-name.replit.app`).
4. Open that URL on your phone (Safari on iPhone works fine).
5. Tap **REC** to record, or use the file picker to upload an existing
   `.m4a` / `.wav` / `.mp3` recording, and Gemini returns a transcript,
   summary, action items, and reminders.

## Notes

- `client.files.upload` and `client.files.delete` require the `google-genai`
  SDK version pinned implicitly by `requirements.txt`; if Gemini API errors
  mention deprecated methods, check the [Gemini API docs](https://ai.google.dev/gemini-api/docs)
  for the current file-upload API shape.
- The uploaded audio is written to a temp file, sent to Gemini, and then
  deleted both locally and from Gemini's file storage after each request —
  no audio is persisted.
