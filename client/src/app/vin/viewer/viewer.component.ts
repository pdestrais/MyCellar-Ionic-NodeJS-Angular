import { Component, OnInit, Input, ElementRef, ViewChild } from "@angular/core";
import { ModalController } from "@ionic/angular";
import loadImage from "blueimp-load-image/js/index";
import Pica from "pica/dist/pica.js";
import * as Debugger from "debug";
const debug = Debugger("app:vin:viewer");

const pica = Pica();
const quality = 3;
const viewerCanvasWidth: number = 300;
const viewerCanvasHeight: number = 426;

@Component({
  selector: "app-viewer",
  templateUrl: "./viewer.component.html",
  styleUrls: ["./viewer.component.scss"],
})
export class ViewerComponent implements OnInit {
  @Input() fileOrBlob: File | Blob; // image is a File or Blob. This component can process both
  @Input() action: string;
  @ViewChild("selectedPhoto", { static: true }) canvasEl: ElementRef;
  @ViewChild("canvasContainer", { static: true }) canvasCntnr: any;
  @ViewChild("uploadphoto", { static: false })
  inputUploader: ElementRef<HTMLInputElement>;
  @ViewChild("modalContent", { static: true }) mContent: ElementRef;

  public from: string;
  private selectedFile: File | Blob;
  //	private offScreenCanvas: HTMLCanvasElement = document.createElement('canvas');

  private canvas: HTMLCanvasElement;

  constructor(private modalCtrl: ModalController) {}

  async dismiss(choice: string) {
    let compressedBlob: Blob;
    let compressedBlobWithExif: Blob;
    if (
      choice == "keep" &&
      (this.action == "add" || this.action == "replace")
    ) {
      // converts image in canvas (which is resized) into a blob
      compressedBlob = await pica.toBlob(this.canvas, "image/jpeg", quality);
      debug("[dismiss]compressedBlob size : " + compressedBlob.size);
      loadImage.parseMetaData(
        this.selectedFile,
        (data) => {
          if (!data.imageHead) {
            return;
          }
          // Combine data.imageHead (that contains the exif of the original file) with the image body of a resized file
          // to create scaled images with the original image meta data, e.g.:
          compressedBlobWithExif = new Blob(
            [
              data.imageHead,
              // Resized images always have a head size of 20 bytes,
              // including the JPEG marker and a minimal JFIF header:
              loadImage.blobSlice.call(compressedBlob, 20),
            ],
            { type: "image/jpeg" }
          );
          debug(
            "[dismiss]compressedBlobWithExif : " + compressedBlobWithExif.size
          );
          //forcing canvas width and height to zero to solve a memory leak bug in Safari on iOS - see https://stackoverflow.com/questions/52532614/total-canvas-memory-use-exceeds-the-maximum-limit-safari-12
          this.canvas.height = 0;
          this.canvas.width = 0;
          //this.canvasCntnr.el.removeChild(this.canvas);
          //this.canvasCntnr.removeChild(this.canvas);
          this.canvas.remove();
          delete this.canvas;

          this.modalCtrl.dismiss({
            choice: choice,
            compressedBlob: compressedBlobWithExif,
            from: this.action,
            selectedFile: this.selectedFile,
          });
        },
        {
          maxMetaDataSize: 262144,
          disableImageHead: false,
        }
      );
    } else {
      //forcing canvas width and height to zero to solve a memory leak bug in Safari on iOS - see https://stackoverflow.com/questions/52532614/total-canvas-memory-use-exceeds-the-maximum-limit-safari-12
      this.canvas.height = 0;
      this.canvas.width = 0;
      //this.canvasCntnr.el.removeChild(this.canvas);
      this.canvas.remove();
      delete this.canvas;
      this.modalCtrl.dismiss({
        choice: choice,
        compressedBlob: null,
        from: this.action,
        selectedFile: null,
      });
    }
    //debug('[dismiss]compressedBlobWithExif size : ' + compressedBlobWithExif.size);
  }

