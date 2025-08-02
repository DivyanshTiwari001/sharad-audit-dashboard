import {useState} from "react";
import type { SheetData } from '../DataTypes';
import { ChevronDown,ChevronUp } from "lucide-react";



function CodePreview({sheetData,activeRow,columns} : {sheetData:SheetData,activeRow:number,columns:Array<string>}) {
  const [isCollapsed, setCollapsed] = useState<boolean>(true)

  function getCellValue(row: any[], columnName: string, columns: string[]) {
    const colIndex = columns.indexOf(columnName);
    if (colIndex !== -1 && row && row[colIndex] !== undefined) {
      return row[colIndex];
    }
    return null;
  }

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
              className={`w-full bg-gray-50 p-4 rounded-lg border border-gray-200 min-h-20 transition-all duration-500 ease-in-out overflow-y-scroll ${isCollapsed ? 'max-h-0' : 'max-h-[600px]'}`}
              srcDoc = { getCellValue(sheetData[activeRow], "Code", columns) as string }
              id="sheet-code"
            />
    </div>
  )
}

export default CodePreview