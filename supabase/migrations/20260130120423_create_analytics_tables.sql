/*
  # Create Analytics Dashboard Tables

  ## Overview
  Creates tables to store analytical data for interactive dashboard with KPIs, charts, and filters.

  ## New Tables
  
  ### `metrics`
  Stores KPI metrics data
  - `id` (uuid, primary key)
  - `name` (text) - Metric name (e.g., "Total Revenue", "Active Users")
  - `value` (numeric) - Current metric value
  - `previous_value` (numeric) - Previous period value for comparison
  - `change_percentage` (numeric) - Percentage change
  - `category` (text) - Metric category
  - `created_at` (timestamptz) - Record creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ### `sales_data`
  Stores sales/transaction data for time series analysis
  - `id` (uuid, primary key)
  - `date` (date) - Transaction date
  - `category` (text) - Product/service category
  - `revenue` (numeric) - Revenue amount
  - `quantity` (integer) - Quantity sold
  - `region` (text) - Geographic region
  - `product` (text) - Product name
  - `created_at` (timestamptz) - Record creation timestamp

  ### `categories`
  Stores available categories for filtering
  - `id` (uuid, primary key)
  - `name` (text, unique) - Category name
  - `type` (text) - Category type (product, region, etc.)
  - `active` (boolean) - Whether category is active
  - `created_at` (timestamptz) - Record creation timestamp

  ## Security
  - Enable RLS on all tables
  - Add policies for authenticated users to read data
  - Add policies for authenticated users to insert/update data

  ## Sample Data
  Includes sample data for demonstration purposes
*/

-- Create metrics table
CREATE TABLE IF NOT EXISTS metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value numeric NOT NULL DEFAULT 0,
  previous_value numeric DEFAULT 0,
  change_percentage numeric DEFAULT 0,
  category text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sales_data table
CREATE TABLE IF NOT EXISTS sales_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  category text NOT NULL,
  revenue numeric NOT NULL DEFAULT 0,
  quantity integer NOT NULL DEFAULT 0,
  region text NOT NULL,
  product text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  type text NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_sales_data_date ON sales_data(date);
CREATE INDEX IF NOT EXISTS idx_sales_data_category ON sales_data(category);
CREATE INDEX IF NOT EXISTS idx_sales_data_region ON sales_data(region);

-- Enable Row Level Security
ALTER TABLE metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- Policies for metrics table
CREATE POLICY "Allow public read access to metrics"
  ON metrics FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert to metrics"
  ON metrics FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update to metrics"
  ON metrics FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for sales_data table
CREATE POLICY "Allow public read access to sales_data"
  ON sales_data FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert to sales_data"
  ON sales_data FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update to sales_data"
  ON sales_data FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Policies for categories table
CREATE POLICY "Allow public read access to categories"
  ON categories FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Allow authenticated insert to categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow authenticated update to categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert sample metrics
INSERT INTO metrics (name, value, previous_value, change_percentage, category) VALUES
  ('Receita Total', 125430, 98250, 27.6, 'financeiro'),
  ('Clientes Ativos', 2847, 2654, 7.3, 'usuarios'),
  ('Pedidos Hoje', 156, 142, 9.9, 'vendas'),
  ('Taxa de Conversão', 3.8, 3.2, 18.8, 'marketing')
ON CONFLICT DO NOTHING;

-- Insert sample categories
INSERT INTO categories (name, type) VALUES
  ('Eletrônicos', 'product'),
  ('Roupas', 'product'),
  ('Alimentos', 'product'),
  ('Livros', 'product'),
  ('Norte', 'region'),
  ('Sul', 'region'),
  ('Leste', 'region'),
  ('Oeste', 'region')
ON CONFLICT DO NOTHING;

-- Insert sample sales data (last 30 days)
INSERT INTO sales_data (date, category, revenue, quantity, region, product)
SELECT 
  CURRENT_DATE - (random() * 30)::integer,
  CASE (random() * 3)::integer
    WHEN 0 THEN 'Eletrônicos'
    WHEN 1 THEN 'Roupas'
    WHEN 2 THEN 'Alimentos'
    ELSE 'Livros'
  END,
  (random() * 5000 + 100)::numeric(10,2),
  (random() * 50 + 1)::integer,
  CASE (random() * 3)::integer
    WHEN 0 THEN 'Norte'
    WHEN 1 THEN 'Sul'
    WHEN 2 THEN 'Leste'
    ELSE 'Oeste'
  END,
  'Produto ' || (random() * 100)::integer
FROM generate_series(1, 200)
ON CONFLICT DO NOTHING;