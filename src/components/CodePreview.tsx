import {useState,useEffect} from "react";
import type { SheetData } from '../DataTypes';
import { ChevronDown,ChevronUp } from "lucide-react";



function CodePreview({sheetData,activeRow,columns} : {sheetData:SheetData,activeRow:number,columns:Array<string>}) {
  const [isCollapsed, setCollapsed] = useState<boolean>(true)
  const [htmlURL,setHtmlURL] = useState<string|undefined>(undefined)

  function getCellValue(row: any[], columnName: string, columns: string[]) {
    const colIndex = columns.indexOf(columnName);
    if (colIndex !== -1 && row && row[colIndex] !== undefined) {
       const htmlCode = `<!DOCTYPE html>
<html>
<head>
  <meta charset=utf-8 />
  <title></title>
  <style>

img.demo {
   filter: brightness(200%);
}

table, th, td {
  border: 1px solid white;
  border-collapse: collapse;
}
th, td {
  background-color: #96D4D4;
}
    div.container {
      display:inline-block;
    }

    p {
      text-align:center;
    }

table, th, td {
  border: 8px solid black;
 padding: 5px;
text-align: center;
  
}
  </style>
</head>
<body>

<table style="width:100%">
  <tr>
    <th><h1> PICK FROM POD - STATIC QUALITY PLATFORM</h1></th> <hr>
 
</table>

  ${row[colIndex]}


</body>
</html>`
      return htmlCode;
    }
    return null;
  }

  function createHtmlFile(row:any[],columnName:string,columns:string[]){
   
    const code = getCellValue(row,columnName,columns);
    const htmlFileContent = `${code?code:""}`
    const blob = new Blob([htmlFileContent],{type:'text/html'})
    const url = URL.createObjectURL(blob)
    setHtmlURL(url);
  }

  useEffect(()=>{
    createHtmlFile(sheetData[activeRow], "Code", columns)
  },[activeRow,sheetData])

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100 h-fit">
            <div className="flex flex-row justify-between items-center w-full">
              <h2 className="text-2xl font-semibold text-gray-800 mb-4">Code Preview</h2>
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
            <iframe
              className={`w-full ${isCollapsed?'h-0' : 'h-[600px]'} bg-gray-50 p-4 rounded-lg border border-gray-200 min-h-20 transition-all duration-500 ease-in-out overflow-y-scroll`}
              src = { htmlURL }
              id="sheet-code"
            />
    </div>
  )
}

export default CodePreview