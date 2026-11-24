import React, { useEffect, useRef } from 'react';
import { TeacherConfig, SchoolProgram, Domain } from '../types';

interface AnnexePreviewProps {
    teacherConfig: TeacherConfig;
    schoolPrograms: SchoolProgram[];
    onReady: () => void;
}

const collectTopDomains = (programs: SchoolProgram[]): Domain[] => {
    const result: Domain[] = [];
    programs.forEach(prog => prog.domains.forEach(d => result.push(d)));
    return result;
};

const AnnexePreview: React.FC<AnnexePreviewProps> = ({ teacherConfig, schoolPrograms, onReady }) => {
    const onReadyRef = useRef(onReady);
    useEffect(() => { onReadyRef.current = onReady; }, [onReady]);

    useEffect(() => {
        let cancelled = false;
        const f1 = requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (!cancelled) onReadyRef.current();
            });
        });
        return () => { cancelled = true; cancelAnimationFrame(f1); };
    }, []);

    const topDomains = collectTopDomains(schoolPrograms);
    const hasIntroduction = teacherConfig.showIntroduction && teacherConfig.introduction?.trim();
    const domainsWithExpectations = topDomains.filter(d => d.expectations && d.expectations.length > 0);

    return (
        <div style={{
            width: '210mm',
            minHeight: '297mm',
            margin: '0 auto',
            background: 'white',
            padding: '20mm',
            fontFamily: 'Arial, Helvetica, sans-serif',
            color: '#1a1a1a',
            boxSizing: 'border-box',
        }}>
            {/* En-tête */}
            <div style={{ textAlign: 'center', marginBottom: '12mm', borderBottom: '2px solid #1d4ed8', paddingBottom: '6mm' }}>
                {teacherConfig.schoolName && (
                    <div style={{ fontSize: '10.5pt', color: '#475569', marginBottom: '3mm' }}>
                        {teacherConfig.schoolName}
                    </div>
                )}
                <h1 style={{ fontSize: '16pt', fontWeight: 'bold', color: '#1e3a5f', margin: '0 0 3mm 0' }}>
                    Attendus en fin de maternelle
                </h1>
                {teacherConfig.schoolYear && (
                    <div style={{ fontSize: '10pt', color: '#475569' }}>
                        Année scolaire {teacherConfig.schoolYear}
                    </div>
                )}
            </div>

            {/* Introduction commune */}
            {hasIntroduction && (
                <div style={{ marginBottom: '10mm', padding: '5mm 7mm', background: '#f8fafc', borderLeft: '3px solid #1d4ed8' }}>
                    <h2 style={{ fontSize: '11.5pt', fontWeight: 'bold', color: '#1e3a5f', margin: '0 0 3mm 0' }}>
                        Introduction
                    </h2>
                    <p style={{ fontSize: '10pt', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                        {teacherConfig.introduction}
                    </p>
                </div>
            )}

            {/* Attendus par domaine */}
            {domainsWithExpectations.length > 0 && (
                <div>
                    {!hasIntroduction && (
                        <h2 style={{ fontSize: '11.5pt', fontWeight: 'bold', color: '#1e3a5f', margin: '0 0 6mm 0' }}>
                            Attendus par domaine
                        </h2>
                    )}
                    {domainsWithExpectations.map(domain => (
                        <div key={domain.id} style={{ marginBottom: '8mm', breakInside: 'avoid' }}>
                            <h3 style={{
                                fontSize: '11pt',
                                fontWeight: 'bold',
                                color: '#1e3a5f',
                                margin: '0 0 3mm 0',
                                borderBottom: '1px solid #cbd5e1',
                                paddingBottom: '2mm',
                            }}>
                                {domain.name}
                            </h3>
                            <ul style={{ margin: 0, paddingLeft: '6mm', listStyleType: 'disc' }}>
                                {domain.expectations.map((exp, i) => (
                                    <li key={i} style={{ fontSize: '10pt', lineHeight: 1.65, marginBottom: '1mm', color: '#374151' }}>
                                        {exp}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            )}

            {!hasIntroduction && domainsWithExpectations.length === 0 && (
                <p style={{ fontSize: '10pt', color: '#94a3b8', textAlign: 'center', marginTop: '20mm' }}>
                    Aucun contenu à afficher. Ajoutez une introduction ou des attendus dans les programmes.
                </p>
            )}
        </div>
    );
};

export default AnnexePreview;
