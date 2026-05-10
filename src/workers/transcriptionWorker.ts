import { pipeline, env } from '@huggingface/transformers';

// Configuration for maximum stability
env.allowLocalModels = false;
env.useBrowserCache = true;
// Disable multi-threading to avoid bad_alloc and fusion errors on mobile
(env.backends.onnx as any).wasm.numThreads = 1;

/**
 * Singleton class for the transcription pipeline
 */
class TranscriptionPipeline {
  static task = 'automatic-speech-recognition';
  static model = 'Xenova/whisper-tiny'; // Multilingual model is often more stable
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task as any, this.model, { 
        progress_callback,
        dtype: 'q8', // Explicitly demand 8-bit to avoid the 4-bit 'MatMulNBits' crash
        device: 'wasm', // Ensure it uses WASM explicitly
      } as any);
    }
    return this.instance;
  }
}

// Listen for messages from the main thread
self.onmessage = async (event) => {
  const { audio } = event.data;

  try {
    const transcriber = await TranscriptionPipeline.getInstance((progress: any) => {
      if (progress.status === 'progress') {
        self.postMessage({ status: 'progress', progress: progress.progress });
      }
    });

    if (audio) {
      self.postMessage({ status: 'processing' });
      
      const output = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'english', // Explicitly set language for the multilingual model
        task: 'transcribe',
        return_timestamps: false,
      });

      self.postMessage({ 
        status: 'success', 
        transcript: Array.isArray(output) ? output[0].text : output.text 
      });
    } else {
      self.postMessage({ status: 'ready' });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Transcription failed';
    self.postMessage({ status: 'error', error: errorMessage });
  }
};
