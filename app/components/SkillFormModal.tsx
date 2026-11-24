import React, { useState, useEffect } from 'react';
import { Skill, ReferenceAge } from '../types';
import { compressImage } from '../utils/imageUtils';
import useModalDismiss from '../hooks/useModalDismiss';
import { toast } from '../utils/toast';
import StoredImage from '../images/StoredImage';

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

interface SkillFormModalProps {
  title: string;
  skillToEdit?: Skill;
  onSave: (data: { name: string; referenceAges: ReferenceAge[]; image: string | null; description: string }) => void;
  onClose: () => void;
  saveText?: string;
}

const PhotoIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
    </svg>
);

const REFERENCE_AGE_BUTTON_CLASSES: { [key in ReferenceAge]: { base: string; selected: string } } = {
  [ReferenceAge.Under4]: {
    base: 'bg-pink-100 text-pink-800 hover:bg-pink-200 dark:bg-pink-900/40 dark:text-pink-300 dark:hover:bg-pink-900/60',
    selected: 'bg-pink-500 text-white ring-2 ring-offset-2 ring-pink-500 dark:ring-offset-zinc-800',
  },
  [ReferenceAge.At4]: {
    base: 'bg-green-100 text-green-800 hover:bg-green-200 dark:bg-green-900/40 dark:text-green-300 dark:hover:bg-green-900/60',
    selected: 'bg-green-500 text-white ring-2 ring-offset-2 ring-green-500 dark:ring-offset-zinc-800',
  },
  [ReferenceAge.Over4]: {
    base: 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-300 dark:hover:bg-blue-900/60',
    selected: 'bg-blue-500 text-white ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-zinc-800',
  },
};


const SkillFormModal: React.FC<SkillFormModalProps> = ({ title, skillToEdit, onSave, onClose, saveText = "Enregistrer" }) => {
  const [name, setName] = useState('');
  const [referenceAges, setReferenceAges] = useState<ReferenceAge[]>([]);
  const [image, setImage] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [isImportingImage, setIsImportingImage] = useState(false);

  useEffect(() => {
    if (skillToEdit) {
      setName(skillToEdit.name);
      setReferenceAges(skillToEdit.referenceAges || []);
      setImage(skillToEdit.image || null);
      setDescription(skillToEdit.description || '');
    } else {
        setName('');
        setReferenceAges([]);
        setImage(null);
        setDescription('');
    }
  }, [skillToEdit]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSave({ name: name.trim(), referenceAges, image, description: description.trim() });
    }
  };

  const handleToggleReferenceAge = (age: ReferenceAge) => {
    setReferenceAges(prev => {
        const newAges = new Set(prev);
        if (newAges.has(age)) {
            newAges.delete(age);
        } else {
            newAges.add(age);
        }
        return Array.from(newAges);
    });
  };

  const handleImageImport = async () => {
    if (isImportingImage) return;
    if (window.electronAPI) {
        setIsImportingImage(true);
        try {
            const result = await window.electronAPI.openImageFile();
            if (result && typeof result === 'string') {
                const ref = await compressImage(result);
                if (ref) setImage(ref);
            } else if (result && (result as {error: string}).error) {
                toast.error(`Erreur d'importation de l'image : ${(result as any).error}`);
            }
        } finally {
            setIsImportingImage(false);
        }
    }
  };

  const handleRemoveImage = () => setImage(null);

  // Valeurs initiales (mêmes règles que le useEffect ci-dessus) pour détecter les saisies en cours.
  const initialAges = skillToEdit?.referenceAges || [];
  const sameAges = referenceAges.length === initialAges.length && referenceAges.every(a => initialAges.includes(a));
  const isDirty =
    name !== (skillToEdit?.name ?? '') ||
    image !== (skillToEdit?.image || null) ||
    description !== (skillToEdit?.description || '') ||
    !sameAges;
  const handleBackdropClick = useModalDismiss(onClose, true, !isDirty);

  return (
    <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <form onSubmit={handleSubmit} className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg p-8 relative overflow-y-auto max-h-[90vh]">
        <button type="button" onClick={onClose} aria-label="Fermer" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300">
          <XMarkIcon className="w-6 h-6" />
        </button>
        <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-200 mb-6">{title}</h2>
        <div className="space-y-6">
            <div>
              <label htmlFor="skill-name" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Nom de la compétence</label>
              <input
                type="text"
                id="skill-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="skill-description" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Description (optionnel)</label>
               <textarea
                id="skill-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
                placeholder="Ajoutez des détails sur la compétence, les critères de validation, etc."
              />
            </div>

            <div>
                 <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Image de la compétence (optionnel)</label>
                 <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 dark:border-zinc-600 border-dashed rounded-md">
                    <div className="space-y-1 text-center">
                        {image ? (
                            <StoredImage src={image} alt="Aperçu" className="mx-auto h-24 w-auto rounded-md object-contain" />
                        ) : (
                            <PhotoIcon className="mx-auto h-12 w-12 text-slate-400 dark:text-zinc-500"/>
                        )}
                        <div className="flex items-center justify-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
                            <button 
                                type="button" 
                                onClick={handleImageImport} 
                                disabled={isImportingImage}
                                className={`relative cursor-pointer bg-white dark:bg-zinc-800 rounded-md font-medium focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-blue-500 dark:focus-within:ring-offset-zinc-800 ${isImportingImage ? 'text-slate-400 cursor-not-allowed' : 'text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300'}`}
                            >
                                <span>{isImportingImage ? "Chargement..." : (image ? "Changer" : "Importer une image")}</span>
                            </button>
                            {image && !isImportingImage && (
                                <>
                                    <span className="text-slate-300 dark:text-zinc-600">|</span>
                                    <button type="button" onClick={handleRemoveImage} className="font-medium text-red-600 hover:text-red-500 dark:text-red-400 dark:hover:text-red-300">Supprimer</button>
                                </>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-zinc-500">PNG, JPG</p>
                    </div>
                 </div>
            </div>

            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Âges de référence</label>
                <div className="mt-2 grid grid-cols-3 gap-3">
                    {Object.values(ReferenceAge).map(age => (
                        <button
                            key={age}
                            type="button"
                            onClick={() => handleToggleReferenceAge(age)}
                            className={`w-full text-center px-2 py-2 text-sm font-semibold rounded-md transition-all duration-150 focus:outline-none ${
                                referenceAges.includes(age)
                                ? REFERENCE_AGE_BUTTON_CLASSES[age].selected
                                : REFERENCE_AGE_BUTTON_CLASSES[age].base
                            }`}
                        >
                            {age}
                        </button>
                    ))}
                </div>
            </div>
        </div>
        <div className="flex justify-end gap-4 pt-8">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-600 font-semibold">
            Annuler
          </button>
          <button type="submit" className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold">
            {saveText}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SkillFormModal;