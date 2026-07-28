import { useEffect, useState, useRef } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useDateFilter } from "./date";
import ShadTooltip from "@/components/common/shadTooltipComponent";

function DateInput({ date, onChange }: { date?: Date; onChange: (date?: Date) => void }) {
  const [day, setDay] = useState("");
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (date) {
      setDay(String(date.getDate()).padStart(2, "0"));
      setMonth(String(date.getMonth() + 1).padStart(2, "0"));
      setYear(String(date.getFullYear()));
    } else {
      setDay("");
      setMonth("");
      setYear("");
    }
  }, [date]);

  const updateDate = (d: string, m: string, y: string) => {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      const newDate = new Date(`${y}-${m}-${d}`);
      if (!isNaN(newDate.getTime())) {
        onChange(newDate);
      }
    } else if (!d && !m && !y) {
      onChange(undefined);
    }
  };

  const handleDayChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  let val = e.target.value.replace(/\D/g, "").slice(0, 2);
  if (parseInt(val) > 31) val = "31";
  if (val.length === 1 && parseInt(val) > 3) val = "0" + val;
  setDay(val);
  const m = monthRef.current?.value || month;
  const y = yearRef.current?.value || year;
  if (val && m && y) updateDate(val, m, y);

  if (val.length === 2) monthRef.current?.focus();
};


  const handleMonthChange = (e) => {
  let val = e.target.value.replace(/\D/g, "").slice(0, 2);
  if (parseInt(val) > 12) val = "12";
  if (val.length === 1 && parseInt(val) > 1) val = "0" + val;
  setMonth(val);
  const d = dayRef.current?.value || day;
  const y = yearRef.current?.value || year;
  if (d && val && y) updateDate(d, val, y);
  if (val.length === 2) yearRef.current?.focus();
};

const handleYearChange = (e) => {
  let val = e.target.value.replace(/\D/g, "").slice(0, 4);
  const currentYear = new Date().getFullYear();
  if (!val) val = currentYear.toString();
  if (parseInt(val) > currentYear) val = currentYear.toString();
  setYear(val);
  const d = dayRef.current?.value || day;
  const m = monthRef.current?.value || month;
  if (d && m && val) updateDate(d, m, val);
};


  return (
    <div className="flex items-center gap-1 w-full">
      <input
        ref={dayRef}
        value={day}
        onChange={handleDayChange}
        placeholder="dd"
        className="w-7 text-center bg-transparent outline-none border-none"
        maxLength={2}
      />
      <span>/</span>
      <input
        ref={monthRef}
        value={month}
        onChange={handleMonthChange}
        placeholder="mm"
        className="w-7 text-center bg-transparent outline-none border-none"
        maxLength={2}
      />
      <span>/</span>
      <input
        ref={yearRef}
        value={year}
        onChange={handleYearChange}
        placeholder="yyyy"
        className="w-12 text-center bg-transparent outline-none border-none"
        maxLength={4}
      />
    </div>
  );
}

