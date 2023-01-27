import { createSelector } from "@ngrx/store";
import { AppState } from "../app.state";
import { TypeState } from "./type.reducers";
import { TypeModel } from "../../models/cellar.model";
import Debug from "debug";
import dayjs from "dayjs";
import { replacer } from "../../util/util";

const debug = Debug("app:state:typeselector");

export const getTypeState = (state: AppState) => {
  console.log("[getTypeState]state : " + JSON.stringify(state.types, replacer));
  return state
    ? state.types
    : {
        types: new Map(),
        error: null,
        status: "pending",
      };
};

export const getAllTypes = createSelector(getTypeState, (state: TypeState) => {
  console.log("[getAllTypes]state : " + JSON.stringify(state, replacer));
  return state
    ? state.hasOwnProperty("types")
      ? state.types
      : new Array()
    : new Array();
});

export const getAllTypesArraySorted = createSelector(
  getTypeState,
  (state: TypeState) => {
    debug("[getAllTypesArraySorted]state : " + JSON.stringify(state, replacer));
    return state
      ? state.hasOwnProperty("types")
        ? Array.from(state.types.values()).sort((a, b) => {
            return a.nom < b.nom ? -1 : 1;
          })
        : new Array()
      : new Array();
  }
);

export const typeMapForDuplicates = createSelector(
  getAllTypes,
  (allTypeMap: Map<string, TypeModel>) => {
    debug(
      "[typeMapForDuplicates]state : " + JSON.stringify(allTypeMap, replacer)
    );

    const typeMapForDuplicates = new Map<string, TypeModel>();
    allTypeMap.forEach((type) => {
      typeMapForDuplicates.set(type.nom, type);
    });
    debug(
      "[typeMapForDuplicates]returns : " +
        JSON.stringify(typeMapForDuplicates, replacer)
    );
    return typeMapForDuplicates;
  }
);

export const getType = (id: string) =>
  createSelector(getAllTypes, (allTypeMap: Map<string, TypeModel>) => {
    debug(
      "[TypeSelector]getType returned type from state : " +
        JSON.stringify(allTypeMap.get(id)) +
        "for id : " +
        id
    );
    return allTypeMap.get(id);
  });
