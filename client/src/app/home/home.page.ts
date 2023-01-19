import { Component, OnInit } from "@angular/core";
import { AlertController, NavController, MenuController } from "@ionic/angular";
import { PouchdbService } from "../services/pouchdb.service";
import { filter, debounce } from "rxjs/operators";
import { NgZone } from "@angular/core";
import { VinModel } from "../models/cellar.model";
import dayjs from "dayjs";

import * as Debugger from "debug";
import Debug from "debug";

import { interval } from "rxjs";

import { Store, select } from "@ngrx/store";
import { Observable, pipe } from "rxjs";
import * as VinActions from "../state/vin/vin.actions";
import * as TypeActions from "../state/type/type.actions";
import * as OrigineActions from "../state/origine/origine.actions";
import * as AppellationActions from "../state/appellation/appellation.actions";
import * as VinSelectors from "../state/vin/vin.selectors";

const debug = Debug("app:home");

@Component({
  selector: "app-home",
  templateUrl: "home.page.html",
  styleUrls: ["home.page.scss"],
})
export class HomePage implements OnInit {
  public wines: Array<VinModel> = [];
  public isInStock: boolean = true;
  public loading: boolean = true;
  public searchTerm: string = "";
  public selectedWine: VinModel;
  /* AlertReadyToDrink (ARTD), ReadyToDrink (RTD), NealrlyReadyToDrink (NearlyRTD), Not Ready To Drink (NotRTD) */
  public RTDList: Array<VinModel> = [];
  public NotRTDList: Array<VinModel> = [];
  public NearlyRTDList: Array<VinModel> = [];
  public ARTDList: Array<VinModel> = [];
  public nbrARTD: number = 0;
  public nbrRTD: number = 0;
  public nbrNearlyRTD: number = 0;
  public nbrNotRTD: number = 0;
  public details: boolean = false;
  public dashboard: boolean = true;
  public winesForDrinkList: VinModel[];
  public winesForDrinkList$;
  public filteredWines$: Observable<VinModel[]>;

  constructor(
    private dataService: PouchdbService,
    private alertCtrl: AlertController,
    private menuCtrl: MenuController,
    private navCtrl: NavController,
    private zone: NgZone,
    private store: Store
  ) {}

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
    this.loading = true;
    this.store.dispatch(VinActions.loadVins());
    this.store.dispatch(TypeActions.loadTypes());
    this.store.dispatch(OrigineActions.loadOrigines());
    this.store.dispatch(AppellationActions.loadAppellations());
    this.store.pipe(select(VinSelectors.getAllVins)).subscribe((wineList) => {
      this.wines = Array.from(wineList.values());
      this.loading = false;
      console.log("adding " + this.wines.length + " wines to home page");
    });
    let maturityTypes = ["ARTD", "RTD", "NRTD", "NotRTD"];
    maturityTypes.map((v) => {
      this.store.select(VinSelectors.getWinesMaturity(v)).subscribe((list) => {
        this["nbr" + v] = list.length;
      });
    });

    //this.store.dispatch(VinActions.loadVins());
    /*this.store
      .select(VinSelectors.getAllVins)
      .subscribe((wineList) => (this.wines = Array.from(wineList.values())));
*/
    // Most of the time, we just have to load the notes data
    //this.getAllWines();
    // but sometime we have to load the notes data after the synchronizatioin with a remote db is finished or when database service hooks have been applied
    /*  this.dataService.dbEvents$
      .pipe(
        filter(
          (event) =>
            event.eventType == "dbReplicationCompleted" ||
            event.eventType == "docDelete" ||
            event.eventType == "docUpdate" ||
            event.eventType == "docInsert" ||
            event.eventType == "winesReadyToLoad"
        ),
        debounce(() => interval(100))
      )
      .subscribe((event) => {
        this.getAllWines();
        debug(
          "[ngOnInit - observed event message]" +
            JSON.stringify(event) +
            " - loading wines"
        );
      });
*/ // and sometime, there is no synchronization defined
    let result = window.localStorage.getItem("myCellar.remoteDBURL");
    if (!result || !result.startsWith("http")) {
      debug("[ngOnInit] no remote db initialized, using local database");
      // check if this choice hasn't been done already in the past (in a previous session on this browser). If not, ask to choose.
      if (!window.localStorage.getItem("localUse")) this.alertNoRemoteDB();
    }
  }

  showWinesToDrink(selection: number) {
    this.dashboard = false;
    switch (selection) {
      case 1:
        this.winesForDrinkList$ = this.store.select(
          VinSelectors.getWinesMaturity("ARTD")
        );
        break;
      case 2:
        this.winesForDrinkList$ = this.store.select(
          VinSelectors.getWinesMaturity("RTD")
        );
        break;
      case 3:
        this.winesForDrinkList$ = this.store.select(
          VinSelectors.getWinesMaturity("NRTD")
        );
        break;
      case 4:
        this.winesForDrinkList$ = this.store.select(
          VinSelectors.getWinesMaturity("NotRTD")
        );
        break;
    }
  }

  backToDashboard() {
    this.dashboard = !this.dashboard;
  }

  onInStockChange() {
    this.isInStock = !this.isInStock;
    this.setFilteredItems();
  }

  cancelSearch() {
    this.searchTerm = "";
    this.filteredWines$ = this.store.select(
      VinSelectors.getFilteredWines(this.searchTerm, this.isInStock)
    );
  }

  filterWinesTAS() {}

  setFilteredItems() {
    this.filteredWines$ = this.store.select(
      VinSelectors.getFilteredWines(this.searchTerm, this.isInStock)
    );
  }

  goToVin(params) {
    if (!params) params = {};
    this.navCtrl.navigateForward("/vin/" + params);
    /* 		this.navCtrl.setRoot(VinPage,{id:params});
     */
  }
}
