import { Component, OnInit } from "@angular/core";
import { environment } from "../../environments/environment";

@Component({
  selector: "app-about",
  templateUrl: "./about.page.html",
  styleUrls: ["./about.page.scss"],
})
export class AboutPage implements OnInit {
  public appInfo: any = {
    name: "MyCellar",
    version: environment.version,
    author: "Philippe Destrais",
    ionic: environment.ionic,
    angular: environment.angular,
  };

  constructor() {}

  ngOnInit() {}
}
