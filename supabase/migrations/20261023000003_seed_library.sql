-- =============================================================================
-- Ritual — shared exercise library and starter templates (read-only for users).
-- All instructions are original text written for Ritual. No images are bundled;
-- users may attach their own demonstration links to custom exercises.
-- Re-running is safe: rows are only inserted when the library is empty.
-- =============================================================================

do $seed$
begin
  if exists (select 1 from public.exercises where user_id is null) then
    raise notice 'Exercise library already seeded — skipping.';
    return;
  end if;

  insert into public.exercises
    (user_id, name, muscle_group, equipment, category, difficulty, is_timed,
     default_sets, default_reps, default_duration_sec, default_rest_sec, instructions)
  values
  -- Chest
  (null,'Push-up','chest','none','bodyweight','beginner',false,3,10,null,60,
   'Hands slightly wider than shoulders, body in one straight line from head to heels. Lower your chest towards the floor with elbows at roughly 45°, then press back up. Drop to your knees to make it easier.'),
  (null,'Incline push-up','chest','bench','bodyweight','beginner',false,3,12,null,60,
   'Place hands on a bench or sturdy surface. Keep your body straight, lower your chest to the edge, and press away. The higher the surface, the easier the movement.'),
  (null,'Dumbbell bench press','chest','dumbbells','strength','beginner',false,3,10,null,90,
   'Lie on a bench with a dumbbell in each hand above your chest. Lower them slowly to the sides of your chest, keeping wrists stacked over elbows, then press back up without locking out hard.'),
  (null,'Barbell bench press','chest','barbell','strength','intermediate',false,4,6,null,120,
   'Lie with eyes under the bar, feet planted, shoulder blades pulled back. Lower the bar under control to mid-chest and press up. Use a spotter or safety arms for heavier sets.'),
  (null,'Dumbbell chest fly','chest','dumbbells','strength','intermediate',false,3,12,null,60,
   'Lie on a bench, dumbbells above chest with a slight bend in the elbows. Open your arms in a wide arc until you feel a gentle stretch, then bring them back together. Use light weights.'),
  (null,'Cable crossover','chest','cable','strength','intermediate',false,3,12,null,60,
   'Stand between two high pulleys. With a soft bend in the elbows, bring the handles down and together in front of your hips, squeeze, then return slowly.'),
  -- Back
  (null,'Bent-over dumbbell row','back','dumbbells','strength','beginner',false,3,10,null,75,
   'Hinge at the hips with a flat back, dumbbells hanging below shoulders. Pull the weights towards your lower ribs, squeezing shoulder blades together, then lower with control.'),
  (null,'One-arm dumbbell row','back','dumbbells','strength','beginner',false,3,10,null,60,
   'Support one hand and knee on a bench. Pull the dumbbell up towards your hip, keeping your torso still, then lower fully. Complete all reps before switching sides.'),
  (null,'Lat pulldown','back','machine','strength','beginner',false,3,10,null,75,
   'Sit with thighs under the pad and grip the bar slightly wider than shoulders. Pull the bar to your upper chest, leading with your elbows, then let it rise slowly.'),
  (null,'Seated cable row','back','cable','strength','beginner',false,3,10,null,75,
   'Sit tall with a slight knee bend. Pull the handle to your stomach while squeezing shoulder blades together; avoid leaning far back. Return with straight arms.'),
  (null,'Pull-up','back','pullup_bar','bodyweight','advanced',false,3,5,null,120,
   'Hang from a bar with an overhand grip. Pull until your chin clears the bar, then lower all the way down with control. Use a band or negatives to build up.'),
  (null,'Resistance band pull-apart','back','bands','strength','beginner',false,3,15,null,45,
   'Hold a band at shoulder height with straight arms. Pull it apart by moving your hands out to the sides until the band touches your chest, then return slowly.'),
  (null,'Superman hold','back','none','bodyweight','beginner',true,3,null,20,45,
   'Lie face down with arms overhead. Lift arms, chest and legs a few centimetres off the floor and hold while breathing steadily. Keep your neck long.'),
  (null,'Barbell deadlift','back','barbell','strength','advanced',false,3,5,null,150,
   'Bar over mid-foot, hinge to grip it just outside your legs. Brace your core, keep your back flat and push the floor away until you stand tall. Lower by hinging back first. Learn with light weight or coaching.'),
  -- Shoulders
  (null,'Dumbbell shoulder press','shoulders','dumbbells','strength','beginner',false,3,10,null,75,
   'Seated or standing, hold dumbbells at shoulder height. Press overhead until arms are nearly straight, then lower back to shoulders. Keep ribs down and avoid arching.'),
  (null,'Lateral raise','shoulders','dumbbells','strength','beginner',false,3,12,null,60,
   'Stand with dumbbells at your sides. Raise them out to shoulder height with a slight elbow bend, pause, then lower slowly. Light weights work best.'),
  (null,'Pike push-up','shoulders','none','bodyweight','intermediate',false,3,8,null,75,
   'Start in a downward-dog shape with hips high. Bend your elbows to bring the top of your head towards the floor between your hands, then press back up.'),
  (null,'Face pull','shoulders','cable','strength','beginner',false,3,15,null,60,
   'Set a rope at upper-chest height. Pull it towards your face, separating the ends and pointing elbows out and back. Pause, then return.'),
  (null,'Overhead barbell press','shoulders','barbell','strength','intermediate',false,4,6,null,120,
   'Stand with the bar on your front shoulders. Brace, press the bar straight up past your face, and finish with it over the middle of your feet. Lower back to the shoulders.'),
  -- Arms
  (null,'Dumbbell biceps curl','biceps','dumbbells','strength','beginner',false,3,12,null,60,
   'Stand tall with elbows by your sides. Curl the dumbbells up without swinging, squeeze at the top, then lower all the way down.'),
  (null,'Hammer curl','biceps','dumbbells','strength','beginner',false,3,12,null,60,
   'Hold dumbbells with palms facing each other. Curl up keeping the neutral grip and elbows still, then lower slowly.'),
  (null,'Resistance band curl','biceps','bands','strength','beginner',false,3,15,null,45,
   'Stand on the middle of a band, handles in hand. Curl up keeping elbows tucked, then lower under control.'),
  (null,'Triceps bench dip','triceps','bench','bodyweight','beginner',false,3,10,null,60,
   'Hands on the edge of a bench behind you, legs out in front. Bend your elbows to lower your hips, keeping shoulders away from your ears, then press back up.'),
  (null,'Overhead dumbbell triceps extension','triceps','dumbbells','strength','beginner',false,3,12,null,60,
   'Hold one dumbbell overhead with both hands. Lower it behind your head by bending at the elbows, keeping upper arms still, then extend back up.'),
  (null,'Cable triceps pushdown','triceps','cable','strength','beginner',false,3,12,null,60,
   'Hold a bar or rope at a high pulley with elbows tucked. Push down until arms are straight, then let the handle rise to about chest height.'),
  (null,'Diamond push-up','triceps','none','bodyweight','intermediate',false,3,8,null,75,
   'Push-up position with hands close together under your chest. Lower down keeping elbows close to your sides, then press up.'),
  -- Legs
  (null,'Bodyweight squat','legs','none','bodyweight','beginner',false,3,15,null,60,
   'Feet about shoulder-width apart. Sit your hips back and down as if onto a chair, keeping your chest up and knees tracking over toes, then stand.'),
  (null,'Goblet squat','legs','dumbbells','strength','beginner',false,3,10,null,75,
   'Hold one dumbbell or kettlebell against your chest. Squat down between your knees with an upright torso, then drive back up through your whole foot.'),
  (null,'Barbell back squat','legs','barbell','strength','intermediate',false,4,6,null,150,
   'Bar resting on upper back, feet shoulder-width. Brace, sit down and back to a comfortable depth, then stand up. Use safety pins when training alone.'),
  (null,'Reverse lunge','legs','none','bodyweight','beginner',false,3,10,null,60,
   'Step one foot back and lower until both knees are bent around 90°. Push through the front foot to return. Alternate legs; reps are per side.'),
  (null,'Walking lunge','legs','dumbbells','strength','intermediate',false,3,12,null,75,
   'Holding dumbbells at your sides, step forward into a lunge, then bring the back foot through into the next step. Keep your torso upright.'),
  (null,'Bulgarian split squat','legs','bench','strength','intermediate',false,3,8,null,75,
   'Rear foot resting on a bench behind you. Lower straight down on the front leg, then push back up. Reps are per side.'),
  (null,'Leg press','legs','machine','strength','beginner',false,3,10,null,90,
   'Feet hip-width on the platform. Lower the sled until knees are comfortably bent without your lower back lifting, then press away without locking the knees.'),
  (null,'Romanian deadlift','legs','dumbbells','strength','intermediate',false,3,10,null,90,
   'Hold weights in front of your thighs. With soft knees, hinge at the hips and slide the weights down your legs until you feel a hamstring stretch, then stand tall.'),
  (null,'Standing calf raise','legs','none','bodyweight','beginner',false,3,15,null,45,
   'Stand on the edge of a step. Rise onto the balls of your feet, pause, then lower your heels below the step for a stretch.'),
  (null,'Wall sit','legs','none','bodyweight','beginner',true,3,null,30,60,
   'Back against a wall, slide down until knees are around 90°. Hold the position while breathing steadily.'),
  -- Glutes
  (null,'Glute bridge','glutes','none','bodyweight','beginner',false,3,15,null,45,
   'Lie on your back with knees bent and feet flat. Press through your heels to lift your hips until your body forms a line from shoulders to knees, squeeze, then lower.'),
  (null,'Hip thrust','glutes','barbell','strength','intermediate',false,3,10,null,90,
   'Upper back on a bench, bar padded across your hips. Drive your hips up until thighs are level with your torso, pause, then lower under control.'),
  (null,'Kettlebell swing','glutes','kettlebell','strength','intermediate',false,3,15,null,75,
   'Hinge to hike the kettlebell back between your legs, then snap your hips forward to float it to chest height. The power comes from the hips, not the arms.'),
  (null,'Banded lateral walk','glutes','bands','strength','beginner',false,3,12,null,45,
   'Loop a band above your knees, sit into a quarter squat and take controlled steps sideways, keeping tension on the band. Reps are steps per direction.'),
  (null,'Donkey kick','glutes','none','bodyweight','beginner',false,3,12,null,45,
   'On hands and knees, keep one knee bent and lift that foot towards the ceiling until your thigh is level with your back. Lower and repeat; reps are per side.'),
  -- Core
  (null,'Forearm plank','core','none','bodyweight','beginner',true,3,null,30,45,
   'Forearms on the floor under shoulders, body in a straight line. Brace your stomach and squeeze your glutes. Hold without letting your hips sag.'),
  (null,'Side plank','core','none','bodyweight','intermediate',true,3,null,20,45,
   'Lie on your side, forearm under shoulder. Lift your hips so your body forms a straight line and hold. Switch sides between sets.'),
  (null,'Dead bug','core','none','bodyweight','beginner',false,3,10,null,45,
   'Lie on your back with arms up and knees over hips. Press your lower back into the floor, then slowly extend the opposite arm and leg. Return and alternate.'),
  (null,'Bird dog','core','none','bodyweight','beginner',false,3,10,null,45,
   'On hands and knees, extend one arm forward and the opposite leg back, keeping hips level. Pause, return, and alternate sides.'),
  (null,'Bicycle crunch','core','none','bodyweight','beginner',false,3,16,null,45,
   'Lie on your back, hands lightly by your head. Bring one knee in while rotating the opposite shoulder towards it, then switch in a slow pedalling motion.'),
  (null,'Hanging knee raise','core','pullup_bar','bodyweight','intermediate',false,3,10,null,60,
   'Hang from a bar and draw your knees up towards your chest without swinging, then lower slowly.'),
  (null,'Mountain climber','core','none','cardio','beginner',true,3,null,30,45,
   'From a high plank, drive one knee towards your chest then switch legs quickly, keeping hips low and shoulders over hands.'),
  -- Cardio
  (null,'Brisk walk','cardio','none','cardio','beginner',true,1,null,1800,0,
   'Walk at a pace where you can talk but not sing. Swing your arms naturally and keep a tall posture.'),
  (null,'Easy run','cardio','none','cardio','intermediate',true,1,null,1200,0,
   'Run at a conversational pace. Start slower than you think you need to and keep your stride short and relaxed.'),
  (null,'Jumping jacks','cardio','none','cardio','beginner',true,3,null,45,30,
   'Jump your feet out wide while raising your arms overhead, then jump back together. Step side to side instead for a low-impact version.'),
  (null,'High knees','cardio','none','cardio','beginner',true,3,null,30,30,
   'Run on the spot driving your knees up towards hip height, pumping your arms. March for a lower-impact option.'),
  (null,'Burpee','full_body','none','plyometric','intermediate',false,3,8,null,60,
   'From standing, squat and place hands on the floor, step or jump feet back to a plank, return feet to hands, and stand or jump up.'),
  (null,'Stationary bike','cardio','cardio_machine','cardio','beginner',true,1,null,1200,0,
   'Set the saddle so your knee is slightly bent at the bottom of the pedal stroke. Ride at a steady, comfortable effort.'),
  (null,'Rowing machine','cardio','cardio_machine','cardio','intermediate',true,1,null,900,0,
   'Push with your legs first, then lean back slightly and pull the handle to your lower ribs. Return in reverse order: arms, body, legs.'),
  (null,'Skipping rope','cardio','other','cardio','intermediate',true,3,null,60,45,
   'Small, quick hops on the balls of your feet, turning the rope with your wrists rather than your arms.'),
  -- Mobility
  (null,'Cat-cow','mobility','none','mobility','beginner',false,2,10,null,15,
   'On hands and knees, slowly round your spine towards the ceiling, then let your stomach drop and lift your chest. Move with your breath.'),
  (null,'World''s greatest stretch','mobility','none','mobility','beginner',false,2,5,null,15,
   'Step into a long lunge, place the same-side hand inside your front foot, then rotate and reach the other arm to the ceiling. Reps are per side.'),
  (null,'Hip flexor stretch','mobility','none','mobility','beginner',true,2,null,30,15,
   'Kneel in a half-lunge. Tuck your pelvis slightly and shift forward until you feel a stretch at the front of the back hip. Hold, then switch sides.'),
  (null,'Hamstring stretch','mobility','none','mobility','beginner',true,2,null,30,15,
   'Sit or stand with one leg straight. Hinge forward from the hips with a long back until you feel a gentle stretch behind the thigh. Hold, then switch.'),
  (null,'Child''s pose','mobility','none','mobility','beginner',true,1,null,45,0,
   'Kneel, sit back on your heels and fold forward with arms extended. Breathe slowly into your back.'),
  (null,'Thoracic open book','mobility','none','mobility','beginner',false,2,8,null,15,
   'Lie on your side with knees bent and arms out in front. Open the top arm in an arc to the other side, following it with your eyes, then return. Reps are per side.'),
  (null,'Shoulder circles','mobility','none','mobility','beginner',true,1,null,30,0,
   'Stand tall and draw slow, large circles with your shoulders, forwards then backwards.'),
  (null,'Deep squat hold','mobility','none','mobility','beginner',true,2,null,30,15,
   'Sit into a deep squat with heels down if you can, elbows gently pressing knees out. Hold onto something for balance if needed.');

  -- -------------------------------------------------------------------------
  -- Starter templates (users duplicate these to make editable copies)
  -- -------------------------------------------------------------------------
  insert into public.workout_templates (user_id, name, description, focus, estimated_minutes) values
  (null,'Full-body beginner','A gentle introduction to strength training that covers every major muscle group. Two or three times a week with a rest day between works well.','full_body',40),
  (null,'Upper body','Push and pull movements for chest, back, shoulders and arms.','upper',45),
  (null,'Lower body','Squat, hinge and lunge patterns for legs and glutes, plus calves.','lower',45),
  (null,'Push day','Chest, shoulders and triceps — part of a push/pull/legs split.','push',50),
  (null,'Pull day','Back and biceps — part of a push/pull/legs split.','pull',50),
  (null,'Legs day','Quads, hamstrings, glutes and calves — part of a push/pull/legs split.','legs',55),
  (null,'Home, no equipment','A bodyweight circuit you can do in a small space.','home',30),
  (null,'Strength foundations','Fewer reps with heavier compound lifts and longer rests. Best once you are comfortable with the movements.','strength',60),
  (null,'Mobility & stretching','A calm session to loosen hips, hamstrings, back and shoulders.','mobility',20),
  (null,'Cardio & endurance','Steady cardio plus short intervals to build stamina.','cardio',35);

  insert into public.workout_template_exercises
    (template_id, user_id, exercise_id, position, sets, target_reps, target_duration_sec, rest_sec)
  select t.id, null, e.id, x.pos, x.sets, x.reps, x.dur, x.rest
  from (values
    ('Full-body beginner','Goblet squat',1,3,10,null,75),
    ('Full-body beginner','Incline push-up',2,3,10,null,60),
    ('Full-body beginner','One-arm dumbbell row',3,3,10,null,60),
    ('Full-body beginner','Glute bridge',4,3,12,null,45),
    ('Full-body beginner','Dumbbell shoulder press',5,2,10,null,60),
    ('Full-body beginner','Forearm plank',6,3,null,20,45),

    ('Upper body','Dumbbell bench press',1,3,10,null,90),
    ('Upper body','Bent-over dumbbell row',2,3,10,null,75),
    ('Upper body','Dumbbell shoulder press',3,3,10,null,75),
    ('Upper body','Lat pulldown',4,3,10,null,75),
    ('Upper body','Dumbbell biceps curl',5,2,12,null,60),
    ('Upper body','Overhead dumbbell triceps extension',6,2,12,null,60),

    ('Lower body','Goblet squat',1,3,10,null,90),
    ('Lower body','Romanian deadlift',2,3,10,null,90),
    ('Lower body','Reverse lunge',3,3,10,null,60),
    ('Lower body','Glute bridge',4,3,15,null,45),
    ('Lower body','Standing calf raise',5,3,15,null,45),

    ('Push day','Dumbbell bench press',1,4,8,null,90),
    ('Push day','Dumbbell shoulder press',2,3,10,null,75),
    ('Push day','Dumbbell chest fly',3,3,12,null,60),
    ('Push day','Lateral raise',4,3,12,null,60),
    ('Push day','Cable triceps pushdown',5,3,12,null,60),

    ('Pull day','Lat pulldown',1,4,8,null,90),
    ('Pull day','Seated cable row',2,3,10,null,75),
    ('Pull day','One-arm dumbbell row',3,3,10,null,60),
    ('Pull day','Face pull',4,3,15,null,60),
    ('Pull day','Hammer curl',5,3,12,null,60),

    ('Legs day','Barbell back squat',1,4,6,null,150),
    ('Legs day','Romanian deadlift',2,3,8,null,120),
    ('Legs day','Leg press',3,3,10,null,90),
    ('Legs day','Walking lunge',4,3,12,null,75),
    ('Legs day','Standing calf raise',5,3,15,null,45),

    ('Home, no equipment','Bodyweight squat',1,3,15,null,45),
    ('Home, no equipment','Push-up',2,3,10,null,45),
    ('Home, no equipment','Reverse lunge',3,3,10,null,45),
    ('Home, no equipment','Superman hold',4,3,null,20,45),
    ('Home, no equipment','Glute bridge',5,3,15,null,45),
    ('Home, no equipment','Mountain climber',6,3,null,30,45),
    ('Home, no equipment','Forearm plank',7,3,null,30,45),

    ('Strength foundations','Barbell back squat',1,5,5,null,180),
    ('Strength foundations','Barbell bench press',2,5,5,null,180),
    ('Strength foundations','Barbell deadlift',3,3,5,null,180),
    ('Strength foundations','Overhead barbell press',4,3,5,null,150),
    ('Strength foundations','Pull-up',5,3,5,null,120),

    ('Mobility & stretching','Cat-cow',1,2,10,null,15),
    ('Mobility & stretching','World''s greatest stretch',2,2,5,null,15),
    ('Mobility & stretching','Thoracic open book',3,2,8,null,15),
    ('Mobility & stretching','Hip flexor stretch',4,2,null,30,15),
    ('Mobility & stretching','Hamstring stretch',5,2,null,30,15),
    ('Mobility & stretching','Deep squat hold',6,2,null,30,15),
    ('Mobility & stretching','Child''s pose',7,1,null,60,0),

    ('Cardio & endurance','Jumping jacks',1,2,null,60,30),
    ('Cardio & endurance','Easy run',2,1,null,1200,60),
    ('Cardio & endurance','High knees',3,4,null,30,30),
    ('Cardio & endurance','Mountain climber',4,4,null,30,30),
    ('Cardio & endurance','Hamstring stretch',5,1,null,30,0)
  ) as x(tname, ename, pos, sets, reps, dur, rest)
  join public.workout_templates t on t.name = x.tname and t.user_id is null
  join public.exercises e on e.name = x.ename and e.user_id is null;
end
$seed$;
