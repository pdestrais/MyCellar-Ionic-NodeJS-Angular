import { createSelector } from "@ngrx/store";
import { AppState } from "../app.state";
import { OrigineState } from "./origine.reducers";
import { OrigineModel } from "../../models/cellar.model";
import Debug from "debug";
import dayjs from "dayjs";
import { replacer } from "../../util/util";

const debug = Debug("app:state:origineselector");

export const getOrigineState = (state: AppState): OrigineState => {
  return state
    ? state.origines
    : {
        origines: new Map(),
        error: null,
        status: "pending",
        source: "",
        eventLog: [],
        currentOrigine: null,
      };
};

export const getAllOrigines = createSelector(
  getOrigineState,
  (state: OrigineState) => {
    return state
      ? state.hasOwnProperty("origines")
        ? state.origines
        : new Map()
      : new Map();
  }
);

export const getAllOriginesArraySorted = createSelector(
  getOrigineState,
  (state: OrigineState) => {
    debug("[getAllOrigines]state : " + JSON.stringify(state, replacer));
    debug(
      "[getAllOrigines]origine list : " +
        JSON.stringify(Array.from(state.origines.entries()))
    );
    return state
      ? state.hasOwnProperty("origines")
        ? Array.from(state.origines.values()).sort((a, b) => {
            return a.pays + a.region < b.pays + b.region ? -1 : 1;
          })
        : new Array()
      : new Array();
  }
);

export const origineMapForDuplicates = createSelector(
  getAllOrigines,
  (allOrigineMap: Map<string, OrigineModel>) => {
    const origineMapForDuplicates = new Map<string, OrigineModel>();
    allOrigineMap.forEach((origine) => {
      origineMapForDuplicates.set(origine.pays + origine.region, origine);
    });
    return origineMapForDuplicates;
  }
);

export const getOrigine = (id: string) =>
  createSelector(getAllOrigines, (allOrigineMap: Map<string, OrigineModel>) => {
    debug(
      "[OrigineSelector]getOrigine returned origine from state : " +
        JSON.stringify(allOrigineMap.get(id))
    );
    return allOrigineMap.get(id);
  });
