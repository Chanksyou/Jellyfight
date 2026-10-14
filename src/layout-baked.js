// The built-in furniture layout: edits made with the dev layout editor (layout.js), exported and
// baked in so everyone gets them. The map is per act ({ 1: ..., 2: ... }); inside an act, keys are
// "object name#n"; p = position, q = rotation (quaternion), both in the Apartment node's space;
// hidden = not shown and not solid.
export const BAKED_LAYOUT = {
  1: {
    'Pet_corner#1': { p: [-0.0504, 0, -0.0065], q: [0, 0, 0, 1] },
    'Mug#1': { p: [-0.0027, 0, -0.043], q: [0, 0, 0, 1], hidden: true },
    'Cat_scratcher_and_box#1': { p: [0.0439, 0, -0.1053], q: [0, 0, 0, 1] },
    'Controllers#1': { p: [2.6066, 0, 9.0406], q: [0, -1, 0, 0] },
    'Glass_dish#1': { p: [5.8131, 0, -1.9077], q: [0, -0.5, 0, 0.86603] },
    'Spice_carousel#1': { p: [0.1283, 0, 0.0051], q: [0, 0, 0, 1] },
    'Kitchen#1': { p: [-0.0251, 0, -0.0147], q: [0, 0, 0, 1] },
    'Water_filter_pitcher#1': { p: [6.4716, 0, -2.886], q: [0, -0.70711, 0, 0.70711] },
    'Dish_cloth#1': { p: [-0.0211, 0, 0.1532], q: [0, 0, 0, 1] },
  },
  2: {},
  3: {},
};
