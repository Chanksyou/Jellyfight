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
  3: {
    'Sleeping_baby#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Bed#1': { p: [-0.0382, 0, -0.0585], q: [0, 0, 0, 1] },
    'Glass-case_shrine#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Ganesha#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Cat_mask#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Laughing_Buddha#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Floating_shelf#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Bronze_figurine#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
  },
  4: {
    // act 4's props: the Elites' furniture (stage4.js ELITES4) is cleared round each one
    'Singing_bowl#1': { p: [1.155, -0.165, -3.085], q: [0, 0, 0, 1] },
    'Mushroom_pillow#1': { p: [0, 0, 0.45], q: [0, 0, 0, 1] },
    'Headphones#1': { p: [1.195, -0.3, -0.785], q: [0, 0, 0, 1] },
    'Wooden_bowl#1': { p: [0, 0, 0], q: [0, 0, 0, 1], hidden: true },
    'Disco-ball_mobile#1': { p: [0, 0, 0], q: [0, 0, 0, 1], hidden: true },
    // the vents by the Elites land you across from them, not on them
    'vent:Vent by the lounge chair': { at: [3.432, 0, 1.877], land: [3.2, 0.435, 1.72] },
    'vent:Vent by the sofa': { at: [1.268, 0, 2.463], land: [0.9, 0.511, 2.1] },
    'vent:Vent by the stove': { at: [4.221, 0.013, 2.78], land: [4.5, 0.94, 2.35] },
    // the two throw pillows at the desk end of the sofa make room for the Mushroom Pillow
    'Olive_pillow#1': { p: [0, 0, 0], q: [0, 0, 0, 1], hidden: true },
    'Mustard_pillow#1': { p: [0, 0, 0], q: [0, 0, 0, 1], hidden: true },
    // the oils and grinders leave the counter by the stove free for the Headphones
    'Oils_and_grinders#1': { p: [0, 0, 0], q: [0, 0, 0, 1], hidden: true },
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
};
