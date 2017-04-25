task :update_public_data_points => :environment do
  t = Time.now
  ActiveRecord::Base.connection.execute %q(
      update public_data_points p
        join data_points d on d.series_id = p.series_id and d.date = p.date and d.current
        join series s on s.id = d.series_id
      set p.value = d.value, p.updated_at = d.updated_at
      where not s.quarantined
      and d.updated_at > p.updated_at ;

      insert public_data_points (series_id, date, value, created_at, updated_at)
      select d.series_id, d.date, d.value, d.created_at, coalesce(d.updated_at, d.created_at)
      from data_points d
        join series s on s.id = d.series_id
        left join public_data_points p on d.series_id = p.series_id and d.date = p.date
      where not s.quarantined
      and d.current
      and p.created_at is null ; /* dp doesn't exist in public_data_points yet */

      delete p  /* Can only use below-defined alias here, not full table name. Weird. */
      from public_data_points p
        join series s on s.id = p.series_id
        left join data_points d on d.series_id = p.series_id and d.date = p.date and d.current
      where not s.quarantined
      and d.created_at is null ; /* dp no longer exists in data_points */
    )
  CSV.open('public/rake_time.csv', 'a') do |csv|
    csv << ['update_public_data_points', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s]
  end
end
