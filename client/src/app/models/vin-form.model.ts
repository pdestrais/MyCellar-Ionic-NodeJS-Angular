import { TypeModel, OrigineModel, AppellationModel } from './cellar.model';

/**
 * Form model for wine (vin) editing
 * This represents the data structure used in the form,
 * which may differ from the domain model (VinModel)
 */
export interface VinFormModel {
  // Required fields
  nom: string;
  annee: number;
  type: TypeModel;
  origine: OrigineModel;
  appellation: AppellationModel;
  nbreBouteillesAchat: number;
  nbreBouteillesReste: number;
  
  // Optional fields with defaults
  prixAchat: number;
  dateAchat: string;
  localisation: string;
  contenance: string;
  apogee: string;
  cepage: string;
  rating: number;
}

/**
 * Empty form model for initialization
 * All fields have safe default values
 */
export const EMPTY_VIN_FORM_MODEL: VinFormModel = {
  nom: '',
  annee: new Date().getFullYear(),
  type: { _id: '', nom: '' } as TypeModel,
  origine: { _id: '', pays: '', region: '' } as OrigineModel,
  appellation: { _id: '', courte: '', longue: '' } as AppellationModel,
  nbreBouteillesAchat: 0,
  nbreBouteillesReste: 0,
  prixAchat: 0,
  dateAchat: '',
  localisation: '',
  contenance: '75',
  apogee: '',
  cepage: '',
  rating: 0
};

// Made with Bob
