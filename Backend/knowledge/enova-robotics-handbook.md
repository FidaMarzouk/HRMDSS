# Enova Robotics Employee Handbook

> **About this document.** This handbook is the knowledge base of the ENOVA Assistant (the HRMS chatbot).
> Sections describing working hours, attendance, leave and approvals mirror the rules the HRMS enforces automatically.After editing this file, an administrator can refresh the assistant with `POST /api/chatbot/reindex`
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
.

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
| Employee | All staff members | Attendance punch-in/out, leave requests, calendar, team chat, profile, personal dashboard |
| Manager | Department heads | Everything an employee can, plus approve their team's leave (first level), see team attendance and the manager dashboard |
| Admin (HR) | Human Resources | Manage employees and departments, final approval of leave, approve calendar events and resource bookings, HR dashboard |
| CEO (superAdmin) | Chief Executive Officer | Company-wide dashboards and reports, approve leave requested by HR administrators |

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
Attendance is recorded in the HRMS with **Punch In** and **Punch Out** on the Attendance page.

- Punch-in is only possible between **06:00 and 22:00**.
- You can work in several sessions on the same day (for example, punch out for a site visit and punch in again
  when you return). You must punch out before punching in again; only one session can be open at a time.
- If you forget to punch out, the open session stays open; contact your manager or HR so the record can be corrected.

### Late arrival
- Arriving after **08:30** counts as a late arrival. The HRMS records the session as **Late** and stores how many
  minutes late you were (counted from 08:30).
- Only the first session of the day can be marked late; coming back after lunch or a site visit is not "late".
- Repeated late arrivals are visible to your manager and HR on their dashboards.

### Early arrival and overtime
- Punching in before 08:00 is recorded as early arrival; the minutes before 08:00 count as overtime.
- Working past 18:00 adds the minutes after 18:00 to your overtime.
- Overtime is recorded for reporting. Whether overtime is compensated or recovered as time off is decided with your
  manager and HR. .

### Lunch break
- The lunch break can only be started in the HRMS between **12:30 and 14:00** using **Start Break**, and ended with
  **End Break**.
- Only one break can be running at a time. If you punch out during a break, the break is closed automatically.
- Break time is subtracted from your production hours.

### Production hours
Production hours for a session = time between punch-in and punch-out, minus completed breaks. They are shown on your
dashboard and used in attendance and performance indicators.

### Absences
- Every weekday at **22:00**, the HRMS automatically records an **Absent** day for anyone who has no attendance record
  that day and is not on approved leave.
- To avoid an unjustified absence, always punch in, or make sure your leave request is fully approved beforehand.
- Public holidays are not yet excluded automatically; HR corrects absence records for official holidays.

### Public holidays
. Enova Robotics observes the official Tunisian public holidays , including:
New Year's Day (1 January), Independence Day (20 March), Martyrs' Day (9 April), Labour Day (1 May), Republic Day
(25 July), Women's Day (13 August), Evacuation Day (15 October), Revolution and Youth Day (17 December), and the
religious holidays (Eid al-Fitr, Eid al-Adha, Islamic New Year and the Prophet's Birthday), whose dates vary each year.
HR announces the exact dates each year.

## Leave policy

### Leave entitlement and accrual
- Leave is earned for each full month of service, counted from your hire date:
  - **Employees** earn **1 day of leave per month** of service.
  - **Managers, HR administrators and the CEO** earn **2 days of leave per month** of service.
- Your balance = days accrued since your hire date − days already taken on fully approved leave.
- Balances are refreshed automatically on the **1st of every month**, and are also recalculated whenever you submit
  a request or a request is approved.
- You can check your balance on your dashboard, on the Leave Requests page, or by asking the ENOVA Assistant
  ("What is my leave balance?").

### How leave days are counted
- Leave is counted in **working days**: only Monday to Friday between the start and end date (inclusive) are counted.
  Weekends inside a leave period are not deducted.
- A request whose dates contain no working day (for example, Saturday to Sunday) is refused.
- You cannot request more days than your remaining balance.
- Leave is deducted from your balance only once the request receives **final approval**.

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

Paternity leave is not a separate leave type in the HRMS; contact HR to arrange it .

### Leave type rules and supporting documents
.

- **Vacation Leave**: submit at least **7 days** before the first day so your manager can plan around your absence.
- **Sick Leave**: notify your manager as early as possible on the day. For absences longer than **3 working days**, a
  medical certificate must be sent to HR. If you could not submit the request in advance, submit it within 48 hours of
  your return.
- **Maternity Leave**: provide medical documentation of the expected delivery date to HR. Duration follows Tunisian
  labour law .
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

### Cancelling or changing leave
The HRMS does not yet allow you to cancel a submitted request. To change or cancel leave, contact your manager and HR,
who will reject or correct the request. .

### Carry-over
Unused leave days stay in your balance; the HRMS does not reset balances at the end of the year. HR may define a
maximum carry-over in the future. .

## Calendar, meetings and missions

### Event types
The company calendar supports three event types:

- **Meeting**: requires a title, description, location, start and end time. You can invite colleagues.
- **Mission**: work travel or on-site intervention (for example a robot deployment at a client site). Requires a
  title, description, destination, start and end time. You can add the colleagues taking part.
- **Resource reservation**: booking of company equipment or rooms. Requires choosing the resource.

Every event must last at least **10 minutes**, and the end must be after the start.

### Visibility
- **Public**: visible to everyone in the company.
- **Department**: visible to members of the organiser's department (they are also notified).
- **Private**: visible only to the organiser and invited people.

### Approval of events
- Events created by employees and managers start as **pending** and must be **approved by HR**. Events created by HR
  administrators or the CEO are approved automatically.
- If an approved event's date, time or resource is changed by a non-admin, it goes back to pending for re-approval.
- Invited colleagues can **accept** or **decline** invitations; the organiser is notified of each response.
- Only the organiser or an HR administrator can edit or delete an event.

### Resources and equipment booking
Bookable resource types: desktops, meeting rooms, offices, robots, tool kits, testing equipment and prototypes.

- A resource cannot be booked twice for overlapping times (declined reservations don't count).
- Resources under **maintenance** cannot be booked.
- The availability of each resource is shown when you create a reservation.
- Return equipment in the state you found it, and report any damage to HR or the lab lead immediately.

## Workplace conduct
.

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
  employment contract .
- Photos or videos of prototypes and client sites may not be published without approval.

### Personal data protection
The HRMS stores professional and personal data (contact details, attendance, leave). Access is limited by role:
employees see their own data, managers see their team's work data, and HR manages employee records. Personal data
is processed in line with Tunisian personal data protection law (Organic Law No. 2004-63) . Ask HR to correct
any inaccurate information.

## Health and safety
.

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
. Remote work may be granted occasionally with your manager's agreement, for tasks that don't
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
- You receive in-app notifications for leave requests and decisions, event invitations, event approvals and responses.
- Notifications are automatically deleted after **30 days**.
- Your conversation with the ENOVA Assistant is stored so you can see it later; you can clear it at any time from the
  chat window.

### Good security practices
- Never share your password; HR will never ask for it.
- Lock your computer when you leave your desk.
- Report suspicious emails or any suspected account compromise to HR immediately.
