import React, { useState, useEffect } from 'react';

interface LinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (url: string) => void;
}

const LinkModal: React.FC<LinkModalProps> = ({ isOpen, onClose, onConfirm }) => {
  const [url, setUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      setUrl(''); // Reset URL when modal opens
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(url);
  };
  
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex justify-center items-center z-50 animate-fade-in-down"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
      style={{ animationDuration: '0.2s' }}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6 m-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-4">Insert Link</h3>
        <p className="text-gray-600 dark:text-gray-300 mb-4">
          Enter the URL you want to link to.
        </p>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyPress={handleKeyPress}
          className="w-full bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-white rounded-md px-3 py-2 mb-6 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          placeholder="https://example.com"
          autoFocus
        />
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded-md transition-colors"
          >
            Add Link
          </button>
        </div>
      </div>
    </div>
  );
};

export default LinkModal;