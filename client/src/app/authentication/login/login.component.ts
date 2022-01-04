import { PouchdbService } from "./../../services/pouchdb.service";
import { Component, OnInit } from "@angular/core";
import { Router, ActivatedRoute } from "@angular/router";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { first } from "rxjs/operators";

import { AuthenticationService } from "../../services/auth.service";
import {
  ToastController,
  LoadingController,
  AlertController,
} from "@ionic/angular";

import * as Debugger from "debug";
import { TranslateService } from "@ngx-translate/core";
import { environment } from "../../../environments/environment";

const debug = Debugger("app:login");

@Component({
  templateUrl: "login.component.html",
  styleUrls: ["login.component.scss"],
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  submitted = false;
  returnUrl: string;
  loadingOverlay: HTMLIonLoadingElement;
  cloudantURL = "https://";
  version = environment.version;

  constructor(
    private formBuilder: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private authenticationService: AuthenticationService,
    private toastCtrl: ToastController,
    private alertController: AlertController,
    private translate: TranslateService,
    private loadingCtrl: LoadingController,
    private dataService: PouchdbService
  ) {
    // redirect to home if already logged in
    if (this.authenticationService.currentUserValue) {
      this.router.navigate(["/"]);
    }
  }

  ngOnInit() {
    debug("[ngOnInit]Entering");
    this.loginForm = this.formBuilder.group({
      username: ["", Validators.required],
      password: ["", Validators.required],
    });
    this.loginForm.reset();

    // get return url from route parameters or default to '/'
    this.returnUrl = this.route.snapshot.queryParams["returnUrl"] || "/";
  }

  // convenience getter for easy access to form fields
  get f() {
    return this.loginForm.controls;
  }

  onSubmit() {
    this.submitted = true;

    // stop here if form is invalid
    if (this.loginForm.invalid) {
      return;
    }

    this.loading = true;
    this.authenticationService
      .login(this.f.username.value, this.f.password.value)
      .pipe(first())
      .subscribe(
        (data) => {
          debug("[onSubmit]Login request returns : " + JSON.stringify(data));
          if (data.action == "changePassword") {
            // If the login apii call sends an action field set to 'changePassword', we need to force the user to change his password
            this.presentToast(
              this.translate.instant("login.forcedPasswordChange"),
              "success",
              "/user-management/changepwd"
            );
          } else {
            debug(
              "[onSubmit]user just logged in - returning to " +
                this.returnUrl +
                " after login"
            );
            /* let previousUser = JSON.parse(
              localStorage.getItem("previousUser")
            ) || { username: "" }; */
            /* if (data.username != previousUser.username) { */
            this.cloudantURL =
              this.cloudantURL +
              data.user.dbUser +
              ":" +
              data.user.dbPassword +
              "@" +
              data.user.dbServer +
              "/cellar$" +
              data.user.username;
            debug(
              "[onSubmit] reloading local database from : " + this.cloudantURL
            );
            this.loadingCtrl
              .create({ message: "loading database" })
              .then((overlay) => {
                this.loadingOverlay = overlay;
                this.loadingOverlay.present();
              });
            let subscription = this.dataService.dbEvents$.subscribe((event) => {
              if (
                event.eventType == "dbReplicationCompleted" ||
                event.eventType == "dbSynchronized"
              ) {
                debug("[ngOnInit] replication is finished");
                this.loadingOverlay.dismiss();
                this.presentToast(
                  this.translate.instant("config.syncOKMessage"),
                  "success",
                  null
                );
                this.router.navigate([this.returnUrl]);
                subscription.unsubscribe();
              }
              if (
                event.eventType == "dbReplicationFailed" ||
                event.eventType == "dbSyncFailed"
              ) {
                debug("[ngOnInit] replication failed");
                this.presentToast(
                  this.translate.instant("config.syncKOMessage", {
                    errorMessage: JSON.stringify(event.error),
                  }),
                  "danger",
                  null
                );
                subscription.unsubscribe();
              }
            });
            this.dataService.remote = this.cloudantURL;
            debug(
              "[onSubmit]remote db resulting from login is : " +
                this.dataService.remote
            );
            localStorage.setItem(
              "myCellar.remoteDBURL",
              this.dataService.remote
            );
            this.dataService.replicateRemoteToLocal();
            /* } */
          }
        },
        (error) => {
          let errMessage;

          if (error.error) {
            if (error.error.type == "business") {
              if (
                error.error.code == "PendingResetPassword" ||
                error.error.code == ""
              ) {
                this.alertController
                  .create({
                    header: "Alert",
                    subHeader: this.translate.instant(
                      "backend." + error.error.code + "-short"
                    ),
                    message: this.translate.instant(
                      "backend." + error.error.code
                    ),
                    buttons: [
                      {
                        text: "Ok",
                        handler: () => {
                          // store temporary in session that the use wants to work with a local DB
                          this.router.navigate(["/login"]);
                        },
                      },
                    ],
                  })
                  .then((alert) => alert.present());
              }
            }
            errMessage = this.translate.instant("backend." + error.error.code);
          } else {
            errMessage = error.message;
          }
          this.toastCtrl
            .create({
              color: "danger",
              message: errMessage,
              duration: 3000,
            })
            .then((toast) => toast.present());
          this.loading = false;
        }
      );
  }

  async presentToast(message: string, type: string, nextPageUrl: string) {
    const toast = await this.toastCtrl.create({
      color: type == "success" ? "secondary" : "danger",
      message: message,
      duration: 3000,
    });
    toast.present();
    if (nextPageUrl) this.router.navigate([nextPageUrl]);
  }
}
