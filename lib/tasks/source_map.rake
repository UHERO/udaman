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
  full_set_ids = Series.get_all_uhero.pluck(:id)
  full_set_ids -= Series.search_box('#load_from_bls', limit: 9999).pluck(:id)
  full_set_ids -= Series.search_box('#load_from_bea', limit: 9999).pluck(:id)
  full_set_ids -= Series.search_box('#bea.gov', limit: 9999).pluck(:id)
  full_set_ids -= Series.search_box('#tour_ocup%Y').pluck(:id)
  full_set_ids -= Series.search_box('^vap.*ns$ @hi .d').pluck(:id)
  mgr = SeriesReloadManager.new(Series.where(id: full_set_ids), 'full', true)
  Rails.logger.info { "Task batch_reload_uhero: ship off to SeriesReloadManager, batch_id=#{mgr.batch_id}" }
  mgr.batch_reload
end

task :purge_old_logs => :environment do
  SeriesReloadLog.purge_old_logs
  DsdLogEntry.purge_old_logs(6.weeks)
end

task :build_rebuild => :environment do
  File.open('lib/tasks/REBUILD.rb', 'w') do |file|
    DataSource.order(:last_run_in_seconds).each do |ds|
      file.puts(ds.get_eval_statement) unless ds.series.nil?
    end
  end
end

task :reload_hiwi_series_only => :environment do
  Rails.logger.info { 'reload_hiwi_series_only: starting task, gathering series' }
  hiwi_series = Series.get_all_series_by_eval('hiwi.org')
  ## Convert this to use Series.reload_with_dependencies instead
  mgr = SeriesReloadManager.new(hiwi_series, 'hiwi', true)
  Rails.logger.info { "Task reload_hiwi_series_only: ship off to SeriesReloadManager, batch_id=#{mgr.batch_id}" }
  mgr.batch_reload
end

task :reload_bls_series_only => :environment do
  Rails.logger.info { 'reload_bls_series_only: starting task, gathering series' }
  bls_series = Series.get_all_series_by_eval('load_from_bls')
  ## Convert this to use Series.reload_with_dependencies instead
  mgr = SeriesReloadManager.new(bls_series, 'bls', true)
  Rails.logger.info { "Task reload_bls_series_only: ship off to SeriesReloadManager, batch_id=#{mgr.batch_id}" }
  mgr.batch_reload
end

task :reload_bea_series_only => :environment do
  Rails.logger.info { 'reload_bea_series_only: starting task, gathering series' }
  bea_series = Series.get_all_series_by_eval(%w{load_from_bea bea.gov})
  ## Convert this to use Series.reload_with_dependencies instead
  mgr = SeriesReloadManager.new(bea_series, 'bea', true)
  Rails.logger.info { "Task reload_bea_series_only: ship off to SeriesReloadManager, batch_id=#{mgr.batch_id}" }
  mgr.batch_reload
end

task :reload_vap_hi_daily_series_only => :environment do
  Rails.logger.info { 'reload_vap_hi_daily_series_only: starting task, gathering series' }
  vap_hi_dailies = Series.search_box('^vap.*ns$ @hi .d')
  Series.reload_with_dependencies(vap_hi_dailies.pluck(:id), 'vaphid', true)
end

task :reload_tour_ocup_series_only => :environment do
  Rails.logger.info { 'reload_tour_ocup_series_only: starting task' }
  tour_ocup = Series.search_box('#tour_ocup%Y')
  Series.reload_with_dependencies(tour_ocup.pluck(:id), 'tour_ocup', true)
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
  udaman_exports = {
    'Kauai Dashboard Major Indicators Data - A'	=> %w{major_a.csv major_a_export.csv},
    'Kauai Dashboard Major Indicators Data - Q'	=> %w{major_q.csv},  ## no download file name here
    'Kauai Dashboard Major Indicators Data - M'	=> %w{major_m.csv},  ## no download file name here
    'Kauai Dashboard Visitor Data - A' => %w{vis_a.csv vis_a_export.csv},
    'Kauai Dashboard Visitor Data - Q' => %w{vis_q.csv vis_q_export.csv},
    'Kauai Dashboard Visitor Data - M' => %w{vis_m.csv vis_m_export.csv},
    'Kauai Dashboard Jobs Seasonally Adjusted Data - A' => %w{jobs_a.csv jobs_a_export.csv},
    'Kauai Dashboard Jobs Seasonally Adjusted Data - Q' => %w{jobs_q.csv jobs_q_export.csv},
    'Kauai Dashboard Jobs Seasonally Adjusted Data - M' => %w{jobs_m.csv jobs_m_export.csv},
    'Kauai Dashboard Income Data - A' => %w{income_a.csv income_a_export.csv},
    'Kauai Dashboard Construction Data - A' => %w{const_a.csv	const_a_export.csv},
    'Kauai Dashboard Construction Data - Q' => %w{const_q.csv const_q_export.csv},
    'Kauai Dashboard Budget Data - A' => %w{county_rev_a.csv county_rev_a_export.csv}
  }
  data_path =   File.join(ENV['DATA_PATH'], 'kauai_dash', 'data')
  export_path = File.join(ENV['DATA_PATH'], 'kauai_dash', 'export_data')

  udaman_exports.keys.each do |export_name|
    xport = Export.find_by(name: export_name) || raise("Cannot find Export with name #{export_name}")
    Rails.logger.info { "export_kauai_dashboard: Processing #{export_name}" }
    xport_series = xport.series.order('export_series.list_order')
    names = xport_series.pluck(:name)
    data = xport.series_data
    ### Find all unique dates across all series in this udaman export.
    ### There can be widely varying ranges, and file output needs to cover all
    all_dates = xport.data_dates

    ### Create the file that uses series names for dashboard-internal use
    filename = File.join(data_path, udaman_exports[export_name][0])
    CSV.open(filename, 'wb') do |csv|
      csv << ['date'] + names
      all_dates.each do |date|
        csv << [date] + names.map {|name| '%.02f' % data[name][date] rescue nil }
      end
    end
    ### Create the file that uses series titles for end-user download
    next unless udaman_exports[export_name][1]
    titles = xport_series.pluck(:dataPortalName)
    filename = File.join(export_path, udaman_exports[export_name][1])
    CSV.open(filename, 'wb') do |csv|
      csv << ['date'] + titles
      all_dates.each do |date|
        csv << [date] + names.map {|name| '%.02f' % data[name][date] rescue nil }
      end
    end
  end

  ## Create necessary empty files
  %w{const_m.csv county_rev_m.csv county_rev_q.csv income_m.csv income_q.csv}.each do |empty_file|
    %x{cat /dev/null > #{File.join(data_path, empty_file)} }
  end

  Rails.logger.info { "export_kauai_dashboard: End at #{Time.now}" }
end
