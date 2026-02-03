# User Story: Proposal Engineer's Workbench

**Title:** Proposal Engineer Task Management and Weekly Scheduling Board

**As a** Proposal Engineer (with a DS or SE role),
**I want** an interactive workbench with a Kanban board and a weekly scheduler,
**so that** I can visually manage my assigned proposals, track their progress, update key details, and plan my work for the week.

---

### **Acceptance Criteria**

**1. Kanban Board for Proposal Management:**
*   **Board Access:** A new page titled "Proposal Workbench" is created, accessible only to users with `DS` (Design) and `SE` (Sales Engineer) roles.
*   **Automatic Task Population:** When an opportunity from the main page (`index.html`) is assigned to a PIC (Person In Charge), it must automatically appear on that user's Proposal Workbench board, typically in the 'Not Yet Started' column.
*   **Proposal Cards:** All proposals assigned to the logged-in engineer are displayed as individual cards on a Kanban board.
*   **Status Columns:** The board must have the following columns representing the proposal lifecycle:
    *   `Not Yet Started`
    *   `On-going`
    *   `For Approval`
    *   `Submitted`
*   **Drag-and-Drop:** Engineers can drag and drop proposal cards from one column to another to update the status. The change is automatically saved to the database.

**2. Editable Proposal Details:**
*   **Card Information:** Each card should display essential information at a glance (e.g., Project Name, Client).
*   **Editing Modal:** Clicking on a card opens a modal or an expandable section to edit the following fields:
    *   **Revision #**: A field to input the current proposal revision number (e.g., "Rev 1").
    *   **Margin %**: A field to update the project's margin percentage.
    *   **Final Amount**: A field to input the final submitted amount.
    *   **Submitted Date**: A date picker that is automatically populated with today's date when a card is moved to the "Submitted" column, but remains editable.

**3. Weekly Work Scheduler (Inspired by the Screenshot):**
*   **Calendar View:** The page features a weekly calendar view (Monday to Friday) integrated with the Kanban board.
*   **Scheduling Tasks:** Engineers can drag a proposal card from the board (especially from "On-going" or "Not Yet Started") and drop it onto a specific day in the weekly calendar. This assigns the task to that day.
*   **Visual Workload:** The calendar clearly shows which proposals are scheduled for each day, helping the engineer to plan and visualize their weekly workload.
*   **Task Monitoring:** This view provides a simple way for the engineer and their manager to see what is being worked on throughout the week.

**4. Data Integration and Consistency:**
*   **Real-time Updates:** Any updates made on the Proposal Workbench (e.g., changing status to "Submitted", updating the `Final Amount`) must be immediately reflected in the main `opps_monitoring` table and any relevant dashboards (like the Forecast Dashboard).
*   **Bi-directional Sync:** Changes made in the main opportunities view (e.g., re-assigning a PIC) should be reflected on the workbench, and vice-versa.
*   **Single Source of Truth:** The workbench uses the same underlying data as the rest of the application to ensure consistency.

**5. User Interface & Experience:**
*   **Clear and Intuitive:** The interface should be clean, modern, and intuitive, requiring minimal training.
*   **Filtering:** The board should include basic filtering options (e.g., filter by Client) to help manage a large number of proposals.
*   **Responsive:** The page should be functional on standard desktop screen sizes. 