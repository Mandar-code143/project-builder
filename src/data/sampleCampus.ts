// Illustrative demonstration campus. Positions and walking times are sample
// data for the academic demo, NOT verified measurements of any real campus.
import type { CampusGraph } from "@/types/campus";

export const SAMPLE_GRAPH: CampusGraph = {
  nodes: [
    { id: "classroom", name: "Main Classroom Block", category: "academic", x: 400, y: 70, open: true },
    { id: "seminar-hall", name: "Seminar Hall", category: "academic", x: 105, y: 105, open: true },
    { id: "main-gate", name: "Main Gate", category: "gate", x: 700, y: 80, open: true },
    { id: "printing", name: "Printing Center", category: "service", x: 200, y: 150, open: true },
    { id: "dept-office", name: "Department Office", category: "administrative", x: 625, y: 150, open: true },
    { id: "library", name: "Central Library", category: "academic", x: 120, y: 305, open: true },
    { id: "student-section", name: "Student Section", category: "administrative", x: 685, y: 305, open: true },
    { id: "admin", name: "Administrative Office", category: "administrative", x: 420, y: 300, open: true },
    { id: "computer-lab", name: "Computer Laboratory", category: "academic", x: 260, y: 430, open: true },
    { id: "canteen", name: "Canteen", category: "facility", x: 565, y: 430, open: true },
  ],
  edges: [
    { from: "classroom", to: "seminar-hall", minutes: 5, blocked: false },
    { from: "classroom", to: "main-gate", minutes: 5, blocked: false },
    { from: "classroom", to: "printing", minutes: 4, blocked: false },
    { from: "classroom", to: "dept-office", minutes: 4, blocked: false },
    { from: "classroom", to: "admin", minutes: 4, blocked: false },
    { from: "printing", to: "library", minutes: 3, blocked: false },
    { from: "seminar-hall", to: "library", minutes: 4, blocked: false },
    { from: "printing", to: "admin", minutes: 5, blocked: false },
    { from: "printing", to: "computer-lab", minutes: 6, blocked: false },
    { from: "dept-office", to: "student-section", minutes: 3, blocked: false },
    { from: "main-gate", to: "student-section", minutes: 4, blocked: false },
    { from: "admin", to: "student-section", minutes: 5, blocked: false },
    { from: "admin", to: "dept-office", minutes: 5, blocked: false },
    { from: "library", to: "computer-lab", minutes: 3, blocked: false },
    { from: "admin", to: "canteen", minutes: 3, blocked: false },
    { from: "canteen", to: "student-section", minutes: 3, blocked: false },
    { from: "canteen", to: "computer-lab", minutes: 6, blocked: false },
    { from: "canteen", to: "dept-office", minutes: 6, blocked: false },
    { from: "admin", to: "computer-lab", minutes: 4, blocked: false },
  ],
};

/** Returns a deep copy so scenario edits never mutate the sample data. */
export function cloneSampleGraph(): CampusGraph {
  return {
    nodes: SAMPLE_GRAPH.nodes.map((n) => ({ ...n })),
    edges: SAMPLE_GRAPH.edges.map((e) => ({ ...e })),
  };
}
