import { Component, OnInit } from '@angular/core';

@Component({
	selector: 'app-about',
	templateUrl: './about.page.html',
	styleUrls: [ './about.page.scss' ]
})
export class AboutPage implements OnInit {
	public appInfo: any = {
		name: 'MyCellar',
		version: '3.0',
		author: 'Philippe Destrais',
		ionic: '5',
		angular: '9'
	};

	constructor() {}

	ngOnInit() {}
}
