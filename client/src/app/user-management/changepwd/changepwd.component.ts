import { TranslateService } from '@ngx-translate/core';
import { AuthenticationService } from './../../services/auth.service';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators, ValidatorFn } from '@angular/forms';
import { first } from 'rxjs/operators';
import { ToastController, AlertController } from '@ionic/angular';
import { UserManagementService } from '../../services/user-management.service';

import * as Debugger from 'debug';
const debug = Debugger('app:changepwd');

const confirmPwdValidator: ValidatorFn = (fg: FormGroup) => {
	const newpwd = fg.get('newPassword').value;
	const confirmpwd = fg.get('confirmationPassword').value;
	return !(newpwd == null || newpwd == '') && !(confirmpwd == null || confirmpwd == '') && newpwd != confirmpwd
		? { confirmpwdnotequalnewpwd: true }
		: null;
};

@Component({
	selector: 'app-changepwd',
	templateUrl: './changepwd.component.html',
	styleUrls: [ './changepwd.component.scss' ]
})
export class ChangepwdComponent implements OnInit {
	public changepwdForm: FormGroup;
	loading = false;
	submitted = false;

	constructor(
		private formBuilder: FormBuilder,
		private router: Router,
		private authenticationService: AuthenticationService,
		private userManagementService: UserManagementService,
		private toastCtrl: ToastController,
		private alertController: AlertController,
		private translate: TranslateService
	) {}

	ngOnInit() {
		debug('[ngOnInit entering]');
		this.changepwdForm = this.formBuilder.group(
			{
				confirmationPassword: [ '', Validators.required ],
				oldPassword: [ '', Validators.required ],
				//			newPassword: [ '', [ Validators.required, confirmPwdValidator ] ]
				newPassword: [ '', Validators.required ]
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
		this.userManagementService
			.changePassword(
				this.authenticationService.currentUserValue.username,
				this.changepwdForm.get('oldPassword').value,
				this.changepwdForm.get('newPassword').value
			)
			//			.pipe(first())
			.subscribe(
				async (data) => {
					debug('[data handling] ' + data);
					const toast = await this.toastCtrl.create({
						color: 'success',
						message: this.translate.instant('backend.' + data.translateKey),
						duration: 3000
					});
					toast.present();
					this.router.navigate([ '/home' ]);
				},
				async (error) => {
					let errMessage;

					if (error.error) {
						if (error.error.type == 'business' && error.error.code != 'BadPassword') {
							const alert = await this.alertController.create({
								header: 'Alert',
								subHeader: this.translate.instant('backend.' + error.error.code + '-short'),
								message: this.translate.instant('backend.' + error.error.code),
								buttons: [
									{
										text: 'Ok',
										handler: () => {
											// store temporary in session that the use wants to work with a local DB
											this.router.navigate([ '/home' ]);
										}
									}
								]
							});
							alert.present();
						} else errMessage = this.translate.instant('backend.' + error.error.code);
					} else {
						errMessage = error.message;
					}
					const toast = await this.toastCtrl.create({
						color: 'danger',
						message: errMessage,
						duration: 3000
					});
					toast.present();
					this.loading = false;
				}
			);
	}
}
