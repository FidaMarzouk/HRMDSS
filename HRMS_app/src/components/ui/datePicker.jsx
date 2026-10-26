// In your datePicker.jsx file:
import { useState, useEffect, useRef } from 'react';
import { Button } from '../../components/ui/button';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, setMonth, setYear } from 'date-fns';

const CustomDatePicker = ({ selectedDate, onChange, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const [viewMode, setViewMode] = useState('days'); // 'days', 'months', or 'years'
  const pickerRef = useRef(null);

  // Close the picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setIsOpen(false);
        setViewMode('days'); // Reset to days view when closing
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Navigation functions
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Get days in current month view and include previous/next month days to fill grid
  const getDaysToDisplay = () => {
    const firstDayOfMonth = startOfMonth(currentMonth);
    const lastDayOfMonth = endOfMonth(currentMonth);
    
    // Get the day of the week for the first day of the month (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = firstDayOfMonth.getDay();
    
    // Get the day of the week for the last day of the month
    const lastDayOfWeek = lastDayOfMonth.getDay();
    
    // Calculate start date (to include days from previous month)
    const startDate = new Date(firstDayOfMonth);
    startDate.setDate(startDate.getDate() - firstDayOfWeek);
    
    // Calculate end date (to include days from next month)
    const endDate = new Date(lastDayOfMonth);
    endDate.setDate(endDate.getDate() + (6 - lastDayOfWeek));
    
    return eachDayOfInterval({ start: startDate, end: endDate });
  };

  // Day selection handler
  const handleSelectDay = (day) => {
    onChange(day);
    setIsOpen(false);
  };

  // Month selection handler
  const handleSelectMonth = (monthIndex) => {
    setCurrentMonth(setMonth(currentMonth, monthIndex));
    setViewMode('days');
  };

  // Year selection handler
  const handleSelectYear = (year) => {
    setCurrentMonth(setYear(currentMonth, year));
    setViewMode('days');
  };

  // Toggle to months view
  const showMonthsView = () => {
    setViewMode('months');
  };

  // Toggle to years view
  const showYearsView = () => {
    setViewMode('years');
  };

  // Format displayed date in input field
  const getFormattedDisplayDate = () => {
    return format(selectedDate, 'dd/MM/yyyy');
  };

  // Generate list of months
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Generate list of years (20 years back and forward)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 41 }, (_, i) => currentYear - 20 + i);

  return (
    <div className="relative" ref={pickerRef}>
<div className={`flex items-center border border-line rounded bg-panel text-ink hover:bg-teal/10 ${className} h-[40px]`}>
  <input
    type="text focus:border-teal focus:outline-none focus:ring-2 focus:ring-teal/25 placeholder:text-ink-3"
    readOnly
    value={getFormattedDisplayDate()}
    onClick={() => setIsOpen(!isOpen)}
    className="bg-transparent px-2 text-sm w-full outline-none cursor-pointer h-full"
    style={{ width: '95px' }}
  />
  <Button
    variant="ghost"
    onClick={() => setIsOpen(!isOpen)}
    className="h-full w-12 p-0 mr-0 text-teal flex items-center justify-center" 
  >
   <CalendarIcon className="h-8 w-8" />
  </Button>
</div>
      {isOpen && (  
        <div className="absolute z-50 mt-1 bg-panel border border-line rounded shadow-lg w-56 right-0 sm:right-auto">
          {/* Calendar header */}
          <div className="border-b border-line p-2">
            <div className="flex justify-between items-center">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={prevMonth} 
                className="h-10 w-10 p-0 hover:bg-teal/10 text-teal"
              >
                <ChevronLeft className="h-10 w-10" />
              </Button>
              
              <div className="flex gap-1">
                <button 
                  className="px-1 py-1 bg-teal text-on-accent rounded text-xs"
                  onClick={showMonthsView}
                >
                  {format(currentMonth, 'MMM')}
                </button>
                <button 
                  className="px-1 py-1 bg-teal text-on-accent rounded text-xs"
                  onClick={showYearsView}
                >
                  {format(currentMonth, 'yyyy')}
                </button>
              </div>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={nextMonth} 
                className="h-10 w-10 p-0 hover:bg-teal/10 text-teal"
              >
                <ChevronRight className="h-10 w-10" />
              </Button>
            </div>
          </div>

          <div className="p-1">
            {viewMode === 'days' && (
              <>
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-0 mb-1 text-center">
                  {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day) => (
                    <div 
                      key={day} 
                      className="text-xs text-teal font-medium py-1"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-0 text-center">
                  {getDaysToDisplay().map((day) => {
                    const isCurrentMonth = isSameMonth(day, currentMonth);
                    return (
                      <button
                        key={day.toISOString()}
                        onClick={() => isCurrentMonth && handleSelectDay(day)}
                        className={`
                          h-7 w-7 rounded flex items-center justify-center text-xs
                          ${!isCurrentMonth ? 'text-ink-3' : 
                            isSameDay(day, selectedDate) ? 'bg-teal text-on-accent font-medium' : 
                            isToday(day) ? 'border border-teal/50 text-teal' : 'text-ink hover:bg-teal/10'}
                        `}
                      >
                        {format(day, 'd')}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {viewMode === 'months' && (
              <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
                {months.map((month, index) => (
                  <button
                    key={month}
                    onClick={() => handleSelectMonth(index)}
                    className={`
                      p-1 rounded text-xs
                      ${currentMonth.getMonth() === index ? 'bg-teal text-on-accent font-medium' : 
                        'text-ink hover:bg-teal/10'}
                    `}
                  >
                    {month.substring(0, 3)}
                  </button>
                ))}
              </div>
            )}

            {viewMode === 'years' && (
              <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto">
                {years.map((year) => (
                  <button
                    key={year}
                    onClick={() => handleSelectYear(year)}
                    className={`
                      p-1 rounded text-xs
                      ${currentMonth.getFullYear() === year ? 'bg-teal text-on-accent font-medium' : 
                        'text-ink hover:bg-teal/10'}
                    `}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomDatePicker;