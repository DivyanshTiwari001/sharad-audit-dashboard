import { useEffect, useState } from "react";
import * as XLSX from 'xlsx';
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { Upload, FileSpreadsheet, Download, ChevronLeft, ChevronRight, Database, ChevronDown, ChevronUp } from "lucide-react";
import CodePreview from "./components/CodePreview";

import type { ColObject, SheetData, DataMap, DataValidation, DropDownMap, DropDowns, Data } from "./DataTypes";
import DataEntryTable from "./components/DataEntryTable";

function App() {
  const [file, setFile] = useState<File>()
  const [options, setOptions] = useState<string[]>([])
  const [workbook, setWorkBook] = useState<XLSX.WorkBook | null>(null)
  const [activeSheet, setActiveSheet] = useState<string | undefined>(undefined)
  const [sheetXmlMap, setSheetXmlMap] = useState<{ [index: string]: string }>({})
  const [columns, setColumns] = useState<string[]>([])
  const [desiredColumns, setDesiredColumns] = useState<string[]>([])
  const [columnTypeMap, setcolumnTypeMap] = useState<ColObject>({})
  const [activeRow, setActiveRow] = useState<number>(1)
  const [sheetData, setSheetData] = useState<SheetData>([]);
  const [dataMap, setDataMap] = useState<DataMap>({});
  const [validations, setValidations] = useState<DataValidation[]>([]);
  const [dropDownMap, setDropDownMap] = useState<DropDownMap[]>([])
  const [dropDowns, setDropDowns] = useState<DropDowns>({})
  const [isCollapsed, setCollapsed] = useState<boolean>(true)
  const [dependentColsMap,setDependentColsMap] = useState<{[index:number]:string}>({});
  const [optRefMap,setOptRefMap] = useState<{[index:number]:string}>({}); 
  const [indirectMap,setIndirectMap] = useState<{[index:Data]:Data[]}>({})
  const [showLoader,setShowLoader] = useState<boolean>(false);
  const [auditor,setAuditor] = useState<string | null>()


  const dateRegex: RegExp = /^(0?[1-9]|1[0-2])[\/\-](0?[1-9]|[12][0-9]|3[01])[\/\-](\d{4})$/;

  function isValidDate(dateString: string): boolean {
    return dateRegex.test(dateString);
  }

  function listColumns(currentSheet: string, workbook: XLSX.WorkBook): void {
    setActiveSheet(currentSheet)
    setDesiredColumns([])
    const worksheet = workbook?.Sheets[currentSheet]

    //keys are A2,B2 etc
    const keys = Object.keys(worksheet).filter(key => key[key.length - 1] == '1')
    const jsonData = XLSX.utils.sheet_to_json(worksheet as XLSX.WorkSheet, { header: 1 });
    setSheetData(jsonData as SheetData)

    const firstRow = jsonData[0] as string[];
    setColumns(firstRow)

    let col_local: ColObject = {}
    keys.forEach(key => {
      let key2 = key.slice(0, -1) + '2';
      let type = worksheet[key2] ? worksheet[key2].t : worksheet[key].t;
      if (type == 'n' && worksheet[key2] && isValidDate(worksheet[key2].w)) {
        type = "d"
      }
      col_local[worksheet[key].v] = type
    })
    setcolumnTypeMap(col_local)
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    setShowLoader(true);
    const localFileImage = event.target.files?.[0];
    if (!localFileImage) {
      setShowLoader(false);
      return;
    }
    if (localFileImage) {
  // Convert to MB
    const sizeMB = localFileImage.size / (1024 * 1024);
    if (sizeMB > 60) {
      alert("File is too large! (Max 50MB allowed)");
      return;
    }
}
    setFile(localFileImage);
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook_local = XLSX.read(data, { type: 'array' });
      setWorkBook(workbook_local)
      setOptions(workbook_local.SheetNames)
      listColumns(workbook_local.SheetNames[0], workbook_local)
      setShowLoader(false);
    };

    reader.readAsArrayBuffer(localFileImage);
    reader.onerror = () => {
      alert("Error reading file.");
      setShowLoader(false);
    };
    reader.readAsArrayBuffer(localFileImage);
  }


   function simplifyIndirectFormula(formula: string): string {
  // Match =INDIRECT(VLOOKUP(...))
  const regex = /^INDIRECT\s*\(\s*VLOOKUP\(([^,]+),.*\)\s*\)$/i;

  const match = formula.match(regex);
  if (!match) return formula; // return unchanged if not matching

  const lookupValue = match[1]; // first argument of VLOOKUP
  return `INDIRECT(${lookupValue})`;
}


  const addValidations = async (file: File) => {
    setValidations([]);
    if (!file) return;

    try {
      // Load XLSX as zip archive
      const zip = await JSZip.loadAsync(file);
      const sheetName = sheetXmlMap[activeSheet as string] ? sheetXmlMap[activeSheet as string] : "sheet1.xml"
      // For simplicity, read data from first worksheet xml file – "sheet1.xml"

      const sheetXml = await zip.file(`xl/worksheets/${sheetName}`)?.async("text");
      if (!sheetXml) {
        console.error("Could not find worksheet XML inside the XLSX file.");
        return;
      }

      // Parse XML
      const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
      });
      const xmlObj = parser.parse(sheetXml);


      // Extract dataValidations (may be missing if no validations)
      const dvs = xmlObj.worksheet?.extLst?.ext["x14:dataValidations"]["x14:dataValidation"] ? xmlObj.worksheet.extLst.ext["x14:dataValidations"]["x14:dataValidation"] : xmlObj.worksheet.dataValidations?.dataValidation;
      const otherValidations = xmlObj.worksheet?.dataValidations?.dataValidation
      if (otherValidations) {
        dvs.push(otherValidations)
      }
      if (!dvs) {
        setValidations([]);
        return;
      }

      // Normalize array (could be single object or array)
      const dvArray = Array.isArray(dvs) ? dvs : [dvs];

      // Filter list type validations
      const listValidations: DataValidation[] = dvArray
        .filter((dv) => dv["@_type"] === "list")
        .map(dv => {
          return {
            sqref: dv?.["xm:sqref"] ?? dv["@_sqref"],
            formula1: simplifyIndirectFormula(dv?.["x14:formula1"]?.["xm:f"] ?? dv.formula1)
          }
        })
      const directValidations = listValidations.filter(val => !val.formula1.toLowerCase().includes("indirect"));
      const indirectValidations = listValidations.filter(val => val.formula1.toLowerCase().includes("indirect"));

      const orderedValidations = [...directValidations, ...indirectValidations];
      setValidations(orderedValidations);
      
    } catch (e) {
      console.error("Error reading file: " + (e as Error).message);
    }
  };


  function getColNumber(col: string): number {
    //convert AAAB type column to a index
    let index = 0
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 64)
    }
    return index - 1;
  }

  function getDropDowns(vals: DataValidation[]): void {
    vals.forEach(val => {
      const refColumns = val.sqref.split(":")
      const col = refColumns[refColumns.length - 1]
      const indexOfNum = col.match(/\d/)
      let column = col
      if (indexOfNum) {
        column = column.substring(0, indexOfNum.index!)
      }
      const column_num = getColNumber(column)
      let sheetName = activeSheet as string
      let type = "direct"
      if (val.formula1.toLowerCase().includes("indirect")) {
        type = "indirect";
        const dependency_col = val.formula1.split('$')[1][0];
        const dependency_column_num = getColNumber(dependency_col);
        const dependency = dropDownMap.filter(dd => dd.col === dependency_column_num)[0];
        if(!dependency)return;
        
        setDependentColsMap(prev=>{
          return {
            ...prev,
            [dependency.sheetCol]:columns[column_num]
          }
        })

        setDropDownMap(prev =>
        ([...prev,
        {
          col: column_num,
          sheet: dependency.sheet,
          sheetCol: dependency.sheetCol,
          type,
          start: dependency.start,
          end: dependency.end,
        }
        ]
        )
        )
      }
      else {
        let options:string[] = []
        if (val.formula1.includes("!")) {
          const formulaParts = val.formula1.split("!")
          sheetName = formulaParts[0].startsWith("'") && formulaParts[0].endsWith("'") ? formulaParts[0].slice(1, -1) : formulaParts[0]
          options = formulaParts[1].split(":") 
        }
        else options = val.formula1.split(":")
        const start = parseInt(options[0].split("$")[2])
        const end = parseInt(options[1].split("$")[2])
        const sheetCol = getColNumber(options[0].split("$")[1])
        // optRefMap.set(sheetCol, columns[column_num]);

        setOptRefMap(prev=>({
          ...prev,
          [sheetCol]:columns[column_num]
        }))
        setDropDownMap(prev =>
        ([...prev,
        {
          col: column_num,
          sheet: sheetName,
          sheetCol: sheetCol,
          type,
          start: start,
          end: end,
        }
        ]
        )
        )

      }

    })
  }

  function handleDesiredColumns(event: React.ChangeEvent<HTMLInputElement>): void {
    if (event.target.checked) {
      setDesiredColumns(prev => [...prev, event.target.name])
    } else {
      setDesiredColumns(prev => prev.filter(col => col != event.target.name))
    }
  }

  function exportToExcel(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault()

    // Create workbook
    const workbook = XLSX.utils.book_new();

    for (const sheet in dataMap) {

      const rows = Object.values(dataMap[sheet]);
      // Create worksheet
      const worksheet = XLSX.utils.json_to_sheet(rows);
      XLSX.utils.book_append_sheet(workbook, worksheet, sheet);
    }

    // get current date
    const date = new Date();
    const currentDate = `${('0' + date.getDate()).slice(-2)}-${('0' + (date.getMonth() + 1)).slice(-2)}-${(date.getFullYear())}`
    // This would require adding JSZip functionality
    const zip = new JSZip();
    const folder = zip.folder(`Audit_Export_${currentDate}`);
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    folder?.file(`audit_data_${currentDate}.xlsx`, excelBuffer);

    zip.generateAsync({ type: 'blob' }).then(content => {
      const link = document.createElement('a');
      link.href = URL.createObjectURL(content);
      link.download = `Audit_Export_${currentDate}.zip`;
      link.click();
    });
  }

  function moveTonextRow(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault()
    setActiveRow(prev => prev + 1)
  }
  function moveToprevRow(event: React.MouseEvent<HTMLButtonElement>): void {
    event.preventDefault()
    if (activeRow == 1) return
    setActiveRow(prev => prev - 1)
  }



  function setRowValues(): void {
    const local_map: { [col: string]: string | number } = {};
    const row = sheetData[activeRow]

    //initializing datamap for each row
    columns.forEach(col => {
      let value:Data | undefined = undefined;
      if (columnTypeMap[col] === 'n') value = 0;
      else value = '';
      local_map[col] = value;
    })

    row?.forEach((value, index) => {
      if (!value) {
        if (columnTypeMap[columns[index]] === 's') value = '';
        else if (columnTypeMap[columns[index]] === 'n') value = 0;
      }
      local_map[columns[index]] = value;
    })
    setDataMap(prev => {
      return {
        ...prev,
        [activeSheet as string]: {
          ...prev[activeSheet as string],
          [activeRow]: { ...local_map }
        }
      }
    })
  }

  function extractOptions(dropDownMap: DropDownMap[]): void {
    dropDownMap.forEach(dropDown => {
      const col_name = columns[dropDown.col]
      if (dropDown.type === "indirect") {
        const {headers,indirectOptions} = extractIndirectOptions(dropDown);
        if(!headers.length || !indirectOptions)return;
        const options = indirectOptions?.[headers[0]] || ["No Options"];
        setDropDowns(prev => {
          return {
            ...prev,
            [col_name]: options as string[]
          }
        })

        setcolumnTypeMap(prev => {
          return {
            ...prev,
            [col_name]: "rl"
          }
        })
        return;
      }

      const options: (string | number)[] = extractDirectOptions(dropDown);
      if (!options.length) return;
      setDropDowns(prev => {
        return {
          ...prev,
          [col_name]: options
        }
      })

      setcolumnTypeMap(prev => {
        return {
          ...prev,
          [col_name]: "l"
        }
      })
    })
  }

  function getAllIndexesOf(arr: Array<any>, val: any): number[] {
    const indexes: number[] = [];
    arr.forEach((elem, index) => {
      if (elem === val) {
        indexes.push(index);
      }
    })
    return indexes;
  }

  function extractIndirectOptions(dropDown: DropDownMap): {headers:string[],indirectOptions:{[index:Data]:Data[]}} {
    const headers = extractDirectOptions(dropDown) as string[];
    const sheet = workbook?.Sheets[dropDown.sheet]
    const jsonData = XLSX.utils.sheet_to_json(sheet as XLSX.WorkSheet, { header: 1 }) as [];
    const local_indirectMap:{[index:Data]:Data[]} = {}
    headers.forEach(header => {
      let row = 0; let col = 0;
      for (; row < jsonData.length; row++) {
        const arr: (string | number)[] = jsonData[row]
        const idxs = getAllIndexesOf(arr, header);
        if (idxs.length !== 0 ) {
          col = idxs.filter(idx=>idx!==dropDown.sheetCol)[0];
          break;
        }
      }
      row = row + 1; //move to first option 


      if (row >= jsonData.length || col === dropDown.sheetCol) return;


      const options: Data[] = [];
      while (row < jsonData.length && jsonData[row][col]) {
        options.push(jsonData[row++][col])
      }

      // indirectMap.set(header, options)
      local_indirectMap[header] = options;
    })
    setIndirectMap(prev=>({...prev,...local_indirectMap}))
    return {headers,indirectOptions:local_indirectMap};;
  }

  function extractDirectOptions(dropDown: DropDownMap): (string | number)[] {
    const sheet = workbook?.Sheets[dropDown.sheet]
    const options: (string | number)[] = []
    const jsonData = XLSX.utils.sheet_to_json(sheet as XLSX.WorkSheet, { header: 1 }) as [];
    for (let i = dropDown.start - 1; i < dropDown.end; i++) {
      if (jsonData[i] && jsonData[i][dropDown.sheetCol]) {
        options.push(jsonData[i][dropDown.sheetCol])
      }
    }
    return options;
  }

  //Side Effects

  //To extract dropdown info from data validations
  useEffect(() => {
    getDropDowns(validations)
  }, [validations])

  //To get options for the dropdown as per data validation
  useEffect(() => {
    extractOptions(dropDownMap)
  }, [dropDownMap])

  //To unselect checkboxes on file change
  useEffect(() => {
    if(!file)return;
    document.querySelectorAll('input[type=checkbox]').forEach(cb => (cb as HTMLInputElement).checked = false);
  }, [file,activeSheet])

  //Maping sheet name to its corresponding xml name
  useEffect(() => {
    function mapSheetToXML() {
      const local_map: { [index: string]: string } = {}
      options.forEach((option, index) => {
        local_map[option] = `sheet${index + 1}.xml`
      })
      setSheetXmlMap(local_map)
    }
    if (options) {
      mapSheetToXML()
    }
  }, [options])

  // To get the Data validations for currently active sheet
  useEffect(() => {
    if (file) addValidations(file as File)
  }, [activeSheet, file])

  // To set Data values for active Row
  useEffect(() => {
    if (activeRow && sheetData) setRowValues()
  }, [activeRow, sheetData])


  useEffect(()=>{
    if(activeSheet && workbook){
      const worksheet = workbook?.Sheets[activeSheet]
    const jsonData = XLSX.utils.sheet_to_json(worksheet as XLSX.WorkSheet, { header: 1 });
    const filteredData:SheetData = (jsonData as SheetData).slice(1).filter(row=>{
      const idx = (jsonData[0] as Data[]).indexOf("Auditor Login")
      if(idx>=row.length || !auditor || auditor==='')return true;
      else return row[idx] === auditor
    }
    )
    const filteredSheetData: SheetData = [jsonData[0] as Data[],...filteredData];
    setSheetData(filteredSheetData as SheetData)
    }
  },[auditor,activeSheet,workbook])


  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="bg-white rounded-xl shadow-lg p-8 mb-8 border border-gray-100">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-blue-600 rounded-lg">
              <Database className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold text-gray-800">Audit Dashboard</h1>
              <p className="text-gray-600 mt-1">Professional Excel Data Management System</p>
            </div>
          </div>
        </div>

        {/* File Upload Section */}

        {
          showLoader ?
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          padding: '2rem 3rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="animate-spin mb-4">
          <circle cx="24" cy="24" r="20" stroke="#3B82F6" strokeWidth="4" strokeDasharray="100" strokeDashoffset="60" />
        </svg>
        <span style={{ fontSize: '1.25rem', color: '#3B82F6', fontWeight: 500 }}>Loading...</span>
      </div>
    </div>:
          <>
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <Upload className="w-6 h-6 text-blue-600" />
            File Upload
          </h2>
          <div className="relative">
            <input
              type="file"
              name="excel-file"
              accept=".xlsx"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={(event) => {
                handleFileUpload(event)
              }}
            />
            <div className="flex items-center justify-center w-full h-32 border-2 border-dashed border-blue-300 rounded-xl bg-blue-50 hover:bg-blue-100 transition-colors duration-200">
              <div className="text-center">
                <FileSpreadsheet className="w-12 h-12 text-blue-600 mx-auto mb-2" />
                <p className="text-lg font-medium text-blue-700">Upload Excel File</p>
                <p className="text-sm text-blue-600">Click or drag file to upload</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sheet Selection and Export */}
        {options.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
            <div className="flex flex-row w-full justify-between items-center">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Worksheet Management</h2>
              <h2 className="text-xl font-semibold text-gray-800 mb-4">File : <span className="text-blue-500">{file?.name}</span></h2>
            </div>
          <div className="w-full flex flex-row justify-start">
              <div className="flex flex-col items-start w-[40%]">
              <label htmlFor="sheets" className="block text-md font-medium text-gray-700 mb-2 text-bold">
                Select Worksheet
              </label>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center sm:justify-between w-full h-[50px]">
                <select
                  name="sheets"
                  id="sheets"
                  value={activeSheet}
                  className="w-full h-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 bg-white sm:w-[60%]"
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => listColumns(event.target.value, workbook as XLSX.WorkBook)}
                >
                  {options.map((elem: string) => (
                    <option value={elem} key={elem}>{elem}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="w-[60%] flex flex-row justify-between items-center ">
                  <div className="w-fit min-w-[400px] h-full">
                    <label htmlFor="auditor" className="block text-md font-medium text-gray-700 mb-2 text-bold">Auditor</label>
                  <div className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 bg-white sm:w-[60%] min-w-fit h-[50px] flex flex-row justify-between">
                  <input type="text" value={auditor? auditor : ''} onChange={(e)=>{setAuditor(e.target.value)}} className="h-full outline-none"  id="auditor"/>
                  <div className="">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </div>
                  </div>
                </div>
                <button
                  onClick={exportToExcel}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2 font-medium shadow-md max-h-[50px] h-fit"
                >
                  <Download className="w-5 h-5" />
                  Export Data
                </button>
            </div>
          </div>

          </div>
        )}

        {/* Column Selection */}
        {columns.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
            <div className="w-full flex flex-row justify-between">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Column Selection</h2>
              <div className="flex items-center space-x-2 cursor-pointer"
                onClick={() => { setCollapsed(prev => !prev) }}>
                <span className="text-sm text-gray-600">
                  {isCollapsed ? 'Expand' : 'Collapse'}
                </span>
                {isCollapsed ? (
                  <ChevronDown className="w-5 h-5 text-gray-600 transition-transform duration-200" />
                ) : (
                  <ChevronUp className="w-5 h-5 text-gray-600 transition-transform duration-200" />
                )}
              </div>
            </div>

            {
              <div className={`grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4 transition-all duration-300 ease-in-out overflow-y-scroll ${isCollapsed ? 'max-h-0' : 'max-h-[400px]'
                }`}>
                {columns.map((column, index) => (
                  <div key={`${column + index}`} className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200 cursor-pointer">
                    <input
                      type="checkbox"
                      name={column}
                      id={column}
                      onChange={handleDesiredColumns}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 mr-3"
                    />
                    <label htmlFor={column} className="text-sm font-medium text-gray-700 cursor-pointer flex-1">
                      {column}
                    </label>
                  </div>
                ))}
              </div>
            }
          </div>
        )}

        {/* Code Display */}
        {sheetData && sheetData.length > 0 && columns.length > 0 && (
          <CodePreview sheetData={sheetData} activeRow={activeRow} columns={columns} />
        )}

        {/* Data Entry Table */}
        {desiredColumns.length > 0 && columns.length > 0 && columnTypeMap && (
          <DataEntryTable
            sheetColumns={columns}
            activeRow={activeRow}
            dropDowns={dropDowns}
            setDataMap={setDataMap}
            desiredColumns={desiredColumns}
            dataMap={dataMap}
            columnTypeMap={columnTypeMap}
            activeSheet={activeSheet as string}
            indirectMap={indirectMap}
            optRefMap={optRefMap}
            dependentColsMap={dependentColsMap}
            setDropDowns={setDropDowns}
          />

        )}

        {/* Navigation Controls */}
        {desiredColumns.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 border border-gray-100">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">Navigation</h2>
            <div className="flex justify-center gap-4">
              <button
                onClick={moveToprevRow}
                disabled={activeRow === 1}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors duration-200 flex items-center gap-2 font-medium shadow-md"
              >
                <ChevronLeft className="w-5 h-5" />
                Previous Row
              </button>
              <button
                onClick={moveTonextRow}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 flex items-center gap-2 font-medium shadow-md"
              >
                Next Row
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}
        </>
      }
      </div>
    </div>
  )
}

export default App