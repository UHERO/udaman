# Use this file to easily define all of your cron jobs.
#
# It's helpful, but not entirely necessary to understand cron before proceeding.
# http://en.wikipedia.org/wiki/Cron

# Example:
#
# set :output, "/path/to/my/cron_log.log"
#
# every 2.hours do
#   command "/usr/bin/some_great_command"
#   runner "MyModel.some_method"
#   rake "some:great:rake:task"
# end
#
# every 4.days do
#   runner "AnotherModel.prune_old_records"
# end

# Learn more: http://github.com/javan/whenever

set :output, {:standard => '~/Documents/cronlog/udaman-download.log', :error => '~/Documents/cronlog/udaman-error.log'}
# set :environment, 'development'
#job_type :rake,    'cd :path && rake :task :output'
job_type :rake,    "cd :path && #{%Q|DATA_PATH=#{ENV['DATA_PATH']}| unless ENV['DATA_PATH'].nil?} #{%Q|RAILS_ENV=#{ENV['RAILS_ENV']}| unless ENV['RAILS_ENV'].nil?} bundle exec rake :task"
#job_type :rake,    "cd :path && RAILS_ENV=:environment bundle exec rake :task :output"

# this is a useful short task for testing cron
# every 5.minutes do
#     rake "test_case"
# end

every 1.day, :at => '6:24 pm' do
  rake :reset_dependency_depth
end

every 1.day, :at => '8:00 pm' do
  rake :reload_aremos
end

every 1.day, :at => '1:00 am' do
  rake :update_seats_links
  rake :update_vis_history_links
end

every 1.day, at: '7:40 pm' do
  rake :purge_old_stuff
end

## The famous "Nightly Reload"
every 1.day, :at => '7:44 pm' do
  rake :batch_reload_uhero
end

every 1.day, :at => '3:00 am' do
  rake :reload_tour_ocup_series_only
end

every 1.day, :at => '5:30 am' do
  rake :update_bea_links
end

every 1.day, :at => '6:00 am' do
  rake :reload_bea_series_only
  rake :reload_bls_series_only
end

every :weekday, :at => '12:00 pm' do
  rake :reload_vispns_daily
end

every :weekday, :at => '4:15 pm' do
  rake :reload_vap_hi_daily
end

every 1.day, :at => ['9:45 am', '1:00 pm'] do
  rake :reload_covid_series
end

every :thursday, :at => '11:00 am' do
  rake :reload_uic_weekly
end

# -----------------------------------------------------------

every :day, at: '6:30 am' do
  rake :gen_investigate_csv
end

every :day, at: '6:50 am' do
  rake :aremos_exports
end

every :day, at: '8:50 am' do
  rake :tsd_exports
end

every :day, at: ['11:01 am', '12:01 pm', '1:01 pm', '2:01 pm', '3:01 pm', '4:01 pm', '5:01 pm'] do
  rake :update_public_data_points
end

every :saturday, :at => '5:00 pm' do
  rake :mark_pseudo_history
end

every :saturday, :at => '1:00 pm' do
  rake :export_kauai_dashboard
end

#bring down pv file daily
every 1.day, :at => '9:15 am' do
  runner %q|Download.get('PV_HON@hawaii.gov').download|
end
