import { Component, OnInit, Input } from '@angular/core';
import { PouchdbService } from '../../services/pouchdb.service';
import { ActivatedRoute } from '@angular/router';
import { VinModel } from '../../models/cellar.model';

import * as d3 from 'd3';

import * as Debugger from 'debug';
const debug = Debugger('app:rapport:years');

@Component({
	selector: 'app-years',
	templateUrl: './years.component.html',
	styleUrls: [ './years.component.scss' ]
})
export class YearsComponent implements OnInit {
	public typeView: string;
	private wines: Array<VinModel>;
	public elementList: Array<any>;
	private elementListType: string;
	public type: string;
	public origine: string;
	public breadcrumb: Array<any> = [];

	constructor(private route: ActivatedRoute, private pouchdbService: PouchdbService) {}

	ngOnInit() {
		this.route.data.subscribe((data) => {
			this.typeView = data.typeView;
		});
		this.type = this.route.snapshot.paramMap.get('type');
		this.origine = this.route.snapshot.paramMap.get('origine');

		// fectch breadcrumb
		this.breadcrumb = JSON.parse(sessionStorage.getItem('breadcrumb'));

		this.pouchdbService.getDocsOfType('vin').then((docs) => {
			this.wines = docs;
			this.elementListType = 'year';
			if (this.origine) {
				// we have the type and the origine
				this.elementList = d3
					.nest()
					.key(function(d: any) {
						return d.annee;
					})
					.rollup(function(v) {
						return d3.sum(v, function(d: any) {
							return d.nbreBouteillesReste;
						});
					})
					.entries(
						this.wines.filter(
							(w) =>
								w.nbreBouteillesReste != 0 &&
								w.type.nom == this.type &&
								w.origine.pays + ' - ' + w.origine.region == this.origine
						)
					);
				debug('elementList (type & origine selected): ' + JSON.stringify(this.elementList));
			} else {
				// we only have the type
				this.elementList = d3
					.nest()
					.key(function(d: any) {
						return d.annee;
					})
					.rollup(function(v) {
						return d3.sum(v, function(d: any) {
							return d.nbreBouteillesReste;
						});
					})
					.entries(this.wines.filter((w) => w.nbreBouteillesReste != 0 && w.type.nom == this.type));
				debug('elementList (type selected): ' + JSON.stringify(this.elementList));
			}
			this.elementList.sort((a, b) => {
				return a.key < b.key ? -1 : 1;
			});
		});
	}
}
