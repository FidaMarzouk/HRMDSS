import { Fragment, useState, useEffect } from "react";
import { Calendar, Clock, Plus, Filter, List, ChevronLeft, ChevronRight, CheckCircle, XCircle, AlertTriangle, Users, MapPin, Briefcase, Wrench, Monitor, Home, User } from "lucide-react";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { format, parseISO, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, startOfWeek, endOfWeek, addDays} from "date-fns";
import { confirmAction, showError, showInfo, showSuccess, showWarning } from "../lib/alerts";
import "react-datepicker/dist/react-datepicker.css";
import "../datepicker.css";
import DatePicker from "react-datepicker";


// Resource type to icon mapping
const resourceTypeIcons = {
  desktop: <Monitor className="h-4 w-4" />,
  meetingRoom: <Users className="h-4 w-4" />,
  office: <Home className="h-4 w-4" />,
  robot: <span role="img" aria-label="robot" className="text-sm">🤖</span>,
  toolKit: <Wrench className="h-4 w-4" />,
  testingEquipment: <span role="img" aria-label="testing" className="text-sm">🔬</span>,
  prototype: <Briefcase className="h-4 w-4" />
};

// Event status to color mapping
const statusColors = {
  pending: "bg-amber/10 border-amber text-amber",
  approved: "bg-teal/10 border-teal text-teal",
  declined: "bg-red/10 border-red text-red"
};

// Event type to color mapping
const eventTypeColors = {
  meeting: "bg-blue/10 border-blue",
  mission: "bg-violet/10 border-violet",
  resourceReservation: "bg-teal/10 border-teal"
};

