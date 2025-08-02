import { useEffect, useState } from "react";
import * as XLSX from 'xlsx';
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import { Upload, FileSpreadsheet, Download, ChevronLeft, ChevronRight, Database, ChevronDown, ChevronUp } from "lucide-react";
import CodePreview from "./components/CodePreview";

import type { ColObject, SheetData, DataMap, DataValidation, DropDownMap, DropDowns } from "./DataTypes";
import DataEntryTable from "./components/DataEntryTable";

function App() {
  const [file, setFile] = useState<File>()
  const [options, setOptions] = useState<string[]>([])
  const [workbook, setWorkBook] = useState<XLSX.WorkBook | null>(null)
  const [activeSheet, setActiveSheet] = useState<string | undefined>(undefined)
  const [sheetXmlMap, setSheetXmlMap] = useState<{ [index: string]: string }>({})
  const [columns, setColumns] = useState<string[]>([])
  const [desiredColumns, setDesiredColumns] = useState<string[]>([])
  const [columnMap, setColumnMap] = useState<ColObject>({})
  const [activeRow, setActiveRow] = useState<number>(1)
  const [sheetData, setSheetData] = useState<SheetData>([]);
  const [dataMap, setDataMap] = useState<DataMap>({});
  const [validations, setValidations] = useState<DataValidation[]>([]);
  const [dropDownMap, setDropDownMap] = useState<DropDownMap[]>([])
  const [dropDowns, setDropDowns] = useState<DropDowns>({})
  const [isCollapsed, setCollapsed] = useState<boolean>(true)


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
    setColumnMap(col_local)
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setFile(file)

    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target?.result as ArrayBuffer);
      const workbook_local = XLSX.read(data, { type: 'array' });
      setWorkBook(workbook_local)
      setOptions(workbook_local.SheetNames)
      listColumns(workbook_local.SheetNames[0], workbook_local)
    };

    reader.readAsArrayBuffer(file);

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
      const dvs = xmlObj.worksheet.dataValidations?.dataValidation;
      if (!dvs) {
        setValidations([]);
        return;
      }

      // Normalize array (could be single object or array)
      const dvArray = Array.isArray(dvs) ? dvs : [dvs];

      // Filter list type validations
      const listValidations: DataValidation[] = dvArray
        .filter((dv) => dv["@_type"] === "list")
        .map((dv) => ({
          sqref: dv["@_sqref"],
          formula1: dv.formula1,
        }));
      setValidations(listValidations);
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
      const columns = val.sqref.split(":")
      const col = columns[columns.length - 1]
      const indexOfNum = col.match(/\d/)
      let column = col
      if (indexOfNum) {
        column = column.substring(0, indexOfNum.index!)
      }
      const column_num = getColNumber(column)
      let sheetName = activeSheet as string
      let options = []
      if (val.formula1.includes("!")) {
        const formulaParts = val.formula1.split("!")
        sheetName = formulaParts[0].startsWith("'") && formulaParts[0].endsWith("'") ? formulaParts[0].slice(1, -1) : formulaParts[0]
        options = formulaParts[1].split(":")
      }
      else options = val.formula1.split(":")
      const start = parseInt(options[0].split("$")[2])
      const end = parseInt(options[1].split("$")[2])
      const sheetCol = getColNumber(options[0].split("$")[1])

      setDropDownMap(prev =>
      ([...prev,
      {
        col: column_num,
        sheet: sheetName,
        sheetCol: sheetCol,
        start: start,
        end: end
      }
      ]
      )
      )

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
    
    for(const sheet in dataMap){
      
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

  //Not Required in current requirement may be needed in future.
  // function addSheetCodeTable(table:NodeListOf<Element>):void{
  //   const obj : {[col:string]:Data}= {}
  //   const cols = table[0].querySelectorAll("th")
  //   const values = table[1].querySelectorAll("td")
  //   console.log(cols,values)
  //   cols.forEach((col,index)=>{
  //     obj[col.innerText] = values[index].innerText
  //   })
  //    setDataMap(prev => ({
  //   ...prev,
  //   [activeRow]: {
  //     ...(prev[activeRow] || {}),
  //     ...(obj)
  //   },
  // }));
  //   console.log(obj)
  // }

  

 
  function setRowValues(): void {
    const local_map: { [col: string]: string | number } = {}
    const row = sheetData[activeRow]
    row?.forEach((value, index) => {
      local_map[columns[index]] = value
    })
    setDataMap(prev => {
      return {
        ...prev,
        [activeSheet as string]:{
          ...prev[activeSheet as string],
          [activeRow]:{...local_map}
        }
      }
    })
  }

  function extractOptions(dropDownMap: DropDownMap[]): void {
    dropDownMap.forEach(dp => {
      const col_name = columns[dp.col]
      const sheet = workbook?.Sheets[dp.sheet]
      const options: (string | number)[] = []
      const jsonData = XLSX.utils.sheet_to_json(sheet as XLSX.WorkSheet, { header: 1 }) as [];
      for (let i = dp.start - 1; i < dp.end; i++) {
        if (jsonData[i] && jsonData[i][dp.sheetCol]) {
          options.push(jsonData[i][dp.sheetCol])
        }
      }

      setDropDowns(prev => {
        return {
          ...prev,
          [col_name]: options
        }
      })

      setColumnMap(prev => {
        return {
          ...prev,
          [col_name]: "l"
        }
      })
    })
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
    document.querySelectorAll('input[type=checkbox]').forEach(cb => (cb as HTMLInputElement).checked = false);
  }, [file])

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
            <div className="flex flex-col items-start">
              <label htmlFor="sheets" className="block text-md font-medium text-gray-700 mb-2 text-bold">
                Select Worksheet
              </label>
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center sm:justify-between w-full">
                <select
                  name="sheets"
                  id="sheets"
                  value={activeSheet}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all duration-200 bg-white sm:w-[60%]"
                  onChange={(event: React.ChangeEvent<HTMLSelectElement>) => listColumns(event.target.value, workbook as XLSX.WorkBook)}
                >
                  {options.map((elem: string) => (
                    <option value={elem} key={elem}>{elem}</option>
                  ))}
                </select>
                <button
                  onClick={exportToExcel}
                  className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors duration-200 flex items-center gap-2 font-medium shadow-md"
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
        {sheetData.length > 0 && columns.length > 0 && (
          <CodePreview sheetData={sheetData} activeRow={activeRow} columns={columns}/>
        )}

        {/* Data Entry Table */}
        {desiredColumns.length > 0 && columnMap && (
          <DataEntryTable activeRow={activeRow} dropDowns={dropDowns} setDataMap={setDataMap} desiredColumns={desiredColumns} dataMap={dataMap} columnMap={columnMap} activeSheet={activeSheet as string}/>
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
      </div>
    </div>
  )
}

export default App