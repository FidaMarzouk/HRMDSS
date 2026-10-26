// Three starting prompts per page, adjusted to the role.
const REVIEWER = new Set(["manager", "admin", "superAdmin"]);

export function suggestionsFor(page, role) {
  const reviewer = REVIEWER.has(role);
  const punches = role !== "superAdmin";
  switch (page) {
    case "leave":
      return reviewer
        ? ["Which leave requests are waiting for me?", "Who in my team is away next week?", "How many leave days do I have left?"]
        : ["How many leave days do I have left?", "I'd like next Friday off", "Can I take 3 days at the end of the month?"];
    case "time":
      return punches
        ? ["I forgot to punch out yesterday at 17:30", "How many hours did I work this week?", reviewer ? "Which corrections are waiting for me?" : "Start my break"]
        : ["Which corrections are waiting for me?", "Who is in today?", "How are attendance corrections reviewed?"];
    case "calendar":
      return ["Find a free meeting room tomorrow 14:00–15:00", "What's on my calendar this week?", role === "admin" ? "Which events are waiting for my approval?" : "Book a tool kit on Thursday morning"];
    case "inbox":
      return ["What needs my action?", "Do I have invitations to answer?", "Tell HR my phone number changed"];
    case "analytics":
      return ["What needs attention this period?", "Who is on leave next week?", "Who is in today?"];
    case "profile":
      return ["How do I sign out my other devices?", "What does the shift theme do?", "How many leave days do I have left?"];
    case "people":
      return ["Who is in today?", "Find Ahmed Zouari", "Who in my team is away next week?"];
    default:
      return punches
        ? ["What needs my attention today?", "Punch me in", "Book a meeting room tomorrow at 10 for an hour"]
        : ["What needs my attention today?", "Who is in today?", "What's on my calendar this week?"];
  }
}
