import { SchoolProgram, Proficiency, ReferenceAge } from './types';

export const DEFAULT_SCHOOL_PROGRAMS: SchoolProgram[] = [
  {
    id: 'program_default_2024',
    name: 'Programme 2024 (par défaut)',
    domains: [
      {
        id: 'langage',
        name: "Mobiliser le langage dans toutes ses dimensions",
        expectations: [
          "Communiquer avec les adultes et avec les autres enfants en se faisant comprendre.",
          "S'exprimer et comprendre en reformulant.",
          "Pratiquer divers usages du langage oral : raconter, décrire, évoquer, expliquer, questionner, proposer des solutions, discuter un point de vue."
        ],
        skills: [
          { id: 'langage_1', name: "Oser entrer en communication", referenceAges: [ReferenceAge.Under4] },
          { id: 'langage_2', name: "Comprendre et apprendre", referenceAges: [ReferenceAge.At4] },
          { id: 'langage_3', name: "Échanger et réfléchir avec les autres", referenceAges: [ReferenceAge.At4] },
          { id: 'langage_4', name: "Commencer à réfléchir sur la langue", referenceAges: [ReferenceAge.Over4] },
        ],
        subDomains: [],
      },
      {
        id: 'motricite',
        name: "Agir, s'exprimer, comprendre à travers l'activité physique",
        expectations: [
          "Courir, sauter, lancer de différentes façons, dans des espaces et avec des matériels variés, dans un but précis.",
          "Ajuster et enchaîner ses actions et ses déplacements en fonction d'obstacles à franchir ou de la trajectoire d'objets sur lesquels agir."
        ],
        skills: [
          { id: 'motricite_1', name: "Agir dans l'espace, dans la durée et sur les objets", referenceAges: [ReferenceAge.Under4] },
          { id: 'motricite_2', name: "Adapter ses équilibres et ses déplacements", referenceAges: [ReferenceAge.At4] },
          { id: 'motricite_3', name: "Communiquer avec les autres au travers d'actions", referenceAges: [ReferenceAge.Over4] },
          { id: 'motricite_4', name: "Collaborer, coopérer, s'opposer", referenceAges: [ReferenceAge.Over4] },
        ],
        subDomains: [],
      },
      {
        id: 'arts',
        name: "Agir, s'exprimer, comprendre à travers les activités artistiques",
        expectations: [
          "Choisir différents outils, médiums, supports en fonction d'un projet ou d'une consigne et les utiliser en adaptant son geste.",
          "Pratiquer le dessin pour représenter ou illustrer, en étant fidèle au réel ou à un modèle, ou en inventant."
        ],
        skills: [
          { id: 'arts_1', name: "Découvrir le monde du son", referenceAges: [ReferenceAge.Under4] },
          { id: 'arts_2', name: "Explorer la matière, les outils, les supports", referenceAges: [ReferenceAge.At4] },
          { id: 'arts_3', name: "Pratiquer le dessin, la peinture, le modelage", referenceAges: [ReferenceAge.At4] },
          { id: 'arts_4', name: "Jouer avec sa voix, explorer les instruments", referenceAges: [ReferenceAge.Over4] },
        ],
        subDomains: [],
      },
      {
        id: 'pensee',
        name: "Construire les premiers outils pour structurer sa pensée",
        expectations: [
          "Utiliser le nombre pour désigner une quantité, une position ou pour comparer.",
          "Classer des objets en fonction de caractéristiques liées à leur forme."
        ],
        skills: [
          { id: 'pensee_1', name: "Découvrir les nombres et leurs utilisations", referenceAges: [ReferenceAge.At4] },
          { id: 'pensee_2', name: "Explorer des formes, des grandeurs, des suites", referenceAges: [ReferenceAge.At4] },
          { id: 'pensee_3', name: "Utiliser des repères spatiaux et temporels", referenceAges: [ReferenceAge.Over4] },
          { id: 'pensee_4', name: "Raisonner et résoudre des problèmes simples", referenceAges: [ReferenceAge.Over4] },
        ],
        subDomains: [],
      },
      {
        id: 'monde',
        name: "Explorer le monde",
        expectations: [
          "Reconnaître les principales étapes du développement d'un animal ou d'un végétal, dans une situation d'observation du réel ou sur une image.",
          "Ordonner une suite de photographies ou d'images, pour rendre compte d'une situation vécue ou d'un récit fictif."
        ],
        skills: [
          { id: 'monde_1', name: "Découvrir le vivant", referenceAges: [ReferenceAge.Under4] },
          { id: 'monde_2', name: "Explorer la matière", referenceAges: [ReferenceAge.At4] },
          { id: 'monde_3', name: "Utiliser, fabriquer, manipuler des objets", referenceAges: [ReferenceAge.At4] },
          { id: 'monde_4', name: "Se questionner sur le monde qui l'entoure", referenceAges: [ReferenceAge.Over4] },
        ],
        subDomains: [],
      },
    ]
  }
];

export const PROFICIENCY_COLORS: { [key in Proficiency]: string } = {
  [Proficiency.NotAcquired]: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-300 dark:border-red-800/50',
  [Proficiency.Acquired]: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-300 dark:border-green-800/50',
};

export const REFERENCE_AGE_DOT_COLORS: { [key in ReferenceAge]: string } = {
  [ReferenceAge.Under4]: 'bg-pink-500',
  [ReferenceAge.At4]: 'bg-green-500',
  [ReferenceAge.Over4]: 'bg-blue-500',
};