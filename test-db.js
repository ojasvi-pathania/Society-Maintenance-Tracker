const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('test.db');
db.exec('CREATE TABLE IF NOT EXISTS test (id INTEGER PRIMARY KEY, name TEXT)');
db.exec("INSERT INTO test (name) VALUES ('society')");
const row = db.prepare('SELECT * FROM test').get();
console.log('NATIVE SQLITE SUCCESS:', row);
