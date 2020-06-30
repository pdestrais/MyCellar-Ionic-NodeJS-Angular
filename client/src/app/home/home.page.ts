import { Component, OnInit } from '@angular/core';
import { AlertController, NavController, MenuController } from '@ionic/angular';
import { PouchdbService } from '../services/pouchdb.service';
import { filter, debounce } from 'rxjs/operators';
import { NgZone } from '@angular/core';
import { VinModel } from '../models/cellar.model';

import * as Debugger from 'debug';
import { interval } from 'rxjs';
const debug = Debugger('app:home');

@Component({
	selector: 'app-home',
	templateUrl: 'home.page.html',
	styleUrls: [ 'home.page.scss' ]
})
export class HomePage implements OnInit {
	public wines: Array<VinModel> = [];
	public isInStock: boolean = true;
	public loading: boolean = true;
	public filteredWines: Array<VinModel> = [];
	public searchTerm: string = '';
	public selectedWine: VinModel;

	constructor(
		private dataService: PouchdbService,
		private alertCtrl: AlertController,
		private menuCtrl: MenuController,
		private navCtrl: NavController,
		private zone: NgZone
	) {}

	async alertNoRemoteDB() {
		const alert = await this.alertCtrl.create({
			header: 'Alert',
			subHeader: 'No Cloudant DB defined',
			message:
				'No Cloudant remote DB is defined to store your notes. Only the local storage will be used and no synchronization between devices will be possible.',
			buttons: [
				{
					text: 'Ok',
					handler: () => {
						// store temporary in session that the use wants to work with a local DB
						window.localStorage.setItem('localUse', 'true');
						console.log('Confirm Ok');
					}
				},
				{
					text: 'Configure Cloudant DB',
					handler: () => {
						this.navCtrl.navigateForward('/preferences');
						console.log('Confirm Cancel');
					}
				}
			]
		});

		await alert.present();
	}

	ngOnInit() {
		debug('[ngOnInit] entering method');
		this.loading = true;

		// Most of the time, we just have to load the notes data
		this.getAllWines();
		// but sometime we have to load the notes data after the synchronizatioin with a remote db is finished or when database service hooks have been applied
		this.dataService.dbEvents$
			.pipe(
				filter(
					(event) =>
						event.eventType == 'dbReplicationCompleted' ||
						event.eventType == 'docDelete' ||
						event.eventType == 'docUpdate' ||
						event.eventType == 'docInsert' ||
						event.eventType == 'winesReadyToLoad'
				),
				debounce(() => interval(100))
			)
			.subscribe((event) => {
				this.getAllWines();
				debug('[ngOnInit - observed event message]' + JSON.stringify(event) + ' - loading wines');
			});
		// and sometime, there is no synchronization defined
		let result = window.localStorage.getItem('myCellar.remoteDBURL');
		if (!result || !result.startsWith('http')) {
			debug('[ngOnInit] no remote db initialized, using local database');
			// check if this choice hasn't been done already in the past (in a previous session on this browser). If not, ask to choose.
			if (!window.localStorage.getItem('localUse')) this.alertNoRemoteDB();
		}
	}

	getAllWines() {
		this.dataService
			.getDocsOfType('vin')
			.then((data) => {
				this.wines = data;
				this.loading = false;
				//debug('[getAllWines] all wines loaded into component ' + JSON.stringify(this.wines));
			})
			.catch((error) => {
				console.error('[getAllWines]problem to load vins - error : ' + JSON.stringify(error));
			});
	}

	onInStockChange() {
		this.isInStock = !this.isInStock;
		this.setFilteredItems();
	}

	cancelSearch() {
		this.searchTerm = '';
		this.filteredWines = [];
	}

	setFilteredItems() {
		this.filteredWines = this.wines.filter((item) => {
			if (this.isInStock)
				return (
					item.nom.toLowerCase().indexOf(this.searchTerm.toLowerCase()) > -1 &&
					item.nbreBouteillesReste > 0 &&
					this.searchTerm.length > 2
				);
			else
				return item.nom.toLowerCase().indexOf(this.searchTerm.toLowerCase()) > -1 && this.searchTerm.length > 2;
		});
	}

	goToVin(params) {
		if (!params) params = {};
		this.navCtrl.navigateForward('/vin/' + params);
		/* 		this.navCtrl.setRoot(VinPage,{id:params});
 */
	}
}
