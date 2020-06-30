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
				if (v.apogee) {
					let drinkFromTo = v.apogee.split('-');
					if (parseInt(drinkFromTo[0]) <= now.year() && parseInt(drinkFromTo[1]) >= now.year())
						this.readyToDrinkList.push(v);
				}
			});
		});
	}

	selectWine(wine) {
		this.router.navigate([ '/vin', wine._id ]);
	}
}
