import React, { useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import { Workshop, SchoolProgram, Domain, Skill } from '../types';
import { compressImage } from '../utils/imageUtils';
import { PlusIcon, EditIcon, Trash2Icon, DownloadIcon, PauseIcon, ImageIcon, XIcon, CheckIcon, SearchIcon, ChevronDownIcon, ChevronRightIcon, PrinterIcon } from 'lucide-react';
import ConfirmationModal from './ConfirmationModal';
import Tooltip from './Tooltip';
import JSZip from 'jszip';
import { ExportAteliersModal, ImportAteliersModal } from './AtelierTransferModals';
import { parseAtelierBundle, ParsedAtelierBundle } from '../utils/workshopBundle';
import useModalDismiss from '../hooks/useModalDismiss';
import { toast } from '../utils/toast';
import StoredImage from '../images/StoredImage';
import { safeFileName } from '../domain/fileNames';

// Icônes import/export identiques aux onglets Compétences et Classe
const ExportIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" /></svg>);
const ImportIcon: React.FC<{ className?: string }> = ({ className }) => (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className={className}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>);

interface WorkshopsViewProps {
  workshops: Workshop[];
  setWorkshops: React.Dispatch<React.SetStateAction<Workshop[]>>;
  schoolPrograms: SchoolProgram[];
}

const WorkshopsView: React.FC<WorkshopsViewProps> = ({ workshops, setWorkshops, schoolPrograms }) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<Workshop | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState<string | null>(null);
  const [qrModalWorkshop, setQrModalWorkshop] = useState<Workshop | null>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [importedBundle, setImportedBundle] = useState<ParsedAtelierBundle | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const handleDelete = (id: string) => {
    setWorkshops(prev => prev.filter(w => w.id !== id));
    setDeleteConfirmation(null);
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permet de réimporter le même fichier
    if (!file) return;
    try {
      const bundle = await parseAtelierBundle(file);
      if (bundle.workshops.length === 0) {
        toast.info("Ce fichier .atelier ne contient aucun atelier.");
        return;
      }
      setImportedBundle(bundle);
    } catch (err) {
      console.error(err);
      toast.error("Fichier .atelier illisible ou invalide.");
    }
  };

  const handleCommitImport = (imported: Workshop[]) => {
    setWorkshops(prev => {
      const byId = new Map(prev.map(w => [w.id, w]));
      imported.forEach(w => byId.set(w.id, w)); // remplace (même id) ou ajoute
      return Array.from(byId.values());
    });
    setImportedBundle(null);
    toast.success(`${imported.length} atelier${imported.length > 1 ? 's' : ''} importé${imported.length > 1 ? 's' : ''}.`);
  };

  const handleExportAllQR = async () => {
     if (workshops.length === 0) {
         toast.info("Aucun atelier à exporter.");
         return;
     }
     
     setIsExporting(true);
     // Wait a tick for hidden canvases to fully render if they haven't (just in case)
     await new Promise(r => setTimeout(r, 100));

     try {
        const zip = new JSZip();
        const imgFolder = zip.folder("QRCodes_Ateliers")!;

        for (const workshop of workshops) {
            const sourceCanvas = document.getElementById(`hidden-qr-${workshop.id}`) as HTMLCanvasElement;
            if (!sourceCanvas) continue;

            const proxyCanvas = document.createElement('canvas');
            const ctx = proxyCanvas.getContext('2d');
            if (!ctx) continue;
            
            const size = 600;
            const padding = 60;
            const textHeight = 80;
            proxyCanvas.width = size;
            proxyCanvas.height = size + textHeight;
            
            // White background
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, proxyCanvas.width, proxyCanvas.height);
            
            // Draw the QR
            ctx.drawImage(sourceCanvas, padding, padding, size - padding*2, size - padding*2);
            
            // Draw Text
            ctx.fillStyle = '#0f172a'; // slate-900
            ctx.font = 'bold 36px Poppins, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(workshop.name, size/2, size - 10);
            
            // Get base64 (remove 'data:image/png;base64,' prefix)
            const dataUrl = proxyCanvas.toDataURL('image/png');
            const base64Data = dataUrl.split(',')[1];
            
            // Deux ateliers au nom proche ne doivent pas s'écraser dans l'archive
            let fileName = safeFileName(`QR-${workshop.name}`, 'png', 'QR-atelier');
            for (let n = 2; imgFolder.file(fileName); n++) fileName = safeFileName(`QR-${workshop.name}-${n}`, 'png', `QR-atelier-${n}`);
            imgFolder.file(fileName, base64Data, { base64: true });
        }
        
        const content = await zip.generateAsync({ type: "blob" });
        
        // Trigger download
        const url = URL.createObjectURL(content);
        const link = document.createElement('a');
        link.download = `QRCodes_Autonomie.zip`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
        toast.success(`QR codes de ${workshops.length} atelier${workshops.length > 1 ? 's' : ''} exportés (ZIP).`);

     } catch (e) {
         console.error(e);
         toast.error("Erreur lors de l'export ZIP.");
     } finally {
         setIsExporting(false);
     }
  };

  return (
    <div className="p-6 h-full flex flex-col overflow-y-auto">
      {/* Hidden canvases for ZIP export */}
      <div style={{ display: 'none' }}>
          {workshops.map(w => (
              <QRCodeCanvas key={w.id} id={`hidden-qr-${w.id}`} value={w.id} size={256} level="H" includeMargin={true} />
          ))}
      </div>

      <div className="flex justify-between items-center mb-6">
        <div>
           <h2 className="text-2xl font-bold text-slate-800 dark:text-zinc-100">Gestion des Ateliers Autonomes</h2>
           <p className="text-slate-500 dark:text-zinc-400 mt-1">Créez des ateliers, associez-y des compétences et générez des QR codes.</p>
        </div>
        <div className="flex gap-3">
          <input ref={importInputRef} type="file" accept=".atelier" onChange={handleImportFile} className="hidden" />
          <Tooltip content="Importer des ateliers" position="bottom-center">
            <button onClick={() => importInputRef.current?.click()} className="p-2 rounded-md text-slate-600 dark:text-zinc-300 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors">
              <ImportIcon className="w-5 h-5" />
            </button>
          </Tooltip>
          <Tooltip content="Exporter des ateliers" position="bottom-center">
            <button onClick={() => setShowExportModal(true)} disabled={workshops.length === 0} className="p-2 rounded-md text-slate-600 dark:text-zinc-300 bg-slate-200 hover:bg-slate-300 dark:bg-zinc-700 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50">
              <ExportIcon className="w-5 h-5" />
            </button>
          </Tooltip>
          <button onClick={() => setShowPrintModal(true)} className="px-4 py-2 flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 rounded-md transition-colors font-medium text-sm">
            <PrinterIcon className="w-4 h-4" /> Imprimer les QR codes
          </button>
          <button onClick={handleExportAllQR} disabled={isExporting} className="px-4 py-2 flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-zinc-700 dark:hover:bg-zinc-600 text-slate-700 dark:text-zinc-200 rounded-md transition-colors font-medium text-sm disabled:opacity-50">
            <DownloadIcon className="w-4 h-4" /> {isExporting ? 'Export en cours...' : 'Exporter tous les QR codes'}
          </button>
          <button onClick={() => { setEditingWorkshop(null); setIsFormOpen(true); }} className="px-4 py-2 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md transition-colors font-medium text-sm">
            <PlusIcon className="w-4 h-4" /> Nouvel atelier
          </button>
        </div>
      </div>

      <div className="flex-grow grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 content-start">
        {workshops.map(workshop => (
           <div key={workshop.id} className={`bg-white dark:bg-zinc-800 rounded-xl shadow-sm border ${workshop.isActive ? 'border-slate-200 dark:border-zinc-700' : 'border-amber-200 dark:border-amber-900 opacity-75'} p-4 flex flex-col`}>
              <div className="flex justify-between items-start mb-3">
                 <h3 className="text-lg font-semibold text-slate-800 dark:text-zinc-100 line-clamp-2">{workshop.name}</h3>
                 <div className="flex gap-1 ml-2">
                    <Tooltip content="Afficher QR code" position="bottom-center">
                       <button onClick={() => setQrModalWorkshop(workshop)} className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-md transition-colors"><QRCodeSVG value={workshop.id} size={20} /></button>
                    </Tooltip>
                    <button onClick={() => { setEditingWorkshop(workshop); setIsFormOpen(true); }} className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-md transition-colors"><EditIcon className="w-4 h-4" /></button>
                    <button onClick={() => setDeleteConfirmation(workshop.id)} className="p-1.5 text-slate-500 dark:text-zinc-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"><Trash2Icon className="w-4 h-4" /></button>
                 </div>
              </div>
              
              {workshop.image && (
                 <div className="w-full h-32 bg-slate-100 dark:bg-zinc-900 rounded-lg mb-3 overflow-hidden flex items-center justify-center">
                    <StoredImage src={workshop.image} alt={workshop.name} className="max-w-full max-h-full object-contain" />
                 </div>
              )}
              
              <p className="text-sm text-slate-600 dark:text-zinc-300 mb-4 line-clamp-3 flex-grow">{workshop.description}</p>
              
              <div className="mt-auto pt-4 border-t border-slate-100 dark:border-zinc-700 flex justify-between items-center">
                  <div className="text-xs text-slate-500 dark:text-zinc-400 font-medium">
                      {workshop.skillIds.length} compétence{workshop.skillIds.length > 1 ? 's' : ''} liée{workshop.skillIds.length > 1 ? 's' : ''}
                  </div>
                  <button 
                     onClick={() => setWorkshops(prev => prev.map(w => w.id === workshop.id ? { ...w, isActive: !w.isActive } : w))}
                     className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${workshop.isActive ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}
                  >
                     {workshop.isActive ? <><CheckIcon className="w-3.5 h-3.5" /> Actif</> : <><PauseIcon className="w-3.5 h-3.5" /> En pause</>}
                  </button>
              </div>
           </div>
        ))}
        {workshops.length === 0 && (
           <div className="col-span-full py-16 flex flex-col items-center justify-center text-slate-400 dark:text-zinc-500 text-center">
              <div className="bg-slate-100 dark:bg-zinc-800 p-6 rounded-full mb-4">
                  <PlusIcon className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-lg font-medium">Aucun atelier créé pour le moment.</p>
              <p className="text-sm mt-1">Commencez par ajouter un nouvel atelier autonome pour votre classe.</p>
           </div>
        )}
      </div>

      {isFormOpen && (
          <WorkshopFormModal
             workshop={editingWorkshop}
             schoolPrograms={schoolPrograms}
             onSave={(workshopData) => {
                 setWorkshops(prev => {
                     if (editingWorkshop) {
                         return prev.map(w => w.id === workshopData.id ? workshopData : w);
                     }
                     return [...prev, workshopData];
                 });
                 setIsFormOpen(false);
             }}
             onClose={() => setIsFormOpen(false)}
          />
      )}

      {qrModalWorkshop && (
          <QRModal
             workshop={qrModalWorkshop}
             onClose={() => setQrModalWorkshop(null)}
          />
      )}

      {showPrintModal && (
          <PrintQRModal
             workshops={workshops}
             onClose={() => setShowPrintModal(false)}
          />
      )}

      {showExportModal && (
          <ExportAteliersModal
             workshops={workshops}
             schoolPrograms={schoolPrograms}
             onClose={() => setShowExportModal(false)}
          />
      )}

      {importedBundle && (
          <ImportAteliersModal
             bundle={importedBundle}
             existingWorkshops={workshops}
             schoolPrograms={schoolPrograms}
             onImport={handleCommitImport}
             onClose={() => setImportedBundle(null)}
          />
      )}

      {deleteConfirmation && (
          <ConfirmationModal
             title="Supprimer l'atelier"
             message="Êtes-vous sûr de vouloir supprimer cet atelier ? Les données historiques (rapports) seront conservées mais l'atelier ne pourra plus être scanné."
             confirmText="Supprimer"
             onConfirm={() => handleDelete(deleteConfirmation)}
             onCancel={() => setDeleteConfirmation(null)}
          />
      )}
    </div>
  );
};

