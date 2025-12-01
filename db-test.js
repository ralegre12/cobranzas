require('dotenv').config();
const { Client } = require('pg');

const client = new Client({
  host: '127.0.0.1',
  port: 5433,
  user: 'postgres',
  password: 'postgres',
  database: 'cobranzas',
  ssl: false,
});

client
  .connect()
  .then(() => client.query('select current_user'))
  .then((res) => console.log(res.rows))
  .catch((err) => console.error('ERROR:', err.message))
  .finally(() => client.end());
