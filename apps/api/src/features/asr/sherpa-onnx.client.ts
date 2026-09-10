import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import type { AsrAudioInput, AsrResult, AsrTranscriber } from "./asr.types";
import { asrFailure, retryMessage } from "./asr.types";

export type SherpaOnnxModelConfig = {
  modelDir: string;
  encoder: string;
  decoder: string;
  joiner: string;
  tokens: string;
};

export type SherpaOnnxRuntime = {
  transcribe(input: AsrAudioInput, config: SherpaOnnxModelConfig): Promise<string> | string;
};

export type SherpaOnnxRecognizerConfig = {
  featConfig: {
    sampleRate: number;
    featureDim: number;
  };
  modelConfig: {
    transducer: {
      encoder: string;
      decoder: string;
      joiner: string;
    };
    tokens: string;
    bpeVocab: "";
    modelingUnit: "cjkchar";
    numThreads: number;
    debug: number;
    provider: "cpu";
  };
  decodingMethod: "greedy_search";
  maxActivePaths: number;
};

type SherpaOnnxWaveform = {
  samples: Float32Array;
  sampleRate: number;
};

type SherpaOnnxOfflineStream = {
  acceptWaveform(input: SherpaOnnxWaveform): void;
};

type SherpaOnnxOfflineRecognizer = {
  createStream(): SherpaOnnxOfflineStream;
  decode(stream: SherpaOnnxOfflineStream): void;
  getResult(stream: SherpaOnnxOfflineStream): {
    text?: string;
  };
};

export type SherpaOnnxNodeModule = {
  OfflineRecognizer: new (config: SherpaOnnxRecognizerConfig) => SherpaOnnxOfflineRecognizer;
};

export type SherpaOnnxClientOptions = {
  env?: NodeJS.ProcessEnv;
  exists?: (filePath: string) => boolean;
  loadRuntime?: () => Promise<SherpaOnnxRuntime | null>;
};

const defaultModelConfig: SherpaOnnxModelConfig = {
  modelDir: "./models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09",
  encoder: "encoder.int8.onnx",
  decoder: "decoder.onnx",
  joiner: "joiner.int8.onnx",
  tokens: "tokens.txt"
};

export class SherpaOnnxClient implements AsrTranscriber {
  private readonly env: NodeJS.ProcessEnv;
  private readonly exists: (filePath: string) => boolean;
  private readonly loadRuntime: () => Promise<SherpaOnnxRuntime | null>;

  constructor(options: SherpaOnnxClientOptions = {}) {
    this.env = options.env ?? process.env;
    this.exists = options.exists ?? existsSync;
    this.loadRuntime = options.loadRuntime ?? defaultRuntimeLoader;
  }

  getModelConfig(): SherpaOnnxModelConfig {
    return createSherpaOnnxModelConfig(this.env);
  }

  getRequiredModelFiles(): string[] {
    return getRequiredModelFiles(this.getModelConfig());
  }

  hasModelFiles(): boolean {
    return this.getRequiredModelFiles().every((filePath) => this.exists(filePath));
  }

  async transcribe(input: AsrAudioInput): Promise<AsrResult> {
    const config = this.getModelConfig();
    const missingFiles = getRequiredModelFiles(config).filter((filePath) => !this.exists(filePath));

    if (missingFiles.length > 0) {
      return asrFailure("ASR_MODEL_NOT_FOUND", retryMessage());
    }

    const runtime = await this.loadRuntime();
    if (!runtime) {
      return asrFailure("ASR_NOT_AVAILABLE", retryMessage());
    }

    try {
      const text = (await runtime.transcribe(input, config)).trim();

      if (!text) {
        return asrFailure("ASR_EMPTY_TRANSCRIPTION", retryMessage());
      }

      return {
        success: true,
        text
      };
    } catch (error) {
      if (error instanceof InvalidWavAudioError) {
        return asrFailure("ASR_INVALID_AUDIO", retryMessage());
      }

      return asrFailure("ASR_TRANSCRIPTION_FAILED", retryMessage());
    }
  }
}