// --- Subcomponents ---

const QRModal: React.FC<{ workshop: Workshop; onClose: () => void }> = ({ workshop, onClose }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    
    // Using a simple download mechanism for the singular QR code
    const handleDownload = () => {
        if (!canvasRef.current) return;
        
        // We draw the QR on a new canvas to add the text
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const size = 600;
        const padding = 60;
        const textHeight = 80;
        canvas.width = size;
        canvas.height = size + textHeight;
        
        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw the QR
        ctx.drawImage(canvasRef.current, padding, padding, size - padding*2, size - padding*2);
        
        // Draw Text
        ctx.fillStyle = '#0f172a'; // slate-900
        ctx.font = 'bold 36px Poppins, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(workshop.name, size/2, size - 10);
        
        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = safeFileName(`QR-${workshop.name}`, 'png', 'QR-atelier');
        link.href = dataUrl;
        link.click();
    };

    const handleBackdropClick = useModalDismiss(onClose);

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-sm flex flex-col p-6 animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-start mb-6">
                    <h3 className="text-xl font-bold text-slate-800 dark:text-zinc-100">{workshop.name}</h3>
                    <button onClick={onClose} aria-label="Fermer" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-full transition-colors"><XIcon className="w-5 h-5"/></button>
                </div>
                
                <div className="flex justify-center bg-white p-4 rounded-xl border border-slate-100 mb-6 mx-auto">
                     <QRCodeCanvas ref={canvasRef} value={workshop.id} size={256} level="H" includeMargin={true} />
                </div>
                
                <p className="text-center text-sm text-slate-500 dark:text-zinc-400 mb-6">QR code prêt à être imprimé et collé sur la boîte de l'atelier.</p>
                
                <div className="flex justify-end gap-3 mt-auto">
                    <button onClick={onClose} className="px-4 py-2 font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-700 rounded-lg transition-colors">Fermer</button>
                    <button onClick={handleDownload} className="px-4 py-2 flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg shadow-sm transition-colors"><DownloadIcon className="w-4 h-4"/> Télécharger Image</button>
                </div>
            </div>
        </div>
    );
};


