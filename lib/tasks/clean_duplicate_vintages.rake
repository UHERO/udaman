namespace :maintenance do
  desc 'Remove duplicate non-current data_points with identical values (bogus vintages from double-insert bug)'
  task :clean_duplicate_vintages, [:dry_run] => :environment do |_t, args|
    dry_run = args[:dry_run] != 'false'
    conn = ActiveRecord::Base.connection

    puts dry_run ? "=== DRY RUN (pass [false] to delete) ===" : "=== LIVE RUN - DELETING ==="

    # Build a temp table with one scan of data_points so we don't repeat the expensive GROUP BY
    puts "Scanning for duplicate vintage groups (this may take a while)..."
    t = Time.now

    conn.execute("DROP TEMPORARY TABLE IF EXISTS dup_vintage_keys")
    conn.execute(<<~SQL)
      CREATE TEMPORARY TABLE dup_vintage_keys AS
      SELECT xseries_id, date, data_source_id, value, MIN(created_at) as keep_created_at, COUNT(*) as cnt
      FROM data_points
      WHERE current = 0
      GROUP BY xseries_id, date, data_source_id, value
      HAVING cnt > 1
    SQL

    group_count = conn.select_value("SELECT COUNT(*) FROM dup_vintage_keys")
    row_count = conn.select_value("SELECT SUM(cnt) - COUNT(*) FROM dup_vintage_keys")
    puts "Found #{group_count} duplicate groups, #{row_count} rows to remove (scan took #{(Time.now - t).round(1)}s)"

    if group_count == 0
      puts "Nothing to clean up."
      next
    end

    # Show sample of worst offenders
    sample = conn.select_all(<<~SQL)
      SELECT d.xseries_id, s.name, d.date, d.data_source_id, d.value, d.cnt
      FROM dup_vintage_keys d
      LEFT JOIN xseries x ON x.id = d.xseries_id
      LEFT JOIN series s ON s.id = x.primary_series_id
      ORDER BY d.cnt DESC
      LIMIT 20
    SQL

    puts "\nTop 20 affected groups (by duplicate count):"
    puts "#{'Series'.ljust(30)} #{'Date'.ljust(12)} #{'DS'.ljust(8)} #{'Value'.ljust(15)} Dupes"
    puts "-" * 85
    sample.each do |row|
      puts "#{(row['name'] || '?').ljust(30)} #{row['date'].to_s.ljust(12)} #{row['data_source_id'].to_s.ljust(8)} #{row['value'].to_s.ljust(15)} #{row['cnt']}"
    end

    unless dry_run
      puts "\nDeleting #{row_count} duplicate rows..."
      t = Time.now
      conn.execute(<<~SQL)
        DELETE dp FROM data_points dp
        INNER JOIN dup_vintage_keys d
          ON dp.xseries_id = d.xseries_id
          AND dp.date = d.date
          AND dp.data_source_id = d.data_source_id
          AND dp.value <=> d.value
          AND dp.created_at != d.keep_created_at
        WHERE dp.current = 0
      SQL
      puts "Done (delete took #{(Time.now - t).round(1)}s)"
    end

    conn.execute("DROP TEMPORARY TABLE IF EXISTS dup_vintage_keys")
  end
end
