export default function FolderTree({ nodes, activeFolderId, onSelectFolder, onDropFile }) {
  return (
    <div className="folder-tree">
      {nodes.map((node) => (
        <div key={node.id} className="folder-tree-node">
          <button
            type="button"
            className={`folder-tree-item ${activeFolderId === node.id ? "active" : ""}`}
            onClick={() => onSelectFolder(node.id)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              onDropFile(event, node.id);
            }}
          >
            <span className="folder-icon">&gt;</span>
            <span>{node.name}</span>
          </button>
          {node.children.length > 0 ? (
            <FolderTree
              nodes={node.children}
              activeFolderId={activeFolderId}
              onSelectFolder={onSelectFolder}
              onDropFile={onDropFile}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}