const WorkshopFormModal: React.FC<{ workshop: Workshop | null, schoolPrograms: SchoolProgram[], onSave: (w: Workshop) => void, onClose: () => void }> = ({ workshop, schoolPrograms, onSave, onClose }) => {
    const [name, setName] = useState(workshop?.name || '');
    const [description, setDescription] = useState(workshop?.description || '');
    const [image, setImage] = useState<string | null>(workshop?.image || null);
    const [skillIds, setSkillIds] = useState<Set<string>>(new Set(workshop?.skillIds || []));
    const [skillSearch, setSkillSearch] = useState('');
    const [collapsedDomains, setCollapsedDomains] = useState<Set<string>>(new Set());

    const allSkills = useMemo(() => {
        const skills: { id: string; name: string; domainPath: string }[] = [];
        const recurse = (domains: Domain[], path: string) => {
            domains.forEach(d => {
                const currentPath = path ? `${path} > ${d.name}` : d.name;
                d.skills.forEach(s => skills.push({ id: s.id, name: s.name, domainPath: currentPath }));
                if (d.subDomains) recurse(d.subDomains, currentPath);
            });
        };
        schoolPrograms.forEach(p => recurse(p.domains, p.name));
        return skills;
    }, [schoolPrograms]);

    // Group by program + top-level domain for the collapsed view
    const skillsByDomain = useMemo(() => {
        const groupMap = new Map<string, { id: string; name: string; domainPath: string }[]>();
        allSkills.forEach(skill => {
            const parts = skill.domainPath.split(' > ');
            const groupKey = parts.slice(0, 2).join(' › ');
            if (!groupMap.has(groupKey)) groupMap.set(groupKey, []);
            groupMap.get(groupKey)!.push(skill);
        });
        return Array.from(groupMap.entries()).map(([group, skills]) => ({ group, skills }));
    }, [allSkills]);

    // null = no search active, otherwise filtered flat list
    const filteredSkills = useMemo(() => {
        const q = skillSearch.trim().toLowerCase();
        if (!q) return null;
        return allSkills.filter(s =>
            s.name.toLowerCase().includes(q) ||
            s.domainPath.toLowerCase().includes(q)
        );
    }, [allSkills, skillSearch]);

    const selectedSkillsInfo = useMemo(() =>
        allSkills.filter(s => skillIds.has(s.id)),
    [allSkills, skillIds]);

    const handleToggleSkill = (id: string) => {
        setSkillIds(prev => {
            const n = new Set(prev);
            if (n.has(id)) n.delete(id); else n.add(id);
            return n;
        });
    };

    const toggleDomain = (group: string) => {
        setCollapsedDomains(prev => {
            const n = new Set(prev);
            if (n.has(group)) n.delete(group); else n.add(group);
            return n;
        });
    };

    const handleImageLoad = (e: React.ChangeEvent<HTMLInputElement>) => {
        window.focus();
        if (!e.target.files || e.target.files.length === 0) return;
        const file = e.target.files[0];
        const reader = new FileReader();
        reader.onload = async (ev) => {
            if (ev.target?.result && typeof ev.target.result === 'string') {
                const ref = await compressImage(ev.target.result);
                if (ref) setImage(ref);
            }
        };
        reader.readAsDataURL(file);
    };

    const handleSave = () => {
        if (!name.trim()) { toast.error("Veuillez saisir un nom pour l'atelier."); return; }
        const newWorkshop: Workshop = {
            id: workshop ? workshop.id : crypto.randomUUID(),
            name: name.trim(),
            description: description.trim(),
            image,
            skillIds: Array.from(skillIds),
            isActive: workshop ? workshop.isActive : true,
            createdAt: workshop ? workshop.createdAt : new Date().toISOString(),
        };
        onSave(newWorkshop);
    };

    // Clic fond neutralisé dès que le formulaire diffère de l'atelier initial (perte accidentelle).
    const initialSkillIds = workshop?.skillIds || [];
    const isDirty =
        name !== (workshop?.name || '') ||
        description !== (workshop?.description || '') ||
        image !== (workshop?.image || null) ||
        skillIds.size !== initialSkillIds.length ||
        initialSkillIds.some(id => !skillIds.has(id));
    const handleBackdropClick = useModalDismiss(onClose, true, !isDirty);

    return (
        <div className="fixed inset-0 z-[210] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true" onClick={handleBackdropClick}>
            <div className="bg-white dark:bg-zinc-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in zoom-in-95 duration-200">
               <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">{workshop ? "Modifier l'atelier" : 'Nouvel Atelier'}</h2>
                    <button onClick={onClose} aria-label="Fermer" className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 transition-colors"><XIcon className="w-5 h-5"/></button>
               </div>

               <div className="flex-grow overflow-y-auto p-6 space-y-6">
                   <div>
                       <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Nom de l'atelier</label>
                       <input autoFocus type="text" value={name} onChange={e => setName(e.target.value)} className="mt-1 w-full p-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="ex: Puzzle des animaux" />
                   </div>

                   <div>
                       <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300">Description / Consigne</label>
                       <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="mt-1 w-full p-2.5 bg-slate-50 dark:bg-zinc-900 border border-slate-300 dark:border-zinc-700 rounded-lg text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:outline-none" placeholder="Description visible sur le rapport ou pour votre mémorisation..." />
                   </div>

                   <div>
                       <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-2">Photo de l'atelier</label>
                       <div className="flex items-center gap-4">
                           {image ? (
                               <div className="relative w-24 h-24 rounded-lg bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 overflow-hidden group">
                                   <StoredImage src={image} alt="Aperçu" className="w-full h-full object-cover" />
                                   <div className="absolute inset-0 bg-black/50 hidden group-hover:flex pointer-coarse:flex items-center justify-center transition-all">
                                       <button onClick={() => setImage(null)} className="p-1 bg-white/20 hover:bg-red-500 rounded-full text-white"><Trash2Icon className="w-4 h-4" /></button>
                                   </div>
                               </div>
                           ) : (
                               <label className="w-24 h-24 flex flex-col items-center justify-center rounded-lg bg-slate-50 dark:bg-zinc-900 border border-dashed border-slate-300 dark:border-zinc-700 cursor-pointer hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors">
                                   <ImageIcon className="w-6 h-6 text-slate-400 mb-1" />
                                   <span className="text-xs text-slate-500 font-medium">Ajouter</span>
                                   <input type="file" accept="image/*" onChange={handleImageLoad} className="hidden" />
                               </label>
                           )}
                           <p className="text-sm text-slate-500 dark:text-zinc-400">Une photo de l'atelier complet aide l'élève et vous-même à l'identifier.</p>
                       </div>
                   </div>

                   {/* Skill selection */}
                   <div>
                       <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-700 pb-2 mb-3">
                           <span className="text-sm font-bold text-slate-800 dark:text-zinc-100">
                               Compétences travaillées
                               {skillIds.size > 0 && (
                                   <span className="ml-2 text-blue-600 dark:text-blue-400 font-semibold">
                                       {skillIds.size} sélectionnée{skillIds.size > 1 ? 's' : ''}
                                   </span>
                               )}
                           </span>
                           {skillIds.size > 0 && (
                               <button
                                   type="button"
                                   onClick={() => setSkillIds(new Set())}
                                   className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium transition-colors"
                               >
                                   Tout désélectionner
                               </button>
                           )}
                       </div>

                       {/* Selected skills as removable chips */}
                       {selectedSkillsInfo.length > 0 && (
                           <div className="flex flex-wrap gap-1.5 mb-3 p-2.5 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/40">
                               {selectedSkillsInfo.map(s => (
                                   <span key={s.id} className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-blue-100 dark:bg-blue-800/60 text-blue-800 dark:text-blue-200 rounded-full text-xs font-medium">
                                       {s.name}
                                       <Tooltip content="Retirer" position="top-center">
                                           <button
                                               type="button"
                                               onClick={() => handleToggleSkill(s.id)}
                                               className="p-0.5 hover:bg-blue-200 dark:hover:bg-blue-700 rounded-full transition-colors"
                                           >
                                               <XIcon className="w-3 h-3" />
                                           </button>
                                       </Tooltip>
                                   </span>
                               ))}
                           </div>
                       )}

                       {/* Search input */}
                       <div className="relative mb-2">
                           <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                           <input
                               type="text"
                               value={skillSearch}
                               onChange={e => setSkillSearch(e.target.value)}
                               placeholder="Rechercher une compétence..."
                               className="w-full pl-8 pr-8 py-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg text-sm text-slate-800 dark:text-zinc-200 focus:ring-2 focus:ring-blue-500 focus:outline-none placeholder:text-slate-400"
                           />
                           {skillSearch && (
                               <button
                                   type="button"
                                   onClick={() => setSkillSearch('')}
                                   className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300"
                               >
                                   <XIcon className="w-4 h-4" />
                               </button>
                           )}
                       </div>

                       {/* Skill list: flat when searching, grouped by domain otherwise */}
                       <div className="overflow-y-auto rounded-lg border border-slate-200 dark:border-zinc-700 max-h-64">
                           {filteredSkills !== null ? (
                               filteredSkills.length === 0 ? (
                                   <p className="py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
                                       Aucune compétence pour « {skillSearch} »
                                   </p>
                               ) : (
                                   <div className="p-1">
                                       {filteredSkills.map(s => (
                                           <label key={s.id} className="flex items-start gap-3 p-2 hover:bg-slate-50 dark:hover:bg-zinc-700/50 rounded-md cursor-pointer transition-colors">
                                               <input type="checkbox" checked={skillIds.has(s.id)} onChange={() => handleToggleSkill(s.id)} className="mt-0.5 flex-shrink-0" />
                                               <div className="min-w-0">
                                                   <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{s.name}</p>
                                                   <p className="text-xs text-slate-400 dark:text-zinc-500">{s.domainPath.split(' > ').join(' › ')}</p>
                                               </div>
                                           </label>
                                       ))}
                                   </div>
                               )
                           ) : skillsByDomain.length === 0 ? (
                               <p className="py-8 text-center text-sm text-slate-500 dark:text-zinc-400">
                                   Aucune compétence. Ajoutez d'abord des programmes dans l'onglet Compétences.
                               </p>
                           ) : (
                               skillsByDomain.map(({ group, skills }) => {
                                   const isCollapsed = collapsedDomains.has(group);
                                   const selectedInGroup = skills.filter(s => skillIds.has(s.id)).length;
                                   return (
                                       <div key={group} className="border-b border-slate-100 dark:border-zinc-700/50 last:border-b-0">
                                           <button
                                               type="button"
                                               onClick={() => toggleDomain(group)}
                                               className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-zinc-700/50 transition-colors text-left"
                                           >
                                               <div className="flex items-center gap-2 min-w-0">
                                                   {isCollapsed
                                                       ? <ChevronRightIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                       : <ChevronDownIcon className="w-4 h-4 text-slate-400 flex-shrink-0" />
                                                   }
                                                   <span className="text-sm font-semibold text-slate-700 dark:text-zinc-300 truncate">{group}</span>
                                                   {selectedInGroup > 0 && (
                                                       <span className="flex-shrink-0 text-xs bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 px-1.5 py-0.5 rounded-full font-medium">
                                                           {selectedInGroup}
                                                       </span>
                                                   )}
                                               </div>
                                               <span className="text-xs text-slate-400 dark:text-zinc-500 flex-shrink-0 ml-2">
                                                   {skills.length} compétence{skills.length > 1 ? 's' : ''}
                                               </span>
                                           </button>
                                           {!isCollapsed && (
                                               <div className="px-3 pb-1">
                                                   {skills.map(s => {
                                                       const subLabel = s.domainPath.split(' > ').slice(2).join(' › ');
                                                       return (
                                                           <label key={s.id} className="flex items-start gap-3 p-2 hover:bg-slate-50 dark:hover:bg-zinc-700/50 rounded-md cursor-pointer transition-colors">
                                                               <input type="checkbox" checked={skillIds.has(s.id)} onChange={() => handleToggleSkill(s.id)} className="mt-0.5 flex-shrink-0" />
                                                               <div className="min-w-0">
                                                                   <p className="text-sm font-medium text-slate-800 dark:text-zinc-200">{s.name}</p>
                                                                   {subLabel && <p className="text-xs text-slate-400 dark:text-zinc-500">{subLabel}</p>}
                                                               </div>
                                                           </label>
                                                       );
                                                   })}
                                               </div>
                                           )}
                                       </div>
                                   );
                               })
                           )}
                       </div>
                   </div>
               </div>

               <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-3 bg-slate-50 dark:bg-zinc-800/50 rounded-b-xl">
                   <button onClick={onClose} className="px-4 py-2 font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">Annuler</button>
                   <button onClick={handleSave} className="px-5 py-2 font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm transition-colors">Enregistrer</button>
               </div>
            </div>
        </div>
    );
};

// ─── Print constants ────────────────────────────────────────────────────────
const MM_TO_PX_96 = 96 / 25.4;
const A4_W_MM = 210;
const A4_H_MM = 297;
const A4_MARGIN_MM = 10;
const QR_GAP_MM = 4;
const QR_LABEL_H_MM = 20;

// ─── PrintArea ──────────────────────────────────────────────────────────────
// Rendered via portal as direct child of <body>; display:none normally.
// @media print CSS injection makes it the only visible element.
const PrintArea: React.FC<{ workshops: Workshop[]; getSize: (id: string) => number }> = ({ workshops, getSize }) => (
  <div id="qr-print-area" style={{ display: 'none', fontFamily: 'Arial, Helvetica, sans-serif' }}>
    <div style={{
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexWrap: 'wrap',
      gap: `${QR_GAP_MM}mm`,
      alignContent: 'flex-start',
    }}>
      {workshops.map(w => {
        const sz = getSize(w.id);
        // Font size to fit the name in at most 3 lines given the QR width.
        // avg bold char width ≈ 0.55 × fontSize → charsPerLine = sz / (fontSize × 0.55)
        // 3 lines → fontSize = sz × 3 / (nameLength × 0.55), capped by the base 14% size.
        const fontSizeMm = Math.max(
          sz * 0.07,
          Math.min(sz * 0.14, (sz * 3) / (Math.max(10, w.name.length) * 0.55))
        );
        return (
          <div key={w.id} style={{
            width: `${sz}mm`,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            pageBreakInside: 'avoid',
            breakInside: 'avoid',
          }}>
            <div style={{ width: `${sz}mm`, height: `${sz}mm` }}>
              <QRCodeSVG
                value={w.id}
                size={256}
                level="H"
                style={{ width: '100%', height: '100%', display: 'block' }}
              />
            </div>
            <div style={{
              marginTop: '1.5mm',
              fontSize: `${fontSizeMm}mm`,
              fontWeight: 700,
              color: '#1e293b',
              textAlign: 'center',
              width: `${sz}mm`,
              lineHeight: 1.3,
              wordBreak: 'break-word',
            }}>
              {w.name}
            </div>
          </div>
        );
      })}
    </div>
  </div>
);

