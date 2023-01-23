import { createSelector } from "@ngrx/store";
import { AppState } from "../app.state";
import { AppellationState } from "./appellation.reducers";
import { AppellationModel } from "../../models/cellar.model";
import dayjs from "dayjs";

export const getAppellationState = (state: AppState) => {
  return state
    ? state.appellations
    : {
        appellations: new Map(),
        error: null,
        status: "pending",
      };
};

export const getAllAppellationsArraySorted = createSelector(
  getAppellationState,
  (state: AppellationState) => {
    return state
      ? state.hasOwnProperty("appellations")
        ? Array.from(state.appellations.values()).sort((a, b) => {
            return a.courte + a.longue < b.courte + b.longue ? -1 : 1;
          })
        : new Array()
      : new Array();
  }
);

export const getTypeById = (id: string) =>
  createSelector(getAppellationState, (appellationState: AppellationState) => {
    console.log(
      "[AppellationSelector]getTypeById returned type from state : " +
        JSON.stringify(appellationState.appellations.get(id))
    );
    return appellationState.appellations.get(id);
  });
