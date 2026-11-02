#!/usr/bin/env python3
"""Run once from the ROOT of your examsync project (after copying the new files in):
       python apply_patches.py
Applies the small edits to the files that did not need a full rewrite and deletes
src/algorithms/mathOperations.js (its helpers now live in graphAlgorithms.js)."""
import os, sys

def patch(path, edits):
    if not os.path.exists(path):
        print(f"!! missing {path}"); return
    text = open(path, encoding='utf-8').read()
    for old, new in edits:
        if old not in text:
            print(f"!! {path}: could not find  {old[:60]!r}"); continue
        text = text.replace(old, new)
    open(path, 'w', encoding='utf-8').write(text)
    print(f"ok {path}")

# ---------------- Management: semester -> year, subject type ----------------
patch('src/pages/Management.jsx', [
    ("{ name: 'semester', label: 'Semester', type: 'number', min: 1, max: 8, required: true, default: 3 }",
     "{ name: 'year', label: 'Year', type: 'number', min: 1, max: 4, required: true, default: 2 }"),
    ("{ key: 'semester', label: 'Sem' }", "{ key: 'year', label: 'Year' }"),
    ("key: 'semester', label: 'Semester'", "key: 'year', label: 'Year'"),
    (".semester", ".year"),
    ('label">Semester<', 'label">Year<'),
    ('<th className="th">Sem</th>', '<th className="th">Year</th>'),
    ("Sem {s.year}", "Year {s.year}"),
    ("{ name: 'facultyId', label: 'Assigned faculty'",
     "{ name: 'type', label: 'Subject type', type: 'select', options: ['Compulsory', 'Elective'], required: true, default: 'Compulsory' },\n    { name: 'facultyId', label: 'Assigned faculty'"),
    ("{ key: 'facultyName', label: 'Faculty' },",
     "{ key: 'type', label: 'Type', render: (r) => <Badge color={r.type === 'Compulsory' ? 'blue' : 'orange'}>{r.type}</Badge> },\n    { key: 'facultyName', label: 'Faculty' },"),
    ("{ key: 'year', label: 'Year', options: [...new Set(data.subjects.map((s) => s.year))].sort() }]}",
     "{ key: 'year', label: 'Year', options: [...new Set(data.subjects.map((s) => s.year))].sort() }, { key: 'type', label: 'Type', options: ['Compulsory', 'Elective'] }]}"),
    ('<div><span className="label">Subject ID</span>{view.id}</div>', '<div><span className="label">Type</span>{view.type}</div>'),
])

# ---------------- Timetable ----------------
patch('src/pages/Timetable.jsx', [
    ("import { useData, buildTimetableRows, fmtDate, DEPARTMENTS, DEPT_SHORT } from '../data/sampleData';",
     "import { useData, buildTimetableRows, fmtDate, DEPARTMENTS, DEPT_SHORT, examSubjects } from '../data/sampleData';"),
    (".semester", ".year"),
    ('<option value="">Semester: All</option>', '<option value="">Year: All</option>'),
    ("'Sem'", "'Year'"),
    ("Sem {r.year}", "Year {r.year}"),
    ("const unscheduled = data.subjects.length - rows.length;", "const unscheduled = examSubjects(data).length - rows.length;"),
    ('{r.building}</span></td><td className="td">{r.faculty}</td>', '{r.building} · {r.enrolled}/{r.capacity} seats</span></td><td className="td">{r.faculty}</td>'),
    ("`${r.roomName} (${r.building})`", "`${r.roomName} (${r.enrolled}/${r.capacity})`"),
])

# ---------------- Student portal ----------------
patch('src/pages/StudentPortal.jsx', [
    ("import { useData, buildTimetableRows, fmtDate, todayISO, DEPT_SHORT } from '../data/sampleData';",
     "import { useData, buildTimetableRows, fmtDate, todayISO, DEPT_SHORT, examSubjects } from '../data/sampleData';"),
    ("data.subjects.filter((s) => student.subjects.includes(s.id) && !all", "examSubjects(data).filter((s) => student.subjects.includes(s.id) && !all"),
    ("Semester / Division", "Year / Division"),
    ("{student.semester}", "{student.year}"),
])

# ---------------- Conflict graph ----------------
patch('src/pages/ConflictGraph.jsx', [
    ("import { useData, slotLabel, CHART_COLORS, DEPT_SHORT } from '../data/sampleData';",
     "import { useData, slotLabel, CHART_COLORS, DEPT_SHORT, examSubjects } from '../data/sampleData';"),
    ("const graph = useMemo(() => buildConflictGraph(data.subjects, data.students), [data.subjects, data.students]);",
     "const subs = useMemo(() => examSubjects(data), [data.subjects, data.settings.plan]);\n  const graph = useMemo(() => buildConflictGraph(subs, data.students), [subs, data.students]);"),
    ('<Badge color="violet">Sem {sel.subject.semester}</Badge>',
     '<Badge color="violet">Year {sel.subject.year}</Badge><Badge color={sel.subject.type === \'Compulsory\' ? \'blue\' : \'orange\'}>{sel.subject.type}</Badge>'),
])

# ---------------- Conflict resolver ----------------
patch('src/pages/ConflictResolver.jsx', [
    ("import { useData, slotLabel, CONFLICT_TYPES } from '../data/sampleData';", "import { useData, slotLabel, CONFLICT_TYPES, examSubjects } from '../data/sampleData';"),
    ("const unscheduled = data.subjects.filter((s) => !entryOf(s.id));",
     "const examSubs = examSubjects(data);\n  const unscheduled = examSubs.filter((s) => !entryOf(s.id));"),
    ('<option value="">Subject…</option>{data.subjects.map(', '<option value="">Subject…</option>{examSubs.map('),
])

# ---------------- Algorithm playground ----------------
patch('src/pages/AlgorithmPlayground.jsx', [
    ("import { useData, CHART_COLORS } from '../data/sampleData';", "import { useData, CHART_COLORS, examSubjects } from '../data/sampleData';"),
    ("findInvalidEdges, maxClique } from '../algorithms/graphAlgorithms';", "findInvalidEdges, maxClique, union, intersection, difference } from '../algorithms/graphAlgorithms';"),
    ("import { union, intersection, difference } from '../algorithms/mathOperations';\n", ""),
    ("buildConflictGraph(data.subjects, data.students) };", "buildConflictGraph(examSubjects(data), data.students) };"),
    ("Live dataset (all subjects)", "Live dataset (exam subjects)"),
])

# ---------------- Analytics ----------------
patch('src/pages/Analytics.jsx', [
    ("import { useData, computeStats, CHART_COLORS } from '../data/sampleData';", "import { useData, computeStats, CHART_COLORS, examSubjects } from '../data/sampleData';"),
    ('label="Total examinations" value={data.subjects.length}', 'label="Total examinations" value={examSubjects(data).length}'),
])

# ---------------- Sidebar label ----------------
patch('src/components/Sidebar.jsx', [("label: 'Generate Timetable'", "label: 'Exam Setup & Generate'")])

# ---------------- README ----------------
open('README.md', 'w', encoding='utf-8').write("""# ExamSync – Exam Timetable Generator & Conflict Resolver

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
""")
print("ok README.md")

# ---------------- remove the merged file ----------------
p = 'src/algorithms/mathOperations.js'
if os.path.exists(p):
    os.remove(p); print("deleted", p)
print("done")
