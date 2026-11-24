// Mode élève (tablette de la classe) : l'enfant touche sa photo, puis montre le QR code de l'atelier.
// 1er passage : l'atelier commence (passage « en attente ») ; 2e passage : atelier terminé, compétences
// validées (code enseignant facultatif). Mêmes règles que l'application de bureau (domain/studentMode.ts).
// On ne quitte le mode élève qu'avec le code PIN de l'enseignant.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import jsQR from 'jsqr';
import { Lock, RefreshCw, X } from 'lucide-react';
import { decideScan, DEFAULT_MIN_MINUTES_BETWEEN_SCANS, NO_PIN_ATTEMPTS, pinLockSecondsLeft, registerPinAttempt, type PinAttempts } from '../../core/domain/studentMode';
import { recordAutoValidation, recordScan } from '../../core/domain/workshops';
import type { Student, WorkshopEvent } from '../../core/types';
import { shortNames, sortStudents } from './model';
import type { ClassDocument } from './useClassDocument';
import { Avatar } from './ui';

type Result = { kind: 'first_scan' | 'validated' | 'already_completed' | 'too_soon'; workshop: string; minutes?: number };
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

const StudentMode: React.FC<{ doc: ClassDocument; onExit: () => void }> = ({ doc, onExit }) => {
    const { data } = doc;
    const [student, setStudent] = useState<Student | null>(null);
    const [result, setResult] = useState<Result | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [pinFor, setPinFor] = useState<'exit' | { workshopId: string; workshop: string } | null>(null);
    const [attempts, setAttempts] = useState<PinAttempts>(NO_PIN_ATTEMPTS);
    const timers = useRef<number[]>([]);
    const later = (fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); };
    useEffect(() => () => timers.current.forEach(t => window.clearTimeout(t)), []);

    // Plein écran (si le navigateur le permet) ; le geste « retour » ne fait pas sortir du mode élève.
    useEffect(() => {
        document.documentElement.requestFullscreen?.().catch(() => undefined);
        window.history.pushState({ envolees: 'mode-eleve' }, '');
        const onPop = () => window.history.pushState({ envolees: 'mode-eleve' }, '');
        window.addEventListener('popstate', onPop);
        return () => {
            window.removeEventListener('popstate', onPop);
            if (document.fullscreenElement) document.exitFullscreen?.().catch(() => undefined);
        };
    }, []);

    const record = (event: WorkshopEvent) => doc.update(prev => (event.type === 'auto_validation' ? recordAutoValidation(prev, event) : recordScan(prev, event)));
    const finish = (r: Result, ms: number) => {
        setResult(r);
        later(() => { setResult(null); setStudent(null); }, ms);
    };

    const validate = (workshopId: string, workshop: string, who: Student) => {
        record({ id: newId(), workshopId, studentId: who.id, timestamp: new Date().toISOString(), type: 'auto_validation', status: 'processed' });
        finish({ kind: 'validated', workshop }, 5000);
    };

    const showNotice = (text: string) => {
        setNotice(text);
        later(() => setNotice(n => (n === text ? null : n)), 3000);
    };

    const onCode = useCallback((code: string) => {
        if (!student || result || pinFor) return;
        const current = data.students.find(s => s.id === student.id) ?? student;
        const workshop = data.workshops.find(w => w.id === code);
        const decision = decideScan(code, current, data.workshops, data.workshopEvents, new Date(), data.teacherConfig.minMinutesBetweenScans ?? DEFAULT_MIN_MINUTES_BETWEEN_SCANS);
        switch (decision.kind) {
            case 'unknown': showNotice("Ce QR code n'est pas un atelier de la classe."); return;
            case 'paused': showNotice(`L'atelier « ${workshop!.name} » est en pause.`); return;
            case 'already_completed': finish({ kind: 'already_completed', workshop: workshop!.name }, 4000); return;
            case 'too_soon': finish({ kind: 'too_soon', workshop: workshop!.name, minutes: decision.minutesLeft }, 5000); return;
            case 'first_scan':
                record({ id: newId(), workshopId: workshop!.id, studentId: current.id, timestamp: new Date().toISOString(), type: 'scan', status: 'pending' });
                finish({ kind: 'first_scan', workshop: workshop!.name }, 4000);
                return;
            case 'second_scan':
                if (data.teacherConfig.requirePinForValidation) setPinFor({ workshopId: workshop!.id, workshop: workshop!.name });
                else validate(workshop!.id, workshop!.name, current);
        }
    }, [student, result, pinFor, data]);

    const checkPin = (pin: string): boolean => {
        const ok = pin === data.teacherConfig.studentModePin;
        setAttempts(a => registerPinAttempt(a, ok, Date.now()));
        if (!ok) return false;
        if (pinFor === 'exit') onExit();
        else if (pinFor && student) validate(pinFor.workshopId, pinFor.workshop, student);
        setPinFor(null);
        return true;
    };

    return (
        <div className="fixed inset-0 z-[60] bg-gradient-to-br from-sky-100 via-indigo-50 to-purple-100 text-slate-800 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }} data-mode-eleve>
            <button type="button" onClick={() => setPinFor('exit')} aria-label="Quitter le mode élève (code enseignant)"
                className="absolute right-4 top-4 z-10 w-14 h-14 rounded-full bg-white/70 backdrop-blur shadow text-slate-500 inline-flex items-center justify-center" style={{ marginTop: 'env(safe-area-inset-top)' }}>
                <Lock className="w-6 h-6" />
            </button>

            {result ? <ResultScreen result={result} student={student} />
                : student ? <ScanScreen student={student} notice={notice} onCode={onCode} onBack={() => setStudent(null)} paused={!!pinFor} />
                : <SelectScreen students={sortStudents(data.students)} onSelect={setStudent} />}

            {pinFor && (
                <PinPad title={pinFor === 'exit' ? 'Code enseignant pour quitter' : `Code enseignant pour valider « ${pinFor.workshop} »`}
                    attempts={attempts} onSubmit={checkPin}
                    onCancel={() => { if (pinFor !== 'exit') setStudent(null); setPinFor(null); }} />
            )}
        </div>
    );
};

