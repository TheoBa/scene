#!/usr/bin/env python3
"""Phase-A profiling: PySpark over the raw Ticketmaster dumps.

Goal (see docs/ingestion_ticketmaster.md §5): before committing to a schema
mapping, measure what we actually got — field coverage, volumes, the
classification breakdown (to quantify the "Arts & Theatre" noise), and a
candidate dedup key (title + venue + date) for cross-source matching against
theatre.info / France Billet.

Reads the per-page raw JSON files (each is a single Discovery response object:
{ _embedded.events[], _links, page }) and explodes them into one row per event.
"""
from __future__ import annotations

import sys
from pathlib import Path

try:
    from pyspark.sql import SparkSession, functions as F
except ImportError:  # pragma: no cover
    print("Missing deps. Run: pip install -r requirements.txt", file=sys.stderr)
    raise

RAW_DIR = Path(__file__).parent / "raw"


def main() -> None:
    if not RAW_DIR.exists() or not any(RAW_DIR.glob("*.json")):
        sys.exit(f"No raw JSON in {RAW_DIR}. Run pull.py first.")

    spark = (
        SparkSession.builder
        .appName("scenes-ticketmaster-profile")
        .master("local[*]")
        .config("spark.sql.session.timeZone", "UTC")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    # multiLine=True: each file is one JSON object (a page), not NDJSON.
    raw = spark.read.option("multiLine", True).json(f"{RAW_DIR}/*.json")

    # Explode _embedded.events -> one row per event, dedup by TM id across pages.
    events = (
        raw.select(F.explode("_embedded.events").alias("e"))
        .select("e.*")
        .dropDuplicates(["id"])
    )
    n = events.count()
    print(f"\n=== {n} distinct events ===")
    if n == 0:
        spark.stop()
        return

    print("\n--- schema ---")
    events.printSchema()

    # Flatten the fields we care about for the schema mapping.
    flat = events.select(
        "id",
        "name",
        F.col("url").alias("ticket_url"),
        F.col("dates.start.localDate").alias("local_date"),
        F.col("dates.start.localTime").alias("local_time"),
        F.col("dates.start.dateTime").alias("starts_at_utc"),
        F.expr("_embedded.venues[0].name").alias("venue"),
        F.expr("_embedded.venues[0].city.name").alias("city"),
        F.expr("_embedded.venues[0].postalCode").alias("postal_code"),
        F.expr("classifications[0].segment.name").alias("segment"),
        F.expr("classifications[0].genre.name").alias("genre"),
        F.expr("classifications[0].subGenre.name").alias("sub_genre"),
    )

    print("\n--- classification breakdown (quantifies segment noise) ---")
    flat.groupBy("segment", "genre").count().orderBy(F.desc("count")).show(40, False)

    print("\n--- events per venue (top 30) ---")
    flat.groupBy("venue", "city").count().orderBy(F.desc("count")).show(30, False)

    print("\n--- date coverage ---")
    flat.agg(
        F.min("local_date").alias("earliest"),
        F.max("local_date").alias("latest"),
        F.count(F.when(F.col("starts_at_utc").isNull(), 1)).alias("missing_datetime"),
    ).show(truncate=False)

    # Candidate cross-source dedup key: normalised title + venue + date.
    print("\n--- candidate dedup key collisions (same show, multiple rows) ---")
    dedup = flat.withColumn(
        "dedup_key",
        F.concat_ws("|", F.lower(F.trim("name")), F.lower(F.trim("venue")), "local_date"),
    )
    dedup.groupBy("dedup_key").count().filter("count > 1").orderBy(
        F.desc("count")
    ).show(20, False)

    print("\n--- field null-coverage (lower = better populated) ---")
    flat.select([
        F.round(F.avg(F.col(c).isNull().cast("int")), 3).alias(c)
        for c in flat.columns
    ]).show(truncate=False)

    spark.stop()


if __name__ == "__main__":
    main()
