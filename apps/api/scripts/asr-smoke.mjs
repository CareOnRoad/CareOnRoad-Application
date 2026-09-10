/* global console, process */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import sherpaOnnx from "sherpa-onnx-node";

loadEnvFile(".env.local");

const modelDir =
  process.env.SHERPA_ONNX_MODEL_DIR ?? "./models/sherpa-onnx-zipformer-vi-30M-int8-2026-02-09";
const explicitAudioPath = process.argv[2];
const audioPath = explicitAudioPath ?? path.join(modelDir, "test_wavs", "0.wav");

const files = {
  encoder: process.env.SHERPA_ONNX_ENCODER ?? "encoder.int8.onnx",
  decoder: process.env.SHERPA_ONNX_DECODER ?? "decoder.onnx",
  joiner: process.env.SHERPA_ONNX_JOINER ?? "joiner.int8.onnx",
  tokens: process.env.SHERPA_ONNX_TOKENS ?? "tokens.txt"
};

const missingFiles = Object.values(files)
  .map((fileName) => path.join(modelDir, fileName))
  .filter((filePath) => !existsSync(filePath));

if (missingFiles.length > 0) {
  console.error(`ASR_MODEL_NOT_FOUND: ${missingFiles.join(", ")}`);
  process.exit(1);
}

if (!existsSync(audioPath) && explicitAudioPath) {
  console.error(`ASR_INVALID_AUDIO: ${audioPath}`);
  process.exit(1);
}

if (!existsSync(audioPath)) {
  console.log(
    JSON.stringify(
      {
        model_ready: true,
        text: null,
        message: "No default sample WAV found. Pass a WAV path to run transcription."
      },
      null,
      2
    )
  );
  process.exit(0);
}

const config = {
  featConfig: {
    sampleRate: 16000,
    featureDim: 80
  },
  modelConfig: {
    transducer: {
      encoder: path.resolve(modelDir, files.encoder),
      decoder: path.resolve(modelDir, files.decoder),
      joiner: path.resolve(modelDir, files.joiner)
    },
    tokens: path.resolve(modelDir, files.tokens),
    bpeVocab: "",
    modelingUnit: "cjkchar",
    numThreads: 1,
    debug: 0,
    provider: "cpu"
  },
  decodingMethod: "greedy_search",
  maxActivePaths: 4
};

const recognizer = new sherpaOnnx.OfflineRecognizer(config);
const wave = sherpaOnnx.readWave(audioPath);
const stream = recognizer.createStream();

stream.acceptWaveform({
  samples: wave.samples,
  sampleRate: wave.sampleRate
});
recognizer.decode(stream);

const result = recognizer.getResult(stream);
console.log(JSON.stringify({ text: result.text ?? "" }, null, 2));

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return;
  }

  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex);
    const value = trimmed.slice(separatorIndex + 1);
    process.env[key] ??= value;
  }
}
