const MP3_BITRATE_KBPS = 320;
const MP3_SAMPLE_BLOCK_SIZE = 1152;

const fileInput = document.querySelector("#fileInput");
const dropZone = document.querySelector("#dropZone");
const fileList = document.querySelector("#fileList");
const convertButton = document.querySelector("#convertButton");
const clearButton = document.querySelector("#clearButton");
const statusText = document.querySelector("#status");

let selectedFiles = [];

const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
const audioContext = new AudioContextConstructor();

const setStatus = (message) => {
  statusText.textContent = message;
};

const isWavFile = (file) =>
  file.type === "audio/wav" || file.type === "audio/x-wav" || file.name.toLowerCase().endsWith(".wav");

const formatBytes = (bytes) => {
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
};

const renderFileList = () => {
  fileList.innerHTML = "";

  selectedFiles.forEach((file, index) => {
    const item = document.createElement("li");
    const fileDetails = document.createElement("div");
    const fileName = document.createElement("strong");
    const fileSize = document.createElement("span");
    const badge = document.createElement("span");

    item.className = "file-item";
    fileName.textContent = file.name;
    fileSize.textContent = formatBytes(file.size);
    badge.className = "file-item__badge";
    badge.id = `file-status-${index}`;
    badge.textContent = "待機中";

    fileDetails.append(fileName, fileSize);
    item.append(fileDetails, badge);
    fileList.append(item);
  });

  convertButton.disabled = selectedFiles.length === 0;
  clearButton.disabled = selectedFiles.length === 0;
};

const updateFileStatus = (index, message, state = "") => {
  const badge = document.querySelector(`#file-status-${index}`);
  if (!badge) return;
  badge.textContent = message;
  badge.dataset.state = state;
};

const addFiles = (files) => {
  const wavFiles = Array.from(files).filter(isWavFile);
  selectedFiles = [...selectedFiles, ...wavFiles];
  renderFileList();

  if (wavFiles.length === 0) {
    setStatus("WAVファイルのみアップロードできます。");
    return;
  }

  setStatus(`${wavFiles.length}件のWAVファイルを追加しました。`);
};

const clearFiles = () => {
  selectedFiles = [];
  fileInput.value = "";
  renderFileList();
  setStatus("WAVファイルを選択してください。");
};

const convertFloatToInt16 = (channelData) => {
  const samples = new Int16Array(channelData.length);

  for (let index = 0; index < channelData.length; index += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[index]));
    samples[index] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  return samples;
};

const encodeAudioBufferToMp3 = (audioBuffer) => {
  const channelCount = Math.min(audioBuffer.numberOfChannels, 2);
  const mp3Encoder = new lamejs.Mp3Encoder(channelCount, audioBuffer.sampleRate, MP3_BITRATE_KBPS);
  const left = convertFloatToInt16(audioBuffer.getChannelData(0));
  const right = channelCount === 2 ? convertFloatToInt16(audioBuffer.getChannelData(1)) : null;
  const mp3Chunks = [];

  for (let offset = 0; offset < left.length; offset += MP3_SAMPLE_BLOCK_SIZE) {
    const leftChunk = left.subarray(offset, offset + MP3_SAMPLE_BLOCK_SIZE);
    const mp3Buffer = right
      ? mp3Encoder.encodeBuffer(leftChunk, right.subarray(offset, offset + MP3_SAMPLE_BLOCK_SIZE))
      : mp3Encoder.encodeBuffer(leftChunk);

    if (mp3Buffer.length > 0) {
      mp3Chunks.push(mp3Buffer);
    }
  }

  const finalBuffer = mp3Encoder.flush();
  if (finalBuffer.length > 0) {
    mp3Chunks.push(finalBuffer);
  }

  return new Blob(mp3Chunks, { type: "audio/mpeg" });
};

const downloadBlob = (blob, fileName) => {
  const link = document.createElement("a");
  const objectUrl = URL.createObjectURL(blob);

  link.href = objectUrl;
  link.download = fileName.replace(/\.wav$/i, ".mp3");
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(objectUrl);
};

const convertFiles = async () => {
  if (!selectedFiles.length) return;

  convertButton.disabled = true;
  clearButton.disabled = true;

  for (const [index, file] of selectedFiles.entries()) {
    try {
      setStatus(`${file.name} を変換中です...`);
      updateFileStatus(index, "変換中", "working");

      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      const mp3Blob = encodeAudioBufferToMp3(audioBuffer);
      downloadBlob(mp3Blob, file.name);

      updateFileStatus(index, "完了", "done");
    } catch (error) {
      console.error(error);
      updateFileStatus(index, "失敗", "error");
    }
  }

  setStatus("変換が完了しました。MP3ファイルのダウンロードを確認してください。");
  convertButton.disabled = false;
  clearButton.disabled = false;
};

fileInput.addEventListener("change", (event) => addFiles(event.target.files));
clearButton.addEventListener("click", clearFiles);
convertButton.addEventListener("click", convertFiles);

["dragenter", "dragover"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("drop-zone--active");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("drop-zone--active");
  });
});

dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));
