import {useState} from "react";
import { ChevronDown,ChevronUp } from "lucide-react";
import type { ColObject, DropDowns, DataMap } from '../DataTypes';


function DataEntryTable({ activeRow, dropDowns, desiredColumns, columnMap, dataMap, setDataMap, activeSheet }: { activeRow: number, dropDowns: DropDowns, desiredColumns: string[], columnMap: ColObject, dataMap: DataMap, setDataMap: React.Dispatch<React.SetStateAction<DataMap>>, activeSheet: string }) {
    const [isCollapsed, setCollapsed] = useState<boolean>(true)

    function getFieldAsPerType(col: string) {
        console.log(dataMap)
        switch (columnMap[col]) {
            case "n": return <input
                type="number"
                name={col}
                id={col}
                className="w-full px-3 py-2 outline-none transition-all duration-200"
                value={dataMap?.[activeSheet]?.[activeRow]?.[col] ? dataMap[activeSheet][activeRow][col] : 0}
                onChange={(e) => {
                    handleDataChange(activeRow, col, e.target.value)
                }}
            />;
            case "d": return <input
                type="date"
                name={col}
                id={col}
                className="w-full px-3 py-2 outline-none transition-all duration-200"
                value={(dataMap?.[activeSheet]?.[activeRow]?.[col]) != null ? excelDateToJSDate(dataMap[activeSheet][activeRow][col] as (string | number)).toISOString().split("T")[0] : new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                    handleDataChange(activeRow, col, e.target.value)
                }}
            />;
            case "l": return <div className='flex flex-row justify-between w-full h-full items-center'>
                <select
                    name={col}
                    id={col}
                    className="w-full px-3 py-2 outline-none transition-all duration-200 bg-white appearance-none"
                    onChange={(e) => handleDataChange(activeRow, col, e.target.value)}
                >
                    {
                        dropDowns && dropDowns[col].map(val => {
                            return <option value={val} key={val}>{val}</option>
                        })
                    }
                </select>
                <div className="absolute right-4">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
            default: return <div className='flex flex-row justify-between w-full h-full items-center'>
                <input
                    type="text"
                    name={col}
                    id={col}
                    className="w-full px-3 py-2 outline-none transition-all duration-200"
                    value={dataMap?.[activeSheet]?.[activeRow]?.[col] ? dataMap[activeSheet][activeRow][col] : ""}
                    onChange={(e) => {
                        handleDataChange(activeRow, col, e.target.value)
                    }}
                /><div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </div>
            </div>
        }
    }

    function handleDataChange(row: number, col: string, value: string | number): void {
        setDataMap(prev => ({
            ...prev,
            [activeSheet]: {
                ...prev[activeSheet],
                [row]: {
                    ...prev[activeSheet][activeRow],
                    [col]: value
                }
            }
        }));
    }

    function excelDateToJSDate(serial: string | number): Date {
        if (typeof serial == 'string') return new Date(serial);
        const excelEpoch = new Date(1899, 11, 30);  // Excel considers 1900-01-01 as day 1, but there's a known 1-day offset 
        const jsDate = new Date(excelEpoch.getTime());
        jsDate.setDate(jsDate.getDate() + serial);
        return jsDate;
    }


    return (
        <div className="bg-white rounded-xl shadow-lg p-6 mb-8 border border-gray-100">
            <div className="flex justify-between items-center mb-6">
                <div className="w-[80%] flex flex-row items-center justify-start gap-x-5">
                    <h2 className="text-2xl font-semibold text-gray-800">Data Entry</h2>
                <div className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                    Row: {activeRow}
                </div>
                </div>
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
            <div className="overflow-x-auto">

                {/* Columns  */}
                <div className={`grid grid-cols-1 lg:grid-cols-2 gap-8 transition-all duration-500 ease-in-out overflow-y-scroll ${isCollapsed ? 'max-h-0' : 'max-h-[600px]'}`}>
                    {desiredColumns.map((col, index) => (
                        <div key={index} className="group">
                            <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                                {col}
                            </label>
                            <div className="relative">
                                <div className="w-full p-0 bg-white border-2 border-gray-200 rounded-xl shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md focus-within:border-blue-500 focus-within:shadow-lg cursor-pointer min-h-[56px] flex items-center">
                                    <span className="text-gray-900 font-medium w-full h-full">
                                        {getFieldAsPerType(col)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default DataEntryTable