export function Header() {
  const [open, setOpen] = useState(false);
  const [fromDate1, setFromDate1] = useState<Date | undefined>(undefined);
  const [toDate1, setToDate1] = useState<Date | undefined>(undefined);
  const { fromDate, toDate, setFromDate, setToDate } = useDateFilter();
  const [openFromCalendar, setOpenFromCalendar] = useState(false);
  const [openToCalendar, setOpenToCalendar] = useState(false);

  // Helper to format date as YYYY-MM-DD
  const formatDateString = (date: Date) => date.toISOString().slice(0, 10);

  // Today
  const setToday = () => {
    const t = formatDateString(new Date());
    setFromDate(t);
    setToDate(t);
  };

  // Yesterday
  const setYesterday = () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  setFromDate(formatDateString(yesterday));
  setToDate(formatDateString(today));
};


  // Last 1 Week
  const setLastWeek = () => {
  const today = new Date(); 
  const lastWeek = new Date(today); 
  lastWeek.setDate(today.getDate() - 7); 
  setFromDate(formatDateString(lastWeek));
  setToDate(formatDateString(today));
};


  // Last 15 Days
  const setLast15Days = () => {
  const today = new Date(); 
  const last15 = new Date(today); 
  last15.setDate(today.getDate() - 15); 
  setFromDate(formatDateString(last15));
  setToDate(formatDateString(today));
  };

  // Last 1 Month
  const setLastMonth = () => {
    const today = new Date(); 
    const last30 = new Date(today); 
    last30.setDate(today.getDate() - 30); 
    setFromDate(formatDateString(last30));
    setToDate(formatDateString(today));
  };

  // Last 3 Months
  const setLast3Months = () => {
    const today = new Date();
    const last3Months = new Date(today);
    last3Months.setDate(today.getDate() - 90); 
    setFromDate(formatDateString(last3Months));
    setToDate(formatDateString(today));
  };

  const handleApply = () => {
    if (fromDate1 && toDate1) {
      setFromDate(formatDateString(fromDate1));
      setToDate(formatDateString(toDate1));
    }
    setOpen(false);
  };

  const handleCancel = () => {
    setFromDate1(undefined);
    setToDate1(undefined);
    setOpen(false);
  };
const isActive = (f: string, t: string) =>
  fromDate === f && toDate === t;

const today = new Date();
const yesterday = new Date(today);
yesterday.setDate(today.getDate() - 1);
const lastWeek = new Date(today); 
  lastWeek.setDate(today.getDate() - 7);
