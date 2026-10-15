// Retrieval quality check for the ENOVA Assistant (no LLM calls, no cost).
// Usage: npm run rag:eval
process.env.TZ = 'Africa/Tunis';
const knowledgeIndex = require('../services/rag/knowledgeIndex');

// question -> text that should appear in one of the top-5 result headings
const CASES = [
  ['When is the lunch break?', 'Lunch break'],
  ['What time do we start work?', 'Standard working hours'],
  ['After what time am I considered late?', 'Late arrival'],
  ['How many leave days do managers earn per month?', 'Leave entitlement and accrual'],
  ['Are weekends deducted from my leave?', 'How leave days are counted'],
  ['Who approves leave for an employee?', 'Approval chain'],
  ['Who approves an HR administrator leave request?', 'Approval chain'],
  ['What does Manager Approved mean?', 'Approval chain'],
  ['What types of leave exist?', 'Leave types'],
  ['Do I need a medical certificate for sick leave?', 'Leave type rules'],
  ['Can I request leave that overlaps another request?', 'Overlapping requests'],
  ['How do I cancel a leave request?', 'Cancel'],
  ['Do unused leave days carry over to next year?', 'Carry-over'],
  ['What happens if I forget to punch in?', 'Absences'],
  ['Can I punch in at 5am?', 'Punch'],
  ['How is overtime counted?', 'overtime'],
  ['How are production hours calculated?', 'Production hours'],
  ['How do I book a robot?', 'Book a robot'],
  ['Can I reserve equipment that is under maintenance?', 'Resources and equipment booking'],
  ['Who must approve my meeting?', 'Approval of events'],
  ['What is a mission event?', 'Event types'],
  ['How do I reset my password?', 'password'],
  ['How long does my session last?', 'Signing in'],
  ['How do I contact HR?', 'Contacting HR'],
  ['What does Enova Robotics do?', 'Company overview'],
  ['What is PGuard?', 'Products and activities'],
  ['What are the lab safety rules?', 'Lab and robot safety'],
  ['Can I work from home?', 'Remote work'],
  ['How do I add a new employee?', 'Add or edit an employee'],
  ['What does punctuality score mean on my dashboard?', 'Personal dashboard'],
  ['How do I mark notifications as read?', 'Notifications'],
  ['How do I change my profile picture?', 'Profile'],
  ['Which public holidays do we have?', 'Public holidays'],
];

(async () => {
  const stats = await knowledgeIndex.build();
  let hits = 0;
  for (const [question, expected] of CASES) {
    const results = await knowledgeIndex.search(question, 5);
    const headings = results.map((r) => r.chunk.heading);
    const rank = headings.findIndex((h) => h.toLowerCase().includes(expected.toLowerCase()));
    if (rank >= 0) {
      hits++;
      console.log(`  ok #${rank + 1}  ${question}`);
    } else {
      console.log(`  MISS   ${question}\n         expected "${expected}", got: ${headings.slice(0, 3).join(' | ')}`);
    }
  }
  const rate = (hits / CASES.length) * 100;
  console.log(`\nTop-5 hit rate: ${hits}/${CASES.length} (${rate.toFixed(0)}%), index mode: ${stats.mode}`);
  process.exit(rate >= 90 ? 0 : 1);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
