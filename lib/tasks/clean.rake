task :clean_current => :environment do
  Series.all.each { |series|
    DataPoint
        .select('max(created_at) as created_at, date')
        .where(series_id: series.id, current: 1)
        .group(:date).each { |dp|
      DataPoint.where(series_id: series.id, current: 1, date: dp.date)
          .where('created_at < ?', dp.created_at).each do |inner_dp|
        inner_dp.current = false
        inner_dp.save
      end
    }
  }
end
