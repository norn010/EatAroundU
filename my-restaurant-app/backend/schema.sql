PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT,
  email TEXT UNIQUE,
  password TEXT,
  user_type TEXT CHECK(user_type IN ('guest','owner')) DEFAULT 'guest',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS restaurants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  type TEXT,
  latitude REAL,
  longitude REAL,
  address TEXT,
  price_range TEXT,
  open_time TEXT,
  close_time TEXT,
  rating REAL DEFAULT 0,
  description TEXT,
  image_url TEXT,
  is_new INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS menus (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price REAL,
  calories INTEGER,
  image_url TEXT,
  is_popular INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  restaurant_id INTEGER REFERENCES restaurants(id),
  rating INTEGER,
  taste_score INTEGER,
  service_score INTEGER,
  comment TEXT,
  image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tables (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  table_number INTEGER NOT NULL,
  status TEXT CHECK(status IN ('available','reserved')) DEFAULT 'available',
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS table_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  table_id INTEGER NOT NULL REFERENCES tables(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  reserved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  canceled_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_map_search_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  user_latitude REAL,
  user_longitude REAL,
  radius_km REAL,
  keyword TEXT,
  filter_type TEXT,
  filter_price TEXT,
  filter_time TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS achievements_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  badge TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES users(id),
  achievement_id INTEGER REFERENCES achievements_master(id),
  date_earned DATE DEFAULT (DATE('now'))
);
