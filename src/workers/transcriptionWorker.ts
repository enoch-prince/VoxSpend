import { pipeline, env } from '@huggingface/transformers';

// Configuration
env.allowLocalModels = false;
env.useBrowserCache = true;

/**
 * Singleton class for the transcription pipeline
 */
class TranscriptionPipeline {
  static task = 'automatic-speech-recognition';
  static model = 'Xenova/whisper-tiny.en';
  static instance: any = null;

  static async getInstance(progress_callback: any = null) {
    if (this.instance === null) {
      this.instance = pipeline(this.task as any, this.model, { 
        progress_callback,
        quantized: true 
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
      self.postMessage({ status: 'progress', progress });
    });

    if (audio) {
      self.postMessage({ status: 'processing' });
      
      const output = await transcriber(audio, {
        chunk_length_s: 30,
        stride_length_s: 5,
        language: 'english',
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
