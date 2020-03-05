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
  Rails.logger.info { 'update_public_all_universes: task START' }
  DataPoint.update_public_all_universes
  Rails.logger.info { 'update_public_all_universes: task DONE' }
end

API_TOKEN = '-VI_yuv0UzZNy4av1SM5vQlkfPK_JKnpGfMzuJR7d0M='

task :encachitize_rest_api => :environment do
  Rails.logger.info { "Encachitize: Start at #{Time.now}" }
  start_time = Time.now.to_i
  url = %q{https://api.uhero.hawaii.edu/v1/category/series?id=%d\&geo=%s\&freq=%s\&expand=true\&nocache}
  cmd = %q{curl --silent --output /dev/null -H "Authorization: Bearer %s" } % API_TOKEN

  uh_cats = Category.where(%q{universe = 'UHERO' and not (hidden or masked) and data_list_id is not null})
  uh_cats.each do |cat|
    %w{HI HAW HON KAU MAU}.each do |geo|
      %w{A Q M}.each do |freq|
        full_url = url % [cat.id, geo, freq]
        Rails.logger.debug { "Encachitize: run => #{cat.id}, #{geo}, #{freq}" }
        %x{#{cmd + full_url}}
      end
    end
  end

  coh_cats = Category.where(%q{universe = 'COH' and not (hidden or masked) and data_list_id is not null})
  coh_cats.each do |cat|
    %w{HI HAW}.each do |geo|
      %w{A Q M}.each do |freq|
        full_url = url % [cat.id, geo, freq]
        Rails.logger.debug { "Encachitize: run => #{cat.id}, #{geo}, #{freq}" }
        %x{#{cmd + full_url}}
      end
    end
  end
  duration = (Time.now.to_i - start_time) / 60
  Rails.logger.info { "Encachitize: End at #{Time.now} (took #{duration} mins)" }
end

task :export_kauai_dashboard => :environment do
  Rails.logger.info { "export_kauai_dashboard: Start at #{Time.now}" }
  cmd = %q{curl --silent -H "Authorization: Bearer %s" } % API_TOKEN
  url = %q{https://api.uhero.hawaii.edu/v1/package/export?id=%d\&nocache}

  udaman_exports = {
    'Kauai Dashboard Major Indicators Data - A'	=> %w{major_a.csv major_a_export.csv},
    'Kauai Dashboard Visitor Data - A' => %w{vis_a.csv vis_a_export.csv},
    'Kauai Dashboard Visitor Data - Q' => %w{vis_q.csv vis_q_export.csv},
    'Kauai Dashboard Visitor Data - M' => %w{vis_m.csv vis_m_export.csv},
    'Kauai Dashboard Jobs Seasonally Adjusted Data - A' => %w{jobs_a.csv jobs_a_export.csv},
    'Kauai Dashboard Jobs Seasonally Adjusted Data - Q' => %w{jobs_q.csv jobs_q_export.csv},
    'Kauai Dashboard Jobs Seasonally Adjusted Data - M' => %w{jobs_m.csv jobs_m_export.csv},
    'Kauai Dashboard Income Data - A' => %w{income_a.csv income_a_export.csv},
    'Kauai Dashboard Income Data - Q' => %w{income_q.csv},
    'Kauai Dashboard Income Data - M' => %w{income_m.csv},
    'Kauai Dashboard Construction Data - A' => %w{const_a.csv	const_a_export.csv},
    'Kauai Dashboard Construction Data - Q' => %w{const_q.csv const_q_export.csv},
    'Kauai Dashboard Construction Data - M' => %w{const_m.csv},
    'Kauai Dashboard Budget Data - A' => %w{county_rev_a.csv county_rev_a_export.csv},
    'Kauai Dashboard Budget Data - Q' => %w{county_rev_q.csv},
    'Kauai Dashboard Budget Data - M' => %w{county_rev_m.csv}
  }
  data = {}

  udaman_exports.keys.each do |export_name|
    xport = Export.find_by(name: export_name) || raise("Cannot find Export with name #{export_name}")
    response = %x{#{cmd + url % xport.id}}  ## API call
    json = JSON.parse response
    names = []
    titles = {}
    series_array = json['data']
    series_array.each do |series|
      name = series['name']
      names.push name
      titles[name] = series['title']
      levels = series['seriesObservations']['transformationResults'][0]
      data[name] = levels['dates'].map {|date| [date, levels['values'].shift ] }.to_h
    end
    all_dates = get_all_dates(data)
    CSV.generate do |csv|
      csv << ['date'] + names
      all_dates.each do |date|
        csv << [date] + names.map {|series_name| data[series_name][date] }
      end
    end
  end
  Rails.logger.info { "export_kauai_dashboard: End at #{Time.now}" }
end

private
  def get_all_dates(series_data)
    dates_array = []
    series_data.each {|_,data| dates_array |= data.keys }
    dates_array.sort
  end
