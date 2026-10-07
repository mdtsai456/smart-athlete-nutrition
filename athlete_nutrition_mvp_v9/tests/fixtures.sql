SET time_zone='+00:00';
INSERT INTO Organization VALUES (1,'A','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)),(2,'B','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
INSERT INTO Account(account_id,organization_id,email,password_hash,role,status,created_at,updated_at) VALUES
 (1,1,'athlete@example.test','fixture','athlete','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)),
 (2,1,'nutritionist@example.test','fixture','nutritionist','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)),
 (3,2,'other@example.test','fixture','nutritionist','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)),
 (4,1,'coach@example.test','fixture','coach','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
INSERT INTO Athlete(athlete_id,account_id,name,weight_kg,created_at,updated_at) VALUES (1,1,'Fixture athlete',70,UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
INSERT INTO Nutritionist VALUES (1,2,'Fixture nutritionist',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)),(2,3,'Other nutritionist',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
INSERT INTO Coach VALUES (1,4,'Fixture coach',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
INSERT INTO Food(food_id,organization_id,food_name,status,created_at,updated_at) VALUES
 (1,NULL,'Shared food','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)),
 (2,2,'Other tenant food','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6)),
 (3,1,'Empty food','active',UTC_TIMESTAMP(6),UTC_TIMESTAMP(6));
INSERT INTO Nutrient VALUES (1,'energy','Energy','kcal','active'),(2,'protein','Protein','g','active'),(3,'sodium','Sodium','mg','active');
INSERT INTO FoodNutrient(food_id,nutrient_id,amount_per_100g,updated_at) VALUES
 (1,1,100,UTC_TIMESTAMP(6)),(1,2,10,UTC_TIMESTAMP(6)),(1,3,0,UTC_TIMESTAMP(6));
