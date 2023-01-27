import { createAction, props } from "@ngrx/store";
import { OrigineModel } from "../../models/cellar.model";

export const loadOrigines = createAction("[Origine Page] Load Origines");

export const loadOriginesSuccess = createAction(
  "[Origine API] Origine Load Success",
  props<{ origines: OrigineModel[] }>()
);

export const loadOriginesFailure = createAction(
  "[Origine API] Origine Load Failure",
  props<{ error: string }>()
);

// Edit origine Action
export const editOrigine = createAction(
  "[Origine Page] Edit Origine",
  props<{ id: string; rev: string }>()
);

// Create actions
export const createOrigine = createAction(
  "[Origine Page] Create Origine",
  props<{ origine: OrigineModel }>()
);

export const createOrigineSuccess = createAction(
  "[Origine API] Origine Save Success",
  props<{ origine: OrigineModel; source: string }>()
);

export const createOrigineFailure = createAction(
  "[Origine API] Origine Save Failure",
  props<{ error: string }>()
);

// Delete actions
export const deleteOrigine = createAction(
  "[Origine Page] Remove Origine",
  props<{ origine: OrigineModel }>()
);

export const deleteOrigineSuccess = createAction(
  "[Origine API] Origine Delete Success",
  props<{ result: any; source: string }>()
);

export const deleteOrigineFailure = createAction(
  "[Origine API] Origine Delete Failure",
  props<{ error: string }>()
);

export const setStatusToLoaded = createAction(
  "[Origine API] Origine Set Status To Loaded"
);
