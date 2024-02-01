import { createSelector } from "@ngrx/store";
import { AppState } from "../app.state";
import { AppellationState } from "./appellation.reducers";
import { AppellationModel } from "../../models/cellar.model";
import Debug from "debug";
import dayjs from "dayjs";
import { replacer } from "../../util/util";

const debug = Debug("app:state:appellationselector");

export const getAppellationState = (state: AppState): AppellationState => {
  console.log(
    "[getAppellationState]state : " +
      JSON.stringify(state.appellations, replacer)
  );
  return state
    ? state.appellations
    : {
        appellations: new Map(),
        error: null,
        status: "pending",
        eventLog: [],
        source: "",
        currentAppellation: { id: "", rev: "" },
      };
};

// export const getAppellationState = (state: AppState) => {
//   return state
//     ? state.appellations
//     : {
//         appellations: new Map(),
//         error: null,
//         status: "pending",
//         source: "",
//         eventLog: [],
//         currentAppellation: null,
//       };
// };

export const getAllAppellations = createSelector(
  getAppellationState,
  (state: AppellationState) => {
    return state && state.appellations
      ? state.appellations
      : new Map<string, AppellationModel>();
  }
);

export const getAllAppellationsArraySorted = createSelector(
  getAppellationState,
  (state: AppellationState) => {
    debug(
      "[getAllAppellationsArraySorted]state : " +
        JSON.stringify(state, replacer)
    );
    return state
      ? state.hasOwnProperty("appellations")
        ? Array.from(state.appellations.values()).sort((a, b) => {
            return a.courte + a.longue < b.courte + b.longue ? -1 : 1;
          })
        : new Array()
      : new Array();
  }
);

export const appellationMapForDuplicates = createSelector(
  getAllAppellations,
  (allAppellationMap: Map<string, AppellationModel>) => {
    const appellationMapForDuplicates = new Map<string, AppellationModel>();
    allAppellationMap.forEach((appellation) => {
      appellationMapForDuplicates.set(
        appellation.courte + appellation.longue,
        appellation
      );
    });
    return appellationMapForDuplicates;
  }
);

export const getAppellation = (id: string) =>
  createSelector(
    getAllAppellations,
    (allAppellationMap: Map<string, AppellationModel>) => {
      debug(
        "[AppellationSelector]getAppellation returned appellation from state : " +
          JSON.stringify(allAppellationMap.get(id))
      );
      return allAppellationMap.get(id);
    }
  );
