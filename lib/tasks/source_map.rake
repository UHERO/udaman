task :reset_dependency_depth => :environment do
  Rails.logger.info { 'reset_dependency_depth: Start' }
  DataSource.set_all_dependencies
  Series.assign_dependency_depth
  Rails.logger.info { 'reset_dependency_depth: Done' }
end

desc 'Switch rails logger to stdout'
task verbose: [:environment] do
  Rails.logger = ActiveRecord::Base.logger = Logger.new(STDOUT)
end

desc 'Switch logging to debug'
task debug: [:environment, :verbose] do
  Rails.logger.level = ActiveRecord::Base.logger.level = Logger::DEBUG
end

## The (in)famous "Nightly Reload"
task :batch_reload_uhero => :environment do
  full_set_ids = Series.get_all_uhero.pluck(:id)
  full_set_ids -= Series.search_box('#load_api_bls').pluck(:id)
  full_set_ids -= Series.search_box('#load_api_bea').pluck(:id)
  full_set_ids -= Series.search_box('#tour_ocup%Y').pluck(:id)
  full_set_ids -= Series.search_box('^vap ~ns$ @hi .d').pluck(:id)
  mgr = SeriesReloadManager.new(Series.where(id: full_set_ids), 'full', nightly: true)
  Rails.logger.info { "Task batch_reload_uhero: ship off to SeriesReloadManager, batch_id=#{mgr.batch_id}" }
  mgr.batch_reload
  DataPoint.update_public_all_universes
end

task :purge_old_stuff => :environment do
  ReloadJob.purge_old_jobs
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
  hiwi_series = Series.search_box('#hiwi.org')
  Series.reload_with_dependencies(hiwi_series.pluck(:id), 'hiwi', nightly: true)
  DataPoint.update_public_all_universes
end

task :reload_bls_series_only => :environment do
  Rails.logger.info { 'reload_bls_series_only: starting task, gathering series' }
  bls_series = Series.search_box('#load_api_bls')
  Series.reload_with_dependencies(bls_series.pluck(:id), 'bls', nightly: true)
  DataPoint.update_public_all_universes
end

task :reload_bea_series_only => :environment do
  Rails.logger.info { 'reload_bea_series_only: starting task, gathering series' }
  bea_series = Series.search_box('#load_api_bea')
  Series.reload_with_dependencies(bea_series.pluck(:id), 'bea', nightly: true, group_size: 10) ### reduce group size, bec we are blowing out BEA's req/min quota
  DataPoint.update_public_all_universes
end

task :reload_tour_ocup_series_only => :environment do
  Rails.logger.info { 'reload_tour_ocup_series_only: starting task' }
  tour_ocup = Series.search_box('#tour_ocup%Y')
  Series.reload_with_dependencies(tour_ocup.pluck(:id), 'tour_ocup', nightly: true)
end

task :reload_vap_hi_daily => :environment do
  ReloadJobDaemon.enqueue('vaphid', '^vap ~ns$ @hi .d')
end

task :reload_covid_series => :environment do
  ReloadJobDaemon.enqueue('covid', '~cv_,covcase,covhosp,covid')
end

task :reload_uic_weekly => :environment do
  ReloadJobDaemon.enqueue('uic_weekly', '#uic@hawa')
end

task :update_public_data_points => :environment do
  Rails.logger.info { 'update_public_all_universes: task START' }
  DataPoint.update_public_all_universes
  Rails.logger.info { 'update_public_all_universes: task DONE' }
end

API_TOKEN = '-VI_yuv0UzZNy4av1SM5vQlkfPK_JKnpGfMzuJR7d0M='

def pull_cat_series_from_api(univ, cat_id, geo, freq)
  cat_url = %q{https://api.uhero.hawaii.edu/v1/category/series?id=%d\&geo=%s\&freq=%s\&expand=true\&nocache}
  pkg_url = %q{https://api.uhero.hawaii.edu/v1/package/series?id=%d\&u=%s\&cat=%d\&nocache}
  cmd = %q{curl --silent -H "Authorization: Bearer %s" } % API_TOKEN
  delay = 13
  try = 0

  Rails.logger.debug { "Encachitize: #{univ} category run => id #{cat_id}, #{geo}, #{freq}" }
  full_url = cat_url % [cat_id, geo, freq]
  begin
    content = %x{#{cmd + full_url}}
    json = JSON.parse content
  rescue => e
    if try >= 4  ## only try 4 times
      Rails.logger.error { "Encachitize: cat #{cat_id}, #{geo}, #{freq}: #{e.message}" }
      puts ">>> FAIL: #{e.message}"   ## should go to the encache log file
      return
    end
    Rails.logger.warn { "Encachitize: retrying cat #{cat_id}, #{geo}, #{freq}: #{e.message}" }
    sleep delay
    delay *= 1.375  ## linear? backoff (good enough)
    try += 1
    retry
  end
  return unless freq == 'D'   ### only cache daily series packages for now
  return unless json && json['data']   ### maybe no D series in this category
  json['data'].each do |series|
    sid = series['id'].to_i
    full_url = pkg_url % [sid, univ, cat_id]
    Rails.logger.debug { "Encachitize: package run => series #{sid}, #{univ}, cat=#{cat_id}" }
    %x{#{cmd + '--output /dev/null ' + full_url}}
  end
end

task :encachitize_rest_api => :environment do
  Rails.logger.info { "Encachitize: Start at #{Time.now}" }
  start_time = Time.now.to_i

  uh_cats = Category.where(%q{universe = 'UHERO' and not (hidden or masked) and data_list_id is not null})
  Rails.logger.info { "Encachitize: Doing UHERO, #{uh_cats.count} cats" }
  uh_cats.each do |cat|
    %w{HI HAW HON KAU MAU}.each do |geo|
      %w{A S Q M W D}.each do |freq|
        pull_cat_series_from_api('uhero', cat.id, geo, freq)
      end
    end
  end

  coh_cats = Category.where(%q{universe = 'COH' and not (hidden or masked) and data_list_id is not null})
  Rails.logger.info { "Encachitize: Doing COH, #{coh_cats.count} cats" }
  coh_cats.each do |cat|
    %w{HI HAW}.each do |geo|
      %w{A S Q M W D}.each do |freq|
        pull_cat_series_from_api('coh', cat.id, geo, freq)
      end
    end
  end

  ccom_cats = Category.where(%q{universe = 'CCOM' and not (hidden or masked) and data_list_id is not null})
  Rails.logger.info { "Encachitize: Doing CCOM, #{ccom_cats.count} cats" }
  ccom_cats.each do |cat|
    %w{HI HAW HON KAU MAU}.each do |geo|
      %w{A S Q M W D}.each do |freq|
        pull_cat_series_from_api('ccom', cat.id, geo, freq)
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
