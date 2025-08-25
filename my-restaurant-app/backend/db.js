import fs from 'fs';
import sqlite3 from 'sqlite3';
sqlite3.verbose();

const dbFile = './database.db';
const schema = fs.readFileSync('./schema.sql', 'utf8');
const seed = fs.readFileSync('./seed.sql', 'utf8');

const run = async (cmd) => {
  const db = new sqlite3.Database(dbFile);
  if (cmd === 'init') {
    await exec(db, schema);
    console.log('✅ DB initialized');
  } else if (cmd === 'seed') {
    await exec(db, seed);
    console.log('✅ DB seeded');
  } else {
    console.log('Usage: node db.js init|seed');
  }
  db.close();
};

function exec(db, sql) {
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => (err ? reject(err) : resolve()));
  });
}

run(process.argv[2]).catch(console.error);
