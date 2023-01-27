import { createAction, props } from "@ngrx/store";
import { TypeModel } from "../../models/cellar.model";

export const loadTypes = createAction("[Type Page] Load Types");

export const loadTypesSuccess = createAction(
  "[Type API] Type Load Success",
  props<{ types: TypeModel[] }>()
);

export const loadTypesFailure = createAction(
  "[Type API] Type Load Failure",
  props<{ error: string }>()
);

// Edit type Action
export const editType = createAction(
  "[Type Page] Edit Type",
  props<{ id: string; rev: string }>()
);

// Create actions
export const createType = createAction(
  "[Type Page] Create Type",
  props<{ _type: TypeModel }>()
);

export const createTypeSuccess = createAction(
  "[Type API] Type Save Success",
  props<{ _type: TypeModel; source: string }>()
);

export const createTypeFailure = createAction(
  "[Type API] Type Save Failure",
  props<{ error: string }>()
);

// Delete actions
export const deleteType = createAction(
  "[Type Page] Remove Type",
  props<{ _type: TypeModel }>()
);

export const deleteTypeSuccess = createAction(
  "[Type API] Type Delete Success",
  props<{ result: any; source: string }>()
);

export const deleteTypeFailure = createAction(
  "[Type API] Type Delete Failure",
  props<{ error: string }>()
);

export const setStatusToLoaded = createAction(
  "[Type API] Type Set Status To Loaded"
);