// ---------------------------------------------------------------------------------------------

const SelectScreen: React.FC<{ students: Student[]; onSelect: (s: Student) => void }> = ({ students, onSelect }) => {
    const names = shortNames(students);
    return (
    <div className="flex-1 overflow-y-auto px-6 pb-8">
        <h1 className="text-center text-3xl font-bold text-indigo-700 pt-8 pb-6">Qui es-tu ?</h1>
        <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4 max-w-6xl mx-auto">
            {students.map(s => (
                <li key={s.id}>
                    <button type="button" onClick={() => onSelect(s)} className="w-full flex flex-col items-center gap-2 p-3 rounded-3xl bg-white/80 shadow-sm active:scale-95 transition-transform">
                        <Avatar student={s} size={96} />
                        <span className="text-lg font-semibold">{names.get(s.id)}</span>
                    </button>
                </li>
            ))}
        </ul>
    </div>
    );
};

const ScanScreen: React.FC<{ student: Student; notice: string | null; onCode: (code: string) => void; onBack: () => void; paused: boolean }> = ({ student, notice, onCode, onBack, paused }) => {
    const video = useRef<HTMLVideoElement>(null);
    const [facing, setFacing] = useState<'user' | 'environment'>('user');
    const [error, setError] = useState<string | null>(null);
    const onCodeRef = useRef(onCode);
    onCodeRef.current = onCode;
    const pausedRef = useRef(paused);
    pausedRef.current = paused;

    useEffect(() => {
        let stream: MediaStream | null = null;
        let timer = 0;
        let stopped = false;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        (async () => {
            try {
                stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 } }, audio: false });
                if (stopped) { stream.getTracks().forEach(t => t.stop()); return; }
                if (video.current) { video.current.srcObject = stream; await video.current.play().catch(() => undefined); }
                setError(null);
            } catch {
                setError("La caméra n'est pas disponible. Autorisez l'accès à la caméra pour Envolées (réglages du navigateur), puis réessayez.");
            }
            const tick = () => {
                const v = video.current;
                if (!stopped && v && context && v.readyState >= 2 && !pausedRef.current) {
                    canvas.width = v.videoWidth;
                    canvas.height = v.videoHeight;
                    context.drawImage(v, 0, 0);
                    const code = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' });
                    if (code?.data) onCodeRef.current(code.data);
                }
                if (!stopped) timer = window.setTimeout(tick, 300);
            };
            tick();
        })();
        // Lecture équivalente à un QR code montré à la caméra (tests automatiques).
        const onTest = (e: Event) => onCodeRef.current(String((e as CustomEvent).detail));
        window.addEventListener('envolees:qr', onTest);
        return () => {
            stopped = true;
            window.clearTimeout(timer);
            window.removeEventListener('envolees:qr', onTest);
            stream?.getTracks().forEach(t => t.stop());
        };
    }, [facing]);

    return (
        <div className="flex-1 flex flex-col items-center justify-center gap-5 px-6 py-6">
            <div className="flex items-center gap-3">
                <Avatar student={student} size={64} />
                <p className="text-2xl font-bold">{student.firstName}, montre ton QR code !</p>
            </div>
            <div className="relative w-full max-w-xl aspect-[4/3] rounded-3xl overflow-hidden bg-slate-900 shadow-xl">
                <video ref={video} playsInline muted className={`w-full h-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`} />
                <div className="absolute inset-[18%] border-4 border-white/80 rounded-3xl pointer-events-none" />
                {error && <p className="absolute inset-0 flex items-center justify-center text-center text-white p-6">{error}</p>}
                {notice && <p role="status" className="absolute inset-x-4 bottom-4 rounded-2xl bg-amber-400 text-amber-950 font-semibold text-center px-4 py-3">{notice}</p>}
            </div>
            <div className="flex gap-3">
                <button type="button" onClick={onBack} className="min-h-14 px-6 rounded-2xl bg-white/80 shadow font-semibold inline-flex items-center gap-2"><X className="w-5 h-5" /> Ce n'est pas moi</button>
                <button type="button" onClick={() => setFacing(f => (f === 'user' ? 'environment' : 'user'))} className="min-h-14 px-6 rounded-2xl bg-white/80 shadow font-semibold inline-flex items-center gap-2"><RefreshCw className="w-5 h-5" /> Autre caméra</button>
            </div>
        </div>
    );
};

