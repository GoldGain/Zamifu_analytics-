-- CBC junior grading: max 8 points
UPDATE grading_system SET points = 8, description = 'Exceeding Expectations (1)' WHERE grade_code = 'EE1';
UPDATE grading_system SET points = 7, description = 'Exceeding Expectations (2)' WHERE grade_code = 'EE2';
UPDATE grading_system SET points = 6, description = 'Meeting Expectations (1)' WHERE grade_code = 'ME1';
UPDATE grading_system SET points = 5, description = 'Meeting Expectations (2)' WHERE grade_code = 'ME2';
UPDATE grading_system SET points = 4, description = 'Approaching Expectations (1)' WHERE grade_code = 'AE1';
UPDATE grading_system SET points = 3, description = 'Approaching Expectations (2)' WHERE grade_code = 'AE2';
UPDATE grading_system SET points = 2, description = 'Below Expectations (1)' WHERE grade_code = 'BE1';
UPDATE grading_system SET points = 1, description = 'Below Expectations (2)' WHERE grade_code = 'BE2';
