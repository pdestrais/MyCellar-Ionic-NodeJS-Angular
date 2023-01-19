import { Subject, of, merge } from "rxjs";
import { filter, take, takeUntil, tap } from "rxjs/operators";
import { TranslateService } from "@ngx-translate/core";
import {
  Component,
  OnInit,
  OnDestroy,
  AfterViewInit,
  Input,
  ElementRef,
  ViewChild,
} from "@angular/core";
import {
  NavController,
  AlertController,
  ModalController,
  LoadingController,
  Platform,
} from "@ionic/angular";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { PouchdbService } from "../services/pouchdb.service";
import {
  VinModel,
  AppellationModel,
  OrigineModel,
  TypeModel,
} from "../models/cellar.model";

import { Store, ActionsSubject } from "@ngrx/store";

import { Observable } from "rxjs";
import * as VinActions from "../state/vin/vin.actions";
import * as VinSelectors from "../state/vin/vin.selectors";
import * as TypeSelectors from "../state/type/type.selectors";
import * as OrigineSelectors from "../state/origine/origine.selectors";
import * as AppellationSelectors from "../state/appellation/appellation.selectors";

import { HttpClient } from "@angular/common/http";
import dayjs from "dayjs";
import { map, debounceTime, switchMap } from "rxjs/operators";
import { ToastController } from "@ionic/angular";
import { ActivatedRoute } from "@angular/router";
import loadImage from "blueimp-load-image/js/index";
import pica from "pica/dist/pica.js";
import { ViewerComponent } from "./viewer/viewer.component";

import * as Debugger from "debug";
import { AppState } from "../state/app.state";
const debug = Debugger("app:vin");

interface Option {
  id: number;
  name: string;
  firstname: string;
}

@Component({
  selector: "app-vin",
  templateUrl: "./vin.page.html",
  styleUrls: ["./vin.page.scss"],
})
export class VinPage implements OnInit, OnDestroy, AfterViewInit {
  public nbreAvantUpdate: number = 0;
  public newWine: boolean = true;
  public vin: VinModel;
  public vinsMap: Map<string, VinModel>;
  public origines: Array<any> = [];
  public appellations: Array<any> = [];
  public types: Array<any> = [];
  public comment: string = "";
  public errors: Array<any>;
  public vinForm: FormGroup;
  public nameYearForm: FormGroup;
  public submitted: boolean;
  private originalName;
  private originalYear;
  public status: string;
  //	private ctx: any;
  //	private canvas: any;
  /* 	private canvasHeight: number = 200;
	private canvasWidth: number = 150;
	private mq420: MediaQueryList = window.matchMedia('(max-width: 420px)');
	private mq500: MediaQueryList = window.matchMedia('(min-width:421px) and (max-width: 500px )');
	private mq800: MediaQueryList = window.matchMedia('(min-width:501px) and (max-width: 800px )');
	private mq2000: MediaQueryList = window.matchMedia('(min-width:920px)');
 */
  ///	private url: any;
  //	private imgRatio: number = 4 / 3;
  //	private imgMinWidth: number = 150;
  //	private imgMaxWidth: number = 550;
  //	private offScreenCanvas: HTMLCanvasElement = document.createElement('canvas');
  private selectedPhoto: { contentType: string; data: File } = {
    contentType: "jpeg",
    data: new File([], "Photo file"),
  };
  private vinMapState$: Observable<Map<string, VinModel>>;
  private unsubscribe$ = new Subject<void>();
  public types$: Observable<Array<TypeModel>>;
  public origines$: Observable<Array<TypeModel>>;
  public appellations$: Observable<Array<TypeModel>>;

  /**
   * 'plug into' DOM canvas element using @ViewChild
   */
  @ViewChild("hiddenInput", { static: false }) hiddenInput: ElementRef;
  @ViewChild("photoImage", { static: false }) photoImage: any;
  @ViewChild("uploadphoto", { static: false })
  inputUploader: ElementRef<HTMLInputElement>;
  alert: any;
  navTransition: any;