export function createSherpaOnnxModelConfig(env: NodeJS.ProcessEnv = process.env): SherpaOnnxModelConfig {
  return {
    modelDir: resolveModelDir(env.SHERPA_ONNX_MODEL_DIR ?? defaultModelConfig.modelDir),
    encoder: env.SHERPA_ONNX_ENCODER ?? defaultModelConfig.encoder,
    decoder: env.SHERPA_ONNX_DECODER ?? defaultModelConfig.decoder,
    joiner: env.SHERPA_ONNX_JOINER ?? defaultModelConfig.joiner,
    tokens: env.SHERPA_ONNX_TOKENS ?? defaultModelConfig.tokens
  };
}

export function getRequiredModelFiles(config: SherpaOnnxModelConfig): string[] {
  return [config.encoder, config.decoder, config.joiner, config.tokens].map((fileName) =>
    path.join(config.modelDir, fileName)
  );
}

export function createSherpaOnnxRecognizerConfig(config: SherpaOnnxModelConfig): SherpaOnnxRecognizerConfig {
  return {
    featConfig: {
      sampleRate: 16000,
      featureDim: 80
    },
    modelConfig: {
      transducer: {
        encoder: path.resolve(config.modelDir, config.encoder),
        decoder: path.resolve(config.modelDir, config.decoder),
        joiner: path.resolve(config.modelDir, config.joiner)
      },
      tokens: path.resolve(config.modelDir, config.tokens),
      bpeVocab: "",
      modelingUnit: "cjkchar",
      numThreads: 1,
      debug: 0,
      provider: "cpu"
    },
    decodingMethod: "greedy_search",
    maxActivePaths: 4
  };
}

export function createNodeSherpaOnnxRuntime(module: SherpaOnnxNodeModule): SherpaOnnxRuntime {
  const recognizers = new Map<string, SherpaOnnxOfflineRecognizer>();

  return {
    transcribe(input, config) {
      if (!input.data) {
        throw new InvalidWavAudioError();
      }

      const recognizer = getCachedRecognizer(module, config, recognizers);
      const stream = recognizer.createStream();
      stream.acceptWaveform(decodeWavAudio(input.data));
      recognizer.decode(stream);

      return recognizer.getResult(stream).text ?? "";
    }
  };
}

let defaultRuntimePromise: Promise<SherpaOnnxRuntime | null> | null = null;

async function defaultRuntimeLoader(): Promise<SherpaOnnxRuntime | null> {
  defaultRuntimePromise ??= loadDefaultRuntime();
  return defaultRuntimePromise;
}

async function loadDefaultRuntime(): Promise<SherpaOnnxRuntime | null> {
  try {
    return createNodeSherpaOnnxRuntime(loadSherpaOnnxNodeModule());
  } catch {
    return null;
  }
}

function getCachedRecognizer(
  module: SherpaOnnxNodeModule,
  config: SherpaOnnxModelConfig,
  recognizers: Map<string, SherpaOnnxOfflineRecognizer>
): SherpaOnnxOfflineRecognizer {
  const cacheKey = recognizerCacheKey(config);
  let recognizer = recognizers.get(cacheKey);

  if (!recognizer) {
    recognizer = new module.OfflineRecognizer(createSherpaOnnxRecognizerConfig(config));
    recognizers.set(cacheKey, recognizer);
  }

  return recognizer;
}

function recognizerCacheKey(config: SherpaOnnxModelConfig): string {
  return [config.modelDir, config.encoder, config.decoder, config.joiner, config.tokens].join("|");
}

function resolveModelDir(modelDir: string): string {
  if (path.isAbsolute(modelDir)) {
    return modelDir;
  }

  return path.resolve(findProjectRoot(), modelDir);
}

