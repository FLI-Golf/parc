<script lang="ts">
  import { onDestroy, onMount, createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let maxSeconds: number = 120; // cap recording length
  export let transcribe: boolean = false; // use Web Speech API
  export let language: string = 'en-US';

  let mediaRecorder: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let recording = false;
  let playing = false;
  let audioUrl: string | null = null;
  let audioEl: HTMLAudioElement | null = null;
  let seconds = 0;
  let timer: any = null;

  // Speech recognition (optional)
  let recognition: any = null;
  let transcript: string = '';
  let isTranscribing = false;

  onMount(() => {
    if (transcribe && typeof window !== 'undefined') {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SR) {
        recognition = new SR();
        recognition.lang = language;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event: any) => {
          const res = Array.from(event.results).map((r: any) => r[0]?.transcript || '').join(' ');
          transcript = res.trim();
        };
        recognition.onerror = () => {
          isTranscribing = false;
        };
      }
    }
  });

  onDestroy(() => {
    cleanup();
  });

  function cleanup() {
    stopTimer();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch {}
    }
    if (recognition) {
      try { recognition.stop(); } catch {}
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }

  function startTimer() {
    stopTimer();
    seconds = 0;
    timer = setInterval(() => {
      seconds += 1;
      if (seconds >= maxSeconds) {
        stopRecording();
      }
    }, 1000);
  }
  function stopTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = [];
      mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) chunks.push(e.data); };
      mediaRecorder.onstop = () => {};
      mediaRecorder.start();
      recording = true;
      startTimer();
      if (recognition) {
        try { recognition.start(); isTranscribing = true; } catch {}
      }
    } catch (err) {
      alert('Microphone access denied or not available');
      console.error(err);
    }
  }

  function stopRecording() {
    if (!mediaRecorder) return;
    try { mediaRecorder.stop(); } catch {}
    recording = false;
    stopTimer();
    if (recognition) {
      try { recognition.stop(); isTranscribing = false; } catch {}
    }
    const blob = new Blob(chunks, { type: 'audio/webm' });
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    audioUrl = URL.createObjectURL(blob);
  }

  function togglePlayback() {
    if (!audioEl) return;
    if (playing) {
      audioEl.pause();
      playing = false;
    } else {
      audioEl.currentTime = 0;
      audioEl.play();
      playing = true;
    }
  }

  function onAudioEnded() {
    playing = false;
  }

  function resetRecording() {
    cleanup();
    audioUrl = null;
    chunks = [];
    transcript = '';
  }

  function save() {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    dispatch('save', { blob, duration: seconds, transcript: transcript || null });
  }

  function cancel() {
    dispatch('cancel');
  }
</script>

<div class="p-4 bg-gray-800 rounded-lg border border-gray-700 w-full max-w-xl text-white">
  <div class="flex items-center justify-between mb-3">
    <h3 class="text-lg font-semibold">Audio Note</h3>
    <span class="text-sm text-gray-300">{seconds}s / {maxSeconds}s</span>
  </div>

  {#if !audioUrl}
    <button class="w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700" on:click={startRecording} disabled={recording}>
      {recording ? 'Recording…' : 'Start Recording'}
    </button>
    {#if recording}
      <button class="w-full mt-2 py-3 rounded-lg bg-red-600 hover:bg-red-700" on:click={stopRecording}>Stop</button>
    {/if}
  {:else}
    <div class="space-y-2">
      <audio bind:this={audioEl} src={audioUrl} on:ended={onAudioEnded}></audio>
      <div class="flex gap-2">
        <button class="flex-1 py-2 rounded-lg bg-gray-700 hover:bg-gray-600" on:click={togglePlayback}>
          {playing ? 'Pause' : 'Play'}
        </button>
        <button class="py-2 px-3 rounded-lg bg-yellow-700 hover:bg-yellow-600" on:click={resetRecording}>Re-record</button>
      </div>
      <div class="flex gap-2">
        <button class="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700" on:click={save}>Save</button>
        <button class="py-2 px-3 rounded-lg bg-gray-600 hover:bg-gray-700" on:click={cancel}>Cancel</button>
      </div>
    </div>
  {/if}

  {#if transcribe}
    <div class="mt-3">
      <label class="block text-xs text-gray-400 mb-1">Transcript (optional)</label>
      <div class="p-2 bg-gray-700 rounded min-h-[60px] text-sm">{transcript || (isTranscribing ? 'Listening…' : '—')}</div>
    </div>
  {/if}
</div>

<style>
  .min-h-\[60px\] { min-height: 60px; }
</style>
