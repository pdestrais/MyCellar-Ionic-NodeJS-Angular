import { Component, computed, effect, OnInit, signal } from "@angular/core";
import { AlertController, NavController, MenuController } from "@ionic/angular/standalone";
import { VinModel } from "../models/cellar.model";

import * as Debugger from "debug";
import Debug from "debug";

import { Store, select } from "@ngrx/store";
import { Observable, pipe } from "rxjs";
import * as VinActions from "../state/vin/vin.actions";
import * as TypeActions from "../state/type/type.actions";
import * as OrigineActions from "../state/origine/origine.actions";
import * as AppellationActions from "../state/appellation/appellation.actions";
import * as VinSelectors from "../state/vin/vin.selectors";
import { AppState } from "../state/app.state";
import { addIcons } from "ionicons";
import { arrowBackOutline, searchOutline } from "ionicons/icons";

const debug = Debug("app:home");

@Component({
  selector: "app-home",
  templateUrl: "home.page.html",
  styleUrls: ["home.page.scss"],
  standalone: false,
})
export class HomePage implements OnInit {
  wines = signal<VinModel[]>([]);
  loading = signal<boolean>(true);
  isInStock = signal<boolean>(true);
  searchString = signal<string>("");
  // filteredWines2 = computed<VinModel[]>(() => {
  //   if (this.searchString() == "") {
  //     return [];
  //   } else {
  //     if (this.isInStock()) {
  //       return this.wines().filter(
  //         (wine) =>
  //           wine.nom.toLowerCase().includes(this.searchString()) && wine.nbreBouteillesReste > 0
  //       );
  //     } else {
  //       return this.wines().filter((wine) => wine.nom.toLowerCase().includes(this.searchString()));
  //     }
  //   }
  // });
  filteredWines = computed<VinModel[]>(() =>
    this.store.selectSignal(VinSelectors.getFilteredWines(this.searchString(), this.isInStock()))()
  );
  dashboardSelectedMaturity = signal<string>("");
  maturityWinesList = computed<VinModel[]>(() => {
    console.log("entering maturityWinesList signal compute");
    if (this.dashboardSelectedMaturity() != "" && this.wines().length != 0) {
      return this.store.selectSignal(
        VinSelectors.getWinesMaturity(this.dashboardSelectedMaturity())
      )();
    } else {
      return [];
    }
  });
  public selectedWine!: VinModel;
  /* AlertReadyToDrink (ARTD), ReadyToDrink (RTD), NealrlyReadyToDrink (NearlyRTD), Not Ready To Drink (NotRTD) */
  nbrARTD = signal<number>(0);
  nbrRTD = signal<number>(0);
  nbrNRTD = signal<number>(0);
  nbrNotRTD = signal<number>(0);

  constructor(
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private store: Store<AppState>
  ) {
    addIcons({ arrowBackOutline, searchOutline });
    // effect(() => {
    //   console.log(`fileteredWines length is : ${this.filteredWines().length}`);
    //   console.log(`maturityWinesList length is : ${this.maturityWinesList().length}`);
    //   console.log(`dashboardSelectedMaturity is : ${this.dashboardSelectedMaturity()}`);
    // });
  }

  async alertNoRemoteDB() {
    const alert = await this.alertCtrl.create({
      header: "Alert",
      subHeader: "No Cloudant DB defined",
      message:
        "No Cloudant remote DB is defined to store your notes. Only the local storage will be used and no synchronization between devices will be possible.",
      buttons: [
        {
          text: "Ok",
          handler: () => {
            // store temporary in session that the use wants to work with a local DB
            window.localStorage.setItem("localUse", "true");
            console.log("Confirm Ok");
          },
        },
        {
          text: "Configure Cloudant DB",
          handler: () => {
            this.navCtrl.navigateForward("/preferences");
            console.log("Confirm Cancel");
          },
        },
      ],
    });

    await alert.present();
  }

  ngOnInit() {
    debug("[ngOnInit] entering method");
    this.store.dispatch(VinActions.loadVins());
    // not need in home page but I'm loading the type, origine and appellation information in the state so that it's ready to use in other modules
    this.store.dispatch(TypeActions.loadTypes());
    this.store.dispatch(OrigineActions.loadOrigines());
    this.store.dispatch(AppellationActions.loadAppellations());
    this.store.pipe(select(VinSelectors.getVinState)).subscribe((vinState) => {
      return { ...vinState, status: "noop", source: "" };
    });
    this.store.pipe(select(VinSelectors.getAllVins)).subscribe((wineList) => {
      this.wines.set(Array.from(wineList.values()));
      this.nbrARTD.set(this.store.selectSignal(VinSelectors.getWinesMaturity("ARTD"))().length);
      this.nbrRTD.set(this.store.selectSignal(VinSelectors.getWinesMaturity("RTD"))().length);
      this.nbrNRTD.set(this.store.selectSignal(VinSelectors.getWinesMaturity("NRTD"))().length);
      this.nbrNotRTD.set(this.store.selectSignal(VinSelectors.getWinesMaturity("NotRTD"))().length);
      this.loading.set(false);
      debug("[HomePage]Loading " + this.wines.length + " wines to home page");
    });

    // and sometime, there is no synchronization defined
    let result = window.localStorage.getItem("myCellar.remoteDBURL");
    if (!result || !result.startsWith("http")) {
      debug("[ngOnInit] no remote db initialized, using local database");
      // check if this choice hasn't been done already in the past (in a previous session on this browser). If not, ask to choose.
      if (!window.localStorage.getItem("localUse")) this.alertNoRemoteDB();
    }
  }

  cancelSearch() {
    this.searchString.set("");
  }

  goToVin(params) {
    if (!params) params = {};
    this.navCtrl.navigateForward("/vin/" + params);
    /* 		this.navCtrl.setRoot(VinPage,{id:params});
     */
  }
}
