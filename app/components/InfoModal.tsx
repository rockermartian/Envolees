import React from 'react';
import useModalDismiss from '../hooks/useModalDismiss';

interface InfoModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  onClose: () => void;
  buttonText?: string;
}

const InfoModal: React.FC<InfoModalProps> = ({ isOpen, title, message, onClose, buttonText = "OK" }) => {
  const handleBackdropClick = useModalDismiss(onClose, isOpen);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-[101] p-4 print-hidden" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-sm p-6 text-left">
        <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-200">{title}</h3>
        <p className="text-sm text-slate-600 dark:text-zinc-400 mt-2">{message}</p>
        <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold">
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoModal;