// Ajout et modification d'un élève (champs principaux ; le reste se règle sur ordinateur).
import React, { useState } from 'react';
import { Camera, ImagePlus } from 'lucide-react';
import { addStudent, deleteStudent, updateStudentFields, type StudentFields } from '../../core/domain/students';
import { sectionOrder } from '../../core/utils';
import { Section, Sex, type Student } from '../../core/types';
import { confirmAction } from '../platform/dialogs';
import { pickPhoto } from './photos';
import type { ClassDocument } from './useClassDocument';
import { Avatar, Btn, Field, inputClass, Segmented, Sheet, useSnack } from './ui';

const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

interface Props {
    doc: ClassDocument;
    student: Student | null; // null : nouvel élève
    onClose: () => void;
    onDeleted?: () => void;
}

const StudentFormSheet: React.FC<Props> = ({ doc, student, onClose, onDeleted }) => {
    const snack = useSnack();
    const [fields, setFields] = useState<StudentFields>(() => student
        ? { firstName: student.firstName, lastName: student.lastName, photo: student.photo, dob: student.dob, section: student.section, sex: student.sex, contactEmail: student.contactEmail, ine: student.ine, miscInfo: student.miscInfo }
        : { firstName: '', lastName: '', photo: null, dob: '', section: Section.PS, sex: Sex.Girl });
    const [busy, setBusy] = useState(false);
    const set = <K extends keyof StudentFields>(key: K, value: StudentFields[K]) => setFields(f => ({ ...f, [key]: value }));
    const valid = fields.firstName.trim() !== '' && fields.lastName.trim() !== '';

    const photo = async (camera: boolean) => {
        setBusy(true);
        try {
            const ref = await pickPhoto(camera);
            if (ref) set('photo', ref);
        } finally {
            setBusy(false);
        }
    };

    const submit = () => {
        const clean = { ...fields, firstName: fields.firstName.trim(), lastName: fields.lastName.trim() };
        if (student) {
            doc.update(d => updateStudentFields(d, student.id, clean));
            snack('Fiche modifiée', { kind: 'success', action: { label: 'Annuler', run: doc.undo } });
        } else {
            doc.update(d => addStudent(d, clean, newId()));
            snack(`${clean.firstName} ajouté(e) à la classe`, { kind: 'success', action: { label: 'Annuler', run: doc.undo } });
        }
        onClose();
    };

    const remove = async () => {
        if (!student) return;
        const ok = await confirmAction('Supprimer l\'élève', `${student.firstName} ${student.lastName} sera supprimé(e) de la classe, avec ses compétences et ses passages d'atelier.`, 'Supprimer', true);
        if (!ok) return;
        doc.update(d => deleteStudent(d, student.id));
        snack('Élève supprimé(e)', { action: { label: 'Annuler', run: doc.undo } });
        onClose();
        onDeleted?.();
    };

    return (
        <Sheet title={student ? 'Modifier la fiche' : 'Nouvel élève'} onClose={onClose} full
            footer={<div className="flex gap-2">
                {student && <Btn tone="danger" onClick={remove}>Supprimer</Btn>}
                <Btn tone="primary" block disabled={!valid || busy} onClick={submit}>{student ? 'Enregistrer' : 'Ajouter'}</Btn>
            </div>}>
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (valid) submit(); }}>
                <div className="flex items-center gap-4">
                    <Avatar student={{ firstName: fields.firstName || '?', lastName: fields.lastName, photo: fields.photo }} size={72} />
                    <div className="flex-1 grid gap-2">
                        <Btn disabled={busy} onClick={() => photo(true)}><Camera className="w-5 h-5" /> Prendre la photo</Btn>
                        <div className="flex gap-2">
                            <Btn block disabled={busy} onClick={() => photo(false)}><ImagePlus className="w-5 h-5" /> Choisir</Btn>
                            {fields.photo && <Btn onClick={() => set('photo', null)}>Retirer</Btn>}
                        </div>
                    </div>
                </div>
                <Field label="Prénom"><input className={inputClass} value={fields.firstName} onChange={e => set('firstName', e.target.value)} autoComplete="off" autoCapitalize="words" /></Field>
                <Field label="Nom"><input className={inputClass} value={fields.lastName} onChange={e => set('lastName', e.target.value)} autoComplete="off" autoCapitalize="characters" /></Field>
                <Field label="Date de naissance"><input type="date" className={inputClass} value={fields.dob} onChange={e => set('dob', e.target.value)} /></Field>
                <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Section</span>
                    <Segmented label="Section" value={fields.section} onChange={v => set('section', v)} options={sectionOrder.map(s => ({ id: s, label: s }))} />
                </div>
                <div>
                    <span className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1">Sexe</span>
                    <Segmented label="Sexe" value={fields.sex} onChange={v => set('sex', v)} options={[{ id: Sex.Girl, label: 'Fille' }, { id: Sex.Boy, label: 'Garçon' }]} />
                </div>
            </form>
        </Sheet>
    );
};

export default StudentFormSheet;
