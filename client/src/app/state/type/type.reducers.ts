import { createReducer, on } from "@ngrx/store";
import * as TypeAction from "./type.actions";
import { TypeModel } from "../../models/cellar.model";

export interface TypeState {
  // types is a Map with type._id as as key and type as value
  types: Map<string, TypeModel>;
  error: string | null;
  status:
    | "pending"
    | "loading"
    | "error"
    | "success save"
    | "success delete"
    | "success";
  source: string;
}

export const initialState: TypeState = {
  types: new Map(),
  error: null,
  status: null,
  source: "",
};

export const typeReducer = createReducer(
  // Supply the initial state
  initialState,
  // Trigger loading the wines
  on(TypeAction.loadTypes, (state) => {
    return { ...state, status: "loading" };
  }),
  // Handle successfully loaded wines
  on(TypeAction.loadTypesSuccess, (state, { types }) => ({
    ...state,
    types: new Map(types.map((obj: TypeModel) => [obj._id, obj])),
    error: null,
    status: "success",
  })),
  // Handle wines load failure
  on(TypeAction.loadTypesFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  // Set pending while wine is added
  on(TypeAction.createType, (state, { type }) => {
    return { ...state, status: "pending" };
  }),
  // Add the new wine to the wines array
  on(TypeAction.createTypeSuccess, (state, { _type, source }) => {
    var newMap = new Map(state.types);
    newMap.set(_type._id, _type);
    return {
      ...state,
      status: "success save",
      error: "null",
      types: newMap,
      source: source,
    };
  }),
  // handle wine save failure
  on(TypeAction.createTypeFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  })),
  // Set pending while wine is deleted
  on(TypeAction.deleteType, (state, { type }) => ({
    ...state,
    status: "pending",
  })),
  // add created wine to wines state
  on(TypeAction.deleteTypeSuccess, (state, { result, source }) => {
    var newMap = new Map(state.types);
    newMap.delete(result.id);
    //newMap[result.id] = undefined;
    return {
      ...state,
      status: "success delete",
      error: "null",
      types: newMap,
      source: source,
    };
  }),
  // handle wine save failure
  on(TypeAction.createTypeFailure, (state, { error }) => ({
    ...state,
    error: error,
    status: "error",
  }))
);