  _origines: [
    { id: "77"; pays: "France"; region: "Bergerac" },
    { id: "78"; pays: "France"; region: "Bordeaux" }
  ];
  options: Option[] = [
    { id: 1, name: "John", firstname: "Doe" },
    { id: 2, name: "Jane", firstname: "Doe" },
    { id: 3, name: "Bob", firstname: "Smith" },
  ];

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private pouch: PouchdbService,
    private formBuilder: FormBuilder,
    private translate: TranslateService,
    private alertController: AlertController,
    private modalCtrl: ModalController,
    private http: HttpClient,
    private toastCtrl: ToastController,
    private loadingCtrl: LoadingController,
    private platform: Platform,
    private store: Store,
    private actionListener$: ActionsSubject
  ) {
    this.vin = new VinModel({
      _id: "",
      _rev: "",
      nom: "",
      annee: "",
      nbreBouteillesAchat: 0,
      nbreBouteillesReste: 0,
      prixAchat: 0,
      dateAchat: "",
      remarque: "",
      localisation: "",
      contenance: "",
      history: [],
      lastUpdated: "",
      appellation: new AppellationModel({ _id: "", courte: "", longue: "" }),
      origine: new OrigineModel({ _id: "", pays: "", region: "" }),
      type: new TypeModel({ _id: "", nom: "" }),
      cepage: "",
      apogee: "",
      GWSScore: 0,
      cotes: [],
      photo: { name: "", width: 0, heigth: 0, orientation: 1, fileType: "" },
      rating: 0,
    });

    /*     this.vinForm = this.formBuilder.group(
      {
        nom: ["", Validators.required],
        annee: [
          "",
          Validators.compose([
            Validators.minLength(4),
            Validators.maxLength(4),
            Validators.pattern("[0-9]*"),
            Validators.required,
          ]),
        ],
        type: ["", Validators.required],
        origine: ["", Validators.required],
        appellation: ["", Validators.required],
        nbreBouteillesAchat: [0, Validators.required],
        nbreBouteillesReste: [
          0,
          Validators.compose([
            Validators.pattern("[0-9]*"),
            Validators.required,
          ]),
        ],
        prixAchat: [
          0,
          Validators.compose([
            Validators.pattern("^[0-9]+((,[0-9]{1,2})|(.[0-9]{1,2}))?$"),
            Validators.required,
          ]),
        ],
        dateAchat: ["", Validators.required],
        localisation: ["", Validators.required],
        apogee: ["", Validators.pattern("^[0-9]{4,4}-[0-9]{4,4}$")],
        contenance: [""],
        cepage: [""],
        GWSScore: [""],
        rating: [0],
        //        selectedOption: [this.options[1]],
      } //,
      //{ validator: this.noDouble.bind(this) }
    );
 */ this.submitted = false;
  }

  public ngOnInit() {
    debug("[Vin.ngOnInit]called");
    let paramId = this.route.snapshot.params["id"];
    this.types$ = this.store
      .select(TypeSelectors.getAllTypesArraySorted)
      .pipe(takeUntil(this.unsubscribe$));
    this.origines$ = this.store.select(
      OrigineSelectors.getAllOriginesArraySorted
    );
    this.appellations$ = this.store.select(
      AppellationSelectors.getAllAppellationsArraySorted
    );
    this.store
      .select<VinModel>(VinSelectors.getWine(paramId))
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((vin) => {
        this.vin = vin;
        this.originalName = vin.nom;
        this.originalYear = vin.annee;
        // Object.assign(this.vin, vin);
        //        this.vinForm.controls["selectedOption"].setValue(this.options[0]);
        this.vinForm = this.formBuilder.group(
          {
            nom: [vin.nom, Validators.required],
            annee: [
              vin.annee,
              Validators.compose([
                Validators.minLength(4),
                Validators.maxLength(4),
                Validators.pattern("[0-9]*"),
                Validators.required,
              ]),
            ],
            type: [vin.type, Validators.required],
            origine: [vin.origine, Validators.required],
            appellation: [vin.appellation, Validators.required],
          } //,
          //{ validator: this.noDouble.bind(this) }
        );

        this.nbreAvantUpdate = this.vin.nbreBouteillesReste;
        this.newWine = false;
        debug("[Vin.ngOnInit]Vin loaded : " + JSON.stringify(this.vin));
        return true;
      });

    this.vinMapState$ = this.store
      .select<Map<string, VinModel>>(VinSelectors.vinMapForDuplicates)
      .pipe(takeUntil(this.unsubscribe$));
    this.vinMapState$.subscribe((map) => (this.vinsMap = map));

    this.store
      .select((state: AppState) => state.vins)
      .pipe(takeUntil(this.unsubscribe$))
      .subscribe((vinState) => {
        switch (vinState.status) {
          case "success save":
            // if we get an event that a wine is saved. We need to check it's id and
            // if the event source is internal (saved within this instance of the application).
            // - internal ? => (wine is saved in the application) a confirmation message is shown to the user and the app goes to the home scree
            // - external ?
            //       - concurrent update on the same wine (same id but different rev) ? => show a warning that the wine the user is working on has been updated somewhere else in the mean time. we go back to the home screen.
            //       - no concurrent update on the same wine (not the same id) ? => no confirmation or message is shown, we stay on the wine edition page.
            if (vinState.source == "internal") {
              setTimeout(() => {
                this.vin._rev = vinState.wineInstance._rev;
              }, 3000);
              // Internal event
              this.presentToast(
                this.translate.instant("general.dataSaved"),
                "success",
                "home",
                2000
              );
            } else if (
              this.vin._id &&
              this.vin._rev &&
              this.vin._id == vinState.wineInstance._id &&
              this.vin._rev != vinState.wineInstance._rev
            ) {
              // Event showing concurrent editing on the same wine that was saved somewhere else
              this.presentToast(
                this.translate.instant(
                  "wine.savedOrDeletedConcurrentlyOnAnotherInstance"
                ),
                "warning",
                "home",
                0,
                "Close"
              );
            }
            break;
          case "error":
            this.presentToast(
              this.translate.instant("general.DBError") + " " + vinState.error,
              "error",
              null,
              5000
            );
            break;
          case "success delete":
            if (vinState.source == "internal")
              // Internal event
              this.presentToast(
                this.translate.instant("wine.wineDeleted"),
                "success",
                "home",
                2000
              );
            else if (
              this.vin._id &&
              JSON.stringify(this.vin) == JSON.stringify(vinState.wineInstance)
            ) {
              // Event showing concurrent editing on the same wine that was saved somewhere else
              this.presentToast(
                this.translate.instant(
                  "wine.savedOrDeletedConcurrentlyOnAnotherInstance"
                ),
                "warning",
                "home",
                0,
                "Close"
              );
            }
            break;
        }
      });

    Promise.all([
      this.pouch.getDocsOfType("origine"),
      this.pouch.getDocsOfType("appellation"),
      this.pouch.getDocsOfType("type"),
    ]).then((results) => {
      this.origines = results[0];
      this.origines.sort((a, b) => {
        return a.pays + a.region < b.pays + b.region ? -1 : 1;
      });
      this.appellations = results[1];
      this.appellations.sort((a, b) => {
        return a.courte + a.longue < b.courte + b.longue ? -1 : 1;
      });
      this.types = results[2];
      this.types.sort((a, b) => {
        return a.nom < b.nom ? -1 : 1;
      });
      if (!paramId) {
        let now = dayjs();
        // Search for type that correspond to "red" and use it's _id to initialize the vin attribute
        let preselectedType;
        if (this.types && this.types.length > 0) {
          preselectedType = this.types.find((e) => {
            return e.nom == "Rouge" || e.nom == "Red";
          });
        }
        this.vin = new VinModel({
          _id: "",
          _rev: "",
          nom: "",
          annee: "",
          nbreBouteillesAchat: 0,
          nbreBouteillesReste: 0,
          prixAchat: 0,
          dateAchat: now.format("YYYY-MM-DD"),
          remarque: "",
          localisation: "",
          contenance: "",
          history: [],
          lastUpdated: "",
          appellation: new AppellationModel({
            _id: "",
            courte: "",
            longue: "",
          }),
          origine: new OrigineModel({ _id: "", pays: "", region: "" }),
          type: new TypeModel({
            _id: preselectedType ? preselectedType._id : "",
            nom: preselectedType ? preselectedType.nom : "",
          }),
          cepage: "",
          apogee: "",
          GWSScore: 0,
          cotes: [],
          photo: {
            name: "",
            width: 0,
            heigth: 0,
            orientation: 1,
            fileType: "",
          },
          rating: 0,
        });
        this.vinForm.setValue(
          this.reject(this.vin, [
            "_id",
            "_rev",
            "remarque",
            "history",
            "lastUpdated",
            "dateCreated",
            "cotes",
            "_attachments",
            "photo",
          ])
        );
      }
    });

    merge(
      this.vinForm.get("nom").valueChanges,
      this.vinForm.get("annee").valueChanges
    )
      .pipe(debounceTime(1000))
      .subscribe((value) => {
        debug("[ngInit]on name or year value change", +JSON.stringify(value));
        let checkDuplicate = this.noDouble(this.vinForm);
        if (checkDuplicate != null) {
          this.vinForm.setErrors({ double: true });
        }
      });
  }

  changeSelectedOption(newOption: Option) {
    this.vinForm.controls["selectedOption"].setValue(newOption);
  }
  public ngAfterViewInit() {
    debug("[entering ngAfterViewInit]");
  }

  compareFn(e1: any, e2: any): boolean {
    /*     debug("[compareFn] object 1 :" + JSON.stringify(e1));
    debug("[compareFn] object 2 :" + JSON.stringify(e2));
    debug(
      "[compareFn] compare result :" + e1 && e2 ? e1._id === e2._id : e1 === e2
    );
 */ return e1 && e2 ? e1._id === e2._id : e1 === e2;
  }

  public async loadImageAndView(type: string) {
    let fileOrBlob: any;
    if (type == "file") {
      let el = this.inputUploader.nativeElement;
      if (el) {
        fileOrBlob = el.files[0];
        this.selectedPhoto.data = fileOrBlob;
        debug("[loadImageAndView]platform : " + this.platform.platforms());
        if (this.platform.is("ios") || this.platform.is("ipad")) {
          let now = dayjs();
          this.vin.photo.name = now.format("YYYY-MM-DD_hh-mm-ss") + "_img.jpeg";
        } else this.vin.photo.name = fileOrBlob.name;
      }
    }
    if (type == "blob" && this.selectedPhoto.data.size == 0) {
      try {
        fileOrBlob = await this.pouch.db.getAttachment(
          this.vin._id,
          "photoFile"
        );
      } catch (err) {
        debug("[loadImageAndView]no attachemnt to load - error :", err);
      }
    } else if (type == "blob" && this.selectedPhoto.data.size != 0) {
      fileOrBlob = this.selectedPhoto.data;
    }

    this.modalCtrl
      .create({
        component: ViewerComponent,
        componentProps: {
          fileOrBlob: fileOrBlob,
          action: type == "file" ? "add" : "modify",
        },
        cssClass: "auto-height",
      })
      .then(async (modal) => {
        modal.present();
        const { data } = await modal.onDidDismiss();
        debug(
          "[loadImageAndView]data from image preview modal : " +
            JSON.stringify(data)
        );
        switch (data.choice) {
          case "delete":
            this.vin.photo = {
              name: "",
              width: 0,
              heigth: 0,
              orientation: 1,
              fileType: "",
            };
            this.selectedPhoto = {
              contentType: "jpeg",
              data: new File([], "Photo file"),
            };
            try {
              let result = await this.pouch.db.removeAttachment(
                this.vin._id,
                "photoFile",
                this.vin._rev
              );
              debug("[loadImageAndView]delete attachment success");
            } catch (err) {
              debug(
                "[loadImageAndView]problem to delete attachment - error : ",
                err
              );
            }
            break;
          case "cancel":
            if (data.from == "add") {
              this.selectedPhoto = {
                contentType: "jpeg",
                data: new File([], "Photo file"),
              };
              this.vin.photo = {
                name: "",
                width: 0,
                heigth: 0,
                orientation: 1,
                fileType: "",
              };
            } else if (data.from == "replace") {
              // Nothing to do
            }
            break;
          case "replace":
            this.selectedPhoto = data.file;
            this.vin.photo.name = data.file.name;
            this.vin.photo.fileType = data.file.type;
          case "keep":
            this.selectedPhoto.data = data.compressedBlob;
            this.selectedPhoto.contentType = data.selectedFile.type;
            this.vin.photo.name = data.selectedFile.name;
            this.vin.photo.fileType = data.selectedFile.type;
        }
      });
  }

  public ngOnDestroy() {
    debug("[Vin.ngOnDestroy]called");
    this.unsubscribe$.next();
    this.unsubscribe$.complete();
    //this.actionListener$.unsubscribe();
  }

  public ionViewWillEnter() {
    debug("[Vin.ionViewWillEnter]called");
  }

  public ionViewDidLoad() {
    debug("[Vin.ionViewDidLoad]called");
  }

  public async saveVin() {
    debug("[Vin.saveVin]entering");
    this.submitted = true;
    if (this.vinForm.valid) {
      // validation succeeded
      debug("[Vin.saveVin]vin valid");
      let id = this.vin._id;
      Object.assign(this.vin, this.vinForm.value);
      //this.vin = this.vinForm.value;
      this.vin._id = id;
      this.vin.lastUpdated = new Date().toISOString();
      this.vin.appellation = this.appellations.find(
        (appellation) => appellation._id == this.vin.appellation
      );
      this.vin.origine = this.origines.find(
        (origine) => origine._id == this.vin.origine
      );
      this.vin.type = this.types.find((type) => type._id == this.vin.type);
      if (this.newWine) {
        this.vin.history.push({
          type: "creation",
          difference: this.vin.nbreBouteillesReste,
          date: this.vin.lastUpdated,
          comment: "",
        });
      } else {
        if (this.vin.nbreBouteillesReste - this.nbreAvantUpdate != 0)
          this.vin.history.push({
            type: "update",
            difference: this.vin.nbreBouteillesReste - this.nbreAvantUpdate,
            date: this.vin.lastUpdated,
            comment: "",
          });
      }
      if (this.vin.remarque && this.vin.remarque != "") {
        this.vin.history.push({
          type: "comment",
          date: this.vin.lastUpdated,
          comment: this.vin.remarque,
          difference: 0,
        });
        this.vin.remarque = "";
      }
      if (
        this.selectedPhoto &&
        this.selectedPhoto.data &&
        this.selectedPhoto.data.size != 0
      ) {
        if (this.selectedPhoto.contentType == "image/jpeg") {
          debug(
            "[saveVin]saved image file size : " + this.selectedPhoto.data.size
          );
          this.vin["_attachments"] = {
            photoFile: {
              content_type: "image/jpeg",
              data: this.selectedPhoto.data,
            },
          };
        } else {
          this.vin["_attachments"] = {
            photoFile: {
              content_type: this.selectedPhoto.contentType,
              data: this.selectedPhoto.data,
            },
          };
        }
      }
      this.store.dispatch(VinActions.createVin({ vin: this.vin }));
      /*      this.pouch.saveDoc(this.vin, "vin").then((response) => {
        if (response.ok) {
          debug("[Vin.saveVin]vin " + JSON.stringify(this.vin) + " saved");
          this.presentToast(
            this.translate.instant("general.dataSaved"),
            "success",
            "/home"
          );
          //this.navCtrl.push(SearchPage)
        } else {
          this.presentToast(
            this.translate.instant("general.DBError"),
            "error",
            "/home"
          );
        }
      });
    */
    } else {
      debug("[Vin.saveVin]vin invalid");
      this.presentToast(
        this.translate.instant("general.invalidData"),
        "error",
        null
      );
    }
  }

  deleteVin() {
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
              this.store.dispatch(VinActions.deleteVin({ vin: this.vin }));

              /*               this.pouch.deleteDoc(this.vin).then((response) => {
                if (response.ok) {
                  this.presentToast(
                    this.translate.instant("wine.wineDeleted"),
                    "success",
                    "/home"
                  );
                } else {
                  this.presentToast(
                    this.translate.instant("wine.wineNotDeleted"),
                    "error",
                    undefined
                  );
                }
              });
 */
            },
          },
        ],
      })
      .then((alert) => {
        alert.present();
      });
  }

  public cancel() {
    this.navCtrl.back();
  }

  public showHistory() {
    this.modalCtrl
      .create({ component: ModalPage, componentProps: { vin: this.vin } })
      .then((modal) => {
        modal.present();
      });
  }

  async presentToast(
    message: string,
    type: string,
    nextPageUrl: string,
    duration?: number,
    closeButtonText?: string
  ) {
    if (duration && duration != 0) {
      const toast = await this.toastCtrl.create({
        color: type == "success" ? "secondary" : "danger",
        message: message,
        duration: duration ? duration : 2000,
      });
      toast.present();
      if (nextPageUrl) this.navCtrl.navigateRoot(nextPageUrl);
    } else {
      const toast = await this.toastCtrl.create({
        color: type == "success" ? "secondary" : "danger",
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

  addComment() {
    this.alertController
      .create({
        header: this.translate.instant("wine.addComment"),
        //message: 'What should the title of this note be?',
        inputs: [
          {
            type: "text",
            name: "comment",
          },
        ],
        buttons: [
          {
            text: "Cancel",
          },
          {
            text: "Save",
            handler: (data) => {
              debug("add comment data : " + data);
              this.vin.remarque = data.comment;
              debug("add comment - save vin");
              this.saveVin();
            },
          },
        ],
      })
      .then((alert) => {
        alert.present();
      });
  }

  public typeChange(val: any) {
    debug("type change detected");
    if (typeof val.detail.value == "string")
      this.pouch.getDoc(val.detail.value).then(
        (result) =>
          (this.vin.type = new TypeModel({
            _id: result._id,
            nom: result.nom,
          }))
      );
  }

  public origineChange(val: any) {
    debug("origine change detected");
    if (typeof val.detail.value == "string")
      this.pouch.getDoc(val.detail.value).then(
        (result) =>
          (this.vin.origine = new OrigineModel({
            _id: result._id,
            pays: result.pays,
            region: result.region,
          }))
      );
  }

  public appellationChange(val: any) {
    debug("appellation change detected");
    if (typeof val.detail.value == "string")
      this.pouch.getDoc(val.detail.value).then(
        (result) =>
          (this.vin.appellation = new AppellationModel({
            _id: result._id,
            courte: result.courte,
            longue: result.longue,
          }))
      );
  }

  public showDate(ISODateString) {
    return ISODateString.substring(0, 10);
  }

  public toNumber(attribute: string) {
    if (typeof this.vin[attribute] === "string") {
      this.vin[attribute] = this.vin[attribute].replace(",", ".");
      this.vin[attribute] = parseFloat(this.vin[attribute]);
    }
    debug("[Vin.toNumber]" + attribute + " changed: " + this.vin[attribute]);
  }

  public async getGWSScore() {
    debug("[Vin.getGWSScore]called");
    const loading = await this.loadingCtrl.create({
      message: this.translate.instant("wine.fetchGWSSCore"),
    });
    await loading.present();
    //        if (platforms.indexOf("core")!=-1) {
    // Create url
    let prefix = window.location.origin + "/api/";
    let url =
      prefix +
      "GWS/" +
      this.cleanForUrl(this.vin.origine.region) +
      "/" +
      this.cleanForUrl(this.vin.nom) +
      "/" +
      this.vin.annee;
    debug("[Vin.getGWSScore]url :" + url);
    this.http.get(url).subscribe(
      (GWscore: any) => {
        loading.dismiss();
        this.vinForm.patchValue({ GWSScore: GWscore.score });
        this.presentToast(
          this.translate.instant("wine.GWSScoreFound"),
          "success",
          null
        );
      },
      (error) => {
        debug("http get error : " + JSON.stringify(error.status));
        loading.dismiss();
        this.presentToast(
          this.translate.instant("wine.GWSScoreNotFound", {
            url:
              "https://www.globalwinescore.com/wine-score/" +
              this.cleanForUrl(this.vin.nom) +
              "-" +
              this.cleanForUrl(this.vin.origine.region) +
              "/" +
              this.vin.annee,
          }),
          "error",
          null
        );
      }
    );
  }

  adjustQuantityLeft(q: number) {
    let ctrlLeft = this.vinForm.get("nbreBouteillesReste");
    let ctrlBought = this.vinForm.get("nbreBouteillesAchat");
    let nbrBought = ctrlBought.value;
    if (typeof ctrlBought.value === "string")
      nbrBought = parseFloat(ctrlBought.value.replace(",", "."));
    let newQty = ctrlLeft.value + q;
    if (typeof ctrlLeft.value === "string")
      newQty = parseFloat(ctrlLeft.value.replace(",", ".")) + q;
    ctrlLeft.patchValue(Math.max(Math.min(newQty, nbrBought), 0));
  }

  async presentLoading() {
    const loading = await this.loadingCtrl.create({
      message: "getting GWS Score",
    });
    await loading.present();
  }

  private cleanForUrl(text: string) {
    return text
      .trim()
      .toLowerCase()
      .replace(/ /g, "-")
      .replace(/'/g, "")
      .replace(/â/g, "a")
      .replace(/é/g, "e")
      .replace(/è/g, "e")
      .replace(/ê/g, "e")
      .replace(/û/g, "u")
      .replace(/ô/g, "o")
      .replace(/î/g, "i");
  }

  private noDouble(group: FormGroup) {
    debug("nodouble called");
    if (!group.controls.nom || !group.controls.annee) return null;
    //		if (!group.controls.nom.dirty || !group.controls.annee.dirty) return null;
    if (
      group.get("nom").value == this.originalName &&
      group.get("annee").value == this.originalYear
    )
      return null;
    let testKey = group.value.nom + group.value.annee;
    if (this.vinsMap && this.vinsMap.has(testKey)) {
      debug("[Vin.noDouble]double detected");
      return of({ double: true });
    } else return null;
  }

  private async canvasToBlob(canvas, quality: number) {
    return new Promise(function (resolve) {
      canvas.toBlob(
        function (blob) {
          return resolve(blob);
        },
        "image/jpeg",
        quality
      );
    });
  }

  // Not used anymore - image canvas resizing is dynamic
  /* 	private getCanvasDim() {
		if (this.mq420.matches) {
			this.canvasWidth = 150;
			this.canvasHeight = 180;
			return;
		}
		if (this.mq500.matches) {
			this.canvasWidth = 210;
			this.canvasHeight = 280;
			return;
		}
		if (this.mq800.matches) {
			this.canvasWidth = 300;
			this.canvasHeight = 400;
			return;
		}
		if (this.mq2000.matches) {
			this.canvasWidth = 510;
			this.canvasHeight = 680;
			return;
		}
	}
 */
  private getCanvasXSize() {
    return (
      ((window.outerWidth - 100 - Math.floor(window.outerWidth / 990) * 270) *
        8) /
      12
    );
  }

  private reject(obj, keys) {
    return Object.keys(obj)
      .filter((k) => !keys.includes(k))
      .map((k) => Object.assign({}, { [k]: obj[k] }))
      .reduce((res, o) => Object.assign(res, o), {});
  }
}

@Component({
  template: `
    <ion-header>
      <ion-toolbar>
        <ion-buttons slot="start">
          <ion-menu-button></ion-menu-button>
        </ion-buttons>
        <ion-title>
          {{ "wine.history" | translate }}
        </ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content>
      <ion-card *ngFor="let event of vin.history">
        <ion-card-header>
          <div *ngIf="event.difference && event.difference != 0">
            {{ "wine.addedExtractedOn" | translate }} : &nbsp; {{ event.date }}
          </div>
          <div *ngIf="event.comment">
            {{ "wine.addedOn" | translate }} : &nbsp; {{ event.date }}
          </div>
        </ion-card-header>
        <ion-card-content>
          <div *ngIf="event.difference && event.difference != 0">
            {{ "wine.difference" | translate }} :&nbsp;
            <ion-badge item-end>{{ event.difference }}</ion-badge>
          </div>
          <div *ngIf="event.comment">
            {{ "wine.comment" | translate }} : &nbsp; {{ event.comment }}
          </div>
        </ion-card-content>
      </ion-card>
      <ion-button expand="full" (click)="dismiss()">Close</ion-button>
    </ion-content>
  `,
})
export class ModalPage {
  @Input() vin: VinModel;

  constructor(private modalCtrl: ModalController) {}
  dismiss() {
    this.modalCtrl.dismiss();
  }
}
