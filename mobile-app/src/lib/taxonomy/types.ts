export type Profession = 'physician' | 'nurse';

export type PhysicianSeniority = 'assistenzarzt' | 'facharzt' | 'oberarzt_plus';
export type NurseSeniority = 'pflegefachkraft' | 'leitung';
export type Seniority = PhysicianSeniority | NurseSeniority;

export type DepartmentGroup =
  | 'innere_medizin'
  | 'chirurgie'
  | 'anaesthesiologie_intensiv'
  | 'notaufnahme'
  | 'paediatrie'
  | 'gynaekologie_geburtshilfe'
  | 'neurologie_psychiatrie'
  | 'hno_augen_mkg'
  | 'diagnostik_radiologie'
  | 'sonstige';

export interface TaxonomyProfile {
  profession: Profession;
  seniority: Seniority;
  stateCode: string;
  departmentGroup?: DepartmentGroup;
  specializationCode?: string;
  hospitalRefId?: number;
}

export interface LabeledOption<T extends string = string> {
  value: T;
  labelEn: string;
  labelDe: string;
}

export interface StateOption {
  code: string;
  name: string;
}

export interface Hospital {
  id: number;
  name: string;
  city: string;
  state: string;
  postcode: string;
  lat: number;
  lon: number;
}
