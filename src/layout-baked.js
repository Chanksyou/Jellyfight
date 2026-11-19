// The built-in furniture layout: edits made with the dev layout editor (layout.js), exported and
// baked in so everyone gets them. The map is per act ({ 1: ..., 2: ... }); inside an act, keys are
// "object name#n"; p = position, q = rotation (quaternion), both in the Apartment node's space;
// hidden = not shown and not solid.
// Added things (layout.js): "copy:<object key>#n" { from: '<object key>', p, q } is a copy of a room
// object (its geometry and materials, no lights); "prop:<id>#n" { prop: '<id>', p, q, s } is a
// library prop (props.js), s its size (0.5-2). Both are made at load, solid like the rest.
// Loose plants (leaves, stalks, hanging air plants) that are part of the apartment's walls-and-floor
// piece ("Shell"), so the editor can't select them: hidden at load and not solid. Same room in
// acts 1 and 4. Names are the Shell's meshes (Shell_125 ...).
const LIVING_ROOM_PLANTS = [125, 126, 129, 130, 131, 132, 136, 137, 139, 140, 141, 142, 143, 144, 145, 146, 151, 152, 153, 154, 155, 156, 157, 158, 159, 160, 161, 162, 163, 164, 165].map((n) => `Shell_${n}`);
export const HIDDEN_SHELL = { 1: LIVING_ROOM_PLANTS, 4: LIVING_ROOM_PLANTS };

