// Transcribed from Zane's Google Sheet "Hood2Coast: Sicat Social Run Club" (modified 2026-08-20).
// [n, miles, gain, loss, net, difficulty, notes]
export const SHEET_LEGS = [
  [1,  6.26, 0,   2026, -2026, 4, []],
  [2,  6.05, 24,  1577, -1553, 3, []],
  [3,  4.08, 7,   738,  -731,  1, []],
  [4,  6.64, 35,  543,  -508,  2, ['Little/No Shade']],
  [5,  6.05, 421, 203,  218,   4, ['Little/No Shade']],
  [6,  7.10, 163, 581,  -418,  3, []],
  [7,  5.25, 176, 292,  -116,  2, ['Little/No Shade']],
  [8,  6.00, 140, 346,  -206,  2, []],
  [9,  5.38, 38,  258,  -220,  2, ['Little/No Shade']],
  [10, 6.15, 30,  129,  -99,   2, ['Little/No Shade']],
  [11, 3.92, 12,  117,  -105,  1, ['Little/No Shade']],
  [12, 5.85, 128, 189,  -61,   2, ['Little/No Shade']],
  [13, 5.21, 110, 118,  -8,    1, ['Little/No Shade']],
  [14, 7.91, 143, 154,  -11,   3, ['Little/No Shade']],
  [15, 6.00, 208, 183,  25,    3, ['Little/No Shade']],
  [16, 4.00, 91,  109,  -18,   1, ['Little/No Shade']],
  [17, 5.32, 82,  87,   -5,    2, ['Little/No Shade']],
  [18, 4.17, 335, 1121, -786,  3, ['Quiet Zone']],
  [19, 5.89, 446, 305,  141,   4, []],
  [20, 5.58, 912, 322,  590,   4, ['Gravel (Poss Dust)']],
  [21, 5.06, 34,  249,  -215,  2, ['Gravel (Poss Dust)']],
  [22, 6.82, 436, 618,  -182,  3, []],
  [23, 4.16, 142, 255,  -113,  1, []],
  [24, 4.83, 93,  94,   -1,    1, ['Quiet Zone']],
  [25, 3.80, 105, 51,   54,    1, []],
  [26, 5.65, 320, 381,  -61,   3, []],
  [27, 6.36, 250, 276,  -26,   2, ['Quiet Zone']],
  [28, 3.83, 236, 67,   169,   1, []],
  [29, 5.97, 602, 502,  100,   4, []],
  [30, 5.31, 230, 731,  -501,  2, []],
  [31, 3.96, 152, 296,  -144,  2, ['Quiet Zone']],
  [32, 4.20, 191, 261,  -70,   2, []],
  [33, 7.72, 243, 249,  -6,    3, ['Quiet Zone']],
  [34, 4.12, 173, 140,  33,    1, ['Little/No Shade', 'Quiet Zone']],
  [35, 7.07, 299, 87,   212,   3, ['Quiet Zone']],
  [36, 5.03, 123, 414,  -291,  2, ['Little/No Shade']],
]
export const MAJOR_EXCHANGES = [6, 12, 18, 24, 30]
// Sheet's per-leg times (distance × flat pace, rounded to whole seconds) and grand total, used as test oracles.
export const SHEET_TOTAL = '31:54:18'
export const SHEET_LEG1 = '1:02:36'
