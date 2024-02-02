import { TranslateService } from "@ngx-translate/core";
import { Component, OnInit } from "@angular/core";
import { NavController, AlertController } from "@ionic/angular/standalone";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { OrigineModel, VinModel } from "../models/cellar.model";
import { ToastController } from "@ionic/angular/standalone";
import { ActivatedRoute } from "@angular/router";

import { Store } from "@ngrx/store";
import * as OrigineSelectors from "../state/origine/origine.selectors";
import * as VinSelectors from "../state/vin/vin.selectors";
import * as OrigineActions from "../state/origine/origine.actions";
import { Observable, Subject } from "rxjs";
import { flatMap, takeUntil, tap } from "rxjs/operators";
import { AppState } from "../state/app.state";

import { replacer } from "../util/util";

import * as Debugger from "debug";
import { addIcons } from "ionicons";
import { caretForwardOutline } from "ionicons/icons";

const debug = Debugger("app:region");

@Component({
  selector: "app-region",
  templateUrl: "./region.page.html",
  styleUrls: ["./region.page.scss"],
})
export class RegionPage implements OnInit {
  public origine: OrigineModel = new OrigineModel({
    _id: "",
    pays: "",
    region: "",
  });
  public origines$!: Observable<OrigineModel[]>;
  private unsubscribe$ = new Subject<void>();
  public winesForOrigine$!: Observable<VinModel[]>;

