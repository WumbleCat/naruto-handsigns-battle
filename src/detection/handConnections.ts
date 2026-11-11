// MediaPipe hand landmark topology: 21 points, indexed as
// 0 wrist; 1-4 thumb; 5-8 index; 9-12 middle; 13-16 ring; 17-20 pinky (base to tip).
export const WRIST = 0;
export const THUMB_TIP = 4;
export const INDEX_MCP = 5;
export const MIDDLE_MCP = 9;
export const PINKY_MCP = 17;

export const HAND_CONNECTIONS: ReadonlyArray<readonly [number, number]> = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 4],
  [0, 5],
  [5, 6],
  [6, 7],
  [7, 8],
  [5, 9],
  [9, 10],
  [10, 11],
  [11, 12],
  [9, 13],
  [13, 14],
  [14, 15],
  [15, 16],
  [13, 17],
  [0, 17],
  [17, 18],
  [18, 19],
  [19, 20],
];

export const LANDMARK_COUNT = 21;
