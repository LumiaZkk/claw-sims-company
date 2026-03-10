import { useCallback, useState } from "react";

export function useChatDragAndDrop(input: {
  processTextFileUpload: (file: File) => Promise<void>;
  processImageFile: (file: File) => void;
}) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      setIsDragging(false);
      const file = event.dataTransfer.files[0];
      if (!file) {
        return;
      }
      if (file.type.startsWith("image/")) {
        input.processImageFile(file);
        return;
      }
      void input.processTextFileUpload(file);
    },
    [input],
  );

  return {
    isDragging,
    handleDragOver,
    handleDragLeave,
    handleDrop,
  };
}
