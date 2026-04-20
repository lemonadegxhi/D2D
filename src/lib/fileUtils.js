export function normalizeRelativePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\/+|\/+$/g, "");
}

export function getSelectionKey(item) {
  return `${item.type}:${item.id}`;
}

export function getItemFromEntry(entry) {
  return {
    type: entry.item_type,
    id: entry.id,
  };
}

export function getFileCategory(file) {
  const mimeType = String(file?.mime_type || "").toLowerCase();
  const name = String(file?.original_name || "").toLowerCase();

  if (mimeType.startsWith("image/")) {
    return "Image";
  }

  if (mimeType.startsWith("audio/")) {
    return "Audio";
  }

  if (mimeType.startsWith("video/")) {
    return "Video";
  }

  if (
    mimeType.includes("zip") ||
    mimeType.includes("compressed") ||
    name.endsWith(".zip") ||
    name.endsWith(".rar") ||
    name.endsWith(".7z")
  ) {
    return "Archive";
  }

  if (name.includes(".")) {
    return `${name.split(".").pop().toUpperCase()} file`;
  }

  return "File";
}

export function isPdfFile(file) {
  const mimeType = String(file?.mime_type || file?.type || "").toLowerCase();
  const name = String(file?.original_name || file?.name || "").toLowerCase();

  return mimeType.includes("pdf") || name.endsWith(".pdf");
}

export function isImageFile(file) {
  const mimeType = String(file?.mime_type || file?.type || "").toLowerCase();
  const name = String(file?.original_name || file?.name || "").toLowerCase();

  return (
    mimeType.startsWith("image/") ||
    [".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".svg"].some((extension) =>
      name.endsWith(extension)
    )
  );
}

export function isDocxFile(file) {
  const mimeType = String(file?.mime_type || file?.type || "").toLowerCase();
  const name = String(file?.original_name || file?.name || "").toLowerCase();

  return (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    name.endsWith(".docx")
  );
}

export function getFilePreviewType(file) {
  if (isPdfFile(file)) {
    return "pdf";
  }

  if (isImageFile(file)) {
    return "image";
  }

  if (isDocxFile(file)) {
    return "docx";
  }

  return null;
}

export function isPreviewableFile(file) {
  return getFilePreviewType(file) !== null;
}

export function getFilePreviewLabel(file) {
  const previewType = getFilePreviewType(file);

  if (previewType === "docx") {
    return "Preview DOCX";
  }

  if (previewType === "image") {
    return "Preview image";
  }

  if (previewType === "pdf") {
    return "Open PDF";
  }

  return "Preview";
}

function readUInt16(dataView, offset) {
  return dataView.getUint16(offset, true);
}

function readUInt32(dataView, offset) {
  return dataView.getUint32(offset, true);
}

