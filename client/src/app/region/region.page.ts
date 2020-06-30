import { TranslateService } from '@ngx-translate/core';
import { Component, OnInit } from '@angular/core';
import { NavController, AlertController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PouchdbService } from '../services/pouchdb.service';
import { OrigineModel } from '../models/cellar.model';
import { ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';

import * as Debugger from 'debug';
const debug = Debugger('app:region');

@Component({
	selector: 'app-region',
	templateUrl: './region.page.html',
	styleUrls: [ './region.page.scss' ]
})
export class RegionPage implements OnInit {
	public origine: OrigineModel = new OrigineModel('', '', '');
	public origineList: Array<OrigineModel> = [];
	public submitted: boolean;
	public origineForm: FormGroup;
	public newOrigine: boolean = false;
	public list: boolean = true;

	constructor(
		private route: ActivatedRoute,
		private navCtrl: NavController,
		private pouch: PouchdbService,
		private formBuilder: FormBuilder,
		private translate: TranslateService,
		private alertController: AlertController,
		private toastCtrl: ToastController
	) {
		this.origineForm = this.formBuilder.group(
			{
				pays: [ '', Validators.required ],
				region: [ '', Validators.required ]
			},
			{ asyncValidator: this.noDouble.bind(this) }
		);
		this.submitted = false;
		this.origineForm.setValue({ pays: this.origine.pays, region: this.origine.region });
	}

	public ngOnInit() {
		debug('[ngOnInit]called');
		// We need to load the origine list even if we create or modify an origine because in this case we need the origine list to check for doubles
		this.pouch.getDocsOfType('origine').then((origines) => {
			this.origineList = origines.sort((a, b) => {
				return a.pays + a.region < b.pays + b.region ? -1 : 1;
			});
		});
		// If we come on this page on the first time, the data object related to the 'origines' route should be set to 'list', so that we get the see the list of origines
		if (this.route.snapshot.data.action == 'list') {
			this.list = true;
		} else {
			// if we come on this page with the action parameter set to 'edit', this means that we either want to add a new origine (id parameter is not set)
			// or edit an existing one (id parameter is set)
			this.list = false;
			if (this.route.snapshot.paramMap.get('id')) {
				this.pouch.getDoc(this.route.snapshot.paramMap.get('id')).then((origine) => {
					this.origine = origine;
					debug('[Origine - ngOnInit]Origine loaded : ' + JSON.stringify(this.origine));
				});
			} else this.newOrigine = true;
		}
	}

	private noDouble(group: FormGroup) {
		return new Promise((resolve) => {
			debug('form valid ? : ' + group.valid);
			if (!group.controls.pays || !group.controls.region) resolve(null);
			if (!group.controls.pays.dirty || !group.controls.region.dirty) return null;
			let pays = group.value.pays;
			let region = group.value.region;
			this.origineList.map((o) => {
				if (o.pays == pays && o.region == region) {
					debug('[Region.noDouble]double detected');
					resolve({ double: true });
				}
			});
			resolve(null);
		});
	}

	public editOrigine(origine) {
		if (origine._id) this.navCtrl.navigateForward([ '/region', origine._id ]);
		else this.navCtrl.navigateForward([ '/region' ]);
	}

	public saveOrigine() {
		debug('[saveOrigine]entering');
		this.submitted = true;
		if (this.origineForm.valid) {
			// validation succeeded
			debug('[OrigineVin]Origine valid');
			this.pouch.saveDoc(this.cleanValidatorModelObject(this.origine), 'origine').then((response) => {
				if (response.ok) {
					debug('[saveOrigine]Origine ' + JSON.stringify(this.origine) + 'saved');
					this.presentToast(this.translate.instant('general.dataSaved'), 'success', '/home');
					// we should also update all wines that use have this origine. If we don't do it, our report by type, origine, ... or PDF could be wrong ..
					// or we adjust the wines loading process to include the latest versions of the type, appellations, origines based on the stored id
					// (which doesn't change if we update the origin for example)
				} else {
					this.presentToast(this.translate.instant('general.DBError'), 'error', '/home');
				}
			});
		} else {
			debug('[Vin - saveVin]vin invalid');
			this.presentToast(this.translate.instant('general.invalidData'), 'error', null);
		}
	}

	public deleteOrigine() {
		let used = false;
		if (this.origine._id) {
			this.pouch.getDocsOfType('vin').then((vins) => {
				vins.forEach((vin) => {
					if (vin.origine._id == this.origine._id) used = true;
				});
				if (!used) {
					this.alertController
						.create({
							header: this.translate.instant('general.confirm'),
							message: this.translate.instant('general.sure'),
							buttons: [
								{
									text: this.translate.instant('general.cancel')
								},
								{
									text: this.translate.instant('general.ok'),
									handler: () => {
										this.pouch.deleteDoc(this.origine).then((response) => {
											if (response.ok) {
												this.presentToast(
													this.translate.instant('origine.origineDeleted'),
													'success',
													'/home'
												);
											} else {
												this.presentToast(
													this.translate.instant('origine.origineNotDeleted'),
													'error',
													undefined
												);
											}
										});
									}
								}
							]
						})
						.then((alert) => {
							alert.present();
						});
				} else {
					this.presentToast(this.translate.instant('origine.cantDeleteBecauseUsed'), 'error', null);
				}
			});
		}
	}

	async presentToast(message: string, origine: string, nextPageUrl: string) {
		const toast = await this.toastCtrl.create({
			color: origine == 'success' ? 'secondary' : 'danger',
			message: message,
			duration: 2000
		});
		toast.present();
		if (nextPageUrl) this.navCtrl.navigateRoot(nextPageUrl);
	}

	private cleanValidatorModelObject(obj) {
		let result = {};
		for (var key in obj) {
			if (key.charAt(0) != '_' || (key == '_id' && obj[key])) result[key] = obj[key];
		}
		return result;
	}
}