  ngOnInit() {
    /*     debug(
      "[ngOnInit]File or Blob size : " + this.fileOrBlob
        ? this.fileOrBlob.size
        : "unknown"
    );
 */
    debug("[ngOnInit]Entering");
    this.from = this.action;
    let img = new Image();
    this.canvas = this.canvasEl.nativeElement;

    this.selectedFile = this.fileOrBlob;
    let url = URL.createObjectURL(this.fileOrBlob);
    img.src = url;
    img.onload = () => {
      loadImage.parseMetaData(
        this.fileOrBlob,
        (data) => {
          debug("[ngOnInit]image blob metadata");
          let exifWidth = 0;
          let exifHeigth = 0;
          let exifOrientation = 1;
          if (typeof data.exif !== "undefined") {
            exifOrientation = parseInt(data.exif.get("Orientation"));
            let allTags = data.exif.getAll();
            debug(
              "[showExitingImage]orientation : " +
                exifOrientation +
                " - x: " +
                allTags.Exif["PixelXDimension"] +
                " - y: " +
                allTags.Exif["PixelYDimension"]
            );
            exifWidth = allTags.Exif["PixelXDimension"];
            exifHeigth = allTags.Exif["PixelYDimension"];
            this.canvas.width = viewerCanvasWidth; //window.innerWidth - 40;
            this.canvas.height = (exifHeigth / exifWidth) * this.canvas.width;
            // if fileOrBlob is a File
            if (
              this.fileOrBlob &&
              this.fileOrBlob instanceof File &&
              this.fileOrBlob.name
            ) {
              pica.resize(img, this.canvas).then((result) => {
                debug("[ngOnInit] resize done !");
              });
            }
            // Draw the image onto the canvas
            this.canvas.getContext("2d").drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
          }
        },
        {
          maxMetaDataSize: 262144,
          disableImageHead: false,
        }
      );
    };

    //Legacy code
    // if fileOrBlob is a File
    /*     if (this.fileOrBlob && this.fileOrBlob.name) {
      this.selectedFile = this.fileOrBlob;
      // We adjust canvas width and height to File width and heigth (read in File exif data)
      loadImage.parseMetaData(this.fileOrBlob, (data) => {
        let exifWidth = 0;
        let exifHeigth = 0;
        let exifOrientation = 1;
        if (typeof data.exif !== "undefined") {
          exifOrientation = parseInt(data.exif.get("Orientation"));
          let allTags = data.exif.getAll();
          debug(
            "[showImage]orientation : " +
              exifOrientation +
              " - x: " +
              allTags.Exif["PixelXDimension"] +
              " - y: " +
              allTags.Exif["PixelYDimension"]
          );
          exifWidth = allTags.Exif["PixelXDimension"];
          exifHeigth = allTags.Exif["PixelYDimension"];
          this.canvas.width = viewerCanvasWidth; //window.innerWidth - 40;
          this.canvas.height = (exifHeigth / exifWidth) * this.canvas.width;
          let mwidth = viewerCanvasWidth + 40;
          // adjusting modal width - this is not clean but I have not found a better way to do this.
          this.mContent.nativeElement.parentElement.parentElement.style =
            "opacity: 1; transform: translateY(0px);--width: " + mwidth + "px;";
          let url = URL.createObjectURL(this.fileOrBlob);
          img.src = url;
          img.onload = () => {
            pica.resize(img, this.canvas).then((result) => {
              debug("[ngOnInit] resize done !");
            });

            this.canvas.getContext("2d").drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            /*             if (this.fileOrBlob.name) {
              // the image comes from a file
              debug("[ngOnInit] image comes from a file");
              loadImage(
                this.fileOrBlob,
                (img) => {
                  debug(
                    "[ngOnInit]loadImage (x,y) : (" +
                      img.width +
                      "," +
                      img.height +
                      ")"
                  );
                  pica
                    .resize(img, this.canvas, {
                      unsharpAmount: 170,
                      unsharpRadius: 0.6,
                      unsharpThreshold: 5,
                      quality: 3,
                    })
                    .then((result) => {
                      debug("[ngOnInit] resize done !");
                    });
                },
                {
                  orientation: exifOrientation,
                } // Options
              );
            } else {
              // the image comes from the database, no resize is needed
              debug("[ngOnInit] image comes from the database");
              this.canvas.getContext("2d").drawImage(img, 0, 0);
              URL.revokeObjectURL(url);
            }
 */
    /*          };
        }
      });
    } else {
      let url = URL.createObjectURL(this.fileOrBlob);
      img.src = url;
      img.onload = () => {
        loadImage.parseMetaData(
          this.fileOrBlob,
          (data) => {
            debug("[ngOnInit]image blob metadata");
            let exifWidth = 0;
            let exifHeigth = 0;
            let exifOrientation = 1;
            if (typeof data.exif !== "undefined") {
              exifOrientation = parseInt(data.exif.get("Orientation"));
              let allTags = data.exif.getAll();
              debug(
                "[showExitingImage]orientation : " +
                  exifOrientation +
                  " - x: " +
                  allTags.Exif["PixelXDimension"] +
                  " - y: " +
                  allTags.Exif["PixelYDimension"]
              );
              exifWidth = allTags.Exif["PixelXDimension"];
              exifHeigth = allTags.Exif["PixelYDimension"];
              this.canvas.width = viewerCanvasWidth; //window.innerWidth - 40;
              this.canvas.height = (exifHeigth / exifWidth) * this.canvas.width;
              //             let mwidth = viewerCanvasWidth + 40;
              // adjusting modal width - this is not clean but I have not found a better way to do this.
              /*               this.mContent.nativeElement.parentElement.parentElement.style =
                "opacity: 1; transform: translateY(0px);--width: " +
                mwidth +
                "px;";
 */
    /*              // Draw the image onto the canvas
              this.canvas.getContext("2d").drawImage(img, 0, 0);
              URL.revokeObjectURL(url);
            }
          },
          {
            maxMetaDataSize: 262144,
            disableImageHead: false,
          }
        );
      };
    }
 */
    // end of legacy code
  }

  loadPhoto() {
    this.action = "replace";
    let el = this.inputUploader.nativeElement;
    if (el) {
      this.fileOrBlob = el.files[0];
      this.selectedFile = el.files[0];
      this.ngOnInit();
      //this.modalCtrl.dismiss({ choice: 'replace', file: el.files[0] });
    }
  }
}
