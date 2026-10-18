import { Box, Briefcase, Cpu, DoorOpen, FlaskConical, Monitor, Plane, Users, Wrench, Bot } from "lucide-react";

// Event types are told apart by icon; colour is kept for state
// (confirmed, pending, clash), as on the concept board.
export const EVENT_TYPES = {
  meeting: { label: "Meeting", Icon: Users },
  mission: { label: "Mission", Icon: Plane },
  resourceReservation: { label: "Booking", Icon: Box },
};

export const RESOURCE_TYPES = {
  meetingRoom: { label: "Meeting rooms", one: "Meeting room", Icon: Users },
  office: { label: "Offices", one: "Office", Icon: DoorOpen },
  desktop: { label: "Desks and workstations", one: "Desk", Icon: Monitor },
  toolKit: { label: "Tool kits", one: "Tool kit", Icon: Wrench },
  testingEquipment: { label: "Testing equipment", one: "Testing equipment", Icon: FlaskConical },
  robot: { label: "Robots", one: "Robot", Icon: Bot },
  prototype: { label: "Prototypes", one: "Prototype", Icon: Cpu },
};
export const RESOURCE_ORDER = ["meetingRoom", "office", "desktop", "toolKit", "testingEquipment", "robot", "prototype"];
export const ROOM_TYPES = ["meetingRoom", "office"];
export const FallbackIcon = Briefcase;

// State of an event: the server sends `state` (confirmed / pending / clash /
// declined); older payloads only have `status`.
export const stateOf = (event) => event.state || (event.status === "approved" ? "confirmed" : event.status === "declined" ? "declined" : "pending");

export const STATE_LABEL = { confirmed: "Confirmed", pending: "Pending approval", clash: "Clash", declined: "Declined" };

// Block styles: confirmed solid teal, pending dashed, clash outlined red, declined faded.
export const STATE_BLOCK = {
  confirmed: "bg-teal text-on-accent border border-teal",
  pending: "bg-teal/10 text-ink border-[1.5px] border-dashed border-teal",
  clash: "bg-red/10 text-red border-[1.5px] border-red",
  declined: "bg-sunk text-ink-3 line-through border border-line",
};

// Chips in month/week/list: neutral surface, state on the left edge.
export const STATE_CHIP = {
  confirmed: "border-l-[3px] border-l-teal",
  pending: "border-l-[3px] border-l-teal border-dashed",
  clash: "border-l-[3px] border-l-red text-red",
  declined: "border-l-[3px] border-l-line-2 text-ink-3 line-through",
};

export const STATE_PILL = { confirmed: "approved", pending: "pending", clash: "rejected", declined: "neutral" };

export const VISIBILITY = { public: "Everyone", department: "My department", private: "Only invited people" };
