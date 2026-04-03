import { DatabaseSync } from "node:sqlite";
import path from "node:path";

const dbPath = path.join(process.cwd(), "dev.db");
const db = new DatabaseSync(dbPath);

const socialColumns = [
  "instagram_url",
  "linkedin_url",
  "twitter_url",
  "youtube_url",
  "facebook_url",
  "website_url",
  "github_url",
  "telegram_url",
  "snapchat_url",
  "portfolio_url"
];

db.exec(`
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
`);

function ensureProfileSocialColumns() {
  const existingColumns = db
    .prepare("PRAGMA table_info(profiles)")
    .all()
    .map((column) => column.name);

  for (const column of socialColumns) {
    if (!existingColumns.includes(column)) {
      db.exec(`ALTER TABLE profiles ADD COLUMN ${column} TEXT`);
    }
  }
}

export function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      profession TEXT NOT NULL,
      bio TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_code TEXT NOT NULL UNIQUE,
      is_activated INTEGER NOT NULL DEFAULT 0,
      user_id INTEGER UNIQUE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS leads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS contact_saves (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS shared_contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS action_clicks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      FOREIGN KEY (card_id) REFERENCES cards(id) ON DELETE CASCADE
    );
  `);

  ensureProfileSocialColumns();

  const cardCount = db.prepare("SELECT COUNT(*) AS count FROM cards").get().count;

  if (cardCount > 0) {
    return;
  }

  const insertUser = db.prepare(`
    INSERT INTO users (name, email, phone)
    VALUES (?, ?, ?)
  `);

  const insertProfile = db.prepare(`
    INSERT INTO profiles (user_id, profession, bio)
    VALUES (?, ?, ?)
  `);

  const insertCard = db.prepare(`
    INSERT INTO cards (card_code, is_activated, user_id)
    VALUES (?, ?, ?)
  `);

  const activeUser = insertUser.run(
    "noshin naved ck",
    "noshin@example.com",
    "+91 98765 43210"
  );

  insertProfile.run(
    activeUser.lastInsertRowid,
    "ceo",
    "Tap to save contact instantly."
  );

  insertCard.run("ABCD123", 1, activeUser.lastInsertRowid);
  insertCard.run("WXYZ789", 0, null);
}

export function getCardByCode(cardCode) {
  return db
    .prepare(
      `
      SELECT
        cards.id,
        cards.card_code,
        cards.is_activated,
        cards.user_id,
        users.name,
        users.email,
        users.phone,
        profiles.profession,
        profiles.bio,
        profiles.instagram_url,
        profiles.linkedin_url,
        profiles.twitter_url,
        profiles.youtube_url,
        profiles.facebook_url,
        profiles.website_url,
        profiles.github_url,
        profiles.telegram_url,
        profiles.snapchat_url,
        profiles.portfolio_url
      FROM cards
      LEFT JOIN users ON users.id = cards.user_id
      LEFT JOIN profiles ON profiles.user_id = users.id
      WHERE cards.card_code = ?
      `
    )
    .get(cardCode);
}

export function activateCard(cardCode, { name, phone, email, profession }) {
  const existingCard = db
    .prepare("SELECT id, is_activated FROM cards WHERE card_code = ?")
    .get(cardCode);

  if (!existingCard) {
    return { ok: false, reason: "not_found" };
  }

  if (existingCard.is_activated) {
    return { ok: false, reason: "already_activated" };
  }

  const createUser = db.prepare(`
    INSERT INTO users (name, email, phone)
    VALUES (?, ?, ?)
  `);

  const createProfile = db.prepare(`
    INSERT INTO profiles (user_id, profession, bio)
    VALUES (?, ?, ?)
  `);

  const updateCard = db.prepare(`
    UPDATE cards
    SET user_id = ?, is_activated = 1
    WHERE card_code = ?
  `);

  const user = createUser.run(name, email, phone);

  createProfile.run(user.lastInsertRowid, profession, "");
  updateCard.run(user.lastInsertRowid, cardCode);

  return { ok: true };
}

export function incrementCardViews(cardCode) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS card_views (
      card_code TEXT PRIMARY KEY,
      views INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (card_code) REFERENCES cards(card_code) ON DELETE CASCADE
    );
  `);

  db.prepare(`
    INSERT INTO card_views (card_code, views)
    VALUES (?, 1)
    ON CONFLICT(card_code) DO UPDATE SET views = views + 1
  `).run(cardCode);
}

export function getCardViews(cardCode) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS card_views (
      card_code TEXT PRIMARY KEY,
      views INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (card_code) REFERENCES cards(card_code) ON DELETE CASCADE
    );
  `);

  const result = db
    .prepare("SELECT views FROM card_views WHERE card_code = ?")
    .get(cardCode);

  return result?.views ?? 0;
}

export function logLead(cardId) {
  try {
    db.prepare(`
      INSERT INTO leads (card_id, timestamp)
      VALUES (?, ?)
    `).run(cardId, new Date().toISOString());
  } catch (error) {
    console.error("lead tracking failed", error);
  }
}

export function logContactSave(cardId) {
  try {
    db.prepare(`
      INSERT INTO contact_saves (card_id, timestamp)
      VALUES (?, ?)
    `).run(cardId, new Date().toISOString());
  } catch (error) {
    console.error("contact save tracking failed", error);
  }
}

export function getDashboardStats(cardCode) {
  const card = db
    .prepare(`
      SELECT id, card_code, is_activated
      FROM cards
      WHERE card_code = ?
    `)
    .get(cardCode);

  if (!card) {
    return null;
  }

  const totalProfileVisits =
    db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM leads
        WHERE card_id = ?
      `)
      .get(card.id)?.count ?? 0;

  const totalContactsSaved =
    db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM contact_saves
        WHERE card_id = ?
      `)
      .get(card.id)?.count ?? 0;

  const totalClicks =
    db
      .prepare(`
        SELECT COUNT(*) AS count
        FROM action_clicks
        WHERE card_id = ?
      `)
      .get(card.id)?.count ?? 0;

  return {
    cardId: card.id,
    cardCode: card.card_code,
    isActivated: card.is_activated,
    totalProfileVisits,
    totalContactsSaved,
    totalClicks
  };
}

export function getDefaultDashboardStats() {
  const card = db
    .prepare(`
      SELECT card_code
      FROM cards
      WHERE is_activated = 1
      ORDER BY id ASC
      LIMIT 1
    `)
    .get();

  if (!card) {
    return null;
  }

  return getDashboardStats(card.card_code);
}

export function saveSharedContact(cardCode, { name, phone, email }) {
  const card = db
    .prepare(`
      SELECT id
      FROM cards
      WHERE card_code = ?
    `)
    .get(cardCode);

  if (!card) {
    return { ok: false, reason: "not_found" };
  }

  db.prepare(`
    INSERT INTO shared_contacts (card_id, name, phone, email, timestamp)
    VALUES (?, ?, ?, ?, ?)
  `).run(card.id, name, phone, email, new Date().toISOString());

  return { ok: true };
}

export function logActionClick(cardId, action) {
  try {
    db.prepare(`
      INSERT INTO action_clicks (card_id, action, timestamp)
      VALUES (?, ?, ?)
    `).run(cardId, action, new Date().toISOString());
  } catch (error) {
    console.error("action click tracking failed", error);
  }
}
