import { TranslateService } from '@ngx-translate/core';
import { Component, OnInit } from '@angular/core';
import { NavController, AlertController } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PouchdbService } from '../services/pouchdb.service';
import { TypeModel } from '../models/cellar.model';
import { ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';

import * as Debugger from 'debug';
const debug = Debugger('app:region');

@Component({
	selector: 'app-type',
	templateUrl: './type.page.html',
	styleUrls: [ './type.page.scss' ]
})
export class TypePage implements OnInit {
	public type: TypeModel = new TypeModel('', '');
	public typesMap: Map<any, any>;
	public typeList: Array<TypeModel> = [];
	public submitted: boolean;
	public typeForm: FormGroup;
	public newType: boolean = false;
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
		this.typeForm = formBuilder.group(
			{
				nom: [ '', Validators.required ]
			},
			{ validator: this.noDouble.bind(this) }
		);
		this.typeForm.get('nom').setValue(this.type.nom);
		this.submitted = false;
	}

	public ngOnInit() {
		debug('[ngOnInit]called');
		// We need to load the type list even if we create or modify an type because in this case we need the type list to check for doubles
		this.pouch.getDocsOfType('type').then((types) => {
			this.typesMap = new Map(types.map((el) => [ el.nom, el ]));
			this.typeList = types.sort((a, b) => {
				return a.pays + a.region < b.pays + b.region ? -1 : 1;
			});
		});
		// If we come on this page on the first time, the data object related to the 'types' route should be set to 'list', so that we get the see the list of types
		if (this.route.snapshot.data.action == 'list') {
			this.list = true;
		} else {
			// if we come on this page with the action parameter set to 'edit', this means that we either want to add a new type (id parameter is not set)
			// or edit an existing one (id parameter is set)
			this.list = false;
			if (this.route.snapshot.paramMap.get('id')) {
				this.pouch.getDoc(this.route.snapshot.paramMap.get('id')).then((type) => {
					this.type = type;
					debug('[Type - ngOnInit]Type loaded : ' + JSON.stringify(this.type));
				});
			} else this.newType = true;
		}
	}

	private noDouble(group: FormGroup) {
		debug('[Type.noDouble]nodouble called');
		if (!group.controls.nom) return null;
		if (!group.controls.nom.dirty) return null;
		let testKey = group.value.nom;
		if (this.typesMap && this.typesMap.has(testKey)) {
			debug('[Type.noDouble]double detected');
			return { double: true };
		} else return null;
	}

	public editType(type) {
		if (type._id) this.navCtrl.navigateForward([ '/type', type._id ]);
		else this.navCtrl.navigateForward([ '/type' ]);
	}

	public saveType() {
		debug('[saveType]entering');
		this.submitted = true;
		if (this.typeForm.valid) {
			// validation succeeded
			debug('[TypeVin]Type valid');
			this.pouch.saveDoc(this.cleanValidatorModelObject(this.type), 'type').then((response) => {
				if (response.ok) {
					debug('[saveType]Type ' + JSON.stringify(this.type) + 'saved');
					this.presentToast(this.translate.instant('general.dataSaved'), 'success', '/home');
				} else {
					this.presentToast(this.translate.instant('general.DBError'), 'error', '/home');
				}
			});
		} else {
			debug('[Vin - saveVin]vin invalid');
			this.presentToast(this.translate.instant('general.invalidData'), 'error', null);
		}
	}

	public deleteType() {
		let used = false;
		if (this.type._id) {
			this.pouch.getDocsOfType('vin').then((vins) => {
				vins.forEach((vin) => {
					if (vin.type._id == this.type._id) used = true;
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
										this.pouch.deleteDoc(this.type).then((response) => {
											if (response.ok) {
												this.presentToast(
													this.translate.instant('type.typeDeleted'),
													'success',
													'/home'
												);
											} else {
												this.presentToast(
													this.translate.instant('type.typeNotDeleted'),
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
					this.presentToast(this.translate.instant('type.cantDeleteBecauseUsed'), 'error', null);
				}
			});
		}
	}

	async presentToast(message: string, type: string, nextPageUrl: string) {
		const toast = await this.toastCtrl.create({
			color: type == 'success' ? 'secondary' : 'danger',
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
