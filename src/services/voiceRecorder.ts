// ============================================
// Voice Recorder Composable (MediaRecorder API)
// ============================================

import { ref, readonly } from 'vue'

export function useVoiceRecorder() {
  const isRecording = ref(false)
  const duration = ref(0)
  const audioLevel = ref(0)
  const error = ref<string | null>(null)

  let mediaRecorder: MediaRecorder | null = null
  let audioChunks: Blob[] = []
  let stream: MediaStream | null = null
  let analyser: AnalyserNode | null = null
  let animationFrame: number | null = null
  let durationInterval: ReturnType<typeof setInterval> | null = null

  const startRecording = async (): Promise<void> => {
    try {
      error.value = null
      audioChunks = []

      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        }
      })

      // Set up audio analyser for waveform visualization
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }
      const source = audioContext.createMediaStreamSource(stream)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      source.connect(analyser)

      // Start level monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      const updateLevel = () => {
        if (!analyser) return
        analyser.getByteFrequencyData(dataArray)
        const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
        audioLevel.value = Math.min(avg / 128, 1) // Normalize to 0-1
        animationFrame = requestAnimationFrame(updateLevel)
      }
      updateLevel()

      // Create recorder
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm'

      mediaRecorder = new MediaRecorder(stream, { mimeType })

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunks.push(event.data)
        }
      }

      mediaRecorder.start(50) // More frequent chunks for stability
      isRecording.value = true
      duration.value = 0

      // Track duration
      durationInterval = setInterval(() => {
        duration.value += 1
      }, 1000)

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate(50)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to start recording'
      throw err
    }
  }

  const stopRecording = (): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      if (!mediaRecorder || mediaRecorder.state === 'inactive') {
        reject(new Error('No active recording'))
        return
      }

      mediaRecorder.onstop = () => {
        if (audioChunks.length === 0) {
          reject(new Error('No audio data captured. Please try again.'))
          return
        }
        const blob = new Blob(audioChunks, { type: 'audio/webm' })
        cleanup()
        resolve(blob)
      }

      mediaRecorder.stop()

      // Haptic feedback
      if (navigator.vibrate) {
        navigator.vibrate([30, 50, 30])
      }
    })
  }

  const cancelRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    cleanup()
  }

  const cleanup = () => {
    isRecording.value = false
    duration.value = 0
    audioLevel.value = 0

    if (durationInterval) {
      clearInterval(durationInterval)
      durationInterval = null
    }
    if (animationFrame) {
      cancelAnimationFrame(animationFrame)
      animationFrame = null
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop())
      stream = null
    }
    analyser = null
    mediaRecorder = null
    audioChunks = []
  }

  const formatDuration = (seconds: number): string => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  return {
    isRecording: readonly(isRecording),
    duration: readonly(duration),
    audioLevel: readonly(audioLevel),
    error: readonly(error),
    startRecording,
    stopRecording,
    cancelRecording,
    formatDuration
  }
}
