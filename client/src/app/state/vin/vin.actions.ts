import { createAction, props } from "@ngrx/store";
import { VinModel } from "../../models/cellar.model";

export const loadVins = createAction("[Vin Page] Load Vins");

export const loadVinsSuccess = createAction(
  "[Vin API] Vin Load Success",
  props<{ vins: VinModel[] }>()
);

export const loadVinsFailure = createAction(
  "[Vin API] Vin Load Failure",
  props<{ error: string }>()
);

// Edit vin Action
export const editVin = createAction(
  "[Vin Page] Edit Vin",
  props<{ id: string; rev: string }>()
);

// Create actions
export const createVin = createAction(
  "[Vin Page] Create Vin",
  props<{ vin: VinModel }>()
);

export const createVinSuccess = createAction(
  "[Vin API] Vin Save Success",
  props<{ vin: VinModel; source: string }>()
);

export const createVinFailure = createAction(
  "[Vin API] Vin Save Failure",
  props<{ error: string }>()
);

// Delete actions
export const deleteVin = createAction(
  "[Vin Page] Remove Vin",
  props<{ vin: VinModel }>()
);

export const deleteVinSuccess = createAction(
  "[Vin API] Vin Delete Success",
  props<{ result: any; source: string }>()
);

export const deleteVinFailure = createAction(
  "[Vin API] Vin Delete Failure",
  props<{ error: string }>()
);

export const setStatusToLoaded = createAction(
  "[Vin API] Vin Set Status To Loaded"
);
