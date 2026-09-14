import os
import json
import tempfile
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse
from google import genai
from google.genai import types

app = FastAPI(title="WhatsApp Call AI Assistant")

# Initialize Gemini Client
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=GEMINI_KEY) if GEMINI_KEY else None

# Complete Frontend Web Interface for iPhone / Mobile
HTML_INTERFACE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Call Note Taker</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen p-4 md:p-8 flex justify-center items-center">
    <div class="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
        <h1 class="text-2xl font-bold text-center text-indigo-400 mb-2">WhatsApp Call AI</h1>
        <p class="text-xs text-slate-400 text-center mb-6">Record your call or voice note directly from iPhone or Android to process with Gemini.</p>

        <!-- Recorder Controls -->
        <div class="flex flex-col items-center gap-4 mb-6">
            <div id="status" class="text-sm font-semibold text-amber-400">Ready to record</div>

            <button id="recordBtn" onclick="toggleRecording()" class="w-20 h-20 bg-rose-600 hover:bg-rose-500 text-white rounded-full flex items-center justify-center font-bold text-lg shadow-lg transition transform active:scale-95">
                REC
            </button>
        </div>

        <!-- Audio File Upload (Alternative test method) -->
        <div class="border-t border-slate-800 pt-4 mb-6">
            <label class="block text-xs font-medium text-slate-400 mb-2">Or upload call recording file (.m4a, .wav, .mp3):</label>
            <input type="file" id="audioFile" accept="audio/*" class="text-xs text-slate-300 w-full file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500"/>
            <button onclick="uploadSelectedFile()" class="w-full mt-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2 rounded-xl text-sm transition">Process File</button>
        </div>

        <!-- Results Display -->
        <div id="loading" class="hidden text-center py-6 text-indigo-400 font-medium text-sm animate-pulse">
            Gemini is transcribing & analyzing audio...
        </div>

        <div id="result" class="hidden space-y-4">
            <div class="bg-slate-800 rounded-xl p-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Call Summary</h3>
                <p id="summaryText" class="text-sm text-slate-200"></p>
            </div>

            <div class="bg-slate-800 rounded-xl p-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Action Items</h3>
                <ul id="actionList" class="list-disc list-inside text-sm text-slate-200 space-y-1"></ul>
            </div>

            <div class="bg-slate-800 rounded-xl p-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Reminders</h3>
                <ul id="reminderList" class="list-disc list-inside text-sm text-amber-300 space-y-1"></ul>
            </div>

            <div class="bg-slate-800 rounded-xl p-4">
                <h3 class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Full Transcript</h3>
                <p id="transcriptText" class="text-xs text-slate-400 max-h-40 overflow-y-auto leading-relaxed"></p>
            </div>
        </div>
    </div>

    <script>
        let mediaRecorder;
        let audioChunks = [];

        async function toggleRecording() {
            const btn = document.getElementById('recordBtn');
            const status = document.getElementById('status');

            if (!mediaRecorder || mediaRecorder.state === 'inactive') {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
                    mediaRecorder.onstop = sendRecordedAudio;

                    mediaRecorder.start();
                    btn.classList.replace('bg-rose-600', 'bg-amber-500');
                    btn.innerText = 'STOP';
                    status.innerText = 'Recording in progress...';
                } catch (err) {
                    alert('Microphone access denied or not supported.');
                }
            } else {
                mediaRecorder.stop();
                btn.classList.replace('bg-amber-500', 'bg-rose-600');
                btn.innerText = 'REC';
                status.innerText = 'Processing recording...';
            }
        }

        async function sendRecordedAudio() {
            const audioBlob = new Blob(audioChunks, { type: 'audio/m4a' });
            const formData = new FormData();
            formData.append('file', audioBlob, 'recording.m4a');
            await processAudioPayload(formData);
        }

        async function uploadSelectedFile() {
            const fileInput = document.getElementById('audioFile');
            if (!fileInput.files[0]) return alert('Select an audio file first.');

            const formData = new FormData();
            formData.append('file', fileInput.files[0]);
            await processAudioPayload(formData);
        }

        async function processAudioPayload(formData) {
            document.getElementById('loading').classList.remove('hidden');
            document.getElementById('result').classList.add('hidden');

            try {
                const response = await fetch('/api/process-call', {
                    method: 'POST',
                    body: formData
                });
                const res = await response.json();

                if (res.status === 'success') {
                    const data = res.data;
                    document.getElementById('summaryText').innerText = data.summary || 'No summary available.';

                    const actionList = document.getElementById('actionList');
                    actionList.innerHTML = '';
                    (data.action_items || []).forEach(item => {
                        actionList.innerHTML += `<li>${item}</li>`;
                    });

                    const reminderList = document.getElementById('reminderList');
                    reminderList.innerHTML = '';
                    (data.reminders || []).forEach(rem => {
                        reminderList.innerHTML += `<li>${rem.task} (${rem.suggested_time || 'Soon'})</li>`;
                    });

                    document.getElementById('transcriptText').innerText = data.transcript || '';
                    document.getElementById('result').classList.remove('hidden');
                    document.getElementById('status').innerText = 'Processing complete!';
                } else {
                    alert('Error: ' + res.message);
                }
            } catch (err) {
                alert('Failed to process audio.');
            } finally {
                document.getElementById('loading').classList.add('hidden');
            }
        }
    </script>
</body>
</html>
"""


@app.get("/", response_class=HTMLResponse)
def serve_ui():
    return HTML_INTERFACE


@app.post("/api/process-call")
async def process_call(file: UploadFile = File(...)):
    if not GEMINI_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY environment variable missing.")

    temp_file_path = None
    uploaded_gemini_file = None

    try:
        # Save temp audio file
        suffix = os.path.splitext(file.filename)[1] or ".m4a"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_audio:
            content = await file.read()
            temp_audio.write(content)
            temp_file_path = temp_audio.name

        # Upload audio directly to Gemini
        uploaded_gemini_file = client.files.upload(file=temp_file_path)

        prompt = """
        Analyze this audio recording of a call or voice note.
        Return ONLY a JSON object with these fields:
        - "transcript": Literal text transcript of the audio.
        - "summary": Concise overview of what was said (max 3 sentences).
        - "action_items": Array of specific tasks or next steps mentioned.
        - "reminders": Array of objects containing "task" and "suggested_time".
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[uploaded_gemini_file, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json"
            )
        )

        return {
            "status": "success",
            "data": json.loads(response.text)
        }

    except Exception as e:
        return {"status": "error", "message": str(e)}

    finally:
        if temp_file_path and os.path.exists(temp_file_path):
            os.remove(temp_file_path)
        if uploaded_gemini_file:
            try:
                client.files.delete(name=uploaded_gemini_file.name)
            except Exception:
                pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