async function inflateZipEntry(bytes) {
  if (typeof DecompressionStream !== "function") {
    throw new Error("DOCX preview is not supported in this browser.");
  }

  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function findZipEntry(arrayBuffer, targetName) {
  const dataView = new DataView(arrayBuffer);
  const decoder = new TextDecoder();
  const minEocdOffset = Math.max(0, arrayBuffer.byteLength - 65557);
  let eocdOffset = -1;

  for (let offset = arrayBuffer.byteLength - 22; offset >= minEocdOffset; offset -= 1) {
    if (readUInt32(dataView, offset) === 0x06054b50) {
      eocdOffset = offset;
      break;
    }
  }

  if (eocdOffset < 0) {
    throw new Error("DOCX preview failed because the file structure is invalid.");
  }

  const entryCount = readUInt16(dataView, eocdOffset + 10);
  let directoryOffset = readUInt32(dataView, eocdOffset + 16);

  for (let index = 0; index < entryCount; index += 1) {
    if (readUInt32(dataView, directoryOffset) !== 0x02014b50) {
      throw new Error("DOCX preview failed because the file structure is invalid.");
    }

    const compressionMethod = readUInt16(dataView, directoryOffset + 10);
    const compressedSize = readUInt32(dataView, directoryOffset + 20);
    const fileNameLength = readUInt16(dataView, directoryOffset + 28);
    const extraLength = readUInt16(dataView, directoryOffset + 30);
    const commentLength = readUInt16(dataView, directoryOffset + 32);
    const localHeaderOffset = readUInt32(dataView, directoryOffset + 42);
    const fileNameBytes = new Uint8Array(arrayBuffer, directoryOffset + 46, fileNameLength);
    const fileName = decoder.decode(fileNameBytes);

    if (fileName === targetName) {
      if (readUInt32(dataView, localHeaderOffset) !== 0x04034b50) {
        throw new Error("DOCX preview failed because the file structure is invalid.");
      }

      const localFileNameLength = readUInt16(dataView, localHeaderOffset + 26);
      const localExtraLength = readUInt16(dataView, localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localFileNameLength + localExtraLength;
      const compressedData = new Uint8Array(arrayBuffer, dataOffset, compressedSize);

      return {
        compressionMethod,
        compressedData,
      };
    }

    directoryOffset += 46 + fileNameLength + extraLength + commentLength;
  }

  throw new Error("DOCX preview failed because document.xml was not found.");
}

function extractTextFromDocumentXml(xmlText) {
  const documentXml = new DOMParser().parseFromString(xmlText, "application/xml");
  const paragraphs = Array.from(documentXml.getElementsByTagName("w:p"))
    .map((paragraph) =>
      Array.from(paragraph.getElementsByTagName("w:t"))
        .map((node) => node.textContent || "")
        .join("")
        .trim()
    )
    .filter(Boolean);

  if (paragraphs.length > 0) {
    return paragraphs.join("\n\n");
  }

  return Array.from(documentXml.getElementsByTagName("w:t"))
    .map((node) => node.textContent || "")
    .join(" ")
    .trim();
}

export async function extractDocxText(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const entry = findZipEntry(arrayBuffer, "word/document.xml");
  let xmlBytes;

  if (entry.compressionMethod === 0) {
    xmlBytes = entry.compressedData;
  } else if (entry.compressionMethod === 8) {
    xmlBytes = await inflateZipEntry(entry.compressedData);
  } else {
    throw new Error("DOCX preview failed because the compression method is unsupported.");
  }

  const xmlText = new TextDecoder("utf-8").decode(xmlBytes);
  const text = extractTextFromDocumentXml(xmlText);

  return text || "No previewable text was found in this DOCX file.";
}

export function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.split(",")[1];

      if (!base64) {
        reject(new Error("Failed to read file."));
        return;
      }

      resolve(base64);
    };

    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}

async function readEntry(entry, currentPath = "") {
  if (!entry) {
    return [];
  }

  if (entry.isFile) {
    return new Promise((resolve, reject) => {
      entry.file(
        (file) => {
          const relativePath = normalizeRelativePath(
            [currentPath, entry.name].filter(Boolean).join("/")
          );
          resolve([{ file, relativePath }]);
        },
        () => reject(new Error("Failed to read dropped file."))
      );
    });
  }

  if (!entry.isDirectory) {
    return [];
  }

  const reader = entry.createReader();
  const children = [];

  async function readBatch() {
    return new Promise((resolve, reject) => {
      reader.readEntries(resolve, () => reject(new Error("Failed to read dropped folder.")));
    });
  }

  while (true) {
    const batch = await readBatch();

    if (batch.length === 0) {
      break;
    }

    children.push(...batch);
  }

  const nestedGroups = await Promise.all(
    children.map((child) => readEntry(child, [currentPath, entry.name].filter(Boolean).join("/")))
  );

  return nestedGroups.flat();
}

export async function extractDroppedFiles(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []);
  const entryReaders = items
    .map((item) =>
      item.kind === "file" && typeof item.webkitGetAsEntry === "function"
        ? item.webkitGetAsEntry()
        : null
    )
    .filter(Boolean);

  if (entryReaders.length > 0) {
    const groups = await Promise.all(entryReaders.map((entry) => readEntry(entry)));
    return groups.flat();
  }

  return Array.from(dataTransfer?.files || []).map((file) => ({
    file,
    relativePath: normalizeRelativePath(file.webkitRelativePath || file.name),
  }));
}