const CalendarManager = () => {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [filteredEvents, setFilteredEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month"); // month, week, day, list
  const [isLoading, setIsLoading] = useState(true);
  const [showEventModal, setShowEventModal] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showFilters, setShowFilters] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [resourcesList, setResourcesList] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [isResourceAvailable, setIsResourceAvailable] = useState(true);
  const [resourceConflictMessage, setResourceConflictMessage] = useState("");
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
const [conflictingEvents, setConflictingEvents] = useState([]);
const [availableResourcesCount, setAvailableResourcesCount] = useState(0);
const [resourceMaintenanceStatus, setResourceMaintenanceStatus] = useState(false);

  const [filters, setFilters] = useState({
    eventType: [],
    status: [],
    department: []
  });

  const API_BASE_URL = "/api/calendar";

  // Departments and invitable users don't change while browsing the calendar.
  useEffect(() => {
    fetchDepartments();
    fetchUsers();
  }, []);

  useEffect(() => {
    fetchEvents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate, viewMode]);
  const userRole = user?.role;

  // Event form state
  const [eventForm, setEventForm] = useState({
    title: "",
    eventType: "meeting",
    startDateTime: "",
    endDateTime: "",
    visibility: "public",
    description: "",
    location: "",
    destination: "",
    resourceType: "",
    resourceId: "",
    usersInvolved: []
  });
  
  useEffect(() => {
    const checkResourceAvailability = async () => {
      if (
        eventForm.eventType === "resourceReservation" &&
        eventForm.resourceId &&
        eventForm.startDateTime &&
        eventForm.endDateTime
      ) {
        try {
        
          const response = await api.get(`${API_BASE_URL}/resource-availability`, {
                        params: {
              resourceId: eventForm.resourceId,
              startDateTime: eventForm.startDateTime,
              endDateTime: eventForm.endDateTime,
              eventId: isEditMode ? selectedEvent?._id : null, // Exclude current event if editing
            }
          });
          setResourceMaintenanceStatus(response.data.resourceStatus === "maintenance");
          setIsResourceAvailable(response.data.available);
  
          if (!response.data.available) {
            if (response.data.resourceStatus === "maintenance") {
              setResourceConflictMessage("Resource is currently under maintenance");
            } else {
              setResourceConflictMessage("Resource is already reserved during this time period");
            }
  
            if (response.data.conflictingEvents?.length > 0) {
              setResourceConflictMessage("");
              setConflictingEvents(response.data.conflictingEvents);
            }
          }
        } catch (error) {
          console.error("Error checking resource availability:", error);
          setIsResourceAvailable(false);
          setResourceMaintenanceStatus(false);
          setResourceConflictMessage("Error checking resource availability");
        }
      } else {
        setIsResourceAvailable(true);
        setResourceConflictMessage("");
        setConflictingEvents([]);
      }
    };
  
    checkResourceAvailability();
  }, [eventForm.resourceId, eventForm.startDateTime, eventForm.endDateTime, eventForm.eventType, selectedEvent, isEditMode]);
 

useEffect(() => {
  if (eventForm.eventType === "resourceReservation" && eventForm.resourceType) {
    const fetchResources = async () => {
      setLoadingResources(true);
      try {
       
        const response = await api.get(`${API_BASE_URL}/resources`, {
                    params: { 
            type: eventForm.resourceType,
            date: eventForm.startDateTime || format(new Date(), "yyyy-MM-dd'T'HH:mm")
          }
        });
        
        setResourcesList(response.data);
        
        // Highlight available resources
        const availableResources = response.data.filter(r => 
          r.status === 'available' || (r.nextAvailableAt && new Date(r.nextAvailableAt) <= new Date(eventForm.startDateTime))
        );
        setAvailableResourcesCount(availableResources.length);
      } catch (error) {
        console.error("Error fetching resources:", error);
      } finally {
        setLoadingResources(false);
      }
    };
    
    fetchResources();
  } else {
    setResourcesList([]);
    setAvailableResourcesCount(0);
  }
}, [eventForm.eventType, eventForm.resourceType, eventForm.startDateTime]);

  useEffect(() => {
    // Apply filters to events
    if (events.length > 0) {
      let filtered = [...events];
      
      if (filters.eventType.length > 0) {
        filtered = filtered.filter(event => filters.eventType.includes(event.eventType));
      }
      
      if (filters.status.length > 0) {
        filtered = filtered.filter(event => filters.status.includes(event.status));
      }
      
      if (filters.department.length > 0) {
        filtered = filtered.filter(event => 
          event.departmentId && filters.department.includes(event.departmentId._id)
        );
      }
      
      setFilteredEvents(filtered);
    } else {
      setFilteredEvents([]);
    }
  }, [events, filters]);

  const fetchEvents = async () => {
    try {
      setIsLoading(true);
      
  
      let startDate, endDate;
      if (viewMode === "month") {
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
      } else if (viewMode === "week") {
        startDate = startOfWeek(currentDate);
        endDate = endOfWeek(currentDate);
      } 
      else {
        startDate = startOfMonth(currentDate);
        endDate = endOfMonth(currentDate);
      }
  
      const response = await api.get(`${API_BASE_URL}/events`, {
                params: {
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd")
        }
      });
      setEvents(response.data);
      setFilteredEvents(response.data);
    } catch (error) {
      console.error("Error fetching events:", error);
    } finally {
      setIsLoading(false);
    }
  };
  
  const fetchDepartments = async () => {
    try {
      
      const response = await api.get("/api/departments", {
              });
      setDepartments(response.data);
    } catch (error) {
      console.error("Error fetching departments:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get(`${API_BASE_URL}/users`, {
              });
  
      // Filter users with role 'employee' or 'manager'
      const filteredUsers = response.data.users.filter(user => 
        user.role === "employee" || user.role === "manager"
      );
  
      setUsersList(filteredUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };
  
  const handleEventClick = (event) => {
    setSelectedEvent(event);
    setIsEditMode(false);
    setShowEventModal(true);
  };

  const handleCreateEvent = () => {
    setSelectedEvent(null);
    setIsEditMode(true);
    
    const now = new Date();
    const endTime = new Date(now); // Create a new date object for end time
    endTime.setMinutes(now.getMinutes() + 30);
    
    const formattedDate = format(now, "yyyy-MM-dd'T'HH:mm");
    const formattedEndDate = format(endTime, "yyyy-MM-dd'T'HH:mm");
    
    const newEventForm = {
      title: "",
      eventType: "meeting",
      startDateTime: formattedDate,
      endDateTime: formattedEndDate,
      visibility: "public",
      description: "",
      location: "",
      destination: "",
      usersInvolved: []
    };
    
    setEventForm(newEventForm);
    setStartDate(now);        
    setEndDate(endTime);       
    setShowEventModal(true);
  };
  
  const handleEditEvent = async (event) => {
    setSelectedEvent(event);
    setIsEditMode(true);
    
    const startDateObj = new Date(event.startDateTime);
    const endDateObj = new Date(event.endDateTime);
    setStartDate(startDateObj);
    setEndDate(endDateObj);
    
    const baseForm = {
      title: event.title,
      eventType: event.eventType,
      visibility: event.visibility,
      startDateTime: event.startDateTime,
      endDateTime: event.endDateTime,
      description:event.description,
      usersInvolved: event.usersInvolved ? event.usersInvolved.map(user =>
        typeof user === 'object' ? user.userId : user
      ) : []
    };
    
    if (event.eventType === 'mission') {
      baseForm.destination = event.destination || '';
    } else if (event.eventType === 'meeting') {
      baseForm.description = event.description || '';
      baseForm.location = event.location || '';
    } else if (event.eventType === 'resourceReservation') {
      try {
        if (event.resource) {
          const resourceId = event.resource._id;
          
          const response = await api.get(`${API_BASE_URL}/resources/${resourceId}`, {
                      });
          
          if (response.data) {
            baseForm.resourceId = resourceId;
            baseForm.resourceType = response.data.type;
            baseForm.resourceName = response.data.name;
            
            if (response.data.type) {
              const resourcesResponse = await api.get(`${API_BASE_URL}/resources`, {
                                params: { type: response.data.type }
              });
              
              if (resourcesResponse.data) {
                setResourcesList(resourcesResponse.data);
                
                const availableResources = resourcesResponse.data.filter(r =>
                  r.status === 'available' ||
                  (r.nextAvailableAt && new Date(r.nextAvailableAt) <= new Date(event.startDateTime))
                );
                setAvailableResourcesCount(availableResources.length);
              }
            }
          }
        }
        
        setLoadingResources(false);
      } catch (error) {
        setLoadingResources(false);
      }
    }
    
    setEventForm(baseForm);
    setShowEventModal(true);
  };
// One line per conflicting booking, for the conflict warning.
const describeConflicts = (events = []) =>
  events
    .map((event) => `${event.title}: ${format(new Date(event.startDateTime), "MMM d, h:mm a")} to ${format(new Date(event.endDateTime), "h:mm a")}`)
    .join("\n");

// Updated form submission logic
const handleSubmitEvent = async (e) => {
  e.preventDefault();

  // Block submission if resource is under maintenance or unavailable
  if (eventForm.eventType === "resourceReservation") {
    if (resourceMaintenanceStatus) {
      showWarning("Resource Unavailable", "This resource is currently under maintenance and cannot be reserved.");
      return;
    } else if (!isEditMode && !isResourceAvailable) {
      showWarning("Resource unavailable", [resourceConflictMessage, describeConflicts(conflictingEvents)].filter(Boolean).join("\n\n"));
      return;
    }
  }
  try {
    let formData = { ...eventForm };

    // Adjust fields for resource reservations
    if (formData.eventType === "resourceReservation") {
      formData.resource = formData.resourceId;
      delete formData.resourceType;
      delete formData.resourceId;
    } else {
      delete formData.resourceType;
      delete formData.resourceId;
    }

    // Format users involved
    if (formData.usersInvolved && formData.usersInvolved.length > 0) {
      formData.usersInvolved = formData.usersInvolved.map(user => {
        const userId = typeof user === "object" ? user.userId || user : user;
        return { userId, status: "pending" };
      });
    }

    if (isEditMode && selectedEvent) {
      // Update existing event
      await api.put(`${API_BASE_URL}/event/${selectedEvent._id}`, formData, {
              });

      showSuccess("Success!", "Event updated successfully.");
    } else {
      // Create new event
      await api.post(`${API_BASE_URL}/event`, formData, {
              });

      showSuccess("Success!", "Event created successfully.");
    }

    setShowEventModal(false);
    fetchEvents();
  } catch (error) {
    console.error("Error saving event:", error);
  
    let errorMessage = "Failed to save event.";
    let errorStatus = error.response?.data?.status || "";
  
    // First, check for specific status codes
    if (errorStatus) {
      switch (errorStatus) {
        case "resource_conflict":
          errorMessage = "This resource is already reserved for the selected time period.";
          break;
        case "invalid_dates":
          errorMessage = "End date must be after start date.";
          break;
        case "duration_too_short":
          errorMessage = "Event must be at least 10 minutes long.";
          break;
        case "missing_description":
          errorMessage = "Description is required for meetings.";
          break;
        case "missing_location":
          errorMessage = "Location is required for meetings.";
          break;
        case "missing_destination":
          errorMessage = "Destination is required for missions.";
          break;
        case "missing_resource":
          errorMessage = "Resource is required for resource reservations.";
          break;
        default:
          // If we have a message from the backend but no specific handling,
          // use that message
          if (error.response?.data?.message) {
            errorMessage = error.response.data.message;
          }
      }
    } else if (error.response?.data?.message) {
      // If no status code but we have a message
      errorMessage = error.response.data.message;
    }
  
    // Resource conflicts list the bookings that overlap
    if (errorStatus === "resource_conflict" && error.response?.data?.conflictingEvents) {
      showWarning("Resource conflict", [errorMessage, describeConflicts(error.response.data.conflictingEvents)].filter(Boolean).join("\n\n"));
    } else {
      // For all other errors, show a simple error message
      showError("Error!", errorMessage);
    }
  }
};

const handleDeleteEvent = async () => {
  try {
    if (!selectedEvent) return;
    
    const confirmed = await confirmAction("Delete this event?", "It is removed for everyone invited. This cannot be undone.", "Delete event");

    if (confirmed) {
      // Get user ID from the state instead of localStorage
      const userId = user?.id;
      
      if (!userId) {
        showError("Error!", "User authentication error. Please try logging in again.");
        return;
      }
      
      await api.delete(`${API_BASE_URL}/event/${selectedEvent._id}`, {
              });
      
      showSuccess("Deleted!", "Event has been deleted.");
      
      setShowEventModal(false);
      fetchEvents();
    }
  } catch (error) {
    console.error("Error deleting event:", error);
    
    let errorMessage = "Failed to delete event.";
    if (error.response?.data?.status === "unauthorized") {
      errorMessage = "You are not authorized to delete this event.";
    } else if (error.response?.data?.status === "not_found") {
      errorMessage = "Event not found.";
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    
    showError("Error!", errorMessage);
  }
};


const handleAdminReview = async (status) => {
  try {
    
    await api.put(`${API_BASE_URL}/event/${selectedEvent._id}/review/${status}`, {}, {
          });
    
    showSuccess("Success!", `Event ${status === "approved" ? "approved" : "declined"} successfully.`);
    
    setShowEventModal(false);
    fetchEvents();
  } catch (error) {
    console.error("Error reviewing event:", error);
    
    let errorMessage = "Failed to review event.";
    if (error.response?.data?.status === "unauthorized") {
      errorMessage = "You are not authorized to review this event.";
    } else if (error.response?.data?.status === "invalid_status") {
      errorMessage = "Invalid status provided.";
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    
    showError("Error!", errorMessage);
  }
};

const handleUpdateAttendeeStatus = async (status) => {
  try {
    if (!selectedEvent) return;
    
    // Get user ID from the state 
    const userId = user?.id;
    
    if (!userId) {
      showError("Error!", "User authentication error. Please try logging in again.");
      return;
    }
    
    await api.put(`${API_BASE_URL}/event/${selectedEvent._id}/respond`, {
      status
    }, {
          });
    
    showSuccess("Success!", `Response updated successfully.`);
    
    setShowEventModal(false);
    fetchEvents();
  } catch (error) {
    console.error("Error updating attendee status:", error);
    
    let errorMessage = "Failed to update response.";
    if (error.response?.data?.status === "invalid_status") {
      errorMessage = "Invalid status provided.";
    } else if (error.response?.data?.status === "not_found") {
      errorMessage = "Event not found or you are not an attendee.";
    } else if (error.response?.data?.message) {
      errorMessage = error.response.data.message;
    }
    
    showError("Error!", errorMessage);
  }
};
  

  const handlePrevMonth = () => {
    if (viewMode === "month") {
      setCurrentDate(subMonths(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, -7));
    } else if (viewMode === "day") {
      setCurrentDate(addDays(currentDate, -1));
    }
  };

  const handleNextMonth = () => {
    if (viewMode === "month") {
      setCurrentDate(addMonths(currentDate, 1));
    } else if (viewMode === "week") {
      setCurrentDate(addDays(currentDate, 7));
    } else if (viewMode === "day") {
      setCurrentDate(addDays(currentDate, 1));
    }
  };

  const toggleFilter = (filterType, value) => {
    setFilters(prev => {
      const newFilters = { ...prev };
      if (newFilters[filterType].includes(value)) {
        newFilters[filterType] = newFilters[filterType].filter(item => item !== value);
      } else {
        newFilters[filterType] = [...newFilters[filterType], value];
      }
      return newFilters;
    });
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    
    const days = eachDayOfInterval({ start: startDate, end: endDate });
    
    return (
      <div className="grid grid-cols-7 gap-1">
        {/* Day headers */}
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day, index) => (
          <div key={index} className="text-center py-2 text-ink-3 font-medium">
            {day}
          </div>
        ))}
        
        {/* Calendar cells */}
        {days.map((day, dayIdx) => {
          // Find events for this day
          const dayEvents = filteredEvents.filter(event => {
            const startDate = parseISO(event.startDateTime);
            const endDate = parseISO(event.endDateTime);
            return isSameDay(day, startDate) || isSameDay(day, endDate) || 
                  (day > startDate && day < endDate);
          });
          
          return (
            <div
              key={dayIdx}
              className={`min-h-[100px] p-1 border ${
                isSameMonth(day, monthStart)
                  ? "border-line"
                  : "border-line bg-ground opacity-50"
              } ${
                isSameDay(day, new Date())
                  ? "bg-teal/10 border-teal"
                  : ""
              }`}
            >
              <div className="text-right p-1">
                <span
                  className={`text-sm ${
                    isSameDay(day, new Date())
                      ? "bg-teal text-on-accent rounded-full w-6 h-6 flex items-center justify-center float-right"
                      : "text-ink-2"
                  }`}
                >
                  {format(day, "d")}
                </span>
              </div>
              
              <div className="mt-1">
                {dayEvents.slice(0, 3).map((event, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleEventClick(event)}
                    className={`text-xs truncate p-1 mb-1 rounded cursor-pointer border-l-2 ${eventTypeColors[event.eventType]} ${statusColors[event.status]}`}
                  >
                    {format(parseISO(event.startDateTime), "HH:mm")} - {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-ink-3 text-center">
                    +{dayEvents.length - 3} more
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate);
    const weekEnd = endOfWeek(currentDate);
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    
    // Time slots from 8am to 8pm
    const timeSlots = Array.from({ length: 13 }, (_, i) => i + 8);
    
    return (
      <div className="overflow-x-auto">
        <div className="grid grid-cols-8 min-w-[900px]">
          {/* Header with times and days */}
          <div className="border-b border-r border-line p-2"></div>
          {days.map((day, idx) => (
            <div 
              key={idx} 
              className={`border-b border-r border-line p-2 text-center ${
                isSameDay(day, new Date()) ? "bg-teal/10" : ""
              }`}
            >
              <div className="font-medium">{format(day, "EEE")}</div>
              <div className={`text-sm ${
                isSameDay(day, new Date()) ? "text-teal" : "text-ink-2"
              }`}>
                {format(day, "d MMM")}
              </div>
            </div>
          ))}
          
          {/* Time slots */}
          {timeSlots.map((hour) => (
            <Fragment key={hour}>
              <div className="border-r border-b border-line p-2 text-right text-ink-3">
                {hour}:00
              </div>
              
              {days.map((day, dayIdx) => {
                const hourEvents = filteredEvents.filter(event => {
                  const start = parseISO(event.startDateTime);
                  const end = parseISO(event.endDateTime);
                  const hourStart = new Date(day.setHours(hour, 0, 0, 0));
                  const hourEnd = new Date(day.setHours(hour + 1, 0, 0, 0));
                  
                  return (
                    (start >= hourStart && start < hourEnd) ||
                    (end > hourStart && end <= hourEnd) ||
                    (start <= hourStart && end >= hourEnd)
                  );
                });
                
                return (
                  <div 
                    key={dayIdx} 
                    className="border-r border-b border-line p-1 relative"
                  >
                    {hourEvents.map((event, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleEventClick(event)}
                        className={`text-xs truncate p-1 mb-1 rounded cursor-pointer border-l-2 ${eventTypeColors[event.eventType]} ${statusColors[event.status]}`}
                      >
                        {format(parseISO(event.startDateTime), "HH:mm")} - {event.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    // Group events by date
    const eventsByDate = {};
    
    filteredEvents.forEach(event => {
      const date = format(parseISO(event.startDateTime), "yyyy-MM-dd");
      if (!eventsByDate[date]) {
        eventsByDate[date] = [];
      }
      eventsByDate[date].push(event);
    });
    
    return (
      <div className="space-y-4">
        {Object.keys(eventsByDate).length === 0 && (
          <div className="text-center text-ink-3 py-10">
            No events found for the selected filters
          </div>
        )}
        
        {Object.keys(eventsByDate).sort().map(date => (
          <div key={date} className="border border-line rounded-lg overflow-hidden">
            <div className="bg-panel p-3 border-b border-line">
              <div className="font-medium">
                {format(new Date(date), "EEEE, MMMM d, yyyy")}
              </div>
            </div>
            <div className="divide-y divide-line">
              {eventsByDate[date].sort((a, b) => 
                new Date(a.startDateTime) - new Date(b.startDateTime)
              ).map(event => (
                <div 
                  key={event._id} 
                  className="p-3 hover:bg-sunk cursor-pointer"
                  onClick={() => handleEventClick(event)}
                >
                  <div className="flex items-start">
                    <div className={`p-2 rounded-lg mr-3 ${eventTypeColors[event.eventType]}`}>
                      {event.eventType === "meeting" && <Users className="h-5 w-5 text-blue" />}
                      {event.eventType === "mission" && <Briefcase className="h-5 w-5 text-violet" />}
                      {event.eventType === "resourceReservation" && <Wrench className="h-5 w-5 text-teal" />}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div className="font-medium">{event.title}</div>
                        <div className={`text-xs px-2 py-1 rounded-full ${
                          event.status === "pending" ? "bg-amber/10 text-amber" :
                          event.status === "approved" ? "bg-teal/10 text-teal" :
                          "bg-red/10 text-red"
                        }`}>
                          {event.status}
                        </div>
                      </div>
                      <div className="text-sm text-ink-2 flex items-center mt-1">
                        <Clock className="h-3 w-3 mr-1" />
                        {format(parseISO(event.startDateTime), "HH:mm")} - 
                        {format(parseISO(event.endDateTime), "HH:mm")}
                      </div>
                      {event.location && (
                        <div className="text-sm text-ink-2 flex items-center mt-1">
                          <MapPin className="h-3 w-3 mr-1" />
                          {event.location}
                        </div>
                      )}
                      {event.resourceType && (
                        <div className="text-sm text-ink-2 flex items-center mt-1">
                          {resourceTypeIcons[event.resourceType]}
                          <span className="ml-1">
                            {event.resourceType} {event.resourceId && `(${event.resourceId})`}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative min-h-screen">
      
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center relative z-10">
        <div>
          <h1 className="text-2xl font-bold text-ink mb-1 flex items-center">
            <Calendar className="h-6 w-6 mr-2 text-teal" />
            Calendar Manager
          </h1>
          <p className="text-ink-2">Schedule and manage events, reservations and missions</p>
        </div>
        
        <div className="flex mt-4 sm:mt-0 space-x-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center px-3 py-2 rounded-lg bg-raise hover:bg-sunk transition-colors duration-200"
          >
            <Filter className="h-4 w-4 mr-2 text-teal" />
            <span>Filters</span>
          </button>
          
          <button
            onClick={handleCreateEvent}
            className="flex items-center px-3 py-2 rounded-lg bg-teal hover:bg-teal-hi text-on-accent transition-colors duration-200"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span>Create Event</span>
          </button>
        </div>
      </div>
      
      {/* Filters */}
      {showFilters && (
        <div className="bg-panel border border-line rounded-lg p-4 mb-4 relative z-10">
          <h3 className="text-lg font-medium mb-3">Filters</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Event Type Filter */}
            <div>
              <h4 className="text-sm font-medium text-ink-2 mb-2">Event Type</h4>
              <div className="space-y-2">
                {["meeting", "mission", "resourceReservation"].map(type => (
                  <label key={type} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={filters.eventType.includes(type)}
                      onChange={() => toggleFilter("eventType", type)}
                    />
                    <div className={`h-4 w-4 rounded border mr-2 ${
                      filters.eventType.includes(type) 
                        ? "bg-teal border-teal" 
                        : "border-line-2"
                    }`}>
                      {filters.eventType.includes(type) && (
                        <CheckCircle className="h-3 w-3 text-ink" />
                      )}
                    </div>
                    <span className="capitalize">{type}</span>
                  </label>
                ))}
              </div>
            </div>
            
           {/* Status Filter */}
           <div>
              <h4 className="text-sm font-medium text-ink-2 mb-2">Status</h4>
              <div className="space-y-2">
                {["pending", "approved", "declined"].map(status => (
                  <label key={status} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={filters.status.includes(status)}
                      onChange={() => toggleFilter("status", status)}
                    />
                    <div className={`h-4 w-4 rounded border mr-2 ${
                      filters.status.includes(status) 
                        ? "bg-teal border-teal" 
                        : "border-line-2"
                    }`}>
                      {filters.status.includes(status) && (
                        <CheckCircle className="h-3 w-3 text-ink" />
                      )}
                    </div>
                    <span className="capitalize">{status}</span>
                  </label>
                ))}
              </div>
            </div>
            
            {/* Department Filter */}
            <div>
              <h4 className="text-sm font-medium text-ink-2 mb-2">Department</h4>
              <div className="space-y-2">
                {departments.map(dept => (
                  <label key={dept._id} className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={filters.department.includes(dept._id)}
                      onChange={() => toggleFilter("department", dept._id)}
                    />
                    <div className={`h-4 w-4 rounded border mr-2 ${
                      filters.department.includes(dept._id) 
                        ? "bg-teal border-teal" 
                        : "border-line-2"
                    }`}>
                      {filters.department.includes(dept._id) && (
                        <CheckCircle className="h-3 w-3 text-ink" />
                      )}
                    </div>
                    <span>{dept.name}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Calendar Navigation and View Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 relative z-10">
        <div className="flex items-center space-x-4 mb-4 sm:mb-0">
          <button
            onClick={handlePrevMonth}
            className="p-2 rounded-lg bg-raise hover:bg-sunk transition-colors duration-200"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          
          <h2 className="text-xl font-medium">
            {viewMode === "month" && format(currentDate, "MMMM yyyy")}
            {viewMode === "week" && `Week of ${format(startOfWeek(currentDate), "MMM d")} - ${format(endOfWeek(currentDate), "MMM d, yyyy")}`}
            {viewMode === "list" && format(currentDate, "MMMM yyyy")}
          </h2>
          
          <button
            onClick={handleNextMonth}
            className="p-2 rounded-lg bg-raise hover:bg-sunk transition-colors duration-200"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-sm rounded-lg bg-raise hover:bg-sunk transition-colors duration-200"
          >
            Today
          </button>
        </div>
        
        <div className="flex space-x-1 bg-panel p-1 rounded-lg">
          <button
            onClick={() => setViewMode("month")}
            className={`p-2 rounded-lg ${
              viewMode === "month" 
                ? "bg-teal text-on-accent" 
                : "hover:bg-sunk"
            }`}
          >
            <Calendar className="h-5 w-5" />
          </button>
          
          <button
            onClick={() => setViewMode("week")}
            className={`p-2 rounded-lg ${
              viewMode === "week" 
                ? "bg-teal text-on-accent" 
                : "hover:bg-sunk"
            }`}
          >
            <span className="w-5 h-5 flex items-center justify-center font-mono">7</span>
          </button>
          
          <button
            onClick={() => setViewMode("list")}
            className={`p-2 rounded-lg ${
              viewMode === "list" 
                ? "bg-teal text-on-accent" 
                : "hover:bg-sunk"
            }`}
          >
            <List className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Calendar Content */}
      <div className="bg-panel border border-line rounded-lg p-4 relative z-10">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-teal"></div>
          </div>
        ) : (
          <>
            {viewMode === "month" && renderMonthView()}
            {viewMode === "week" && renderWeekView()}
            {viewMode === "list" && renderListView()}
          </>
        )}
      </div>
      
      {/* Event Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-scrim flex items-center justify-center z-50 p-4">
          <div className="bg-panel rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-line">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">
                  {selectedEvent ? "Edit Event" : "Create New Event"}
                </h2>
                <button
                  onClick={() => setShowEventModal(false)}
                  className="p-1 hover:bg-sunk rounded-full"
                >
                  <XCircle className="h-6 w-6 text-ink-2" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              {/* View Mode */}
              {selectedEvent && !isEditMode && (
                <div className="mb-6">
                  <div className="flex justify-between">
                    <h3 className="text-xl font-bold mb-2">{selectedEvent.title}</h3>
                    <div className={`px-3 py-1 rounded-full text-sm ${statusColors[selectedEvent.status]}`}>
                      {selectedEvent.status}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-ink-2 flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        {format(parseISO(selectedEvent.startDateTime), "EEEE, MMMM d, yyyy")}
                      </p>
                      <p className="text-ink-2 flex items-center mt-2">
                        <Clock className="h-4 w-4 mr-2" />
                        {format(parseISO(selectedEvent.startDateTime), "h:mm a")} - 
                        {format(parseISO(selectedEvent.endDateTime), "h:mm a")}
                      </p>
                      
                      {selectedEvent.location && (
                        <p className="text-ink-2 flex items-center mt-2">
                          <MapPin className="h-4 w-4 mr-2" />
                          {selectedEvent.location}
                        </p>
                      )}
                      {selectedEvent.createdBy && (
                      <p className="text-ink-2 flex items-center mt-2">
                        <User className="h-4 w-4 mr-2" />
                        Created by: {selectedEvent.createdBy.firstName} {selectedEvent.createdBy.lastName}
                      </p>
                    )}
                    </div>
                    
                    <div>
                    {selectedEvent.eventType === "resourceReservation" && (
                    <p className="text-ink-2 flex items-center">
                      {/* Try both resource.type and resourceType */}
                      {resourceTypeIcons[selectedEvent.resource?.type || selectedEvent.resourceType] || <Wrench className="h-4 w-4 mr-2" />}
                      <span className="ml-2 capitalize">
                        {selectedEvent.resource?.name || selectedEvent.resourceType} 
                        {selectedEvent.resourceId && ` (${selectedEvent.resourceId})`}
                      </span>
                    </p>
                  )}
                      
                      {selectedEvent.eventType === "mission" && selectedEvent.destination && (
                        <p className="text-ink-2 flex items-center">
                          <MapPin className="h-4 w-4 mr-2" />
                          Destination: {selectedEvent.destination}
                        </p>
                      )}
                      
                      <p className="text-ink-2 flex items-center mt-2">
                        <span className={`w-4 h-4 rounded-full mr-2 ${
                          selectedEvent.eventType === "meeting" ? "bg-blue" :
                          selectedEvent.eventType === "mission" ? "bg-violet" :
                          "bg-teal"
                        }`}></span>
                        <span className="capitalize">{selectedEvent.eventType}</span>
                      </p>
                    </div>
                  </div>
                  
                  {selectedEvent.description && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-ink-2 mb-1">Description</h4>
                      <p className="bg-raise p-3 rounded-lg text-sm">
                        {selectedEvent.description}
                      </p>
                    </div>
                  )}
                  
                  {selectedEvent.usersInvolved && selectedEvent.usersInvolved.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-ink-2 mb-2">Participants</h4>
                      <div className="bg-raise p-3 rounded-lg">
                        <div className="flex flex-wrap gap-2">
                          {selectedEvent.usersInvolved.map((user, idx) => {
                            const userData = usersList.find(u => u._id === user.userId._id || u._id === user.userId);
                            return userData ? (
                              <div 
                                key={idx} 
                                className={`text-xs px-3 py-1 rounded-full inline-flex items-center ${
                                  user.status === "pending" ? "bg-amber/10 text-amber" :
                                  user.status === "accepted" ? "bg-teal/10 text-teal" :
                                  "bg-red/10 text-red"
                                }`}
                              >
                                {userData.firstName} {userData.lastName}
                                {user.status === "pending" && <AlertTriangle className="h-3 w-3 ml-1" />}
                                {user.status === "accepted" && <CheckCircle className="h-3 w-3 ml-1" />}
                                {user.status === "declined" && <XCircle className="h-3 w-3 ml-1" />}
                              </div>
                            ) : null;
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="mt-6 flex flex-col sm:flex-row items-center justify-between space-y-3 sm:space-y-0">
                    {/* Event creator can edit or delete */}
                    {selectedEvent.createdBy && (selectedEvent.createdBy._id === user.id || user.role === "admin") && (
                      <div className="flex space-x-3">
                      <button
                        onClick={() => handleEditEvent(selectedEvent)} // Trigger handleEditEvent instead of manually setting state
                        className="px-4 py-2 rounded-lg bg-teal hover:bg-teal-hi text-on-accent"
                      >
                        Edit Event
                      </button>

                        
                        <button
                          onClick={handleDeleteEvent}
                          className="px-4 py-2 rounded-lg bg-red/10 text-red hover:bg-red/15"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                    
                    {/* Attendee can accept/decline */}
                    {selectedEvent.usersInvolved && 
                      selectedEvent.usersInvolved.some(u => (u.userId._id || u.userId) === user.id) && 
                      selectedEvent.createdBy && selectedEvent.createdBy._id !== user.id && (
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleUpdateAttendeeStatus("accepted")}
                          className="px-4 py-2 rounded-lg bg-teal/10 text-teal hover:bg-teal/15"
                        >
                          Accept
                        </button>
                        
                        <button
                          onClick={() => handleUpdateAttendeeStatus("declined")}
                          className="px-4 py-2 rounded-lg bg-red/10 text-red hover:bg-red/15"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    
                    {/* Admin can approve/decline events */}
                    {userRole === "admin" && selectedEvent.status === "pending" && (
                      <div className="flex space-x-3">
                        <button
                          onClick={() => handleAdminReview("approved")}
                          className="px-4 py-2 rounded-lg bg-teal/10 text-teal hover:bg-teal/15"
                        >
                          Approve
                        </button>
                        
                        <button
                          onClick={() => handleAdminReview("declined")}
                          className="px-4 py-2 rounded-lg bg-red/10 text-red hover:bg-red/15"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                    
                    <button
                      onClick={() => setShowEventModal(false)}
                      className="px-4 py-2 rounded-lg bg-raise hover:bg-sunk self-end"
                    >
                      Close
                    </button>
                  </div>
                </div>
              )}
              
              {/* Edit/Create Form */}
              {(isEditMode) && (
                <form onSubmit={handleSubmitEvent}>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-ink-2 block mb-2">Title</label>
                      <input
                        type="text"
                        required
                        value={eventForm.title}
                        onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                        className="w-full bg-panel border border-edge rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal"
                      />
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-ink-2 block mb-2">Event Type</label>
                      <select
                        value={eventForm.eventType}
                        onChange={(e) => setEventForm({...eventForm, eventType: e.target.value})}
                        className="w-full bg-panel border border-edge rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal"
                      >
                        <option value="meeting">Meeting</option>
                        <option value="mission">Mission</option>
                        <option value="resourceReservation">Resource Reservation</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-ink-2 block mb-2">Visibility</label>
                      <select
                        value={eventForm.visibility}
                        onChange={(e) => setEventForm({...eventForm, visibility: e.target.value})}
                        className="w-full bg-panel border border-edge rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal"
                      >
                        <option value="public">Public</option>
                        <option value="private">Private</option>
                        <option value="department">Department Only</option>
                      </select>
                    </div>
                    
                    <div>
                      <label className="text-sm font-medium text-ink-2 block mb-2">Start Date & Time</label>
                      <DatePicker
                        selected={startDate}
                        onChange={(date) => {
                          setStartDate(date);
                          setEventForm({...eventForm, startDateTime: date.toISOString()});
                        }}
                        showTimeSelect
                        dateFormat="MMMM d, yyyy h:mm aa"
                        className="w-full bg-panel border border-edge rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-ink-2 block mb-2">End Date & Time</label>
                      <DatePicker
                        selected={endDate}
                        onChange={(date) => {
                          setEndDate(date);
                          setEventForm({...eventForm, endDateTime: date.toISOString()});
                        }}
                        showTimeSelect
                        dateFormat="MMMM d, yyyy h:mm aa"
                        className="w-full bg-panel border border-edge rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal"
                      />
                    </div>
                    <div className="md:col-span-2">
                    <label className="text-sm font-medium text-ink-2 block mb-2">Description</label>
                    <textarea
                      value={eventForm.description}
                      onChange={(e) => setEventForm({...eventForm, description: e.target.value})}
                      className="w-full bg-panel border border-edge rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal min-h-[100px]"
                    ></textarea>
                  </div>
                    
                    {eventForm.eventType === "mission" && (
                      <div>
                        <label className="text-sm font-medium text-ink-2 block mb-2">Destination</label>
                        <input
                          type="text"
                          value={eventForm.destination}
                          onChange={(e) => setEventForm({...eventForm, destination: e.target.value})}
                          className="w-full bg-panel border border-edge rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal"
                        />
                      </div>
                    )}
                    
                    {eventForm.eventType === "resourceReservation" && (
                      <>
                        <div>
                          <label className="text-sm font-medium text-ink-2 block mb-2">
                            Resource Type
                          </label>
                          <select
                            value={eventForm.resourceType}
                            onChange={(e) => setEventForm({ ...eventForm, resourceType: e.target.value })}
                            className="w-full bg-panel border border-edge rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal"
                          >
                            <option value="">Select Resource Type</option>
                            <option value="desktop">Desktop</option>
                            <option value="meetingRoom">Meeting Room</option>
                            <option value="office">Office</option>
                            <option value="robot">Robot</option>
                            <option value="toolKit">Tool Kit</option>
                            <option value="testingEquipment">Testing Equipment</option>
                            <option value="prototype">Prototype</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-sm font-medium text-ink-2 block mb-2">Resource</label>
                          <div className="relative">
                            {loadingResources ? (
                              <div className="w-full bg-raise border border-line rounded-lg px-3 py-2 flex items-center">
                                <span className="text-ink-3">Loading resources...</span>
                              </div>
                            ) : (
                              <>
                                <select
                                  value={eventForm.resourceId}
                                  onChange={(e) => setEventForm({ ...eventForm, resourceId: e.target.value })}
                                  className="w-full bg-panel border border-edge rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal"
                                >
                                  <option value="">Select a resource</option>
                                  {resourcesList.map(resource => (
                                  <option 
                                    key={resource._id} 
                                    value={resource._id}
                                    className={resource.status === 'maintenance' ? 'text-amber' : 'text-teal'}
                                  >
                                    {resource.name} {resource.identifier ? `(${resource.identifier})` : ''}
                                    {resource.status === 'maintenance' ? ' - Under Maintenance' : ''}
                                  </option>
                                ))}
                                </select>

                                {eventForm.resourceId && eventForm.startDateTime && eventForm.endDateTime && (
                                  <div className="mt-2 px-2 py-1 rounded text-sm">
                                    {loadingResources ? (
                                      <span className="text-ink-2">Checking availability...</span>
                                    ) : (
                                      <>
                                        {isResourceAvailable ? (
                                          <div className="flex items-center text-teal">
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              className="h-4 w-4 mr-1"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M5 13l4 4L19 7"
                                              />
                                            </svg>
                                            <span>Resource is available for the selected time</span>
                                          </div>
                                        ) : (
                                          <div className="flex items-center text-red">
                                            <svg
                                              xmlns="http://www.w3.org/2000/svg"
                                              className="h-4 w-4 mr-1"
                                              fill="none"
                                              viewBox="0 0 24 24"
                                              stroke="currentColor"
                                            >
                                              <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M6 18L18 6M6 6l12 12"
                                              />
                                            </svg>
                                            <span>{resourceConflictMessage}</span>
                                            {conflictingEvents.length > 0 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  let conflictsList = conflictingEvents
                                                    .map(
                                                      (event) =>
                                                        `${event.title} - ${format(
                                                          new Date(event.startDateTime),
                                                          "MMM d, h:mm a"
                                                        )} to ${format(new Date(event.endDateTime), "h:mm a")}`
                                                    )
                                                    .join("\n");

                                                  showInfo("Conflicting Reservations", conflictsList);
                                                }}
                                                className="ml-2 text-xs underline hover:text-red"
                                              >
                                                View conflicts
                                              </button>
                                            )}
                                          </div>
                                        )}
                                      </>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                          {availableResourcesCount ===0 && resourcesList.length > 0 && (
                            <p className="text-xs text-teal mt-1">
                              {availableResourcesCount} of {resourcesList.length} resources available
                            </p>
                          )}
                        </div>
                      </>
                    )}
                    {(eventForm.eventType === "meeting" )&& (
                    
                       <div>
                       <label className="text-sm font-medium text-ink-2 block mb-2">Location</label>
                       <input
                         type="text"
                         value={eventForm.location}
                         onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                         className="w-full bg-panel border border-edge rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal"
                       />
                     </div>
                    )}
                    
                    <div className="md:col-span-2">
                      <label className="text-sm font-medium text-ink-2 block mb-2">Invite Users</label>
                      <select
                        multiple
                        value={eventForm.usersInvolved}
                        onChange={(e) => {
                          const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                          setEventForm({...eventForm, usersInvolved: selectedOptions});
                        }}
                        className="w-full bg-panel border border-edge rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal min-h-[120px]"
                      >
                        {usersList.map(user => (
                          <option key={user._id} value={user._id}>
                            {user.firstName} {user.lastName} ({user?.departmentId?.name || ""})
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-ink-3 mt-1">Hold Ctrl/Cmd to select multiple users</p>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setShowEventModal(false)}
                      className="px-4 py-2 rounded-lg bg-raise hover:bg-sunk"
                    >
                      Cancel
                    </button>
                    
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-lg bg-teal hover:bg-teal-hi text-on-accent"
                    >
                      {selectedEvent ? "Update Event" : "Create Event"}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CalendarManager;