const last15 = new Date(today); 
last15.setDate(today.getDate() - 15); 
const last30 = new Date(today); 
last30.setDate(today.getDate() - 30); 
const last3Months = new Date(today);
last3Months.setDate(today.getDate() - 90); 
const isCustomRangeActive = () => {
  if (!fromDate || !toDate) return false;

  const todayStr = formatDateString(new Date());
  const yesterdayStr = formatDateString(yesterday);
  const lastWeekStr = formatDateString(lastWeek);
  const last15Str = formatDateString(last15);
  const last30Str = formatDateString(last30);
  const last3MonthsStr = formatDateString(last3Months);

  const predefinedRanges = [
    [todayStr, todayStr],
    [yesterdayStr, todayStr],
    [lastWeekStr, todayStr],
    [last15Str, todayStr],
    [last30Str, todayStr],
    [last3MonthsStr, todayStr],
  ];

  // If current fromDate/toDate is not in predefined ranges → it's custom
  return !predefinedRanges.some(
    ([f, t]) => fromDate === f && toDate === t
  );
};

  return (
    <header className="flex flex-wrap justify-end gap-4 mt-0 ">
      <div className="flex items-center gap-2 flex-wrap">
        <ShadTooltip content="Today">
        <Button size="sm" className={`uppercase !h-6 !p-2 ${isActive(
          formatDateString(new Date()),
          formatDateString(new Date())
          ) ? "!bg-blue-500 !text-white hover:!bg-blue-500 hover:!text-white hover:!border-blue-500": "hover:!bg-white hover:!text-blue-500 hover:!border-blue-500"}`}
          variant="outline" onClick={setToday}>TDY</Button></ShadTooltip>
        <ShadTooltip content="Yesterday">
        <Button size="sm" 
        className={`uppercase !h-6 !p-2 ${isActive(
          formatDateString(yesterday),
          formatDateString(new Date())
          ) ? "!bg-blue-500 !text-white hover:!bg-blue-500 hover:!text-white hover:!border-blue-500" : "hover:!bg-white  hover:!text-blue-500 hover:!border-blue-500"}`}
         variant="outline" onClick={setYesterday}>YDY</Button></ShadTooltip>
         <ShadTooltip content="Last 1 Week">
        <Button size="sm" 
        className={`uppercase !h-6 !p-2 ${isActive(
          formatDateString(lastWeek),
          formatDateString(new Date())
          ) ? "!bg-blue-500 !text-white hover:!bg-blue-500 hover:!text-white hover:!border-blue-500": "hover:!bg-white  hover:!text-blue-500 hover:!border-blue-500"}`} variant="outline" onClick={setLastWeek}>1W</Button>
        </ShadTooltip>
        <ShadTooltip content="Last 15 Days">
        <Button size="sm" 
        className={`uppercase !h-6 !p-2 ${isActive(
          formatDateString(last15),
          formatDateString(new Date())
          ) ? "!bg-blue-500 !text-white hover:!bg-blue-500 hover:!text-white hover:!border-blue-500": "hover:!bg-white  hover:!text-blue-500 hover:!border-blue-500"}`} variant="outline" onClick={setLast15Days}>15D</Button>
        </ShadTooltip>
        <ShadTooltip content="Last 1 month">
        <Button size="sm" 
        className={`uppercase !h-6 !p-2 ${isActive(
          formatDateString(last30),
          formatDateString(new Date())
          ) ? "!bg-blue-500 !text-white hover:!bg-blue-500 hover:!text-white hover:!border-blue-500" : "hover:!bg-white  hover:!text-blue-500 hover:!border-blue-500"}`}variant="outline" onClick={setLastMonth}>1M</Button>
        </ShadTooltip>
        <ShadTooltip content="Last 3 Months">
        <Button size="sm" 
        className={`uppercase !h-6 !p-2 ${isActive(
          formatDateString(last3Months),
          formatDateString(new Date())
          ) ? "!bg-blue-500 !text-white hover:!bg-blue-500 hover:!text-white hover:!border-blue-500": "hover:!bg-white  hover:!text-blue-500 hover:!border-blue-500 "}`}
         variant="outline" onClick={setLast3Months}>3M</Button></ShadTooltip>

        <Popover open={open} onOpenChange={setOpen}>
          <ShadTooltip content="select Date Range">
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm"  className={`uppercase !h-6 !p-2 ${
                isCustomRangeActive()
                  ? "!bg-blue-500 !text-white hover:!bg-blue-500 hover:!text-white hover:!border-blue-500"
                  : "hover:!bg-white hover:!text-blue-500 hover:!border-blue-500"
              }`}
              >
              <CalendarIcon className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          </ShadTooltip>

          <PopoverContent className="p-3 w-[400px] h-[120px] bg-white rounded-lg shadow-lg mr-10">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-sm font-medium mb-1">From</p>
                <div className="flex items-center border-b p-0 justify-between">
                  <DateInput date={fromDate1} onChange={setFromDate1} />
                  <Popover open={openFromCalendar} onOpenChange={setOpenFromCalendar}>
                    <PopoverTrigger>
                      <CalendarIcon className="w-4 h-4 cursor-pointer" />
                    </PopoverTrigger>
                    <PopoverContent className="p-2">
                      <Calendar
                        mode="single"
                        selected={fromDate1}
                        onSelect={(d) => {
                          setFromDate1(d);
                          setOpenFromCalendar(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              <div>
                <p className="text-sm font-medium mb-1">To</p>
                <div className="flex items-center border-b p-0 justify-between">
                  <DateInput date={toDate1} onChange={setToDate1} />
                  <Popover open={openToCalendar} onOpenChange={setOpenToCalendar}>
                    <PopoverTrigger>
                      <CalendarIcon className="w-4 h-4 cursor-pointer" />
                    </PopoverTrigger>
                    <PopoverContent className="p-2">
                      <Calendar
                        mode="single"
                        selected={toDate1}
                        onSelect={(d) => {
                          setToDate1(d);
                          setOpenToCalendar(false);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-2">
              <Button variant="ghost" className="!h-8 !w-20" onClick={handleCancel}>Cancel</Button>
              <Button disabled={!fromDate1 || !toDate1}  className="!h-8 !w-20 "onClick={handleApply}>Apply</Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}