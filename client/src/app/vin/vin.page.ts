import { Subject, of, merge } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';
import { Component, OnInit, OnDestroy, AfterViewInit, Input, ElementRef, ViewChild } from '@angular/core';
import { NavController, AlertController, ModalController, LoadingController, Platform } from '@ionic/angular';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PouchdbService } from '../services/pouchdb.service';
import { VinModel, AppellationModel, OrigineModel, TypeModel } from '../models/cellar.model';
import { HttpClient } from '@angular/common/http';
import * as moment from 'moment';
import { map, debounceTime, switchMap } from 'rxjs/operators';
import { ToastController } from '@ionic/angular';
import { ActivatedRoute } from '@angular/router';
import loadImage from 'blueimp-load-image/js/index';
import pica from 'pica/dist/pica.js';
import { ViewerComponent } from './viewer/viewer.component';

import * as Debugger from 'debug';
const debug = Debugger('app:vin');

@Component({
	selector: 'app-vin',
	templateUrl: './vin.page.html',
	styleUrls: [ './vin.page.scss' ]
})
export class VinPage implements OnInit, OnDestroy, AfterViewInit {
	public nbreAvantUpdate: number = 0;
	public newWine: boolean = true;
	public vin: VinModel;
	public vinsMap: Map<any, object>;
	public origines: Array<any> = [];
	public appellations: Array<any> = [];
	public types: Array<any> = [];
	public comment: string = '';
	public errors: Array<any>;
	public vinForm: FormGroup;
	public nameYearForm: FormGroup;
	public submitted: boolean;
	private obs: Subject<string> = new Subject();
	private priceRegExp: RegExp = new RegExp('^[0-9]+(,[0-9]{1,2})?$');
	private originalName;
	private originalYear;
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
		contentType: 'jpeg',
		data: new File([], 'Photo file')
	};

	/**
  * 'plug into' DOM canvas element using @ViewChild
  */
	@ViewChild('hiddenInput', { static: false }) hiddenInput: ElementRef;
	@ViewChild('photoImage', { static: false }) photoImage: any;
	@ViewChild('uploadphoto', { static: false }) inputUploader: ElementRef<HTMLInputElement>;

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
		private platform: Platform
	) {
		this.vin = new VinModel(
			'',
			'',
			'',
			'',
			0,
			0,
			0,
			'',
			'',
			'',
			'',
			[],
			'',
			new AppellationModel('', '', ''),
			new OrigineModel('', '', ''),
			new TypeModel('', ''),
			'',
			'',
			0,
			[],
			{ name: '', width: 0, heigth: 0, orientation: 1, fileType: '' }
		);
		this.pouch
			.getDocsOfType('vin')
			.then((vins) => (this.vinsMap = new Map(vins.map((v) => [ v.nom + v.annee, v ]))));

		this.vinForm = this.formBuilder.group(
			{
				nom: [ '', Validators.required ],
				annee: [
					'',
					Validators.compose([
						Validators.minLength(4),
						Validators.maxLength(4),
						Validators.pattern('[0-9]*'),
						Validators.required
					])
				],
				type: [ '', Validators.required ],
				origine: [ '', Validators.required ],
				appellation: [ '', Validators.required ],
				nbreBouteillesAchat: [ 0, Validators.required ],
				nbreBouteillesReste: [ 0, Validators.compose([ Validators.pattern('[0-9]*'), Validators.required ]) ],
				prixAchat: [
					0,
					Validators.compose([
						Validators.pattern('^[0-9]+((,[0-9]{1,2})|(.[0-9]{1,2}))?$'),
						Validators.required
					])
				],
				dateAchat: [ '', Validators.required ],
				localisation: [ '', Validators.required ],
				apogee: [ '', Validators.pattern('^[0-9]{4,4}-[0-9]{4,4}$') ],
				contenance: [ '' ],
				cepage: [ '' ],
				GWSScore: [ '' ]
			} //,
			//{ validator: this.noDouble.bind(this) }
		);
		this.submitted = false;
	}

	public ngOnInit() {
		debug('[Vin.ngOnInit]called');
		let paramId = this.route.snapshot.params['id'];

		Promise.all([
			this.pouch.getDocsOfType('origine'),
			this.pouch.getDocsOfType('appellation'),
			this.pouch.getDocsOfType('type')
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
			if (paramId) {
				this.pouch.getDoc(paramId).then((vin) => {
					this.originalName = vin.nom;
					this.originalYear = vin.annee;
					Object.assign(this.vin, vin);
					this.vinForm.setValue(
						this.reject(this.vin, [
							'_id',
							'_rev',
							'remarque',
							'history',
							'lastUpdated',
							'dateCreated',
							'cotes',
							'_attachments',
							'photo'
						])
					);
					this.vinForm.get('appellation').patchValue(this.vin.appellation._id);
					this.vinForm.controls['origine'].patchValue(this.vin.origine._id);
					this.vinForm.controls['type'].patchValue(this.vin.type._id);
					this.nbreAvantUpdate = this.vin.nbreBouteillesReste;
					this.newWine = false;
					debug('[Vin.ngOnInit]Vin loaded : ' + JSON.stringify(this.vin));
				});
			} else {
				let now = moment();
				// Search for type that correspond to "red" and use it's _id to initialize the vin attribute
				let preselectedType;
				if (this.types && this.types.length > 0) {
					preselectedType = this.types.find((e) => {
						return e.nom == 'Rouge' || e.nom == 'Red';
					});
				}
				this.vin = new VinModel(
					'',
					'',
					'',
					'',
					0,
					0,
					0,
					now.format('YYYY-MM-DD'),
					'',
					'',
					'',
					[],
					'',
					new AppellationModel('', '', ''),
					new OrigineModel('', '', ''),
					new TypeModel(
						preselectedType ? preselectedType._id : '',
						preselectedType ? preselectedType.nom : ''
					),
					'',
					'',
					0,
					[],
					{ name: '', width: 0, heigth: 0, orientation: 1, fileType: '' }
				);
			}
		});

		merge(this.vinForm.get('nom').valueChanges, this.vinForm.get('annee').valueChanges)
			.pipe(debounceTime(1000))
			.subscribe((value) => {
				debug('[ngInit]on name or year value change', +JSON.stringify(value));
				let checkDuplicate = this.noDouble(this.vinForm);
				if (checkDuplicate != null) {
					this.vinForm.setErrors({ double: true });
				}
			});
	}

	public ngAfterViewInit() {
		debug('[entering ngAfterViewInit]');
	}

	public async loadImageAndView(type: string) {
		let fileOrBlob: any;
		if (type == 'file') {
			let el = this.inputUploader.nativeElement;
			if (el) {
				fileOrBlob = el.files[0];
				this.selectedPhoto.data = fileOrBlob;
				debug('[loadImageAndView]platform : ' + this.platform.platforms());
				if (this.platform.is('ios') || this.platform.is('ipad')) {
					let now = moment();
					this.vin.photo.name = now.format('YYYY-MM-DD_hh-mm-ss') + '_img.jpeg';
				} else this.vin.photo.name = fileOrBlob.name;
			}
		}
		if (type == 'blob' && this.selectedPhoto.data.size == 0) {
			try {
				fileOrBlob = await this.pouch.db.getAttachment(this.vin._id, 'photoFile');
			} catch (err) {
				debug('[loadImageAndView]no attachemnt to load - error :', err);
			}
		} else if (type == 'blob' && this.selectedPhoto.data.size != 0) {
			fileOrBlob = this.selectedPhoto.data;
		}

		this.modalCtrl
			.create({
				component: ViewerComponent,
				componentProps: {
					fileOrBlob: fileOrBlob,
					action: type == 'file' ? 'add' : 'modify'
				},
				cssClass: 'auto-height'
			})
			.then(async (modal) => {
				modal.present();
				const { data } = await modal.onDidDismiss();
				debug('[loadImageAndView]data from image preview modal : ' + JSON.stringify(data));
				switch (data.choice) {
					case 'delete':
						this.vin.photo = { name: '', width: 0, heigth: 0, orientation: 1, fileType: '' };
						this.selectedPhoto = {
							contentType: 'jpeg',
							data: new File([], 'Photo file')
						};
						try {
							let result = await this.pouch.db.removeAttachment(this.vin._id, 'photoFile', this.vin._rev);
							debug('[loadImageAndView]delete attachment success');
						} catch (err) {
							debug('[loadImageAndView]problem to delete attachment - error : ', err);
						}
						break;
					case 'cancel':
						if (data.from == 'add') {
							this.selectedPhoto = {
								contentType: 'jpeg',
								data: new File([], 'Photo file')
							};
							this.vin.photo = { name: '', width: 0, heigth: 0, orientation: 1, fileType: '' };
						} else if (data.from == 'replace') {
							// Nothing to do
						}
						break;
					case 'replace':
						this.selectedPhoto = data.file;
						this.vin.photo.name = data.file.name;
						this.vin.photo.fileType = data.file.type;
					case 'keep':
						this.selectedPhoto.data = data.compressedBlob;
						this.selectedPhoto.contentType = data.selectedFile.type;
						this.vin.photo.name = data.selectedFile.name;
						this.vin.photo.fileType = data.selectedFile.type;
				}
			});
	}

	public ngOnDestroy() {
		debug('[Vin.ngOnDestroy]called');
		this.obs.unsubscribe();
	}

	public ionViewWillEnter() {
		debug('[Vin.ionViewWillEnter]called');
	}

	public ionViewDidLoad() {
		debug('[Vin.ionViewDidLoad]called');
	}

	public async saveVin() {
		debug('[Vin.saveVin]entering');
		this.submitted = true;
		if (this.vinForm.valid) {
			// validation succeeded
			debug('[Vin.saveVin]vin valid');
			let id = this.vin._id;
			Object.assign(this.vin, this.vinForm.value);
			//this.vin = this.vinForm.value;
			this.vin._id = id;
			this.vin.lastUpdated = new Date().toISOString();
			this.vin.appellation = this.appellations.find((appellation) => appellation._id == this.vin.appellation);
			this.vin.origine = this.origines.find((origine) => origine._id == this.vin.origine);
			this.vin.type = this.types.find((type) => type._id == this.vin.type);
			if (this.newWine) {
				this.vin.history.push({
					type: 'creation',
					difference: this.vin.nbreBouteillesReste,
					date: this.vin.lastUpdated,
					comment: ''
				});
			} else {
				if (this.vin.nbreBouteillesReste - this.nbreAvantUpdate != 0)
					this.vin.history.push({
						type: 'update',
						difference: this.vin.nbreBouteillesReste - this.nbreAvantUpdate,
						date: this.vin.lastUpdated,
						comment: ''
					});
			}
			if (this.vin.remarque && this.vin.remarque != '') {
				this.vin.history.push({
					type: 'comment',
					date: this.vin.lastUpdated,
					comment: this.vin.remarque,
					difference: 0
				});
				this.vin.remarque = '';
			}
			if (this.selectedPhoto && this.selectedPhoto.data && this.selectedPhoto.data.size != 0) {
				if (this.selectedPhoto.contentType == 'image/jpeg') {
					debug('[saveVin]saved image file size : ' + this.selectedPhoto.data.size);
					this.vin['_attachments'] = {
						photoFile: {
							content_type: 'image/jpeg',
							data: this.selectedPhoto.data
						}
					};
				} else {
					this.vin['_attachments'] = {
						photoFile: {
							content_type: this.selectedPhoto.contentType,
							data: this.selectedPhoto.data
						}
					};
				}
			}
			this.pouch.saveDoc(this.vin, 'vin').then((response) => {
				if (response.ok) {
					debug('[Vin.saveVin]vin ' + JSON.stringify(this.vin) + ' saved');
					this.presentToast(this.translate.instant('general.dataSaved'), 'success', '/home');
					//this.navCtrl.push(SearchPage)
				} else {
					this.presentToast(this.translate.instant('general.DBError'), 'error', '/home');
				}
			});
		} else {
			debug('[Vin.saveVin]vin invalid');
			this.presentToast(this.translate.instant('general.invalidData'), 'error', null);
		}
	}

	deleteVin() {
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
							this.pouch.db.deleteDoc(this.vin).then((response) => {
								if (response.ok) {
									this.presentToast(this.translate.instant('wine.wineDeleted'), 'success', '/home');
								} else {
									this.presentToast(
										this.translate.instant('wine.wineNotDeleted'),
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
	}

	public cancel() {
		this.navCtrl.back();
	}

	public showHistory() {
		this.modalCtrl.create({ component: ModalPage, componentProps: { vin: this.vin } }).then((modal) => {
			modal.present();
		});
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

	addComment() {
		this.alertController
			.create({
				header: this.translate.instant('wine.addComment'),
				//message: 'What should the title of this note be?',
				inputs: [
					{
						type: 'text',
						name: 'comment'
					}
				],
				buttons: [
					{
						text: 'Cancel'
					},
					{
						text: 'Save',
						handler: (data) => {
							debug('add comment data : ' + data);
							this.vin.remarque = data.comment;
							debug('add comment - save vin');
							this.saveVin();
						}
					}
				]
			})
			.then((alert) => {
				alert.present();
			});
	}

	public typeChange(val: any) {
		debug('type change detected');
		if (typeof val.detail.value == 'string')
			this.pouch
				.getDoc(val.detail.value)
				.then((result) => (this.vin.type = new TypeModel(result._id, result.nom)));
	}

	public origineChange(val: any) {
		debug('origine change detected');
		if (typeof val.detail.value == 'string')
			this.pouch
				.getDoc(val.detail.value)
				.then((result) => (this.vin.origine = new OrigineModel(result._id, result.pays, result.region)));
	}

	public appellationChange(val: any) {
		debug('appellation change detected');
		if (typeof val.detail.value == 'string')
			this.pouch
				.getDoc(val.detail.value)
				.then(
					(result) => (this.vin.appellation = new AppellationModel(result._id, result.courte, result.longue))
				);
	}

	public showDate(ISODateString) {
		return ISODateString.substring(0, 10);
	}

	public toNumber(attribute: string) {
		if (typeof this.vin[attribute] === 'string') {
			this.vin[attribute] = this.vin[attribute].replace(',', '.');
			this.vin[attribute] = parseFloat(this.vin[attribute]);
		}
		debug('[Vin.toNumber]' + attribute + ' changed: ' + this.vin[attribute]);
	}

	public async getGWSScore() {
		debug('[Vin.getGWSScore]called');
		const loading = await this.loadingCtrl.create({
			message: this.translate.instant('wine.fetchGWSSCore')
		});
		await loading.present();
		//        if (platforms.indexOf("core")!=-1) {
		// Create url
		let prefix = window.location.origin + '/api/';
		let url =
			prefix +
			'GWS/' +
			this.cleanForUrl(this.vin.origine.region) +
			'/' +
			this.cleanForUrl(this.vin.nom) +
			'/' +
			this.vin.annee;
		debug('[Vin.getGWSScore]url :' + url);
		this.http.get(url).subscribe(
			(GWscore: any) => {
				loading.dismiss();
				this.vinForm.patchValue({ GWSScore: GWscore.score });
				this.presentToast(this.translate.instant('wine.GWSScoreFound'), 'success', null);
			},
			(error) => {
				debug('http get error : ' + JSON.stringify(error.status));
				loading.dismiss();
				this.presentToast(
					this.translate.instant('wine.GWSScoreNotFound', {
						url:
							'https://www.globalwinescore.com/wine-score/' +
							this.cleanForUrl(this.vin.nom) +
							'-' +
							this.cleanForUrl(this.vin.origine.region) +
							'/' +
							this.vin.annee
					}),
					'error',
					null
				);
			}
		);
	}

	adjustQuantityLeft(q: number) {
		let ctrlLeft = this.vinForm.get('nbreBouteillesReste');
		let ctrlBought = this.vinForm.get('nbreBouteillesAchat');
		let nbrBought = ctrlBought.value;
		if (typeof ctrlBought.value === 'string') nbrBought = parseFloat(ctrlBought.value.replace(',', '.'));
		let newQty = ctrlLeft.value + q;
		if (typeof ctrlLeft.value === 'string') newQty = parseFloat(ctrlLeft.value.replace(',', '.')) + q;
		ctrlLeft.patchValue(Math.max(Math.min(newQty, nbrBought), 0));
	}

	async presentLoading() {
		const loading = await this.loadingCtrl.create({
			message: 'getting GWS Score'
		});
		await loading.present();
	}

	private cleanForUrl(text: string) {
		return text
			.trim()
			.toLowerCase()
			.replace(/ /g, '-')
			.replace(/'/g, '')
			.replace(/â/g, 'a')
			.replace(/é/g, 'e')
			.replace(/è/g, 'e')
			.replace(/ê/g, 'e')
			.replace(/û/g, 'u')
			.replace(/ô/g, 'o')
			.replace(/î/g, 'i');
	}

	private noDouble(group: FormGroup) {
		debug('nodouble called');
		if (!group.controls.nom || !group.controls.annee) return null;
		//		if (!group.controls.nom.dirty || !group.controls.annee.dirty) return null;
		if (group.get('nom').value == this.originalName && group.get('annee').value == this.originalYear) return null;
		let testKey = group.value.nom + group.value.annee;
		if (this.vinsMap && this.vinsMap.has(testKey)) {
			debug('[Vin.noDouble]double detected');
			return of({ double: true });
		} else return null;
	}

	private async canvasToBlob(canvas, quality: number) {
		return new Promise(function(resolve) {
			canvas.toBlob(
				function(blob) {
					return resolve(blob);
				},
				'image/jpeg',
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
		return (window.outerWidth - 100 - Math.floor(window.outerWidth / 990) * 270) * 8 / 12;
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
        {{'wine.history' | translate }}
      </ion-title>
    </ion-toolbar>
  </ion-header>
  <ion-content>
    <ion-card *ngFor="let event of vin.history">
        <ion-card-header >
            <div *ngIf="event.difference && event.difference!=0">
                {{'wine.addedExtractedOn' | translate }} : &nbsp; {{event.date}}  
            </div>
            <div *ngIf="event.comment">
                {{'wine.addedOn' | translate }} : &nbsp; {{event.date}}
            </div>
        </ion-card-header>
        <ion-card-content>
            <div *ngIf="event.difference && event.difference!=0">
                {{'wine.difference' | translate }} :&nbsp; <ion-badge item-end>{{event.difference}}</ion-badge>    
            </div>
            <div *ngIf="event.comment">
                {{'wine.comment' | translate }} : &nbsp; {{event.comment}}
            </div>
        </ion-card-content>
    </ion-card>
    <ion-button expand="full" (click)="dismiss()">Close</ion-button>
  </ion-content>
  `
})
export class ModalPage {
	@Input() vin: VinModel;

	constructor(private modalCtrl: ModalController) {}
	dismiss() {
		this.modalCtrl.dismiss();
	}
}
