import { createSelector } from "@ngrx/store";
import { AppState } from "../app.state";
import { VinState } from "./vin.reducers";
import { VinModel } from "../../models/cellar.model";
import dayjs from "dayjs";

export const getVinState = (state: AppState): VinState => {
  return state
    ? state.vins
    : {
      vins: new Map(),
      error: null,
      status: "pending",
      source: "",
      eventLog: [],
      currentWine: { id: "", rev: "" },
    };
};
export const getAllVins = createSelector(getVinState, (state: VinState) => {
  return state && state.vins ? state.vins : new Map<string, VinModel>();
});

export const vinMapForDuplicates = createSelector(
  getAllVins,
  (allVinMap: Map<string, VinModel>) => {
    const vinMapForDuplicates = new Map<string, VinModel>();
    allVinMap.forEach((vin) => {
      vinMapForDuplicates.set(vin.nom + vin.annee, vin);
    });
    return vinMapForDuplicates;
  }
);

export const getWinesMaturity = (category: string) =>
  createSelector(getAllVins, (allVinMap: Map<string, VinModel>) => {
    let MaturityList: Array<VinModel> = [];

    let now = dayjs();
    allVinMap.forEach((v: any, k) => {
      if (v.apogee && v.nbreBouteillesReste > 0) {
        let drinkFromTo = v.apogee.split("-");
        let apogeeTo = drinkFromTo[1];
        let apogeeFrom = drinkFromTo[0];
        /* apogee :                 FROM-2          FROM            TO            */
        /*             <----NotRTD ---|--NearlyRTD---|-----RTD------|----ARTD---> */
        switch (category) {
          case "ARTD":
            if (now.year() - apogeeTo >= 0) {
              MaturityList.push(v);
            }
            break;
          case "RTD":
            if (now.year() <= apogeeTo && now.year() > apogeeFrom) {
              MaturityList.push(v);
            }
            break;
          case "NRTD":
            if (now.year() > apogeeFrom - 2 && now.year() <= apogeeFrom) {
              MaturityList.push(v);
            }
            break;
          default:
            MaturityList.push(v);
        }
      }
    });
    return MaturityList.sort((a, b) =>
      a.annee + a.nom < b.annee + b.nom ? -1 : 1
    );
  });

export const getFilteredWines = (searchTerm: string, isInStock: boolean) =>
  createSelector(getAllVins, (allVinMap: Map<string, VinModel>) => {
    let filteredList = Array.from(allVinMap.values());
    return filteredList
      .filter((item) => {
        if (isInStock)
          return (
            item.nom.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1 &&
            item.nbreBouteillesReste > 0 &&
            searchTerm.length > 2
          );
        else
          return (
            item.nom.toLowerCase().indexOf(searchTerm.toLowerCase()) > -1 &&
            searchTerm.length > 2
          );
      })
      .sort((a, b) => (a.nom + a.annee < b.nom + b.annee ? -1 : 1));
  });

export const getWinesByAppellation = (appellationId: string) =>
  createSelector(getAllVins, (allVinMap: Map<string, VinModel>) => {
    let filteredList = Array.from(allVinMap.values());
    return filteredList
      .filter((item) => item.appellation._id == appellationId)
      .sort((a, b) => (a.nom + a.annee < b.nom + b.annee ? -1 : 1));
  });

export const getWinesByOrigine = (origineId: string) =>
  createSelector(getAllVins, (allVinMap: Map<string, VinModel>) => {
    let filteredList = Array.from(allVinMap.values());
    return filteredList
      .filter((item) => item.origine._id == origineId)
      .sort((a, b) => (a.nom + a.annee < b.nom + b.annee ? -1 : 1));
  });

export const getWinesByType = (typeId: string) =>
  createSelector(getAllVins, (allVinMap: Map<string, VinModel>) => {
    let filteredList = Array.from(allVinMap.values());
    return filteredList
      .filter((item) => item.type._id == typeId)
      .sort((a, b) => (a.nom + a.annee < b.nom + b.annee ? -1 : 1));
  });

export const getWine = (id: string) =>
  createSelector(getAllVins, (allVinMap: Map<string, VinModel>) => {
    console.log(
      "[VinSelector]getWine returned wine from state : " +
      JSON.stringify(allVinMap.get(id))
    );
    return allVinMap.get(id);
  });
