import { createSelector } from "@ngrx/store";
import { AppState } from "../app.state";
import { OrigineState } from "./origine.reducers";
import { OrigineModel } from "../../models/cellar.model";
import dayjs from "dayjs";

export const getOrigineState = (state: AppState) => {
  console.log("[getOrigineState]state : " + state);
  return state
    ? state.origines
    : {
        origines: new Map(),
        error: null,
        status: "pending",
      };
};

export const getAllOriginesArraySorted = createSelector(
  getOrigineState,
  (state: OrigineState) => {
    console.log("[getAllTypes]state : " + state);
    return state
      ? state.hasOwnProperty("origines")
        ? Array.from(state.origines.values()).sort((a, b) => {
            return a.pays + a.region < b.pays + b.region ? -1 : 1;
          })
        : new Array()
      : new Array();
  }
);

export const getTypeById = (id: string) =>
  createSelector(getOrigineState, (origineState: OrigineState) => {
    console.log(
      "[getVinState]return wine from state : " + origineState.origines.get(id)
    );
    return origineState.origines.get(id);
  });