  public origineList: Array<OrigineModel> = [];
  public originesMap: Map<any, any> = new Map<any, any>();
  public submitted: boolean = false;
  public origineForm!: FormGroup;
  public list: boolean = true;
  public showWines: boolean = false;
  public newOrigine: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private formBuilder: FormBuilder,
    private translate: TranslateService,
    private alertController: AlertController,
    private toastCtrl: ToastController,
    private store: Store<AppState>
  ) {
    addIcons({ caretForwardOutline });
  }

  public ngOnInit() {
    debug("[ngOnInit]called");
    // form initialization
    this.origineForm = this.formBuilder.group(
      {
        pays: ["", Validators.required],
        region: ["", Validators.required],
      },
      { validator: this.noDouble.bind(this) }
    );
    this.submitted = false;
    this.route.snapshot.data["action"] == "list"
      ? (this.list = true)
      : (this.list = false);
    // We need to load the origine list even if we create or modify an origine because in this case we need the origine list to check for doubles
    this.origines$ = this.store
      .select(OrigineSelectors.getAllOriginesArraySorted)
      .pipe(takeUntil(this.unsubscribe$));
    // loading origines map from state (used for double check)
    this.store
      .select(OrigineSelectors.origineMapForDuplicates)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((originesMap) => (this.originesMap = originesMap));
    // Now loading selected wine from the state
    // if id param is there, the origine will be loaded, if not, we want to create a new origine and the form values will remain as initialized
    this.store
      .select(
        OrigineSelectors.getOrigine(this.route.snapshot.paramMap.get("id")!)
      )
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((origine) => {
        if (origine) {
          this.list = false;
          this.origine = origine;
          this.newOrigine = false;
          // We have selected an origine
          // reset VinState status to avoid shadow UI messages coming from previous updates on other app instances
          this.store.dispatch(
            OrigineActions.editOrigine({
              id: origine._id!,
              rev: origine._rev!,
            })
          );
          this.origineForm.get("pays")!.setValue(origine.pays);
          this.origineForm.get("region")!.setValue(origine.region);
          debug("[Vin.ngOnInit]Origine loaded : " + JSON.stringify(origine));
        } else {
          // No wine was selected, when will register a new origine
          this.newOrigine = true;
          this.store.dispatch(OrigineActions.editOrigine({ id: "", rev: "" }));
        }
      });

    this.winesForOrigine$ = this.store
      .select(VinSelectors.getWinesByOrigine(this.origine._id))
      .pipe(takeUntil(this.unsubscribe$));

    // Handling state changes (originating from save, update or delete operations in the UI but also coming for synchronization with data from other application instances)
    this.store
      .select((state: AppState) => state.origines)
      .pipe(
        takeUntil(this.unsubscribe$)
        /*         tap((origineState) =>
                  debug(
                    "[ngOnInit]handle origineState Changes - ts " +
                      window.performance.now() +
                      "\norigineState : " +
                      JSON.stringify(origineState, replacer)
                  )
                )
         */
      )
      .subscribe((origineState) => {
        switch (origineState.status) {
          case "saved":
            debug(
              "[ngOnInit] handling change to 'saved' status - ts " +
                window.performance.now() +
                "\norigineState : " +
                JSON.stringify(origineState, replacer)
            );

            // if we get an event that a wine is saved. We need to check it's id and
            // if the event source is internal (saved within this instance of the application) or external.
            // - (I) internal ? => (wine is saved in the application) a confirmation message is shown to the user and the app goes to the home scree
            // - (II) external ?
            //       - (A) event comes from the local DB resulting from the update of the wine we just saved
            //       - (B) event comes from the remoteDB resulting from the update of a wine ( not the one we are working on or having been working on)
            //       - (C) event coming from the remoteDB resulting from the update of the wine we are working on. (concurrent updata)
            if (origineState.source == "internal") {
              debug("[ngInit](I) Standard wine saved");
              // Internal event
              this.presentToast(
                this.translate.instant("general.dataSaved"),
                "success",
                "home",
                2000
              );
              this.store.dispatch(OrigineActions.setStatusToLoaded());
            } else {
              // let's try to find a duplicate event in the eventLog
              let filteredEventLog = origineState.eventLog.filter(
                (value) =>
                  value.id == origineState.currentOrigine!.id &&
                  value.rev == origineState.currentOrigine!.rev &&
                  value.action == "create"
              );
              debug(
                "[ngInit](II) FilteredEventLog : " +
                  JSON.stringify(filteredEventLog)
              );
              if (filteredEventLog.length == 2) {
                debug(
                  "[ngInit](II.A) Duplicate state change for the same wine"
                );
                this.store.dispatch(OrigineActions.setStatusToLoaded());
              } else if (
                origineState.eventLog[origineState.eventLog.length - 1].id ==
                  origineState.currentOrigine!.id &&
                origineState.eventLog[origineState.eventLog.length - 1].rev ==
                  origineState.currentOrigine!.rev &&
                origineState.eventLog[origineState.eventLog.length - 1]
                  .action == "create" &&
                this.origineForm.dirty // otherwize, there is no way to make the distinction when you open a brand new editing form for a wine that has been created in another application instance
              ) {
                // Event showing concurrent editing on the same wine that was saved somewhere else
                debug("[ngInit](II.C) Concurrent editing on the same wine");
                this.presentToast(
                  this.translate.instant(
                    "wine.savedConcurrentlyOnAnotherInstance"
                  ),
                  "warning",
                  "",
                  0,
                  "Close"
                );
              } else {
                debug("[ngInit](II.B) Update of another wine");
              }
            }
            break;
          case "error":
            this.presentToast(
              this.translate.instant("general.DBError") +
                " " +
                origineState.error,
              "error",
              null,
              5000
            );
            break;
          case "deleted":
            // if we get an event that an origine is saved. We need to check it's id and
            // if the event source is internal (saved within this instance of the application) or external.
            // - (I) internal ? => (origine is saved in the application) a confirmation message is shown to the user and the app goes to the home scree
            // - (II) external ?
            //       - (A) event comes from the local DB resulting from the update of the wine we just saved
            //       - (B) event comes from the remoteDB resulting from the update of a wine ( not the one we are working on or having been working on)
            //       - (C) event coming from the remoteDB resulting from the update of the wine we are working on. (concurrent updata)
            // Delete does not suppress a doc or it's revision. It just creates a new document (with a new revision) that has the "_delete" attribute set to true
            if (origineState.source == "internal") {
              debug("[ngInit](I) Standard wine deleted");
              // Internal event
              this.presentToast(
                this.translate.instant("wine.wineDeleted"),
                "success",
                "home",
                2000
              );
              this.store.dispatch(OrigineActions.setStatusToLoaded());
            } else {
              // let's try to find a duplicate event in the eventLog
              // this should never happen for a delete
              if (
                origineState.eventLog.filter(
                  (value) =>
                    value.id == origineState.currentOrigine!.id &&
                    value.rev >= origineState.currentOrigine!.rev &&
                    value.action == "delete"
                ).length == 2
              ) {
                debug(
                  "[ngInit](II.A) Duplicate state change for the same wine"
                );
                this.store.dispatch(OrigineActions.setStatusToLoaded());
              } else if (
                origineState.eventLog[origineState.eventLog.length - 1].id ==
                  origineState.currentOrigine!.id &&
                origineState.eventLog[origineState.eventLog.length - 1]
                  .action == "delete"
              ) {
                // Event showing concurrent editing on the same wine that was saved somewhere else
                debug("[ngInit](II.C) Concurrent editing on the same wine");
                this.presentToast(
                  this.translate.instant(
                    "wine.deletedConcurrentlyOnAnotherInstance"
                  ),
                  "warning",
                  "home",
                  0,
                  "Close"
                );
              } else {
                debug("[ngInit](II.B) Delete of another wine");
              }
            }
            break;
        }
      });
  }

  public ngOnDestroy() {
    debug("[Origine.ngOnDestroy]called");
    // Unscubribe all observers
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  private noDouble(group: FormGroup) {
    debug("[noDouble] called");
    if (
      !group.controls["pays"] ||
      !group.controls["region"] ||
      !group.controls["pays"].dirty ||
      !group.controls["region"].dirty
    )
      return null;
    if (
      this.originesMap &&
      this.originesMap.has(group.value.pays + group.value.region)
    ) {
      debug("[noDouble]double detected");
      return { double: true };
    } else return null;
  }

  public editOrigine(origine) {
    if (origine._id) this.navCtrl.navigateForward(["/region", origine._id]);
    else this.navCtrl.navigateForward(["/region"]);
  }

  public saveOrigine() {
    debug("[saveOrigine]entering");
    this.submitted = true;
    if (this.origineForm.valid) {
      // validation succeeded
      debug("[OrigineVin]Origine valid");
      // when the vin has been loaded from the store, it is immutable, we need to deep copy it before being able to update its properties
      let mutableOrigine = JSON.parse(JSON.stringify(this.origine));
      // now combine the loaded wine data with the new form data
      this.origine = {
        ...mutableOrigine,
        ...this.origineForm.value,
      };

      this.store.dispatch(
        OrigineActions.createOrigine({ origine: this.origine })
      );
    } else {
      debug("[Vin - saveVin]vin invalid");
      this.presentToast(
        this.translate.instant("general.invalidData"),
        "error",
        null
      );
    }
  }

  public deleteOrigine() {
    // Before deleting an origine, we need to check if this origine is not used for any of the wines.
    // If it is used, it can't be deleted.
    let used = false;
    this.winesForOrigine$.subscribe((wineListForOrigine) =>
      wineListForOrigine.length > 0 ? (used = true) : (used = false)
    );
    if (!used) {
      this.alertController
        .create({
          header: this.translate.instant("general.confirm"),
          message: this.translate.instant("general.sure"),
          buttons: [
            {
              text: this.translate.instant("general.cancel"),
            },
            {
              text: this.translate.instant("general.ok"),
              handler: () => {
                this.store.dispatch(
                  OrigineActions.deleteOrigine({
                    origine: this.origine,
                  })
                );
              },
            },
          ],
        })
        .then((alert) => {
          alert.present();
        });
    } else {
      this.presentToast(
        this.translate.instant("origine.cantDeleteBecauseUsed"),
        "error",
        null
      );
    }
  }

  async presentToast(
    message: string,
    type: string,
    nextPageUrl: string | null,
    duration?: number,
    closeButtonText?: string
  ) {
    if (duration && duration != 0) {
      const toast = await this.toastCtrl.create({
        color:
          type == "success"
            ? "secondary"
            : type == "warning"
            ? "warning"
            : "danger",
        message: message,
        duration: duration ? duration : 2000,
      });
      toast.present();
      if (nextPageUrl) this.navCtrl.navigateRoot(nextPageUrl);
    } else {
      const toast = await this.toastCtrl.create({
        color:
          type == "success"
            ? "secondary"
            : type == "warning"
            ? "warning"
            : "danger",
        message: message,
        buttons: [
          {
            text: closeButtonText,
            role: "cancel",
            handler: () => {
              if (nextPageUrl) this.navCtrl.navigateRoot(nextPageUrl);
            },
          },
        ],
      });
      toast.present();
    }
  }
}