function findProjectRoot(startDir = process.cwd()): string {
  let currentDir = startDir;

  while (true) {
    if (existsSync(path.join(currentDir, "package.json"))) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return startDir;
    }

    currentDir = parentDir;
  }
}

function loadSherpaOnnxNodeModule(): SherpaOnnxNodeModule {
  const require = createRequire(import.meta.url);
  const runtime = require("sherpa-onnx-node") as Partial<SherpaOnnxNodeModule>;

  if (typeof runtime.OfflineRecognizer !== "function") {
    throw new Error("sherpa-onnx-node OfflineRecognizer is unavailable");
  }

  return runtime as SherpaOnnxNodeModule;
}

function decodeWavAudio(data: Uint8Array | ArrayBuffer): SherpaOnnxWaveform {
  const buffer = data instanceof ArrayBuffer ? Buffer.from(data) : Buffer.from(data.buffer, data.byteOffset, data.byteLength);

  if (buffer.length < 44 || buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WAVE") {
    throw new InvalidWavAudioError();
  }

  const fmt = findWavChunk(buffer, "fmt ");
  const audioData = findWavChunk(buffer, "data");

  if (!fmt || !audioData || fmt.size < 16) {
    throw new InvalidWavAudioError();
  }

  const audioFormat = buffer.readUInt16LE(fmt.offset);
  const channelCount = buffer.readUInt16LE(fmt.offset + 2);
  const sampleRate = buffer.readUInt32LE(fmt.offset + 4);
  const blockAlign = buffer.readUInt16LE(fmt.offset + 12);
  const bitsPerSample = buffer.readUInt16LE(fmt.offset + 14);

  if (channelCount <= 0 || sampleRate <= 0 || blockAlign <= 0 || audioData.size <= 0) {
    throw new InvalidWavAudioError();
  }

  const bytesPerSample = bitsPerSample / 8;
  if (!Number.isInteger(bytesPerSample) || blockAlign < bytesPerSample * channelCount) {
    throw new InvalidWavAudioError();
  }

  const frameCount = Math.floor(audioData.size / blockAlign);
  const samples = new Float32Array(frameCount);

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    let mixedSample = 0;
    const frameOffset = audioData.offset + frameIndex * blockAlign;

    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      mixedSample += readWavSample(buffer, frameOffset + channelIndex * bytesPerSample, audioFormat, bitsPerSample);
    }

    samples[frameIndex] = mixedSample / channelCount;
  }

  return {
    samples,
    sampleRate
  };
}

function findWavChunk(buffer: Buffer, chunkId: string): { offset: number; size: number } | null {
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString("ascii", offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;

    if (dataOffset + size > buffer.length) {
      throw new InvalidWavAudioError();
    }

    if (id === chunkId) {
      return {
        offset: dataOffset,
        size
      };
    }

    offset = dataOffset + size + (size % 2);
  }

  return null;
}

function readWavSample(buffer: Buffer, offset: number, audioFormat: number, bitsPerSample: number): number {
  if (audioFormat === 3 && bitsPerSample === 32) {
    return clampSample(buffer.readFloatLE(offset));
  }

  if (audioFormat !== 1) {
    throw new InvalidWavAudioError();
  }

  if (bitsPerSample === 8) {
    return (buffer.readUInt8(offset) - 128) / 128;
  }

  if (bitsPerSample === 16) {
    return buffer.readInt16LE(offset) / 32768;
  }

  if (bitsPerSample === 24) {
    const value = buffer.readUIntLE(offset, 3);
    const signed = value & 0x800000 ? value | 0xff000000 : value;
    return signed / 8388608;
  }

  if (bitsPerSample === 32) {
    return buffer.readInt32LE(offset) / 2147483648;
  }

  throw new InvalidWavAudioError();
}

function clampSample(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

class InvalidWavAudioError extends Error {
  constructor() {
    super("Invalid WAV audio");
  }
}
