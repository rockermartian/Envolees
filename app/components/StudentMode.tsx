import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Student, Workshop, WorkshopEvent, TeacherConfig } from '../types';
import Webcam from 'react-webcam';
import jsQR from 'jsqr';
import { motion, AnimatePresence } from 'framer-motion';
import { LockIcon, ArrowLeftIcon, CheckCircleIcon, UserIcon, XCircleIcon, StarIcon, TrophyIcon } from 'lucide-react';
import StoredImage from '../images/StoredImage';
import { decideScan, DEFAULT_MIN_MINUTES_BETWEEN_SCANS, NO_PIN_ATTEMPTS, PinAttempts, pinLockSecondsLeft, registerPinAttempt } from '../domain/studentMode';

interface StudentModeProps {
  students: Student[];
  teacherConfig: TeacherConfig;
  workshops: Workshop[];
  onQRCodeScanned: (eventData: WorkshopEvent) => void;
  events: WorkshopEvent[];
  onExit: () => void;
}

type ScanResult = 'first_scan' | 'auto_validation' | 'already_completed' | 'too_soon';

const CARD_PALETTES = [
  { border: 'border-pink-400',    bg: 'bg-pink-50 hover:bg-pink-100',     text: 'text-pink-700',    avatar: 'border-pink-300'    },
  { border: 'border-sky-400',     bg: 'bg-sky-50 hover:bg-sky-100',       text: 'text-sky-700',     avatar: 'border-sky-300'     },
  { border: 'border-emerald-400', bg: 'bg-emerald-50 hover:bg-emerald-100',text: 'text-emerald-700', avatar: 'border-emerald-300' },
  { border: 'border-violet-400',  bg: 'bg-violet-50 hover:bg-violet-100', text: 'text-violet-700',  avatar: 'border-violet-300'  },
  { border: 'border-amber-500',   bg: 'bg-amber-50 hover:bg-amber-100',   text: 'text-amber-700',   avatar: 'border-amber-400'   },
  { border: 'border-rose-400',    bg: 'bg-rose-50 hover:bg-rose-100',     text: 'text-rose-700',    avatar: 'border-rose-300'    },
];

const CONFETTI_COLORS = [
  'bg-yellow-300', 'bg-pink-400', 'bg-sky-400', 'bg-emerald-400',
  'bg-violet-400', 'bg-orange-400', 'bg-rose-400', 'bg-lime-400', 'bg-cyan-400',
];

