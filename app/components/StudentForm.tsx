import React, { useState, useEffect, useRef } from 'react';
import { Student, Section, Sex } from '../types';
import { sectionNames } from '../utils';
import Tooltip from './Tooltip';
import useModalDismiss from '../hooks/useModalDismiss';
import Cropper from 'cropperjs';
import 'cropperjs/dist/cropper.css';
import StoredImage from '../images/StoredImage';
import { storeCanvas } from '../utils/imageUtils';

interface StudentFormData {
    id: string | null;
    firstName: string;
    lastName: string;
    photo: string | null;
    dob: string;
    section: Section;
    contactEmail?: string;
    ine?: string;
    sex: Sex;
    miscInfo?: string;
}

interface StudentFormProps {
  onSave: (studentData: StudentFormData) => void;
  onClose: () => void;
  studentToEdit: Student | null;
}

const XMarkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const ImageCropperModal: React.FC<{
  imageSrc: string;
  onSave: (croppedImage: string) => void;
  onClose: () => void;
}> = ({ imageSrc, onSave, onClose }) => {
  const imageRef = useRef<HTMLImageElement>(null);
  const cropperRef = useRef<Cropper | null>(null);
  // Recadrage en cours : pas de fermeture au clic sur le fond (Échap et Annuler restent actifs).
  const handleBackdropClick = useModalDismiss(onClose, true, false);

  useEffect(() => {
    if (imageRef.current) {
      cropperRef.current = new Cropper(imageRef.current, {
        // The `aspectRatio` option might not be in older type definitions,
        // casting to `any` ensures compatibility.
        aspectRatio: 1,
        viewMode: 1,
        dragMode: 'move',
        background: false,
        autoCropArea: 0.8,
        movable: true,
        zoomable: true,
        scalable: true,
        rotatable: true,
      } as any);
    }

    return () => {
      cropperRef.current?.destroy();
    };
  }, [imageSrc]);

  const handleSave = async () => {
    if (cropperRef.current) {
      // Type definitions can be outdated; casting to `any` bypasses potential compiler errors
      // for a method that exists at runtime.
      const croppedCanvas: HTMLCanvasElement | null = (cropperRef.current as any).getCroppedCanvas({
        width: 256,
        height: 256,
        imageSmoothingQuality: 'high',
      });
      if (!croppedCanvas) return; // image pas encore chargée dans le recadreur
      // Portrait 256 × 256 rangé dans le magasin d'images (référence img:…)
      onSave(await storeCanvas(croppedCanvas));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex justify-center items-center z-[60] p-4" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
      <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-lg p-6">
        <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-200 mb-4">Recadrer la photo</h3>
        <div className="img-container-cropper">
          <img ref={imageRef} src={imageSrc} style={{ display: 'block', maxWidth: '100%' }} />
        </div>
        <p className="text-center text-sm text-slate-500 dark:text-zinc-400 mt-2">Utilisez la molette de la souris pour zoomer.</p>
        <div className="flex justify-end gap-4 pt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-100 dark:bg-zinc-700 text-slate-700 dark:text-zinc-300 rounded-md hover:bg-slate-200 dark:hover:bg-zinc-600 font-semibold">
            Annuler
          </button>
          <button type="button" onClick={handleSave} className="px-6 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-semibold">
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
};

const StudentForm: React.FC<StudentFormProps> = ({ onSave, onClose, studentToEdit }) => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [dob, setDob] = useState('');
  const [section, setSection] = useState<Section>(Section.PS);
  const [contactEmail, setContactEmail] = useState('');
  const [ine, setIne] = useState('');
  const [sex, setSex] = useState<Sex>(Sex.Boy);
  const [miscInfo, setMiscInfo] = useState('');

  const [imageToCrop, setImageToCrop] = useState<string | null>(null);

  const isEditMode = !!studentToEdit;

  // Formulaire « sale » : des saisies seraient perdues en cas de fermeture accidentelle.
  const isDirty = isEditMode
    ? firstName !== studentToEdit.firstName ||
      lastName !== studentToEdit.lastName ||
      photo !== studentToEdit.photo ||
      dob !== studentToEdit.dob ||
      section !== studentToEdit.section ||
      contactEmail !== (studentToEdit.contactEmail || '') ||
      ine !== (studentToEdit.ine || '') ||
      sex !== studentToEdit.sex ||
      miscInfo !== (studentToEdit.miscInfo || '')
    : !!(firstName || lastName || photo || dob || contactEmail || ine || miscInfo);

  // La modale de recadrage s'empile au-dessus : on ne ferme la fiche que si elle est seule.
  // Le clic sur le fond est neutralisé dès qu'il y a des saisies non enregistrées.
  const handleBackdropClick = useModalDismiss(onClose, !imageToCrop, !isDirty);

  useEffect(() => {
    if (isEditMode) {
      setFirstName(studentToEdit.firstName);
      setLastName(studentToEdit.lastName);
      setPhoto(studentToEdit.photo);
      setPhotoPreview(studentToEdit.photo);
      setDob(studentToEdit.dob);
      setSection(studentToEdit.section);
      setContactEmail(studentToEdit.contactEmail || '');
      setIne(studentToEdit.ine || '');
      setSex(studentToEdit.sex);
      setMiscInfo(studentToEdit.miscInfo || '');
    }
  }, [studentToEdit, isEditMode]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (firstName.trim() && lastName.trim() && dob) {
      onSave({
        id: studentToEdit ? studentToEdit.id : null,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        photo,
        dob,
        section,
        contactEmail: contactEmail.trim() || undefined,
        ine: ine.trim() || undefined,
        sex,
        miscInfo: miscInfo.trim() || undefined,
      });
      onClose();
    }
  };

  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageToCrop(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropSave = (croppedImage: string) => {
    setPhoto(croppedImage);
    setPhotoPreview(croppedImage);
    setImageToCrop(null);
  };
  
  const handleCropClose = () => {
    setImageToCrop(null);
    // Réinitialiser l'input file pour permettre la sélection du même fichier à nouveau
    const fileInput = document.getElementById('photo-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const handleRemovePhoto = () => {
    setPhoto(null);
    setPhotoPreview(null);
    const fileInput = document.getElementById('photo-upload') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = '';
    }
  };

  return (
    <>
      {imageToCrop && (
        <ImageCropperModal
          imageSrc={imageToCrop}
          onSave={handleCropSave}
          onClose={handleCropClose}
        />
      )}
      <div className="fixed inset-0 bg-black/60 flex justify-center items-center z-50 p-4" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
        <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-2xl w-full max-w-md p-8 relative overflow-y-auto max-h-full">
          <button onClick={onClose} aria-label="Fermer" className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300">
            <XMarkIcon className="w-6 h-6" />
          </button>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-200 mb-6">
            {isEditMode ? "Modifier l'élève" : "Ajouter un nouvel élève"}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex flex-col items-center">
              <label htmlFor="photo-upload" className="cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-slate-100 dark:bg-zinc-700 border-2 border-dashed border-slate-300 dark:border-zinc-600 flex items-center justify-center text-slate-400 dark:text-zinc-500 hover:bg-slate-200 dark:hover:bg-zinc-600 hover:border-slate-400 dark:hover:border-zinc-500 transition-colors">
                  {photoPreview ? (
                    <StoredImage src={photoPreview} alt="Aperçu" className="w-full h-full object-cover rounded-full" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                  )}
                </div>
              </label>
              <input id="photo-upload" type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} />
              <div className="flex items-center gap-4 mt-2 text-sm">
                  <label htmlFor="photo-upload" className="cursor-pointer font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300">
                      {photoPreview ? "Changer la photo" : "Ajouter une photo"}
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
            </div>

            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Prénom</label>
              <input
                type="text"
                id="firstName"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
                required
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Nom de famille</label>
              <input
                type="text"
                id="lastName"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
                required
              />
            </div>
            <div>
              <label htmlFor="dob" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Date de naissance</label>
              <input
                type="date"
                id="dob"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
                required
              />
            </div>
            <div>
              <label htmlFor="section" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Section</label>
              <select
                id="section"
                value={section}
                onChange={(e) => setSection(e.target.value as Section)}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
              >
                {Object.values(Section).map(sec => (
                  <option key={sec} value={sec}>{sectionNames[sec]}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <label htmlFor="ine" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">INE <span className="font-normal text-slate-400 dark:text-zinc-500 text-xs">(Facultatif)</span></label>
                <Tooltip content="L'Identifiant National Élève (INE) est un code unique à 11 caractères (ex : 1234567890A) attribué à chaque élève par l'Éducation Nationale. Il figure sur les bulletins, les certificats de scolarité, et dans le logiciel de direction (ONDE / ScoLENET)." position="bottom" className="whitespace-normal leading-relaxed w-80">
                  <span className="cursor-help text-slate-400 hover:text-slate-600 dark:text-zinc-500 dark:hover:text-zinc-300">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                      <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
                    </svg>
                  </span>
                </Tooltip>
              </div>
              <input
                type="text"
                id="ine"
                value={ine}
                onChange={(e) => setIne(e.target.value)}
                placeholder="Ex : 1234567890A"
                maxLength={11}
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
              />
            </div>
            <div>
              <label htmlFor="contactEmail" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Email de contact <span className="font-normal text-slate-400 dark:text-zinc-500 text-xs">(Facultatif)</span></label>
              <input
                type="email"
                id="contactEmail"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                placeholder="parent@exemple.com"
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200"
              />
            </div>
            <div>
              <label htmlFor="miscInfo" className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Informations diverses <span className="font-normal text-slate-400 dark:text-zinc-500 text-xs">(Facultatif)</span></label>
              <textarea
                id="miscInfo"
                value={miscInfo}
                onChange={(e) => setMiscInfo(e.target.value)}
                rows={3}
                placeholder="Santé (PAI, allergies…), situation familiale, ou toute autre information utile."
                className="mt-1 block w-full px-3 py-2 bg-white dark:bg-zinc-700 border border-slate-300 dark:border-zinc-600 rounded-md shadow-sm placeholder-slate-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm text-slate-900 dark:text-zinc-200 resize-y"
              />
              <p className="mt-1 text-xs text-slate-400 dark:text-zinc-500">Visible uniquement par l'enseignant — jamais dans les livrets.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Sexe</label>
              <div className="mt-2 flex gap-x-6">
                  <label className="flex items-center">
                      <input
                          type="radio"
                          name="sex"
                          value={Sex.Boy}
                          checked={sex === Sex.Boy}
                          onChange={(e) => setSex(e.target.value as Sex)}
                          className="h-4 w-4 bg-white dark:bg-zinc-700 border-slate-300 dark:border-zinc-500 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-offset-zinc-800"
                      />
                      <span className="ml-2 text-sm text-slate-900 dark:text-zinc-300">Garçon</span>
                  </label>
                  <label className="flex items-center">
                      <input
                          type="radio"
                          name="sex"
                          value={Sex.Girl}
                          checked={sex === Sex.Girl}
                          onChange={(e) => setSex(e.target.value as Sex)}
                          className="h-4 w-4 bg-white dark:bg-zinc-700 border-slate-300 dark:border-zinc-500 text-indigo-600 focus:ring-indigo-500 dark:focus:ring-offset-zinc-800"
                      />
                      <span className="ml-2 text-sm text-slate-900 dark:text-zinc-300">Fille</span>
                  </label>
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
                {isEditMode ? 'Enregistrer' : 'Ajouter l\'élève'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default StudentForm;