import { createAction, props } from "@ngrx/store";
import { AppellationModel } from "../../models/cellar.model";

export const loadAppellations = createAction(
  "[Appellation Page] Load Appellations"
);

export const loadAppellationsSuccess = createAction(
  "[Appellation API] Appellation Load Success",
  props<{ appellations: AppellationModel[] }>()
);

export const loadAppellationsFailure = createAction(
  "[Appellation API] Appellation Load Failure",
  props<{ error: string }>()
);

// Edit appellation Action
export const editAppellation = createAction(
  "[Appellation Page] Edit Appellation",
  props<{ id: string; rev: string }>()
);

// Create actions
export const createAppellation = createAction(
  "[Appellation Page] Create Appellation",
  props<{ appellation: AppellationModel }>()
);

export const createAppellationSuccess = createAction(
  "[Appellation API] Appellation Save Success",
  props<{ appellation: AppellationModel; source: string }>()
);

export const createAppellationFailure = createAction(
  "[Appellation API] Appellation Save Failure",
  props<{ error: string }>()
);

// Delete actions
export const deleteAppellation = createAction(
  "[Appellation Page] Remove Appellation",
  props<{ appellation: AppellationModel }>()
);

export const deleteAppellationSuccess = createAction(
  "[Appellation API] Appellation Delete Success",
  props<{ result: any; source: string }>()
);

export const deleteAppellationFailure = createAction(
  "[Appellation API] Appellation Delete Failure",
  props<{ error: string }>()
);

export const setStatusToLoaded = createAction(
  "[Appellation API] Appellation Set Status To Loaded"
);
