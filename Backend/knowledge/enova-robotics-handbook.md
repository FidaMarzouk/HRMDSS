# Enova Robotics Employee Handbook

> **About this document.** This handbook is the knowledge base of the ENOVA Assistant (the HRMS chatbot).
> Sections describing working hours, attendance, leave and approvals mirror the rules the HRMS enforces automatically. After editing this file, an administrator can refresh the assistant with `POST /api/chatbot/reindex`
> (or simply restart the backend).

## About Enova Robotics

### Company overview
Enova Robotics is a Tunisian technology company that designs and builds mobile and service robots. It is
headquartered in Sousse, Tunisia and was founded in 2014. The company develops robots for
security and surveillance, research and education, and service applications, and it is regarded as one of the
pioneering robotics companies in Tunisia and Africa.

### Products and activities
Enova Robotics' work covers the full product cycle: mechanical and electronic design, embedded software,
autonomous navigation, prototyping, testing and deployment. Products associated with the company include:

- **PGuard**: an autonomous outdoor security and patrol robot used for surveillance of sites and perimeters.
  PGuard robots were deployed in Tunisia during the 2020 COVID-19 lockdown to patrol streets.
- **Mini-Lab**: a mobile robot platform for research and education.

For the current product catalogue and company news, see the official website [VERIFY: enovarobotics.com].

### Mission and values

Our mission is to design reliable, useful robots that solve real problems for our clients, built by a team that
learns quickly and works safely. Our values:

- **Innovation with purpose**: we build technology that is useful in the field, not just in the lab.
- **Safety first**: for people, for robots, and for our clients' sites.
- **Ownership**: we follow our work through from design to deployment and support.
- **Teamwork and respect**: engineering, operations and support succeed together.
- **Integrity**: we protect our clients' data and our intellectual property.

### Organisation and roles in the HRMS
The HRMS models the organisation with four roles:

| Role in HRMS | Who | What they can do |
|---|---|---|
| Employee | All staff members | Punch in and out, request leave and attendance corrections, calendar and bookings, chat, profile, My stats |
| Manager | Department heads | Everything an employee can, plus the first decision on their team's leave and corrections, team time records, skill ratings for their team and Team analytics |
| Admin (HR) | Human Resources | Manage people and departments (including archiving), final decision on leave, corrections from managers, approve calendar events and bookings, company Analytics |
| CEO (superAdmin) | Chief Executive Officer | Company-wide Analytics, decisions on leave and corrections requested by HR administrators |

Each employee belongs to one department, and the department's manager is automatically their manager in the HRMS.

## Contacting HR
- **Email:** hr@enovarobotics.eu
- **Phone extension:** 103
- **In the HRMS:** use Team Chat to message an HR administrator directly.

Questions about salary, payslips, contracts, benefits or anything personal and confidential should go to HR
directly. The ENOVA Assistant cannot see salary information.

## Working hours and attendance

### Standard working hours
- The standard workday runs from **08:00 to 18:00**, Monday to Friday (Africa/Tunis time).
- The lunch break runs from **12:30 to 14:00**.
- Weekends (Saturday and Sunday) are not working days.

### Punching in and out
Attendance is recorded in the HRMS with **Punch in** and **Punch out** on the **Time** page (also available from the
command palette, Ctrl K).

- Punch-in is only possible between **06:00 and 22:00**.
- You can work in several sessions on the same day (for example, punch out for a site visit and punch in again
  when you return). You must punch out before punching in again; only one session can be open at a time.
- Each punch records where it came from (web or mobile). There is no badge reader or location check.
- If you forget to punch out, or a time is wrong, request a correction (see *Attendance corrections* below).

### Late arrival
- Arriving after **08:30** counts as a late arrival. The HRMS records the session as **Late** and stores how many
  minutes late you were (counted from 08:30).
- Only the first session of the day can be marked late; coming back after lunch or a site visit is not "late".
- **Repeated lateness**: being late on **3 or more of the last 10 working days** is shown as an exception to your
  manager and HR on the Time page.

### Early arrival and overtime
- Punching in before 08:00 is recorded as early arrival; the minutes before 08:00 count as overtime.
- Working past 18:00 adds the minutes after 18:00 to your overtime.
- Overtime is recorded for reporting. Whether overtime is compensated or recovered as time off is decided with your
  manager and HR.

### Lunch break
- The lunch break can only be started in the HRMS between **12:30 and 14:00** using **Start break**, and ended with
  **End break**.
- Only one break can be running at a time. If you punch out during a break, the break is closed automatically.
- Break time is subtracted from your production hours.
- A break longer than **90 minutes** is shown as an exception to your manager and HR.

