import { useState, useMemo, useEffect } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { ColObject, DropDowns, DataMap, Data } from '../DataTypes';
import CustomInput from "./CustomInput";



function DataEntryTable({ sheetColumns,activeRow, dropDowns, desiredColumns, columnTypeMap, dataMap, setDataMap, activeSheet, indirectMap, optRefMap, dependentColsMap, setDropDowns }:
    { sheetColumns:string[],activeRow: number, dropDowns: DropDowns, desiredColumns: string[], columnTypeMap: ColObject, dataMap: DataMap, setDataMap: React.Dispatch<React.SetStateAction<DataMap>>, activeSheet: string, indirectMap:{[index:Data]:Data[]}, optRefMap: {[index:number]:string}, dependentColsMap:{[index:number]:string}, setDropDowns: React.Dispatch<React.SetStateAction<DropDowns>> }) {
    const [isCollapsed, setCollapsed] = useState<boolean>(true)
    function handleDataChange(col: string, value: string | number): void {
        setDataMap(prev => ({
            ...prev,
            [activeSheet]: {
                ...prev[activeSheet],
                [activeRow]: {
                    ...prev[activeSheet][activeRow],
                    [col]: value
                }
            }
        }));
    }


    
 useEffect(() => {
  if (!sheetColumns?.length) return;
  if(!dataMap[activeSheet][activeRow])return;
  // pull out only the fields this effect depends on
  const auditResponse = dataMap[activeSheet]?.[activeRow]?.['Audit Response'] as string;
  const incorrectSeg = parseInt(dataMap[activeSheet]?.[activeRow]?.['# of Incorrect Segment'] as string);
  const missedSeg = parseInt(dataMap[activeSheet]?.[activeRow]?.['# of Missed Segment'] as string);
  const segmentError = dataMap[activeSheet]?.[activeRow]?.['# Segment Error'];


  const incorrectSegParsedValue = isNaN(incorrectSeg)?0:incorrectSeg;
  const missedSegParsedValue = isNaN(missedSeg)?0:missedSeg;

  if (
    sheetColumns.includes('Audit Response') &&
    sheetColumns.includes('# Segment Error') &&
    sheetColumns.includes('# of Incorrect Segment') &&
    sheetColumns.includes('# of Missed Segment')
  ) {
    if (auditResponse?.trim() !== '') {
      const newValue = incorrectSegParsedValue + missedSegParsedValue;
      if (segmentError !== newValue) {
        handleDataChange('# Segment Error', newValue);
      }
    }
  }
}, [
  activeSheet,
  activeRow,
  sheetColumns,
  dataMap[activeSheet]?.[activeRow]?.['Audit Response'],
  dataMap[activeSheet]?.[activeRow]?.['# of Incorrect Segment'],
  dataMap[activeSheet]?.[activeRow]?.['# of Missed Segment'],
  dataMap[activeSheet]?.[activeRow]?.['# Segment Error'],
]);


useEffect(() => {
  if (!sheetColumns?.length) return;
  if(!dataMap[activeSheet][activeRow])return;
  const sourceId = dataMap[activeSheet]?.[activeRow]?.['source_id'] as string;
  const keypointCount = parseInt(dataMap[activeSheet]?.[activeRow]?.['keypoint_count'] as string);
  const incorrectSeg = parseInt(dataMap[activeSheet]?.[activeRow]?.['# of Incorrect Segment'] as string);
  const correctSegments = dataMap[activeSheet]?.[activeRow]?.['Correct segments'];

  const keyPointCountParsedValue = isNaN(keypointCount)?0:keypointCount;
  const incorrectSegParsedValue = isNaN(incorrectSeg)?0:incorrectSeg;
  if (
    sheetColumns.includes('source_id') &&
    sheetColumns.includes('Correct segments') &&
    sheetColumns.includes('# of Incorrect Segment') &&
    sheetColumns.includes('keypoint_count')
  ) {
    if (sourceId?.trim() !== '') {
      const newValue = keyPointCountParsedValue - incorrectSegParsedValue;
      if (correctSegments !== newValue) {
        handleDataChange('Correct segments', newValue);
      }
    }
  }
}, [
  activeSheet,
  activeRow,
  sheetColumns,
  dataMap[activeSheet]?.[activeRow]?.['source_id'],
  dataMap[activeSheet]?.[activeRow]?.['keypoint_count'],
  dataMap[activeSheet]?.[activeRow]?.['# of Incorrect Segment'],
  dataMap[activeSheet]?.[activeRow]?.['Correct segments'],
]);


useEffect(() => {
   if(!indirectMap)return;
    if(!optRefMap)return;
  const row = dataMap[activeSheet]?.[activeRow];
  if (!row) return;
  const keys = Object.keys(dependentColsMap);
  keys.forEach(key=>{
    const col = optRefMap?.[parseInt(key)];
    if(!col)return;
    const value = row[col];
    if(!value) return;
    setDropDowns(prev=>({
      ...prev,
      [dependentColsMap[parseInt(key)]]:indirectMap?.[value] as Data[],
    }))
  })

}, [
  activeSheet,
  activeRow,
  dataMap[activeSheet]?.[activeRow], // 👈 watches the row object
  dependentColsMap,
  optRefMap,
  indirectMap,
]);


    const columns = useMemo(() => {
        if(!dataMap[activeSheet][activeRow])return;
        if(!dropDowns)return;
        return desiredColumns.map(col => {
            return <CustomInput
                name={col}
                type={columnTypeMap[col]}
                className={`${activeSheet}__${activeRow}__cols-${col}`}
                handleValueChange={handleDataChange} value={dataMap[activeSheet][activeRow][col]?dataMap[activeSheet][activeRow][col] :(columnTypeMap[col] !== 'l' && columnTypeMap[col] !== 'rl')?(columnTypeMap[col]=='n'?0:''):dropDowns[col][0]} values={(columnTypeMap[col] !== 'l' && columnTypeMap[col] !== 'rl') ? [] : dropDowns[col]} />

        });
    }, [dataMap, desiredColumns, columnTypeMap, activeSheet, activeRow,dropDowns]);



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
                    {columns}
                </div>
            </div>
        </div>
    )
}

export default DataEntryTable