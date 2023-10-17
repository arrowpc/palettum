import React, { useState } from 'react';

const ImageUpload: React.FC = () => {
    const [selectedImage, setSelectedImage] = useState<File | null>(null);
    const [imageSrc, setImageSrc] = useState<string | null>(null);

    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            setSelectedImage(file);
            setImageSrc(URL.createObjectURL(file));
        }
    };

    return (
        <div className="image-upload">
            <input type="file" accept="image/*" onChange={handleImageUpload} />
            {imageSrc && <img src={imageSrc} alt="Selected" />}
        </div>
    );
};

export default ImageUpload;