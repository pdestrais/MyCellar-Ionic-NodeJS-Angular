import { TranslateService } from '@ngx-translate/core';
import { AuthenticationService } from './../../services/auth.service';
import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { first } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { UserManagementService } from '../../services/user-management.service';

import * as Debugger from 'debug';
const debug = Debugger('app:profile');

@Component({
	selector: 'app-resetpwd',
	templateUrl: './resetpwd.component.html',
	styleUrls: [ './resetpwd.component.scss' ]
})
export class ResetpwdComponent implements OnInit {
	resetpwdForm: FormGroup;
	loading = false;
	submitted = false;

	constructor(
		private formBuilder: FormBuilder,
		private router: Router,
		private authenticationService: AuthenticationService,
		private userManagementService: UserManagementService,
		private toastCtrl: ToastController,
		private translate: TranslateService
	) {}

	ngOnInit() {
		this.resetpwdForm = this.formBuilder.group({ username: [ '', Validators.required ] });
	}

	// convenience getter for easy access to form fields
	get f() {
		return this.resetpwdForm.controls;
	}

	onSubmit() {
		this.submitted = true;

		// stop here if form is invalid
		if (this.resetpwdForm.invalid) {
			return;
		}

		this.loading = true;
		this.userManagementService.resetPassword(this.resetpwdForm.get('username').value).pipe(first()).subscribe(
			async (data) => {
				const toast = await this.toastCtrl.create({
					color: 'success',
					message: this.translate.instant('backend.' + data.translateKey),
					duration: 3000
				});
				toast.present();
				this.router.navigate([ '/home' ]);
			},
			async (error) => {
				const toast = await this.toastCtrl.create({
					color: 'danger',
					message: error.error.code ? this.translate.instant('backend.' + error.error.code) : error.message,
					duration: 3000
				});
				toast.present();
				this.loading = false;
			}
		);
	}
}
