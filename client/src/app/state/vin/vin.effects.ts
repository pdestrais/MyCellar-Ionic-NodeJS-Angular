import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import * as VinAction from "./vin.actions";
import { PouchdbService } from "../../services/pouchdb.service";
import { of, from, pipe } from "rxjs";
import { switchMap, map, catchError, exhaustMap, tap } from "rxjs/operators";
import { Store } from "@ngrx/store";
import { VinModel } from "../../models/cellar.model";

import { AppState } from "../app.state";

import Debug from "debug";

const debug = Debug("app:state:vineffect");

export interface IResult {
  ok?: boolean;
  id: string;
  rev: string;
}
@Injectable()
export class VinEffects {
  constructor(
    private actions$: Actions,
    private store: Store<AppState>,
    private pouchService: PouchdbService
  ) {}

  // Run this code when a loadVins action is dispatched
  loadVins$ = createEffect(() =>
    this.actions$.pipe(
      ofType(VinAction.loadVins),
      switchMap(() =>
        // Call the getVins method, convert it to an observable
        from(this.pouchService.getDocsOfType$("vin")).pipe(
          // Take the returned value and return a new success action containing the Vins
          map((vins: VinModel[]) => VinAction.loadVinsSuccess({ vins: vins })),
          // Or... if it errors return a new failure action containing the error
          catchError((error) => of(VinAction.loadVinsFailure({ error })))
        )
      )
    )
  );

  // Run this code when the createVin action is dispatched
  // saveVin$ = createEffect(
  //   () =>
  //     this.actions$.pipe(
  //       ofType(VinAction.createVin),
  //       exhaustMap((action) => {
  //         //        this.lastSavedWine = action.vin;

  //         // Quelque chose ne va pas avec ce code. Probablement le of(...)
  //         return of(
  //           this.pouchService.saveDoc(Object.assign({}, action.vin), "vin")
  //         ).pipe(
  //           map((result: IResult) => {
  //             console.log(
  //               "Wine created with id : " + result.id + " & rev : " + result.rev
  //             );
  //             // result.id et .rev sont undefined.
  //             return VinAction.createVinSuccess({
  //               vin: { ...action.vin, _id: result.id, _rev: result.rev },
  //               source: "internal",
  //             });
  //           }),
  //           catchError((error) => of(VinAction.createVinFailure({ error })))
  //         );
  //       })
  //     ),

  //   // Most effects dispatch another action, but this one is just a "fire and forget" effect
  //   { dispatch: true }
  // );

  // Run this code when the createVin action is dispatched
  saveVinNew$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(VinAction.createVin),
        exhaustMap((action) =>
          // Quelque chose ne va pas avec ce code. Probablement le of(...)

          this.pouchService.saveDoc$(Object.assign({}, action.vin), "vin").pipe(
            map((result: IResult) => {
              debug(
                "[saveVin Effect]ts: " +
                  window.performance.now() +
                  "\n - New Wine created with id : " +
                  result.id +
                  " & rev : " +
                  result.rev
              );
              // result.id et .rev sont undefined.
              return VinAction.createVinSuccess({
                vin: { ...action.vin, _id: result.id, _rev: result.rev },
                source: "internal",
              });
            }),
            catchError((error) => of(VinAction.createVinFailure({ error })))
          )
        )
      ),

    // Most effects dispatch another action, but this one is just a "fire and forget" effect
    { dispatch: true }
  );

  // Run this code when the deleteVin action is dispatched
  removeVin$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(VinAction.deleteVin),
        exhaustMap((action) =>
          this.pouchService.deleteDoc$(action.vin).pipe(
            // Take the returned value and return a new success action containing the saved wine (with it's id)
            map((deleteResult: IResult) => {
              debug(
                "[deleteVin Effect]ts: " +
                  window.performance.now() +
                  "\n - Wine deleted with id : " +
                  action.vin._id
              );
              return VinAction.deleteVinSuccess({
                result: deleteResult,
                source: "internal",
              });
            }),
            // Or... if it errors return a new failure action containing the error
            catchError((error) => of(VinAction.deleteVinFailure({ error })))
          )
        )
      ),
    // Most effects dispatch another action, but this one is just a "fire and forget" effect
    { dispatch: true }
  );

  // This code is executed when a change is detected on the local PouchDB instance (resulting from a replication with the remote couchDB)
  handleChanges$ = createEffect(
    () =>
      this.pouchService.dbChanges$.pipe(
        tap((change) =>
          debug(
            "[handleChanges Effect]ts: " +
              window.performance.now() +
              "\n - change : " +
              JSON.stringify(change)
          )
        ),
        map((change) => {
          if (!change.deleted) {
            return VinAction.createVinSuccess({
              vin: change.doc,
              source: "external",
            });
          } else
            return VinAction.deleteVinSuccess({
              result: change,
              source: "external",
            });
        })
      ),
    { dispatch: true }
  );
}
