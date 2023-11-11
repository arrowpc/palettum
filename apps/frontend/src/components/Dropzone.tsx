import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

const Dropzone: React.FC = () => {
  const [selectedImage, setSelectedImage] = useState<string>("");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = function(e) {
        setSelectedImage(e.target!.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const { getRootProps, getInputProps, isDragAccept, isDragReject } = useDropzone({
    onDrop,
    accept: 'image/*' as any,
    maxFiles: 1,
  });

  return (
    <div {...getRootProps()} className={`dropzone ${isDragAccept ? 'accept' : ''} ${isDragReject ? 'reject' : ''}`}>
      <input {...getInputProps()} />
      {selectedImage ? (
        <img src={selectedImage} alt="Uploaded" className="image-preview" />
      ) : (
        <p>DRAG & DROP</p>
      )}
    </div>
  );
};

export default Dropzone;
