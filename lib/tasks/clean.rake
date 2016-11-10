task :clean_current => :environment do
  Series.all.each { |series|
    DataPoint.select('max(created_at) as created_at, date').where(series_id: series.id, current: 1).group(:date).each { |dp|
      DataPoint.where(series_id: series.id, current: 1, date: dp.date).where('created_at < ?', dp.created_at).each do |inner_dp|
        inner_dp.current = false
        inner_dp.save
      end
    }
  }
end

desc 'Keep only the two most recent data_points for each series, data_source, and date'
task :trim_data_point_history => :environment do
  ActiveRecord::Base.connection.execute(%Q|DELETE FROM data_points
WHERE (series_id, data_source_id, date, created_at)
  IN (SELECT series_id, data_source_id, date, created_at
FROM
  (SELECT series_id, data_source_id, date, created_at,
     (CASE date
      WHEN @curDate
        THEN @curRow := @curRow + 1
      ELSE @curRow := 1 AND @curDate := date END) AS rank
   FROM data_points, (SELECT @curRow := 0, @curDate := '') r
   ORDER BY series_id, data_source_id, date, created_at DESC)
    AS older WHERE rank > 2)|)
end
