import { TranslateService } from "@ngx-translate/core";
import { AuthenticationService } from "./../../services/auth.service";
import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import {
    FormBuilder,
    FormGroup,
    Validators,
    ValidatorFn,
    AbstractControl,
    ValidationErrors,
} from "@angular/forms";
import { first } from "rxjs/operators";
import {
    ToastController,
    AlertController,
    LoadingController,
} from "@ionic/angular/standalone";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { ReactiveFormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { UserManagementService } from "../../services/user-management.service";
import { PouchdbService } from "./../../services/pouchdb.service";

import Debugger from "debug";
const debug = Debugger("app:changepwd");

const confirmPwdValidator: ValidatorFn = (
    control: AbstractControl
): ValidationErrors | null => {
    const newpwd = control.get("newPassword")!.value;
    const confirmpwd = control.get("confirmationPassword")!.value;
    return !(newpwd == null || newpwd == "") &&
        !(confirmpwd == null || confirmpwd == "") &&
        newpwd != confirmpwd
        ? { confirmpwdnotequalnewpwd: true }
        : null;
};

@Component({
    selector: "app-changepwd",
    templateUrl: "./changepwd.component.html",
    styleUrls: ["./changepwd.component.scss"],
    standalone: true,
    imports: [CommonModule, IonicModule, ReactiveFormsModule, TranslateModule]
})
export class ChangepwdComponent implements OnInit {
    public changepwdForm!: FormGroup;
    loading = false;
    submitted = false;
    loadingOverlay!: HTMLIonLoadingElement;
    returnUrl: string = "/";
    cloudantURL = "https://";

    constructor(
        private formBuilder: FormBuilder,
        private router: Router,
        private authenticationService: AuthenticationService,
        private userManagementService: UserManagementService,
        private toastCtrl: ToastController,
        private alertController: AlertController,
        private loadingCtrl: LoadingController,
        private dataService: PouchdbService,
        private translate: TranslateService
    ) { }

    ngOnInit() {
        debug("[ngOnInit entering]");
        this.changepwdForm = this.formBuilder.group(
            {
                confirmationPassword: ["", Validators.required],
                oldPassword: ["", Validators.required],
                //			newPassword: [ '', [ Validators.required, confirmPwdValidator ] ]
                newPassword: ["", Validators.required],
            },
            { validator: confirmPwdValidator }
        );
    }

    // convenience getter for easy access to form fields
    get f() {
        return this.changepwdForm.controls;
    }

    onSubmit() {
        this.submitted = true;

        // stop here if form is invalid
        if (this.changepwdForm.invalid) {
            return;
        }

        this.loading = true;
        if (this.authenticationService.currentUserValue) {
            this.userManagementService
                .changePassword(
                    this.authenticationService.currentUserValue.username,
                    this.changepwdForm.get("oldPassword")!.value,
                    this.changepwdForm.get("newPassword")!.value
                )
                //			.pipe(first())
                .subscribe(
                    async (data) => {
                        debug("[data handling] " + data);
                        const toast = await this.toastCtrl.create({
                            color: "success",
                            message: this.translate.instant("backend." + data.translateKey),
                            duration: 3000,
                        });
                        toast.present();
                        let previousUser = JSON.parse(
                            localStorage.getItem("previousUser")!
                        ) || { username: "" };
                        if (data.user.username != previousUser.username) {
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
                            let subscription = this.dataService.dbEvents$.subscribe(
                                async (event) => {
                                    if (
                                        event.eventType == "dbReplicationCompleted" ||
                                        event.eventType == "dbSynchronized"
                                    ) {
                                        debug("[ngOnInit] replication is finished");
                                        this.loadingOverlay.dismiss();
                                        const toast = await this.toastCtrl.create({
                                            color: "success",
                                            message: this.translate.instant("config.syncOKMessage"),
                                            duration: 3000,
                                        });
                                        toast.present();
                                        this.router.navigate([this.returnUrl]);
                                        subscription.unsubscribe();
                                    }
                                    if (
                                        event.eventType == "dbReplicationFailed" ||
                                        event.eventType == "dbSyncFailed"
                                    ) {
                                        debug("[ngOnInit] replication failed");
                                        const toast = await this.toastCtrl.create({
                                            color: "danger",
                                            message: this.translate.instant("config.syncKOMessage", {
                                                errorMessage: JSON.stringify(event.error),
                                            }),
                                            duration: 3000,
                                        });
                                        toast.present();
                                        subscription.unsubscribe();
                                    }
                                }
                            );
                            this.dataService.remote = this.cloudantURL;
                            localStorage.setItem(
                                "myCellar.remoteDBURL",
                                this.dataService.remote
                            );
                            this.dataService.replicateRemoteToLocal();
                        }

                        this.router.navigate(["/home"]);
                    },
                    async (error) => {
                        let errMessage;

                        if (error.error) {
                            if (
                                error.error.type == "business" &&
                                error.error.code != "BadPassword"
                            ) {
                                const alert = await this.alertController.create({
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
                                                this.router.navigate(["/home"]);
                                            },
                                        },
                                    ],
                                });
                                alert.present();
                            } else
                                errMessage = this.translate.instant(
                                    "backend." + error.error.code
                                );
                        } else {
                            errMessage = error.message;
                        }
                        const toast = await this.toastCtrl.create({
                            color: "danger",
                            message: errMessage,
                            duration: 3000,
                        });
                        toast.present();
                        this.loading = false;
                    }
                );
        }
    }
}
