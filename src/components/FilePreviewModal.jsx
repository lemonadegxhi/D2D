export default function FilePreviewModal({ preview, onClose }) {
  if (!preview) {
    return null;
  }

  return (
    <div className="pdf-preview-overlay" onClick={onClose}>
      <div className="pdf-preview-modal" onClick={(event) => event.stopPropagation()}>
        <div className="pdf-preview-header">
          <strong>{preview.name}</strong>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        {preview.type === "image" ? (
          <div className="file-preview-image-shell">
            <img className="file-preview-image" src={preview.url} alt={preview.name} />
          </div>
        ) : preview.type === "docx" ? (
          <div className="docx-preview-text" tabIndex={0}>
            {preview.text}
          </div>
        ) : (
          <iframe className="pdf-preview-frame" src={preview.url} title={preview.name} />
        )}
      </div>
    </div>
  );
}
