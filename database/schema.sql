-- Royal Thai Touch Business Management System

CREATE TABLE branches (
 id SERIAL PRIMARY KEY,
 name VARCHAR(100) NOT NULL,
 active BOOLEAN DEFAULT TRUE
);

CREATE TABLE users (
 id SERIAL PRIMARY KEY,
 username VARCHAR(100) UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role VARCHAR(20) NOT NULL,
 branch_id INTEGER REFERENCES branches(id)
);

CREATE TABLE daily_records (
 id SERIAL PRIMARY KEY,
 branch_id INTEGER REFERENCES branches(id),
 business_date DATE NOT NULL,
 revenue NUMERIC(15,2) NOT NULL DEFAULT 0,
 expenses NUMERIC(15,2) NOT NULL DEFAULT 0,
 net_profit NUMERIC(15,2) GENERATED ALWAYS AS (revenue-expenses) STORED,
 notes TEXT
);