### Production hours
Production hours for a session = time between punch-in and punch-out, minus completed breaks. The expected working
day is **8 h 30** (08:00 to 18:00 minus the lunch break); it is the reference for hours and overtime figures.

### Absences
- Every weekday at **22:00**, the HRMS automatically records an **Absent** day for anyone who has no attendance record
  that day and is not on approved leave.
- To avoid an unjustified absence, always punch in, or make sure your leave request is fully approved beforehand.
- Public holidays are not yet excluded automatically; HR corrects absence records for official holidays.

### Missing punch-out
A session still open after **20:00** counts as a **missing punch-out**. It stays open (and its hours stay
incomplete) until a correction is approved.

### Attendance corrections
If a time record is wrong, open **Time**, find the day under your last working days and use **Fix…**:

- What you can ask for: a **missing punch-out** (give the time you left), a **forgotten punch-in** (give the time you
  arrived and left), or **wrong times** on a session. A reason is always required.
- Corrections are possible for the last **31 days**, and only one correction per session (or day) can wait for a
  decision at a time.
- Who decides follows the same chain as leave: an employee's correction goes to their **manager**, a manager's to
  **HR**, and an HR administrator's to the **CEO**.
- When the correction is approved, the attendance record is updated and its hours, lateness and overtime are
  recalculated; the record shows that it was corrected. If it is rejected, the reviewer's reason is sent to you.

