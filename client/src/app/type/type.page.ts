import { TranslateService } from "@ngx-translate/core";
import { Component, OnInit } from "@angular/core";
import { NavController, AlertController } from "@ionic/angular/standalone";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { TypeModel } from "../models/cellar.model";
import { ToastController } from "@ionic/angular/standalone";
import { ActivatedRoute } from "@angular/router";

import * as Debugger from "debug";
import { Store } from "@ngrx/store";
import * as TypeSelectors from "../state/type/type.selectors";
import * as VinSelectors from "../state/vin/vin.selectors";
import * as AppellationSelectors from "../state/appellation/appellation.selectors";
import * as TypeActions from "../state/type/type.actions";
import { Observable, Subject } from "rxjs";
import { takeUntil, tap } from "rxjs/operators";
import { AppState } from "../state/app.state";

import { replacer } from "../util/util";
import { addIcons } from "ionicons";
import { caretForwardOutline } from "ionicons/icons";

const debug = Debugger("app:type");

@Component({
    selector: "app-type",
    templateUrl: "./type.page.html",
    styleUrls: ["./type.page.scss"],
    standalone: false
})
export class TypePage implements OnInit {
  public type: TypeModel = new TypeModel({
    _id: "",
    nom: "",
  });
  public wineTypes$!: Observable<TypeModel[]>;
  private unsubscribe$ = new Subject<void>();

  public typeList: Array<TypeModel> = [];
  public typesMap: Map<any, any> = new Map<any, any>();
  public submitted: boolean = false;
  public typeForm!: FormGroup;
  public list: boolean = true;
  public newType: boolean = true;

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
    this.typeForm = this.formBuilder.group(
      {
        nom: ["", Validators.required],
      },
      { validator: this.noDouble.bind(this) }
    );
    this.submitted = false;
    this.route.snapshot.data["action"] == "list"
      ? (this.list = true)
      : (this.list = false);
    // We need to load the type list even if we create or modify an type because in this case we need the type list to check for doubles

    debug("[ngOnInit]calling getAllTypesArraySorted selector to set wineType$");
    this.wineTypes$ = this.store
      .select(TypeSelectors.getAllTypesArraySorted)
      .pipe(
        takeUntil(this.unsubscribe$),
        tap((typeState) =>
          debug(
            "[ngOnInit]called getAllTypesArraySorted selector - ts " +
              window.performance.now() +
              "\ntypeState : " +
              JSON.stringify(typeState, replacer)
          )
        )
      );

    // loading types map from state (used for double check)
    this.store
      .select(TypeSelectors.typeMapForDuplicates)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((typesMap) => (this.typesMap = typesMap));
    // Now loading selected type from the state
    // if id param is there, the type will be loaded, if not, we want to create a new type and the form values will remain as initialized
    this.store
      .select(TypeSelectors.getType(this.route.snapshot.paramMap.get("id")!))
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((type) => {
        if (type) {
          this.list = false;
          this.type = type;
          this.newType = false;
          // We have selected an type
          // reset VinState status to avoid shadow UI messages coming from previous updates in other app instances
          this.store.dispatch(
            TypeActions.editType({
              id: type._id,
              rev: type._rev,
            })
          );
          this.typeForm.get("nom")!.setValue(type.nom);
          debug("[Vin.ngOnInit]Type loaded : " + JSON.stringify(type));
        } else {
          // No wine was selected, when will register a new type
          this.newType = true;
          this.store.dispatch(TypeActions.editType({ id: "", rev: "" }));
        }
      });