const RESULT_TEXT: Record<Result['kind'], { title: string; tone: string; text: (r: Result) => string }> = {
    first_scan: { title: "C'est parti !", tone: 'text-sky-700', text: r => `Tu commences ${r.workshop}. Quand tu as fini, reviens montrer ton QR code.` },
    validated: { title: 'Bravo !', tone: 'text-emerald-700', text: r => `${r.workshop} est réussi !` },
    already_completed: { title: 'Déjà fait !', tone: 'text-indigo-700', text: r => `${r.workshop} a déjà été validé, tu ne peux pas le refaire.` },
    too_soon: { title: 'Patience !', tone: 'text-amber-700', text: r => `Tu viens de commencer ${r.workshop}. Termine-le, puis reviens montrer ton QR code${(r.minutes ?? 1) > 1 ? ` dans ${r.minutes} minutes` : ' dans une minute'}.` },
};

const ResultScreen: React.FC<{ result: Result; student: Student | null }> = ({ result, student }) => {
    const t = RESULT_TEXT[result.kind];
    return (
        <div role="status" className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
            {student && <Avatar student={student} size={120} />}
            <h2 className={`text-5xl font-bold ${t.tone}`}>{t.title}</h2>
            <p className="text-2xl max-w-2xl">{t.text(result)}</p>
        </div>
    );
};

// Pavé numérique : grandes touches, saisie sans clavier système.
const PinPad: React.FC<{ title: string; attempts: PinAttempts; onSubmit: (pin: string) => boolean; onCancel: () => void }> = ({ title, attempts, onSubmit, onCancel }) => {
    const [pin, setPin] = useState('');
    const [wrong, setWrong] = useState(false);
    const [now, setNow] = useState(Date.now());
    const locked = pinLockSecondsLeft(attempts, now);
    useEffect(() => { if (!locked) return; const t = window.setInterval(() => setNow(Date.now()), 500); return () => window.clearInterval(t); }, [locked]);

    const press = (digit: string) => {
        if (locked || pin.length >= 8) return;
        setWrong(false);
        setPin(pin + digit);
    };
    const submit = () => {
        if (!pin || locked) return;
        if (!onSubmit(pin)) { setWrong(true); setPin(''); setNow(Date.now()); }
    };
    return (
        <div className="fixed inset-0 z-[70] bg-slate-900/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label={title}>
            <div className="bg-white rounded-3xl shadow-2xl p-6 w-full max-w-sm text-slate-800">
                <h2 className="text-lg font-semibold text-center">{title}</h2>
                <p className="text-center text-3xl tracking-[0.5em] h-12 mt-3" aria-label="Code saisi">{'•'.repeat(pin.length)}</p>
                <p role="alert" className="text-center text-sm h-5 text-red-600">{locked ? `Trop d'essais : réessayez dans ${locked} s` : wrong ? 'Code incorrect' : ''}</p>
                <div className="grid grid-cols-3 gap-3 mt-3">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(d => (
                        <button key={d} type="button" disabled={!!locked} onClick={() => press(d)} className="h-16 rounded-2xl bg-slate-100 active:bg-slate-200 text-2xl font-semibold disabled:opacity-40">{d}</button>
                    ))}
                    <button type="button" onClick={() => setPin(pin.slice(0, -1))} className="h-16 rounded-2xl bg-slate-100 active:bg-slate-200 font-semibold" aria-label="Effacer">⌫</button>
                    <button type="button" disabled={!!locked} onClick={() => press('0')} className="h-16 rounded-2xl bg-slate-100 active:bg-slate-200 text-2xl font-semibold disabled:opacity-40">0</button>
                    <button type="button" disabled={!pin || !!locked} onClick={submit} className="h-16 rounded-2xl bg-indigo-600 text-white font-semibold disabled:opacity-40">OK</button>
                </div>
                <button type="button" onClick={onCancel} className="mt-4 w-full min-h-12 rounded-2xl font-semibold text-slate-600 active:bg-slate-100">Annuler</button>
            </div>
        </div>
    );
};

export default StudentMode;
