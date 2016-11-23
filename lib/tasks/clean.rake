desc 'Set current false for older data_points when there are multiple current data_points for a given date'
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

desc 'Set data_list series associations based on the serialized list of series in each data_list'
task :add_data_list_series_associations => :environment do
  DataList.find_each(batch_size: 100) do |dl|
    # series_ids method is generated by has_and_belongs_to_many in data_list.rb
    dl.series_ids = dl.get_sibling_series_ids
  end
end