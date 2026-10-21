// Domain types for the campus graph model.
export type NodeCategory =
  | "academic"
  | "service"
  | "administrative"
  | "facility"
  | "gate";

export interface CampusNode {
  id: string;
  name: string;
  category: NodeCategory;
  /** SVG x coordinate on the campus map (viewBox units). */
  x: number;
  /** SVG y coordinate on the campus map (viewBox units). */
  y: number;
  /** Whether the counter/office at this location is currently open. */
  open: boolean;
}

export interface CampusEdge {
  from: string;
  to: string;
  /** Estimated walking time in minutes. Illustrative demo data. */
  minutes: number;
  /** A blocked connection cannot be used by any route. */
  blocked: boolean;
}

export interface CampusGraph {
  nodes: CampusNode[];
  edges: CampusEdge[];
}
