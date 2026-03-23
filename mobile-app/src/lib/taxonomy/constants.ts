import type {
  DepartmentGroup,
  LabeledOption,
  NurseSeniority,
  PhysicianSeniority,
  Profession,
  StateOption,
} from './types';

// ---------------------------------------------------------------------------
// Level 0: Profession
// ---------------------------------------------------------------------------

export const PROFESSIONS: LabeledOption<Profession>[] = [
  { value: 'physician', labelEn: 'Physician', labelDe: 'Ärzt:in' },
  { value: 'nurse', labelEn: 'Nurse', labelDe: 'Pflegekraft' },
];

// ---------------------------------------------------------------------------
// Seniority by profession
// ---------------------------------------------------------------------------

export const PHYSICIAN_SENIORITY: LabeledOption<PhysicianSeniority>[] = [
  { value: 'assistenzarzt', labelEn: 'Resident', labelDe: 'Assistenzarzt/-ärztin' },
  { value: 'facharzt', labelEn: 'Specialist', labelDe: 'Facharzt/-ärztin' },
  { value: 'oberarzt_plus', labelEn: 'Senior Physician+', labelDe: 'Oberarzt/-ärztin+' },
];

export const NURSE_SENIORITY: LabeledOption<NurseSeniority>[] = [
  { value: 'pflegefachkraft', labelEn: 'Nurse', labelDe: 'Pflegefachkraft' },
  { value: 'leitung', labelEn: 'Management', labelDe: 'Leitung' },
];

export const SENIORITY_BY_PROFESSION: Record<Profession, LabeledOption[]> = {
  physician: PHYSICIAN_SENIORITY,
  nurse: NURSE_SENIORITY,
};

// ---------------------------------------------------------------------------
// Level 1: Department groups (10)
// ---------------------------------------------------------------------------

export const DEPARTMENT_GROUPS: LabeledOption<DepartmentGroup>[] = [
  { value: 'innere_medizin', labelEn: 'Internal Medicine', labelDe: 'Innere Medizin' },
  { value: 'chirurgie', labelEn: 'Surgery', labelDe: 'Chirurgie' },
  { value: 'anaesthesiologie_intensiv', labelEn: 'Anaesthesiology / ICU', labelDe: 'Anästhesiologie / Intensivmedizin' },
  { value: 'notaufnahme', labelEn: 'Emergency Department', labelDe: 'Notaufnahme' },
  { value: 'paediatrie', labelEn: 'Paediatrics', labelDe: 'Pädiatrie' },
  { value: 'gynaekologie_geburtshilfe', labelEn: 'Gynaecology / Obstetrics', labelDe: 'Gynäkologie / Geburtshilfe' },
  { value: 'neurologie_psychiatrie', labelEn: 'Neurology / Psychiatry', labelDe: 'Neurologie / Psychiatrie' },
  { value: 'hno_augen_mkg', labelEn: 'ENT / Ophthalmology / Maxillofacial', labelDe: 'HNO / Augen / MKG' },
  { value: 'diagnostik_radiologie', labelEn: 'Diagnostics / Radiology', labelDe: 'Diagnostik / Radiologie' },
  { value: 'sonstige', labelEn: 'Other', labelDe: 'Sonstige' },
];

// ---------------------------------------------------------------------------
// German federal states (16 Bundesländer)
// ---------------------------------------------------------------------------

export const GERMAN_STATES: StateOption[] = [
  { code: 'BW', name: 'Baden-Württemberg' },
  { code: 'BY', name: 'Bayern' },
  { code: 'BE', name: 'Berlin' },
  { code: 'BB', name: 'Brandenburg' },
  { code: 'HB', name: 'Bremen' },
  { code: 'HH', name: 'Hamburg' },
  { code: 'HE', name: 'Hessen' },
  { code: 'MV', name: 'Mecklenburg-Vorpommern' },
  { code: 'NI', name: 'Niedersachsen' },
  { code: 'NW', name: 'Nordrhein-Westfalen' },
  { code: 'RP', name: 'Rheinland-Pfalz' },
  { code: 'SL', name: 'Saarland' },
  { code: 'SN', name: 'Sachsen' },
  { code: 'ST', name: 'Sachsen-Anhalt' },
  { code: 'SH', name: 'Schleswig-Holstein' },
  { code: 'TH', name: 'Thüringen' },
];
