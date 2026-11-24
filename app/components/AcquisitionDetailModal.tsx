import React, { useState, useEffect } from 'react';
import { SkillAcquisitionDetails } from '../types';
import { compressImage } from '../utils/imageUtils';
import useModalDismiss from '../hooks/useModalDismiss';
import StoredImage from '../images/StoredImage';
import { todayLocalISO } from '../domain/dates';
import { isAcquired } from '../domain/acquisitions';

interface AcquisitionDetailModalProps {
  skillName: string;
  initialDetails: SkillAcquisitionDetails | null;
  onSave: (data: { date: string; photo: string | null }) => void;
  onClose: () => void;
}

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const PhotoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);


const AcquisitionDetailModal: React.FC<AcquisitionDetailModalProps> = ({ skillName, initialDetails, onSave, onClose }) => {
  const [date, setDate] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  
  useEffect(() => {
    // Set initial values for editing
    if (initialDetails) {
      setDate(initialDetails.date || todayLocalISO());
      setPhoto(initialDetails.photo || null);
      setPhotoPreview(initialDetails.photo || null);
    } else {
      // Set default date for new acquisition
      setDate(todayLocalISO());
    }
  }, [initialDetails]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (date) {
      onSave({ date, photo });
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const compressed = await compressImage(reader.result as string);
        if (!compressed) return; // illisible : la photo précédente est conservée
        setPhoto(compressed);
        setPhotoPreview(compressed);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    const fileInput = document.getElementById('photo-file-upload') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = '';
    }
  };

  // Valeurs initiales (mêmes règles que le useEffect ci-dessus) pour détecter les saisies en cours.
  const today = todayLocalISO();
  const initialDate = initialDetails ? (initialDetails.date || today) : today;
  const initialPhoto = initialDetails?.photo || null;
  const isDirty = date !== initialDate || photo !== initialPhoto;
  const handleBackdropClick = useModalDismiss(onClose, true, !isDirty);

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" aria-modal="true" role="dialog" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-6 sm:p-8 relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300" aria-label="Fermer">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-200">{isAcquired(initialDetails ?? undefined) ? 'Modifier la validation' : 'Valider la compétence'}</h2>
            <p className="text-slate-500 dark:text-zinc-400 mt-1">"{skillName}"</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div>
            <label htmlFor="acquisition-date" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Date de validation</label>
            <input
              type="date"
              id="acquisition-date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
              required
            />
          </div>

          <div>
             <label htmlFor="photo-file-upload" className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Ajouter une photo (optionnel)</label>
             <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-zinc-600 border-dashed rounded-md">
                <div className="space-y-1 text-center">
                    {photoPreview ? (
                        <StoredImage src={photoPreview} alt="Aperçu" className="mx-auto h-24 w-auto rounded-md object-contain" />
                    ) : (
                        <PhotoIcon className="mx-auto h-12 w-12 text-slate-400 dark:text-zinc-500"/>
                    )}
                    <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                        <label htmlFor="photo-file-upload" className="relative cursor-pointer bg-white dark:bg-zinc-800 rounded-md font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 dark:focus-within:ring-offset-zinc-800">
                        <span>{photoPreview ? "Changer de photo" : "Importer une photo"}</span>
                        <input id="photo-file-upload" name="photo-file-upload" type="file" className="sr-only" accept="image/*" onChange={handlePhotoChange} />
                        </label>
                        {photoPreview && (
                            <>
                                <span className="text-slate-300 dark:text-zinc-600">|</span>
                                <button
                                    type="button"
                                    onClick={handleRemovePhoto}
                                    className="font-medium text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300"
                                >
                                    Supprimer
                                </button>
                            </>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-zinc-500">JPEG, PNG ou WebP (réduite automatiquement)</p>
                </div>
             </div>
          </div>
          
          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-600 font-semibold"
            >
              Annuler
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AcquisitionDetailModal;