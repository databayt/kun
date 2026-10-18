import type { SeekItem } from "../item";
import type { TrackId } from "../tracks/types";

// An adapter turns one source system's row into a SeekItem. Adding a board
// (a Notion database, a spreadsheet, another CRM object) is one adapter; the
// console, metrics and pulse don't change.
export interface SeekAdapter<Row> {
  track: TrackId;
  toItem(row: Row, instance: string): SeekItem;
}
