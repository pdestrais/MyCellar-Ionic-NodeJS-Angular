import { TranslateService } from "@ngx-translate/core";
import { AuthenticationService } from "./../../services/auth.service";
import { Component, OnInit } from "@angular/core";
import { Router } from "@angular/router";
import { FormBuilder, FormGroup, Validators } from "@angular/forms";
import { first } from "rxjs/operators";
import { ToastController } from "@ionic/angular/standalone";
import { UserManagementService } from "../../services/user-management.service";
import { CommonModule } from "@angular/common";
import { IonicModule } from "@ionic/angular";
import { ReactiveFormsModule } from "@angular/forms";
import { TranslateModule } from "@ngx-translate/core";
import { RouterModule } from "@angular/router";

import Debugger from "debug";
const debug = Debugger("app:profile");

@Component({
    selector: "app-profile",
    templateUrl: "./profile.component.html",
    styleUrls: ["./profile.component.scss"],
    standalone: true,
    imports: [CommonModule, IonicModule, ReactiveFormsModule, TranslateModule, RouterModule]
})
export class ProfileComponent implements OnInit {
    profileForm!: FormGroup;
    loading = false;
    submitted = false;

    constructor(
        private formBuilder: FormBuilder,
        private router: Router,
        private authenticationService: AuthenticationService,
        private userManagementService: UserManagementService,
        private toastCtrl: ToastController,
        private translate: TranslateService
    ) { }

    ngOnInit() {
        this.profileForm = this.formBuilder.group({
            firstname: ["", Validators.required],
            lastname: ["", Validators.required],
            username: ["", Validators.required],
            email: [
                "",
                [
                    Validators.required,
                    Validators.pattern("^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$"),
                ],
            ],
        });
        if (this.authenticationService.currentUserValue) {
            this.profileForm.setValue({
                firstname: this.authenticationService.currentUserValue.firstname,
                lastname: this.authenticationService.currentUserValue.lastname,
                username: this.authenticationService.currentUserValue.username,
                email: this.authenticationService.currentUserValue.email,
            });
            debug("[finishing ngOnInit() ] " + this.profileForm.get("username"));
        }
    }

    // convenience getter for easy access to form fields
    get f() {
        return this.profileForm.controls;
    }

    onSubmit() {
        this.submitted = true;

        // stop here if form is invalid
        if (this.profileForm.invalid) {
            return;
        }

        this.loading = true;
        this.userManagementService
            .updateUserData(this.profileForm.value)
            .pipe(first())
            .subscribe(
                async (data) => {
                    const toast = await this.toastCtrl.create({
                        color: "success",
                        message: this.translate.instant("backend." + data.translateKey),
                        duration: 3000,
                    });
                    toast.present();
                    this.router.navigate(["/home"]);
                },
                async (error) => {
                    const toast = await this.toastCtrl.create({
                        color: "danger",
                        message: error.error.code
                            ? this.translate.instant("backend." + error.error.code)
                            : error.message,
                        duration: 3000,
                    });
                    toast.present();
                    this.loading = false;
                }
            );
    }
}
