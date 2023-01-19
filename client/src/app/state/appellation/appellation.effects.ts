import { Injectable } from "@angular/core";
import { Actions, createEffect, ofType } from "@ngrx/effects";
import * as AppellationAction from "./appellation.actions";
import { PouchdbService } from "../../services/pouchdb.service";
import { of, from, pipe } from "rxjs";
import { switchMap, map, catchError, exhaustMap, tap } from "rxjs/operators";
import { Store } from "@ngrx/store";
//import { selectAllAppellations } from "./Appellation.selectors";
import { AppellationModel } from "../../models/cellar.model";

import { AppState } from "../app.state";

@Injectable()
export class AppellationEffects {
  //  private lastSavedWine: AppellationModel = null;

  constructor(
    private actions$: Actions,
    private store: Store<AppState>,
    private pouchService: PouchdbService
  ) {}

  // Run this code when a loadAppellations action is dispatched
  loadAppellations$ = createEffect(() =>
    this.actions$.pipe(
      ofType(AppellationAction.loadAppellations),
      switchMap(() =>
        // Call the getAppellations method, convert it to an observable
        from(this.pouchService.getDocsOfType("appellation")).pipe(
          // Take the returned value and return a new success action containing the Appellations
          map((appellations: AppellationModel[]) =>
            AppellationAction.loadAppellationsSuccess({
              appellations: appellations,
            })
          ),
          // Or... if it errors return a new failure action containing the error
          catchError((error) =>
            of(AppellationAction.loadAppellationsFailure({ error }))
          )
        )
      )
    )
  );

  // Run this code when the createAppellation action is dispatched
  saveAppellation$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppellationAction.createAppellation),
        switchMap((action) => {
          //        this.lastSavedWine = action.appellation;
          return from(
            this.pouchService.saveDoc(
              Object.assign({}, action.appellation),
              "appellation"
            )
          ).pipe(
            map((appellation: AppellationModel) => {
              return AppellationAction.createAppellationSuccess({
                appellation: { ...action.appellation, _id: appellation.id },
                source: "internal",
              });
            }),
            catchError((error) =>
              of(AppellationAction.createAppellationFailure({ error }))
            )
          );
        })
        /*        exhaustMap((action) =>
          from(
            this.pouchService.saveDoc(Object.assign({}, action.appellation), "appellation")
          ).pipe(
            // Take the returned value and return a new success action containing the saved wine (with it's id)
            map((appellation: AppellationModel) => {
              console.log("[saveAppellation$ Effect]" + JSON.stringify(appellation));
              AppellationAction.createAppellationSuccess({ appellation: appellation });
            }),
            // Or... if it errors return a new failure action containing the error
            catchError((error) => of(AppellationAction.createAppellationFailure({ error })))
          )
        )
*/
      ),

    // Most effects dispatch another action, but this one is just a "fire and forget" effect
    { dispatch: true }
  );

  // Run this code when the deleteAppellation action is dispatched
  removeAppellation$ = createEffect(
    () =>
      this.actions$.pipe(
        ofType(AppellationAction.deleteAppellation),
        exhaustMap((action) =>
          from(this.pouchService.deleteDoc(action.appellation)).pipe(
            // Take the returned value and return a new success action containing the saved wine (with it's id)
            map((deleteResult) =>
              AppellationAction.deleteAppellationSuccess({
                result: deleteResult,
                source: "internal",
              })
            ),
            // Or... if it errors return a new failure action containing the error
            catchError((error) =>
              of(AppellationAction.deleteAppellationFailure({ error }))
            )
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
        tap((change) => console.log("[Effect]" + change)),
        map((change) => {
          if (!change.deleted) {
            //this.lastSavedWine = null;
            return AppellationAction.createAppellationSuccess({
              appellation: change.doc,
              source: "external",
            });
          } else
            return AppellationAction.deleteAppellationSuccess({
              result: change,
              source: "external",
            });
        })
      ),
    // Most effects dispatch another action, but this one is just a "fire and forget" effect
    { dispatch: true }
  );
}