const StudentMode: React.FC<StudentModeProps> = ({ students, teacherConfig, workshops, onQRCodeScanned, events, onExit }) => {
  const [screen, setScreen] = useState<'select' | 'scan' | 'success'>('select');
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [scannedWorkshopName, setScannedWorkshopName] = useState<string>('');
  const [scanResult, setScanResult] = useState<ScanResult>('first_scan');

  const [showExitPin, setShowExitPin] = useState(false);
  const [showValidationPin, setShowValidationPin] = useState(false);
  const [pendingValidation, setPendingValidation] = useState<{ workshopId: string; workshopName: string } | null>(null);
  // Essais de code PIN partagés (sortie et validation) : blocage temporaire après plusieurs échecs
  const [pinAttempts, setPinAttempts] = useState<PinAttempts>(NO_PIN_ATTEMPTS);
  const [tooSoonMinutes, setTooSoonMinutes] = useState(0);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const teacherPin = teacherConfig.studentModePin || '0000';

  // Minuteries annulées si l'on quitte le mode élève
  const timersRef = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => { timersRef.current.push(window.setTimeout(fn, ms)); };
  useEffect(() => () => timersRef.current.forEach(id => window.clearTimeout(id)), []);

  // La lecture des QR codes n'est active que sur l'écran de scan, sans fenêtre de code PIN ouverte.
  // Lue via une ref : la vue de scan reste affichée pendant son animation de sortie et ne doit plus
  // rien déclencher.
  const scanEnabledRef = useRef(false);
  scanEnabledRef.current = screen === 'scan' && !showValidationPin && !showExitPin;
  const isScanEnabled = useCallback(() => scanEnabledRef.current, []);

  const noticeRef = useRef<{ text: string; timer: number } | null>(null);
  const showNotice = (text: string) => {
    if (noticeRef.current?.text === text) return; // le même QR est relu toutes les 300 ms
    if (noticeRef.current) window.clearTimeout(noticeRef.current.timer);
    setScanNotice(text);
    noticeRef.current = { text, timer: window.setTimeout(() => { setScanNotice(null); noticeRef.current = null; }, 3000) };
  };

  useEffect(() => {
    const htmlEl = document.documentElement;
    const wasDark = htmlEl.classList.contains('dark');
    htmlEl.classList.remove('dark');
    return () => {
        if (wasDark) htmlEl.classList.add('dark');
    };
  }, []);

  useEffect(() => {
    try {
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen().catch(() => {});
        }
    } catch(e) {}

    return () => {
        try {
            if (document.fullscreenElement) {
                document.exitFullscreen().catch(() => {});
            }
        } catch(e) {}
    }
  }, []);

  const handleStudentSelect = (student: Student) => {
      setSelectedStudent(student);
      setScanNotice(null);
      noticeRef.current = null;
      setScreen('scan');
  };

  const backToSelect = (delay: number) => later(() => { setSelectedStudent(null); setScreen('select'); }, delay);

  const showResult = (result: ScanResult, workshopName: string) => {
      scanEnabledRef.current = false;
      setScanResult(result);
      setScannedWorkshopName(workshopName);
      setScreen('success');
  };

  const doAutoValidation = useCallback((workshopId: string, workshopName: string, student: Student) => {
      showResult('auto_validation', workshopName);
      // Les compétences de l'atelier sont accordées par App en une seule opération
      // (celles déjà acquises sont conservées telles quelles).
      onQRCodeScanned({ id: crypto.randomUUID(), workshopId, studentId: student.id, timestamp: new Date().toISOString(), type: 'auto_validation', status: 'processed' });
      backToSelect(5000);
  }, [onQRCodeScanned]);

  const processScan = useCallback((qrData: string) => {
      if (!scanEnabledRef.current || !selectedStudent) return;
      const currentStudent = students.find(s => s.id === selectedStudent.id) || selectedStudent;
      const workshop = workshops.find(w => w.id === qrData);
      const decision = decideScan(qrData, currentStudent, workshops, events, new Date(),
          teacherConfig.minMinutesBetweenScans ?? DEFAULT_MIN_MINUTES_BETWEEN_SCANS);

      switch (decision.kind) {
          case 'unknown':
              showNotice("Ce QR code n'est pas un atelier de la classe.");
              return;
          case 'paused':
              showNotice(`L'atelier « ${workshop!.name} » est en pause.`);
              return;
          case 'already_completed':
              showResult('already_completed', workshop!.name);
              backToSelect(4000);
              return;
          case 'too_soon':
              setTooSoonMinutes(decision.minutesLeft);
              showResult('too_soon', workshop!.name);
              backToSelect(5000);
              return;
          case 'first_scan':
              showResult('first_scan', workshop!.name);
              onQRCodeScanned({ id: crypto.randomUUID(), workshopId: workshop!.id, studentId: selectedStudent.id, timestamp: new Date().toISOString(), type: 'scan', status: 'pending' });
              backToSelect(4000);
              return;
          case 'second_scan':
              if (teacherConfig.requirePinForValidation) {
                  scanEnabledRef.current = false;
                  setPendingValidation({ workshopId: workshop!.id, workshopName: workshop!.name });
                  setShowValidationPin(true);
              } else {
                  doAutoValidation(workshop!.id, workshop!.name, selectedStudent);
              }
              return;
      }
  }, [selectedStudent, workshops, students, events, teacherConfig.requirePinForValidation, teacherConfig.minMinutesBetweenScans, doAutoValidation, onQRCodeScanned]);

  const handleValidationPinSuccess = () => {
      setShowValidationPin(false);
      if (pendingValidation && selectedStudent) {
          doAutoValidation(pendingValidation.workshopId, pendingValidation.workshopName, selectedStudent);
      }
      setPendingValidation(null);
  };

  const handleCancelValidationPin = () => {
      setShowValidationPin(false);
      setPendingValidation(null);
      setSelectedStudent(null);
      setScreen('select');
  };

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-sky-100 via-indigo-50 to-purple-100 dark:bg-zinc-900 flex flex-col font-sans overflow-hidden">
      <div className="absolute top-4 right-4 z-50">
         <button
           onClick={() => setShowExitPin(true)}
           className="p-3 bg-white/60 backdrop-blur-md rounded-full shadow-md text-slate-400 hover:text-slate-700 hover:bg-white/90 transition-colors"
         >
           <LockIcon className="w-6 h-6" />
         </button>
      </div>

      <AnimatePresence mode="wait">

        {/* ── Screen: select student ──────────────────────────────── */}
        {screen === 'select' && (
          <motion.div
            key="select"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="flex-grow flex flex-col items-center justify-start overflow-y-auto"
          >
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2 md:gap-3 w-full max-w-7xl px-6 pb-4 pt-4 max-sm:pt-20">
              {students.map((student, index) => {
                const pal = CARD_PALETTES[index % CARD_PALETTES.length];
                return (
                  <motion.button
                    key={student.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04, type: 'spring', bounce: 0.3 }}
                    onClick={() => handleStudentSelect(student)}
                    className={`flex flex-col items-center p-2 ${pal.bg} dark:bg-zinc-800 rounded-2xl shadow-md hover:shadow-lg hover:-translate-y-1 transition-all duration-300 border-2 ${pal.border} dark:border-zinc-700 active:scale-95`}
                  >
                    <div className={`w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden mb-1.5 bg-white dark:bg-zinc-700 flex items-center justify-center border-2 ${pal.avatar} dark:border-zinc-600 shadow-inner`}>
                      {student.photo ? (
                        <StoredImage src={student.photo} alt={student.firstName} className="w-full h-full object-cover" />
                      ) : (
                        <UserIcon className={`w-8 h-8 ${pal.text} dark:text-zinc-400`} />
                      )}
                    </div>
                    <span className={`text-xs md:text-sm font-black ${pal.text} dark:text-zinc-200 text-center truncate w-full uppercase tracking-wide`}>
                      {student.firstName}
                    </span>
                  </motion.button>
                );
              })}
              {students.length === 0 && (
                <div className="col-span-full text-center text-slate-400 font-medium text-xl mt-12">
                  Aucun élève dans la classe.
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ── Screen: QR scan ────────────────────────────────────── */}
        {screen === 'scan' && selectedStudent && (
          <QRScannerView
            key="scan"
            student={selectedStudent}
            onCancel={() => setScreen('select')}
            onScan={processScan}
            isScanEnabled={isScanEnabled}
            notice={scanNotice}
          />
        )}

        {/* ── Screen: already completed ──────────────────────────── */}
        {screen === 'success' && scanResult === 'already_completed' && (
          <motion.div
            key="already-completed"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.4 }}
            className="flex-grow flex flex-col items-center justify-center p-8 bg-gradient-to-br from-red-100 to-rose-100 dark:from-red-900/20 dark:to-zinc-900 relative overflow-hidden"
          >
            <motion.div
              initial={{ opacity: 1 }}
              animate={{ opacity: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center"
            >
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0, opacity: 1 }}
                  animate={{ height: 60, opacity: 0, y: -120 }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: 0.05 }}
                  className="absolute w-2 rounded-full bg-red-400 origin-bottom"
                  style={{ transform: `rotate(${i * 45}deg)` }}
                />
              ))}
            </motion.div>

            <motion.div
              initial={{ scale: 0, rotate: 90 }}
              animate={{ scale: [1.2, 0.9, 1], rotate: 0 }}
              transition={{ type: 'spring', duration: 0.7, bounce: 0.5 }}
              className="rounded-full p-6 mb-8 shadow-2xl bg-red-500 shadow-red-400/40"
            >
              <XCircleIcon className="w-32 h-32 text-white" />
            </motion.div>
            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-6xl font-black mb-4 text-center tracking-tight text-red-600 dark:text-red-400"
            >
              Déjà réussi !
            </motion.h2>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-2xl font-medium text-center max-w-2xl text-red-800/70 dark:text-red-200/70"
            >
              {scannedWorkshopName} a déjà été validé, tu ne peux pas le refaire.
            </motion.p>
          </motion.div>
        )}

        {/* ── Screen: 2nd scan too soon ──────────────────────────── */}
        {screen === 'success' && scanResult === 'too_soon' && (
          <motion.div
            key="too-soon"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.4 }}
            className="flex-grow flex flex-col items-center justify-center p-8 bg-gradient-to-br from-sky-100 to-indigo-100"
          >
            <div className="rounded-full p-6 mb-8 shadow-2xl bg-sky-500 shadow-sky-400/40">
              <LockIcon className="w-32 h-32 text-white" />
            </div>
            <h2 className="text-5xl md:text-6xl font-black mb-4 text-center tracking-tight text-sky-700">Patience !</h2>
            <p className="text-2xl font-medium text-center max-w-2xl text-sky-900/70">
              Tu viens de commencer {scannedWorkshopName}. Termine-le, puis reviens montrer ton QR code
              {tooSoonMinutes > 1 ? ` dans ${tooSoonMinutes} minutes` : ' dans une minute'}.
            </p>
          </motion.div>
        )}

        {/* ── Screen: first scan ─────────────────────────────────── */}
        {screen === 'success' && scanResult === 'first_scan' && (
          <motion.div
            key="first-scan"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: 'spring', bounce: 0.5 }}
            className="flex-grow flex flex-col items-center justify-center p-8 bg-gradient-to-br from-emerald-100 via-teal-50 to-cyan-100 dark:from-emerald-900/20 dark:to-zinc-900 relative overflow-hidden"
          >
            {/* subtle sparkle burst */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[...Array(12)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 rounded-full bg-emerald-400/60"
                  initial={{ x: 0, y: 0, opacity: 1, scale: 0 }}
                  animate={{
                    x: Math.cos((i * 30) * Math.PI / 180) * (120 + i * 8),
                    y: Math.sin((i * 30) * Math.PI / 180) * (120 + i * 8),
                    opacity: 0,
                    scale: [0, 1.5, 0],
                  }}
                  transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 + i * 0.02 }}
                />
              ))}
            </div>

            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', delay: 0.1, duration: 0.7, bounce: 0.5 }}
              className="rounded-full p-6 mb-8 shadow-2xl bg-emerald-500 shadow-emerald-400/50"
            >
              <CheckCircleIcon className="w-32 h-32 text-white" />
            </motion.div>

            <motion.h2
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-6xl font-black mb-4 text-center tracking-tight text-emerald-700 dark:text-emerald-300"
            >
              Bravo {selectedStudent?.firstName} !
            </motion.h2>
            <motion.p
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-2xl font-semibold text-center max-w-2xl text-emerald-800/70 dark:text-emerald-200/70"
            >
              {scannedWorkshopName} enregistré.
            </motion.p>
          </motion.div>
        )}

        {/* ── Screen: auto_validation (2nd scan) — CELEBRATION ───── */}
        {screen === 'success' && scanResult === 'auto_validation' && (
          <motion.div
            key="auto-validation"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ type: 'spring', bounce: 0.4, duration: 0.6 }}
            className="flex-grow flex flex-col items-center justify-center p-8 bg-gradient-to-br from-yellow-300 via-amber-300 to-orange-400 relative overflow-hidden"
          >

            {/* ── Burst confetti from center ── */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              {[...Array(48)].map((_, i) => {
                const angle = (i / 48) * 360;
                const dist = 180 + (i % 5) * 55;
                const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
                const isCircle = i % 3 === 0;
                const size = 8 + (i % 3) * 5;
                return (
                  <motion.div
                    key={`burst-${i}`}
                    className={`absolute ${color} ${isCircle ? 'rounded-full' : 'rounded-sm'}`}
                    style={{ width: size, height: size }}
                    initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 0 }}
                    animate={{
                      x: Math.cos(angle * Math.PI / 180) * dist,
                      y: Math.sin(angle * Math.PI / 180) * dist - 60,
                      opacity: [0, 1, 1, 0],
                      rotate: angle * 3,
                      scale: [0, 1.4, 1, 0.5],
                    }}
                    transition={{ duration: 1.6, ease: 'easeOut', delay: 0.05 + (i % 4) * 0.07 }}
                  />
                );
              })}
            </div>

            {/* ── Falling confetti from top ── */}
            {[...Array(28)].map((_, i) => {
              const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
              const xPos = (i * 3.7 + 1.5) % 100;
              const isCircle = i % 2 === 0;
              const size = 8 + (i % 4) * 4;
              return (
                <motion.div
                  key={`fall-${i}`}
                  className={`absolute ${color} ${isCircle ? 'rounded-full' : 'rounded-sm'} pointer-events-none`}
                  style={{ left: `${xPos}%`, top: 0, width: size, height: size }}
                  initial={{ y: -40, opacity: 1, rotate: 0 }}
                  animate={{
                    y: '108vh',
                    opacity: [1, 1, 1, 0.4, 0],
                    rotate: i % 2 === 0 ? 720 : -540,
                  }}
                  transition={{
                    duration: 2.8 + (i % 5) * 0.45,
                    delay: 0.4 + i * 0.09,
                    ease: 'easeIn',
                  }}
                />
              );
            })}

            {/* ── Main trophy icon ── */}
            <div className="relative z-10 flex flex-col items-center">
              <motion.div
                initial={{ scale: 0, rotate: -540, y: 60 }}
                animate={{ scale: 1, rotate: 0, y: 0 }}
                transition={{ type: 'spring', delay: 0.1, duration: 1.3, bounce: 0.65 }}
                className="relative mb-8"
              >
                {/* Pulsing ring */}
                <motion.div
                  className="absolute inset-[-20px] rounded-full border-[10px] border-white/50"
                  animate={{ scale: [1, 1.45, 1.9], opacity: [0.7, 0.35, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', repeatDelay: 0.4 }}
                />
                {/* Second ring */}
                <motion.div
                  className="absolute inset-[-20px] rounded-full border-[6px] border-white/30"
                  animate={{ scale: [1, 1.7, 2.3], opacity: [0.5, 0.2, 0] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut', repeatDelay: 0.4, delay: 0.3 }}
                />

                <div className="bg-white rounded-full p-7 shadow-2xl shadow-amber-900/50">
                  <motion.div
                    animate={{ rotate: [0, -8, 8, -5, 5, -2, 2, 0] }}
                    transition={{ duration: 0.7, delay: 1.4, ease: 'easeInOut' }}
                  >
                    <TrophyIcon className="w-28 h-28 text-amber-500" strokeWidth={1.5} />
                  </motion.div>
                </div>
              </motion.div>

              <motion.h2
                initial={{ y: 40, opacity: 0, scale: 0.7 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ delay: 0.45, type: 'spring', bounce: 0.55 }}
                className="text-6xl md:text-8xl font-black text-white drop-shadow-lg tracking-tight text-center mb-3"
                style={{ textShadow: '0 4px 24px rgba(180,83,9,0.5)' }}
              >
                Bravo !
              </motion.h2>

              <motion.div
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.65 }}
                className="text-center"
              >
                <p className="text-2xl md:text-3xl font-bold text-white/95 drop-shadow">
                  {scannedWorkshopName}
                </p>
                <p className="text-xl md:text-2xl font-semibold text-white/80 drop-shadow mt-1">
                  est maintenant validé !
                </p>
              </motion.div>

              {/* Stars floating around */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={`star-${i}`}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${[-60, 60, -80, 80, -40, 40][i]}px`,
                    top: `${[-40, -40, 10, 10, 60, 60][i]}px`,
                  }}
                  initial={{ scale: 0, opacity: 0, rotate: 0 }}
                  animate={{
                    scale: [0, 1.2, 0.9, 1],
                    opacity: [0, 1, 1, 0.7],
                    rotate: i % 2 === 0 ? [0, 180, 360] : [0, -180, -360],
                    y: [0, -8, 0, -5, 0],
                  }}
                  transition={{
                    scale: { delay: 0.7 + i * 0.1, duration: 0.5 },
                    opacity: { delay: 0.7 + i * 0.1, duration: 0.5 },
                    rotate: { delay: 0.7 + i * 0.1, duration: 3, repeat: Infinity, ease: 'linear' },
                    y: { delay: 1 + i * 0.2, duration: 2 + i * 0.3, repeat: Infinity, ease: 'easeInOut' },
                  }}
                >
                  <StarIcon
                    className="text-white"
                    style={{ width: [20, 20, 16, 16, 24, 24][i], height: [20, 20, 16, 16, 24, 24][i] }}
                    fill="currentColor"
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* ── Exit PIN modal ─────────────────────────────────────────── */}
      {showExitPin && (
        <PinPrompt
          title="Code Professeur"
          pin={teacherPin}
          attempts={pinAttempts}
          onAttempts={setPinAttempts}
          onSuccess={onExit}
          onCancel={() => setShowExitPin(false)}
        />
      )}

      {/* ── Validation PIN modal ───────────────────────────────────── */}
      {showValidationPin && pendingValidation && (
        <PinPrompt
          title="Validation enseignant"
          subtitle={<>Entrez le code PIN pour valider<br /><span className="font-semibold text-slate-700">{pendingValidation.workshopName}</span></>}
          pin={teacherPin}
          attempts={pinAttempts}
          onAttempts={setPinAttempts}
          onSuccess={handleValidationPinSuccess}
          onCancel={handleCancelValidationPin}
          accent
        />
      )}
    </div>
  );
};

// ── Saisie du code PIN (blocage temporaire après plusieurs échecs) ─────────────
const PinPrompt: React.FC<{
    title: string;
    subtitle?: React.ReactNode;
    pin: string;
    attempts: PinAttempts;
    onAttempts: (next: PinAttempts) => void;
    onSuccess: () => void;
    onCancel: () => void;
    accent?: boolean;
}> = ({ title, subtitle, pin, attempts, onAttempts, onSuccess, onCancel, accent }) => {
    const [value, setValue] = useState('');
    const [shake, setShake] = useState(false);
    const [now, setNow] = useState(() => Date.now());
    const lockedFor = pinLockSecondsLeft(attempts, now);

    useEffect(() => {
        if (!attempts.lockedUntil) return;
        const timer = window.setInterval(() => setNow(Date.now()), 500);
        return () => window.clearInterval(timer);
    }, [attempts.lockedUntil]);

    const handleChange = (raw: string) => {
        if (pinLockSecondsLeft(attempts, Date.now()) > 0) return;
        const typed = raw.replace(/[^0-9]/g, '').slice(0, pin.length);
        setValue(typed);
        if (typed.length < pin.length) return;
        const success = typed === pin;
        onAttempts(registerPinAttempt(attempts, success, Date.now()));
        setNow(Date.now());
        if (success) { onSuccess(); return; }
        setShake(true);
        window.setTimeout(() => { setValue(''); setShake(false); }, 450);
    };

    return (
        <div className="fixed inset-0 z-[60] bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white dark:bg-zinc-800 rounded-3xl shadow-2xl p-8 max-w-xs w-full text-center">
            {accent && (
              <div className="w-14 h-14 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <LockIcon className="w-7 h-7 text-amber-600" />
              </div>
            )}
            <h3 className="text-xl font-bold mb-1 text-slate-800 dark:text-zinc-100">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500 dark:text-zinc-400 mb-4">{subtitle}</p>}
            <div className="my-5 flex justify-center">
              <motion.input
                animate={shake ? { x: [-8, 8, -6, 6, -4, 4, 0] } : {}}
                transition={{ duration: 0.4 }}
                type="password"
                inputMode="numeric"
                autoComplete="off"
                maxLength={pin.length}
                value={value}
                disabled={lockedFor > 0}
                aria-label="Code PIN"
                onChange={e => handleChange(e.target.value)}
                className={`text-center text-4xl font-mono tracking-widest w-full p-4 bg-slate-100 dark:bg-zinc-900 rounded-xl border border-slate-200 dark:border-zinc-700 text-slate-800 dark:text-zinc-100 outline-none focus:ring-2 ${accent ? 'focus:ring-amber-500' : 'focus:ring-blue-500'} disabled:opacity-50`}
                autoFocus
              />
            </div>
            {lockedFor > 0 && (
              <p role="alert" className="mb-4 text-sm font-medium text-red-600">Trop d'essais. Réessayez dans {lockedFor} s.</p>
            )}
            <button onClick={onCancel} className="w-full py-3 text-slate-600 font-bold bg-slate-100 dark:bg-zinc-700 dark:text-zinc-300 rounded-xl hover:bg-slate-200 dark:hover:bg-zinc-600">Annuler</button>
          </div>
        </div>
    );
};

// ── QR Scanner view ────────────────────────────────────────────────────────────
const QRScannerView: React.FC<{
    student: Student;
    onCancel: () => void;
    onScan: (id: string) => void;
    /** Faux pendant un code PIN ou l'animation de sortie : aucune lecture n'est alors traitée. */
    isScanEnabled: () => boolean;
    /** Message bref (QR code inconnu, atelier en pause). */
    notice: string | null;
}> = ({ student, onCancel, onScan, isScanEnabled, notice }) => {
    const webcamRef = useRef<Webcam>(null);
    const [cameraError, setCameraError] = useState(false);

    const capture = useCallback(() => {
        if (!isScanEnabled() || !webcamRef.current) return;
        const video = webcamRef.current.video;
        if (video && video.readyState === video.HAVE_ENOUGH_DATA) {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const code = jsQR(imageData.data, imageData.width, imageData.height, {
                    inversionAttempts: "dontInvert",
                });
                if (code && code.data) {
                    onScan(code.data);
                }
            }
        }
    }, [onScan, isScanEnabled]);

    useEffect(() => {
        const interval = setInterval(capture, 300);
        return () => clearInterval(interval);
    }, [capture]);

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.05 }}
            transition={{ duration: 0.3 }}
            className="flex-grow flex flex-col relative"
        >
            <div className="absolute top-4 left-4 z-10">
                <button
                  onClick={onCancel}
                  className="flex items-center gap-2 p-3 px-5 bg-white/85 backdrop-blur-md rounded-full shadow-lg font-bold text-slate-700 hover:bg-white transition-colors"
                >
                    <ArrowLeftIcon className="w-5 h-5" /> Retour
                </button>
            </div>

            {notice && (
                <div role="status" className="absolute top-6 left-1/2 -translate-x-1/2 z-20 bg-white/95 rounded-2xl shadow-xl px-6 py-3 text-xl font-bold text-slate-800">
                    {notice}
                </div>
            )}

            <div className="flex-grow relative bg-black overflow-hidden flex items-center justify-center">
                {cameraError ? (
                    <div role="alert" className="relative z-10 max-w-lg text-center px-8">
                        <p className="text-3xl font-black text-white mb-3">La caméra ne fonctionne pas.</p>
                        <p className="text-xl text-white/80">Appelle la maîtresse ou le maître.</p>
                        <p className="mt-6 text-sm text-white/60">(Enseignant : vérifiez qu'une caméra est branchée et qu'aucune autre application ne l'utilise.)</p>
                    </div>
                ) : (
                    <Webcam
                        ref={webcamRef}
                        audio={false}
                        screenshotFormat="image/jpeg"
                        videoConstraints={{ facingMode: "environment" }}
                        onUserMediaError={() => setCameraError(true)}
                        className="absolute inset-0 min-w-full min-h-full object-cover"
                    />
                )}

                <div className="absolute inset-0 border-[40px] md:border-[100px] border-black/40 pointer-events-none" />

                {/* Student identity badge — bottom-left */}
                <motion.div
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring', bounce: 0.4 }}
                  className="absolute bottom-6 left-6 z-10 bg-black/65 backdrop-blur-md rounded-2xl px-4 py-3 border border-white/15 shadow-2xl flex items-center gap-3 pointer-events-none"
                >
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 flex-shrink-0 border-2 border-white/80">
                        {student.photo ? <StoredImage src={student.photo} alt={student.firstName} className="w-full h-full object-cover" /> : <UserIcon className="w-full h-full text-slate-300 p-2"/>}
                    </div>
                    <div>
                        <p className="text-white font-black text-xl uppercase tracking-wide">{student.firstName}</p>
                        <p className="text-amber-400 font-semibold text-sm">Montre ton QR code !</p>
                    </div>
                </motion.div>

                {/* Targeting square with animated corners */}
                {!cameraError && (
                <div className="absolute w-64 h-64 md:w-80 md:h-80 border-2 border-white/25 rounded-3xl pointer-events-none shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                    {[
                      'top-0 left-0 border-t-8 border-l-8 rounded-tl-2xl -ml-2 -mt-2',
                      'top-0 right-0 border-t-8 border-r-8 rounded-tr-2xl -mr-2 -mt-2',
                      'bottom-0 left-0 border-b-8 border-l-8 rounded-bl-2xl -ml-2 -mb-2',
                      'bottom-0 right-0 border-b-8 border-r-8 rounded-br-2xl -mr-2 -mb-2',
                    ].map((cls, i) => (
                      <motion.div
                        key={i}
                        className={`absolute w-9 h-9 border-amber-400 ${cls}`}
                        animate={{ opacity: [1, 0.4, 1] }}
                        transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.4 }}
                      />
                    ))}
                </div>
                )}
            </div>
        </motion.div>
    );
};

export default StudentMode;
