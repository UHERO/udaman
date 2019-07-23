task :reload_aremos => :environment do
  puts ENV
  puts ENV['DATA_PATH']
  #evenaully move this to a standalone task
  CSV.open('public/rake_time.csv', 'wb') {|csv| csv << %w(name duration start end) }
  
  #this currently runs in 5 minutes even with the complete delete
  AremosSeries.delete_all
   t = Time.now
  AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/A_DATA.TSD")
  at = Time.now
  AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/S_DATA.TSD")
  st = Time.now
  AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/Q_DATA.TSD")
  qt = Time.now 
  AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/M_DATA.TSD")
  mt = Time.now
   AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/W_DATA.TSD")
   wt = Time.now
   AremosSeries.load_tsd("#{ENV['DATA_PATH']}/EXPORT/D_DATA.TSD")
   dt = Time.now
   
  puts "#{'%.2f' % (dt - t)} | to write all"
  puts "#{'%.2f' % (dt-wt)} | days"
  puts "#{'%.2f' % (wt-mt)} | weeks"
  puts "#{'%.2f' % (mt-qt)} | months"
  puts "#{'%.2f' % (qt-st)} | quarters"
  puts "#{'%.2f' % (st-at)} | half-years"
  puts "#{'%.2f' % (at-t)} | years"
  
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['reload_aremos', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end


task :reset_dependency_depth => :environment do
  t = Time.now
  DataSource.set_dependencies
  Series.assign_dependency_depth
  Rails.logger.info { "Reset dependency depth: Done in #{Time.now - t} seconds" }
end

desc 'Switch rails logger to stdout'
task verbose: [:environment] do
  Rails.logger = ActiveRecord::Base.logger = Logger.new(STDOUT)
end

desc 'Switch logging to debug'
task debug: [:environment, :verbose] do
  Rails.logger.level = ActiveRecord::Base.logger.level = Logger::DEBUG
end

## The famous "Nightly Reload"
task :batch_reload_uhero => :environment do
  SeriesReloadManager.new.batch_reload
end

task :reload_stales_only => :environment do
  stales = Series.stale_since Time.now.days_ago(2)
  if stales.count < 100  ## I dunno... if there's more than this, there's a major issue that needs to be addressed
    series = Series.where id: stales.map {|a| a[0] } ## a[0] is the series.id
    SeriesReloadManager.new(series, 'stales').batch_reload
  end
end

task :purge_old_reload_logs => :environment do
  SeriesReloadLog.purge_old_logs
end

task :build_rebuild => :environment do
  File.open('lib/tasks/REBUILD.rb', 'w') do |file|
    DataSource.order(:last_run_in_seconds).each do |ds|
      file.puts(ds.get_eval_statement) unless ds.series.nil?
    end
  end
end

task :reload_hiwi_series_only => :environment do
  t = Time.now
  Rails.logger.info { 'reload_hiwi_series_only: starting task, gathering series' }
  hiwi_series = Series.get_all_series_by_eval('hiwi.org')
  mgr = SeriesReloadManager.new(hiwi_series, 'hiwi')
  Rails.logger.info { "Task reload_hiwi_series_only: ship off to SeriesReloadManager, batch_id=#{mgr.batch_id}" }
  mgr.batch_reload
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['hiwi series dependency check and load', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :reload_bls_series_only => :environment do
  t = Time.now
  Rails.logger.info { 'reload_bls_series_only: starting task, gathering series' }
  bls_series = Series.get_all_series_by_eval('load_from_bls')
  mgr = SeriesReloadManager.new(bls_series, 'bls')
  Rails.logger.info { "Task reload_bls_series_only: ship off to SeriesReloadManager, batch_id=#{mgr.batch_id}" }
  mgr.batch_reload
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['bls series dependency check and load', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :reload_bea_series_only => :environment do
  t = Time.now
  Rails.logger.info { 'reload_bea_series_only: starting task, gathering series' }
  bea_series = Series.get_all_series_by_eval(%w{load_from_bea bea.gov})
  mgr = SeriesReloadManager.new(bea_series, 'bea')
  Rails.logger.info { "Task reload_bea_series_only: ship off to SeriesReloadManager, batch_id=#{mgr.batch_id}" }
  mgr.batch_reload
  CSV.open('public/rake_time.csv', 'a') {|csv| csv << ['bea series dependency check and load', '%.2f' % (Time.now - t) , t.to_s, Time.now.to_s] }
end

task :update_public_data_points => :environment do
  Rails.logger.info { 'update_public_data_points: UHERO' }
  DataPoint.update_public_data_points('UHERO')
  Rails.logger.info { 'update_public_data_points: COH' }
  DataPoint.update_public_data_points('COH')
  Rails.logger.info { 'update_public_data_points: UHEROCOH' }
  DataPoint.update_public_data_points('UHEROCOH')
  Rails.logger.info { 'update_public_data_points: task DONE' }
end
