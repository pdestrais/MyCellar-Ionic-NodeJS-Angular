interface IVin {
  _id: string;
  id?: string;
  _rev?: string;
  nom: string;
  annee: string;
  nbreBouteillesAchat: number;
  nbreBouteillesReste: number;
  prixAchat: number;
  dateAchat: string;
  remarque?: string;
  localisation: string;
  contenance?: string;
  history?: Array<HistoryModel>;
  lastUpdated?: string;
  appellation: AppellationModel;
  origine: OrigineModel;
  type: TypeModel;
  cepage?: string;
  apogee?: string;
  GWSScore?: number;
  cotes?: Array<CoteModel>;
  photo?: { name; width; heigth; orientation; fileType };
  rating?: number;
}
export class VinModel implements IVin {
  public _id: string;
  public id?: string;
  public _rev?: string;
  public rev?: string;
  public nom: string;
  public annee: string;
  public nbreBouteillesAchat: number;
  public nbreBouteillesReste: number;
  public prixAchat: number;
  public dateAchat: string;
  public remarque?: string;
  public localisation: string;
  public contenance?: string;
  public history?: Array<HistoryModel>;
  public lastUpdated?: string;
  public appellation: AppellationModel;
  public origine: OrigineModel;
  public type: TypeModel;
  public cepage?: string;
  public apogee?: string;
  public GWSScore?: number;
  public cotes?: Array<CoteModel>;
  public photo?: { name; width; heigth; orientation; fileType; binary? };
  public rating?: number;

  constructor(data: Partial<IVin>) {
    Object.assign(this, data);
  }
}

interface IType {
  _id: string;
  id?: string;
  _rev?: string;
  nom: string;
}
export class TypeModel implements IType {
  public _id: string;
  public id?: string;
  public _rev?: string;
  public rev?: string;
  public nom: string;
  constructor(data: Partial<IVin>) {
    Object.assign(this, data);
  }
}

export class HistoryModel {
  constructor(
    public type: string,
    public difference: number,
    public date: string,
    public comment: string
  ) {
    this.type = type;
    this.difference = difference;
    this.date = date;
    this.comment = comment;
  }
}

interface IAppellation {
  _id: string;
  id?: string;
  _rev?: string;
  courte: string;
  longue: string;
}
export class AppellationModel {
  public _id: string;
  public id?: string;
  public _rev?: string;
  public rev?: string;
  public courte: string;
  public longue: string;
  constructor(data: Partial<IAppellation>) {
    Object.assign(this, data);
  }
}

interface IOrigine {
  _id: string;
  id?: string;
  _rev?: string;
  pays: string;
  region: string;
  groupVal?: string;
}
export class OrigineModel {
  public _id: string;
  public id?: string;
  public _rev?: string;
  public rev?: string;
  public pays: string;
  public region: string;
  public groupVal?: string;
  constructor(data: Partial<IOrigine>) {
    Object.assign(this, data);
  }
}

export class CoteModel {
  constructor(
    public _id: string,
    public criticName: string,
    public score: number
  ) {
    this._id = _id;
    this.criticName = criticName;
    this.score = score;
  }
}

export class UserModel {
  username: string;
  password: string;
  firstname: string;
  lastname: string;
  token: string;
  email: string;
  address: string;
  admin: boolean;
}