// ─── PrintQRModal ────────────────────────────────────────────────────────────
const PrintQRModal: React.FC<{ workshops: Workshop[]; onClose: () => void }> = ({ workshops, onClose }) => {
  const [globalSize, setGlobalSize] = useState(50);
  const [individualSizes, setIndividualSizes] = useState<Record<string, number>>({});
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const [resizingId, setResizingId] = useState<string | null>(null);
  const [tooltipSize, setTooltipSize] = useState<number | null>(null);
  const handleBackdropClick = useModalDismiss(onClose);

  const A4_PX_W = Math.round(A4_W_MM * MM_TO_PX_96);   // ~794
  const PREVIEW_W = 500;
  const scale = PREVIEW_W / A4_PX_W;

  const marginPx = A4_MARGIN_MM * MM_TO_PX_96;
  const gapPx    = QR_GAP_MM    * MM_TO_PX_96;

  const getSize = (id: string) => individualSizes[id] ?? globalSize;

  // Grid layout based on globalSize (used for card slot positioning in preview)
  const usableW = A4_W_MM - 2 * A4_MARGIN_MM;
  const usableH = A4_H_MM - 2 * A4_MARGIN_MM;
  const perRow  = Math.max(1, Math.floor(usableW / (globalSize + QR_GAP_MM)));
  const perCol  = Math.max(1, Math.floor(usableH / (globalSize + QR_LABEL_H_MM + QR_GAP_MM)));
  const perPage = perRow * perCol;
  const pageCount = Math.ceil(workshops.length / perPage);

  // Drag-to-resize logic: converts screen-pixel delta → mm via scale and dpi
  const startResize = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startSize = getSize(id);
    setResizingId(id);
    setTooltipSize(startSize);

    const onMove = (me: PointerEvent) => {
      const deltaMm = ((me.clientX - startX) / scale) / MM_TO_PX_96;
      const newSize = Math.max(20, Math.min(80, Math.round(startSize + deltaMm)));
      setIndividualSizes(prev => ({ ...prev, [id]: newSize }));
      setTooltipSize(newSize);
    };
    const onUp = () => {
      setResizingId(null);
      setTooltipSize(null);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  };

  const handlePrint = () => {
    const styleEl = document.createElement('style');
    styleEl.id = 'qr-print-override';
    styleEl.textContent = `
      @media print {
        body > *:not(#qr-print-area) { display: none !important; }
        body > #qr-print-area { display: block !important; }
        @page { size: A4; margin: ${A4_MARGIN_MM}mm; }
      }
    `;
    document.head.appendChild(styleEl);
    window.print();
    const cleanup = () => document.getElementById('qr-print-override')?.remove();
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 5000); // fallback if afterprint doesn't fire
  };

  const resetAll = () => setIndividualSizes({});
  const resetOne = (id: string) => setIndividualSizes(prev => { const n = { ...prev }; delete n[id]; return n; });

  // on-screen size of resize handle (px) — larger on touch screens
  const HANDLE_PX = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches ? 40 : 22;

  return (
    <>
      {createPortal(<PrintArea workshops={workshops} getSize={getSize} />, document.body)}

      <div
        className="fixed inset-0 z-[300] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4"
        role="dialog"
        aria-modal="true"
        onClick={handleBackdropClick}
      >
        <div
          className="bg-white dark:bg-zinc-800 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 dark:border-zinc-700 flex justify-between items-center flex-shrink-0">
            <div className="flex items-center gap-3">
              <PrinterIcon className="w-5 h-5 text-slate-500 dark:text-zinc-400" />
              <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Imprimer les QR codes</h2>
            </div>
            <button onClick={onClose} aria-label="Fermer" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-zinc-300 rounded-full transition-colors">
              <XIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex flex-1 overflow-hidden min-h-0">

            {/* ── Left panel: controls ── */}
            <div className="w-72 flex-shrink-0 border-r border-slate-200 dark:border-zinc-700 p-5 overflow-y-auto flex flex-col gap-5">

              {/* Global size slider */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Taille globale</span>
                  <span className="text-sm font-mono font-bold text-blue-600 dark:text-blue-400">{globalSize} mm</span>
                </div>
                <input
                  type="range" min={20} max={80} step={1} value={globalSize}
                  onChange={e => setGlobalSize(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
                <div className="flex justify-between text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                  <span>20 mm</span><span>80 mm</span>
                </div>
              </div>

              {/* Layout info */}
              <div className="bg-slate-50 dark:bg-zinc-700/50 rounded-xl p-3.5 space-y-1 text-sm">
                <p className="text-slate-600 dark:text-zinc-300">
                  <span className="font-bold text-slate-800 dark:text-zinc-100">{perRow}</span> QR / ligne ·{' '}
                  <span className="font-bold text-slate-800 dark:text-zinc-100">{perCol}</span> lignes / page
                </p>
                <p className="text-slate-600 dark:text-zinc-300">
                  <span className="font-bold text-slate-800 dark:text-zinc-100">{workshops.length}</span> atelier{workshops.length > 1 ? 's' : ''} →{' '}
                  <span className="font-bold text-slate-800 dark:text-zinc-100">{pageCount}</span> page{pageCount > 1 ? 's' : ''}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-400 pt-1.5 border-t border-slate-200 dark:border-zinc-600 mt-1">
                  Glissez <span className="font-bold">↘</span> sur un QR pour le redimensionner
                </p>
              </div>

              {/* Per-workshop size overrides */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-semibold text-slate-700 dark:text-zinc-200">Par atelier</span>
                  {Object.keys(individualSizes).length > 0 && (
                    <button onClick={resetAll} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 font-medium transition-colors">
                      Tout réinitialiser
                    </button>
                  )}
                </div>
                <div className="space-y-1 max-h-52 overflow-y-auto pr-0.5">
                  {workshops.map(w => {
                    const hasOverride = w.id in individualSizes;
                    const sz = getSize(w.id);
                    return (
                      <div key={w.id} className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg transition-colors ${hasOverride ? 'bg-blue-50 dark:bg-blue-900/25 border border-blue-100 dark:border-blue-800/40' : 'hover:bg-slate-50 dark:hover:bg-zinc-700/50'}`}>
                        <span className="flex-1 truncate text-xs text-slate-600 dark:text-zinc-400">{w.name}</span>
                        <span className={`text-xs font-mono font-bold w-12 text-right flex-shrink-0 ${hasOverride ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-zinc-500'}`}>{sz} mm</span>
                        {hasOverride && (
                          <button onClick={() => resetOne(w.id)} title="Réinitialiser" className="text-slate-400 hover:text-red-500 flex-shrink-0 transition-colors">
                            <XIcon className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Right panel: A4 preview ── */}
            <div className="flex-1 overflow-auto bg-slate-100 dark:bg-zinc-900/50 flex items-start justify-center p-6 min-w-0">
              <div className="flex flex-col items-center">
                {pageCount > 1 && (
                  <p className="text-xs text-slate-400 dark:text-zinc-500 mb-3 text-center">
                    Aperçu : page 1 / {pageCount}
                  </p>
                )}
                {/* Outer wrapper — width matches visual preview width; height is auto so scroll shows all pages */}
                <div style={{ width: PREVIEW_W, flexShrink: 0 }}>
                  {/* A4 sheet zoomed down — zoom (unlike transform) affects layout so the parent grows with content */}
                  <div style={{
                    width: A4_PX_W,
                    zoom: scale,
                    background: 'white',
                    boxShadow: '0 8px 40px rgba(0,0,0,0.22)',
                    padding: `${marginPx}px`,
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: `${gapPx}px`,
                    alignContent: 'flex-start',
                  } as React.CSSProperties}>
                    {workshops.map(w => {
                      const sz         = getSize(w.id);
                      const szPx       = sz * MM_TO_PX_96;
                      const isHov      = hoveredCard  === w.id;
                      const isSel      = selectedCard === w.id;
                      const isResizing = resizingId   === w.id;
                      const hasOverride = w.id in individualSizes;
                      // Same 3-line formula as PrintArea, converted to px
                      const fontSizePx = Math.max(
                        sz * 0.07,
                        Math.min(sz * 0.14, (sz * 3) / (Math.max(10, w.name.length) * 0.55))
                      ) * MM_TO_PX_96;
                      const previewLabelH = Math.ceil(fontSizePx * 1.3 * 3);

                      return (
                        <div
                          key={w.id}
                          style={{
                            position: 'relative',
                            flexShrink: 0,
                            width: szPx,
                            height: szPx + previewLabelH,
                            boxSizing: 'border-box',
                            border: isSel || isResizing
                              ? '2.5px solid #3b82f6'
                              : isHov
                                ? '2px solid #93c5fd'
                                : hasOverride
                                  ? '1.5px dashed #93c5fd'
                                  : '1px solid transparent',
                            borderRadius: 5,
                            background: 'white',
                            cursor: 'pointer',
                            overflow: 'visible',
                            transition: isResizing ? 'none' : 'border-color 0.12s',
                          }}
                          onClick={() => setSelectedCard(isSel ? null : w.id)}
                          onMouseEnter={() => setHoveredCard(w.id)}
                          onMouseLeave={() => setHoveredCard(null)}
                        >
                          {/* QR code */}
                          <div style={{ width: szPx, height: szPx, overflow: 'hidden' }}>
                            <QRCodeSVG value={w.id} size={Math.round(szPx)} level="H" />
                          </div>
                          {/* Name label — 3 lines max, fully visible */}
                          <div style={{
                            width: szPx,
                            height: previewLabelH,
                            fontSize: fontSizePx,
                            fontWeight: 700,
                            color: '#1e293b',
                            textAlign: 'center',
                            lineHeight: 1.3,
                            wordBreak: 'break-word',
                            overflow: 'hidden',
                            paddingLeft: 4,
                            paddingRight: 4,
                            boxSizing: 'border-box',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'center',
                          }}>
                            {w.name}
                          </div>

                          {/* Resize handle — scale-compensated to stay 22px on screen */}
                          {(isHov || isSel || isResizing) && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 0,
                                right: 0,
                                width:  HANDLE_PX / scale,
                                height: HANDLE_PX / scale,
                                background: isResizing ? '#1d4ed8' : '#3b82f6',
                                borderRadius: `0 0 ${5 / scale}px 0`,
                                cursor: 'se-resize',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 14 / scale,
                                color: 'white',
                                userSelect: 'none',
                                touchAction: 'none',
                                zIndex: 10,
                              }}
                              onPointerDown={e => startResize(e, w.id)}
                            >
                              ↘
                            </div>
                          )}

                          {/* Size tooltip while dragging */}
                          {isResizing && tooltipSize !== null && (
                            <div style={{
                              position: 'absolute',
                              bottom: (HANDLE_PX + 6) / scale,
                              right: 0,
                              background: '#1e293b',
                              color: 'white',
                              padding: `${4 / scale}px ${8 / scale}px`,
                              borderRadius: 4 / scale,
                              fontSize: 13 / scale,
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              pointerEvents: 'none',
                              zIndex: 20,
                              lineHeight: 1,
                            }}>
                              {tooltipSize} mm
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-700 flex justify-end gap-3 flex-shrink-0 bg-slate-50 dark:bg-zinc-800/50 rounded-b-2xl">
            <button onClick={onClose} className="px-4 py-2 font-medium text-slate-600 dark:text-zinc-300 hover:bg-slate-200 dark:hover:bg-zinc-700 rounded-lg transition-colors">Annuler</button>
            <button onClick={handlePrint} className="px-5 py-2 flex items-center gap-2 font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-lg shadow-sm transition-colors">
              <PrinterIcon className="w-4 h-4" /> Imprimer
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default WorkshopsView;
