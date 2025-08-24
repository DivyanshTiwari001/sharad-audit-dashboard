import { useEffect } from 'react';
import type { Data } from '../DataTypes'


interface ICustomInputProps {
    type: string,
    name: string,
    value: Data
    values?: Data[],
    className: string,
    id?: string,
    handleValueChange: (col: string, value: Data) => void;
}

function CustomInput(props: ICustomInputProps) {
    const { type, name, value, handleValueChange, className, id,values } = props;

    useEffect(()=>{
        handleValueChange(name,value as Data);
    },[])


    function excelDateToJSDate(serial: string | number): Date {
        if (typeof serial == 'string') return new Date(serial);
        const excelEpoch = new Date(1899, 11, 30);  // Excel considers 1900-01-01 as day 1, but there's a known 1-day offset 
        const jsDate = new Date(excelEpoch.getTime());
        jsDate.setDate(jsDate.getDate() + serial);
        return jsDate;
    }

    function getFieldAsPerType(col: string) {
        switch (type) {
            case "n": return <input
                type="number"
                name={col}
                id={col}
                className="w-full px-3 py-2 outline-none transition-all duration-200"
                value={value as Data}
                onChange={(e) => {
                    handleValueChange(col, e.target.value)
                }}
            />;
            case "d": return <input
                type="date"
                name={col}
                id={col}
                className="w-full px-3 py-2 outline-none transition-all duration-200"
                value={(value != null) ? excelDateToJSDate(value as (string | number)).toISOString().split("T")[0] : new Date().toISOString().split('T')[0]}
                onChange={(e) => {
                    handleValueChange(col, e.target.value)
                }}
            />;
            case "l":
            case "rl":
                 return <div className='flex flex-row justify-between w-full h-full items-center'>
                <select
                    name={col}
                    id={col}
                    className="w-full px-3 py-2 outline-none transition-all duration-200 bg-white appearance-none"
                    onChange={(e) => handleValueChange(col, e.target.value)}
                    value={value as Data}
                >
                    {
                        (values as Data[]).map(val => {
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
                    value={value as Data}
                    onChange={(e) => {
                        handleValueChange(col, e.target.value)
                    }}
                /><div className="absolute right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </div>
            </div>
        }
    }


    return (
        <div className={"group "+className} id={id}>
            <label className="block text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wider">
                {name}
            </label>
            <div className="relative">
                <div className="w-full p-0 bg-white border-2 border-gray-200 rounded-xl shadow-sm transition-all duration-200 hover:border-blue-300 hover:shadow-md focus-within:border-blue-500 focus-within:shadow-lg cursor-pointer min-h-[56px] flex items-center">
                    <span className="text-gray-900 font-medium w-full h-full">
                        {getFieldAsPerType(name)}
                    </span>
                </div>
            </div>
        </div>
    )
}

export default CustomInput