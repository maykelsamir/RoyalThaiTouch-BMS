ALTER TABLE branches_v2
ADD COLUMN IF NOT EXISTS company_revenue_percentage NUMERIC(5,2) NOT NULL DEFAULT 100,
ADD COLUMN IF NOT EXISTS hotel_revenue_percentage NUMERIC(5,2) NOT NULL DEFAULT 0;

UPDATE branches_v2
SET company_revenue_percentage = COALESCE(company_revenue_percentage, 100),
    hotel_revenue_percentage = COALESCE(hotel_revenue_percentage, 0);

ALTER TABLE branches_v2
DROP CONSTRAINT IF EXISTS ck_branches_v2_revenue_share_percentages;

ALTER TABLE branches_v2
ADD CONSTRAINT ck_branches_v2_revenue_share_percentages
CHECK (
    company_revenue_percentage >= 0
    AND company_revenue_percentage <= 100
    AND hotel_revenue_percentage >= 0
    AND hotel_revenue_percentage <= 100
    AND company_revenue_percentage + hotel_revenue_percentage = 100
);