    // Handling state changes (originating from save, update or delete operations in the UI but also coming for synchronization with data from other application instances)
    this.store
      .select((state: AppState) => state.types)
      .pipe(
        takeUntil(this.unsubscribe$)
        /*         tap((typeState) =>
                  debug(
                    "[ngOnInit]handle typeState Changes - ts " +
                      window.performance.now() +
                      "\ntypeState : " +
                      JSON.stringify(typeState, replacer)
                  )
                )
         */
      )
      .subscribe((typeState) => {
        switch (typeState.status) {
          case "saved":
            debug(
              "[ngOnInit] handling change to 'saved' status - ts " +
                window.performance.now() +
                "\ntypeState : " +
                JSON.stringify(typeState, replacer)
            );

            // if we get an event that a wine is saved. We need to check it's id and
            // if the event source is internal (saved within this instance of the application) or external.
            // - (I) internal ? => (wine is saved in the application) a confirmation message is shown to the user and the app goes to the home scree
            // - (II) external ?
            //       - (A) event comes from the local DB resulting from the update of the wine we just saved
            //       - (B) event comes from the remoteDB resulting from the update of a wine ( not the one we are working on or having been working on)
            //       - (C) event coming from the remoteDB resulting from the update of the wine we are working on. (concurrent updata)
            if (typeState.source == "internal") {
              debug("[ngInit](I) Standard wine saved");
              // Internal event
              this.presentToast(
                this.translate.instant("general.dataSaved"),
                "success",
                "home",
                2000
              );
              this.store.dispatch(TypeActions.setStatusToLoaded());
            } else {
              // let's try to find a duplicate event in the eventLog
              let filteredEventLog = typeState.eventLog.filter(
                (value) =>
                  value.id == typeState.currentType.id &&
                  value.rev == typeState.currentType.rev &&
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
                this.store.dispatch(TypeActions.setStatusToLoaded());
              } else if (
                typeState.eventLog[typeState.eventLog.length - 1].id ==
                  typeState.currentType.id &&
                typeState.eventLog[typeState.eventLog.length - 1].rev ==
                  typeState.currentType.rev &&
                typeState.eventLog[typeState.eventLog.length - 1].action ==
                  "create" &&
                this.typeForm.dirty // otherwize, there is no way to make the distinction when you open a brand new editing form for a wine that has been created in another application instance
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
              this.translate.instant("general.DBError") + " " + typeState.error,
              "error",
              null,
              5000
            );
            break;
          case "deleted":
            // if we get an event that an type is saved. We need to check it's id and
            // if the event source is internal (saved within this instance of the application) or external.
            // - (I) internal ? => (type is saved in the application) a confirmation message is shown to the user and the app goes to the home scree
            // - (II) external ?
            //       - (A) event comes from the local DB resulting from the update of the wine we just saved
            //       - (B) event comes from the remoteDB resulting from the update of a wine ( not the one we are working on or having been working on)
            //       - (C) event coming from the remoteDB resulting from the update of the wine we are working on. (concurrent updata)
            // Delete does not suppress a doc or it's revision. It just creates a new document (with a new revision) that has the "_delete" attribute set to true
            if (typeState.source == "internal") {
              debug("[ngInit](I) Standard wine deleted");
              // Internal event
              this.presentToast(
                this.translate.instant("wine.wineDeleted"),
                "success",
                "home",
                2000
              );
              this.store.dispatch(TypeActions.setStatusToLoaded());
            } else {
              // let's try to find a duplicate event in the eventLog
              // this should never happen for a delete
              if (
                typeState.eventLog.filter(
                  (value) =>
                    value.id == typeState.currentType.id &&
                    value.rev >= typeState.currentType.rev &&
                    value.action == "delete"
                ).length == 2
              ) {
                debug(
                  "[ngInit](II.A) Duplicate state change for the same wine"
                );
                this.store.dispatch(TypeActions.setStatusToLoaded());
              } else if (
                typeState.eventLog[typeState.eventLog.length - 1].id ==
                  typeState.currentType.id &&
                typeState.eventLog[typeState.eventLog.length - 1].action ==
                  "delete"
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
    debug("[Type.ngOnDestroy]called");
    // Unscubribe all observers
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
  }

  private noDouble(group: FormGroup) {
    debug("[noDouble] called");
    if (!group.controls["nom"] || !group.controls["nom"].dirty) return null;
    if (this.typesMap && this.typesMap.has(group.value.nom)) {
      debug("[noDouble]double detected");
      return { double: true };
    } else return null;
  }

  public editType(type) {
    if (type._id) this.navCtrl.navigateForward(["/type", type._id]);
    else this.navCtrl.navigateForward(["/type"]);
  }

  public saveType() {
    debug("[saveType]entering");
    this.submitted = true;
    if (this.typeForm.valid) {
      // validation succeeded
      debug("[TypeVin]Type valid");
      // when the vin has been loaded from the store, it is immutable, we need to deep copy it before being able to update its properties
      let mutableType = JSON.parse(JSON.stringify(this.type));
      // now combine the loaded wine data with the new form data
      this.type = {
        ...mutableType,
        ...this.typeForm.value,
      };

      this.store.dispatch(TypeActions.createType({ _type: this.type }));
    } else {
      debug("[Vin - saveVin]vin invalid");
      this.presentToast(
        this.translate.instant("general.invalidData"),
        "error",
        null
      );
    }
  }

  public deleteType() {
    // Before deleting an type, we need to check if this type is not used for any of the wines.
    // If it is used, it can't be deleted.
    let used = false;
    this.store
      .select(VinSelectors.getWinesByType(this.type._id))
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((wineListForType) =>
        wineListForType.length > 0 ? (used = true) : (used = false)
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
                  TypeActions.deleteType({
                    _type: this.type,
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
        this.translate.instant("type.cantDeleteBecauseUsed"),
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
