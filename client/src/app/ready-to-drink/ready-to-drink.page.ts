import { Component, OnInit } from '@angular/core';
import { PouchdbService } from '../services/pouchdb.service';
import { VinModel } from '../models/cellar.model';
import * as moment from 'moment';
import { Router } from '@angular/router';

import * as Debugger from 'debug';
const debug = Debugger('app:readytodrink');

@Component({
	selector: 'app-ready-to-drink',
	templateUrl: './ready-to-drink.page.html',
	styleUrls: [ './ready-to-drink.page.scss' ]
})
export class ReadyToDrinkPage implements OnInit {
	public readyToDrinkList: Array<VinModel>;

	constructor(private router: Router, private PouchdbService: PouchdbService) {}

	ngOnInit() {
		debug('[ngOnInit]entering');
		let now = moment();
		this.readyToDrinkList = [];
		this.PouchdbService.getDocsOfType('vin').then((vins) => {
			vins.forEach((v) => {
				if (v.apogee && v.nbreBouteillesReste > 0) {
					let drinkFromTo = v.apogee.split('-');
					if (parseInt(drinkFromTo[0]) <= now.year() && parseInt(drinkFromTo[1]) >= now.year()) {
						v.apogeeTo = drinkFromTo[1];
						if (v.apogeeTo - now.year() <= 0) v.color = 'danger';
						else if (v.apogeeTo - now.year() > 0 && v.apogeeTo - now.year() <= 2) v.color = 'warning';
						else v.color = 'light';
						this.readyToDrinkList.push(v);
					}
				}
			});
			this.readyToDrinkList.sort((a: any, b: any) => a.apogeeTo - b.apogeeTo);
		});
	}

	selectWine(wine) {
		this.router.navigate([ '/vin', wine._id ]);
	}
}
