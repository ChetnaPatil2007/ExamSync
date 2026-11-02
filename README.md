# ExamSync – Exam Timetable Generator & Conflict Resolver

Discrete Mathematics project: sets, graphs, graph colouring (greedy + DSATUR), recursion and backtracking.
Frontend only (React + Vite + Tailwind v4). Data is saved in browser LocalStorage.

## How it works
1. Scheduling -> Exam Setup & Generate: tick the subjects that have an exam (filter by year / department / compulsory / elective),
   give the exam dates, holidays and the time slots in one day, choose rooms.
2. The app builds a conflict graph (an edge when a student writes both subjects), colours it to choose slots,
   then gives each exam the smallest free room that fits its students.
3. "Compare what-if conditions" re-runs the generator with one condition changed (fewer sessions, fewer days, a room closed ...)
   and explains the difference.

## Run
```bash
npm install
npm run dev
```
Settings -> "Reset sample data" restores the original dataset.
