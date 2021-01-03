import { TranslateService } from '@ngx-translate/core';
import { UserManagementService } from './../../services/user-management.service';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthenticationService } from '../../services/auth.service';
import { FormBuilder, FormGroup, Validators, FormControl } from '@angular/forms';
import { first } from 'rxjs/operators';
import { ToastController, AlertController } from '@ionic/angular';

import * as Debugger from 'debug';
const debug = Debugger('app:register');

@Component({
	selector: 'app-register',
	templateUrl: './register.component.html',
	styleUrls: [ './register.component.scss' ]
})
export class RegisterComponent implements OnInit {
	registerForm: FormGroup;
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
	) {
		// redirect to home if already logged in
		if (this.authenticationService.currentUserValue && !this.authenticationService.currentUserValue.admin) {
			this.router.navigate([ '/' ]);
		}
	}

	ngOnInit() {
		this.registerForm = this.formBuilder.group(
			{
				firstName: [ '', Validators.required ],
				lastName: [ '', Validators.required ],
				username: [
					'',
					[
						Validators.required,
						Validators.minLength(6),
						Validators.pattern('^[a-z]+$'),
						this.noWhitespaceValidator
					]
				],
				password: [ '', [ Validators.required, Validators.minLength(6) ] ],
				confirm: [ '', [ Validators.required, Validators.minLength(6) ] ],
				email: [
					'',
					[ Validators.required, Validators.pattern('^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+.[a-zA-Z0-9-.]+$') ]
				]
			},
			{
				validator: this.passwordValidator('password', 'confirm')
			}
		);
	}

	passwordValidator(formCtrlOne, formCtrlTwo) {
		return (fg: FormGroup) => {
			// Select the two form conrols from the form group
			// on which the comparison is to be performed.
			const fieldOne = fg.controls[formCtrlOne];
			const fieldTwo = fg.controls[formCtrlTwo];
			if (fieldOne && fieldTwo) {
				if (fieldOne.value || fieldTwo.value) {
					if (fieldOne.value !== fieldTwo.value) {
						// Use set error methods like this to append
						// 'password_mismatch' error
						// with the existing errors.
						fieldOne.setErrors({
							...fieldOne.errors,
							...{ password_mismatch: true }
						});
						fieldTwo.setErrors({
							...fieldTwo.errors,
							...{ password_mismatch: true }
						});
					} else {
						let fieldOneError = { ...fieldOne.errors };
						delete fieldOneError['password_mismatch'];
						// If there is no keys in the error object,
						// it means that the control has no error
						// In that case set the object as null
						// Setting null as error to a form field
						// makes the form control valid
						fieldOneError = Object.keys(fieldOneError).length > 0 ? fieldOneError : null;
						fieldOne.setErrors(fieldOneError);

						let fieldTwoError = { ...fieldTwo.errors };
						delete fieldTwoError['password_mismatch'];
						fieldTwoError = Object.keys(fieldTwoError).length > 0 ? fieldTwoError : null;
						fieldTwo.setErrors(fieldTwoError);
					}
				}
			}
		};
	}

	noWhitespaceValidator(control: FormControl) {
		const isSpace = (control.value || '').match(/\s/g);
		return isSpace ? { whitespace: true } : null;
	}

	// convenience getter for easy access to form fields
	get f() {
		return this.registerForm.controls;
	}

	onSubmit() {
		this.submitted = true;

		// stop here if form is invalid
		if (this.registerForm.invalid) {
			return;
		}

		this.loading = true;
		this.userManagementService.processSignupRequest(this.registerForm.value).pipe(first()).subscribe(
			(data) => {
				this.toastCtrl
					.create({
						color: 'success',
						message: this.translate.instant('backend.' + data.translateKey),
						duration: 5000
					})
					.then((toast) => toast.present());
				this.router.navigate([ '/home' ]);
			},
			(error) => {
				let errMessage;
				if (error.error) {
					if (error.error.type == 'business') {
						this.alertController
							.create({
								header: 'Alert',
								subHeader: this.translate.instant('backend.' + error.error.code + '-short'),
								message: this.translate.instant('backend.' + error.error.code),
								buttons: [
									{
										text: 'Ok',
										handler: () => {
											// store temporary in session that the use wants to work with a local DB
										}
									}
								]
							})
							.then((alert) => alert.present());
					} else errMessage = this.translate.instant('backend.' + error.error.code);
				} else {
					errMessage = error.message;
				}
				this.toastCtrl
					.create({
						color: 'danger',
						message: errMessage,
						duration: 3000
					})
					.then((toast) => toast.present());
				this.loading = false;
			}
		);
	}
}
