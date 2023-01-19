import { TranslateService } from "@ngx-translate/core";
import { Component, OnInit } from "@angular/core";
import { NavController, AlertController } from "@ionic/angular";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { PouchdbService } from "../services/pouchdb.service";
import { AppellationModel } from "../models/cellar.model";
import { ToastController } from "@ionic/angular";
import { ActivatedRoute } from "@angular/router";

import * as Debugger from "debug";
const debug = Debugger("app:appellation");

@Component({
  selector: "app-appellation",
  templateUrl: "./appellation.page.html",
  styleUrls: ["./appellation.page.scss"],
})
export class AppellationPage implements OnInit {
  public appellation: AppellationModel = new AppellationModel({
    _id: "",
    courte: "",
    longue: "",
  });
  public appellationList: Array<AppellationModel> = [];
  public appellationsMap: Map<any, any>;
  public submitted: boolean;
  public appellationForm: FormGroup;
  public newAppellation: boolean = false;
  public list: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private pouch: PouchdbService,
    private formBuilder: FormBuilder,
    private translate: TranslateService,
    private alertController: AlertController,
    private toastCtrl: ToastController
  ) {}

  public ngOnInit() {
    debug("[ngOnInit]called");
    this.appellationForm = this.formBuilder.group(
      {
        courte: ["", Validators.required],
        longue: ["", Validators.required],
      },
      { validator: this.noDouble.bind(this) }
    );
    this.submitted = false;
    // We need to load the appellation list even if we create or modify an appellation because in this case we need the appellation list to check for doubles
    this.pouch.getDocsOfType("appellation").then((appellations) => {
      this.appellationsMap = new Map(
        appellations.map((el) => [el.courte + el.longue, el])
      );
      this.appellationList = appellations;
      debug(
        "[constructor]appellationList : " + JSON.stringify(this.appellationList)
      );
    });
    // If we come on this page on the first time, the data object related to the 'appellations' route should be set to 'list', so that we get the see the list of appellations
    if (this.route.snapshot.data.action == "list") {
      this.list = true;
    } else {
      // if we come on this page with the action parameter set to 'edit', this means that we either want to add a new appellation (id parameter is not set)
      // or edit an existing one (id parameter is set)
      this.list = false;
      if (this.route.snapshot.paramMap.get("id")) {
        this.pouch
          .getDoc(this.route.snapshot.paramMap.get("id"))
          .then((appellation) => {
            this.appellation = appellation;
            this.appellationForm
              .get("courte")
              .setValue(this.appellation.courte);
            this.appellationForm
              .get("longue")
              .setValue(this.appellation.longue);
            debug(
              "[ngOnINit]AppellationPage loaded : " +
                JSON.stringify(this.appellation)
            );
          });
      } else this.newAppellation = true;
    }
  }

  private noDouble(group: FormGroup) {
    debug("[noDouble] called");
    if (!group.controls.courte || !group.controls.longue) return null;
    if (!group.controls.courte.dirty || !group.controls.courte.dirty)
      return null;
    let testKey = group.value.courte + group.value.longue;
    if (this.appellationsMap && this.appellationsMap.has(testKey)) {
      debug("[noDouble]double detected");
      return { double: true };
    } else return null;
  }

  public editAppellation(appellation) {
    if (appellation._id)
      this.navCtrl.navigateForward(["/appellation", appellation._id]);
    else this.navCtrl.navigateForward(["/appellation"]);
  }

  public saveAppellation() {
    debug("[saveAppellation]entering");
    this.submitted = true;
    if (this.appellationForm.valid) {
      // validation succeeded
      debug("[AppellationVin]Appellation valid");
      this.pouch
        .saveDoc(this.appellationForm.value, "appellation")
        .then((response) => {
          if (response.ok) {
            debug(
              "[saveAppellation]Appellation " +
                JSON.stringify(this.appellation) +
                "saved"
            );
            this.presentToast(
              this.translate.instant("general.dataSaved"),
              "success",
              "/home"
            );
            // we should also update all wines that use have this appellation
          } else {
            this.presentToast(
              this.translate.instant("general.DBError"),
              "error",
              "/home"
            );
          }
        });
    } else {
      debug("[Vin - saveVin]vin invalid");
      this.presentToast(
        this.translate.instant("general.invalidData"),
        "error",
        null
      );
    }
  }

  public deleteAppellation() {
    let used = false;
    if (this.appellation._id) {
      this.pouch.getDocsOfType("vin").then((vins) => {
        vins.forEach((vin) => {
          if (vin.appellation._id == this.appellation._id) used = true;
        });
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
                    this.pouch.deleteDoc(this.appellation).then((response) => {
                      if (response.ok) {
                        this.presentToast(
                          this.translate.instant(
                            "appellation.appellationDeleted"
                          ),
                          "success",
                          "/home"
                        );
                      } else {
                        this.presentToast(
                          this.translate.instant(
                            "appellation.appellationNotDeleted"
                          ),
                          "error",
                          undefined
                        );
                      }
                    });
                  },
                },
              ],
            })
            .then((alert) => {
              alert.present();
            });
        } else {
          this.presentToast(
            this.translate.instant("appellation.cantDeleteBecauseUsed"),
            "error",
            null
          );
        }
      });
    }
  }

  async presentToast(message: string, type: string, nextPageUrl: string) {
    const toast = await this.toastCtrl.create({
      color: type == "success" ? "secondary" : "danger",
      message: message,
      duration: 2000,
    });
    toast.present();
    if (nextPageUrl) this.navCtrl.navigateRoot(nextPageUrl);
  }

  /* NOT USED ANYMORE after using Angular Forms*/
  /* private cleanValidatorModelObject(obj) {
    let result = {};
    for (var key in obj) {
      if (key.charAt(0) != "_" || (key == "_id" && obj[key]))
        result[key] = obj[key];
    }
    return result;
  } */
}