export const BAKED_LAYOUT = {
  1: {
    'Pet_corner#1': { p: [-0.0875, 0, 0.4079], q: [0, 0, 0, 1] },
    'Mug#1': { p: [-0.0027, 0, -0.043], q: [0, 0, 0, 1], hidden: true },
    'Cat_scratcher_and_box#1': { p: [0.0439, 0, -0.1053], q: [0, 0, 0, 1] },
    'Controllers#1': { p: [2.5641, 0, 9.049], q: [0, -1, 0, 0] },
    'Glass_dish#1': { p: [5.8131, 0, -1.9077], q: [0, -0.5, 0, 0.86603], deleted: true },
    'Spice_carousel#1': { p: [0.1283, 0, 0.0051], q: [0, 0, 0, 1] },
    'Kitchen#1': { p: [-0.0251, 0, -0.0147], q: [0, 0, 0, 1] },
    'Water_filter_pitcher#1': { p: [6.5084, 0, -2.8629], q: [0, -0.70711, 0, 0.70711] },
    'Dish_cloth#1': { p: [-0.0211, 0, 0.1532], q: [0, 0, 0, 1] },
    'Standing_desk#1': { p: [-0.0431, 0, 0.0693], q: [0, 0, 0, 1] },
    'Spotlight_floor_lamp#1': { p: [-0.0554, 0, 0.1182], q: [0, 0, 0, 1] },
    'Snake_plant#1': { p: [2.396, 0, -0.1834], q: [0, 0, 0, 1], deleted: true },
    'Rubber_plant#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Corduroy_sofa#1': { p: [0.0145, 0, -0.5181], q: [0, 0, 0, 1] },
    'Cat_window_perches#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Monstera#1': { p: [-0.1163, 0, -0.1153], q: [0, 0, 0, 1], deleted: true },
    'Tall_snake_plant#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Plushie_shelf#1': { p: [1.3068, 0, -0.8023], q: [0, -0.13053, 0, 0.99144] },
    'Baby_bouncer#1': { p: [0, 0, 0.15], q: [0, 0, 0, 1] },
    'Crowned_cow_plush#1': { p: [1.1622, 0, -0.114], q: [0, 0, 0, 1] },
    'Dinosaur_plush#1': { p: [1.1383, 0, -0.1737], q: [0, 0, 0, 1] },
    'Painted_figurine#1': { p: [1.2672, 0, -0.1788], q: [0, 0, 0, 1] },
    'Horned_skull#1': { p: [1.1197, 0, -0.161], q: [0, 0, 0, 1] },
    'Dragon_head_plush#1': { p: [1.0228, 0, -0.1774], q: [0, 0, 0, 1] },
    'Brown_plush#1': { p: [1.167, 0, -0.1011], q: [0, 0, 0, 1] },
    'Face_bowl#1': { p: [1.1957, 0, -0.0118], q: [0, 0, 0, 1] },
    'Ceramic_bird#1': { p: [0.866, 0, -0.0329], q: [0, 0, 0, 1] },
    'Plush_and_crochet_friends#1': { p: [1.1063, 0, -0.1015], q: [0, 0, 0, 1] },
    'Black_cat_plush#1': { p: [1.1265, 0, -0.0748], q: [0, 0, 0, 1] },
    'Crystal_pitcher#1': { p: [1.1803, 0, -0.0281], q: [0, 0, 0, 1] },
    'Orb_lamp#1': { p: [0.9303, 0, -0.0612], q: [0, 0, 0, 1] },
    'Round_plant_stand#1': { p: [1.9422, 0, 2.6796], q: [0, 0, 0, 1], hidden: true },
    'Globe_clamp_lamp#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Glass_shade_floor_lamp#1': { p: [0.6131, 0, -0.2959], q: [0, 0, 0, 1] },
    'Glass_side_table#1': { p: [0.0442, 0, 0.5162], q: [0, 0, 0, 1] },
    'Ladder_bookshelf#1': { p: [-1.1418, 0, 1.9164], q: [0, 0.60876, 0, 0.79335] },
    'Glass-dome_speaker#1': { p: [-0.7197, 0, 0.3489], q: [0, 0, 0, 1] },
    'Board_books#1': { p: [-0.8726, 0, 0.1273], q: [0, 0, 0, 1] },
    'Board_games#1': { p: [-0.7732, 0, 0.1532], q: [0, 0, 0, 1] },
    'Kiwi_bird#1': { p: [-0.8149, 0, 0.2151], q: [0, 0, 0, 1] },
    'Mini_radio#1': { p: [-0.6782, 0, 0.1449], q: [0, 0, 0, 1] },
    'Baby_camera#1': { p: [-0.8869, 0, 0.1527], q: [0, 0, 0, 1] },
    'Aloe#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Smart_speaker#1': { p: [-1.1092, 0, 0.8204], q: [0, 0, 0, 1], deleted: true },
    'Drip-glaze_vase#1': { p: [1.0397, 0, -0.1042], q: [0, 0, 0, 1] },
    'Mustard_pillow#1': { p: [-0.7943, 0, 0.4639], q: [0, 0.25882, 0, 0.96593] },
    'Olive_pillow#1': { p: [-0.0287, 0, -0.3923], q: [0, 0, 0, 1], deleted: true },
    'Mushroom_pillow#1': { p: [0.0362, 0, -0.6058], q: [0, 0, 0, 1] },
    'Blue_pillow#1': { p: [-0.4473, 0.03, 0.3032], q: [0, 0.13052, 0, 0.99144] },
    'Fluffy_white_pillow#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'Glass_coffee_table#1': { p: [-0.1535, 0, -0.4531], q: [0, 0, 0, 1] },
    'Wooden_bowl#1': { p: [-0.1768, 0, -0.4127], q: [0, 0, 0, 1], deleted: true },
    'Red_hardcover#1': { p: [0.2575, 0, -0.5363], q: [0, 0, 0, 1], deleted: true },
    'Book_stack#1': { p: [-0.167, 0, -0.4388], q: [0, 0, 0, 1] },
    'Baby_play_gym#1': { p: [0.0338, 0, -0.3684], q: [0, 0, 0, 1] },
    'Lounge_chair#1': { p: [-0.0284, 0, -0.4971], q: [0, 0, 0, 1] },
    'Headphones#1': { p: [0.0401, 0, 0.0751], q: [0, 0, 0, 1] },
    'Singing_bowl#1': { p: [0.1346, 0, 0.0235], q: [0, 0, 0, 1] },
    'Celadon_vase#1': { p: [0.0476, 0, -0.0564], q: [0, 0, 0, 1] },
    'Pilea#1': { p: [0.5896, 0, -0.0521], q: [0, 0, 0, 1] },
    'prop:stripedSnake#1': { prop: 'stripedSnake', s: 0.6, p: [1.9075, 0.46, 7.6848], q: [0, -0.30647, 0, 0.95188] },
    'prop:monstera#1': { prop: 'monstera', s: 0.5, p: [3.4979, 0, 0.3587], q: [0, 0.98327, 0, 0.18215] },
    'prop:rubberPlant#1': { prop: 'rubberPlant', s: 0.6, p: [0.2833, 0.529, 1.9578], q: [0, 0.93507, 0, -0.35446] },
    'prop:aloe#1': { prop: 'aloe', s: 0.5, p: [0.061, 1.7451, 1.5752], q: [0, -0.60202, 0, -0.79848] },
    'prop:aloe#2': { prop: 'aloe', s: 0.6, p: [4.1614, 0.55, 0.4993], q: [0, -0.96236, 0, 0.27178] },
    'prop:pothos#1': { prop: 'pothos', s: 0.5, p: [0.6624, 0.83, 5.2006], q: [0, 0.77614, 0, 0.63057] },
    'prop:marbleSnake#1': { prop: 'marbleSnake', s: 0.5, p: [0.1335, 0.75, 2.7664], q: [0, 0.65315, 0, 0.75723] },
    'prop:stripedSnake#2': { prop: 'stripedSnake', s: 0.8, p: [1.0125, 0.6, 4.6722], q: [0, 0.97802, 0, -0.2085] },
    'prop:marbleSnake#2': { prop: 'marbleSnake', s: 0.8, p: [0.4278, 0, 2.3858], q: [0, -0.35494, 0, -0.93489] },
    'Ceramic_bowl#1': { p: [-0.1437, 0, -0.3535], q: [0, 0, 0, 1] },
    'Glass_cup#1': { p: [-0.3999, 0.02, -0.0153], q: [0, 0, 0, 1] },
    'Cutting_board#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
    'prop:spiderPlant#1': { prop: 'spiderPlant', s: 0.8, p: [4.172, 0.1449, 0.4844], q: [0, -0.92081, 0, -0.39001] },
  },
  2: {
    'Toilet_spray#1': { p: [0, 0, 0], q: [0, 0, 0, 1], deleted: true },
  },
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
    // Act 4 is act 1's living room: it gets act 1's whole layout (below), and only these entries
    // differ (tests/check.mjs refuses any other). The three Elites sit on their furniture
    // (stage4.js ELITES4, with what they clear), and the vents by them land you across from them, not on them
    // (the other three are stage1.js's).
    'Singing_bowl#1': { p: [1.1266, -0.165, -3.5821], q: [0, 0, 0, 1] },
    'Mushroom_pillow#1': { p: [0.0145, 0, -0.0681], q: [0, 0, 0, 1] },
    'Headphones#1': { p: [1.195, -0.3, -0.785], q: [0, 0, 0, 1] },
    // act 1 has these where the Singing Bowl and Mushroom Pillow stand (ELITES4 clears)
    'Glass_shade_floor_lamp#1': { p: [0, 0, 0], q: [0, 0, 0, 1], hidden: true },
    'Mustard_pillow#1': { p: [0, 0, 0], q: [0, 0, 0, 1], hidden: true },
    'vent:Vent by the lounge chair': { at: [3.517, 0, 1.483], land: [3.36, 0.435, 1.27] },
    'vent:Vent by the sofa': { at: [1.0, 0, 2.25], land: [1.35, 0.511, 1.75] },
    'vent:Vent by the stove': { at: [4.221, 0.013, 2.78], land: [4.5, 0.94, 2.35] },
  },
};

// Act 4 is the same room as act 1, so it takes act 1's layout with its own few entries on top:
// a change baked into act 1 is in act 4 too.
export const ACT4_OWN = Object.keys(BAKED_LAYOUT[4]);
BAKED_LAYOUT[4] = { ...BAKED_LAYOUT[1], ...BAKED_LAYOUT[4] };
