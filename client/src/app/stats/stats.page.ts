import { Component, OnInit, NgZone, ViewEncapsulation } from "@angular/core";
import { TranslateService } from "@ngx-translate/core";
import { Router } from "@angular/router";
import { VinModel } from "../models/cellar.model";
import { PouchdbService } from "../services/pouchdb.service";
import * as d3 from "d3";
import * as d3scale from "d3-scale";
import * as d3shape from "d3-shape";
import * as d3select from "d3-selection";
import { Store, select } from "@ngrx/store";
import { AppState } from "../state/app.state";
import * as VinSelectors from "../state/vin/vin.selectors";
import * as VinActions from "../state/vin/vin.actions";

@Component({
    selector: "app-stats",
    templateUrl: "./stats.page.html",
    styleUrls: ["./stats.page.scss"],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})
export class StatsPage implements OnInit {
  private total: number = 0;
  public dataset: Array<any> = [];
  private vins: Array<VinModel> = [];
  public from: number = 0;
  public to: number = 1;
  private margin: any;
  private width: number = 0;
  private height: number = 0;
  public fromOptions: Array<any>;
  public toOptions: Array<any>;
  private colors: any;
  public ready: boolean = false;

  constructor(
    public router: Router,
    private translate: TranslateService,
    private zone: NgZone,
    private store: Store<AppState>
  ) {
    this.fromOptions = [
      { value: 0, display: this.translate.instant("stats.now") },
      { value: 1, display: this.translate.instant("stats.oneYear") },
      { value: 2, display: this.translate.instant("stats.twoYears") },
      { value: 3, display: this.translate.instant("stats.threeYears") },
    ];
    this.toOptions = [
      { value: 1, display: this.translate.instant("stats.oneYear") },
      { value: 2, display: this.translate.instant("stats.twoYears") },
      { value: 3, display: this.translate.instant("stats.threeYears") },
    ];
  }

  ngOnInit() {
    this.store.dispatch(VinActions.loadVins());
    this.store.pipe(select(VinSelectors.getAllVins)).subscribe((wineList) => {
      this.vins = Array.from(wineList.values());
      console.log("[Stats]" + this.vins.length + " wines loaded");
    });
  }

  draw() {
    this.zone.run(() => {
      this.prepareData().then(() => {
        this.ready = true;
        console.log("ready");
      });
    });
    // I have to delay chart initialization and rendering as angular change detection is not fast enough to generate the table before
    // the chart renders (and background color setting relies on data in table). I tried using ngZone but it doesn't help.
    var _self1 = this;
    setTimeout(function () {
      _self1.initializeChart();
    }, 200);
  }

  prepareData() {
    let currentDate = new Date();
    this.total = 0;
    this.dataset = [];
    var _self = this;
    this.vins.forEach(function (item, index) {
      if (typeof item.history != "undefined" && item.history.length > 0) {
        var _self1 = _self;
        item.history.forEach(function (h, ih) {
          let into = false;
          if (
            h &&
            h.type == "update" &&
            Date.parse(h.date) <=
              currentDate.getTime() - _self.from * 365 * 1000 * 3600 * 24 &&
            Date.parse(h.date) >
              currentDate.getTime() - _self.to * 365 * 1000 * 3600 * 24
          ) {
            // if dataset already contains the region, add the difference to dataset's count. If not, create dataset element with label and count
            var _self2 = _self1;
            _self.dataset.forEach(function (d, id) {
              if (d.label == item.origine.region && h.difference < 0) {
                d.count = d.count - h.difference;
                _self2.total = _self2.total - h.difference;
                into = true;
              }
            });
            if (!into && h.difference < 0) {
              _self.dataset.push({
                label: item.origine.region,
                count: -h.difference,
              });
              _self2.total = _self2.total - h.difference;
            }
          }
        });
      }
    });
    return Promise.resolve();
  }

  initializeChart() {
    this.margin = {
      top: 20,
      right: 20,
      bottom: 30,
      left: 50,
    };
    this.width = 360 - this.margin.left - this.margin.right;
    this.height = 360 - this.margin.top - this.margin.bottom;

    this.renderDonut();
  }

  renderDonut() {
    var width = this.width;
    var height = this.height;
    var radius = Math.min(width, height) / 2;
    var donutWidth = 100; // NEW
    //var legendRectSize = 15;                                  // NEW
    //var legendSpacing = 2;                                    // NEW
    //var color = d3scale.scaleOrdinal(d3.schemePaired);
    let myColorScheme = [
      "#e6194B",
      "#3cb44b",
      "#ffe119",
      "#4363d8",
      "#f58231",
      "#911eb4",
      "#42d4f4",
      "#f032e6",
      "#bfef45",
      "#fabebe",
      "#469990",
      "#e6beff",
      "#9A6324",
      "#fffac8",
      "#800000",
      "#aaffc3",
      "#808000",
      "#ffd8b1",
      "#000075",
      "#a9a9a9",
      "#EEEEEE",
      "#393E46",
    ];
    var color = d3scale.scaleOrdinal(myColorScheme);

    //cleaning up before drawing
    var title = d3.select("#title");
    title.html("");
    var svg = d3.select("#chart");
    svg.html("");

    title = d3
      .select("#title")
      .append("h3")
      .html("total : &nbsp;" + this.total);
    svg = d3
      .select("#chart")
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")");
    var arc = d3shape
      .arc()
      .innerRadius(radius - donutWidth) // UPDATED
      .outerRadius(radius);
    var pie = d3shape
      .pie()
      .value(function (d) {
        return d.count;
      })
      .sort(null);
    var tooltip = d3
      .select("#chart") // NEW
      .append("div") // NEW
      .attr("class", "tooltip"); // NEW
    tooltip
      .append("div") // NEW
      .attr("class", "label"); // NEW
    tooltip
      .append("div") // NEW
      .attr("class", "count"); // NEW
    tooltip
      .append("div") // NEW
      .attr("class", "percent"); // NEW
    tooltip.style("display", "none"); // NEW
    var path = svg
      .selectAll("path")
      .data(pie(this.dataset))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", function (d: any, i) {
        return color(d.data.label);
      });
    this.colors = color.domain();
    var _self = this;
    path.on("mouseover", function (event: any, d: any) {
      // NEW
      var total = d3.sum(
        _self.dataset.map(function (d: any) {
          // NEW
          return d.count; // NEW
        })
      ); // NEW
      var percent = Math.round((1000 * d.data.count) / total) / 10; // NEW
      tooltip.select(".label").html("Wine : " + d.data.label); // NEW
      tooltip.select(".count").html("# : " + d.data.count); // NEW
      tooltip.select(".percent").html("% : " + percent + "%"); // NEW
      tooltip.style("top", event.offsetY + "px");
      tooltip.style("left", event.offsetX + "px");
      tooltip.style("display", "block");
    }); // NEW
    path.on("mouseleave", function () {
      tooltip.style("display", "none"); // NEW
    }); // NEW
    console.log("adapt table style");
    d3select
      .selectAll(".tabcolor")
      .data(this.dataset)
      .style("background-color", function (d, i) {
        return color(d.label);
      });
  }
}