### Public holidays
Enova Robotics observes the official Tunisian public holidays, including:
New Year's Day (1 January), Independence Day (20 March), Martyrs' Day (9 April), Labour Day (1 May), Republic Day
(25 July), Women's Day (13 August), Evacuation Day (15 October), Revolution and Youth Day (17 December), and the
religious holidays (Eid al-Fitr, Eid al-Adha, Islamic New Year and the Prophet's Birthday), whose dates vary each year.
HR announces the exact dates each year.

## Leave policy

### Leave entitlement and accrual
- Leave balances run by **calendar year** (1 January to 31 December):
  - **Employees** earn **1 day of leave per month**.
  - **Managers, HR administrators and the CEO** earn **2 days of leave per month**.
  - Each month of the year counts from **January**; in the year you join, counting starts the month after your hire
    month. A month's days are available from the first day of that month.
  - A year never earns more than **24 days** (the annual cap). At the current rates a full year earns 12 days for
    employees and 24 days for managers, HR and the CEO.
- Your balance = days earned this year − working days of fully approved leave taken this year.
- **No carry-over**: unused days are lost at the end of the year. On **1 January** every balance starts again at 0.
- Balances are refreshed automatically on the **1st of every month** (including 1 January), and are also recalculated
  whenever you submit a request or a request is approved.
- You can check your balance on **My stats**, on the **Leave** page, or by asking the ENOVA Assistant
  ("What is my leave balance?").

### How leave days are counted
- Leave is counted in **working days**: only Monday to Friday between the start and end date (inclusive) are counted.
  Weekends inside a leave period are not deducted.
- A request whose dates contain no working day (for example, Saturday to Sunday) is refused.
- You cannot request more days than your remaining balance.
- Leave is deducted from your balance only once the request receives **final approval**.
- Leave in a **later year** is counted against that year's balance, which starts at 0 on 1 January: only the days
  earned in that year by the end of the leave can be used. For example, an employee asking in November for
  5–9 January has earned only 1 day of the new year by then, so the request is refused; plan early-January leave
  as unpaid leave or move it later.
- A request that spans 31 December and 1 January uses each year's balance for its own days.

### Leave types
The HRMS supports six leave types:

| Leave type | When to use it |
|---|---|
| Vacation Leave | Planned holidays and personal time off |
| Sick Leave | Illness or medical appointments |
| Maternity Leave | Pregnancy, childbirth and recovery |
| Personal Leave | Personal or family matters that are not emergencies |
| Emergency Leave | Unexpected urgent situations (family emergency, accident) |
| Unpaid Leave | Time off beyond your balance, by agreement with your manager and HR |

Paternity leave is not a separate leave type in the HRMS; contact HR to arrange it.

### Leave type rules and supporting documents
- **Notice period**: submit planned leave at least **14 days** before the first day. Sick Leave and Emergency Leave
  are exempt. The HRMS shows reviewers how much notice was given; a shorter notice is not automatically refused,
  but the reviewer may decline it or propose other dates.
- **Sick Leave**: notify your manager as early as possible on the day. For absences longer than **3 working days**, a
  medical certificate must be sent to HR. If you could not submit the request in advance, submit it within 48 hours of
  your return.
- **Maternity Leave**: provide medical documentation of the expected delivery date to HR. Duration follows Tunisian
  labour law.
- **Emergency Leave**: submit the request as soon as possible, even after the fact, with a short explanation.
- **Unpaid Leave**: requires agreement from your manager and HR before submission.

### Approval chain
Who approves your leave depends on your role. The HRMS routes each request automatically; you don't choose the approver.

| Requester | First reviewer | Final approval |
|---|---|---|
| Employee | Their department manager | HR administrator |
| Manager | HR administrator | HR administrator |
| HR administrator | CEO | CEO |

Request statuses:
- **Pending**: submitted, waiting for the first review.
- **Manager Approved**: your manager agreed; HR still has to give final approval. This is not yet final.
- **Admin Approved**: final approval by HR. The days are deducted from your balance.
- **CEO Approved**: final approval by the CEO (for HR administrators' requests).
- **Manager Rejected / Admin Rejected / CEO Rejected**: the request was refused.

You receive a notification at every step. HR is also notified of every employee request so it can plan ahead.

### Overlapping requests
You cannot submit a leave request that overlaps (even partially) with another of your requests that is pending or
approved. Rejected requests don't block new ones.

### How requests are reviewed
Reviewers decide on the **Leave** page. For each request they see:

- **Team coverage**: who else in the department is away (approved or pending) on each day of the request.
- **Coverage limit**: the most people of one department who may be away on the same working day. HR can set it per
  department; otherwise it is **25% of the team, rounded, and at least 1 person**. Only days inside the request count.
- **Policy checks**: notice given (14 days, sick and emergency leave exempt), the balance after the request, and
  whether the coverage limit would be exceeded. These are warnings for the reviewer, not automatic refusals.
- **Suggested dates** when the coverage limit would be exceeded.

A reviewer can **approve**, **reject** (with a reason), or **propose other dates**. When dates are proposed, the
request waits for you: accept them (**Accept new dates**) and the request continues with the new dates (the
reviewer's approval applies to them), or keep your dates (**Keep my dates**) and the original request goes back to the
reviewer. After approving or rejecting, the reviewer
has **8 seconds to undo** the decision; you are only notified once that window has passed.

### Cancelling or changing leave
The HRMS does not yet allow you to cancel a submitted request. To change or cancel leave, contact your manager and HR,
who will reject or correct the request.

### Carry-over
There is no carry-over: unused leave days are lost at the end of the year, and every balance starts again at 0 on
1 January (see *Leave entitlement and accrual*). Plan your leave across the year with your manager.

## Calendar, meetings and missions

### Event types
The company calendar supports three event types, told apart by their icon:

- **Meeting**: requires a title, a description, a start and end time, and a location. A meeting can **book a room**
  (a meeting room or office); the room's name is then used as the location. You can invite colleagues.
- **Mission**: work travel or on-site intervention (for example a robot deployment at a client site). Requires a
  title, description, destination, start and end time. You can add the colleagues taking part.
- **Booking** (resource reservation): booking of company equipment or rooms. Requires choosing the resource.

Every event must last at least **10 minutes**, and the end must be after the start. Times are company time
(Africa/Tunis).

### Visibility
- **Public**: visible to everyone in the company.
- **Department**: visible to members of the organiser's department (they are also notified).
- **Private**: visible only to the organiser and invited people.

### Approval of events
- Events created by employees and managers start as **pending** and must be **approved by HR**. Events created by HR
  administrators or the CEO are approved automatically.
- Only pending events can be approved or declined.
- If an approved event's date, time or resource is changed by a non-admin, it goes back to pending for re-approval.
- Invited colleagues can **accept** or **decline** invitations; the organiser is notified of each response.
- Only the organiser or an HR administrator can edit or delete an event.

### Resources and equipment booking
Bookable resource types: meeting rooms, offices, desks and workstations, tool kits, testing equipment, robots and
prototypes. The **Resources** view of the calendar shows one row per resource for the week (08:00–18:00 each day):
confirmed bookings are solid, pending requests are dashed, and clashes are outlined in red.

- A booking (or a meeting's room) **cannot overlap a confirmed booking** of the same resource: creating it, moving
  it onto that time, or approving it is refused, and the HRMS shows which booking is in the way.
- Requests that overlap only other **pending** requests are allowed and shown as a **clash**: HR approves one of
  them, and the others can then no longer be approved at that time. Bookings that only touch (one ends at 10:00,
  the next starts at 10:00) do not clash.
- Resources under **maintenance** cannot be booked.
- Availability is checked while you fill in the form, so you see conflicts before saving.
- Private bookings show as "Private booking" in the resource view to people who are not involved.
- Return equipment in the state you found it, and report any damage to HR or the lab lead immediately.

## Workplace conduct

### Code of conduct
- Treat colleagues, clients and partners with respect and professionalism.
- Harassment, discrimination and intimidation of any kind are not tolerated.
- Avoid conflicts of interest; declare any outside activity related to robotics or our clients to HR.
- Use company resources (equipment, robots, accounts) for work purposes.

### Reporting concerns
Report any harassment, safety issue or ethical concern to your manager or directly to HR (hr@enovarobotics.eu).
Reports are handled confidentially and without retaliation.

### Confidentiality and intellectual property
- Designs, source code, schematics, test results, client information and product roadmaps are confidential.
- Do not share confidential information outside the company or on personal devices or accounts without authorisation.
- Work produced as part of your job (designs, software, documentation) belongs to Enova Robotics, as defined in your
  employment contract.
- Photos or videos of prototypes and client sites may not be published without approval.

### Personal data protection
The HRMS stores professional and personal data (contact details, attendance, leave). Access is limited by role:
employees see their own data, managers see their team's work data, and HR manages employee records. Personal data
is processed in line with Tunisian personal data protection law (Organic Law No. 2004-63). Ask HR to correct
any inaccurate information.

- **Salaries** are visible only to HR administrators and the CEO, and only after an explicit "reveal" on a profile.
- **Skills** have a level from 1 to 5. Levels set by your manager or HR are recorded as validated by them.
- **Leaving the company**: people are **archived**, never deleted. An archived account can no longer sign in, but its
  attendance, leave and history are kept. HR can restore an archived account. A manager who still leads a
  department or has direct reports must be replaced before being archived.
- **History**: sensitive changes (profile edits, salary views, skill ratings, archiving, leave decisions) are
  recorded with who made them and when. HR, the CEO and the person concerned can see a profile's history.

## Analytics and fairness
Analytics (for HR, the CEO and managers) show teams and periods: attendance and punctuality against targets
(95% attendance, 80% punctuality), overtime, leave coverage and hours worked against contracted hours. It raises
signals such as a department about to exceed its coverage limit, late arrivals concentrated on one weekday or rising,
overtime above 3 hours per person per week in a department, missing punch-outs, leave requests waiting more than
5 days for a decision, and a low notification read rate.

- Every signal shows the records it is based on. There are no "risk scores" for individual employees.
- Analytics describe patterns in teams and periods; they are not used to monitor individuals.
- Everyone can see their own figures on **My stats**.

## Health and safety

### Lab and robot safety
- Only trained staff may operate robots, test benches and power tools. Ask the lab lead for training before first use.
- Wear the required protective equipment in workshops and testing areas.
- Keep emergency-stop buttons accessible; never disable safety systems during tests.
- Mark robots under test and keep walkways clear. Outdoor tests of autonomous robots require prior approval and a
  clearly marked test area.
- Batteries (especially lithium batteries) must be charged and stored in the designated area.
- Report every incident or near-miss to your manager and HR the same day.

### Missions and travel
- Missions must be recorded in the calendar (event type Mission) before departure, with the destination and the
  people involved.
- Follow the client's site safety rules and carry the required identification.
- Travel expenses are reimbursed on presentation of receipts, according to the expenses procedure communicated by HR.
- If an accident happens during a mission, inform your manager and HR immediately.

## Remote work
Remote work may be granted occasionally with your manager's agreement, for tasks that don't
require lab access. Agree on it in advance, remain reachable during working hours via Team Chat, and keep recording
your attendance in the HRMS.

## Accounts and security

### Your HRMS account
- Your account is created by HR. You receive an email with a link to set your password; the link is valid for
  24 hours. If it expires, use **Forgot password** on the login page.
- Login sessions last **5 hours**, after which you need to sign in again.
- Forgotten password: use **Forgot password** on the login page. The reset link is sent to your personal email
  (or your work email if no personal email is recorded), is valid for **10 minutes**, and can be used once.
- To change your password from your profile, you must enter your current password.

### Notifications and data retention
- You receive in-app notifications for leave requests, decisions and proposed dates, attendance corrections, event
  invitations, event approvals and responses.
- Notifications are automatically deleted after **30 days**.
- Your conversation with the ENOVA Assistant is stored so you can see it later; you can clear it at any time from the
  chat window.

### Good security practices
- Never share your password; HR will never ask for it.
- Lock your computer when you leave your desk.
- Report suspicious emails or any suspected account compromise to HR immediately.
