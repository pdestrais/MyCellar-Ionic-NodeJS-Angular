import { createSelector } from "@ngrx/store";
import { AppState } from "../app.state";
import { TypeState } from "./type.reducers";
import { TypeModel } from "../../models/cellar.model";
import dayjs from "dayjs";

export const getTypeState = (state: AppState) => {
  console.log("[getTypeState]state : " + state);
  return state
    ? state.types
    : {
        types: new Map(),
        error: null,
        status: "pending",
      };
};

export const getAllTypesArraySorted = createSelector(
  getTypeState,
  (state: TypeState) => {
    console.log("[getAllTypes]state : " + state);
    return state
      ? state.hasOwnProperty("types")
        ? Array.from(state.types.values()).sort((a, b) => {
            return a.nom < b.nom ? -1 : 1;
          })
        : new Array()
      : new Array();
  }
);

export const getTypeById = (id: string) =>
  createSelector(getTypeState, (typeState: TypeState) => {
    console.log(
      "[getVinState]return wine from state : " + typeState.types.get(id)
    );
    return typeState.types.get(id);
  });
