import { useState } from "react";

function ImageUpload() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
    }
  }

  return (
    <div>
      <h2>Upload Image</h2>
      <input type="file" onChange={handleFileChange} />
      {selectedFile && <p>Selected file: {selectedFile.name}</p>}
    </div>
  );
}

export default ImageUpload;
