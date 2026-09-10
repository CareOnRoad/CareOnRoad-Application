import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  createNodeSherpaOnnxRuntime,
  createSherpaOnnxModelConfig,
  createSherpaOnnxRecognizerConfig,
  getRequiredModelFiles,
  SherpaOnnxClient
} from "../sherpa-onnx.client";

const env: NodeJS.ProcessEnv = {
  NODE_ENV: "test",
  SHERPA_ONNX_MODEL_DIR: "./models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09",
  SHERPA_ONNX_ENCODER: "encoder.int8.onnx",
  SHERPA_ONNX_DECODER: "decoder.onnx",
  SHERPA_ONNX_JOINER: "joiner.int8.onnx",
  SHERPA_ONNX_TOKENS: "tokens.txt"
};

const audio = {
  data: new Uint8Array([1, 2, 3]),
  mimeType: "audio/wav",
  fileName: "voice.wav"
};

describe("SherpaOnnxClient", () => {
  it("reads sherpa-onnx model paths from environment variables", () => {
    const config = createSherpaOnnxModelConfig(env);

    expect(config).toMatchObject({
      encoder: "encoder.int8.onnx",
      decoder: "decoder.onnx",
      joiner: "joiner.int8.onnx",
      tokens: "tokens.txt"
    });
    expect(config.modelDir).toContain("models");
    expect(path.isAbsolute(config.modelDir)).toBe(true);
    expect(getRequiredModelFiles(config)).toHaveLength(4);
    expect(getRequiredModelFiles(config).join("|")).toContain("encoder.int8.onnx");
  });

  it("builds a sherpa-onnx-node offline recognizer config from model paths", () => {
    const config = createSherpaOnnxRecognizerConfig(createSherpaOnnxModelConfig(env));

    expect(config).toMatchObject({
      featConfig: {
        sampleRate: 16000,
        featureDim: 80
      },
      modelConfig: {
        transducer: {
          encoder: expect.stringContaining("encoder.int8.onnx"),
          decoder: expect.stringContaining("decoder.onnx"),
          joiner: expect.stringContaining("joiner.int8.onnx")
        },
        tokens: expect.stringContaining("tokens.txt"),
        bpeVocab: "",
        modelingUnit: "cjkchar",
        provider: "cpu"
      },
      decodingMethod: "greedy_search"
    });
  });

  it("returns ASR_MODEL_NOT_FOUND when model files are missing", async () => {
    const client = new SherpaOnnxClient({
      env,
      exists: () => false,
      loadRuntime: async () => ({
        transcribe: async () => "Xe kho de"
      })
    });

    const result = await client.transcribe(audio);

    expect(result).toMatchObject({
      success: false,
      errorCode: "ASR_MODEL_NOT_FOUND"
    });
  });

  it("returns ASR_NOT_AVAILABLE when runtime binding is unavailable", async () => {
    const client = new SherpaOnnxClient({
      env,
      exists: () => true,
      loadRuntime: async () => null
    });

    const result = await client.transcribe(audio);

    expect(result).toMatchObject({
      success: false,
      errorCode: "ASR_NOT_AVAILABLE"
    });
  });

  it("returns ASR_EMPTY_TRANSCRIPTION when runtime produces empty text", async () => {
    const client = new SherpaOnnxClient({
      env,
      exists: () => true,
      loadRuntime: async () => ({
        transcribe: async () => "   "
      })
    });

    const result = await client.transcribe(audio);

    expect(result).toMatchObject({
      success: false,
      errorCode: "ASR_EMPTY_TRANSCRIPTION"
    });
  });

  it("returns Vietnamese text from mocked runtime", async () => {
    const client = new SherpaOnnxClient({
      env,
      exists: () => true,
      loadRuntime: async () => ({
        transcribe: async () => "Xe kho de"
      })
    });

    const result = await client.transcribe(audio);

    expect(result).toEqual({
      success: true,
      text: "Xe kho de"
    });
  });

  it("transcribes WAV audio through a mocked sherpa-onnx-node runtime", async () => {
    const acceptedWaveforms: Array<{ samples: Float32Array; sampleRate: number }> = [];
    const runtime = createNodeSherpaOnnxRuntime({
      OfflineRecognizer: class {
        constructor(readonly config: unknown) {}

        createStream() {
          return {
            acceptWaveform(waveform: { samples: Float32Array; sampleRate: number }) {
              acceptedWaveforms.push(waveform);
            }
          };
        }

        decode() {}

        getResult() {
          return {
            text: "Xe kho de va den yeu"
          };
        }
      }
    });

    const result = await runtime.transcribe(
      {
        data: createPcm16Wav([0, 1200, -1200, 0], 16000),
        mimeType: "audio/wav",
        fileName: "voice.wav"
      },
      createSherpaOnnxModelConfig(env)
    );

    expect(result).toBe("Xe kho de va den yeu");
    expect(acceptedWaveforms).toHaveLength(1);
    expect(acceptedWaveforms[0]).toMatchObject({
      sampleRate: 16000
    });
    expect(Array.from(acceptedWaveforms[0].samples)).toHaveLength(4);
  });

  it("reuses the offline recognizer for the same model config", async () => {
    let recognizerCreations = 0;
    const runtime = createNodeSherpaOnnxRuntime({
      OfflineRecognizer: class {
        constructor() {
          recognizerCreations += 1;
        }

        createStream() {
          return {
            acceptWaveform() {}
          };
        }

        decode() {}

        getResult() {
          return {
            text: "Xe kho de"
          };
        }
      }
    });
    const input = {
      data: createPcm16Wav([0, 1200, -1200, 0], 16000),
      mimeType: "audio/wav",
      fileName: "voice.wav"
    };
    const config = createSherpaOnnxModelConfig(env);

    await runtime.transcribe(input, config);
    await runtime.transcribe(input, config);

    expect(recognizerCreations).toBe(1);
  });
});

function createPcm16Wav(samples: number[], sampleRate: number): Uint8Array {
  const bytesPerSample = 2;
  const channelCount = 1;
  const dataSize = samples.length * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write("RIFF", 0, "ascii");
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8, "ascii");
  buffer.write("fmt ", 12, "ascii");
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(channelCount, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channelCount * bytesPerSample, 28);
  buffer.writeUInt16LE(channelCount * bytesPerSample, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write("data", 36, "ascii");
  buffer.writeUInt32LE(dataSize, 40);

  samples.forEach((sample, index) => {
    buffer.writeInt16LE(sample, 44 + index * bytesPerSample);
  });

  return new Uint8Array(buffer);
}
