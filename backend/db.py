from contextlib import contextmanager
from pathlib import Path

import pymysql


ROOT = Path(__file__).resolve().parents[1]


class Database:
    def __init__(self, config):
        self.config = config

    def connect(self):
        return pymysql.connect(
            host=self.config.db_host,
            port=self.config.db_port,
            user=self.config.db_user,
            password=self.config.db_password,
            database=self.config.db_name,
            charset="utf8mb4",
            autocommit=False,
            cursorclass=pymysql.cursors.DictCursor,
        )

    def initialize(self):
        sql = (ROOT / "db" / "schema.mysql.sql").read_text(encoding="utf-8")
        with self.connect() as conn:
            with conn.cursor() as cursor:
                for statement in split_sql(sql):
                    cursor.execute(statement)
            conn.commit()

    def query(self, sql, args=None):
        with self.connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, args or ())
                return cursor.fetchall()

    def one(self, sql, args=None):
        rows = self.query(sql, args)
        return rows[0] if rows else None

    def execute(self, sql, args=None):
        with self.connect() as conn:
            with conn.cursor() as cursor:
                cursor.execute(sql, args or ())
                last_id = cursor.lastrowid
            conn.commit()
            return last_id

    @contextmanager
    def transaction(self):
        conn = self.connect()
        try:
            yield conn
            conn.commit()
        except Exception:
            conn.rollback()
            raise
        finally:
            conn.close()


def split_sql(sql):
    statements = []
    current = []
    in_quote = None
    escape = False
    for char in sql:
        current.append(char)
        if escape:
            escape = False
            continue
        if char == "\\":
            escape = True
            continue
        if char in ("'", '"'):
            if in_quote == char:
                in_quote = None
            elif not in_quote:
                in_quote = char
        if char == ";" and not in_quote:
            statement = "".join(current).strip().rstrip(";")
            if statement:
                statements.append(statement)
            current = []
    tail = "".join(current).strip()
    if tail:
        statements.append(tail)
    return statements
