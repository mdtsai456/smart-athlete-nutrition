"""Offline tests of the actual artifact generator; no database simulation."""
import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('artifacts',ROOT/'tools/build_erd.py')
artifacts=importlib.util.module_from_spec(spec)
spec.loader.exec_module(artifacts)

class ArtifactTests(unittest.TestCase):
    def test_parses_nullable_role_and_required_profile_foreign_keys(self):
        sql='''CREATE TABLE `Account` (
  `account_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `organization_id` bigint
) ENGINE=InnoDB;
CREATE TABLE `Athlete` (
  `athlete_id` bigint PRIMARY KEY AUTO_INCREMENT,
  `account_id` bigint NOT NULL UNIQUE,
  `revision` int unsigned NOT NULL DEFAULT 0,
  `weight_kg` decimal(6,2)
) ENGINE=InnoDB;
ALTER TABLE `Athlete` ADD CONSTRAINT `fk_profile` FOREIGN KEY (`account_id`) REFERENCES `Account` (`account_id`);'''
        tables,refs=artifacts.parse(sql)
        self.assertEqual(tables['Athlete']['columns']['weight_kg']['type'],'decimal(6,2)')
        self.assertFalse(tables['Athlete']['columns']['weight_kg']['required'])
        self.assertEqual(refs,[('Athlete','account_id','Account','account_id','')])
        dbml=artifacts.dbml(tables,refs)
        self.assertIn('account_id bigint [not null, unique]',dbml)
        self.assertIn('Ref: Athlete.account_id > Account.account_id',dbml)
        self.assertTrue(tables['Athlete']['columns']['revision']['unsigned'])
        self.assertIn("revision int [not null, default: 0, note: 'SQL UNSIGNED']",dbml)

    def test_rejects_dangling_relationship_instead_of_silently_drawing_it(self):
        sql='''CREATE TABLE `Account` (
  `account_id` bigint PRIMARY KEY AUTO_INCREMENT
) ENGINE=InnoDB;
ALTER TABLE `Account` ADD CONSTRAINT `bad` FOREIGN KEY (`missing`) REFERENCES `Account` (`account_id`);'''
        with self.assertRaises(ValueError): artifacts.parse(sql)

    def test_full_schema_has_roles_and_policy_history_connections(self):
        tables,refs=artifacts.parse((ROOT/'athlete_nutrition_schema.sql').read_text(encoding='utf-8'))
        self.assertEqual(len(tables),18)
        for role in ('Athlete','Coach','Nutritionist'):
            self.assertIn((role,'account_id','Account','account_id',''),refs)
        self.assertIn(('AthleteCoach','coach_id','Coach','coach_id',''),refs)
        self.assertIn(('AthleteNutritionTarget','nutritionist_id','Nutritionist','nutritionist_id',''),refs)
        self.assertIn(('MealRevision','actor_account_id','Account','account_id','RESTRICT'),refs)
        for field in ('height_cm','body_fat_percent','sport','weekly_training_count','primary_goal','jersey_number','position','dietary_restrictions_text','allergies_text','notes'):
            self.assertIn(field,tables['Athlete']['columns'])

if __name__=='__main__': unittest.main()
