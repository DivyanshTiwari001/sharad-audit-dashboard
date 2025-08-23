export type ColObject = { [index: string]: string }
export interface DataValidation {
  sqref: string;
  formula1: string;
}

export interface DropDownMap {
  col: number;
  sheet: string;
  sheetCol: number;
  type:string;
  start: number;
  end: number;
}

export interface DropDowns {
  [col: string]: (string | number)[]
}

export type Data = string | number
export type SheetData = Array<Array<Data>>

export type DataMap = {[sheet:string]:{ [row: number]: { [col: string]: Data } }}